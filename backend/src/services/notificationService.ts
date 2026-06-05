import prisma from '../lib/prisma'
import { sendEmail } from './emailService'

interface NotifyOptions {
  userId: string
  title: string
  message: string
  type?: 'info' | 'warning' | 'success' | 'error'
  link?: string
}

export async function send(opts: NotifyOptions): Promise<void> {
  const { userId, title, message, type = 'info', link } = opts

  // 1. Write notification to DB (synchronous — we want this to persist)
  await (prisma.notification.create as any)({
    data: { userId, title, message, type, ...(link ? { link } : {}) },
  })

  // 2. Fire-and-forget email — look up user's email
  prisma.user
    .findUnique({ where: { id: userId }, select: { email: true } })
    .then(user => {
      if (user?.email) {
        return sendEmail(user.email, title, message)
      }
    })
    .catch(err => {
      console.error('[notificationService] Email send failed:', err)
    })
}

// Convenience: notify multiple users at once
export async function sendMany(userIds: string[], opts: Omit<NotifyOptions, 'userId'>): Promise<void> {
  await Promise.all(userIds.map(userId => send({ userId, ...opts })))
}
