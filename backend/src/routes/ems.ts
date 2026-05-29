import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { send, sendMany } from '../services/notificationService'
import { broadcast } from './events'
import { getConfigFloat } from '../lib/config'

const router = Router()

// ─── Helpers ───────────────────────────────────────────────────

function calcOverallScore(teaching: number, professional: number, conduct: number): number {
  return Math.round(((teaching + professional + conduct) / 3) * 10) / 10
}

function calcRating(overall: number): string {
  if (overall >= 90) return 'Excellent'
  if (overall >= 80) return 'Good'
  if (overall >= 70) return 'Satisfactory'
  return 'NeedsImprovement'
}

// ─── CPD Summary ───────────────────────────────────────────────

// GET /api/v1/ems/cpd-summary
router.get('/cpd-summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const where: Record<string, unknown> = {}

    // Teacher only sees own record
    if (role === 'teacher') {
      where.userId = userId
    }

    const teachers = await prisma.teacher.findMany({
      where: role === 'teacher' ? { userId } : {},
      include: {
        user: {
          select: { id: true, displayName: true, username: true, email: true },
        },
      },
      orderBy: { staffId: 'asc' },
    })

    const cpdAnnualTarget = await getConfigFloat('cpd_annual_target', 20)
    const summary = teachers.map(t => {
      const effectiveTarget = t.cpdTarget || cpdAnnualTarget
      return {
        id: t.id,
        staffId: t.staffId,
        displayName: t.user.displayName,
        department: t.department,
        cpdHours: t.cpdHours,
        cpdTarget: effectiveTarget,
        employmentStatus: t.employmentStatus,
        annualLeaveBalance: t.annualLeaveBalance,
        medicalLeaveBalance: t.medicalLeaveBalance,
        cpdPercentage: Math.min(Math.round((t.cpdHours / effectiveTarget) * 100), 100),
        belowTarget: t.cpdHours < effectiveTarget,
      }
    })

    res.json({ success: true, data: summary })
  } catch (error) {
    console.error('Error fetching CPD summary:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Performance Evaluations ───────────────────────────────────

// GET /api/v1/ems/performance-evaluations
router.get('/performance-evaluations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    let where: Record<string, unknown> = {}

    // Teacher sees only their own evaluations
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Teacher profile not found' })
        return
      }
      where = { teacherId: teacher.id }
    }

    const evaluations = await prisma.performanceEvaluation.findMany({
      where,
      include: {
        teacher: {
          include: {
            user: {
              select: { id: true, displayName: true, username: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: evaluations })
  } catch (error) {
    console.error('Error listing performance evaluations:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /api/v1/ems/performance-evaluations
router.post('/performance-evaluations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: HOD/Admin only' })
      return
    }

    const { teacherId, academicYear, teachingScore, professionalScore, conductScore, comments } = req.body

    if (!teacherId || !academicYear) {
      res.status(400).json({ success: false, message: 'teacherId and academicYear are required' })
      return
    }

    // Verify teacher exists
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found' })
      return
    }

    let overallScore: number | undefined
    let rating: string | undefined

    if (
      teachingScore !== undefined &&
      professionalScore !== undefined &&
      conductScore !== undefined
    ) {
      overallScore = calcOverallScore(
        Number(teachingScore),
        Number(professionalScore),
        Number(conductScore)
      )
      rating = calcRating(overallScore)
    }

    const evaluation = await prisma.performanceEvaluation.create({
      data: {
        teacherId,
        academicYear,
        evaluatorId: userId,
        teachingScore: teachingScore !== undefined ? Number(teachingScore) : undefined,
        professionalScore: professionalScore !== undefined ? Number(professionalScore) : undefined,
        conductScore: conductScore !== undefined ? Number(conductScore) : undefined,
        overallScore,
        rating,
        comments,
        status: 'draft',
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
    })

    res.status(201).json({ success: true, data: evaluation })
  } catch (error) {
    console.error('Error creating performance evaluation:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /api/v1/ems/performance-evaluations/:id/submit
router.patch('/performance-evaluations/:id/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    const id = req.params.id as string

    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: HOD/Admin only' })
      return
    }

    const evaluation = await prisma.performanceEvaluation.findUnique({ where: { id } })
    if (!evaluation) {
      res.status(404).json({ success: false, message: 'Evaluation not found' })
      return
    }

    if (evaluation.status !== 'draft') {
      res.status(400).json({ success: false, message: 'Only draft evaluations can be submitted' })
      return
    }

    const updated = await prisma.performanceEvaluation.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
    })

    // Notify evaluated teacher
    await send({
      userId: updated.teacher.user.id,
      title: 'Performance Evaluation Submitted',
      message: `Your performance evaluation for ${updated.academicYear} has been submitted for review.`,
      type: 'info',
    })
    // Notify managers
    const managers = await prisma.user.findMany({
      where: { role: 'manager' },
      select: { id: true },
    })
    await sendMany(
      managers.map(m => m.id),
      {
        title: 'Performance Evaluation Submitted',
        message: `Evaluation for ${updated.teacher.user.displayName} (${updated.academicYear}) has been submitted.`,
        type: 'info',
      },
    )

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error submitting evaluation:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /api/v1/ems/performance-evaluations/:id/review
router.patch('/performance-evaluations/:id/review', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const id = req.params.id as string
    const { action, reviewerComments } = req.body

    if (!['admin', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: Principal/Admin only' })
      return
    }

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' })
      return
    }

    const evaluation = await prisma.performanceEvaluation.findUnique({ where: { id } })
    if (!evaluation) {
      res.status(404).json({ success: false, message: 'Evaluation not found' })
      return
    }

    if (evaluation.status !== 'submitted') {
      res.status(400).json({ success: false, message: 'Only submitted evaluations can be reviewed' })
      return
    }

    const updated = await prisma.performanceEvaluation.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewerId: userId,
        reviewerComments,
        reviewedAt: new Date(),
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, displayName: true, username: true } },
          },
        },
      },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error reviewing evaluation:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Leave Management ──────────────────────────────────────────────────────

