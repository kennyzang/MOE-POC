import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import {
  chat,
  chatStream,
  buildContextData,
  loadAiConfig,
  saveAiConfig,
  testConnection,
  computeRiskForGrade,
} from '../services/aiService'
import { broadcast } from './events'
import { send } from '../services/notificationService'

// ── Risk formula (spec Section 9.2, demo-tuned weights) ──────────────────────
function computeRiskScore(input: {
  attendanceRatePercent: number
  recentAbsenceCount: number
  currentGradeAvg: number
  previousGradeAvg: number | null
  cohortMedianGradeAvg: number
}): { score: number; band: 'ON_TRACK' | 'MONITOR' | 'HIGH_RISK'; factors: object } {
  const attendanceFactor = Math.max(0, Math.min(1, (100 - input.attendanceRatePercent) / 30))
  const gradeTrendFactor = input.previousGradeAvg !== null
    ? Math.max(0, Math.min(1, (input.previousGradeAvg - input.currentGradeAvg) / 20))
    : 0
  const absenceBurstFactor = Math.min(1, input.recentAbsenceCount / 5)
  const cohortFactor = Math.max(0, Math.min(1, (input.cohortMedianGradeAvg - input.currentGradeAvg) / 30))

  const score =
    0.45 * attendanceFactor +
    0.35 * gradeTrendFactor +
    0.15 * absenceBurstFactor +
    0.05 * cohortFactor

  const rounded = Math.round(score * 100) / 100
  const band = rounded >= 0.7 ? 'HIGH_RISK' : rounded >= 0.4 ? 'MONITOR' : 'ON_TRACK'

  return {
    score: rounded,
    band,
    factors: {
      attendance: { value: attendanceFactor, weight: 0.45, contribution: 0.45 * attendanceFactor },
      gradeTrend: { value: gradeTrendFactor, weight: 0.35, contribution: 0.35 * gradeTrendFactor },
      absenceBurst: { value: absenceBurstFactor, weight: 0.15, contribution: 0.15 * absenceBurstFactor },
      cohort: { value: cohortFactor, weight: 0.05, contribution: 0.05 * cohortFactor },
    },
  }
}

