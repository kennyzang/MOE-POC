import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'

const router = Router()

// GET /assignments — role-scoped list
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, status } = req.query as Record<string, string>
    const role = req.user!.role
    const userId = req.user!.userId

    const where: Record<string, unknown> = {}
    if (courseId) where.courseId = courseId
    if (status) where.status = status

    if (role === 'teacher' || role === 'hod') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (teacher) where.teacherId = teacher.id
    } else if (role === 'student') {
      // Return assignments for courses the student is enrolled in
      const enrollments = await prisma.enrollment.findMany({
        where: { student: { userId }, status: 'enrolled' },
        select: { courseId: true },
      })
      where.courseId = { in: enrollments.map((e) => e.courseId) }
      where.status = 'published'
    }

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        course: { select: { id: true, name: true, code: true, gradeLevel: true } },
        teacher: { include: { user: { select: { displayName: true } } } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    res.json({ success: true, data: assignments })
  } catch (error) {
    console.error('GET /assignments error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /assignments/student/pending — pending/overdue for current student (dashboard widget)
router.get('/student/pending', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { student: { userId: req.user!.userId }, status: 'enrolled' },
      select: { courseId: true },
    })
    const courseIds = enrollments.map((e) => e.courseId)

    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
    if (!student) { res.json({ success: true, data: [] }); return }

    const assignments = await prisma.assignment.findMany({
      where: {
        courseId: { in: courseIds },
        status: 'published',
        submissions: { none: { studentId: student.id } },
      },
      include: { course: { select: { name: true, code: true } } },
      orderBy: { dueDate: 'asc' },
    })

    res.json({ success: true, data: assignments })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /assignments — teacher creates
router.post('/', authenticate, requireRole('teacher', 'hod', 'admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, title, description, type, dueDate, maxScore, status } = req.body as {
      courseId: string; title: string; description?: string; type?: string
      dueDate?: string; maxScore?: number; status?: string
    }

    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.userId } })
    if (!teacher) { res.status(403).json({ success: false, message: 'Teacher record not found' }); return }

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        teacherId: teacher.id,
        title,
        description,
        type: type ?? 'homework',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        maxScore: maxScore ?? 100,
        status: status ?? 'published',
      },
      include: { course: { select: { name: true, code: true } } },
    })

    // Notify enrolled students if published
    if (assignment.status === 'published') {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: 'enrolled' },
        include: { student: { include: { user: { select: { id: true } } } } },
      })
      await Promise.all(
        enrollments.map((e) =>
          send({
            userId: e.student.user.id,
            title: 'New Assignment Posted',
            message: `${assignment.course.name}: "${title}"${dueDate ? ` — due ${new Date(dueDate).toLocaleDateString()}` : ''}`,
            type: 'info',
          })
        )
      )
    }

    res.status(201).json({ success: true, data: assignment })
  } catch (error) {
    console.error('POST /assignments error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /assignments/:id — teacher updates
router.patch('/:id', authenticate, requireRole('teacher', 'hod', 'admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { title, description, type, dueDate, maxScore, status } = req.body as Record<string, unknown>

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}
    if (title) data.title = String(title)
    if (description !== undefined) data.description = String(description)
    if (type) data.type = String(type)
    if (dueDate) data.dueDate = new Date(String(dueDate))
    if (maxScore !== undefined) data.maxScore = Number(maxScore)
    if (status) data.status = String(status)

    const updated = await prisma.assignment.update({ where: { id }, data })
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /assignments/:id
router.delete('/:id', authenticate, requireRole('teacher', 'hod', 'admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: id } })
    await prisma.assignment.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /assignments/:id/submissions — teacher views all submissions
router.get('/:id/submissions', authenticate, requireRole('teacher', 'hod', 'admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: id },
      include: {
        student: {
          include: { user: { select: { displayName: true } } },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })
    res.json({ success: true, data: submissions })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /assignments/:id/submit — student submits
router.post('/:id/submit', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { content, fileUrl } = req.body as { content?: string; fileUrl?: string }
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
    if (!student) { res.status(403).json({ success: false, message: 'Student not found' }); return }

    const assignment = await prisma.assignment.findUnique({ where: { id } })
    if (!assignment) { res.status(404).json({ success: false, message: 'Assignment not found' }); return }

    const isLate = assignment.dueDate ? new Date() > assignment.dueDate : false

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: id, studentId: student.id } },
      create: { assignmentId: id, studentId: student.id, content, fileUrl, isLate, status: isLate ? 'late' : 'submitted' },
      update: { content, fileUrl, submittedAt: new Date(), isLate, status: isLate ? 'late' : 'submitted' },
    })

    res.status(201).json({ success: true, data: submission })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /assignments/:id/submissions/:submissionId/grade — teacher grades
router.patch('/:id/submissions/:submissionId/grade', authenticate, requireRole('teacher', 'hod', 'admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const submissionId = req.params['submissionId'] as string
    const { score, feedback } = req.body as { score: number; feedback?: string }

    // Fetch student user ID before update (to avoid include typing issues)
    const sub = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { student: { include: { user: { select: { id: true } } } } },
    })

    await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { score: Number(score), feedback, gradedAt: new Date(), status: 'graded' },
    })

    if (sub?.student?.user?.id) {
      await send({
        userId: sub.student.user.id,
        title: 'Assignment Graded',
        message: `Your assignment has been graded: ${score} points${feedback ? `. Feedback: ${feedback}` : ''}`,
        type: 'success',
      })
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
