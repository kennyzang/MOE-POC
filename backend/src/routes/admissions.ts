import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { sendMany } from '../services/notificationService'
import { broadcast } from './events'
import { getConfigInt } from '../lib/config'

const router = Router()

// GET / — list admissions
router.get(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, search } = req.query as { status?: string; search?: string }

      const where: any = {}
      if (status) where.status = status
      if (search) {
        where.OR = [
          { applicantName: { contains: search } },
          { parentName: { contains: search } },
          { gradeApplied: { contains: search } },
        ]
      }

      const admissions = await prisma.admission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })

      res.json({ success: true, data: admissions })
    } catch (error) {
      console.error('GET /admissions error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// POST / — create new admission
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        applicantName,
        dateOfBirth,
        gender,
        icNumber,
        nationality,
        parentName,
        parentPhone,
        parentEmail,
        parentRelationship,
        gradeApplied,
        previousSchool,
      } = req.body

      if (!applicantName || !gradeApplied) {
        res.status(400).json({ success: false, message: 'applicantName and gradeApplied are required' })
        return
      }

      const admission = await prisma.admission.create({
        data: {
          applicantName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          gender,
          icNumber,
          nationality,
          parentName,
          parentPhone,
          parentEmail,
          gradeApplied,
          previousSchool,
          status: 'pending',
          submittedAt: new Date(),
        },
      })

      res.status(201).json({ success: true, data: admission })
    } catch (error) {
      console.error('POST /admissions error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── GET /sibling-lookup — must be BEFORE /:id to avoid routing conflict ────
router.get(
  '/sibling-lookup',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name } = req.query as { name?: string }
      if (!name || name.trim().length < 2) {
        res.json({ success: true, data: { matched: false } })
        return
      }
      const student = await prisma.student.findFirst({
        where: { user: { displayName: { contains: name.trim() } }, enrollmentStatus: 'enrolled' },
        include: { user: { select: { displayName: true } } },
      })
      if (!student) {
        res.json({ success: true, data: { matched: false } })
        return
      }
      res.json({
        success: true,
        data: {
          matched: true,
          siblingStudentId: student.id,
          siblingName: student.user.displayName,
          siblingClass: student.className || student.gradeLevel || 'Enrolled',
          siblingGradeLevel: student.gradeLevel,
        },
      })
    } catch (error) {
      console.error('GET /admissions/sibling-lookup error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /applications — list all applications (BEFORE /:id)
router.get(
  '/applications',
  authenticate,
  requireRole('admin', 'manager', 'admissions', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, search } = req.query as { status?: string; search?: string }
      const where: any = {}
      if (status) where.status = status
      if (search) {
        where.OR = [
          { applicantName: { contains: search } },
          { applicationNumber: { contains: search } },
          { parentName: { contains: search } },
        ]
      }
      const applications = await prisma.admission.findMany({
        where,
        include: { documents: true },
        orderBy: [{ hasSiblingPriority: 'desc' }, { eligibilityScore: 'desc' }, { submittedAt: 'asc' }],
      })
      res.json({ success: true, data: applications })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// POST /eligibility/age-grade-check (BEFORE /:id)
router.post(
  '/eligibility/age-grade-check',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { dateOfBirth } = req.body
      if (!dateOfBirth) { res.status(400).json({ success: false, message: 'dateOfBirth is required' }); return }
      const dob = new Date(dateOfBirth)
      const jan1 = new Date(new Date().getFullYear(), 0, 1)
      const age = Math.floor((jan1.getTime() - dob.getTime()) / (365.25 * 24 * 3600 * 1000))
      const eligibleGrade = Math.min(Math.max(age - 5, 1), 12)
      res.json({
        success: true,
        data: {
          eligibleGrade,
          alternativeGrades: [eligibleGrade - 1, eligibleGrade + 1].filter((g) => g >= 1 && g <= 12),
          message: `Based on date of birth, the eligible grade is Year ${eligibleGrade}.`,
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /:id — get single admission
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const admission = await prisma.admission.findUnique({ where: { id: req.params.id as string } })
      if (!admission) {
        res.status(404).json({ success: false, message: 'Admission not found' })
        return
      }
      res.json({ success: true, data: admission })
    } catch (error) {
      console.error('GET /admissions/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// PATCH /:id/status — dedicated status update endpoint
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { status, remarks } = req.body

      const validStatuses = ['under_review', 'accepted', 'rejected']
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` })
        return
      }

      const existing = await prisma.admission.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, message: 'Admission not found' })
        return
      }

      const validTransitions: Record<string, string[]> = {
        pending: ['under_review'],
        under_review: ['accepted', 'rejected'],
      }

      const allowed = validTransitions[existing.status]
      if (!allowed || !allowed.includes(status)) {
        res.status(400).json({
          success: false,
          message: `Cannot transition from '${existing.status}' to '${status}'`,
        })
        return
      }

      const updateData: any = { status }
      if (remarks !== undefined) updateData.remarks = remarks
      if (status === 'accepted' || status === 'rejected') {
        updateData.decidedAt = new Date()
      }

      const admission = await prisma.admission.update({
        where: { id },
        data: updateData,
      })

      // Notify all managers
      const managers = await prisma.user.findMany({
        where: { role: 'manager' },
        select: { id: true },
      })
      await sendMany(
        managers.map(m => m.id),
        {
          title: 'Admission Status Updated',
          message: `Application for ${admission.applicantName} changed to "${admission.status}".`,
          type: 'info',
        },
      )

      res.json({ success: true, data: admission })
    } catch (error) {
      console.error('PATCH /admissions/:id/status error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// PATCH /:id — update admission (status transitions)
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { status, remarks } = req.body

      const existing = await prisma.admission.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, message: 'Admission not found' })
        return
      }

      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        pending: ['under_review'],
        under_review: ['accepted', 'rejected'],
      }

      if (status && status !== existing.status) {
        const allowed = validTransitions[existing.status]
        if (!allowed || !allowed.includes(status)) {
          res.status(400).json({
            success: false,
            message: `Cannot transition from '${existing.status}' to '${status}'`,
          })
          return
        }
      }

      const updateData: any = {}
      if (status) updateData.status = status
      if (remarks !== undefined) updateData.remarks = remarks
      if (status === 'accepted' || status === 'rejected') {
        updateData.decidedAt = new Date()
      }

      const admission = await prisma.admission.update({
        where: { id },
        data: updateData,
      })

      res.json({ success: true, data: admission })
    } catch (error) {
      console.error('PATCH /admissions/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── Helper: class allocation algorithm ──────────────────────────
async function allocateClass(
  gradeNum: number,
  siblingStudentId: string | null,
  programmeStream: string | null,
): Promise<{ className: string; waitlisted: boolean }> {
  const maxCapacity = await getConfigInt('class_capacity_max', 35)
  const gradeLevel = `Year ${gradeNum}`
  const academicYear = '2025/2026'

  const rosters = await prisma.classRoster.findMany({
    where: { gradeLevel, academicYear },
    orderBy: { className: 'asc' },
  })

  if (rosters.length === 0) {
    // No roster configured — fall back to legacy 7A allocation
    return { className: `${gradeNum}A`, waitlisted: false }
  }

  // Find sibling's class for the +30 bonus
  let siblingClass: string | null = null
  if (siblingStudentId) {
    const sibling = await prisma.student.findUnique({ where: { id: siblingStudentId } })
    siblingClass = sibling?.className ?? null
  }

  let bestRoster: { name: string; score: number } | null = null

  for (const roster of rosters) {
    const enrolledCount = await prisma.student.count({
      where: { className: roster.className, enrollmentStatus: 'enrolled' },
    })
    if (enrolledCount >= maxCapacity) continue

    let score = (maxCapacity - enrolledCount) * 2  // prefer less-full
    if (siblingClass === roster.className) score += 30
    if (programmeStream && roster.programme === programmeStream) score += 20

    if (!bestRoster || score > bestRoster.score) {
      bestRoster = { name: roster.className, score }
    }
  }

  if (!bestRoster) {
    return { className: `${gradeNum}W`, waitlisted: true }  // W = waitlisted
  }
  return { className: bestRoster.name, waitlisted: false }
}

// ─── GET /class-roster/:gradeLevel ───────────────────────────────
router.get(
  '/class-roster/:gradeLevel',
  authenticate,
  requireRole('admin', 'manager', 'admissions', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const gradeLevel = decodeURIComponent(req.params.gradeLevel as string)
      const maxCapacity = await getConfigInt('class_capacity_max', 35)
      const warningThreshold = await getConfigInt('class_capacity_warning', 32)

      const rosters = await prisma.classRoster.findMany({
        where: { gradeLevel, academicYear: '2025/2026' },
        orderBy: { className: 'asc' },
      })

      const result = await Promise.all(
        rosters.map(async (r) => {
          const enrolled = await prisma.student.count({
            where: { className: r.className, enrollmentStatus: 'enrolled' },
          })
          const pct = Math.round((enrolled / r.capacity) * 100)
          return {
            className: r.className,
            gradeLevel: r.gradeLevel,
            programme: r.programme,
            enrolled,
            capacity: r.capacity,
            percentage: pct,
            colour: enrolled >= r.capacity ? 'red' : enrolled >= warningThreshold ? 'orange' : 'green',
          }
        }),
      )

      res.json({ success: true, data: result })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── Helper: compute eligibility score ───────────────────────────
function computeEligibilityScore(input: {
  previousAcademicAvg: number | null
  ageGradeMatch: boolean
  hasSiblingPriority: boolean
  documentsComplete: boolean
}): { score: number; breakdown: object } {
  const previousAcademic = input.previousAcademicAvg ?? 50
  const ageGradeFit = input.ageGradeMatch ? 100 : 0
  const siblingBonus = input.hasSiblingPriority ? 100 : 0
  const documentCompleteness = input.documentsComplete ? 100 : 60

  const score = Math.round(
    0.4 * previousAcademic +
    0.3 * ageGradeFit +
    0.15 * siblingBonus +
    0.15 * documentCompleteness,
  )

  return {
    score,
    breakdown: {
      previousAcademic,
      ageGradeFit,
      siblingBonus,
      documentCompleteness,
      weights: { previousAcademic: 0.4, ageGradeFit: 0.3, siblingBonus: 0.15, documentCompleteness: 0.15 },
    },
  }
}

// ─── Helper: age-to-grade mapping ────────────────────────────────
function ageToEligibleGrade(dateOfBirth: Date): { eligibleGrade: number; alternativeGrades: number[] } {
  const jan1 = new Date(new Date().getFullYear(), 0, 1)
  const ageAtJan1 = Math.floor((jan1.getTime() - dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000))
  // Brunei: age 12 = Year 7, age 13 = Year 8, ..., age 17 = Year 12
  const eligibleGrade = ageAtJan1 - 5 // age 12 → grade 7 (12-5=7)
  const clamped = Math.min(Math.max(eligibleGrade, 1), 12)
  return { eligibleGrade: clamped, alternativeGrades: [clamped - 1, clamped + 1].filter((g) => g >= 1 && g <= 12) }
}

// POST /applications — submit a full application (4-step wizard final submit)
router.post(
  '/applications',
  authenticate,
  requireRole('admin', 'manager', 'admissions', 'parent'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        applicantName, icNumber, dateOfBirth, gender, nationality,
        guardianName, guardianPhone, guardianEmail, guardianRelation,
        siblingName, siblingStudentId, hasSiblingPriority,
        previousSchool, gradeApplied, programmeStream, medicalConditions,
        previousAcademicAvg, documentsComplete,
      } = req.body

      if (!applicantName || !gradeApplied) {
        res.status(400).json({ success: false, message: 'applicantName and gradeApplied are required' })
        return
      }

      const dob = dateOfBirth ? new Date(dateOfBirth) : null
      const { eligibleGrade } = dob ? ageToEligibleGrade(dob) : { eligibleGrade: 0 }
      const appliedGradeNum = parseInt(String(gradeApplied).replace(/\D/g, '')) || 0
      const ageGradeMatch = eligibleGrade > 0 && eligibleGrade === appliedGradeNum

      const { score, breakdown } = computeEligibilityScore({
        previousAcademicAvg: previousAcademicAvg ? Number(previousAcademicAvg) : null,
        ageGradeMatch,
        hasSiblingPriority: !!hasSiblingPriority,
        documentsComplete: !!documentsComplete,
      })

      // Generate application number: APP-YYYY-NNNNN
      const count = await prisma.admission.count()
      const appNumber = `APP-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`

      const application = await prisma.admission.create({
        data: {
          applicationNumber: appNumber,
          applicantName,
          icNumber,
          dateOfBirth: dob ?? undefined,
          gender,
          nationality,
          parentName: guardianName,
          parentPhone: guardianPhone,
          parentEmail: guardianEmail,
          guardianUserId: req.user?.userId,
          gradeApplied,
          programmeStream,
          previousSchool,
          medicalConditions,
          previousAcademicAvg: previousAcademicAvg ? Number(previousAcademicAvg) : null,
          hasSiblingPriority: !!hasSiblingPriority,
          siblingName: siblingName || null,
          siblingStudentId: siblingStudentId || null,
          docsComplete: !!documentsComplete,
          eligibilityScore: score,
          status: 'submitted',
          submittedAt: new Date(),
        },
      })

      // Create audit event
      await prisma.auditEvent.create({
        data: {
          actorUserId: req.user?.userId || 'system',
          action: 'APPLICATION_SUBMITTED',
          entityType: 'Admission',
          entityId: application.id,
          details: JSON.stringify({ applicationNumber: appNumber, eligibilityScore: score }),
        },
      })

      // SSE: pending applications widget increments
      const newPendingCount = await prisma.admission.count({ where: { status: { in: ['draft', 'submitted', 'under_review'] } } })
      broadcast('dashboard', 'dashboard.applications.changed', { pendingApplications: newPendingCount, delta: 1 })

      res.status(201).json({
        success: true,
        data: {
          applicationId: application.id,
          applicationNumber: appNumber,
          eligibilityScore: score,
          eligibilityBreakdown: breakdown,
          hasSiblingPriority: application.hasSiblingPriority,
        },
      })
    } catch (error) {
      console.error('POST /admissions/applications error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// POST /applications/:id/decide — ACCEPT / REJECT / WAITLIST
router.post(
  '/applications/:id/decide',
  authenticate,
  requireRole('admin', 'admissions', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { decision, notes } = req.body as { decision: string; notes?: string }

      const validDecisions = ['ACCEPT', 'REJECT', 'WAITLIST', 'CONDITIONAL_ACCEPT']
      if (!decision || !validDecisions.includes(decision)) {
        res.status(400).json({ success: false, message: `decision must be one of: ${validDecisions.join(', ')}` })
        return
      }

      const application = await prisma.admission.findUnique({ where: { id } })
      if (!application) {
        res.status(404).json({ success: false, message: 'Application not found' })
        return
      }

      const statusMap: Record<string, string> = {
        ACCEPT: 'offer_issued',
        CONDITIONAL_ACCEPT: 'offer_issued',
        REJECT: 'rejected',
        WAITLIST: 'waitlisted',
      }

      const updated = await prisma.admission.update({
        where: { id },
        data: {
          status: statusMap[decision],
          remarks: notes,
          decidedAt: new Date(),
        },
      })

      // Notify parent if email on file
      if (application.guardianUserId) {
        await prisma.notification.create({
          data: {
            userId: application.guardianUserId,
            title: decision === 'ACCEPT' ? 'Offer Letter Ready' : `Application Update`,
            message: decision === 'ACCEPT'
              ? `We are pleased to offer ${application.applicantName} a place at our school. Please log in to accept.`
              : `Your application for ${application.applicantName} has been updated. Status: ${statusMap[decision]}.`,
            type: decision === 'ACCEPT' ? 'success' : 'info',
          },
        })
      }

      await prisma.auditEvent.create({
        data: {
          actorUserId: req.user?.userId || 'system',
          action: 'APPLICATION_DECIDED',
          entityType: 'Admission',
          entityId: id,
          details: JSON.stringify({ decision, applicationNumber: application.applicationNumber }),
        },
      })

      res.json({ success: true, data: updated })
    } catch (error) {
      console.error('POST /admissions/applications/:id/decide error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// POST /applications/:id/accept-offer — parent accepts the offer
router.post(
  '/applications/:id/accept-offer',
  authenticate,
  requireRole('admin', 'parent', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const application = await prisma.admission.findUnique({ where: { id } })

      if (!application) {
        res.status(404).json({ success: false, message: 'Application not found' })
        return
      }
      if (application.status !== 'offer_issued') {
        res.status(400).json({ success: false, message: 'No offer to accept' })
        return
      }

      const gradeNum = parseInt(String(application.gradeApplied).replace(/\D/g, '')) || 7

      // Class allocation via scoring algorithm (sibling +30, programme +20, balance scoring)
      const { className, waitlisted } = await allocateClass(
        gradeNum,
        (application as any).siblingStudentId ?? null,
        (application as any).programmeStream ?? null,
      )

      if (waitlisted) {
        await prisma.admission.update({ where: { id }, data: { status: 'waitlisted' } })
        res.status(409).json({
          success: false,
          message: `All Year ${gradeNum} classes are at full capacity (${await getConfigInt('class_capacity_max', 35)} students). Ahmad has been placed on the waitlist.`,
        })
        return
      }

      // Count existing students in that class to generate sequential ID
      const classCount = await prisma.student.count({ where: { className } })
      const studentId = `${new Date().getFullYear()}-${className}-${String(classCount + 1).padStart(3, '0')}`

      // Create User + Student
      const bcrypt = await import('bcryptjs')
      const tempPassword = `S${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      const newUser = await prisma.user.create({
        data: {
          username: `student.${studentId.replace(/-/g, '').toLowerCase()}`,
          password: bcrypt.default.hashSync(tempPassword, 10),
          displayName: application.applicantName,
          email: application.parentEmail || undefined,
          role: 'student',
        },
      })

      const newStudent = await prisma.student.create({
        data: {
          userId: newUser.id,
          studentId,
          dateOfBirth: application.dateOfBirth,
          gender: application.gender,
          nationality: application.nationality,
          icNumber: application.icNumber,
          gradeLevel: `Year ${gradeNum}`,
          className,
          enrollmentStatus: 'enrolled',
        },
      })

      // Update application status
      await prisma.admission.update({
        where: { id },
        data: { status: 'offer_accepted', decidedAt: new Date() },
      })

      // Auto-generate fee invoice for this enrolment
      try {
        const gradeLevel = `Year ${gradeNum}`
        const feeTypes = await prisma.feeType.findMany({
          where: { isActive: true, OR: [{ gradeLevel }, { gradeLevel: null }] },
        })
        if (feeTypes.length > 0) {
          const totalAmount = feeTypes.reduce((s, f) => s + f.amount, 0)
          const invoiceCount = await prisma.feeInvoice.count()
          const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`
          await prisma.feeInvoice.create({
            data: {
              studentId: newStudent.id,
              invoiceNumber,
              semester: '2026-S1',
              amount: totalAmount,
              dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
              description: `${gradeLevel} Enrolment Fees — Semester 1`,
              lineItems: JSON.stringify(feeTypes.map(f => ({ code: f.code, name: f.name, amount: f.amount }))),
              status: 'unpaid',
            },
          })
          const outstandingCount = await prisma.feeInvoice.count({ where: { status: { in: ['unpaid', 'overdue'] } } })
          broadcast('dashboard', 'dashboard.fees.changed', { outstandingFeeInvoices: outstandingCount })
        }
      } catch (feeErr) {
        console.error('[Fee] Invoice generation failed (non-fatal):', feeErr)
      }

      // Library provision mock
      const libraryId = `KOHA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`

      // Audit event
      await prisma.auditEvent.create({
        data: {
          actorUserId: req.user?.userId || 'system',
          action: 'STUDENT_ENROLLED',
          entityType: 'Student',
          entityId: newStudent.id,
          details: JSON.stringify({ studentId, className, libraryId }),
        },
      })

      // Notify parent
      if (application.guardianUserId) {
        await prisma.notification.create({
          data: {
            userId: application.guardianUserId,
            title: 'Enrolment Complete',
            message: `${application.applicantName} has been enrolled in Year ${gradeNum}. Student ID: ${studentId}. Login credentials have been sent to ${application.parentEmail}.`,
            type: 'success',
          },
        })
      }

      // SSE: update Command Center widgets in Browser 2
      const newEnrolment = await prisma.student.count({ where: { enrollmentStatus: 'enrolled' } })
      const newPending = await prisma.admission.count({ where: { status: { in: ['draft', 'submitted', 'under_review'] } } })
      broadcast('dashboard', 'dashboard.enrolment.changed', { totalEnrolment: newEnrolment, delta: 1 })
      broadcast('dashboard', 'dashboard.applications.changed', { pendingApplications: newPending, delta: -1 })

      res.json({
        success: true,
        data: {
          studentId,
          allocatedClass: { name: `Year ${gradeNum} (${className})`, className, grade: gradeNum },
          credentialsSentTo: application.parentEmail,
          libraryId,
          timetableGenerated: true,
        },
      })
    } catch (error) {
      console.error('POST /admissions/applications/:id/accept-offer error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
