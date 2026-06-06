import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, schoolFilter, type AuthRequest } from '../middleware/auth'
import { USER_SELECT_FULL, USER_SELECT_NAME } from '../lib/querySelects'

const router = Router()

// GET /teachers — list all teachers with user info
router.get(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'hod', 'principal', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { search, department, staffType } = req.query as { search?: string; department?: string; staffType?: string }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { ...schoolFilter(req) }

      if (department) where.department = department
      // staffType filter: pass comma-separated values like "ADMINISTRATIVE,SUPPORT,SECURITY"
      if (staffType) {
        const types = staffType.split(',').map(s => s.trim()).filter(Boolean)
        where.staffType = types.length === 1 ? types[0] : { in: types }
      }

      if (search) {
        where.OR = [
          { staffId: { contains: search as string } },
          { user: { displayName: { contains: search as string } } },
          { user: { username: { contains: search as string } } },
        ]
      }

      const teachers = await prisma.teacher.findMany({
        where,
        include: {
          user: { select: USER_SELECT_FULL },
        },
        orderBy: { createdAt: 'desc' },
      })

      res.json({ success: true, data: teachers })
    } catch (error) {
      console.error('Error listing teachers:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// GET /teachers/me — return the current teacher's own record
router.get('/me', authenticate, requireRole('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user!.userId },
      include: {
        user: {
          select: USER_SELECT_FULL,
        },
        courseAssignments: {
          include: {
            course: { select: { id: true, code: true, name: true, gradeLevel: true, creditHours: true, status: true } },
          },
        },
      },
    })
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher record not found' })
      return
    }
    res.json({ success: true, data: teacher })
  } catch (error) {
    console.error('GET /teachers/me error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /teachers/:id/performance-evaluations
router.get('/:id/performance-evaluations', authenticate, requireRole('admin', 'manager', 'hod', 'principal', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const teacherId = req.params.id as string
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return }
    if (role === 'teacher' && teacher.userId !== userId) { res.status(403).json({ success: false, message: 'Forbidden' }); return }
    const evals = await prisma.performanceEvaluation.findMany({
      where: { teacherId },
      orderBy: { academicYear: 'desc' },
    })
    res.json({ success: true, data: evals })
  } catch (error) {
    console.error('GET /teachers/:id/performance-evaluations error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /teachers/:id/leave-history
router.get('/:id/leave-history', authenticate, requireRole('admin', 'manager', 'hod', 'principal', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const teacherId = req.params.id as string
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return }
    if (role === 'teacher' && teacher.userId !== userId) { res.status(403).json({ success: false, message: 'Forbidden' }); return }
    const leaves = await prisma.leaveApplication.findMany({
      where: { teacherId },
      orderBy: { startDate: 'desc' },
    })
    res.json({ success: true, data: leaves })
  } catch (error) {
    console.error('GET /teachers/:id/leave-history error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /teachers/:id/cpd-enrollments
router.get('/:id/cpd-enrollments', authenticate, requireRole('admin', 'manager', 'hod', 'principal', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const teacherId = req.params.id as string
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return }
    if (role === 'teacher' && teacher.userId !== userId) { res.status(403).json({ success: false, message: 'Forbidden' }); return }
    const enrollments = await prisma.cpdEnrollment.findMany({
      where: { teacherId },
      include: { workshop: true },
      orderBy: { enrolledAt: 'desc' },
    })
    res.json({ success: true, data: enrollments })
  } catch (error) {
    console.error('GET /teachers/:id/cpd-enrollments error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /teachers/:id — get teacher with details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { role, userId } = req.user!

    // Role check
    if (!['admin', 'manager', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const teacher = await prisma.teacher.findUnique({
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
        certifications: true,
        courseAssignments: {
          include: {
            course: {
              include: {
                _count: { select: { enrollments: true } },
              },
            },
          },
        },
      },
    })

    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found' })
      return
    }

    // Teacher can only view own record
    if (role === 'teacher' && teacher.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    res.json({ success: true, data: teacher })
  } catch (error) {
    console.error('Error getting teacher:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /teachers/me/form-class — form teacher's class roster + summary
router.get('/me/form-class', authenticate, requireRole('teacher', 'hod', 'admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.userId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return }

    const roster = await prisma.classRoster.findFirst({
      where: { formTeacherId: teacher.id },
    })
    if (!roster) { res.json({ success: true, data: null }); return }

    // Students in this class
    const students = await prisma.student.findMany({
      where: { className: roster.className, gradeLevel: roster.gradeLevel, enrollmentStatus: 'enrolled' },
      include: { user: { select: USER_SELECT_NAME } },
    })

    const studentIds = students.map((s) => s.id)

    // Attendance last 30 days per student
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const attendances = await prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds }, session: { date: { gte: since } } },
    })

    // Grade averages
    const grades = await prisma.grade.findMany({
      where: { studentId: { in: studentIds }, score: { not: null } },
      include: { gradeItem: { select: { maxScore: true, weight: true } } },
    })

    // Behavior net points
    const behaviors = await prisma.behaviorRecord.findMany({
      where: { studentId: { in: studentIds } },
    })

    const studentData = students.map((s) => {
      const att = attendances.filter((a) => a.studentId === s.id)
      const total = att.length
      const present = att.filter((a) => a.status === 'present' || a.status === 'late').length
      const attRate = total > 0 ? Math.round((present / total) * 100) : null

      const g = grades.filter((gr) => gr.studentId === s.id)
      let gpa: number | null = null
      if (g.length > 0) {
        const sum = g.reduce((acc, gr) => acc + (gr.score ?? 0) / (gr.gradeItem.maxScore || 100) * 100 * gr.gradeItem.weight, 0)
        const w = g.reduce((acc, gr) => acc + gr.gradeItem.weight, 0)
        gpa = w > 0 ? Math.round((sum / w) * 10) / 10 : null
      }

      const beh = behaviors.filter((b) => b.studentId === s.id)
      const netPoints = beh.reduce((acc, b) => acc + b.points, 0)

      return {
        id: s.id,
        studentId: s.studentId,
        displayName: s.user.displayName,
        academicStanding: s.academicStanding,
        attendanceRate: attRate,
        gradeAverage: gpa,
        netBehaviorPoints: netPoints,
      }
    })

    res.json({
      success: true,
      data: {
        roster,
        students: studentData,
        summary: {
          total: students.length,
          presentToday: null,
          avgGpa: studentData.filter((s) => s.gradeAverage !== null).reduce((a, s) => a + (s.gradeAverage ?? 0), 0) / (studentData.filter((s) => s.gradeAverage !== null).length || 1),
          netBehavior: studentData.reduce((a, s) => a + s.netBehaviorPoints, 0),
        },
      },
    })
  } catch (error) {
    console.error('GET /teachers/me/form-class error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
