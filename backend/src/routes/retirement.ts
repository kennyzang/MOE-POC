import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'
import { USER_SELECT_NAME, USER_SELECT_BASIC } from '../lib/querySelects'
import { validateTransition, RETIREMENT_TRANSITIONS } from '../lib/transitions'

const router = Router()

// ─── Constants ────────────────────────────────────────────────────

const MANDATORY_RETIREMENT_AGE = 55       // years
const SERVICE_RETIREMENT_YEARS = 30       // full-service retirement
const EARLY_RETIREMENT_SERVICE = 25       // voluntary early retirement (service years)
const EARLY_RETIREMENT_AGE    = 50        // voluntary early retirement (age)
const ALERT_WINDOW_DAYS       = 365       // flag if retiring within this many days
const URGENT_WINDOW_DAYS      = 180       // urgent flag window

// ─── Helpers ─────────────────────────────────────────────────────

function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

interface EligibilityInfo {
  teacherId: string
  teacherName: string
  staffId: string
  department: string | null
  dateOfBirth: Date | null
  joinDate: Date | null
  serviceYears: number | null
  currentAge: number | null
  mandatoryRetirementDate: Date | null
  serviceRetirementDate: Date | null
  eligibleRetirementDate: Date | null   // earliest of the two
  daysUntilEligible: number | null
  isEligible: boolean
  canApplyEarlyRetirement: boolean
  urgencyLevel: 'NONE' | 'WATCH' | 'URGENT' | 'OVERDUE'
  hasApplication: boolean
  applicationStatus: string | null
}

function computeEligibility(
  teacher: {
    id: string
    staffId: string
    department: string | null
    dateOfBirth: Date | null
    joinDate: Date | null
    user: { displayName: string }
    retirementApplication: { status: string } | null
  },
): EligibilityInfo {
  const now = new Date()

  let mandatoryRetirementDate: Date | null = null
  let serviceRetirementDate: Date | null = null
  let currentAge: number | null = null
  let serviceYears: number | null = null

  if (teacher.dateOfBirth) {
    mandatoryRetirementDate = addYears(teacher.dateOfBirth, MANDATORY_RETIREMENT_AGE)
    currentAge = Math.floor(daysBetween(teacher.dateOfBirth, now) / 365.25)
  }
  if (teacher.joinDate) {
    serviceRetirementDate = addYears(teacher.joinDate, SERVICE_RETIREMENT_YEARS)
    serviceYears = Math.floor(daysBetween(teacher.joinDate, now) / 365.25)
  }

  // Eligible date = whichever comes first (mandatory age OR full service)
  let eligibleRetirementDate: Date | null = null
  if (mandatoryRetirementDate && serviceRetirementDate) {
    eligibleRetirementDate = mandatoryRetirementDate < serviceRetirementDate
      ? mandatoryRetirementDate
      : serviceRetirementDate
  } else {
    eligibleRetirementDate = mandatoryRetirementDate ?? serviceRetirementDate
  }

  const daysUntilEligible = eligibleRetirementDate
    ? daysBetween(now, eligibleRetirementDate)
    : null
  const isEligible = daysUntilEligible !== null && daysUntilEligible <= 0

  const canApplyEarlyRetirement =
    (currentAge !== null && currentAge >= EARLY_RETIREMENT_AGE) ||
    (serviceYears !== null && serviceYears >= EARLY_RETIREMENT_SERVICE)

  let urgencyLevel: EligibilityInfo['urgencyLevel'] = 'NONE'
  if (daysUntilEligible !== null) {
    if (daysUntilEligible < 0) urgencyLevel = 'OVERDUE'
    else if (daysUntilEligible <= URGENT_WINDOW_DAYS) urgencyLevel = 'URGENT'
    else if (daysUntilEligible <= ALERT_WINDOW_DAYS) urgencyLevel = 'WATCH'
  }

  return {
    teacherId: teacher.id,
    teacherName: teacher.user.displayName,
    staffId: teacher.staffId,
    department: teacher.department,
    dateOfBirth: teacher.dateOfBirth,
    joinDate: teacher.joinDate,
    serviceYears,
    currentAge,
    mandatoryRetirementDate,
    serviceRetirementDate,
    eligibleRetirementDate,
    daysUntilEligible,
    isEligible,
    canApplyEarlyRetirement,
    urgencyLevel,
    hasApplication: !!teacher.retirementApplication,
    applicationStatus: teacher.retirementApplication?.status ?? null,
  }
}

