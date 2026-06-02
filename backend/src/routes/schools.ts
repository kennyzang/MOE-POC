import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET /schools — list all schools (system admin sees all; others see their own)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schools = req.user?.systemAdmin
      ? await prisma.school.findMany({ orderBy: { name: 'asc' } })
      : req.user?.schoolId
        ? await prisma.school.findMany({ where: { id: req.user.schoolId } })
        : []

    const withCounts = await Promise.all(
      schools.map(async (s) => {
        const [studentCount, teacherCount] = await Promise.all([
          prisma.student.count({ where: { schoolId: s.id, enrollmentStatus: 'enrolled' } }),
          prisma.teacher.count({ where: { schoolId: s.id } }),
        ])
        return {
          ...s,
          gradeLevels: JSON.parse(s.gradeLevels) as string[],
          programmes: JSON.parse(s.programmes) as string[],
          classLetters: JSON.parse(s.classLetters) as string[],
          studentCount,
          teacherCount,
        }
      })
    )
    res.json({ success: true, data: withCounts })
  } catch (error) {
    console.error('GET /schools error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /schools/mine — calling user's school config (used by frontend for dynamic grade levels)
router.get('/mine', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.schoolId) {
      res.json({ success: true, data: null })
      return
    }
    const school = await prisma.school.findUnique({ where: { id: req.user.schoolId } })
    if (!school) { res.status(404).json({ success: false, message: 'School not found' }); return }

    res.json({
      success: true,
      data: {
        ...school,
        gradeLevels: JSON.parse(school.gradeLevels) as string[],
        programmes: JSON.parse(school.programmes) as string[],
        classLetters: JSON.parse(school.classLetters) as string[],
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /schools/:id — get one school (system admin or member of that school)
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    if (!req.user?.systemAdmin && req.user?.schoolId !== id) {
      res.status(403).json({ success: false, message: 'Access denied' }); return
    }
    const school = await prisma.school.findUnique({ where: { id } })
    if (!school) { res.status(404).json({ success: false, message: 'School not found' }); return }
    res.json({
      success: true,
      data: {
        ...school,
        gradeLevels: JSON.parse(school.gradeLevels) as string[],
        programmes: JSON.parse(school.programmes) as string[],
        classLetters: JSON.parse(school.classLetters) as string[],
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /schools/:id/stats — headcount summary
router.get('/:id/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    if (!req.user?.systemAdmin && req.user?.schoolId !== id) {
      res.status(403).json({ success: false, message: 'Access denied' }); return
    }

    const [studentCount, teachingStaffCount, nonTeachingStaffCount, facilityCount] = await Promise.all([
      prisma.student.count({ where: { schoolId: id, enrollmentStatus: 'enrolled' } }),
      prisma.teacher.count({ where: { schoolId: id, staffType: 'TEACHING' } }),
      prisma.teacher.count({ where: { schoolId: id, staffType: { not: 'TEACHING' } } }),
      prisma.facility.count(),
    ])

    res.json({ success: true, data: { studentCount, teachingStaffCount, nonTeachingStaffCount, facilityCount } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PUT /schools/:id — update school info
router.put('/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    if (!req.user?.systemAdmin && req.user?.schoolId !== id) {
      res.status(403).json({ success: false, message: 'Access denied' }); return
    }

    const school = await prisma.school.findUnique({ where: { id } })
    if (!school) { res.status(404).json({ success: false, message: 'School not found' }); return }

    const { name, address, phone, principal, motto, schoolType } = req.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (name !== undefined) data.name = name
    if (address !== undefined) data.address = address
    if (phone !== undefined) data.phone = phone
    if (principal !== undefined) data.principal = principal
    if (motto !== undefined) data.motto = motto
    if (schoolType !== undefined) data.schoolType = schoolType

    const updated = await prisma.school.update({ where: { id }, data })
    res.json({
      success: true,
      data: {
        ...updated,
        gradeLevels: JSON.parse(updated.gradeLevels) as string[],
        programmes: JSON.parse(updated.programmes) as string[],
        classLetters: JSON.parse(updated.classLetters) as string[],
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
