import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { sendEmail } from '../services/emailService'

const router = Router()

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'] as const

// GET /config/smtp — read SMTP config (admin only, password masked)
router.get('/smtp', authenticate, requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const records = await prisma.systemConfig.findMany({
      where: { key: { in: [...SMTP_KEYS] } },
    })
    const result: Record<string, string> = {}
    for (const r of records) {
      // Mask password in response
      result[r.key] = r.key === 'smtp_pass' ? '••••••••' : r.value
    }
    // Fill defaults for missing keys
    if (!result.smtp_host) result.smtp_host = ''
    if (!result.smtp_port) result.smtp_port = '587'
    if (!result.smtp_user) result.smtp_user = ''
    if (!result.smtp_pass) result.smtp_pass = ''
    if (!result.smtp_from) result.smtp_from = ''

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('GET /config/smtp error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PUT /config/smtp — save SMTP config (admin only)
router.put('/smtp', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from } = req.body as Record<string, string>

    if (!smtp_host || !smtp_user) {
      res.status(400).json({ success: false, message: 'smtp_host and smtp_user are required' })
      return
    }

    const updates: { key: string; value: string }[] = [
      { key: 'smtp_host', value: smtp_host },
      { key: 'smtp_port', value: smtp_port ?? '587' },
      { key: 'smtp_user', value: smtp_user },
      { key: 'smtp_from', value: smtp_from || smtp_user },
    ]
    // Only update password if a real value was sent (not the masked placeholder)
    if (smtp_pass && smtp_pass !== '••••••••') {
      updates.push({ key: 'smtp_pass', value: smtp_pass })
    }

    await Promise.all(
      updates.map(u =>
        prisma.systemConfig.upsert({
          where: { key: u.key },
          create: { key: u.key, value: u.value, description: `SMTP configuration: ${u.key}` },
          update: { value: u.value },
        }),
      ),
    )

    res.json({ success: true, message: 'SMTP configuration saved' })
  } catch (error) {
    console.error('PUT /config/smtp error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /config/smtp/test — send test email to the current admin user
router.post('/smtp/test', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, displayName: true },
    })

    const { testEmail } = req.body as { testEmail?: string }
    const recipient = testEmail || user?.email

    if (!recipient) {
      res.status(400).json({
        success: false,
        message: 'No recipient email. Provide testEmail in request body or set email on your account.',
      })
      return
    }

    await sendEmail(
      recipient,
      'MOE SERPS — SMTP Test Email',
      `Hi ${user?.displayName ?? 'Admin'},\n\nThis is a test email from MOE SERPS to verify your SMTP configuration is working correctly.\n\nTimestamp: ${new Date().toISOString()}`,
    )

    res.json({ success: true, message: `Test email sent to ${recipient}` })
  } catch (error) {
    console.error('POST /config/smtp/test error:', error)
    res.status(500).json({ success: false, message: `Email send failed: ${(error as Error).message}` })
  }
})

export default router
