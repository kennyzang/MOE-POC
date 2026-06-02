import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

const VALID_CATEGORIES = ['GENERAL', 'PROFESSIONAL_DEVELOPMENT', 'WELL_BEING', 'SCHOOL_MANAGEMENT']
const VALID_TYPES      = ['RATING', 'TEXT', 'MULTIPLE_CHOICE', 'YES_NO']

// ─── GET / — list surveys ─────────────────────────────────────────

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    const isAdmin = ['admin', 'manager', 'principal'].includes(role)

    const where = isAdmin ? {} : { status: 'ACTIVE' }

    const surveys = await prisma.survey.findMany({
      where,
      include: {
        _count: { select: { questions: true, responses: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: surveys })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /:id — get survey with questions ─────────────────────────

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params as { id: string }
    const { userId, role } = req.user!
    const isAdmin = ['admin', 'manager', 'principal'].includes(role)

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        _count: { select: { responses: true } },
      },
    })
    if (!survey) { res.status(404).json({ success: false, message: 'Survey not found' }); return }
    if (!isAdmin && survey.status !== 'ACTIVE') {
      res.status(403).json({ success: false, message: 'Survey is not active' }); return
    }

    // Check if current user already responded
    let hasResponded = false
    if (!survey.isAnonymous) {
      const existing = await prisma.surveyResponse.findUnique({
        where: { surveyId_responderId: { surveyId: id, responderId: userId } },
      })
      hasResponded = !!existing
    }

    res.json({ success: true, data: { ...survey, hasResponded } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST / — create survey ───────────────────────────────────────

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const { title, description, category, isAnonymous, startDate, endDate, questions } = req.body as {
      title: string
      description?: string
      category?: string
      isAnonymous?: boolean
      startDate?: string
      endDate?: string
      questions?: { text: string; type?: string; options?: string[]; required?: boolean; order?: number }[]
    }

    if (!title) { res.status(400).json({ success: false, message: 'title is required' }); return }
    if (category && !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ success: false, message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }); return
    }

    const survey = await prisma.survey.create({
      data: {
        title,
        description: description ?? null,
        category: category ?? 'GENERAL',
        isAnonymous: isAnonymous ?? true,
        status: 'DRAFT',
        createdById: userId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        questions: {
          create: (questions ?? []).map((q, i) => ({
            text: q.text,
            type: q.type ?? 'RATING',
            options: q.options ? JSON.stringify(q.options) : null,
            required: q.required ?? true,
            order: q.order ?? i + 1,
          })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    })

    res.status(201).json({ success: true, data: survey })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── PUT /:id — edit survey (DRAFT only) ──────────────────────────

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    const { id } = req.params as { id: string }
    const existing = await prisma.survey.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Survey not found' }); return }
    if (existing.status !== 'DRAFT') {
      res.status(400).json({ success: false, message: 'Only DRAFT surveys can be edited' }); return
    }

    const { title, description, category, isAnonymous, startDate, endDate, questions } = req.body as {
      title?: string; description?: string; category?: string; isAnonymous?: boolean
      startDate?: string; endDate?: string
      questions?: { id?: string; text: string; type?: string; options?: string[]; required?: boolean; order?: number }[]
    }

    const updated = await prisma.survey.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(category ? { category } : {}),
        ...(isAnonymous !== undefined ? { isAnonymous } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
    })

    // Replace questions if provided
    if (questions !== undefined) {
      await prisma.surveyQuestion.deleteMany({ where: { surveyId: id } })
      await prisma.surveyQuestion.createMany({
        data: questions.map((q, i) => ({
          surveyId: id,
          text: q.text,
          type: q.type ?? 'RATING',
          options: q.options ? JSON.stringify(q.options) : null,
          required: q.required ?? true,
          order: q.order ?? i + 1,
        })),
      })
    }

    const result = await prisma.survey.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    })
    res.json({ success: true, data: result })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── PATCH /:id/status ────────────────────────────────────────────

