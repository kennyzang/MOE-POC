import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

// Helper: get student IDs the current user can access
async function getAccessibleStudentIds(user: AuthRequest['user']): Promise<string[] | null> {
  if (!user) return []
  if (user.role === 'student') {
    const student = await prisma.student.findUnique({ where: { userId: user.userId } })
    return student ? [student.id] : []
  }
  if (user.role === 'parent') {
    const parent = await prisma.parent.findUnique({
      where: { userId: user.userId },
      include: { childLinks: true },
    })
    return parent ? parent.childLinks.map((l) => l.studentId) : []
  }
  return null // null = no restriction
}

// Helper: get course IDs a teacher is assigned to
async function getTeacherCourseIds(userId: string): Promise<string[]> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: { courseAssignments: true },
  })
  return teacher ? teacher.courseAssignments.map((a) => a.courseId) : []
}

// GET / — list grades
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, studentId } = req.query as { courseId?: string; studentId?: string }
    // Student and parent roles can query without params (scoped server-side)
    const isPortalRole = req.user!.role === 'student' || req.user!.role === 'parent'
    if (!isPortalRole && !courseId && !studentId) {
      res.status(400).json({ success: false, message: 'courseId or studentId query param is required' })
      return
    }

    const where: any = {}

    // Filter by courseId via gradeItem
    if (courseId) {
      where.gradeItem = { courseId }
    }
    if (studentId) {
      where.studentId = studentId
    }

    // Role-based filtering
    const accessibleIds = await getAccessibleStudentIds(req.user)
    if (accessibleIds !== null) {
      if (accessibleIds.length === 0) {
        res.json({ success: true, data: [] })
        return
      }
      where.studentId = accessibleIds.length === 1 ? accessibleIds[0] : { in: accessibleIds }
    }

    if (req.user!.role === 'teacher') {
      const courseIds = await getTeacherCourseIds(req.user!.userId)
      where.gradeItem = { courseId: { in: courseIds }, ...(courseId ? { courseId } : {}) }
    }

    const grades = await prisma.grade.findMany({
      where,
      include: {
        gradeItem: {
          include: { course: { select: { id: true, code: true, name: true } } },
        },
        student: { include: { user: { select: { id: true, displayName: true, username: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: grades })
  } catch (error) {
    console.error('GET /grades error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST / — create/upsert a grade
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, gradeItemId, score, letterGrade, remarks } = req.body
      if (!studentId || !gradeItemId) {
        res.status(400).json({ success: false, message: 'studentId and gradeItemId are required' })
        return
      }

      const grade = await prisma.grade.upsert({
        where: { studentId_gradeItemId: { studentId, gradeItemId } },
        create: { studentId, gradeItemId, score, letterGrade, remarks, gradedAt: new Date() },
        update: { score, letterGrade, remarks, gradedAt: new Date() },
        include: { gradeItem: true },
      })

      res.json({ success: true, data: grade })
    } catch (error) {
      console.error('POST /grades error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// PATCH /:id — update a grade
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { score, letterGrade, remarks } = req.body

      const grade = await prisma.grade.update({
        where: { id },
        data: {
          ...(score !== undefined && { score }),
          ...(letterGrade !== undefined && { letterGrade }),
          ...(remarks !== undefined && { remarks }),
          gradedAt: new Date(),
        },
        include: { gradeItem: true },
      })

      res.json({ success: true, data: grade })
    } catch (error) {
      console.error('PATCH /grades/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
