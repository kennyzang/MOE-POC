import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

const VALID_CATEGORIES = ['EXCELLENCE', 'SERVICE', 'INNOVATION', 'LEADERSHIP', 'COMMUNITY', 'OTHER']
const VALID_COLORS     = ['gold', 'silver', 'bronze', 'blue', 'green', 'purple']

// ─── GET / — list awards ──────────────────────────────────────────
// Admin/manager/principal → all awards (optionally filtered by dept)
// HOD → own department
// Teacher → own awards only (use /my-awards instead)

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    let teacherFilter: object = {}

    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } })
      if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }
      teacherFilter = { teacherId: teacher.id }
    } else if (role === 'hod') {
      const hodTeacher = await prisma.teacher.findUnique({ where: { userId }, select: { department: true } })
      teacherFilter = { teacher: { department: hodTeacher?.department ?? undefined } }
    } else if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const { category, teacherId: filterTeacherId } = req.query as Record<string, string | undefined>
    const where = {
      ...teacherFilter,
      ...(filterTeacherId ? { teacherId: filterTeacherId } : {}),
      ...(category ? { category } : {}),
    }

    const awards = await prisma.award.findMany({
      where,
      include: {
        teacher: { include: { user: { select: { displayName: true } } } },
      },
      orderBy: { awardedDate: 'desc' },
    })

    const formatted = awards.map(a => ({
      id: a.id,
      teacherId: a.teacherId,
      teacherName: a.teacher.user?.displayName ?? 'Unknown',
      department: a.teacher.department,
      title: a.title,
      category: a.category,
      description: a.description,
      awardedDate: a.awardedDate,
      awardedBy: a.awardedBy,
      badgeColor: a.badgeColor,
      createdAt: a.createdAt,
    }))

    res.json({ success: true, data: formatted })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /teacher/:teacherId ──────────────────────────────────────

router.get('/teacher/:teacherId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    const { teacherId } = req.params as { teacherId: string }
    const awards = await prisma.award.findMany({
      where: { teacherId },
      orderBy: { awardedDate: 'desc' },
    })
    res.json({ success: true, data: awards })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /my-awards ───────────────────────────────────────────────

router.get('/my-awards', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

    const awards = await prisma.award.findMany({
      where: { teacherId: teacher.id },
      orderBy: { awardedDate: 'desc' },
    })
    res.json({ success: true, data: awards })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /stats ───────────────────────────────────────────────────

router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const total = await prisma.award.count()
    const byCategory = await prisma.award.groupBy({
      by: ['category'],
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
    })
    const thisYear = await prisma.award.count({
      where: { awardedDate: { gte: new Date(new Date().getFullYear(), 0, 1) } },
    })

    // Top 5 recipients
    const topRecipients = await prisma.award.groupBy({
      by: ['teacherId'],
      _count: { teacherId: true },
      orderBy: { _count: { teacherId: 'desc' } },
      take: 5,
    })
    const teacherIds = topRecipients.map(r => r.teacherId)
    const teacherNames = await prisma.teacher.findMany({
      where: { id: { in: teacherIds } },
      include: { user: { select: { displayName: true } } },
    })
    const nameMap = Object.fromEntries(teacherNames.map(t => [t.id, t.user?.displayName ?? 'Unknown']))
    const top = topRecipients.map(r => ({ teacherId: r.teacherId, teacherName: nameMap[r.teacherId], count: r._count.teacherId }))

    res.json({
      success: true,
      data: {
        total,
        thisYear,
        byCategory: byCategory.map(c => ({ category: c.category, count: c._count.category })),
        topRecipients: top,
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST / — create award ────────────────────────────────────────

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const { teacherId, title, category, description, awardedDate, awardedBy, badgeColor } = req.body as {
      teacherId: string; title: string; category?: string; description?: string
      awardedDate: string; awardedBy?: string; badgeColor?: string
    }

    if (!teacherId || !title || !awardedDate) {
      res.status(400).json({ success: false, message: 'teacherId, title and awardedDate are required' }); return
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ success: false, message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }); return
    }
    if (badgeColor && !VALID_COLORS.includes(badgeColor)) {
      res.status(400).json({ success: false, message: `badgeColor must be one of: ${VALID_COLORS.join(', ')}` }); return
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return }

    const award = await prisma.award.create({
      data: {
        teacherId,
        title,
        category: category ?? 'EXCELLENCE',
        description: description ?? null,
        awardedDate: new Date(awardedDate),
        awardedBy: awardedBy ?? null,
        badgeColor: badgeColor ?? 'gold',
      },
    })

    res.status(201).json({ success: true, data: award })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── PUT /:id — edit award ────────────────────────────────────────

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    const { id } = req.params as { id: string }
    const { title, category, description, awardedDate, awardedBy, badgeColor } = req.body as {
      title?: string; category?: string; description?: string
      awardedDate?: string; awardedBy?: string; badgeColor?: string
    }

    const existing = await prisma.award.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Award not found' }); return }

    const updated = await prisma.award.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(category ? { category } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(awardedDate ? { awardedDate: new Date(awardedDate) } : {}),
        ...(awardedBy !== undefined ? { awardedBy } : {}),
        ...(badgeColor ? { badgeColor } : {}),
      },
    })

    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── DELETE /:id ──────────────────────────────────────────────────

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    const { id } = req.params as { id: string }
    const existing = await prisma.award.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Award not found' }); return }
    await prisma.award.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
