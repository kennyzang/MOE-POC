import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// ─── Helpers ───────────────────────────────────────────────────

function calcOverallScore(teaching: number, professional: number, conduct: number): number {
  return Math.round(((teaching + professional + conduct) / 3) * 10) / 10
}

function calcRating(overall: number): string {
  if (overall >= 90) return 'Excellent'
  if (overall >= 80) return 'Good'
  if (overall >= 70) return 'Satisfactory'
  return 'NeedsImprovement'
}

// ─── CPD Summary ───────────────────────────────────────────────

// GET /api/v1/ems/cpd-summary
router.get('/cpd-summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const where: Record<string, unknown> = {}

    // Teacher only sees own record
    if (role === 'teacher') {
      where.userId = userId
    }

    const teachers = await prisma.teacher.findMany({
      where: role === 'teacher' ? { userId } : {},
      include: {
        user: {
          select: { id: true, displayName: true, username: true, email: true },
        },
      },
      orderBy: { staffId: 'asc' },
    })

    const summary = teachers.map(t => ({
      id: t.id,
      staffId: t.staffId,
      displayName: t.user.displayName,
      department: t.department,
      cpdHours: t.cpdHours,
      cpdTarget: t.cpdTarget,
      employmentStatus: t.employmentStatus,
      cpdPercentage: Math.min(Math.round((t.cpdHours / t.cpdTarget) * 100), 100),
      belowTarget: t.cpdHours < t.cpdTarget,
    }))

    res.json({ success: true, data: summary })
  } catch (error) {
    console.error('Error fetching CPD summary:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Performance Evaluations ───────────────────────────────────

// GET /api/v1/ems/performance-evaluations
router.get('/performance-evaluations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    let where: Record<string, unknown> = {}

    // Teacher sees only their own evaluations
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Teacher profile not found' })
        return
      }
      where = { teacherId: teacher.id }
    }

    const evaluations = await prisma.performanceEvaluation.findMany({
      where,
      include: {
        teacher: {
          include: {
            user: {
              select: { id: true, displayName: true, username: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: evaluations })
  } catch (error) {
    console.error('Error listing performance evaluations:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /api/v1/ems/performance-evaluations
router.post('/performance-evaluations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: HOD/Admin only' })
      return
    }

    const { teacherId, academicYear, teachingScore, professionalScore, conductScore, comments } = req.body

    if (!teacherId || !academicYear) {
      res.status(400).json({ success: false, message: 'teacherId and academicYear are required' })
      return
    }

    // Verify teacher exists
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found' })
      return
    }

    let overallScore: number | undefined
    let rating: string | undefined

    if (
      teachingScore !== undefined &&
      professionalScore !== undefined &&
      conductScore !== undefined
    ) {
      overallScore = calcOverallScore(
        Number(teachingScore),
        Number(professionalScore),
        Number(conductScore)
      )
      rating = calcRating(overallScore)
    }

    const evaluation = await prisma.performanceEvaluation.create({
      data: {
        teacherId,
        academicYear,
        evaluatorId: userId,
        teachingScore: teachingScore !== undefined ? Number(teachingScore) : undefined,
        professionalScore: professionalScore !== undefined ? Number(professionalScore) : undefined,
        conductScore: conductScore !== undefined ? Number(conductScore) : undefined,
        overallScore,
        rating,
        comments,
        status: 'draft',
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
    })

    res.status(201).json({ success: true, data: evaluation })
  } catch (error) {
    console.error('Error creating performance evaluation:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /api/v1/ems/performance-evaluations/:id/submit
router.patch('/performance-evaluations/:id/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    const id = req.params.id as string

    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: HOD/Admin only' })
      return
    }

    const evaluation = await prisma.performanceEvaluation.findUnique({ where: { id } })
    if (!evaluation) {
      res.status(404).json({ success: false, message: 'Evaluation not found' })
      return
    }

    if (evaluation.status !== 'draft') {
      res.status(400).json({ success: false, message: 'Only draft evaluations can be submitted' })
      return
    }

    const updated = await prisma.performanceEvaluation.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error submitting evaluation:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /api/v1/ems/performance-evaluations/:id/review
router.patch('/performance-evaluations/:id/review', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const id = req.params.id as string
    const { action, reviewerComments } = req.body

    if (!['admin', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: Principal/Admin only' })
      return
    }

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' })
      return
    }

    const evaluation = await prisma.performanceEvaluation.findUnique({ where: { id } })
    if (!evaluation) {
      res.status(404).json({ success: false, message: 'Evaluation not found' })
      return
    }

    if (evaluation.status !== 'submitted') {
      res.status(400).json({ success: false, message: 'Only submitted evaluations can be reviewed' })
      return
    }

    const updated = await prisma.performanceEvaluation.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewerId: userId,
        reviewerComments,
        reviewedAt: new Date(),
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error reviewing evaluation:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