// Exported so grades.ts and attendance.ts can call it after state changes
export async function recalcStudentRisk(studentDbId: string, triggerEvent: string): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id: studentDbId },
    include: {
      attendances: {
        include: { session: true },
        orderBy: { session: { date: 'desc' } },
      },
      grades: {
        include: { gradeItem: true },
        orderBy: { gradedAt: 'desc' },
      },
    },
  })
  if (!student) return

  // Attendance rate (all time)
  const total = student.attendances.length
  const present = student.attendances.filter(a => a.status === 'present').length
  const attendanceRatePercent = total > 0 ? Math.round((present / total) * 100) : 100

  // Recent 14-day absence count
  const cutoff14 = new Date()
  cutoff14.setDate(cutoff14.getDate() - 14)
  const recentAbsenceCount = student.attendances.filter(
    a => a.status === 'absent' && new Date(a.session.date) >= cutoff14,
  ).length

  // Current grade avg (0-100 percentage)
  const gradeScores = student.grades
    .filter(g => g.score !== null)
    .map(g => (g.score! / (g.gradeItem.maxScore || 100)) * 100)
  const currentGradeAvg = gradeScores.length > 0
    ? Math.round(gradeScores.reduce((s, v) => s + v, 0) / gradeScores.length)
    : 70

  // Previous grade avg: use second oldest half of grades as proxy
  let previousGradeAvg: number | null = null
  if (student.grades.length >= 4) {
    const half = Math.floor(student.grades.length / 2)
    const olderGrades = student.grades.slice(half).filter(g => g.score !== null)
    if (olderGrades.length > 0) {
      previousGradeAvg = Math.round(
        olderGrades.reduce((s, g) => s + (g.score! / (g.gradeItem.maxScore || 100)) * 100, 0) / olderGrades.length,
      )
    }
  }

  // Cohort median: average grade for same className
  const cohortGrades = await prisma.grade.findMany({
    where: {
      student: { className: student.className ?? '', enrollmentStatus: 'enrolled' },
      score: { not: null },
    },
    include: { gradeItem: { select: { maxScore: true } } },
  })
  const cohortMedianGradeAvg = cohortGrades.length > 0
    ? Math.round(
        cohortGrades.reduce((s, g) => s + (g.score! / (g.gradeItem.maxScore || 100)) * 100, 0) / cohortGrades.length,
      )
    : 70

  const { score, band, factors } = computeRiskScore({
    attendanceRatePercent,
    recentAbsenceCount,
    currentGradeAvg,
    previousGradeAvg,
    cohortMedianGradeAvg,
  })

  // Get previous band to detect threshold crossing
  const prevScore = await prisma.riskScore.findFirst({
    where: { studentId: studentDbId },
    orderBy: { computedAt: 'desc' },
  })
  const prevBand = prevScore?.band ?? 'ON_TRACK'

  // Persist new risk score
  await prisma.riskScore.create({
    data: {
      studentId: studentDbId,
      score,
      band,
      absences14d: recentAbsenceCount,
      gradeAvg: currentGradeAvg,
      gradeTrend: previousGradeAvg !== null ? currentGradeAvg - previousGradeAvg : null,
      computedAt: new Date(),
    },
  })

  // Threshold crossing: ON_TRACK/MONITOR → HIGH_RISK
  if (band === 'HIGH_RISK' && prevBand !== 'HIGH_RISK') {
    // Open or update CounselorCase
    const existing = await prisma.counselorCase.findFirst({
      where: { studentId: studentDbId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    })

    // Find assigned counselor (first counselor user)
    const counselorUser = await prisma.user.findFirst({ where: { role: 'counselor' } })

    if (!existing) {
      await prisma.counselorCase.create({
        data: {
          studentId: studentDbId,
          counselorUserId: counselorUser?.id ?? null,
          openedReason: 'AUTO_RISK_THRESHOLD',
          status: 'OPEN',
        },
      })
    } else {
      await prisma.counselorCase.update({
        where: { id: existing.id },
        data: { status: 'IN_PROGRESS', notes: `Risk score reached ${score} (HIGH_RISK) on ${new Date().toISOString()}` },
      })
    }

    // Notify counselor
    if (counselorUser) {
      const studentUser = await prisma.user.findUnique({ where: { id: student.userId ?? '' } })
      await send({
        userId: counselorUser.id,
        title: 'High Risk Alert',
        message: `${studentUser?.displayName ?? student.studentId} has crossed the High Risk threshold (score ${score}). A counselor case has been opened.`,
        type: 'warning',
      })
    }
  }

  // SSE: broadcast risk widget update
  const atRiskCount = await prisma.riskScore.findMany({
    where: { band: 'HIGH_RISK' },
    orderBy: { computedAt: 'desc' },
    distinct: ['studentId'],
    select: { studentId: true },
  })
  broadcast('dashboard', 'dashboard.risk.changed', { studentsAtRisk: atRiskCount.length })
}

const router = Router()
router.use(authenticate)

// ── Helpers ──────────────────────────────────────────────────────

async function loadConversationHistory(conversationId?: string) {
  if (!conversationId) return { history: [], existing: null }
  const existing = await prisma.chatbotConversation.findUnique({ where: { id: conversationId } })
  if (!existing) return { history: [], existing: null }
  try {
    const prev = JSON.parse(existing.messages)
    const history = prev.slice(-10).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    return { history, existing }
  } catch {
    return { history: [], existing }
  }
}

async function persistConversation(
  userId: string,
  message: string,
  answer: string,
  contextData: any,
  existing: any,
  conversationId?: string,
) {
  const newMessages = [
    { role: 'user',      content: message, timestamp: new Date().toISOString() },
    { role: 'assistant', content: answer,  timestamp: new Date().toISOString() },
  ]
  if (existing) {
    const prev = JSON.parse(existing.messages)
    return prisma.chatbotConversation.update({
      where: { id: conversationId! },
      data: {
        messages:       JSON.stringify([...prev, ...newMessages]),
        lastActivityAt: new Date(),
        contextData:    JSON.stringify(contextData),
      },
    })
  }
  return prisma.chatbotConversation.create({
    data: {
      userId,
      messages:    JSON.stringify(newMessages),
      contextData: JSON.stringify(contextData),
    },
  })
}

// ── Routes ────────────────────────────────────────────────────────

// POST /api/v1/ai/chat  (non-streaming)
router.post('/chat', async (req: AuthRequest, res: Response) => {
  const { message, conversationId } = req.body as { message: string; conversationId?: string }
  const userId = req.user!.userId

  if (!message?.trim()) {
    res.status(400).json({ success: false, message: 'Message is required' }); return
  }

  const [contextData, { history, existing }] = await Promise.all([
    buildContextData(userId, req.user!.role),
    loadConversationHistory(conversationId),
  ])

  const answer = await chat(message, contextData, history)
  const conversation = await persistConversation(userId, message, answer, contextData, existing, conversationId)

  res.json({
    success: true,
    data: { answer, conversationId: conversation.id },
  })
})

