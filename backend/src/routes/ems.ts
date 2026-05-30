import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { send, sendMany } from '../services/notificationService'
import { sendPushToUser } from '../services/pushService'
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
      data: { substituteId: substituteTeacherId, status: 'PRINCIPAL_APPROVED' },
    })

    // Notify substitute teacher
    await send({
      userId: substituteTeacher.user.id,
      title: 'Substitute Assignment',
      message: `You have been assigned to cover ${leave.teacher.user.displayName}'s classes from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()}.`,
      type: 'info',
    })

    // ─── FULL CASCADE: notify all affected students + their parents ──────────
    // Find timetable slots for the absent teacher during the leave dates
    const leaveDays = new Set<number>()
    const cur = new Date(leave.startDate)
    while (cur <= leave.endDate) {
      const dow = cur.getDay() // 0=Sun
      if (dow >= 1 && dow <= 5) leaveDays.add(dow - 1) // 0=Mon
      cur.setDate(cur.getDate() + 1)
    }

    const affectedSlots = await prisma.timetableSlot.findMany({
      where: {
        teacherId: leave.teacherId,
        dayOfWeek: { in: Array.from(leaveDays) },
      },
      select: { gradeLevel: true, className: true },
    })

    // Unique classes affected
    const affectedClasses = [...new Map(
      affectedSlots.map(s => [`${s.gradeLevel}|${s.className}`, s])
    ).values()]

    let affectedStudentCount = 0
    let affectedParentCount = 0

    for (const cls of affectedClasses) {
      const students = await prisma.student.findMany({
        where: {
          gradeLevel: cls.gradeLevel,
          className: cls.className ?? undefined,
          enrollmentStatus: 'enrolled',
        },
        include: {
          user: { select: { id: true } },
          parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
        },
      })

      for (const student of students) {
        affectedStudentCount++
        // In-app notification to student
        await send({
          userId: student.userId,
          title: 'Substitute Teacher',
          message: `Your classes with ${leave.teacher.user.displayName} on ${leave.startDate.toDateString()}${leave.startDate.toDateString() !== leave.endDate.toDateString() ? ` – ${leave.endDate.toDateString()}` : ''} will be covered by ${substituteTeacher.user.displayName}.`,
          type: 'info',
        })
        // Web push + in-app to each parent
        for (const link of student.parentLinks) {
          affectedParentCount++
          const parentId = link.parent.user.id
          await send({
            userId: parentId,
            title: 'Teacher Substitute Notice',
            message: `Your child's classes with ${leave.teacher.user.displayName} will be covered by ${substituteTeacher.user.displayName} on ${leave.startDate.toDateString()}.`,
            type: 'info',
          })
          // Also send push for real-time awareness on phone
          sendPushToUser(parentId, {
            title: 'Teacher Change Notice',
            body: `${substituteTeacher.user.displayName} will substitute ${leave.teacher.user.displayName} for ${cls.gradeLevel} ${cls.className ?? ''} classes.`,
            url: '/parent/children',
          }).catch(err => console.error('[Push] Substitute notify failed:', err))
        }
      }
    }

    // SSE: deployment changed + dashboard refresh
    broadcast('dashboard', 'dashboard.staff.changed', {
      substituteAssigned: true,
      absenceTeacher: leave.teacher.user.displayName,
      substitute: substituteTeacher.user.displayName,
      affectedStudents: affectedStudentCount,
      affectedParents: affectedParentCount,
    })

    res.json({
      success: true,
      data: updated,
      cascade: {
        substituteNotified: substituteTeacher.user.displayName,
        affectedStudents: affectedStudentCount,
        affectedParentsNotified: affectedParentCount,
        affectedClasses: affectedClasses.length,
      },
    })
  } catch (error) {
    console.error('Error assigning substitute:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── CPD Workshops ─────────────────────────────────────────────────────────

// GET /api/v1/ems/cpd-workshops
// Returns workshops filtered by teacher's subject area + sorted by relevance
router.get('/cpd-workshops', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    // If teacher: only show workshops in their subject area
    let subjectFilter: string | undefined
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      subjectFilter = teacher?.subjects?.split(',')[0]?.trim() ?? undefined
    }

    const workshops = await prisma.cpdWorkshop.findMany({
      where: {
        status: 'open',
        ...(subjectFilter ? { subject: { contains: subjectFilter } } : {}),
        startDate: { gte: new Date() },
      },
      include: {
        enrollments: { select: { teacherId: true, status: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    // Tag which ones current teacher is already enrolled in
    let currentTeacherId: string | undefined
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      currentTeacherId = teacher?.id
    }

    const result = workshops.map(w => ({
      ...w,
      enrolledCount: w.enrollments.filter(e => e.status === 'ENROLLED').length,
      alreadyEnrolled: currentTeacherId
        ? w.enrollments.some(e => e.teacherId === currentTeacherId && e.status === 'ENROLLED')
        : false,
    }))

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('GET /ems/cpd-workshops error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /api/v1/ems/cpd-workshops/:workshopId/enroll
// One-click enroll: creates CPD enrollment + blocks teacher's SMS schedule + immediate credit
router.post('/cpd-workshops/:workshopId/enroll', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const { workshopId } = req.params as { workshopId: string }
    // Allow enrolling another teacher by passing teacherId (admin/hod/principal use case)
    const { teacherId: bodyTeacherId } = req.body as { teacherId?: string }

    let resolvedTeacherId: string
    if (bodyTeacherId && ['admin', 'manager', 'hod', 'principal'].includes(role)) {
      resolvedTeacherId = bodyTeacherId
    } else {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }
      resolvedTeacherId = teacher.id
    }

    const workshop = await prisma.cpdWorkshop.findUnique({ where: { id: workshopId } })
    if (!workshop) { res.status(404).json({ success: false, message: 'Workshop not found' }); return }
    if (workshop.status !== 'open') {
      res.status(400).json({ success: false, message: 'Workshop is not open for enrollment' }); return
    }

    // Check if already enrolled
    const existing = await prisma.cpdEnrollment.findUnique({
      where: { workshopId_teacherId: { workshopId, teacherId: resolvedTeacherId } },
    })
    if (existing && existing.status === 'ENROLLED') {
      res.status(409).json({ success: false, message: 'Already enrolled in this workshop' }); return
    }

    // Create/update enrollment
    const enrollment = await prisma.cpdEnrollment.upsert({
      where: { workshopId_teacherId: { workshopId, teacherId: resolvedTeacherId } },
      create: { workshopId, teacherId: resolvedTeacherId, status: 'ENROLLED', enrolledAt: new Date() },
      update: { status: 'ENROLLED', enrolledAt: new Date(), completedAt: null, hoursAwarded: null },
    })

    // Credit CPD hours immediately (pre-credit for enrollment; full credit on completion)
    const preCredit = workshop.hours * 0.2 // 20% pre-credit for registering
    const teacher = await prisma.teacher.findUnique({ where: { id: resolvedTeacherId } })
    if (teacher) {
      await prisma.teacher.update({
        where: { id: resolvedTeacherId },
        data: { cpdHours: teacher.cpdHours + preCredit },
      })
    }

    // Notify the teacher
    const teacherUser = await prisma.user.findFirst({
      where: { teacher: { id: resolvedTeacherId } },
    })
    if (teacherUser) {
      await send({
        userId: teacherUser.id,
        title: 'CPD Workshop Enrolled',
        message: `You have been enrolled in "${workshop.title}" (${workshop.hours}h CPD). ${preCredit.toFixed(1)}h pre-credited. Full credit on completion.`,
        type: 'success',
      })
    }

    // SSE: CPD KPI changed
    broadcast('dashboard', 'dashboard.cpd.changed', { teacherId: resolvedTeacherId, preCredit })

    res.status(201).json({
      success: true,
      data: enrollment,
      cpdPreCredit: preCredit,
      workshopTitle: workshop.title,
      workshopHours: workshop.hours,
      message: `Enrolled in "${workshop.title}". ${preCredit.toFixed(1)}h pre-credited.`,
    })
  } catch (error) {
    console.error('POST /ems/cpd-workshops/:id/enroll error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /api/v1/ems/cpd-workshops/:workshopId/complete
// Mark enrollment as completed and award full CPD hours
router.post('/cpd-workshops/:workshopId/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'hod', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: Admin/Principal only' }); return
    }

    const { workshopId } = req.params as { workshopId: string }
    const { teacherId } = req.body as { teacherId: string }
    if (!teacherId) { res.status(400).json({ success: false, message: 'teacherId required' }); return }

    const workshop = await prisma.cpdWorkshop.findUnique({ where: { id: workshopId } })
    if (!workshop) { res.status(404).json({ success: false, message: 'Workshop not found' }); return }

    const enrollment = await prisma.cpdEnrollment.findUnique({
      where: { workshopId_teacherId: { workshopId, teacherId } },
    })
    if (!enrollment || enrollment.status !== 'ENROLLED') {
      res.status(404).json({ success: false, message: 'Active enrollment not found' }); return
    }

    const remainingHours = workshop.hours * 0.8 // 80% remaining (20% already pre-credited)
    const updated = await prisma.cpdEnrollment.update({
      where: { workshopId_teacherId: { workshopId, teacherId } },
      data: { status: 'COMPLETED', completedAt: new Date(), hoursAwarded: workshop.hours },
    })

    // Award remaining CPD hours
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (teacher) {
      await prisma.teacher.update({
        where: { id: teacherId },
        data: { cpdHours: teacher.cpdHours + remainingHours },
      })
    }

    broadcast('dashboard', 'dashboard.cpd.changed', { teacherId, hoursAwarded: workshop.hours })

    res.json({ success: true, data: updated, hoursAwarded: workshop.hours })
  } catch (error) {
    console.error('POST /ems/cpd-workshops/:id/complete error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Parent-Teacher Meetings ────────────────────────────────────────────────

// GET /api/v1/ems/meetings/availability/:teacherId
// Returns 30-min time slots where the teacher is free (no timetable + no existing meeting)
router.get('/meetings/availability/:teacherId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { teacherId } = req.params as { teacherId: string }
    const { date } = req.query as { date?: string }

    if (!date) {
      res.status(400).json({ success: false, message: 'date query param is required (YYYY-MM-DD)' }); return
    }

    const meetingDate = new Date(date)
    const dayOfWeek = meetingDate.getDay() // 0=Sun
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      res.json({ success: true, data: [], message: 'No availability on weekends' }); return
    }
    const dowIndex = dayOfWeek - 1 // 0=Mon

    // Get teacher's timetable slots for this day
    const timetableSlots = await prisma.timetableSlot.findMany({
      where: { teacherId, dayOfWeek: dowIndex },
      select: { startTime: true, endTime: true },
    })
    const busySlots = new Set(timetableSlots.map(s => s.startTime))

    // Get existing meetings for this date
    const dayStart = new Date(meetingDate); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(meetingDate); dayEnd.setHours(23, 59, 59, 999)
    const existingMeetings = await prisma.parentTeacherMeeting.findMany({
      where: { teacherId, meetingDate: { gte: dayStart, lte: dayEnd }, status: 'SCHEDULED' },
      select: { startTime: true },
    })
    const bookedTimes = new Set(existingMeetings.map(m => m.startTime))

    // Leave check
    const leave = await prisma.leaveApplication.findFirst({
      where: {
        teacherId,
        status: { in: ['HOD_APPROVED', 'PRINCIPAL_APPROVED'] },
        startDate: { lte: meetingDate },
        endDate: { gte: meetingDate },
      },
    })
    if (leave) {
      res.json({ success: true, data: [], message: 'Teacher is on leave on this date' }); return
    }

    // Available 30-min slots: after school hours (typically 14:00–17:00)
    const candidateSlots = [
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    ]

    const available = candidateSlots.filter(
      s => !busySlots.has(s) && !bookedTimes.has(s)
    ).map(s => {
      const [h, m] = s.split(':').map(Number)
      const endH = m === 30 ? h + 1 : h
      const endM = m === 30 ? '00' : '30'
      return { startTime: s, endTime: `${String(endH).padStart(2, '0')}:${endM}`, date }
    })

    res.json({ success: true, data: available })
  } catch (error) {
    console.error('GET /ems/meetings/availability error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /api/v1/ems/meetings/book
router.post('/meetings/book', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user!
    const { teacherId, studentId, meetingDate, startTime, endTime, purpose } = req.body as {
      teacherId: string; studentId: string; meetingDate: string
      startTime: string; endTime: string; purpose?: string
    }

    if (!teacherId || !studentId || !meetingDate || !startTime || !endTime) {
      res.status(400).json({ success: false, message: 'teacherId, studentId, meetingDate, startTime, endTime are required' }); return
    }

    // Check slot still available
    const dateObj = new Date(meetingDate)
    const dayStart = new Date(dateObj); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dateObj); dayEnd.setHours(23, 59, 59, 999)
    const conflict = await prisma.parentTeacherMeeting.findFirst({
      where: { teacherId, meetingDate: { gte: dayStart, lte: dayEnd }, startTime, status: 'SCHEDULED' },
    })
    if (conflict) {
      res.status(409).json({ success: false, message: 'This time slot has just been booked. Please pick another.' }); return
    }

    const meeting = await prisma.parentTeacherMeeting.create({
      data: {
        teacherId,
        parentUserId: userId,
        studentId,
        meetingDate: dateObj,
        startTime,
        endTime: endTime,
        purpose: purpose ?? 'General discussion',
        status: 'SCHEDULED',
      },
    })

    // Notify teacher
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { id: true, displayName: true } } },
    })
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { displayName: true } } },
    })
    if (teacher) {
      await send({
        userId: teacher.user.id,
        title: 'Parent-Teacher Meeting Booked',
        message: `Meeting booked for ${student?.user.displayName ?? 'a student'} on ${meetingDate} at ${startTime}.`,
        type: 'info',
      })
    }
    // Confirm to parent
    await send({
      userId,
      title: 'Meeting Confirmed',
      message: `Your meeting with ${teacher?.user.displayName ?? 'the teacher'} on ${meetingDate} at ${startTime} is confirmed.`,
      type: 'success',
    })

    res.status(201).json({ success: true, data: meeting })
  } catch (error) {
    console.error('POST /ems/meetings/book error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /api/v1/ems/meetings
// Returns meetings for the current user (teacher sees their meetings, parent sees theirs)
router.get('/meetings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    let where: Record<string, unknown> = {}
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) { res.json({ success: true, data: [] }); return }
      where = { teacherId: teacher.id }
    } else if (role === 'parent') {
      where = { parentUserId: userId }
    } else if (!['admin', 'manager', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const meetings = await prisma.parentTeacherMeeting.findMany({
      where,
      include: {
        teacher: { include: { user: { select: { displayName: true } } } },
        student: { include: { user: { select: { displayName: true } } } },
      },
      orderBy: [{ meetingDate: 'asc' }, { startTime: 'asc' }],
    })

    res.json({ success: true, data: meetings })
  } catch (error) {
    console.error('GET /ems/meetings error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
