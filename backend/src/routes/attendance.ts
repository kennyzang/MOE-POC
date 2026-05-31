import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'
import { sendPushToUser } from '../services/pushService'
import { broadcast } from './events'
import { recalcStudentRisk } from './ai'
import { getConfigInt } from '../lib/config'

const VALID_ABSENCE_REASONS = ['Sick', 'Personal', 'Unexplained', 'Other']

const router = Router()

// GET /sessions — list attendance sessions
router.get(
  '/sessions',
  authenticate,
  requireRole('admin', 'manager', 'teacher', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { courseId, date, status } = req.query as {
        courseId?: string
        date?: string
        status?: string
      }

      const where: any = {}
      if (courseId) where.courseId = courseId
      if (status) where.status = status
      if (date) {
        const d = new Date(date)
        const nextDay = new Date(d)
        nextDay.setDate(nextDay.getDate() + 1)
        where.date = { gte: d, lt: nextDay }
      }

      // Teacher: only sessions for their courses
      if (req.user!.role === 'teacher') {
        const teacher = await prisma.teacher.findUnique({
          where: { userId: req.user!.userId },
          include: { courseAssignments: true },
        })
        const courseIds = teacher ? teacher.courseAssignments.map((a) => a.courseId) : []
        where.courseId = courseId ? courseId : { in: courseIds }
      }

      const sessions = await prisma.attendanceSession.findMany({
        where,
        include: {
          course: { select: { id: true, code: true, name: true } },
          _count: { select: { records: true } },
        },
        orderBy: { date: 'desc' },
      })

      // Augment each session with present/late counts (one extra query, efficient groupBy)
      const sessionIds = sessions.map((s) => s.id)
      const presentGroups = sessionIds.length > 0
        ? await prisma.attendanceRecord.groupBy({
            by: ['sessionId', 'status'],
            where: { sessionId: { in: sessionIds }, status: { in: ['present', 'late'] } },
            _count: { id: true },
          })
        : []

      const presentMap: Record<string, number> = {}
      const lateMap: Record<string, number> = {}
      for (const g of presentGroups) {
        if (g.status === 'present') presentMap[g.sessionId] = g._count.id
        if (g.status === 'late') lateMap[g.sessionId] = g._count.id
      }

      const data = sessions.map((s) => ({
        ...s,
        presentCount: presentMap[s.id] ?? 0,
        lateCount: lateMap[s.id] ?? 0,
      }))

      res.json({ success: true, data })
    } catch (error) {
      console.error('GET /attendance/sessions error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /sessions/:id — full session detail with all attendance records
router.get(
  '/sessions/:id',
  authenticate,
  requireRole('admin', 'manager', 'teacher', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params
      const session = await prisma.attendanceSession.findUnique({
        where: { id },
        include: {
          course: { select: { id: true, code: true, name: true } },
          records: {
            include: {
              student: {
                include: {
                  user: { select: { id: true, displayName: true } },
                },
              },
            },
            orderBy: { student: { studentId: 'asc' } },
          },
        },
      })
      if (!session) {
        res.status(404).json({ success: false, message: 'Session not found' })
        return
      }
      res.json({ success: true, data: session })
    } catch (error) {
      console.error('GET /attendance/sessions/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// POST /sessions — create session
router.post(
  '/sessions',
  authenticate,
  requireRole('admin', 'manager', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { courseId, date, topic } = req.body
      if (!courseId || !date) {
        res.status(400).json({ success: false, message: 'courseId and date are required' })
        return
      }

      const session = await prisma.attendanceSession.create({
        data: { courseId, date: new Date(date), topic },
        include: { course: { select: { id: true, code: true, name: true } } },
      })

      res.json({ success: true, data: session })
    } catch (error) {
      console.error('POST /attendance/sessions error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /records — list attendance records
router.get('/records', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, studentId } = req.query as { sessionId?: string; studentId?: string }

    const where: any = {}
    if (sessionId) where.sessionId = sessionId
    if (studentId) where.studentId = studentId

    // Student: own records only
    if (req.user!.role === 'student') {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
      if (!student) {
        res.json({ success: true, data: [] })
        return
      }
      where.studentId = student.id
    }

    // Parent: children's records only
    if (req.user!.role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.user!.userId },
        include: { childLinks: true },
      })
      const childIds = parent ? parent.childLinks.map((l) => l.studentId) : []
      if (childIds.length === 0) {
        res.json({ success: true, data: [] })
        return
      }
      where.studentId = { in: childIds }
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        session: {
          include: { course: { select: { id: true, code: true, name: true } } },
        },
        student: {
          include: { user: { select: { id: true, displayName: true, username: true } } },
        },
      },
      orderBy: { session: { date: 'desc' } },
    })

    res.json({ success: true, data: records })
  } catch (error) {
    console.error('GET /attendance/records error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /records — create/update attendance records (batch)
router.post(
  '/records',
  authenticate,
  requireRole('admin', 'manager', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId, records } = req.body as {
        sessionId: string
        records: Array<{ studentId: string; status: string }>
      }

      if (!sessionId || !records || !Array.isArray(records)) {
        res
          .status(400)
          .json({ success: false, message: 'sessionId and records array are required' })
        return
      }

      const upserted = await Promise.all(
        records.map((r) =>
          prisma.attendanceRecord.upsert({
            where: { sessionId_studentId: { sessionId, studentId: r.studentId } },
            create: {
              sessionId,
              studentId: r.studentId,
              status: r.status,
              checkedInAt: r.status === 'present' ? new Date() : null,
            },
            update: {
              status: r.status,
              checkedInAt: r.status === 'present' ? new Date() : null,
            },
          }),
        ),
      )

      // Notify absent students and their parents; cascade absence thresholds
      const absentRecords = records.filter(r => r.status === 'absent')
      if (absentRecords.length > 0) {
        const absentStudentIds = absentRecords.map(r => r.studentId)
        const students = await prisma.student.findMany({
          where: { id: { in: absentStudentIds } },
          include: {
            user: { select: { id: true, displayName: true } },
            parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
            attendances: {
              include: { session: true },
              orderBy: { session: { date: 'desc' } },
            },
          },
        })

        const cutoff14 = new Date()
        cutoff14.setDate(cutoff14.getDate() - 14)
        const counselorThreshold = await getConfigInt('absence_counselor_threshold', 5)

        await Promise.all(
          students.flatMap(student => {
            const parentUserIds = student.parentLinks.map(l => l.parent.user.id)
            const notifyIds = [student.userId, ...parentUserIds]
            const inAppAlerts = notifyIds.map(uid =>
              send({
                userId: uid,
                title: 'Attendance Alert',
                message: `${student.user.displayName} was marked absent.`,
                type: 'warning',
              }),
            )
            // Web Push to parents (30s scheduled notification per spec — immediate for now)
            const pushAlerts = parentUserIds.map(uid =>
              sendPushToUser(uid, {
                title: 'Attendance Alert',
                body: `${student.user.displayName} was marked absent today. Please contact the school if needed.`,
                url: '/parent/attendance',
              }).catch(err => console.error('[Push] Failed to send to parent:', err)),
            )

            // Rolling 14-day absence count
            const recentAbsences = student.attendances.filter(
              a => a.status === 'absent' && new Date(a.session.date) >= cutoff14,
            ).length

            // Threshold cascade: configurable absence count → open CounselorCase
            const casePromise = recentAbsences >= counselorThreshold
              ? (async () => {
                  const existing = await prisma.counselorCase.findFirst({
                    where: { studentId: student.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
                  })
                  if (!existing) {
                    const counselorUser = await prisma.user.findFirst({ where: { role: 'counselor' } })
                    await prisma.counselorCase.create({
                      data: {
                        studentId: student.id,
                        counselorUserId: counselorUser?.id ?? null,
                        openedReason: 'AUTO_ABSENCE_THRESHOLD',
                        status: 'OPEN',
                      },
                    })
                    if (counselorUser) {
                      await send({
                        userId: counselorUser.id,
                        title: 'Absence Threshold Alert',
                        message: `${student.user.displayName} has ${recentAbsences} absences in the last 14 days. A counselor case has been opened.`,
                        type: 'warning',
                      })
                    }
                  }
                })()
              : Promise.resolve()

            // Risk recalc (fire-and-forget)
            recalcStudentRisk(student.id, 'ATTENDANCE_MARKED').catch(err =>
              console.error('[Risk] recalc failed after attendance:', err),
            )

            return [...inAppAlerts, ...pushAlerts, casePromise]
          }),
        )
      }

      // SSE: update attendance widget
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
      const todayRecords = await prisma.attendanceRecord.findMany({
        where: { session: { date: { gte: todayStart, lte: todayEnd } } },
        select: { status: true },
      })
      const presentToday = todayRecords.filter(r => r.status === 'present').length
      const attendanceRate = todayRecords.length > 0
        ? Math.round((presentToday / todayRecords.length) * 1000) / 10
        : 0
      broadcast('dashboard', 'dashboard.attendance.changed', { attendanceRate })

      res.json({ success: true, data: upserted })
    } catch (error) {
      console.error('POST /attendance/records error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// PATCH /records/:id/reason — parent submits absence reason
// Updates status display: "Absent" → "Absent – Sick (notified)"
router.patch(
  '/records/:id/reason',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { role, userId } = req.user!
      const recordId = req.params.id as string
      const { absenceReason, parentNote } = req.body as {
        absenceReason: string
        parentNote?: string
      }

      if (!absenceReason || !VALID_ABSENCE_REASONS.includes(absenceReason)) {
        res.status(400).json({
          success: false,
          message: `absenceReason must be one of: ${VALID_ABSENCE_REASONS.join(', ')}`,
        })
        return
      }

      // Fetch record with student + parent links
      const record = await prisma.attendanceRecord.findUnique({
        where: { id: recordId },
        include: {
          student: {
            include: {
              user: { select: { id: true, displayName: true } },
              parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
            },
          },
          session: {
            include: { course: { select: { id: true, name: true } } },
          },
        },
      })

      if (!record) {
        res.status(404).json({ success: false, message: 'Attendance record not found' })
        return
      }

      if (record.status !== 'absent') {
        res.status(400).json({ success: false, message: 'Can only submit reason for absent records' })
        return
      }

      // RBAC: only the parent of this student OR admin/manager/teacher may submit reason
      if (role === 'parent') {
        const parent = await prisma.parent.findUnique({
          where: { userId },
          include: { childLinks: true },
        })
        const isParentOfStudent = parent?.childLinks.some(l => l.studentId === record.studentId)
        if (!isParentOfStudent) {
          res.status(403).json({ success: false, message: 'Forbidden: not a parent of this student' })
          return
        }
      } else if (!['admin', 'manager', 'teacher'].includes(role)) {
        res.status(403).json({ success: false, message: 'Forbidden' })
        return
      }

      const updated = await prisma.attendanceRecord.update({
        where: { id: recordId },
        data: {
          absenceReason,
          parentNote: parentNote ?? null,
          reasonSubmittedAt: new Date(),
        },
      })

      // Notify the teacher(s) of this session's course
      const courseAssignments = await prisma.courseAssignment.findMany({
        where: { courseId: record.session.courseId },
        include: { teacher: { include: { user: { select: { id: true } } } } },
      })
      const teacherUserIds = courseAssignments.map(a => a.teacher.user.id)
      const studentName = record.student.user.displayName
      const courseName = record.session.course.name

      await Promise.all(
        teacherUserIds.map(uid =>
          send({
            userId: uid,
            title: 'Absence Reason Submitted',
            message: `${studentName}'s absence from ${courseName} has been updated: ${absenceReason}${parentNote ? ` — "${parentNote}"` : ''}.`,
            type: 'info',
          }),
        ),
      )

      // SSE: notify teacher dashboard that reason was submitted
      broadcast('attendance', 'attendance.reason.submitted', {
        recordId,
        studentId: record.studentId,
        absenceReason,
        studentName,
      })

      res.json({ success: true, data: updated })
    } catch (error) {
      console.error('PATCH /attendance/records/:id/reason error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /records/:id — fetch single attendance record (for parent reason-submit UI)
router.get('/records/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: req.params.id as string },
      include: {
        session: { include: { course: { select: { id: true, code: true, name: true } } } },
        student: { include: { user: { select: { id: true, displayName: true } } } },
      },
    })
    if (!record) {
      res.status(404).json({ success: false, message: 'Record not found' })
      return
    }
    res.json({ success: true, data: record })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
