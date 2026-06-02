import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'

const router = Router()

// GET /behavior — filtered list (role-scoped)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, type, className, gradeLevel } = req.query as Record<string, string>
    const role = req.user!.role
    const userId = req.user!.userId

    const where: Record<string, unknown> = {}
    if (studentId) where.studentId = studentId
    if (type) where.type = type
    if (gradeLevel || className) {
      where.student = {
        ...(gradeLevel && { gradeLevel }),
        ...(className && { className }),
      }
    }

    // Teachers can only see students in their courses
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (teacher) {
        const courseAssignments = await prisma.courseAssignment.findMany({
          where: { teacherId: teacher.id },
          select: { courseId: true },
        })
        const courseIds = courseAssignments.map((ca) => ca.courseId)
        const enrollments = await prisma.enrollment.findMany({
          where: { courseId: { in: courseIds }, status: 'enrolled' },
          select: { studentId: true },
        })
        const studentIds = enrollments.map((e) => e.studentId)
        where.studentId = { in: studentIds }
      }
    }

    const records = await prisma.behaviorRecord.findMany({
      where,
      include: {
        student: { include: { user: { select: { displayName: true } } } },
        recordedBy: { select: { displayName: true, role: true } },
      },
      orderBy: { date: 'desc' },
      take: 200,
    })

    res.json({ success: true, data: records })
  } catch (error) {
    console.error('GET /behavior error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /behavior/student/:studentId — full timeline for one student
router.get('/student/:studentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.params['studentId'] as string
    const records = await prisma.behaviorRecord.findMany({
      where: { studentId },
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

// GET /behavior/summary — school-wide tally (admin/principal/counselor/hod)
router.get(
  '/summary',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'counselor', 'hod'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const records = await prisma.behaviorRecord.findMany({ orderBy: { createdAt: 'desc' } })
      const totalMerits = records.filter((r) => r.type === 'merit').reduce((s, r) => s + r.points, 0)
      const totalDemerits = records.filter((r) => r.type === 'demerit').reduce((s, r) => s + Math.abs(r.points), 0)
      const incidents = records.filter((r) => r.type === 'incident').length
      const thisMonth = records.filter(
        (r) => r.date >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      )
      res.json({
        success: true,
        data: { totalMerits, totalDemerits, netPoints: totalMerits - totalDemerits, incidents, thisMonthCount: thisMonth.length },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// POST /behavior — log a record
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'counselor', 'hod', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, type, category, points, description, actionTaken, severity } = req.body as {
        studentId: string; type: string; category: string; points?: number
        description: string; actionTaken?: string; severity?: string
      }

      const notifyParent = severity === 'moderate' || severity === 'major' || type === 'demerit'

      const record = await prisma.behaviorRecord.create({
        data: {
          studentId,
          recordedById: req.user!.userId,
          type,
          category,
          points: points ?? (type === 'merit' ? 1 : type === 'demerit' ? -1 : 0),
          description,
          actionTaken,
          severity,
          parentNotified: notifyParent,
        },
        include: {
          student: {
            include: {
              user: { select: { displayName: true } },
              parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
            },
          },
          recordedBy: { select: { displayName: true } },
        },
      })

      if (notifyParent) {
        const parentIds = record.student.parentLinks.map((l) => l.parent.user.id)
        const typeLabel = type === 'merit' ? '🏅 Merit' : type === 'demerit' ? '⚠️ Demerit' : '📋 Incident'
        await Promise.all(
          parentIds.map((uid) =>
            send({
              userId: uid,
              title: `${typeLabel} Record — ${record.student.user.displayName}`,
              message: `${description}${actionTaken ? `. Action: ${actionTaken}` : ''}`,
              type: type === 'merit' ? 'success' : 'warning',
            })
          )
        )
      }

      res.status(201).json({ success: true, data: record })
    } catch (error) {
      console.error('POST /behavior error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// PATCH /behavior/:id — update action taken / follow-up
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'counselor', 'hod', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params['id'] as string
      const { actionTaken } = req.body as { actionTaken?: string }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {}
      if (actionTaken !== undefined) data.actionTaken = actionTaken
      const updated = await prisma.behaviorRecord.update({ where: { id }, data })
      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

export default router
