import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { sendMany } from '../services/notificationService'

const router = Router()

// ─── Helpers ─────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// ─── NF-01: Student Consecutive Absence Alert ─────────────────────
async function runStudentAbsences(): Promise<{ notificationsSent: number; affectedCount: number; summary: string }> {
  const THRESHOLD = 3 // consecutive absent days
  const since = addDays(new Date(), -14) // look back 14 days

  // Get all students with recent attendance records
  const records = await prisma.attendanceRecord.findMany({
    where: {
      status: { in: ['absent'] },
      session: { date: { gte: since } },
    },
    include: {
      session: { select: { date: true, courseId: true } },
      student: {
        include: {
          user: { select: { id: true, displayName: true } },
          parentLinks: {
            include: { parent: { select: { userId: true } } },
          },
        },
      },
    },
    orderBy: { session: { date: 'asc' } },
  })

  // Group by student
  const byStudent = new Map<string, { dates: Date[]; student: typeof records[0]['student'] }>()
  for (const r of records) {
    if (!byStudent.has(r.studentId)) {
      byStudent.set(r.studentId, { dates: [], student: r.student })
    }
    byStudent.get(r.studentId)!.dates.push(r.session.date)
  }

  const flagged: Array<{ studentId: string; name: string; consecutiveDays: number; parentUserIds: string[] }> = []
  for (const [studentId, info] of byStudent.entries()) {
    const sorted = info.dates.sort((a, b) => a.getTime() - b.getTime())
    // Find max consecutive run
    let maxConsecutive = 1
    let current = 1
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000)
      if (diff <= 3) { // within 3 calendar days (skip weekends)
        current++
        maxConsecutive = Math.max(maxConsecutive, current)
      } else {
        current = 1
      }
    }
    if (maxConsecutive >= THRESHOLD) {
      const parentUserIds = info.student.parentLinks.map((l) => l.parent.userId)
      flagged.push({
        studentId,
        name: info.student.user.displayName,
        consecutiveDays: maxConsecutive,
        parentUserIds,
      })
    }
  }

  if (flagged.length === 0) return { notificationsSent: 0, affectedCount: 0, summary: 'No consecutive absence alerts needed' }

  // Get class teachers from ClassRoster for each student
  const students = await prisma.student.findMany({
    where: { id: { in: flagged.map((f) => f.studentId) } },
    select: { id: true, gradeLevel: true, className: true, schoolId: true },
  })

  let notificationsSent = 0
  for (const f of flagged) {
    const student = students.find((s) => s.id === f.studentId)
    const notifyUserIds = new Set<string>()

    // Notify parents
    f.parentUserIds.forEach((id) => notifyUserIds.add(id))

    // Notify class teacher if found
    if (student?.gradeLevel && student?.className) {
      const roster = await prisma.classRoster.findFirst({
        where: { gradeLevel: student.gradeLevel, className: student.className, schoolId: student.schoolId ?? undefined },
      })
      if (roster?.formTeacherId) {
        const teacher = await prisma.teacher.findUnique({ where: { id: roster.formTeacherId }, select: { userId: true } })
        if (teacher) notifyUserIds.add(teacher.userId)
      }
    }

    const ids = Array.from(notifyUserIds)
    if (ids.length > 0) {
      await sendMany(ids, {
        title: 'Student Absence Alert',
        message: `${f.name} has been absent for ${f.consecutiveDays} consecutive school days without an excuse.`,
        type: 'warning',
        link: '/sis/attendance',
      })
      notificationsSent += ids.length
    }
  }

  return {
    notificationsSent,
    affectedCount: flagged.length,
    summary: `${flagged.length} student(s) flagged for consecutive absences (≥${THRESHOLD} days). ${notificationsSent} notifications sent.`,
  }
}

