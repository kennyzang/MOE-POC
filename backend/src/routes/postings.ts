import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// ─── GET /teacher/:teacherId ──────────────────────────────────────

router.get('/teacher/:teacherId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    const { teacherId } = req.params as { teacherId: string }
    const postings = await prisma.postingRecord.findMany({
      where: { teacherId },
      orderBy: { startDate: 'desc' },
    })
    res.json({ success: true, data: postings })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /my-history ─────────────────────────────────────────────

router.get('/my-history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

    const postings = await prisma.postingRecord.findMany({
      where: { teacherId: teacher.id },
      orderBy: { startDate: 'desc' },
    })
    res.json({ success: true, data: postings })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST / — create posting record ──────────────────────────────

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const { teacherId, schoolName, position, department, startDate, endDate, isCurrent, notes } = req.body as {
      teacherId: string; schoolName: string; position: string; department?: string
      startDate: string; endDate?: string; isCurrent?: boolean; notes?: string
    }

    if (!teacherId || !schoolName || !position || !startDate) {
      res.status(400).json({ success: false, message: 'teacherId, schoolName, position and startDate are required' }); return
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return }

    // If isCurrent, clear previous current
    if (isCurrent) {
      await prisma.postingRecord.updateMany({
        where: { teacherId, isCurrent: true },
        data: { isCurrent: false },
      })
    }

    const posting = await prisma.postingRecord.create({
      data: {
        teacherId,
        schoolName,
        position,
        department: department ?? null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isCurrent: isCurrent ?? false,
        notes: notes ?? null,
      },
    })

    res.status(201).json({ success: true, data: posting })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── PUT /:id — edit posting ──────────────────────────────────────

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }
    const { id } = req.params as { id: string }
    const { schoolName, position, department, startDate, endDate, isCurrent, notes } = req.body as {
      schoolName?: string; position?: string; department?: string
      startDate?: string; endDate?: string; isCurrent?: boolean; notes?: string
    }

    const existing = await prisma.postingRecord.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Posting record not found' }); return }

    if (isCurrent) {
      await prisma.postingRecord.updateMany({
        where: { teacherId: existing.teacherId, isCurrent: true, id: { not: id } },
        data: { isCurrent: false },
      })
    }

    const updated = await prisma.postingRecord.update({
      where: { id },
      data: {
        ...(schoolName ? { schoolName } : {}),
        ...(position ? { position } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(isCurrent !== undefined ? { isCurrent } : {}),
        ...(notes !== undefined ? { notes } : {}),
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
    const existing = await prisma.postingRecord.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Posting record not found' }); return }
    await prisma.postingRecord.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
