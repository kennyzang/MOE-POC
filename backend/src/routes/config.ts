import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { sendEmail } from '../services/emailService'
import { invalidateConfig, invalidateAllConfig } from '../lib/config'
import { broadcast } from './events'

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

// ── Threshold config endpoints ─────────────────────────────────────────────

const THRESHOLD_KEYS = [
  'risk_threshold_high',
  'risk_threshold_monitor',
  'cpd_annual_target',
  'class_capacity_max',
  'class_capacity_warning',
  'absence_counselor_threshold',
  'absence_parent_threshold',
  'fee_hold_overdue_days',
  'academic_watch_threshold',
  'academic_probation_threshold',
] as const

const THRESHOLD_META: Record<string, { label: string; description: string; group: string; type: 'float' | 'int' }> = {
  risk_threshold_high:         { label: 'High Risk Threshold', description: 'Risk score ≥ this → HIGH_RISK band', group: 'Risk Detection', type: 'float' },
  risk_threshold_monitor:      { label: 'Monitor Threshold', description: 'Risk score ≥ this → MONITOR band', group: 'Risk Detection', type: 'float' },
  academic_watch_threshold:    { label: 'Academic Watch (grade %)', description: 'Grade avg below this → Academic Watch', group: 'Academic Standing', type: 'int' },
  academic_probation_threshold:{ label: 'Probation (grade %)', description: 'Grade avg below this → Probation', group: 'Academic Standing', type: 'int' },
  absence_counselor_threshold: { label: 'Counselor Case (absences)', description: 'Rolling 14-day absences to auto-open counselor case', group: 'Attendance', type: 'int' },
  absence_parent_threshold:    { label: 'Parent Alert (absences)', description: 'Absences in 14 days before parent notification', group: 'Attendance', type: 'int' },
  class_capacity_max:          { label: 'Max Class Size', description: 'Hard cap — blocks new enrolment if reached', group: 'Class Management', type: 'int' },
  class_capacity_warning:      { label: 'Capacity Warning (students)', description: 'Class shows amber badge at this count', group: 'Class Management', type: 'int' },
  fee_hold_overdue_days:       { label: 'Fee Hold After (days)', description: 'Days overdue before hold activates on student record', group: 'Finance', type: 'int' },
  cpd_annual_target:           { label: 'CPD Annual Target (hours)', description: 'Minimum CPD hours per teacher per academic year', group: 'CPD', type: 'int' },
}

// GET /config/thresholds — returns all operational thresholds (admin only)
router.get('/thresholds', authenticate, requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const records = await prisma.systemConfig.findMany({
      where: { key: { in: [...THRESHOLD_KEYS] } },
    })
    const map: Record<string, string> = {}
    for (const r of records) map[r.key] = r.value

    const data = THRESHOLD_KEYS.map(key => ({
      key,
      value: map[key] ?? '',
      ...THRESHOLD_META[key],
    }))

    res.json({ success: true, data })
  } catch (error) {
    console.error('GET /config/thresholds error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PUT /config/thresholds — batch upsert thresholds + invalidate cache
router.put('/thresholds', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { updates } = req.body as { updates: Array<{ key: string; value: string }> }
    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ success: false, message: 'updates array is required' }); return
    }

    const riskKeysChanged: string[] = []

    await Promise.all(
      updates
        .filter(u => THRESHOLD_KEYS.includes(u.key as any) && u.value !== '')
        .map(async u => {
          await prisma.systemConfig.upsert({
            where: { key: u.key },
            create: { key: u.key, value: u.value, description: THRESHOLD_META[u.key]?.description ?? u.key },
            update: { value: u.value },
          })
          invalidateConfig(u.key)
          if (u.key.startsWith('risk_threshold')) riskKeysChanged.push(u.key)
        }),
    )

    // If risk thresholds changed, re-evaluate HIGH_RISK students
    if (riskKeysChanged.length > 0) {
      const { recalcStudentRisk } = await import('./ai')
      const highRiskStudents = await prisma.riskScore.findMany({
        where: { band: { in: ['HIGH_RISK', 'MONITOR'] } },
        distinct: ['studentId'],
        select: { studentId: true },
      })
      // Fire-and-forget batch recalc
      Promise.all(
        highRiskStudents.map(s => recalcStudentRisk(s.studentId, 'THRESHOLD_CHANGED').catch(console.error)),
      ).then(() => {
        broadcast('dashboard', 'dashboard.risk.changed', {})
      })
    }

    broadcast('system', 'system.thresholds.changed', { updatedKeys: updates.map(u => u.key) })
    res.json({ success: true, message: `${updates.length} threshold(s) updated` })
  } catch (error) {
    console.error('PUT /config/thresholds error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