// ─── NF-02: Grade Drop Alert ──────────────────────────────────────
async function runGradeDrops(): Promise<{ notificationsSent: number; affectedCount: number; summary: string }> {
  const DROP_THRESHOLD = 20 // percent drop triggers alert

  // Get all graded items from the last 60 days vs previous 60 days
  const now = new Date()
  const cutoff = addDays(now, -60)
  const prevCutoff = addDays(now, -120)

  const recentGrades = await prisma.grade.findMany({
    where: { gradedAt: { gte: cutoff }, score: { not: null } },
    include: {
      student: {
        include: {
          user: { select: { id: true, displayName: true } },
          parentLinks: { include: { parent: { select: { userId: true } } } },
        },
      },
      gradeItem: { select: { courseId: true, maxScore: true } },
    },
  })

  const prevGrades = await prisma.grade.findMany({
    where: { gradedAt: { gte: prevCutoff, lt: cutoff }, score: { not: null } },
    include: { gradeItem: { select: { courseId: true, maxScore: true } } },
  })

  // Compute averages per student per course (recent vs prev)
  const recentAvg = new Map<string, { total: number; count: number; student: typeof recentGrades[0]['student'] }>()
  for (const g of recentGrades) {
    const key = `${g.studentId}-${g.gradeItem.courseId}`
    const pct = (g.score! / g.gradeItem.maxScore) * 100
    if (!recentAvg.has(key)) {
      recentAvg.set(key, { total: 0, count: 0, student: g.student })
    }
    const e = recentAvg.get(key)!
    e.total += pct; e.count++
  }

  const prevAvgMap = new Map<string, number>()
  for (const g of prevGrades) {
    const key = `${g.studentId}-${g.gradeItem.courseId}`
    const pct = (g.score! / g.gradeItem.maxScore) * 100
    if (!prevAvgMap.has(key)) prevAvgMap.set(key, 0)
    prevAvgMap.set(key, (prevAvgMap.get(key)! + pct))
  }

  const flagged: Array<{ studentId: string; name: string; drop: number; parentUserIds: string[] }> = []
  const seen = new Set<string>()

  for (const [key, recent] of recentAvg.entries()) {
    const studentId = key.split('-')[0]
    if (seen.has(studentId)) continue
    const prevTotal = prevAvgMap.get(key) ?? null
    if (prevTotal === null) continue
    const prevCount = prevGrades.filter((g) => `${g.studentId}-${g.gradeItem.courseId}` === key).length
    if (prevCount === 0) continue
    const prevPct = prevTotal / prevCount
    const recentPct = recent.total / recent.count
    const drop = prevPct - recentPct
    if (drop >= DROP_THRESHOLD) {
      seen.add(studentId)
      const parentUserIds = recent.student.parentLinks.map((l) => l.parent.userId)
      flagged.push({ studentId, name: recent.student.user.displayName, drop: Math.round(drop), parentUserIds })
    }
  }

  if (flagged.length === 0) return { notificationsSent: 0, affectedCount: 0, summary: 'No grade drop alerts needed' }

  let notificationsSent = 0
  for (const f of flagged) {
    const student = await prisma.student.findUnique({
      where: { id: f.studentId },
      select: { gradeLevel: true, className: true, schoolId: true },
    })
    const notifyIds = new Set<string>(f.parentUserIds)

    if (student?.gradeLevel && student?.className) {
      const roster = await prisma.classRoster.findFirst({
        where: { gradeLevel: student.gradeLevel, className: student.className, schoolId: student.schoolId ?? undefined },
      })
      if (roster?.formTeacherId) {
        const teacher = await prisma.teacher.findUnique({ where: { id: roster.formTeacherId }, select: { userId: true } })
        if (teacher) notifyIds.add(teacher.userId)
      }
    }

    const ids = Array.from(notifyIds)
    if (ids.length > 0) {
      await sendMany(ids, {
        title: 'Grade Drop Alert',
        message: `${f.name}'s overall grade has dropped by approximately ${f.drop}% compared to the previous period.`,
        type: 'warning',
        link: '/sis/grades',
      })
      notificationsSent += ids.length
    }
  }

  return {
    notificationsSent,
    affectedCount: flagged.length,
    summary: `${flagged.length} student(s) flagged for grade drops ≥${DROP_THRESHOLD}%. ${notificationsSent} notifications sent.`,
  }
}

