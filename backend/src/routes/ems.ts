import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'
import { send, sendMany } from '../services/notificationService'
import { sendPushToUser } from '../services/pushService'
import { broadcast } from './events'
import { hodApprove, LeaveWorkflowError } from '../services/leaveWorkflowService'
import { getConfigFloat } from '../lib/config'
import { calculateWorkingDays } from '../lib/leaveCalendar'

const router = Router()

// ─── Multer (CPD resource file uploads) ────────────────────────
const cpdUploadDir = path.join(process.cwd(), 'uploads', 'cpd-resources')
if (!fs.existsSync(cpdUploadDir)) fs.mkdirSync(cpdUploadDir, { recursive: true })

const cpdStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cpdUploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}-${safe}`)
  },
})
const cpdUpload = multer({ storage: cpdStorage, limits: { fileSize: 20 * 1024 * 1024 } })

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
// HOD initiates — selects teacher + academic year. Status starts at pending_self_assessment.
router.post('/performance-evaluations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: HOD/Admin only' })
      return
    }

    const { teacherId, academicYear, comments } = req.body

    if (!teacherId || !academicYear) {
      res.status(400).json({ success: false, message: 'teacherId and academicYear are required' })
      return
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { id: true, displayName: true, username: true } } },
    })
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found' })
      return
    }

    const evaluation = await prisma.performanceEvaluation.create({
      data: {
        teacherId,
        academicYear,
        evaluatorId: userId,
        comments: comments ?? null,
        status: 'pending_self_assessment',
      },
      include: {
        teacher: { include: { user: { select: { id: true, displayName: true, username: true } } } },
      },
    })

    // Notify teacher: fill in your self-assessment
    await send({
      userId: teacher.user.id,
      title: 'Performance Evaluation — Self-Assessment Required',
      message: `Your HOD has initiated a performance evaluation for ${academicYear}. Please complete your self-assessment and upload supporting evidence.`,
      type: 'info',
    })

    res.status(201).json({ success: true, data: evaluation })
  } catch (error) {
    console.error('Error creating performance evaluation:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /api/v1/ems/performance-evaluations/:id/teacher-submit
// Teacher submits their self-assessment (scores + text). Status: pending_self_assessment → self_assessment_submitted
router.patch('/performance-evaluations/:id/teacher-submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'teacher') {
      res.status(403).json({ success: false, message: 'Forbidden: teacher only' }); return
    }
    const id = req.params.id as string
    const {
      selfAssessment,
      selfAssessmentTeachingScore,
      selfAssessmentProfessionalScore,
      selfAssessmentConductScore,
    } = req.body

    if (!selfAssessment?.trim()) {
      res.status(400).json({ success: false, message: 'selfAssessment text is required' }); return
    }
    if (
      selfAssessmentTeachingScore === undefined ||
      selfAssessmentProfessionalScore === undefined ||
      selfAssessmentConductScore === undefined
    ) {
      res.status(400).json({ success: false, message: 'All three self-assessed dimension scores are required' }); return
    }

    const evaluation = await prisma.performanceEvaluation.findUnique({
      where: { id },
      include: { teacher: { include: { user: { select: { id: true } } } } },
    })
    if (!evaluation) { res.status(404).json({ success: false, message: 'Evaluation not found' }); return }
    if (evaluation.teacher.user.id !== userId) {
      res.status(403).json({ success: false, message: 'You can only submit your own self-assessment' }); return
    }
    if (evaluation.status !== 'pending_self_assessment') {
      res.status(400).json({ success: false, message: 'Self-assessment can only be submitted when status is pending_self_assessment' }); return
    }

    const updated = await (prisma.performanceEvaluation as any).update({
      where: { id },
      data: {
        selfAssessment: selfAssessment.trim(),
        selfAssessmentTeachingScore: Number(selfAssessmentTeachingScore),
        selfAssessmentProfessionalScore: Number(selfAssessmentProfessionalScore),
        selfAssessmentConductScore: Number(selfAssessmentConductScore),
        selfAssessmentSubmittedAt: new Date(),
        status: 'self_assessment_submitted',
      },
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
    })

    // Notify HOD: teacher has submitted self-assessment
    const evaluator = await prisma.user.findUnique({ where: { id: evaluation.evaluatorId }, select: { id: true } })
    if (evaluator) {
      await send({
        userId: evaluator.id,
        title: 'Self-Assessment Submitted',
        message: `${(updated as any).teacher.user.displayName} has completed their self-assessment for ${(updated as any).academicYear}. Please review and fill in your evaluation scores.`,
        type: 'info',
      })
    }

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /ems/performance-evaluations/:id/teacher-submit error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /api/v1/ems/performance-evaluations/:id/submit
// HOD fills in their scores and submits for principal review. Status: self_assessment_submitted → submitted
router.patch('/performance-evaluations/:id/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    const id = req.params.id as string

    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: HOD/Admin only' })
      return
    }

    const { teachingScore, professionalScore, conductScore, comments } = req.body

    const evaluation = await prisma.performanceEvaluation.findUnique({
      where: { id },
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
    })
    if (!evaluation) {
      res.status(404).json({ success: false, message: 'Evaluation not found' })
      return
    }

    if (!['draft', 'self_assessment_submitted'].includes(evaluation.status)) {
      res.status(400).json({ success: false, message: 'Evaluation cannot be submitted in its current state' })
      return
    }

    // Scores are required when submitting for review
    if (teachingScore === undefined || professionalScore === undefined || conductScore === undefined) {
      res.status(400).json({ success: false, message: 'All three evaluation scores are required to submit for principal review' })
      return
    }

    const ts = Number(teachingScore)
    const ps = Number(professionalScore)
    const cs = Number(conductScore)
    const overallScore = calcOverallScore(ts, ps, cs)
    const rating = calcRating(overallScore)

    const updated = await prisma.performanceEvaluation.update({
      where: { id },
      data: {
        teachingScore: ts,
        professionalScore: ps,
        conductScore: cs,
        overallScore,
        rating,
        comments: comments ?? evaluation.comments,
        status: 'submitted',
        submittedAt: new Date(),
      },
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
    })

    // Notify evaluated teacher
    await send({
      userId: updated.teacher.user.id,
      title: 'Performance Evaluation Submitted for Review',
      message: `Your performance evaluation for ${updated.academicYear} has been reviewed by your HOD and submitted to the principal.`,
      type: 'info',
    })
    // Notify principals
    const principals = await prisma.user.findMany({
      where: { role: { in: ['principal', 'admin'] } },
      select: { id: true },
    })
    await sendMany(
      principals.map(p => p.id),
      {
        title: 'Performance Evaluation Awaiting Review',
        message: `Evaluation for ${updated.teacher.user.displayName} (${updated.academicYear}) — Overall: ${overallScore.toFixed(1)}, Rating: ${rating}`,
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

    // Notify teacher of outcome
    await send({
      userId: updated.teacher.user.id,
      title: `Performance Evaluation ${action === 'approve' ? 'Approved' : 'Rejected'}`,
      message: `Your performance evaluation for ${updated.academicYear} has been ${action === 'approve' ? 'approved' : 'rejected'} by the principal.${reviewerComments ? ` Comments: ${reviewerComments}` : ''}`,
      type: action === 'approve' ? 'success' : 'warning',
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
    const daysRequested = await calculateWorkingDays(start, end)

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

    const result = await hodApprove(id, decision, userId, notes)
    res.json({ success: true, data: result })
  } catch (err) {
    if (err instanceof LeaveWorkflowError) {
      const statusCode = { NOT_FOUND: 404, INVALID_STATUS: 400, FORBIDDEN: 403 }[err.code]
      res.status(statusCode).json({ success: false, message: err.message })
    } else {
      console.error('Error approving leave application:', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
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
      include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
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

    // Notify the absent teacher that their substitute is confirmed
    await send({
      userId: leave.teacher.user.id,
      title: 'Substitute Confirmed for Your Leave',
      message: `${substituteTeacher.user.displayName} has been assigned to cover your classes from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()}. Your students and their parents have been notified.`,
      type: 'success',
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

    // If teacher: find their record once for both subject filter and enrollment check
    let subjectFilter: string | undefined
    let currentTeacherId: string | undefined
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      subjectFilter = teacher?.subjects?.split(',')[0]?.trim() ?? undefined
      currentTeacherId = teacher?.id
    }

    // Admin/hod/principal see all workshops including draft
    // Teachers only see open/full future workshops (+ their enrolled ones regardless of date)
    let workshopWhere: any
    if (role === 'teacher') {
      const availableFilter: any = {
        status: { in: ['open', 'full'] },
        startDate: { gte: new Date() },
        ...(subjectFilter ? { subject: { contains: subjectFilter } } : {}),
      }
      workshopWhere = currentTeacherId
        ? { OR: [availableFilter, { enrollments: { some: { teacherId: currentTeacherId, status: 'ENROLLED' } } }] }
        : availableFilter
    } else {
      workshopWhere = {}
    }

    const workshops = await prisma.cpdWorkshop.findMany({
      where: workshopWhere,
      include: {
        enrollments: { select: { teacherId: true, status: true } },
      },
      orderBy: { startDate: 'asc' },
    })

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

    // Update workshop to 'full' if capacity is now reached
    const activeCount = await prisma.cpdEnrollment.count({ where: { workshopId, status: 'ENROLLED' } })
    if (activeCount >= workshop.maxParticipants) {
      await prisma.cpdWorkshop.update({ where: { id: workshopId }, data: { status: 'full' } })
    }

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

// GET /api/v1/ems/cpd-workshops/:workshopId/enrollees — list teachers enrolled in a workshop
router.get('/cpd-workshops/:workshopId/enrollees', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }
    const { workshopId } = req.params as { workshopId: string }
    const enrollments = await prisma.cpdEnrollment.findMany({
      where: { workshopId, status: 'ENROLLED' },
      include: {
        teacher: {
          include: { user: { select: { displayName: true } } },
        },
      },
      orderBy: { enrolledAt: 'asc' },
    })
    res.json({
      success: true,
      data: enrollments.map(e => ({
        teacherId: e.teacherId,
        displayName: e.teacher.user.displayName,
        department: e.teacher.department,
        enrolledAt: e.enrolledAt,
      })),
    })
  } catch (error) {
    console.error('GET /ems/cpd-workshops/:id/enrollees error:', error)
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

// ─── TPA: Teacher Self-Assessment ──────────────────────────────────────────

// PATCH /api/v1/ems/performance-evaluations/:id/self-assess
// Allows the evaluated teacher to add a self-reflection comment before HOD submits
router.patch('/performance-evaluations/:id/self-assess', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (role !== 'teacher') {
      res.status(403).json({ success: false, message: 'Only the evaluated teacher can submit a self-assessment' }); return
    }

    const id = req.params.id as string
    const { selfAssessment } = req.body as { selfAssessment: string }
    if (!selfAssessment?.trim()) {
      res.status(400).json({ success: false, message: 'selfAssessment text is required' }); return
    }

    const evaluation = await prisma.performanceEvaluation.findUnique({
      where: { id },
      include: { teacher: { include: { user: { select: { id: true } } } } },
    })
    if (!evaluation) { res.status(404).json({ success: false, message: 'Evaluation not found' }); return }

    // Confirm the requesting teacher is the subject of this evaluation
    if (evaluation.teacher.user.id !== userId) {
      res.status(403).json({ success: false, message: 'You can only self-assess your own evaluation' }); return
    }

    if (!['draft', 'pending_self_assessment'].includes(evaluation.status)) {
      res.status(400).json({ success: false, message: 'Self-assessment can only be saved while in draft or pending self-assessment' }); return
    }

    const {
      selfAssessmentTeachingScore,
      selfAssessmentProfessionalScore,
      selfAssessmentConductScore,
    } = req.body as {
      selfAssessmentTeachingScore?: number
      selfAssessmentProfessionalScore?: number
      selfAssessmentConductScore?: number
    }

    const updated = await (prisma.performanceEvaluation as any).update({
      where: { id },
      data: {
        selfAssessment: selfAssessment.trim(),
        ...(selfAssessmentTeachingScore !== undefined && { selfAssessmentTeachingScore: Number(selfAssessmentTeachingScore) }),
        ...(selfAssessmentProfessionalScore !== undefined && { selfAssessmentProfessionalScore: Number(selfAssessmentProfessionalScore) }),
        ...(selfAssessmentConductScore !== undefined && { selfAssessmentConductScore: Number(selfAssessmentConductScore) }),
      },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /ems/performance-evaluations/:id/self-assess error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── TPA: Evaluation History ────────────────────────────────────────────────

// GET /api/v1/ems/teachers/:id/evaluation-history
// Returns all evaluations for a teacher sorted by year, with a trend indicator
router.get('/teachers/:id/evaluation-history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const teacherId = req.params.id as string

    // Teachers can only view their own history
    if (role === 'teacher') {
      const me = await prisma.teacher.findUnique({ where: { userId } })
      if (!me || me.id !== teacherId) {
        res.status(403).json({ success: false, message: 'Forbidden' }); return
      }
    } else if (!['admin', 'manager', 'hod', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const evaluations = await prisma.performanceEvaluation.findMany({
      where: { teacherId },
      orderBy: { academicYear: 'asc' },
      select: {
        id: true, academicYear: true,
        teachingScore: true, professionalScore: true, conductScore: true,
        overallScore: true, rating: true, status: true,
        submittedAt: true, reviewedAt: true,
      },
    })

    // Derive trend from the last two approved evaluations
    const approved = evaluations.filter(e => e.status === 'approved' && e.overallScore != null)
    let trend: 'improving' | 'declining' | 'stable' | 'insufficient_data' = 'insufficient_data'
    if (approved.length >= 2) {
      const last = approved[approved.length - 1].overallScore!
      const prev = approved[approved.length - 2].overallScore!
      const diff = last - prev
      trend = diff > 2 ? 'improving' : diff < -2 ? 'declining' : 'stable'
    }

    res.json({ success: true, data: { evaluations, trend } })
  } catch (error) {
    console.error('GET /ems/teachers/:id/evaluation-history error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── CPD: Create Workshop ────────────────────────────────────────────────────

// POST /api/v1/ems/cpd-workshops
router.post('/cpd-workshops', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: Admin/HOD only' }); return
    }

    const {
      title, provider, subject, hours, startDate, endDate, location, maxParticipants, category,
      description, objectives, targetAudience, prerequisites, facilitatorId, imageUrl,
    } = req.body as {
      title: string; provider?: string; subject?: string; hours: number
      startDate: string; endDate: string; location?: string; maxParticipants?: number; category?: string
      description?: string; objectives?: string; targetAudience?: string; prerequisites?: string
      facilitatorId?: string; imageUrl?: string
    }

    if (!title || !hours || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'title, hours, startDate, endDate are required' }); return
    }

    const workshop = await prisma.cpdWorkshop.create({
      data: {
        title,
        provider: provider ?? null,
        subject: subject ?? null,
        description: description ?? null,
        objectives: objectives ?? null,
        targetAudience: targetAudience ?? null,
        prerequisites: prerequisites ?? null,
        facilitatorId: facilitatorId ?? null,
        imageUrl: imageUrl ?? null,
        hours: Number(hours),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location: location ?? null,
        maxParticipants: maxParticipants ? Number(maxParticipants) : 30,
        category: category ?? 'General',
        status: 'draft',
      },
    })

    res.status(201).json({ success: true, data: workshop })
  } catch (error) {
    console.error('POST /ems/cpd-workshops error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── CPD: Withdraw ──────────────────────────────────────────────────────────

// PATCH /api/v1/ems/cpd-workshops/:workshopId/withdraw
router.patch('/cpd-workshops/:workshopId/withdraw', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const { workshopId } = req.params as { workshopId: string }
    const { teacherId: bodyTeacherId } = req.body as { teacherId?: string }

    let resolvedTeacherId: string
    if (bodyTeacherId && ['admin', 'manager', 'hod', 'principal'].includes(role)) {
      resolvedTeacherId = bodyTeacherId
    } else {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }
      resolvedTeacherId = teacher.id
    }

    const enrollment = await prisma.cpdEnrollment.findUnique({
      where: { workshopId_teacherId: { workshopId, teacherId: resolvedTeacherId } },
    })
    if (!enrollment || enrollment.status !== 'ENROLLED') {
      res.status(404).json({ success: false, message: 'Active enrollment not found' }); return
    }

    const workshop = await prisma.cpdWorkshop.findUnique({ where: { id: workshopId } })
    if (!workshop) { res.status(404).json({ success: false, message: 'Workshop not found' }); return }

    // Reverse the 20% pre-credit that was awarded on enrollment
    const preCredit = workshop.hours * 0.2
    const teacher = await prisma.teacher.findUnique({ where: { id: resolvedTeacherId } })
    if (teacher) {
      await prisma.teacher.update({
        where: { id: resolvedTeacherId },
        data: { cpdHours: Math.max(0, teacher.cpdHours - preCredit) },
      })
    }

    // Mark enrollment as withdrawn
    await prisma.cpdEnrollment.update({
      where: { workshopId_teacherId: { workshopId, teacherId: resolvedTeacherId } },
      data: { status: 'WITHDRAWN' },
    })

    // Re-open workshop if it was full
    if (workshop.status === 'full') {
      const activeCount = await prisma.cpdEnrollment.count({
        where: { workshopId, status: 'ENROLLED' },
      })
      if (activeCount < workshop.maxParticipants) {
        await prisma.cpdWorkshop.update({ where: { id: workshopId }, data: { status: 'open' } })
      }
    }

    broadcast('dashboard', 'dashboard.cpd.changed', { teacherId: resolvedTeacherId, withdrawn: true })

    res.json({ success: true, message: `Withdrawn from "${workshop.title}". ${preCredit.toFixed(1)}h pre-credit reversed.` })
  } catch (error) {
    console.error('PATCH /ems/cpd-workshops/:id/withdraw error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── CPD: TPA-CPD Recommendations ──────────────────────────────────────────

// GET /api/v1/ems/cpd-workshops/recommendations?teacherId=&basedOn=<evaluationId>
// Returns up to 5 open workshops relevant to the teacher's lowest TPA dimension
router.get('/cpd-workshops/recommendations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const { teacherId: qTeacherId, basedOn } = req.query as { teacherId?: string; basedOn?: string }

    let resolvedTeacherId: string
    if (qTeacherId && ['admin', 'manager', 'hod', 'principal'].includes(role)) {
      resolvedTeacherId = qTeacherId
    } else {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      if (!teacher) { res.json({ success: true, data: [] }); return }
      resolvedTeacherId = teacher.id
    }

    // Fetch evaluation to determine lowest dimension
    let targetCategory: string | undefined
    let targetSubject: string | undefined

    if (basedOn) {
      const evaluation = await prisma.performanceEvaluation.findUnique({ where: { id: basedOn } })
      if (evaluation && evaluation.teachingScore != null && evaluation.professionalScore != null && evaluation.conductScore != null) {
        const lowestDim = (
          [
            { dim: 'teaching', score: evaluation.teachingScore },
            { dim: 'professional', score: evaluation.professionalScore },
            { dim: 'conduct', score: evaluation.conductScore },
          ] as { dim: string; score: number }[]
        ).sort((a, b) => a.score - b.score)[0].dim

        if (lowestDim === 'teaching') {
          // Recommend workshops matching teacher's subject
          const teacher = await prisma.teacher.findUnique({ where: { id: resolvedTeacherId } })
          targetSubject = teacher?.subjects?.split(',')[0]?.trim()
        } else if (lowestDim === 'professional') {
          targetCategory = 'Subject Knowledge'
        } else {
          // conduct — classroom management / ethics
          targetCategory = 'Leadership'
        }
      }
    }

    // Get teacher's existing enrollments to exclude already-enrolled workshops
    const enrolled = await prisma.cpdEnrollment.findMany({
      where: { teacherId: resolvedTeacherId, status: 'ENROLLED' },
      select: { workshopId: true },
    })
    const enrolledIds = new Set(enrolled.map(e => e.workshopId))

    const workshops = await prisma.cpdWorkshop.findMany({
      where: {
        status: 'open',
        startDate: { gte: new Date() },
        ...(targetCategory ? { category: targetCategory } : {}),
        ...(targetSubject ? { subject: { contains: targetSubject } } : {}),
        NOT: { id: { in: Array.from(enrolledIds) } },
      },
      include: { enrollments: { select: { teacherId: true, status: true } } },
      orderBy: { startDate: 'asc' },
      take: 5,
    })

    const result = workshops.map(w => ({
      ...w,
      enrolledCount: w.enrollments.filter(e => e.status === 'ENROLLED').length,
      alreadyEnrolled: false,
      recommendationReason: targetSubject ? `Matches your subject area (${targetSubject})`
        : targetCategory === 'Subject Knowledge' ? 'Strengthens professional knowledge'
        : targetCategory === 'Leadership' ? 'Supports classroom management and conduct'
        : 'Recommended for your development',
    }))

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('GET /ems/cpd-workshops/recommendations error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /api/v1/ems/cpd-workshops/options — distinct provider/subject/location for dropdown autocomplete
router.get('/cpd-workshops/options', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }
    const [providers, subjects, locations] = await Promise.all([
      prisma.cpdWorkshop.findMany({ where: { provider: { not: null } }, select: { provider: true }, distinct: ['provider'] }),
      prisma.cpdWorkshop.findMany({ where: { subject: { not: null } }, select: { subject: true }, distinct: ['subject'] }),
      prisma.cpdWorkshop.findMany({ where: { location: { not: null } }, select: { location: true }, distinct: ['location'] }),
    ])
    res.json({
      success: true,
      data: {
        providers: providers.map(r => r.provider).filter(Boolean) as string[],
        subjects: subjects.map(r => r.subject).filter(Boolean) as string[],
        locations: locations.map(r => r.location).filter(Boolean) as string[],
      },
    })
  } catch (error) {
    console.error('GET /ems/cpd-workshops/options error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /api/v1/ems/cpd-workshops/:workshopId — full detail
// NOTE: must be registered AFTER /recommendations and /options to avoid route shadowing
router.get('/cpd-workshops/:workshopId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    if (!['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }
    const { workshopId } = req.params as { workshopId: string }

    let currentTeacherId: string | undefined
    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      currentTeacherId = teacher?.id
    }

    const workshop = await prisma.cpdWorkshop.findUnique({
      where: { id: workshopId },
      include: {
        facilitator: { include: { user: { select: { displayName: true } } } },
        sessions: { orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }] },
        resources: { orderBy: { createdAt: 'asc' } },
        enrollments: {
          include: {
            teacher: {
              include: { user: { select: { displayName: true } } },
            },
          },
          orderBy: { enrolledAt: 'asc' },
        },
      },
    })
    if (!workshop) { res.status(404).json({ success: false, message: 'Workshop not found' }); return }

    const canSeeEnrollees = ['admin', 'manager', 'hod', 'principal'].includes(role)
    const enrolledCount = workshop.enrollments.filter(e => e.status === 'ENROLLED').length

    res.json({
      success: true,
      data: {
        ...workshop,
        facilitatorName: workshop.facilitator?.user?.displayName ?? null,
        facilitatorDepartment: workshop.facilitator?.department ?? null,
        enrolledCount,
        alreadyEnrolled: currentTeacherId
          ? workshop.enrollments.some(e => e.teacherId === currentTeacherId && e.status === 'ENROLLED')
          : false,
        enrollees: canSeeEnrollees
          ? workshop.enrollments.map(e => ({
              teacherId: e.teacherId,
              displayName: e.teacher.user.displayName,
              department: e.teacher.department,
              enrolledAt: e.enrolledAt,
              status: e.status,
              hoursAwarded: e.hoursAwarded,
            }))
          : [],
      },
    })
  } catch (error) {
    console.error('GET /ems/cpd-workshops/:id error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /api/v1/ems/cpd-workshops/:workshopId — edit workshop
router.patch('/cpd-workshops/:workshopId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: Admin/HOD only' }); return
    }
    const { workshopId } = req.params as { workshopId: string }

    const {
      title, provider, subject, description, objectives, targetAudience, prerequisites,
      facilitatorId, imageUrl, hours, startDate, endDate, location, maxParticipants, category, status,
    } = req.body as Record<string, any>

    const workshop = await prisma.cpdWorkshop.findUnique({ where: { id: workshopId } })
    if (!workshop) { res.status(404).json({ success: false, message: 'Workshop not found' }); return }

    const updated = await prisma.cpdWorkshop.update({
      where: { id: workshopId },
      data: {
        ...(title !== undefined && { title }),
        ...(provider !== undefined && { provider }),
        ...(subject !== undefined && { subject }),
        ...(description !== undefined && { description }),
        ...(objectives !== undefined && { objectives }),
        ...(targetAudience !== undefined && { targetAudience }),
        ...(prerequisites !== undefined && { prerequisites }),
        ...(facilitatorId !== undefined && { facilitatorId: facilitatorId || null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(hours !== undefined && { hours: Number(hours) }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(location !== undefined && { location }),
        ...(maxParticipants !== undefined && { maxParticipants: Number(maxParticipants) }),
        ...(category !== undefined && { category }),
        ...(status !== undefined && { status }),
      },
    })
    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /ems/cpd-workshops/:id error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /api/v1/ems/cpd-workshops/:workshopId
router.delete('/cpd-workshops/:workshopId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden: Admin only' }); return
    }
    const { workshopId } = req.params as { workshopId: string }

    const activeEnrollments = await prisma.cpdEnrollment.count({
      where: { workshopId, status: 'ENROLLED' },
    })
    if (activeEnrollments > 0) {
      res.status(400).json({ success: false, message: 'Cannot delete workshop with active enrollments' }); return
    }

    await prisma.cpdWorkshop.delete({ where: { id: workshopId } })
    res.json({ success: true, message: 'Workshop deleted' })
  } catch (error) {
    console.error('DELETE /ems/cpd-workshops/:id error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── CPD: Sessions ───────────────────────────────────────────────────────────

// POST /api/v1/ems/cpd-workshops/:workshopId/sessions
router.post('/cpd-workshops/:workshopId/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }
    const { workshopId } = req.params as { workshopId: string }
    const { title, sessionDate, startTime, endTime, room } = req.body as {
      title: string; sessionDate: string; startTime: string; endTime: string; room?: string
    }
    if (!title || !sessionDate || !startTime || !endTime) {
      res.status(400).json({ success: false, message: 'title, sessionDate, startTime, endTime required' }); return
    }

    const session = await prisma.cpdWorkshopSession.create({
      data: { workshopId, title, sessionDate: new Date(sessionDate), startTime, endTime, room: room ?? null },
    })
    res.status(201).json({ success: true, data: session })
  } catch (error) {
    console.error('POST /ems/cpd-workshops/:id/sessions error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /api/v1/ems/cpd-workshops/:workshopId/sessions/:sessionId
router.patch('/cpd-workshops/:workshopId/sessions/:sessionId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }
    const { sessionId } = req.params as { sessionId: string }
    const { title, sessionDate, startTime, endTime, room, status } = req.body as Record<string, any>

    const updated = await prisma.cpdWorkshopSession.update({
      where: { id: sessionId },
      data: {
        ...(title !== undefined && { title }),
        ...(sessionDate !== undefined && { sessionDate: new Date(sessionDate) }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(room !== undefined && { room: room || null }),
        ...(status !== undefined && { status }),
      },
    })
    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /ems/cpd-workshops/:id/sessions/:sid error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /api/v1/ems/cpd-workshops/:workshopId/sessions/:sessionId
router.delete('/cpd-workshops/:workshopId/sessions/:sessionId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }
    const { sessionId } = req.params as { sessionId: string }
    await prisma.cpdWorkshopSession.delete({ where: { id: sessionId } })
    res.json({ success: true, message: 'Session deleted' })
  } catch (error) {
    console.error('DELETE /ems/cpd-workshops/:id/sessions/:sid error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── CPD: Resources ──────────────────────────────────────────────────────────

// POST /api/v1/ems/cpd-workshops/:workshopId/resources
router.post('/cpd-workshops/:workshopId/resources', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const { workshopId } = req.params as { workshopId: string }

    // Allow facilitator of this workshop to add resources
    const workshop = await prisma.cpdWorkshop.findUnique({ where: { id: workshopId } })
    if (!workshop) { res.status(404).json({ success: false, message: 'Workshop not found' }); return }

    const isAdmin = ['admin', 'manager', 'hod'].includes(role)
    let isFacilitator = false
    if (!isAdmin && workshop.facilitatorId) {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      isFacilitator = teacher?.id === workshop.facilitatorId
    }
    if (!isAdmin && !isFacilitator) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const { title, type, url } = req.body as { title: string; type?: string; url: string }
    if (!title || !url) {
      res.status(400).json({ success: false, message: 'title and url required' }); return
    }

    const resource = await prisma.cpdWorkshopResource.create({
      data: { workshopId, title, type: type ?? 'document', url, uploadedById: userId },
    })
    res.status(201).json({ success: true, data: resource })
  } catch (error) {
    console.error('POST /ems/cpd-workshops/:id/resources error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /api/v1/ems/cpd-workshops/:workshopId/resources/upload — file upload
router.post('/cpd-workshops/:workshopId/resources/upload', authenticate, cpdUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const { workshopId } = req.params as { workshopId: string }

    const workshop = await prisma.cpdWorkshop.findUnique({ where: { id: workshopId } })
    if (!workshop) { res.status(404).json({ success: false, message: 'Workshop not found' }); return }

    const isAdmin = ['admin', 'manager', 'hod'].includes(role)
    let isFacilitator = false
    if (!isAdmin && workshop.facilitatorId) {
      const teacher = await prisma.teacher.findUnique({ where: { userId } })
      isFacilitator = teacher?.id === workshop.facilitatorId
    }
    if (!isAdmin && !isFacilitator) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' }); return
    }

    const { title, type } = req.body as { title?: string; type?: string }
    const fileUrl = `/uploads/cpd-resources/${req.file.filename}`
    const resource = await prisma.cpdWorkshopResource.create({
      data: {
        workshopId,
        title: title || req.file.originalname,
        type: type ?? 'document',
        url: fileUrl,
        uploadedById: userId,
      },
    })
    res.status(201).json({ success: true, data: resource })
  } catch (error) {
    console.error('POST /ems/cpd-workshops/:id/resources/upload error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /api/v1/ems/cpd-workshops/:workshopId/resources/:resourceId
router.delete('/cpd-workshops/:workshopId/resources/:resourceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    if (!['admin', 'manager', 'hod'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }
    const { resourceId } = req.params as { resourceId: string }
    await prisma.cpdWorkshopResource.delete({ where: { id: resourceId } })
    res.json({ success: true, message: 'Resource deleted' })
  } catch (error) {
    console.error('DELETE /ems/cpd-workshops/:id/resources/:rid error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
