import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET / — list notifications for current user (newest first, max 50)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ success: true, data: notifications })
  } catch (error) {
    console.error('GET /notifications error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /unread-count — returns { count: number }
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, read: false },
    })
    res.json({ success: true, data: { count } })
  } catch (error) {
    console.error('GET /notifications/unread-count error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /read-all — mark all notifications as read for current user
// Must be before /:id/read to avoid route conflict
router.patch('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, read: false },
      data: { read: true },
    })
    res.json({ success: true })
  } catch (error) {
    console.error('PATCH /notifications/read-all error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /:id/read — mark single notification as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = await prisma.notification.findUnique({ where: { id } })
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ success: false, message: 'Notification not found' })
      return
    }
    const updated = await prisma.notification.update({ where: { id }, data: { read: true } })
    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /notifications/:id/read error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