// ─── NF-03: Fee Overdue Alert ─────────────────────────────────────
async function runFeeOverdue(): Promise<{ notificationsSent: number; affectedCount: number; summary: string }> {
  const now = new Date()
  const overdueInvoices = await prisma.feeInvoice.findMany({
    where: { status: { in: ['unpaid', 'overdue'] }, dueDate: { lt: now } },
    include: {
      student: {
        include: {
          user: { select: { displayName: true } },
          parentLinks: { include: { parent: { select: { userId: true } } } },
        },
      },
    },
  })

  if (overdueInvoices.length === 0) return { notificationsSent: 0, affectedCount: 0, summary: 'No overdue fee alerts needed' }

  let notificationsSent = 0
  let affectedCount = 0

  // Get admin userIds for 90-day escalation
  const admins = await prisma.user.findMany({
    where: { role: { in: ['admin', 'manager', 'finance'] }, status: 'active' },
    select: { id: true },
  })
  const adminIds = admins.map((a) => a.id)

  for (const inv of overdueInvoices) {
    const daysOverdue = Math.floor((now.getTime() - inv.dueDate!.getTime()) / 86400000)
    if (daysOverdue < 30) continue // not yet triggering

    const parentUserIds = inv.student.parentLinks.map((l) => l.parent.userId)
    let type: 'info' | 'warning' | 'error' = 'info'
    let title = ''
    let message = ''

    if (daysOverdue >= 90) {
      type = 'error'
      title = 'Fee Overdue — Admin Review Required'
      message = `${inv.student.user.displayName}'s fee invoice (${inv.invoiceNumber ?? inv.id.slice(0, 8)}) is ${daysOverdue} days overdue (BND ${inv.amount.toFixed(2)}). Flagged for admin review.`
      if (adminIds.length > 0) {
        await sendMany(adminIds, { title, message, type, link: '/sis/fees' })
        notificationsSent += adminIds.length
      }
    } else if (daysOverdue >= 60) {
      type = 'warning'
      title = 'Fee Payment Warning'
      message = `Your child's (${inv.student.user.displayName}) fee invoice is ${daysOverdue} days overdue. Amount due: BND ${inv.amount.toFixed(2)}. Please settle immediately to avoid further action.`
    } else {
      type = 'info'
      title = 'Fee Payment Reminder'
      message = `Your child's (${inv.student.user.displayName}) fee invoice is ${daysOverdue} days overdue. Amount due: BND ${inv.amount.toFixed(2)}.`
    }

    if (parentUserIds.length > 0) {
      await sendMany(parentUserIds, { title, message, type, link: '/parent/fees' })
      notificationsSent += parentUserIds.length
    }
    affectedCount++

    // Mark notified
    await prisma.feeInvoice.update({ where: { id: inv.id }, data: { status: 'overdue', overdueNotifiedAt: now } })
  }

  return {
    notificationsSent,
    affectedCount,
    summary: `${affectedCount} overdue invoice(s) processed. ${notificationsSent} notifications sent.`,
  }
}

// ─── NF-04: CPD Deadline Reminder ────────────────────────────────
async function runCpdDeadlines(): Promise<{ notificationsSent: number; affectedCount: number; summary: string }> {
  const DAYS_BEFORE = 3
  const from = new Date()
  const to = addDays(new Date(), DAYS_BEFORE)

  const workshops = await prisma.cpdWorkshop.findMany({
    where: { status: 'open', startDate: { gte: from, lte: to } },
    include: {
      enrollments: {
        where: { status: 'ENROLLED' },
        include: { teacher: { select: { userId: true } } },
      },
    },
  })

  if (workshops.length === 0) return { notificationsSent: 0, affectedCount: 0, summary: 'No CPD deadline reminders needed' }

  let notificationsSent = 0
  for (const w of workshops) {
    const userIds = w.enrollments.map((e) => e.teacher.userId)
    if (userIds.length === 0) continue
    const daysLeft = Math.ceil((w.startDate.getTime() - from.getTime()) / 86400000)
    await sendMany(userIds, {
      title: 'CPD Workshop Starting Soon',
      message: `Reminder: "${w.title}" starts in ${daysLeft} day(s) on ${w.startDate.toLocaleDateString('en-GB')}${w.location ? ` at ${w.location}` : ''}.`,
      type: 'info',
      link: '/ems/cpd-workshops',
    })
    notificationsSent += userIds.length
  }

  return {
    notificationsSent,
    affectedCount: workshops.length,
    summary: `${workshops.length} upcoming CPD workshop(s) reminder sent. ${notificationsSent} notifications.`,
  }
}

// ─── NF-05: Exam Registration Reminder ───────────────────────────
async function runExamRegistration(): Promise<{ notificationsSent: number; affectedCount: number; summary: string }> {
  const DAYS_BEFORE = 7
  const from = new Date()
  const to = addDays(new Date(), DAYS_BEFORE)

  const upcomingExams = await prisma.exam.findMany({
    where: { status: 'upcoming', examDate: { gte: from, lte: to } },
    include: { candidates: { select: { studentId: true, subjectCode: true } } },
  })

  if (upcomingExams.length === 0) return { notificationsSent: 0, affectedCount: 0, summary: 'No exam registration reminders needed' }

  // Get admins and subject teachers
  const admins = await prisma.user.findMany({
    where: { role: { in: ['admin', 'manager', 'principal', 'admissions'] }, status: 'active' },
    select: { id: true },
  })
  const adminIds = admins.map((a) => a.id)

  let notificationsSent = 0
  let affectedCount = 0

  for (const exam of upcomingExams) {
    // Count enrolled students vs registered candidates
    const enrolledStudents = await prisma.student.findMany({
      where: { schoolId: exam.schoolId, enrollmentStatus: 'enrolled' },
      select: { id: true },
    })
    const registeredIds = new Set(exam.candidates.map((c) => c.studentId))
    const unregisteredCount = enrolledStudents.filter((s) => !registeredIds.has(s.id)).length
    if (unregisteredCount === 0) continue

    const daysLeft = Math.ceil((exam.examDate.getTime() - from.getTime()) / 86400000)
    const message = `${exam.examType} ${exam.year}: ${unregisteredCount} eligible student(s) are not yet registered. Exam date: ${exam.examDate.toLocaleDateString('en-GB')} (${daysLeft} days away).`

    if (adminIds.length > 0) {
      await sendMany(adminIds, {
        title: 'Exam Registration Reminder',
        message,
        type: 'warning',
        link: '/sms/exams',
      })
      notificationsSent += adminIds.length
    }
    affectedCount++
  }

  return {
    notificationsSent,
    affectedCount,
    summary: `${affectedCount} upcoming exam(s) with unregistered students. ${notificationsSent} notifications sent.`,
  }
}

