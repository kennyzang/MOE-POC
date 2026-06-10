import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'

const router = Router()

// GET /messages/unread-count
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const threads = await prisma.messageThread.findMany({
      where: {
        OR: [{ parentUserId: userId }, { teacherUserId: userId }],
      },
      include: {
        messages: {
          where: { senderId: { not: userId }, readAt: null },
        },
      },
    })
    const count = threads.reduce((s, t) => s + t.messages.length, 0)
    res.json({ success: true, data: { count } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /messages/threads — list threads for current user
router.get('/threads', authenticate, requireRole('parent', 'teacher', 'hod', 'admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const threads = await prisma.messageThread.findMany({
      where: {
        OR: [{ parentUserId: userId }, { teacherUserId: userId }],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { displayName: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Enrich with participant names
    const allUserIds = [...new Set([
      ...threads.map((t) => t.parentUserId),
      ...threads.map((t) => t.teacherUserId),
    ])]
    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, displayName: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u.displayName]))

    const unreadCounts = await Promise.all(
      threads.map((t) =>
        prisma.directMessage.count({
          where: { threadId: t.id, senderId: { not: userId }, readAt: null },
        })
      )
    )

    const data = threads.map((t, i) => ({
      ...t,
      parentName: userMap.get(t.parentUserId) ?? 'Parent',
      teacherName: userMap.get(t.teacherUserId) ?? 'Teacher',
      unreadCount: unreadCounts[i],
    }))

    res.json({ success: true, data })
  } catch (error) {
    console.error('GET /messages/threads error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /messages/threads — start a new thread (parent initiates)
router.post('/threads', authenticate, requireRole('parent', 'admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { teacherUserId, studentId, subject, firstMessage } = req.body as {
      teacherUserId: string; studentId?: string; subject: string; firstMessage: string
    }

    const thread = await prisma.messageThread.create({
      data: {
        subject,
        parentUserId: req.user!.userId,
        teacherUserId,
        studentId: studentId ?? null,
        messages: {
          create: {
            senderId: req.user!.userId,
            content: firstMessage,
          },
        },
      },
    })

    // Notify teacher
    const parent = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { displayName: true } })
    await send({
      userId: teacherUserId,
      title: 'New Message',
      message: `${parent?.displayName ?? 'A parent'} sent you a message: "${subject}"`,
      type: 'info',
      link: '/teacher/messages',
    })

    res.status(201).json({ success: true, data: thread })
  } catch (error) {
    console.error('POST /messages/threads error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /messages/threads/:id — get thread with all messages
router.get('/threads/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const id = req.params['id'] as string
    const thread = await prisma.messageThread.findUnique({
      where: { id },
      include: {
        messages: {
          include: { sender: { select: { id: true, displayName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!thread) { res.status(404).json({ success: false, message: 'Thread not found' }); return }

    // Verify access
    if (thread.parentUserId !== userId && thread.teacherUserId !== userId &&
      !['admin', 'manager', 'principal'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Access denied' }); return
    }

    // Mark messages from other party as read
    await prisma.directMessage.updateMany({
      where: { threadId: thread.id, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    })

    // Enrich with participant names
    const participants = await prisma.user.findMany({
      where: { id: { in: [thread.parentUserId, thread.teacherUserId] } },
      select: { id: true, displayName: true },
    })
    const nameMap = new Map(participants.map((u) => [u.id, u.displayName]))

    res.json({
      success: true,
      data: {
        ...thread,
        parentName: nameMap.get(thread.parentUserId) ?? 'Parent',
        teacherName: nameMap.get(thread.teacherUserId) ?? 'Teacher',
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /messages/threads/:id/reply — send a reply
router.post('/threads/:id/reply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const { content } = req.body as { content: string }

    const threadId = req.params['id'] as string
    const thread = await prisma.messageThread.findUnique({ where: { id: threadId } })
    if (!thread) { res.status(404).json({ success: false, message: 'Thread not found' }); return }
    if (thread.parentUserId !== userId && thread.teacherUserId !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' }); return
    }

    const [msg] = await prisma.$transaction([
      prisma.directMessage.create({
        data: { threadId: thread.id, senderId: userId, content },
        include: { sender: { select: { id: true, displayName: true, role: true } } },
      }),
      prisma.messageThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      }),
    ])

    // Notify the other party
    const otherUserId = thread.parentUserId === userId ? thread.teacherUserId : thread.parentUserId
    const sender = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } })
    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { role: true } })
    const messageLink = otherUser?.role === 'teacher' ? '/teacher/messages' : '/parent/messages'
    await send({
      userId: otherUserId,
      title: 'New Reply',
      message: `${sender?.displayName ?? 'Someone'} replied: "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"`,
      type: 'info',
      link: messageLink,
    })

    res.status(201).json({ success: true, data: msg })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /messages/threads/:id — delete a thread and all its messages
router.delete('/threads/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const id = req.params['id'] as string
    const thread = await prisma.messageThread.findUnique({ where: { id } })
    if (!thread) { res.status(404).json({ success: false, message: 'Thread not found' }); return }

    // Only participants or admins can delete
    if (thread.parentUserId !== userId && thread.teacherUserId !== userId &&
      !['admin', 'manager'].includes(req.user!.role)) {
      res.status(403).json({ success: false, message: 'Access denied' }); return
    }

    await prisma.directMessage.deleteMany({ where: { threadId: id } })
    await prisma.messageThread.delete({ where: { id } })
    res.json({ success: true, message: 'Thread deleted' })
  } catch (error) {
    console.error('DELETE /messages/threads/:id error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
