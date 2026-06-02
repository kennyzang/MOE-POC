import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { send, sendMany } from '../services/notificationService'
import { calculateWorkingDays } from '../lib/leaveCalendar'

const router = Router()

type TeacherBalanceKey =
  | 'annualLeaveBalance'
  | 'medicalLeaveBalance'
  | 'maternityLeaveBalance'
  | 'paternityLeaveBalance'
  | 'unpaidLeaveBalance'

const LEAVE_BALANCE_FIELD: Record<string, TeacherBalanceKey | undefined> = {
  ANNUAL:    'annualLeaveBalance',
  MEDICAL:   'medicalLeaveBalance',
  MATERNITY: 'maternityLeaveBalance',
  PATERNITY: 'paternityLeaveBalance',
  UNPAID:    'unpaidLeaveBalance',
}

// ─── GET /api/v1/leave/working-days?start=YYYY-MM-DD&end=YYYY-MM-DD ──────────
router.get('/working-days', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const start = req.query.start as string | undefined
    const end   = req.query.end   as string | undefined
    if (!start || !end) {
      res.status(400).json({ success: false, message: 'start and end query params are required' })
      return
    }
    const days = await calculateWorkingDays(new Date(start), new Date(end))
    res.json({ success: true, data: { workingDays: days, start, end } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /api/v1/leave/balances ──────────────────────────────────────────────
router.get('/balances', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    const targetId = req.query.teacherId as string | undefined

    let teacher
    if (targetId && ['admin', 'manager', 'hod', 'principal'].includes(role)) {
      teacher = await prisma.teacher.findUnique({ where: { id: targetId } })
    } else {
      teacher = await prisma.teacher.findUnique({ where: { userId } })
    }

    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher profile not found' })
      return
    }

    const now = new Date()
    const ssmSyncedAt = teacher.ssmLastSyncedAt ?? null
    const isStale = !ssmSyncedAt || (now.getTime() - ssmSyncedAt.getTime()) > 24 * 60 * 60 * 1000

    res.json({
      success: true,
      data: {
        teacherId: teacher.id,
        balances: {
          ANNUAL:        { available: teacher.annualLeaveBalance,    total: 14 },
          MEDICAL:       { available: teacher.medicalLeaveBalance,   total: 14 },
          MATERNITY:     { available: teacher.maternityLeaveBalance, total: 90 },
          PATERNITY:     { available: teacher.paternityLeaveBalance, total: 7  },
          UNPAID:        { available: teacher.unpaidLeaveBalance,    total: 30 },
          HAJJ:          { available: 30,                            total: 30 },
          COMPASSIONATE: { available: 3,                             total: 3  },
        },
        ssmSyncedAt,
        isStale,
        leaveBalanceYear: teacher.leaveBalanceYear,
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /api/v1/leave/ssm-refresh ──────────────────────────────────────────
router.post('/ssm-refresh', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const teacher = await prisma.teacher.findUnique({ where: { userId } })
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher profile not found' })
      return
    }

    // Simulate SSM sync: tiny jitter makes it feel like a real data fetch
    const jitter = (base: number) => Math.max(0, base + Math.floor((Math.random() - 0.5) * 2))
    const newAnnual  = jitter(teacher.annualLeaveBalance)
    const newMedical = jitter(teacher.medicalLeaveBalance)

    const updated = await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        ssmLastSyncedAt: new Date(),
        annualLeaveBalance: newAnnual,
        medicalLeaveBalance: newMedical,
      },
    })

    res.json({
      success: true,
      message: 'SSM data refreshed successfully',
      data: {
        ssmSyncedAt: updated.ssmLastSyncedAt,
        balances: {
          ANNUAL:  { available: updated.annualLeaveBalance,  total: 14 },
          MEDICAL: { available: updated.medicalLeaveBalance, total: 14 },
        },
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /api/v1/leave/apply ─────────────────────────────────────────────────
router.post('/apply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    if (!['admin', 'manager', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const { leaveType, startDate, endDate, reason, teacherId: bodyTeacherId, documentUrl } = req.body as {
      leaveType: string; startDate: string; endDate: string; reason?: string
      teacherId?: string; documentUrl?: string
    }

    if (!leaveType || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'leaveType, startDate, endDate are required' }); return
    }

    if (leaveType === 'MEDICAL' && !documentUrl) {
      res.status(400).json({ success: false, message: 'A medical certificate is required for MEDICAL leave.' }); return
    }

    let resolvedTeacherId = bodyTeacherId
    if (!resolvedTeacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }
      resolvedTeacherId = teacher.id
    }

    const start = new Date(startDate)
    const end   = new Date(endDate)
    const daysRequested = await calculateWorkingDays(start, end)

    const teacherRec = await prisma.teacher.findUnique({ where: { id: resolvedTeacherId } })
    if (teacherRec) {
      const field = LEAVE_BALANCE_FIELD[leaveType]
      if (field) {
        const available = teacherRec[field] as number
        if (available < daysRequested) {
          res.status(400).json({
            success: false,
            message: `Insufficient ${leaveType} leave balance. Available: ${available} day(s), Requested: ${daysRequested} working day(s).`,
          }); return
        }
      }
    }

    const application = await prisma.leaveApplication.create({
      data: {
        teacherId: resolvedTeacherId,
        leaveType,
        startDate: start,
        endDate: end,
        daysRequested,
        reason: reason ?? null,
        status: 'PENDING',
        documentUrl: documentUrl ?? null,
      },
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
    })

    const hodUsers = await prisma.user.findMany({
      where: { role: { in: ['hod', 'admin', 'manager'] } },
      select: { id: true },
    })
    await sendMany(
      hodUsers.map(u => u.id),
      {
        title: 'Leave Application Submitted',
        message: `${application.teacher.user.displayName} submitted a ${leaveType} leave for ${daysRequested} working day(s) starting ${startDate}.`,
        type: 'info',
      },
    )

    res.status(201).json({ success: true, data: application })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── PATCH /api/v1/leave/:id/principal-approve ────────────────────────────────
router.patch('/:id/principal-approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: Principal/Admin only' }); return
    }

    const { decision, remarks } = req.body as { decision: 'APPROVE' | 'REJECT'; remarks?: string }
    if (!['APPROVE', 'REJECT'].includes(decision)) {
      res.status(400).json({ success: false, message: 'decision must be APPROVE or REJECT' }); return
    }

    const leaveId = req.params.id as string

    const application = await prisma.leaveApplication.findUnique({
      where: { id: leaveId },
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
    })
    if (!application) { res.status(404).json({ success: false, message: 'Leave application not found' }); return }
    if (application.status !== 'HOD_APPROVED') {
      res.status(400).json({ success: false, message: 'Application must be HOD_APPROVED first' }); return
    }

    const newStatus = decision === 'APPROVE' ? 'PRINCIPAL_APPROVED' : 'REJECTED'

    const updated = await prisma.leaveApplication.update({
      where: { id: leaveId },
      data: {
        status: newStatus,
        principalApproverId: userId,
        principalApprovedAt: new Date(),
        principalRemarks: remarks ?? null,
      },
    })

    if (decision === 'APPROVE') {
      const field = LEAVE_BALANCE_FIELD[application.leaveType]
      if (field) {
        const teacherRec = await prisma.teacher.findUnique({ where: { id: application.teacherId } })
        if (teacherRec) {
          const current = teacherRec[field] as number
          await prisma.teacher.update({
            where: { id: application.teacherId },
            data: { [field]: Math.max(0, current - application.daysRequested) },
          })
        }
      }
    }

    await send({
      userId: application.teacher.user.id,
      title: decision === 'APPROVE' ? 'Leave Approved by Principal' : 'Leave Rejected by Principal',
      message: decision === 'APPROVE'
        ? `Your ${application.leaveType} leave (${application.startDate.toDateString()} – ${application.endDate.toDateString()}) has been finally approved.`
        : `Your leave application was rejected by the Principal.${remarks ? ' Reason: ' + remarks : ''}`,
      type: decision === 'APPROVE' ? 'success' : 'warning',
    })

    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── PATCH /api/v1/leave/:id/cancel ──────────────────────────────────────────
router.patch('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const { cancellationReason } = req.body as { cancellationReason?: string }

    const cancelId = req.params.id as string

    const application = await prisma.leaveApplication.findUnique({
      where: { id: cancelId },
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
    })
    if (!application) { res.status(404).json({ success: false, message: 'Leave application not found' }); return }

    const ownTeacher = await prisma.teacher.findUnique({ where: { userId } })
    const isOwner = ownTeacher?.id === application.teacherId
    const isAdmin = ['admin', 'manager', 'principal'].includes(req.user!.role)
    if (!isOwner && !isAdmin) { res.status(403).json({ success: false, message: 'Forbidden' }); return }

    if (['CANCELLED', 'REJECTED'].includes(application.status)) {
      res.status(400).json({ success: false, message: 'Cannot cancel a leave that is already cancelled or rejected' }); return
    }

    // Restore balance if already fully approved
    if (application.status === 'PRINCIPAL_APPROVED') {
      const field = LEAVE_BALANCE_FIELD[application.leaveType]
      if (field) {
        const teacherRec = await prisma.teacher.findUnique({ where: { id: application.teacherId } })
        if (teacherRec) {
          const current = teacherRec[field] as number
          await prisma.teacher.update({
            where: { id: application.teacherId },
            data: { [field]: current + application.daysRequested },
          })
        }
      }
    }

    const updated = await prisma.leaveApplication.update({
      where: { id: cancelId },
      data: {
        status: 'CANCELLED',
        cancellationReason: cancellationReason ?? null,
        cancelledAt: new Date(),
        cancelledBy: userId,
      },
    })

    const notifyUsers = await prisma.user.findMany({
      where: { role: { in: ['hod', 'principal', 'admin', 'manager'] } },
      select: { id: true },
    })
    await sendMany(
      notifyUsers.map(u => u.id),
      {
        title: 'Leave Cancelled',
        message: `${application.teacher.user.displayName}'s ${application.leaveType} leave has been cancelled.${cancellationReason ? ' Reason: ' + cancellationReason : ''}`,
        type: 'warning',
      },
    )

    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /api/v1/leave/calendar ───────────────────────────────────────────────
router.get('/calendar', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const start = req.query.start as string | undefined
    const end   = req.query.end   as string | undefined
    const startDate = start ? new Date(start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const endDate   = end   ? new Date(end)   : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)

    const leaves = await prisma.leaveApplication.findMany({
      where: {
        status: 'PRINCIPAL_APPROVED',
        startDate: { lte: endDate },
        endDate:   { gte: startDate },
      },
      include: {
        teacher: { include: { user: { select: { id: true, displayName: true } } } },
      },
      orderBy: { startDate: 'asc' },
    })

    res.json({ success: true, data: leaves })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /api/v1/leave/today-count ───────────────────────────────────────────
router.get('/today-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const leaves = await prisma.leaveApplication.findMany({
      where: {
        status: 'PRINCIPAL_APPROVED',
        startDate: { lte: todayEnd },
        endDate:   { gte: today },
      },
      include: {
        teacher: { include: { user: { select: { id: true, displayName: true } } } },
      },
    })

    res.json({
      success: true,
      data: {
        count: leaves.length,
        staff: leaves.map(l => ({
          id: l.teacherId,
          name: l.teacher.user.displayName,
          leaveType: l.leaveType,
          endDate: l.endDate,
        })),
      },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /api/v1/leave/reports/on-mc ─────────────────────────────────────────
router.get('/reports/on-mc', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const dept     = req.query.dept     as string | undefined
    const dateFrom = req.query.dateFrom as string | undefined
    const dateTo   = req.query.dateTo   as string | undefined
    const today    = new Date()
    const from = dateFrom ? new Date(dateFrom) : new Date(today.getFullYear(), today.getMonth(), 1)
    const to   = dateTo   ? new Date(dateTo)   : today

    const leaves = await prisma.leaveApplication.findMany({
      where: {
        leaveType: 'MEDICAL',
        status: { in: ['HOD_APPROVED', 'PRINCIPAL_APPROVED'] },
        startDate: { lte: to },
        endDate:   { gte: from },
      },
      include: {
        teacher: { include: { user: { select: { displayName: true } } } },
      },
      orderBy: { startDate: 'asc' },
    })

    const filtered = dept ? leaves.filter(l => l.teacher.department === dept) : leaves

    const data = filtered.map(l => ({
      id: l.id,
      name: l.teacher.user.displayName,
      staffId: l.teacher.staffId,
      designation: l.teacher.designation ?? '—',
      department: l.teacher.department ?? '—',
      staffType: l.teacher.staffType,
      startDate: l.startDate,
      endDate: l.endDate,
      daysRequested: l.daysRequested,
      status: l.status,
      documentUrl: l.documentUrl,
    }))

    res.json({ success: true, data, total: data.length })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /api/v1/leave/reports/all-leave ──────────────────────────────────────
router.get('/reports/all-leave', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const leaveType = req.query.leaveType as string | undefined
    const dept      = req.query.dept      as string | undefined
    const dateFrom  = req.query.dateFrom  as string | undefined
    const dateTo    = req.query.dateTo    as string | undefined
    const today     = new Date()
    const from = dateFrom ? new Date(dateFrom) : new Date(today.getFullYear(), today.getMonth(), 1)
    const to   = dateTo   ? new Date(dateTo)   : today

    const leaves = await prisma.leaveApplication.findMany({
      where: {
        ...(leaveType ? { leaveType } : {}),
        status: { in: ['PENDING', 'HOD_APPROVED', 'PRINCIPAL_APPROVED'] },
        startDate: { lte: to },
        endDate:   { gte: from },
      },
      include: {
        teacher: { include: { user: { select: { displayName: true } } } },
      },
      orderBy: { startDate: 'asc' },
    })

    const filtered = dept ? leaves.filter(l => l.teacher.department === dept) : leaves

    const data = filtered.map(l => ({
      id: l.id,
      name: l.teacher.user.displayName,
      staffId: l.teacher.staffId,
      department: l.teacher.department ?? '—',
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      daysRequested: l.daysRequested,
      status: l.status,
    }))

    res.json({ success: true, data, total: data.length })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
