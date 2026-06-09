import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'
import { isWorkingDay, getHolidaySet } from '../lib/leaveCalendar'

const router = Router()

// ─── Helpers ─────────────────────────────────────────────────────

function todayMidnightUTC(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseHHmm(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number)
  return { h, m }
}

async function getConfig(schoolId: string | null) {
  if (schoolId) {
    const cfg = await prisma.staffAttendanceConfig.findUnique({ where: { schoolId } })
    if (cfg) return cfg
  }
  return { startTime: '07:30', cutoffTime: '09:00', absenceAlertDays: 3, frequentAbsenceDays: 3, frequentLatenessCount: 5 }
}

/** Fire anomaly notifications after a record is created/updated */
async function checkAndNotifyAnomalies(teacherId: string) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { displayName: true } } },
    })
    if (!teacher) return

    const cfg = await getConfig(teacher.schoolId)
    const name = teacher.user?.displayName ?? 'Unknown'

    const now = new Date()

    // Frequent absence: ≥3 absences in last 14 days
    const fourteenDaysAgo = new Date(now)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const recentAbsences = await prisma.staffAttendanceRecord.count({
      where: { teacherId, status: 'ABSENT', autoMarked: true, date: { gte: fourteenDaysAgo } },
    })
    if (recentAbsences >= cfg.frequentAbsenceDays) {
      await notifyHOD(teacher, `${name} has been absent ${recentAbsences} times in the last 14 days.`, 'FREQUENT_ABSENCE')
    }

    // Frequent lateness: ≥5 late in last 30 days
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentLate = await prisma.staffAttendanceRecord.count({
      where: { teacherId, status: 'LATE', date: { gte: thirtyDaysAgo } },
    })
    if (recentLate >= cfg.frequentLatenessCount) {
      await notifyHOD(teacher, `${name} has been late ${recentLate} times in the last 30 days.`, 'FREQUENT_LATENESS')
    }

    // Consecutive absence: ≥3 consecutive working days absent with no approved leave
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentRecords = await prisma.staffAttendanceRecord.findMany({
      where: { teacherId, date: { gte: sevenDaysAgo }, status: 'ABSENT', autoMarked: true },
      orderBy: { date: 'desc' },
    })
    if (recentRecords.length >= cfg.absenceAlertDays) {
      // Check if there is an approved leave covering these dates
      const approvedLeave = await prisma.leaveApplication.findFirst({
        where: {
          teacherId,
          status: 'PRINCIPAL_APPROVED',
          startDate: { lte: recentRecords[0].date },
          endDate: { gte: recentRecords[recentRecords.length - 1].date },
        },
      })
      if (!approvedLeave) {
        await notifyHOD(teacher, `${name} has been absent for ${recentRecords.length} consecutive working days with no approved leave.`, 'CONSECUTIVE_ABSENCE', true)
        await notifyPrincipal(teacher, `${name} — ${recentRecords.length} consecutive unexplained absences.`, 'CONSECUTIVE_ABSENCE')
      }
    }
  } catch {
    // non-fatal
  }
}

async function notifyHOD(
  teacher: { schoolId: string | null; department: string | null },
  message: string,
  type: string,
  highPriority = false,
) {
  if (!teacher.department) return
  const hodUsers = await prisma.user.findMany({
    where: { role: 'hod', teacher: { department: teacher.department } },
    select: { id: true },
  })
  for (const u of hodUsers) {
    await send({ userId: u.id, title: type, message, type: highPriority ? 'error' : 'warning' })
  }
}

async function notifyPrincipal(
  teacher: { schoolId: string | null },
  message: string,
  type: string,
) {
  const principals = await prisma.user.findMany({ where: { role: 'principal' }, select: { id: true } })
  for (const u of principals) {
    await send({ userId: u.id, title: type, message, type: 'error' })
  }
}

// ─── POST /check-in ───────────────────────────────────────────────

