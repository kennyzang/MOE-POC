import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET / — list admissions
router.get(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, search } = req.query as { status?: string; search?: string }

      const where: any = {}
      if (status) where.status = status
      if (search) {
        where.OR = [
          { applicantName: { contains: search } },
          { parentName: { contains: search } },
          { gradeApplied: { contains: search } },
        ]
      }

      const admissions = await prisma.admission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })

      res.json({ success: true, data: admissions })
    } catch (error) {
      console.error('GET /admissions error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /:id — get single admission
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const admission = await prisma.admission.findUnique({ where: { id: req.params.id as string } })
      if (!admission) {
        res.status(404).json({ success: false, message: 'Admission not found' })
        return
      }
      res.json({ success: true, data: admission })
    } catch (error) {
      console.error('GET /admissions/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// PATCH /:id — update admission (status transitions)
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { status, remarks } = req.body

      const existing = await prisma.admission.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, message: 'Admission not found' })
        return
      }

      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        pending: ['under_review'],
        under_review: ['accepted', 'rejected'],
      }

      if (status && status !== existing.status) {
        const allowed = validTransitions[existing.status]
        if (!allowed || !allowed.includes(status)) {
          res.status(400).json({
            success: false,
            message: `Cannot transition from '${existing.status}' to '${status}'`,
          })
          return
        }
      }

      const updateData: any = {}
      if (status) updateData.status = status
      if (remarks !== undefined) updateData.remarks = remarks
      if (status === 'accepted' || status === 'rejected') {
        updateData.decidedAt = new Date()
      }

      const admission = await prisma.admission.update({
        where: { id },
        data: updateData,
      })

      res.json({ success: true, data: admission })
    } catch (error) {
      console.error('PATCH /admissions/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
