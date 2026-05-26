import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'

const router = Router()

// GET /sessions — list attendance sessions
router.get(
  '/sessions',
  authenticate,
  requireRole('admin', 'manager', 'teacher'),
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

      res.json({ success: true, data: sessions })
    } catch (error) {
      console.error('GET /attendance/sessions error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
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

      // Notify absent students and their parents
      const absentRecords = records.filter(r => r.status === 'absent')
      if (absentRecords.length > 0) {
        const absentStudentIds = absentRecords.map(r => r.studentId)
        const students = await prisma.student.findMany({
          where: { id: { in: absentStudentIds } },
          include: {
            user: { select: { id: true, displayName: true } },
            parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
          },
        })
        await Promise.all(
          students.flatMap(student => {
            const notifyIds = [student.userId, ...student.parentLinks.map(l => l.parent.user.id)]
            return notifyIds.map(uid =>
              send({
                userId: uid,
                title: 'Attendance Alert',
                message: `${student.user.displayName} was marked absent.`,
                type: 'warning',
              }),
            )
          }),
        )
      }

      res.json({ success: true, data: upserted })
    } catch (error) {
      console.error('POST /attendance/records error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
