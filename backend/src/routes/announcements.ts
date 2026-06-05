import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()


// GET /announcements — role-filtered
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role
    const userId = req.user!.userId

    let gradeLevel: string | null = null

    if (role === 'student') {
      const student = await prisma.student.findUnique({ where: { userId }, select: { gradeLevel: true } })
      gradeLevel = student?.gradeLevel ?? null
    } else if (role === 'parent') {
      // Get grade levels of all children
      const parent = await prisma.parent.findUnique({
        where: { userId },
        include: { childLinks: { include: { student: { select: { gradeLevel: true } } } } },
      })
      const levels = parent?.childLinks.map((l) => l.student.gradeLevel).filter(Boolean) ?? []
      gradeLevel = levels[0] ?? null
    }

    const now = new Date()
    const audienceValues: string[] = ['all']
    if (role === 'student') audienceValues.push('students')
    if (role === 'parent') audienceValues.push('parents')
    if (role === 'teacher' || role === 'hod') audienceValues.push('teachers')
    if (gradeLevel) {
      audienceValues.push(gradeLevel)
      audienceValues.push(`grade:${gradeLevel}`)
    }

    const announcements = await prisma.announcement.findMany({
      where: {
        publishedAt: { lte: now },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
        targetAudience: { in: audienceValues },
      },
      include: { author: { select: { displayName: true, role: true } } },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 100,
    })

    res.json({ success: true, data: announcements })
  } catch (error) {
    console.error('GET /announcements error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /announcements — create (staff roles)
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'hod', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, content, targetAudience, gradeLevel, priority, isPinned, publishedAt, expiresAt } =
        req.body as {
          title: string; content: string; targetAudience?: string; gradeLevel?: string
          priority?: string; isPinned?: boolean; publishedAt?: string; expiresAt?: string
        }

      const announcement = await prisma.announcement.create({
        data: {
          title,
          content,
          authorId: req.user!.userId,
          targetAudience: targetAudience ?? 'all',
          gradeLevel: gradeLevel ?? null,
          priority: priority ?? 'normal',
          isPinned: isPinned ?? false,
          publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        include: { author: { select: { displayName: true, role: true } } },
      })

      res.status(201).json({ success: true, data: announcement })
    } catch (error) {
      console.error('POST /announcements error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// PATCH /announcements/:id — update
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'hod', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params['id'] as string
      const { title, content, targetAudience, gradeLevel, priority, isPinned, expiresAt } =
        req.body as Record<string, unknown>

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {}
      if (title) data.title = String(title)
      if (content) data.content = String(content)
      if (targetAudience) data.targetAudience = String(targetAudience)
      if (gradeLevel !== undefined) data.gradeLevel = gradeLevel ? String(gradeLevel) : null
      if (priority) data.priority = String(priority)
      if (isPinned !== undefined) data.isPinned = Boolean(isPinned)
      if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(String(expiresAt)) : null

      const updated = await prisma.announcement.update({ where: { id }, data })
      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// DELETE /announcements/:id
router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'hod', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.announcement.delete({ where: { id: req.params['id'] as string } })
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

export default router
