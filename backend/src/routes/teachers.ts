import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET /teachers — list all teachers with user info
router.get(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { search, department } = req.query

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {}

      if (department) where.department = department as string

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
          select: { id: true, username: true, displayName: true, email: true, role: true, avatar: true, status: true },
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

export default router