router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    const { id } = req.params as { id: string }
    const { status } = req.body as { status: string }

    const validTransitions: Record<string, string[]> = {
      DRAFT: ['ACTIVE'],
      ACTIVE: ['CLOSED'],
      CLOSED: [],
    }

    const existing = await prisma.survey.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Survey not found' }); return }
    if (!validTransitions[existing.status]?.includes(status)) {
      res.status(400).json({ success: false, message: `Cannot transition from ${existing.status} to ${status}` }); return
    }

    // Must have at least one question to activate
    if (status === 'ACTIVE') {
      const qCount = await prisma.surveyQuestion.count({ where: { surveyId: id } })
      if (qCount === 0) {
        res.status(400).json({ success: false, message: 'Survey must have at least one question before activating' }); return
      }
    }

    const updated = await prisma.survey.update({ where: { id }, data: { status } })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── DELETE /:id ──────────────────────────────────────────────────

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    const { id } = req.params as { id: string }
    const existing = await prisma.survey.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Survey not found' }); return }
    if (existing.status === 'ACTIVE') {
      res.status(400).json({ success: false, message: 'Cannot delete an active survey. Close it first.' }); return
    }
    await prisma.survey.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /:id/respond ────────────────────────────────────────────

router.post('/:id/respond', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const { id } = req.params as { id: string }

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: { questions: true },
    })
    if (!survey) { res.status(404).json({ success: false, message: 'Survey not found' }); return }
    if (survey.status !== 'ACTIVE') {
      res.status(400).json({ success: false, message: 'Survey is not accepting responses' }); return
    }

    // Prevent duplicate response for non-anonymous surveys
    if (!survey.isAnonymous) {
      const existing = await prisma.surveyResponse.findUnique({
        where: { surveyId_responderId: { surveyId: id, responderId: userId } },
      })
      if (existing) { res.status(409).json({ success: false, message: 'You have already responded to this survey' }); return }
    }

    const { answers } = req.body as { answers: { questionId: string; value: string }[] }

    if (!answers || !Array.isArray(answers)) {
      res.status(400).json({ success: false, message: 'answers array is required' }); return
    }

    // Validate required questions are answered
    const requiredIds = new Set(survey.questions.filter(q => q.required).map(q => q.id))
    const answeredIds = new Set(answers.map(a => a.questionId))
    for (const reqId of requiredIds) {
      if (!answeredIds.has(reqId)) {
        res.status(400).json({ success: false, message: `Question ${reqId} is required` }); return
      }
    }

    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: id,
        responderId: survey.isAnonymous ? null : userId,
        answers: {
          create: answers.map(a => ({
            questionId: a.questionId,
            value: String(a.value),
          })),
        },
      },
    })

    res.status(201).json({ success: true, data: { responseId: response.id } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /:id/results ─────────────────────────────────────────────

router.get('/:id/results', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    const { id } = req.params as { id: string }

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        responses: {
          include: { answers: true },
        },
      },
    })
    if (!survey) { res.status(404).json({ success: false, message: 'Survey not found' }); return }

    const totalResponses = survey.responses.length

    const questionResults = survey.questions.map(q => {
      const answers = survey.responses.flatMap(r => r.answers.filter(a => a.questionId === q.id))
      const values = answers.map(a => a.value)

      let result: {
        questionId: string; text: string; type: string
        totalAnswers: number
        avgRating?: number
        distribution?: Record<string, number>
        textResponses?: string[]
      } = { questionId: q.id, text: q.text, type: q.type, totalAnswers: values.length }

      if (q.type === 'RATING') {
        const nums = values.map(Number).filter(n => !isNaN(n))
        result.avgRating = nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0
        result.distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
        for (const n of nums) {
          const key = String(Math.min(5, Math.max(1, Math.round(n))))
          result.distribution[key] = (result.distribution[key] ?? 0) + 1
        }
      } else if (q.type === 'TEXT') {
        result.textResponses = values.filter(v => v.trim().length > 0)
      } else if (q.type === 'MULTIPLE_CHOICE' || q.type === 'YES_NO') {
        result.distribution = {}
        for (const v of values) {
          result.distribution[v] = (result.distribution[v] ?? 0) + 1
        }
      }

      return result
    })

    res.json({
      success: true,
      data: {
        surveyId: survey.id,
        title: survey.title,
        category: survey.category,
        isAnonymous: survey.isAnonymous,
        status: survey.status,
        totalResponses,
        questions: questionResults,
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /:id/my-response ─────────────────────────────────────────

router.get('/:id/my-response', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const { id } = req.params as { id: string }

    const survey = await prisma.survey.findUnique({ where: { id }, select: { isAnonymous: true } })
    if (!survey) { res.status(404).json({ success: false, message: 'Survey not found' }); return }

    if (survey.isAnonymous) {
      res.json({ success: true, data: { hasResponded: false } }); return
    }

    const response = await prisma.surveyResponse.findUnique({
      where: { surveyId_responderId: { surveyId: id, responderId: userId } },
    })
    res.json({ success: true, data: { hasResponded: !!response } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
