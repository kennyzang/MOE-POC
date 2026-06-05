import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

const SEN_ROLES = ['admin', 'manager', 'principal', 'hod', 'counselor'] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Enrich session logs with conductor display names */
async function enrichSessions(logs: { id: string; senStudentId: string; date: Date; durationMins: number; conductedBy: string; notes: string; createdAt: Date }[]) {
  const userIds = [...new Set(logs.map(l => l.conductedBy))]
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } })
    : []
  const nameMap = new Map(users.map(u => [u.id, u.displayName]))
  return logs.map(l => ({ ...l, conductedByName: nameMap.get(l.conductedBy) ?? l.conductedBy }))
}

// ─── SEN Student Endpoints ────────────────────────────────────────────────────

// GET /sen/students — list SEN students with goal/session counts
router.get('/students', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { diagnosisType, supportLevel } = req.query as { diagnosisType?: string; supportLevel?: string }
    const schoolId = req.user!.schoolId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentWhere: any = {}
    if (schoolId) studentWhere.schoolId = schoolId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { student: studentWhere }
    if (diagnosisType) where.diagnosisType = diagnosisType
    if (supportLevel) where.supportLevel = supportLevel

    const records = await prisma.senStudent.findMany({
      where,
      include: {
        student: {
          select: {
            studentId: true,
            gradeLevel: true,
            className: true,
            user: { select: { displayName: true, avatar: true } },
          },
        },
        _count: { select: { goals: true, sessionLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const data = records.map(r => ({
      id: r.id,
      studentId: r.studentId,
      diagnosisType: r.diagnosisType,
      supportLevel: r.supportLevel,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      studentName: r.student.user.displayName,
      studentCode: r.student.studentId,
      gradeLevel: r.student.gradeLevel,
      className: r.student.className,
      avatar: r.student.user.avatar,
      goalCount: r._count.goals,
      sessionCount: r._count.sessionLogs,
    }))

    res.json({ success: true, data })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /sen/students/:id — full IEP profile
router.get('/students/:id', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const record = await prisma.senStudent.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            studentId: true,
            gradeLevel: true,
            className: true,
            user: { select: { displayName: true, avatar: true } },
          },
        },
        goals: { orderBy: { targetDate: 'asc' } },
        sessionLogs: { orderBy: { date: 'desc' } },
      },
    })
    if (!record) { res.status(404).json({ success: false, message: 'SEN record not found' }); return }

    const enrichedSessions = await enrichSessions(record.sessionLogs)

    res.json({
      success: true,
      data: {
        ...record,
        studentName: record.student.user.displayName,
        studentCode: record.student.studentId,
        gradeLevel: record.student.gradeLevel,
        className: record.student.className,
        avatar: record.student.user.avatar,
        sessionLogs: enrichedSessions,
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /sen/students — register SEN student
router.post('/students', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, diagnosisType, supportLevel, notes } = req.body

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

    const existing = await prisma.senStudent.findUnique({ where: { studentId } })
    if (existing) {
      res.status(409).json({ success: false, message: 'This student already has a SEN record' })
      return
    }

    const record = await prisma.senStudent.create({
      data: { studentId, diagnosisType, supportLevel: supportLevel ?? 'LEVEL_1', notes },
    })
    res.status(201).json({ success: true, data: record })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PUT /sen/students/:id — update diagnosis / support level / notes
router.put('/students/:id', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const existing = await prisma.senStudent.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'SEN record not found' }); return }

    const { diagnosisType, supportLevel, notes } = req.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (diagnosisType !== undefined) data.diagnosisType = diagnosisType
    if (supportLevel !== undefined) data.supportLevel = supportLevel
    if (notes !== undefined) data.notes = notes

    const updated = await prisma.senStudent.update({ where: { id }, data })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /sen/students/:id — remove SEN record (cascade goals + sessions, keeps Student)
router.delete('/students/:id', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const existing = await prisma.senStudent.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'SEN record not found' }); return }

    await prisma.iepSessionLog.deleteMany({ where: { senStudentId: id } })
    await prisma.iepGoal.deleteMany({ where: { senStudentId: id } })
    await prisma.senStudent.delete({ where: { id } })
    res.json({ success: true, message: 'SEN registration removed' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── IEP Goal Endpoints ───────────────────────────────────────────────────────

// GET /sen/students/:id/goals
router.get('/students/:id/goals', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const senStudentId = req.params['id'] as string
    const record = await prisma.senStudent.findUnique({ where: { id: senStudentId } })
    if (!record) { res.status(404).json({ success: false, message: 'SEN record not found' }); return }

    const goals = await prisma.iepGoal.findMany({
      where: { senStudentId },
      orderBy: { targetDate: 'asc' },
    })
    res.json({ success: true, data: goals })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /sen/students/:id/goals
router.post('/students/:id/goals', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const senStudentId = req.params['id'] as string
    const record = await prisma.senStudent.findUnique({ where: { id: senStudentId } })
    if (!record) { res.status(404).json({ success: false, message: 'SEN record not found' }); return }

    const { subject, description, targetDate, status } = req.body
    const goal = await prisma.iepGoal.create({
      data: {
        senStudentId,
        subject,
        description,
        targetDate: new Date(targetDate),
        status: status ?? 'active',
      },
    })
    res.status(201).json({ success: true, data: goal })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PUT /sen/goals/:goalId — update any field
router.put('/goals/:goalId', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const goalId = req.params['goalId'] as string
    const existing = await prisma.iepGoal.findUnique({ where: { id: goalId } })
    if (!existing) { res.status(404).json({ success: false, message: 'Goal not found' }); return }

    const { subject, description, targetDate, status } = req.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (subject !== undefined) data.subject = subject
    if (description !== undefined) data.description = description
    if (targetDate !== undefined) data.targetDate = new Date(targetDate)
    if (status !== undefined) data.status = status

    const updated = await prisma.iepGoal.update({ where: { id: goalId }, data })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /sen/goals/:goalId
router.delete('/goals/:goalId', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const goalId = req.params['goalId'] as string
    const existing = await prisma.iepGoal.findUnique({ where: { id: goalId } })
    if (!existing) { res.status(404).json({ success: false, message: 'Goal not found' }); return }

    await prisma.iepGoal.delete({ where: { id: goalId } })
    res.json({ success: true, message: 'Goal deleted' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Session Log Endpoints ────────────────────────────────────────────────────

// POST /sen/students/:id/sessions
router.post('/students/:id/sessions', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const senStudentId = req.params['id'] as string
    const record = await prisma.senStudent.findUnique({ where: { id: senStudentId } })
    if (!record) { res.status(404).json({ success: false, message: 'SEN record not found' }); return }

    const { date, durationMins, conductedBy, notes } = req.body
    const session = await prisma.iepSessionLog.create({
      data: {
        senStudentId,
        date: new Date(date),
        durationMins: parseInt(durationMins),
        conductedBy: conductedBy ?? req.user!.userId,
        notes,
      },
    })
    res.status(201).json({ success: true, data: session })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /sen/sessions/:sessionId
router.delete('/sessions/:sessionId', authenticate, requireRole(...SEN_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params['sessionId'] as string
    const existing = await prisma.iepSessionLog.findUnique({ where: { id: sessionId } })
    if (!existing) { res.status(404).json({ success: false, message: 'Session log not found' }); return }

    await prisma.iepSessionLog.delete({ where: { id: sessionId } })
    res.json({ success: true, message: 'Session log deleted' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