// POST /api/v1/ai/chat/stream  (SSE streaming)
router.post('/chat/stream', async (req: AuthRequest, res: Response) => {
  const { message, conversationId } = req.body as { message: string; conversationId?: string }
  const userId = req.user!.userId

  if (!message?.trim()) {
    res.status(400).json({ success: false, message: 'Message is required' }); return
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const [contextData, { history, existing }] = await Promise.all([
    buildContextData(userId, req.user!.role),
    loadConversationHistory(conversationId),
  ])

  const answer = await chatStream(message, contextData, history, (chunk) => {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
  })

  const conversation = await persistConversation(userId, message, answer, contextData, existing, conversationId)

  res.write(`data: ${JSON.stringify({ done: true, conversationId: conversation.id })}\n\n`)
  res.end()
})

// POST /api/v1/ai/risk/recalc/:studentId — recompute risk for one student
router.post('/risk/recalc/:studentId', requireRole('admin', 'manager', 'principal', 'teacher', 'counselor'), async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params as { studentId: string }
  const student = await prisma.student.findFirst({ where: { OR: [{ id: studentId }, { studentId }] } })
  if (!student) {
    res.status(404).json({ success: false, message: 'Student not found' })
    return
  }
  await recalcStudentRisk(student.id, 'MANUAL_RECALC')
  const latest = await prisma.riskScore.findFirst({
    where: { studentId: student.id },
    orderBy: { computedAt: 'desc' },
  })
  res.json({ success: true, data: latest })
})

// GET /api/v1/ai/risk/students — list at-risk students (HIGH_RISK or MONITOR)
router.get('/risk/students', requireRole('admin', 'manager', 'principal', 'counselor'), async (_req: AuthRequest, res: Response) => {
  const latest = await prisma.riskScore.findMany({
    where: { band: { in: ['HIGH_RISK', 'MONITOR'] } },
    orderBy: { computedAt: 'desc' },
    distinct: ['studentId'],
    include: {
      student: {
        include: { user: { select: { displayName: true } } },
      },
    },
  })
  res.json({ success: true, data: latest })
})

// GET /api/v1/ai/risk-report/:gradeLevel  (principal/admin only)
router.get('/risk-report/:gradeLevel', requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  const gradeLevel = String(req.params.gradeLevel)
  const results = await computeRiskForGrade(gradeLevel)
  res.json({ success: true, data: results })
})

// GET /api/v1/ai/risk-grades  – list available grade levels
router.get('/risk-grades', requireRole('admin', 'manager', 'principal'), async (_req, res: Response) => {
  const grades = await prisma.student.findMany({
    where: { enrollmentStatus: 'enrolled', gradeLevel: { not: null } },
    select: { gradeLevel: true },
    distinct: ['gradeLevel'],
    orderBy: { gradeLevel: 'asc' },
  })
  res.json({ success: true, data: grades.map(g => g.gradeLevel).filter(Boolean) })
})

// GET /api/v1/ai/config  (admin only)
router.get('/config', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  const cfg = await loadAiConfig()
  res.json({
    success: true,
    data: {
      ...cfg,
      apiKey: cfg.apiKey
        ? `${cfg.apiKey.slice(0, 6)}${'*'.repeat(Math.max(0, cfg.apiKey.length - 10))}${cfg.apiKey.slice(-4)}`
        : '',
    },
  })
})

// PUT /api/v1/ai/config  (admin only)
router.put('/config', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { enabled, provider, apiKey, model, baseUrl, systemPrompt, temperature, maxTokens } = req.body
  await saveAiConfig({
    ...(enabled      !== undefined && { enabled: Boolean(enabled) }),
    ...(provider     !== undefined && { provider }),
    ...(apiKey       !== undefined && apiKey !== '' && !apiKey.includes('*') && { apiKey }),
    ...(model        !== undefined && { model }),
    ...(baseUrl      !== undefined && { baseUrl }),
    ...(systemPrompt !== undefined && { systemPrompt }),
    ...(temperature  !== undefined && { temperature: Number(temperature) }),
    ...(maxTokens    !== undefined && { maxTokens: Number(maxTokens) }),
  })
  res.json({ success: true, message: 'AI configuration saved' })
})

// POST /api/v1/ai/config/test  (admin only)
router.post('/config/test', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  const result = await testConnection()
  res.json({ success: result.success, data: result })
})

export default router
