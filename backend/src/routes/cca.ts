import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET /cca — list all activities
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string }
    const activities = await prisma.ccaActivity.findMany({
      where: status ? { status } : { status: 'active' },
      include: {
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: 'asc' },
    })

    // Attach teacher name if teacherInChargeId is set
    const teacherIds = activities.map((a) => a.teacherInChargeId).filter((id): id is string => !!id)
    const teachers = teacherIds.length
      ? await prisma.teacher.findMany({
          where: { id: { in: teacherIds } },
          include: { user: { select: { displayName: true } } },
        })
      : []
    const teacherMap = new Map(teachers.map((t) => [t.id, t.user.displayName]))

    const data = activities.map((a) => ({
      ...a,
      enrolled: a._count.enrollments,
      teacherName: a.teacherInChargeId ? (teacherMap.get(a.teacherInChargeId) ?? null) : null,
    }))

    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /cca — create activity
router.post('/', authenticate, requireRole('admin', 'manager', 'teacher', 'hod', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, description, schedule, venue, capacity, teacherInChargeId } = req.body as {
      name: string; category: string; description?: string; schedule?: string
      venue?: string; capacity?: number; teacherInChargeId?: string
    }
    const activity = await prisma.ccaActivity.create({
      data: { name, category, description, schedule, venue, capacity: capacity ?? 30, teacherInChargeId },
    })
    res.status(201).json({ success: true, data: activity })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /cca/:id
router.patch('/:id', authenticate, requireRole('admin', 'manager', 'teacher', 'hod', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await prisma.ccaActivity.update({ where: { id }, data: req.body as any })
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /cca/:id/members — enrolled students
router.get('/:id/members', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ccaId = req.params['id'] as string
    const enrollments = await prisma.ccaEnrollment.findMany({
      where: { ccaId, status: 'active' },
      include: { student: { include: { user: { select: { displayName: true } } } } },
    })
    res.json({ success: true, data: enrollments })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /cca/:id/enroll — student self-enroll or admin-enroll
router.post('/:id/enroll', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ccaId = req.params['id'] as string
    const role = req.user!.role
    let studentId: string

    if (role === 'student') {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
      if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }
      studentId = student.id
    } else {
      studentId = (req.body as { studentId: string }).studentId
    }

    const activity = await prisma.ccaActivity.findUnique({ where: { id: ccaId } })
    if (!activity) { res.status(404).json({ success: false, message: 'Activity not found' }); return }
    const count = await prisma.ccaEnrollment.count({ where: { ccaId, status: 'active' } })
    if (count >= activity.capacity) {
      res.status(400).json({ success: false, message: 'Activity is at full capacity' }); return
    }

    const enrollment = await prisma.ccaEnrollment.upsert({
      where: { ccaId_studentId: { ccaId, studentId } },
      create: { ccaId, studentId, status: 'active' },
      update: { status: 'active' },
    })
    res.status(201).json({ success: true, data: enrollment })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /cca/:id/enroll/:studentId — withdraw
router.delete('/:id/enroll/:studentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ccaId = req.params['id'] as string
    const studentId = req.params['studentId'] as string
    await prisma.ccaEnrollment.update({
      where: { ccaId_studentId: { ccaId, studentId } },
      data: { status: 'withdrawn' },
    })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /cca/:id/sessions — create session + mark attendance
router.post('/:id/sessions', authenticate, requireRole('teacher', 'hod', 'admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const ccaId = req.params['id'] as string
    const { date, notes, attendances } = req.body as {
      date: string; notes?: string
      attendances: Array<{ studentId: string; status: string }>
    }

    const session = await prisma.ccaSession.create({
      data: {
        ccaId,
        date: new Date(date),
        notes,
        attendances: {
          create: attendances.map((a) => ({ studentId: a.studentId, status: a.status })),
        },
      },
      include: { attendances: true },
    })
    res.status(201).json({ success: true, data: session })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /cca/student/me — student's CCA enrollments
router.get('/student/me', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
    if (!student) { res.json({ success: true, data: [] }); return }

    const enrollments = await prisma.ccaEnrollment.findMany({
      where: { studentId: student.id, status: 'active' },
      include: { cca: true },
    })
    res.json({ success: true, data: enrollments })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
