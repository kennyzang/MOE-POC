import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET / — list enrollments
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, courseId } = req.query as { studentId?: string; courseId?: string }

    // Student and parent roles can query without params (scoped server-side)
    const isPortalRole = req.user!.role === 'student' || req.user!.role === 'parent'
    if (!isPortalRole && !studentId && !courseId) {
      res
        .status(400)
        .json({ success: false, message: 'studentId or courseId query param is required' })
      return
    }

    const where: any = {}
    if (studentId) where.studentId = studentId
    if (courseId) where.courseId = courseId

    // Student: own enrollments only
    if (req.user!.role === 'student') {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
      if (!student) {
        res.json({ success: true, data: [] })
        return
      }
      where.studentId = student.id
    }

    // Parent: children's enrollments only
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
      // If a specific studentId was requested, verify it's one of the parent's children
      if (studentId && !childIds.includes(studentId)) {
        res.status(403).json({ success: false, message: 'Forbidden' })
        return
      }
      if (!studentId) {
        where.studentId = { in: childIds }
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, name: true, gradeLevel: true, creditHours: true } },
        student: {
          include: { user: { select: { id: true, displayName: true, username: true } } },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    })

    res.json({ success: true, data: enrollments })
  } catch (error) {
    console.error('GET /enrollments error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