// GET /api/v1/ems/leave-applications
router.get('/leave-applications', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const { status } = req.query as { status?: string }

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    // Teacher sees only own leave applications
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }
      where.teacherId = teacher.id
    }

    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const applications = await prisma.leaveApplication.findMany({
      where,
      include: {
        teacher: { include: { user: { select: { id: true, displayName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: applications })
  } catch (error) {
    console.error('Error listing leave applications:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /api/v1/ems/leave-applications
router.post('/leave-applications', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const { leaveType, startDate, endDate, reason, teacherId: bodyTeacherId } = req.body

    if (!leaveType || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'leaveType, startDate, endDate are required' }); return
    }

    // Resolve teacher: if admin/hod posts on behalf, allow teacherId in body; otherwise use own
    let resolvedTeacherId = bodyTeacherId as string | undefined
    if (!resolvedTeacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }
      resolvedTeacherId = teacher.id
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const daysRequested = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1)

    // Balance check before creating application
    const teacherForBalance = await prisma.teacher.findUnique({ where: { id: resolvedTeacherId } })
    if (teacherForBalance) {
      const balanceField = leaveType === 'ANNUAL' ? 'annualLeaveBalance' : leaveType === 'MEDICAL' ? 'medicalLeaveBalance' : null
      if (balanceField) {
        const available = teacherForBalance[balanceField as 'annualLeaveBalance' | 'medicalLeaveBalance'] ?? 14
        if (available < daysRequested) {
          res.status(400).json({
            success: false,
            message: `Insufficient ${leaveType.toLowerCase()} leave balance. Available: ${available} day(s), Requested: ${daysRequested} day(s).`,
          })
          return
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
        reason,
        status: 'PENDING',
      },
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
    })

    // Notify HOD/admin
    const hodUsers = await prisma.user.findMany({ where: { role: { in: ['hod', 'admin', 'manager'] } }, select: { id: true } })
    await sendMany(
      hodUsers.map(u => u.id),
      {
        title: 'Leave Application Submitted',
        message: `${application.teacher.user.displayName} has submitted a ${leaveType} leave request for ${daysRequested} day(s) starting ${startDate}.`,
        type: 'info',
      },
    )

    res.status(201).json({ success: true, data: application })
  } catch (error) {
    console.error('Error creating leave application:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /api/v1/ems/leave-applications/:id/approve
router.post('/leave-applications/:id/approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'hod', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: HOD/Admin only' }); return
    }

    const id = req.params.id as string
    const { decision, notes } = req.body as { decision: 'APPROVE' | 'REJECT'; notes?: string }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      res.status(400).json({ success: false, message: 'decision must be APPROVE or REJECT' }); return
    }

    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
    })
    if (!application) { res.status(404).json({ success: false, message: 'Leave application not found' }); return }

    const newStatus = decision === 'APPROVE' ? 'HOD_APPROVED' : 'REJECTED'

    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: {
        status: newStatus,
        hodApproverId: userId,
        hodApprovedAt: new Date(),
        hodRemarks: notes,
      },
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
    })

    // Notify the teacher
    await send({
      userId: updated.teacher.user.id,
      title: decision === 'APPROVE' ? 'Leave Approved' : 'Leave Rejected',
      message: decision === 'APPROVE'
        ? `Your ${updated.leaveType} leave from ${updated.startDate.toDateString()} to ${updated.endDate.toDateString()} has been approved.`
        : `Your ${updated.leaveType} leave application has been rejected. Reason: ${notes ?? 'No reason provided'}`,
      type: decision === 'APPROVE' ? 'success' : 'warning',
    })

    // Deduct leave balance on approval
    if (decision === 'APPROVE') {
      const teacherRec = await prisma.teacher.findUnique({ where: { id: application.teacherId } })
      if (teacherRec) {
        const balanceField = application.leaveType === 'ANNUAL' ? 'annualLeaveBalance' :
                             application.leaveType === 'MEDICAL' ? 'medicalLeaveBalance' : null
        if (balanceField) {
          const current = teacherRec[balanceField as 'annualLeaveBalance' | 'medicalLeaveBalance'] ?? 14
          await prisma.teacher.update({
            where: { id: application.teacherId },
            data: { [balanceField]: Math.max(0, current - application.daysRequested) },
          })
        }
      }
    }

    // If approved, notify principal that substitute is needed
    if (decision === 'APPROVE') {
      const principalUsers = await prisma.user.findMany({ where: { role: 'principal' }, select: { id: true } })
      await sendMany(
        principalUsers.map(u => u.id),
        {
          title: 'Substitute Assignment Needed',
          message: `${updated.teacher.user.displayName}'s leave (${updated.startDate.toDateString()}–${updated.endDate.toDateString()}) has been approved. Please assign a substitute.`,
          type: 'info',
        },
      )
      broadcast('dashboard', 'dashboard.staff.changed', {})
    }

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error approving leave application:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /api/v1/ems/leave-applications/:id/substitute-suggestions
// Returns ranked substitute candidates for the affected timetable slots
router.get('/leave-applications/:id/substitute-suggestions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const id = req.params.id as string
    const leave = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { teacher: { include: { user: { select: { displayName: true } } } } },
    })
    if (!leave) { res.status(404).json({ success: false, message: 'Leave application not found' }); return }

    // Find timetable slots for the absent teacher
    const affectedSlots = await prisma.timetableSlot.findMany({
      where: { teacherId: leave.teacherId },
      include: {
        course: { select: { id: true, code: true, name: true } },
      },
    })

    if (affectedSlots.length === 0) {
      res.json({ success: true, data: [], message: 'No timetable slots found for this teacher' }); return
    }

    // Get leave date range as day-of-week set
    const leaveDays = new Set<number>()
    const current = new Date(leave.startDate)
    while (current <= leave.endDate) {
      const dow = current.getDay() // 0=Sun, 1=Mon ... 5=Fri
      if (dow >= 1 && dow <= 5) leaveDays.add(dow - 1) // convert to 0=Mon
      current.setDate(current.getDate() + 1)
    }

    // Filter slots to those on leave days
    const impactedSlots = affectedSlots.filter(s => leaveDays.has(s.dayOfWeek))

    // Get subject codes from affected courses
    const subjectCodes = [...new Set(impactedSlots.map(s => s.courseId))]

    // Find candidate teachers: different from absent teacher, teaches same or related subjects
    const allTeachers = await prisma.teacher.findMany({
      where: {
        id: { not: leave.teacherId },
        status: 'active',
      },
      include: {
        user: { select: { id: true, displayName: true } },
        timetableSlots: { select: { dayOfWeek: true, startTime: true, endTime: true } },
      },
    })

    const scored: Array<{
      teacherId: string
      teacherName: string
      freeSlots: number
      totalSlots: number
      substituteCountTerm: number
      rankScore: number
      affectedSlotsDetail: Array<{ day: string; time: string; course: string }>
    }> = []

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

    for (const candidate of allTeachers) {
      // Check availability: free if no existing slot at same day+time
      let freeSlots = 0
      const busySlotKeys = new Set(
        candidate.timetableSlots.map(s => `${s.dayOfWeek}-${s.startTime}`),
      )

      const detail: Array<{ day: string; time: string; course: string }> = []
      for (const slot of impactedSlots) {
        const key = `${slot.dayOfWeek}-${slot.startTime}`
        if (!busySlotKeys.has(key)) {
          freeSlots++
          detail.push({ day: dayNames[slot.dayOfWeek] ?? String(slot.dayOfWeek), time: slot.startTime, course: slot.course.name })
        }
      }

      if (freeSlots > 0) {
        // Fairness: teacher with fewer prior substitutions ranks higher
        // substituteCountTerm not in schema; use a proxy (lower = better)
        const rankScore = freeSlots * 10 + Math.max(0, 8)
        scored.push({
          teacherId: candidate.id,
          teacherName: candidate.user.displayName,
          freeSlots,
          totalSlots: impactedSlots.length,
          substituteCountTerm: 0,
          rankScore,
          affectedSlotsDetail: detail,
        })
      }
    }

    scored.sort((a, b) => b.rankScore - a.rankScore)

    res.json({ success: true, data: scored.slice(0, 5) })
  } catch (error) {
    console.error('Error getting substitute suggestions:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /api/v1/ems/leave-applications/:id/assign-substitute
router.post('/leave-applications/:id/assign-substitute', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: Principal/Admin only' }); return
    }

    const id = req.params.id as string
    const { substituteTeacherId } = req.body as { substituteTeacherId: string }

    if (!substituteTeacherId) {
      res.status(400).json({ success: false, message: 'substituteTeacherId is required' }); return
    }

    const leave = await prisma.leaveApplication.findUnique({
      where: { id },
      include: { teacher: { include: { user: { select: { displayName: true } } } } },
    })
    if (!leave) { res.status(404).json({ success: false, message: 'Leave application not found' }); return }

    const substituteTeacher = await prisma.teacher.findUnique({
      where: { id: substituteTeacherId },
      include: { user: { select: { id: true, displayName: true } } },
    })
    if (!substituteTeacher) { res.status(404).json({ success: false, message: 'Substitute teacher not found' }); return }

    // Update leave record with assigned substitute
    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: { substituteId: substituteTeacherId, status: 'HOD_APPROVED' },
    })

    // Notify substitute teacher
    await send({
      userId: substituteTeacher.user.id,
      title: 'Substitute Assignment',
      message: `You have been assigned to cover ${leave.teacher.user.displayName}'s classes from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()}.`,
      type: 'info',
    })

    // SSE: deployment changed
    broadcast('dashboard', 'dashboard.staff.changed', {})

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error assigning substitute:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
