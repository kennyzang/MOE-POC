import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { sendMany } from '../services/notificationService'

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

// POST / — create new admission
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        applicantName,
        dateOfBirth,
        gender,
        icNumber,
        nationality,
        parentName,
        parentPhone,
        parentEmail,
        parentRelationship,
        gradeApplied,
        previousSchool,
      } = req.body

      if (!applicantName || !gradeApplied) {
        res.status(400).json({ success: false, message: 'applicantName and gradeApplied are required' })
        return
      }

      const admission = await prisma.admission.create({
        data: {
          applicantName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          gender,
          icNumber,
          nationality,
          parentName,
          parentPhone,
          parentEmail,
          gradeApplied,
          previousSchool,
          status: 'pending',
          submittedAt: new Date(),
        },
      })

      res.status(201).json({ success: true, data: admission })
    } catch (error) {
      console.error('POST /admissions error:', error)
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

// PATCH /:id/status — dedicated status update endpoint
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { status, remarks } = req.body

      const validStatuses = ['under_review', 'accepted', 'rejected']
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` })
        return
      }

      const existing = await prisma.admission.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, message: 'Admission not found' })
        return
      }

      const validTransitions: Record<string, string[]> = {
        pending: ['under_review'],
        under_review: ['accepted', 'rejected'],
      }

      const allowed = validTransitions[existing.status]
      if (!allowed || !allowed.includes(status)) {
        res.status(400).json({
          success: false,
          message: `Cannot transition from '${existing.status}' to '${status}'`,
        })
        return
      }

      const updateData: any = { status }
      if (remarks !== undefined) updateData.remarks = remarks
      if (status === 'accepted' || status === 'rejected') {
        updateData.decidedAt = new Date()
      }

      const admission = await prisma.admission.update({
        where: { id },
        data: updateData,
      })

      // Notify all managers
      const managers = await prisma.user.findMany({
        where: { role: 'manager' },
        select: { id: true },
      })
      await sendMany(
        managers.map(m => m.id),
        {
          title: 'Admission Status Updated',
          message: `Application for ${admission.applicantName} changed to "${admission.status}".`,
          type: 'info',
        },
      )

      res.json({ success: true, data: admission })
    } catch (error) {
      console.error('PATCH /admissions/:id/status error:', error)
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