// ─── NF-06: Low Stock Alert ───────────────────────────────────────
async function runLowStock(): Promise<{ notificationsSent: number; affectedCount: number; summary: string }> {
  // Prisma can't compare two fields in where-clause; fetch all and filter in JS
  const allItems = await prisma.stockItem.findMany()
  const belowMin = allItems.filter((i) => i.quantity <= i.minQuantity)

  if (belowMin.length === 0) return { notificationsSent: 0, affectedCount: 0, summary: 'All stock items are above minimum threshold' }

  const admins = await prisma.user.findMany({
    where: { role: { in: ['admin', 'manager'] }, status: 'active' },
    select: { id: true },
  })
  const adminIds = admins.map((a) => a.id)
  if (adminIds.length === 0) return { notificationsSent: 0, affectedCount: belowMin.length, summary: `${belowMin.length} low-stock item(s) — no admins to notify` }

  const itemSummary = belowMin.slice(0, 5).map((i) => `${i.name} (${i.quantity}/${i.minQuantity} ${i.unit})`).join(', ')
  const extra = belowMin.length > 5 ? ` and ${belowMin.length - 5} more` : ''

  await sendMany(adminIds, {
    title: 'Low Stock Alert',
    message: `${belowMin.length} item(s) are below minimum stock threshold: ${itemSummary}${extra}. Please reorder.`,
    type: 'warning',
    link: '/sms/inventory',
  })

  return {
    notificationsSent: adminIds.length,
    affectedCount: belowMin.length,
    summary: `${belowMin.length} low-stock item(s) flagged. ${adminIds.length} admin(s) notified.`,
  }
}

// ─── NF-07: Asset Maintenance Due Alert ──────────────────────────
async function runMaintenanceDue(): Promise<{ notificationsSent: number; affectedCount: number; summary: string }> {
  const DAYS_THRESHOLD = 180 // 6 months

  const assets = await prisma.asset.findMany({
    where: { condition: { not: 'Condemned' } },
    include: {
      maintenanceLogs: { orderBy: { date: 'desc' }, take: 1 },
    },
  })

  const now = new Date()
  const due: typeof assets = []
  for (const asset of assets) {
    const lastLog = asset.maintenanceLogs[0]
    if (!lastLog) {
      // Never had maintenance — flag it
      due.push(asset)
    } else {
      const daysSince = Math.floor((now.getTime() - lastLog.date.getTime()) / 86400000)
      if (daysSince >= DAYS_THRESHOLD) due.push(asset)
    }
  }

  if (due.length === 0) return { notificationsSent: 0, affectedCount: 0, summary: 'No assets due for maintenance' }

  const admins = await prisma.user.findMany({
    where: { role: { in: ['admin', 'manager'] }, status: 'active' },
    select: { id: true },
  })
  const adminIds = admins.map((a) => a.id)
  if (adminIds.length === 0) return { notificationsSent: 0, affectedCount: due.length, summary: `${due.length} asset(s) due — no admins to notify` }

  const itemSummary = due.slice(0, 4).map((a) => `${a.name} [${a.assetTag}]`).join(', ')
  const extra = due.length > 4 ? ` and ${due.length - 4} more` : ''

  await sendMany(adminIds, {
    title: 'Asset Maintenance Due',
    message: `${due.length} asset(s) are due for maintenance: ${itemSummary}${extra}.`,
    type: 'warning',
    link: '/sms/inventory',
  })

  return {
    notificationsSent: adminIds.length,
    affectedCount: due.length,
    summary: `${due.length} asset(s) flagged for maintenance. ${adminIds.length} admin(s) notified.`,
  }
}

