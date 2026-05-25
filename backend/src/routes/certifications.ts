import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET /certifications — list certifications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const { teacherId } = req.query

    if (!['admin', 'manager', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const where: any = {}

    // Teacher can only see own certifications
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Teacher profile not found' })
        return
      }
      where.teacherId = teacher.id
    } else if (teacherId) {
      where.teacherId = teacherId as string
    }

    const certifications = await prisma.certification.findMany({
      where,
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: certifications })
  } catch (error) {
    console.error('Error listing certifications:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /certifications — create certification
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (!['admin', 'manager', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const { teacherId, name, issuedBy, issuedDate, expiryDate, status, documentUrl } = req.body

    if (!name) {
      res.status(400).json({ success: false, message: 'Certification name is required' })
      return
    }

    let resolvedTeacherId = teacherId

    // Teacher can only create for themselves
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Teacher profile not found' })
        return
      }
      resolvedTeacherId = teacher.id
    }

    if (!resolvedTeacherId) {
      res.status(400).json({ success: false, message: 'teacherId is required' })
      return
    }

    // Verify teacher exists
    const teacher = await prisma.teacher.findUnique({ where: { id: resolvedTeacherId } })
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found' })
      return
    }

    const certification = await prisma.certification.create({
      data: {
        teacherId: resolvedTeacherId,
        name,
        issuedBy,
        issuedDate: issuedDate ? new Date(issuedDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        status: status ?? 'active',
        documentUrl,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
    })

    res.status(201).json({ success: true, data: certification })
  } catch (error) {
    console.error('Error creating certification:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
