import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, schoolFilter, type AuthRequest } from '../middleware/auth'
import { USER_SELECT_FULL, USER_SELECT_NAME } from '../lib/querySelects'

const router = Router()

// GET /students — list all students with user info
router.get(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'teacher', 'principal', 'counselor', 'hod', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { search, gradeLevel, className, status } = req.query

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { ...schoolFilter(req) }

      if (gradeLevel) where.gradeLevel = gradeLevel as string
      if (className) where.className = className as string
      if (status) where.enrollmentStatus = status as string

      if (search) {
        where.OR = [
          { studentId: { contains: search as string } },
          { user: { displayName: { contains: search as string } } },
          { user: { username: { contains: search as string } } },
        ]
      }

      const students = await prisma.student.findMany({
        where,
        include: {
          user: { select: USER_SELECT_FULL },
        },
        orderBy: { createdAt: 'desc' },
      })

      res.json({ success: true, data: students })
    } catch (error) {
      console.error('Error listing students:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// GET /students/me — return the current student's own record
router.get('/me', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId },
      include: {
        user: {
          select: USER_SELECT_FULL,
        },
        enrollments: { include: { course: true } },
        grades: { include: { gradeItem: true } },
      },
    })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found' })
      return
    }
    res.json({ success: true, data: student })
  } catch (error) {
    console.error('GET /students/me error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id — get single student with details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { role, userId } = req.user!

    // Role check
    if (!['admin', 'manager', 'teacher', 'student', 'parent', 'counselor', 'hod', 'admissions', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            avatar: true,
            status: true,
          },
        },
        enrollments: {
          include: {
            course: {
              include: {
                assignments: {
                  include: {
                    teacher: {
                      include: { user: { select: USER_SELECT_NAME } },
                    },
                  },
                  take: 1,
                },
              },
            },
          },
        },
        grades: {
          include: {
            gradeItem: {
              include: { course: { select: { id: true, code: true, name: true } } },
            },
          },
        },
        riskScores: {
          orderBy: { computedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { counselorCases: true },
        },
      },
    })

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }

    // Student can only view own record
    if (role === 'student' && student.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    // Parent can only view own children
    if (role === 'parent') {
      const parent = await prisma.parent.findUnique({ where: { userId } })
      if (!parent) {
        res.status(403).json({ success: false, message: 'Forbidden' })
        return
      }
      const link = await prisma.parentStudent.findFirst({
        where: { parentId: parent.id, studentId: student.id },
      })
      if (!link) {
        res.status(403).json({ success: false, message: 'Forbidden' })
        return
      }
    }

    res.json({ success: true, data: student })
  } catch (error) {
    console.error('Error getting student:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id/attendance-history — all attendance records for a student
router.get('/:id/attendance-history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const studentId = req.params.id as string

    if (!['admin', 'manager', 'teacher', 'counselor', 'principal', 'student', 'parent'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }
    if (role === 'student' && student.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const records = await prisma.attendanceRecord.findMany({
      where: { studentId },
      include: {
        session: {
          include: { course: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: { session: { date: 'desc' } },
    })

    res.json({ success: true, data: records })
  } catch (error) {
    console.error('GET /students/:id/attendance-history error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id/standing-history — academic standing history
router.get('/:id/standing-history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const studentId = req.params.id as string

    if (!['admin', 'manager', 'teacher', 'counselor', 'principal', 'student', 'parent'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }
    if (role === 'student' && student.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const history = await prisma.academicStandingHistory.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: history })
  } catch (error) {
    console.error('GET /students/:id/standing-history error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id/invoices — fee invoices for a student
router.get('/:id/invoices', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const studentId = req.params.id as string

    if (!['admin', 'manager', 'finance', 'principal', 'student', 'parent'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }
    if (role === 'student' && student.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const invoices = await prisma.feeInvoice.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: invoices })
  } catch (error) {
    console.error('GET /students/:id/invoices error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id/counselor-cases — counselor cases for a student
router.get('/:id/counselor-cases', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    const studentId = req.params.id as string

    if (!['admin', 'manager', 'counselor', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }

    const cases = await prisma.counselorCase.findMany({
      where: { studentId },
      orderBy: { openedAt: 'desc' },
    })

    res.json({ success: true, data: cases })
  } catch (error) {
    console.error('GET /students/:id/counselor-cases error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /students/:id — update student fields
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { gradeLevel, className, enrollmentStatus, gender, nationality, dateOfBirth } = req.body

      const existing = await prisma.student.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, message: 'Student not found' })
        return
      }

      const data: any = {}
      if (gradeLevel !== undefined) data.gradeLevel = gradeLevel
      if (className !== undefined) data.className = className
      if (enrollmentStatus !== undefined) data.enrollmentStatus = enrollmentStatus
      if (gender !== undefined) data.gender = gender
      if (nationality !== undefined) data.nationality = nationality
      if (dateOfBirth !== undefined) data.dateOfBirth = new Date(dateOfBirth)

      const student = await prisma.student.update({
        where: { id },
        data,
        include: {
          user: { select: USER_SELECT_FULL },
        },
      })

      res.json({ success: true, data: student })
    } catch (error) {
      console.error('Error updating student:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// GET /students/me/assignments — published assignments for enrolled courses
router.get('/me/assignments', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
    if (!student) { res.json({ success: true, data: [] }); return }

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'enrolled' },
      select: { courseId: true },
    })
    const courseIds = enrollments.map((e) => e.courseId)

    const assignments = await prisma.assignment.findMany({
      where: { courseId: { in: courseIds }, status: 'published' },
      include: {
        course: { select: { name: true, code: true } },
        submissions: { where: { studentId: student.id } },
      },
      orderBy: { dueDate: 'asc' },
    })

    const data = assignments.map((a) => {
      const submission = a.submissions[0] ?? null
      return {
        ...a,
        submission,
        submissionStatus: submission
          ? submission.status
          : a.dueDate && new Date() > a.dueDate
            ? 'overdue'
            : 'pending',
      }
    })

    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/me/behavior — own behavior records
router.get('/me/behavior', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
    if (!student) { res.json({ success: true, data: { records: [], netPoints: 0, merits: 0, demerits: 0 } }); return }

    const records = await prisma.behaviorRecord.findMany({
      where: { studentId: student.id },
      include: { recordedBy: { select: { displayName: true, role: true } } },
      orderBy: { date: 'desc' },
    })
    const merits = records.filter((r) => r.type === 'merit').reduce((s, r) => s + r.points, 0)
    const demerits = records.filter((r) => r.type === 'demerit').reduce((s, r) => s + Math.abs(r.points), 0)
    res.json({ success: true, data: { records, netPoints: merits - demerits, merits, demerits } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
