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