// ─── Route Handlers ──────────────────────────────────────────────

const TRIGGER_MAP: Record<string, () => Promise<{ notificationsSent: number; affectedCount: number; summary: string }>> = {
  STUDENT_ABSENCE: runStudentAbsences,
  GRADE_DROP: runGradeDrops,
  FEE_OVERDUE: runFeeOverdue,
  CPD_DEADLINE: runCpdDeadlines,
  EXAM_REGISTRATION: runExamRegistration,
  LOW_STOCK: runLowStock,
  MAINTENANCE_DUE: runMaintenanceDue,
}

// POST /triggers/run/:type — run a specific trigger
router.post('/run/:type', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  const type = (req.params['type'] as string).toUpperCase()
  const fn = TRIGGER_MAP[type]
  if (!fn) { res.status(400).json({ success: false, message: `Unknown trigger type: ${type}` }); return }

  try {
    const result = await fn()
    const log = await prisma.notificationTriggerLog.create({
      data: {
        triggerType: type,
        notificationsSent: result.notificationsSent,
        affectedCount: result.affectedCount,
        summary: result.summary,
        status: 'success',
      },
    })
    res.json({ success: true, data: { ...result, log } })
  } catch (error) {
    console.error(`Trigger ${type} error:`, error)
    await prisma.notificationTriggerLog.create({
      data: { triggerType: type, status: 'error', summary: String(error) },
    })
    res.status(500).json({ success: false, message: 'Trigger failed', error: String(error) })
  }
})

// POST /triggers/run-all — run all triggers
router.post('/run-all', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const results: Record<string, { notificationsSent: number; affectedCount: number; summary: string; error?: string }> = {}
    for (const [type, fn] of Object.entries(TRIGGER_MAP)) {
      try {
        const r = await fn()
        results[type] = r
        await prisma.notificationTriggerLog.create({
          data: { triggerType: type, ...r, status: 'success' },
        })
      } catch (err) {
        results[type] = { notificationsSent: 0, affectedCount: 0, summary: '', error: String(err) }
        await prisma.notificationTriggerLog.create({
          data: { triggerType: type, status: 'error', summary: String(err) },
        })
      }
    }
    const totalSent = Object.values(results).reduce((s, r) => s + r.notificationsSent, 0)
    res.json({ success: true, data: { results, totalNotificationsSent: totalSent } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Run-all failed' })
  }
})

// GET /triggers/status — last run log per trigger type
router.get('/status', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const allTypes = Object.keys(TRIGGER_MAP)
    const statusMap: Record<string, {
      lastRun: Date | null
      lastSent: number
      lastAffected: number
      lastStatus: string
      lastSummary: string
    }> = {}

    for (const type of allTypes) {
      const last = await prisma.notificationTriggerLog.findFirst({
        where: { triggerType: type },
        orderBy: { ranAt: 'desc' },
      })
      statusMap[type] = {
        lastRun: last?.ranAt ?? null,
        lastSent: last?.notificationsSent ?? 0,
        lastAffected: last?.affectedCount ?? 0,
        lastStatus: last?.status ?? 'never',
        lastSummary: last?.summary ?? 'Never run',
      }
    }

    res.json({ success: true, data: statusMap })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /triggers/logs — recent trigger run history
router.get('/logs', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.notificationTriggerLog.findMany({
      orderBy: { ranAt: 'desc' },
      take: 50,
    })
    res.json({ success: true, data: logs })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Stock Item CRUD (for NF-06) ──────────────────────────────────

router.get('/stock', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user!.schoolId
    const items = await prisma.stockItem.findMany({
      where: schoolId ? { schoolId } : {},
      orderBy: { name: 'asc' },
    })
    res.json({ success: true, data: items })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.post('/stock', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, category, unit, quantity, minQuantity } = req.body
    const item = await prisma.stockItem.create({
      data: {
        name, description, category, unit,
        quantity: Number(quantity ?? 0),
        minQuantity: Number(minQuantity ?? 5),
        schoolId: req.user!.schoolId ?? null,
      },
    })
    res.status(201).json({ success: true, data: item })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.patch('/stock/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { quantity, minQuantity, name, description, category, unit } = req.body
    const data: Record<string, unknown> = {}
    if (quantity !== undefined) data.quantity = Number(quantity)
    if (minQuantity !== undefined) data.minQuantity = Number(minQuantity)
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (category !== undefined) data.category = category
    if (unit !== undefined) data.unit = unit
    const updated = await prisma.stockItem.update({ where: { id }, data })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.delete('/stock/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    await prisma.stockItem.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