// ─── GET /my-status ───────────────────────────────────────────────

router.get('/my-status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        user: { select: USER_SELECT_NAME },
        retirementApplication: true,
      },
    })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

    res.json({ success: true, data: computeEligibility(teacher) })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /upcoming?months=12 ──────────────────────────────────────

router.get('/upcoming', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    let deptFilter: string | undefined

    if (role === 'hod') {
      const hodTeacher = await prisma.teacher.findUnique({ where: { userId }, select: { department: true } })
      deptFilter = hodTeacher?.department ?? undefined
    } else if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const months = parseInt((req.query.months as string) ?? '12', 10)
    const cutoffDays = months * 30

    const teachers = await prisma.teacher.findMany({
      where: {
        status: 'active',
        ...(deptFilter ? { department: deptFilter } : {}),
        OR: [
          { dateOfBirth: { not: null } },
          { joinDate: { not: null } },
        ],
      },
      include: {
        user: { select: USER_SELECT_NAME },
        retirementApplication: { select: { status: true } },
      },
    })

    const eligibilities = teachers
      .map(computeEligibility)
      .filter(e => e.daysUntilEligible !== null && e.daysUntilEligible <= cutoffDays)
      .sort((a, b) => (a.daysUntilEligible ?? 0) - (b.daysUntilEligible ?? 0))

    const overdue = eligibilities.filter(e => e.urgencyLevel === 'OVERDUE').length
    const urgent  = eligibilities.filter(e => e.urgencyLevel === 'URGENT').length
    const watch   = eligibilities.filter(e => e.urgencyLevel === 'WATCH').length

    res.json({ success: true, data: { teachers: eligibilities, summary: { overdue, urgent, watch, total: eligibilities.length } } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /applications ────────────────────────────────────────────

router.get('/applications', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.user!
    let deptFilter: string | undefined

    if (role === 'hod') {
      const hodTeacher = await prisma.teacher.findUnique({ where: { userId }, select: { department: true } })
      deptFilter = hodTeacher?.department ?? undefined
    } else if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const applications = await prisma.retirementApplication.findMany({
      where: deptFilter ? { teacher: { department: deptFilter } } : {},
      include: {
        teacher: {
          include: { user: { select: { displayName: true } } },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })

    const formatted = applications.map(a => ({
      id: a.id,
      teacherId: a.teacherId,
      teacherName: a.teacher.user?.displayName ?? 'Unknown',
      department: a.teacher.department,
      staffId: a.teacher.staffId,
      retirementType: a.retirementType,
      requestedDate: a.requestedDate,
      reason: a.reason,
      documentUrl: a.documentUrl,
      status: a.status,
      submittedAt: a.submittedAt,
      reviewedAt: a.reviewedAt,
      reviewRemarks: a.reviewRemarks,
    }))

    res.json({ success: true, data: formatted })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /apply ──────────────────────────────────────────────────

router.post('/apply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        user: { select: USER_SELECT_NAME },
        retirementApplication: { select: { status: true } },
      },
    })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

    if (teacher.retirementApplication) {
      res.status(409).json({ success: false, message: 'A retirement application already exists' }); return
    }

    const eligibility = computeEligibility(teacher)

    const { retirementType, requestedDate, reason, documentUrl } = req.body as {
      retirementType?: string
      requestedDate: string
      reason?: string
      documentUrl?: string
    }

    if (!requestedDate) {
      res.status(400).json({ success: false, message: 'requestedDate is required' }); return
    }

    // Validate: voluntary early only if eligible
    if (retirementType === 'VOLUNTARY_EARLY' && !eligibility.canApplyEarlyRetirement) {
      res.status(400).json({ success: false, message: 'Not yet eligible for early retirement' }); return
    }

    const application = await prisma.retirementApplication.create({
      data: {
        teacherId: teacher.id,
        retirementType: retirementType ?? 'NORMAL',
        requestedDate: new Date(requestedDate),
        reason: reason ?? null,
        documentUrl: documentUrl ?? null,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    // Notify HR admin
    const admins = await prisma.user.findMany({ where: { role: { in: ['admin', 'manager'] } }, select: { id: true } })
    for (const a of admins) {
      await send({
        userId: a.id,
        title: 'New Retirement Application',
        message: `${teacher.user.displayName} has submitted a retirement application.`,
        type: 'info',
      })
    }

    res.json({ success: true, data: application })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── PATCH /applications/:id ──────────────────────────────────────

router.patch('/applications/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const { id } = req.params as { id: string }
    const { status, reviewRemarks } = req.body as { status: string; reviewRemarks?: string }

    const valid = ['UNDER_REVIEW', 'APPROVED', 'REJECTED']
    if (!valid.includes(status)) {
      res.status(400).json({ success: false, message: `status must be one of: ${valid.join(', ')}` }); return
    }

    const existing = await prisma.retirementApplication.findUnique({
      where: { id },
      include: { teacher: { include: { user: { select: USER_SELECT_BASIC } } } },
    })
    if (!existing) { res.status(404).json({ success: false, message: 'Application not found' }); return }

    const transitionResult = validateTransition(RETIREMENT_TRANSITIONS, existing.status, status)
    if (!transitionResult.ok) {
      res.status(400).json({ success: false, message: transitionResult.reason }); return
    }

    const updated = await prisma.retirementApplication.update({
      where: { id },
      data: {
        status,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewRemarks: reviewRemarks ?? null,
      },
    })

    // Notify the teacher
    await send({
      userId: existing.teacher.user?.id ?? '',
      title: `Retirement Application ${status}`,
      message: `Your retirement application has been ${status.toLowerCase()}.${reviewRemarks ? ` Remarks: ${reviewRemarks}` : ''}`,
      type: status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'info',
    })

    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /notify-teacher/:teacherId ─────────────────────────────
// Admin/manager: send targeted retirement reminder to a single teacher

router.post('/notify-teacher/:teacherId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const { teacherId } = req.params as { teacherId: string }
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        user: { select: USER_SELECT_BASIC },
        retirementApplication: { select: { status: true } },
      },
    })
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return }

    const e = computeEligibility(teacher)
    if (e.urgencyLevel === 'NONE') {
      res.status(400).json({ success: false, message: 'Teacher is not approaching retirement within the alert window' }); return
    }

    const msg = e.urgencyLevel === 'OVERDUE'
      ? 'You have passed your mandatory retirement date. Please submit a formal retirement application as soon as possible.'
      : `Your retirement eligibility date is in ${e.daysUntilEligible} days. Please begin the retirement planning process.`

    await send({
      userId: teacher.user.id,
      title: 'Retirement Planning Reminder',
      message: msg,
      type: e.urgencyLevel === 'OVERDUE' ? 'error' : 'warning',
    })

    res.json({ success: true, data: { notified: 1, teacherName: teacher.user.displayName } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /run-alerts ─────────────────────────────────────────────
// Checks all teachers, sends upcoming-retirement notifications

router.post('/run-alerts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager'].includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' }); return
    }

    const teachers = await prisma.teacher.findMany({
      where: {
        status: 'active',
        OR: [{ dateOfBirth: { not: null } }, { joinDate: { not: null } }],
      },
      include: {
        user: { select: USER_SELECT_BASIC },
        retirementApplication: { select: { status: true } },
      },
    })

    let notified = 0
    for (const t of teachers) {
      const e = computeEligibility(t)
      if (e.urgencyLevel === 'NONE') continue
      if (e.hasApplication) continue // already applied, skip

      const msg = e.urgencyLevel === 'OVERDUE'
        ? `${t.user.displayName} has passed mandatory retirement age. A formal process is required.`
        : `${t.user.displayName} is approaching retirement eligibility in ${e.daysUntilEligible} days.`

      // Notify the teacher
      await send({ userId: t.user.id, title: 'Retirement Notification', message: msg, type: e.urgencyLevel === 'OVERDUE' ? 'error' : 'warning' })
      notified++
    }

    res.json({ success: true, data: { notified } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
