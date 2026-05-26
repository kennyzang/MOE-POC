import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.office365.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false, // TLS via STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
  },
})

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[emailService] SMTP credentials not configured, skipping email')
    return
  }
  if (!to) {
    console.warn('[emailService] No recipient email address, skipping')
    return
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text,
  })
}
