import nodemailer from 'nodemailer'
import prisma from '../lib/prisma'

interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

async function getSmtpConfig(): Promise<SmtpConfig> {
  // DB config takes priority over .env
  const records = await prisma.systemConfig.findMany({
    where: { key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'] } },
  })
  const db: Record<string, string> = {}
  for (const r of records) db[r.key] = r.value

  return {
    host: db.smtp_host || process.env.SMTP_HOST || 'smtp.office365.com',
    port: Number(db.smtp_port || process.env.SMTP_PORT || 587),
    user: db.smtp_user || process.env.SMTP_USER || '',
    pass: db.smtp_pass || process.env.SMTP_PASS || '',
    from: db.smtp_from || process.env.SMTP_FROM || db.smtp_user || process.env.SMTP_USER || '',
  }
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!to) {
    console.warn('[emailService] No recipient email address, skipping')
    return
  }

  const cfg = await getSmtpConfig()

  if (!cfg.user || !cfg.pass) {
    console.warn('[emailService] SMTP credentials not configured (DB or .env), skipping email')
    return
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: false, // STARTTLS on port 587
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { minVersion: 'TLSv1.2' },
  })

  await transporter.sendMail({
    from: cfg.from || cfg.user,
    to,
    subject,
    text,
  })
}
