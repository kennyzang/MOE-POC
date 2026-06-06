import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET /facilities — list facilities
router.get(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'hod', 'principal', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { type, status } = req.query

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {}
      if (type) where.type = type as string
      if (status) where.status = status as string

      const facilities = await prisma.facility.findMany({
        where,
        orderBy: { name: 'asc' },
      })

      res.json({ success: true, data: facilities })
    } catch (error) {
      console.error('Error listing facilities:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// PATCH /facilities/:id — update facility status
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { status, name, type, capacity, location } = req.body

      const existing = await prisma.facility.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, message: 'Facility not found' })
        return
      }

      const data: any = {}
      if (status !== undefined) data.status = status
      if (name !== undefined) data.name = name
      if (type !== undefined) data.type = type
      if (capacity !== undefined) data.capacity = capacity
      if (location !== undefined) data.location = location

      const facility = await prisma.facility.update({
        where: { id },
        data,
      })

      res.json({ success: true, data: facility })
    } catch (error) {
      console.error('Error updating facility:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

export default router