router.post('/check-in', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const teacher = await prisma.teacher.findUnique({ where: { userId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

    const today = todayMidnightUTC()
    const holidays = await getHolidaySet(teacher.schoolId ?? undefined)
    if (!isWorkingDay(today, holidays)) { res.status(400).json({ success: false, message: 'Today is not a working day' }); return }

    const existing = await prisma.staffAttendanceRecord.findUnique({
      where: { teacherId_date: { teacherId: teacher.id, date: today } },
    })
    if (existing?.checkInAt) { res.status(409).json({ success: false, message: 'Already checked in today' }); return }

    const cfg = await getConfig(teacher.schoolId)
    const now = new Date()
    const { h, m } = parseHHmm(cfg.startTime)
    const startMs = new Date(today).setHours(h, m, 0, 0)
    const diffMinutes = Math.floor((now.getTime() - startMs) / 60000)
    const isLate = diffMinutes > 0
    const status = isLate ? 'LATE' : 'PRESENT'

    const { locationLat, locationLng, locationLabel } = req.body as {
      locationLat?: number; locationLng?: number; locationLabel?: string
    }

    const record = await prisma.staffAttendanceRecord.upsert({
      where: { teacherId_date: { teacherId: teacher.id, date: today } },
      create: {
        teacherId: teacher.id,
        date: today,
        checkInAt: now,
        status,
        lateMinutes: isLate ? diffMinutes : 0,
        locationLat: locationLat ?? null,
        locationLng: locationLng ?? null,
        locationLabel: locationLabel ?? null,
      },
      update: {
        checkInAt: now,
        status,
        lateMinutes: isLate ? diffMinutes : 0,
        locationLat: locationLat ?? null,
        locationLng: locationLng ?? null,
        locationLabel: locationLabel ?? null,
      },
    })

    await checkAndNotifyAnomalies(teacher.id)
    res.json({ success: true, data: record })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /check-out ──────────────────────────────────────────────

router.post('/check-out', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const teacher = await prisma.teacher.findUnique({ where: { userId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

    const today = todayMidnightUTC()
    const record = await prisma.staffAttendanceRecord.findUnique({
      where: { teacherId_date: { teacherId: teacher.id, date: today } },
    })
    if (!record?.checkInAt) { res.status(400).json({ success: false, message: 'No check-in record for today' }); return }
    if (record.checkOutAt) { res.status(409).json({ success: false, message: 'Already checked out today' }); return }

    const updated = await prisma.staffAttendanceRecord.update({
      where: { id: record.id },
      data: { checkOutAt: new Date() },
    })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /today ───────────────────────────────────────────────────

router.get('/today', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const teacher = await prisma.teacher.findUnique({ where: { userId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

    const today = todayMidnightUTC()
    const record = await prisma.staffAttendanceRecord.findUnique({
      where: { teacherId_date: { teacherId: teacher.id, date: today } },
    })
    const cfg = await getConfig(teacher.schoolId)
    res.json({ success: true, data: { record, config: cfg } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /history?period=week|month|term ─────────────────────────

router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const teacher = await prisma.teacher.findUnique({ where: { userId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

    const period = (req.query.period as string) ?? 'week'
    const now = new Date()
    let from: Date
    if (period === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === 'term') {
      // Approximate: 3 months back
      from = new Date(now)
      from.setMonth(from.getMonth() - 3)
    } else {
      // week
      from = new Date(now)
      from.setDate(from.getDate() - 6)
    }
    from.setHours(0, 0, 0, 0)

    const records = await prisma.staffAttendanceRecord.findMany({
      where: { teacherId: teacher.id, date: { gte: from } },
      orderBy: { date: 'desc' },
    })

    const present = records.filter(r => r.status === 'PRESENT').length
    const late = records.filter(r => r.status === 'LATE').length
    const absent = records.filter(r => r.status === 'ABSENT').length
    const total = records.length
    const attendancePct = total > 0 ? Math.round(((present + late) / total) * 100) : 0

    res.json({ success: true, data: { records, stats: { present, late, absent, total, attendancePct } } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /school-summary?date=YYYY-MM-DD ─────────────────────────

router.get('/school-summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const dateStr = req.query.date as string | undefined
    const date = dateStr ? new Date(dateStr) : todayMidnightUTC()
    date.setHours(0, 0, 0, 0)

    const records = await prisma.staffAttendanceRecord.findMany({
      where: { date },
      include: { teacher: { select: { department: true, staffType: true } } },
    })

    const totalTeachers = await prisma.teacher.count({ where: { status: 'active' } })

    // On leave: approved leave applications covering this date
    const onLeaveCount = await prisma.leaveApplication.count({
      where: {
        status: 'PRINCIPAL_APPROVED',
        startDate: { lte: date },
        endDate: { gte: date },
      },
    })

    const present = records.filter(r => r.status === 'PRESENT').length
    const late = records.filter(r => r.status === 'LATE').length
    const absent = records.filter(r => r.status === 'ABSENT').length

    // Department breakdown
    const deptMap: Record<string, { present: number; late: number; absent: number }> = {}
    for (const r of records) {
      const dept = r.teacher.department ?? 'Unknown'
      if (!deptMap[dept]) deptMap[dept] = { present: 0, late: 0, absent: 0 }
      if (r.status === 'PRESENT') deptMap[dept].present++
      else if (r.status === 'LATE') deptMap[dept].late++
      else deptMap[dept].absent++
    }
    const byDepartment = Object.entries(deptMap).map(([dept, counts]) => ({ dept, ...counts }))

    res.json({
      success: true,
      data: { date, totalStaff: totalTeachers, present, late, absent, onLeave: onLeaveCount, byDepartment },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /department-summary?date=YYYY-MM-DD&dept=X ──────────────

router.get('/department-summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    let dept = req.query.dept as string | undefined

    if (role === 'hod') {
      const hodTeacher = await prisma.teacher.findUnique({ where: { userId }, select: { department: true } })
      dept = hodTeacher?.department ?? dept
    } else if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    if (!dept) { res.status(400).json({ success: false, message: 'dept param required' }); return }

    const dateStr = req.query.date as string | undefined
    const date = dateStr ? new Date(dateStr) : todayMidnightUTC()
    date.setHours(0, 0, 0, 0)

    const records = await prisma.staffAttendanceRecord.findMany({
      where: { date, teacher: { department: dept } },
      include: {
        teacher: {
          include: { user: { select: { displayName: true } } },
        },
      },
    })

    const formatted = records.map(r => ({
      id: r.id,
      teacherId: r.teacherId,
      teacherName: r.teacher.user?.displayName ?? 'Unknown',
      status: r.status,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      lateMinutes: r.lateMinutes,
    }))

    res.json({ success: true, data: { dept, date, records: formatted } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /anomalies ───────────────────────────────────────────────

router.get('/anomalies', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    let deptFilter: string | undefined

    if (role === 'hod') {
      const hodTeacher = await prisma.teacher.findUnique({ where: { userId }, select: { department: true } })
      deptFilter = hodTeacher?.department ?? undefined
    } else if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const now = new Date()
    const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const thirtyDaysAgo  = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sevenDaysAgo   = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const teacherWhere = deptFilter ? { department: deptFilter, status: 'active' } : { status: 'active' }
    const teachers = await prisma.teacher.findMany({
      where: teacherWhere,
      include: { user: { select: { displayName: true } } },
    })

    const anomalies: {
      teacherId: string; teacherName: string; ruleTriggered: string; count: number; threshold: number
    }[] = []

    for (const t of teachers) {
      const name = t.user?.displayName ?? 'Unknown'
      const cfg = await getConfig(t.schoolId)

      const absences14 = await prisma.staffAttendanceRecord.count({
        where: { teacherId: t.id, status: 'ABSENT', autoMarked: true, date: { gte: fourteenDaysAgo } },
      })
      if (absences14 >= cfg.frequentAbsenceDays) {
        anomalies.push({ teacherId: t.id, teacherName: name, ruleTriggered: 'FREQUENT_ABSENCE', count: absences14, threshold: cfg.frequentAbsenceDays })
      }

      const late30 = await prisma.staffAttendanceRecord.count({
        where: { teacherId: t.id, status: 'LATE', date: { gte: thirtyDaysAgo } },
      })
      if (late30 >= cfg.frequentLatenessCount) {
        anomalies.push({ teacherId: t.id, teacherName: name, ruleTriggered: 'FREQUENT_LATENESS', count: late30, threshold: cfg.frequentLatenessCount })
      }

      const consecutive = await prisma.staffAttendanceRecord.count({
        where: { teacherId: t.id, status: 'ABSENT', autoMarked: true, date: { gte: sevenDaysAgo } },
      })
      if (consecutive >= cfg.absenceAlertDays) {
        const hasLeave = await prisma.leaveApplication.findFirst({
          where: {
            teacherId: t.id,
            status: 'PRINCIPAL_APPROVED',
            startDate: { lte: now },
            endDate: { gte: sevenDaysAgo },
          },
        })
        if (!hasLeave) {
          anomalies.push({ teacherId: t.id, teacherName: name, ruleTriggered: 'CONSECUTIVE_ABSENCE', count: consecutive, threshold: cfg.absenceAlertDays })
        }
      }
    }

    res.json({ success: true, data: anomalies })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /daily-records?date=YYYY-MM-DD ──────────────────────────

router.get('/daily-records', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const dateStr = req.query.date as string | undefined
    const date = dateStr ? new Date(dateStr) : todayMidnightUTC()
    date.setHours(0, 0, 0, 0)

    const records = await prisma.staffAttendanceRecord.findMany({
      where: { date },
      include: {
        teacher: {
          include: { user: { select: { displayName: true } } },
        },
      },
      orderBy: { teacher: { user: { displayName: 'asc' } } },
    })

    const formatted = records.map(r => ({
      id: r.id,
      teacherId: r.teacherId,
      teacherName: r.teacher.user?.displayName ?? 'Unknown',
      department: r.teacher.department ?? 'Unknown',
      status: r.status,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      lateMinutes: r.lateMinutes,
    }))

    res.json({ success: true, data: { date, records: formatted } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /teacher-history/:teacherId?period=week|month|term ──────

router.get('/teacher-history/:teacherId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const { teacherId } = req.params
    const period = (req.query.period as string) ?? 'month'

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { displayName: true } } },
    })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return }

    const now = new Date()
    let from: Date
    if (period === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === 'term') {
      from = new Date(now)
      from.setMonth(from.getMonth() - 3)
    } else {
      from = new Date(now)
      from.setDate(from.getDate() - 6)
    }
    from.setHours(0, 0, 0, 0)

    const records = await prisma.staffAttendanceRecord.findMany({
      where: { teacherId, date: { gte: from } },
      orderBy: { date: 'desc' },
    })

    const present = records.filter(r => r.status === 'PRESENT').length
    const late = records.filter(r => r.status === 'LATE').length
    const absent = records.filter(r => r.status === 'ABSENT').length
    const total = records.length
    const attendancePct = total > 0 ? Math.round(((present + late) / total) * 100) : 0

    res.json({
      success: true,
      data: {
        teacher: { id: teacher.id, name: teacher.user?.displayName ?? 'Unknown', department: teacher.department },
        records,
        stats: { present, late, absent, total, attendancePct },
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /run-daily-close ────────────────────────────────────────

router.post('/run-daily-close', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    if (!['admin', 'manager'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const today = todayMidnightUTC()
    const globalHolidays = await getHolidaySet()
    if (!isWorkingDay(today, globalHolidays)) { res.status(400).json({ success: false, message: 'Today is not a working day' }); return }

    const teachers = await prisma.teacher.findMany({ where: { status: 'active' } })
    let marked = 0

    for (const t of teachers) {
      const existing = await prisma.staffAttendanceRecord.findUnique({
        where: { teacherId_date: { teacherId: t.id, date: today } },
      })
      if (existing) continue

      // Check approved leave
      const onLeave = await prisma.leaveApplication.findFirst({
        where: {
          teacherId: t.id,
          status: 'PRINCIPAL_APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      })
      if (onLeave) continue

      await prisma.staffAttendanceRecord.create({
        data: {
          teacherId: t.id,
          date: today,
          status: 'ABSENT',
          autoMarked: true,
        },
      })
      marked++
    }

    // Notify admin who triggered this
    if (marked > 0) {
      await send({ userId, title: 'Daily Close Complete', message: `${marked} staff marked absent.`, type: 'info' })
    }

    res.json({ success: true, data: { date: today, markedAbsent: marked } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /reports ─────────────────────────────────────────────────

router.get('/reports', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const { teacherId, dept, dateFrom, dateTo } = req.query as Record<string, string | undefined>

    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (dateFrom) { dateFilter.gte = new Date(dateFrom); dateFilter.gte.setHours(0, 0, 0, 0) }
    if (dateTo)   { dateFilter.lte = new Date(dateTo);   dateFilter.lte.setHours(23, 59, 59, 999) }

    const records = await prisma.staffAttendanceRecord.findMany({
      where: {
        ...(teacherId ? { teacherId } : {}),
        ...(dept ? { teacher: { department: dept } } : {}),
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
      include: {
        teacher: {
          include: { user: { select: { displayName: true } } },
        },
      },
      orderBy: [{ teacherId: 'asc' }, { date: 'desc' }],
    })

    // Group by teacher
    const grouped: Record<string, {
      teacherId: string; teacherName: string; department: string | null
      totalDays: number; present: number; late: number; absent: number; pct: number
    }> = {}

    for (const r of records) {
      const tid = r.teacherId
      if (!grouped[tid]) {
        grouped[tid] = {
          teacherId: tid,
          teacherName: r.teacher.user?.displayName ?? 'Unknown',
          department: r.teacher.department,
          totalDays: 0, present: 0, late: 0, absent: 0, pct: 0,
        }
      }
      grouped[tid].totalDays++
      if (r.status === 'PRESENT') grouped[tid].present++
      else if (r.status === 'LATE') grouped[tid].late++
      else grouped[tid].absent++
    }

    const rows = Object.values(grouped).map(g => ({
      ...g,
      pct: g.totalDays > 0 ? Math.round(((g.present + g.late) / g.totalDays) * 100) : 0,
    }))

    res.json({ success: true, data: rows })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
