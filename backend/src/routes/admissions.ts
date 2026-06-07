import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, schoolFilter, type AuthRequest } from '../middleware/auth'
import { sendMany } from '../services/notificationService'
import { broadcast } from './events'
import { getConfigInt } from '../lib/config'
import { USER_SELECT_NAME } from '../lib/querySelects'
import { validateTransition, ADMISSION_TRANSITIONS } from '../lib/transitions'
import { acceptOffer, EnrollmentError } from '../services/enrollmentService'

const router = Router()

// GET / — list admissions
router.get(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'admissions', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, search } = req.query as { status?: string; search?: string }
      const filter = schoolFilter(req)

      // schoolId on Admission is the target school; seeded records may have null.
      // Include records for this school OR unassigned (null) when school-scoped.
      const andClauses: any[] = []
      if (filter.schoolId) {
        andClauses.push({ OR: [{ schoolId: filter.schoolId }, { schoolId: null }] })
      }
      if (status) andClauses.push({ status })
      if (search) {
        andClauses.push({ OR: [
          { applicantName: { contains: search } },
          { parentName: { contains: search } },
          { gradeApplied: { contains: search } },
        ]})
      }
      const where: any = andClauses.length ? { AND: andClauses } : {}

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
        include: { user: { select: USER_SELECT_NAME } },
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
// GET /pipeline — counts per status stage (must be before /:id)
router.get(
  '/pipeline',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const statuses = ['draft', 'pending', 'submitted', 'under_review', 'offer_issued', 'accepted', 'offer_accepted', 'rejected', 'waitlisted']
      const counts = await Promise.all(
        statuses.map((s) => prisma.admission.count({ where: { status: s } })),
      )
      const pipeline = statuses.reduce<Record<string, number>>((acc, s, i) => {
        acc[s] = counts[i]
        return acc
      }, {})
      const total = counts.reduce((a, b) => a + b, 0)
      const accepted = (pipeline['accepted'] ?? 0) + (pipeline['offer_accepted'] ?? 0)
      const acceptanceRate = total > 0 ? Math.round((accepted / total) * 10000) / 100 : 0
      const scored = await prisma.admission.findMany({
        where: { status: { notIn: ['draft'] }, eligibilityScore: { not: null } },
        select: { eligibilityScore: true },
      })
      const avgEligibility = scored.length > 0
        ? Math.round((scored.reduce((s, a) => s + (a.eligibilityScore ?? 0), 0) / scored.length) * 10) / 10
        : 0
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const newThisWeek = await prisma.admission.count({ where: { createdAt: { gte: oneWeekAgo } } })
      res.json({ success: true, data: { pipeline, total, acceptanceRate, avgEligibility, newThisWeek } })
    } catch (error) {
      console.error('GET /admissions/pipeline error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /trend — weekly application volume for last 12 weeks (must be before /:id)
router.get(
  '/trend',
  authenticate,
  requireRole('admin', 'manager', 'admissions'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const twelveWeeksAgo = new Date()
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
      const admissions = await prisma.admission.findMany({
        where: { createdAt: { gte: twelveWeeksAgo } },
        select: { createdAt: true },
      })
      const weekMap: Record<number, number> = {}
      for (const a of admissions) {
        const diffDays = Math.floor((a.createdAt.getTime() - twelveWeeksAgo.getTime()) / (24 * 3600 * 1000))
        const weekIdx = Math.floor(diffDays / 7)
        if (weekIdx >= 0 && weekIdx < 12) weekMap[weekIdx] = (weekMap[weekIdx] ?? 0) + 1
      }
      const trend = Array.from({ length: 12 }, (_, i) => ({ week: `W${i + 1}`, count: weekMap[i] ?? 0 }))
      res.json({ success: true, data: trend })
    } catch (error) {
      console.error('GET /admissions/trend error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'admissions', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const admission = await prisma.admission.findUnique({
        where: { id: req.params.id as string },
        include: { documents: { orderBy: { uploadedAt: 'asc' } } },
      })
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

// ─── GET /:id/eligibility — run eligibility check with flags ─────
// SR-09
router.get(
  '/:id/eligibility',
  authenticate,
  requireRole('admin', 'manager', 'admissions', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const application = await prisma.admission.findUnique({
        where: { id: req.params.id as string },
        include: { documents: true },
      })
      if (!application) {
        res.status(404).json({ success: false, message: 'Application not found' })
        return
      }

      const flags: Array<{ flag: string; passed: boolean; message: string; severity: string }> = []

      // Age-grade check
      if (application.dateOfBirth) {
        const jan1 = new Date(new Date().getFullYear(), 0, 1)
        const age = Math.floor((jan1.getTime() - application.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000))
        const eligibleGrade = Math.min(Math.max(age - 5, 1), 12)
        const appliedNum = parseInt(String(application.gradeApplied).replace(/\D/g, '')) || 0
        const passed = eligibleGrade === appliedNum
        flags.push({
          flag: 'AGE_GRADE_MATCH',
          passed,
          message: passed ? `Age ${age} is appropriate for ${application.gradeApplied}.` : `Age ${age} suggests Year ${eligibleGrade}, but applying for ${application.gradeApplied}.`,
          severity: passed ? 'ok' : 'warning',
        })
      }

      // School capacity
      if (application.schoolId) {
        const gradeNum = parseInt(String(application.gradeApplied).replace(/\D/g, '')) || 0
        const maxCapacity = await getConfigInt('class_capacity_max', 35)
        const enrolled = await prisma.student.count({
          where: { schoolId: application.schoolId, gradeLevel: `Year ${gradeNum}`, enrollmentStatus: 'enrolled' },
        })
        const capacityOk = enrolled < maxCapacity * 5 // assume 5 classes per grade max
        flags.push({
          flag: 'SCHOOL_CAPACITY',
          passed: capacityOk,
          message: capacityOk ? `School has capacity for ${application.gradeApplied}.` : `School may be at or near capacity for ${application.gradeApplied}.`,
          severity: capacityOk ? 'ok' : 'warning',
        })
      }

      // Duplicate IC
      if (application.icNumber) {
        const dupStudent = await prisma.student.findFirst({ where: { icNumber: application.icNumber } })
        const dupApp = await prisma.admission.findFirst({
          where: { icNumber: application.icNumber, id: { not: application.id }, status: { notIn: ['rejected'] } },
        })
        const noDup = !dupStudent && !dupApp
        flags.push({
          flag: 'NO_DUPLICATE',
          passed: noDup,
          message: noDup ? 'No duplicate student or application found.' : dupStudent ? 'A student with this IC is already enrolled.' : 'Another active application exists with this IC.',
          severity: noDup ? 'ok' : 'error',
        })
      }

      // Documents completeness
      const requiredDocTypes = ['BIRTH_CERTIFICATE', 'STUDENT_IC', 'PARENT_IC', 'PHOTO']
      const uploadedTypes = application.documents.map(d => d.type)
      const missingDocs = requiredDocTypes.filter(t => !uploadedTypes.includes(t))
      const docsOk = missingDocs.length === 0
      flags.push({
        flag: 'DOCUMENTS_COMPLETE',
        passed: docsOk,
        message: docsOk ? 'All required documents uploaded.' : `Missing: ${missingDocs.join(', ')}.`,
        severity: docsOk ? 'ok' : 'warning',
      })

      // Update flags in DB
      await prisma.admission.update({
        where: { id: application.id },
        data: { eligibilityFlags: JSON.stringify(flags) },
      })

      res.json({ success: true, data: { flags, score: application.eligibilityScore } })
    } catch (error) {
      console.error('GET /admissions/:id/eligibility error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── PATCH /documents/:docId — verify or reject a document ───────
// SR-08
router.patch(
  '/documents/:docId',
  authenticate,
  requireRole('admin', 'manager', 'admissions', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const docId = req.params.docId as string
      const { docStatus, rejectionReason } = req.body as { docStatus: string; rejectionReason?: string }

      const validStatuses = ['verified', 'rejected', 'required', 'pending']
      if (!docStatus || !validStatuses.includes(docStatus)) {
        res.status(400).json({ success: false, message: `docStatus must be one of: ${validStatuses.join(', ')}` })
        return
      }

      const doc = await prisma.admissionDocument.findUnique({ where: { id: docId } })
      if (!doc) {
        res.status(404).json({ success: false, message: 'Document not found' })
        return
      }

      const updated = await prisma.admissionDocument.update({
        where: { id: docId },
        data: { docStatus, rejectionReason: rejectionReason || null },
      })

      res.json({ success: true, data: updated })
    } catch (error) {
      console.error('PATCH /admissions/documents/:docId error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── POST /:id/request-documents — request additional docs ───────
// SR-08
router.post(
  '/:id/request-documents',
  authenticate,
  requireRole('admin', 'manager', 'admissions', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { note } = req.body as { note: string }

      if (!note) {
        res.status(400).json({ success: false, message: 'note is required' })
        return
      }

      const application = await prisma.admission.findUnique({ where: { id } })
      if (!application) {
        res.status(404).json({ success: false, message: 'Application not found' })
        return
      }

      const transitionResult = validateTransition(ADMISSION_TRANSITIONS, application.status, 'documents_required')
      if (!transitionResult.ok) {
        res.status(400).json({ success: false, message: transitionResult.reason })
        return
      }

      const updated = await prisma.admission.update({
        where: { id },
        data: { status: 'documents_required', documentsRequiredNote: note },
      })

      // Notify parent if they have an account
      if (application.guardianUserId) {
        await prisma.notification.create({
          data: {
            userId: application.guardianUserId,
            title: 'Additional Documents Required',
            message: `Your application (${application.applicationNumber}) requires additional documents: ${note}`,
            type: 'warning',
          },
        })
      }

      res.json({ success: true, data: updated })
    } catch (error) {
      console.error('POST /admissions/:id/request-documents error:', error)
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

      const transitionResult = validateTransition(ADMISSION_TRANSITIONS, existing.status, status)
      if (!transitionResult.ok) {
        res.status(400).json({ success: false, message: transitionResult.reason })
        return
      }

      const updateData: any = { status }
      if (remarks !== undefined) updateData.remarks = remarks
      if (['accepted', 'rejected', 'waitlisted', 'offer_accepted'].includes(status)) {
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
      if (status && status !== existing.status) {
        const transitionResult = validateTransition(ADMISSION_TRANSITIONS, existing.status, status)
        if (!transitionResult.ok) {
          res.status(400).json({ success: false, message: transitionResult.reason })
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
          gradeApplied: application.gradeApplied,   // echo back so client can confirm age→grade calc
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

      const targetStatus = statusMap[decision]
      const transitionResult = validateTransition(ADMISSION_TRANSITIONS, application.status, targetStatus)
      if (!transitionResult.ok) {
        res.status(400).json({ success: false, message: transitionResult.reason })
        return
      }

      const updated = await prisma.admission.update({
        where: { id },
        data: {
          status: targetStatus,
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

      // Notify all clients so pipeline and KPI refresh
      const pendingCount = await prisma.admission.count({ where: { status: { in: ['draft', 'submitted', 'under_review'] } } })
      broadcast('dashboard', 'dashboard.applications.changed', { pendingApplications: pendingCount, decision })

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
      const result = await acceptOffer(id, req.user?.userId ?? 'system')
      res.json({ success: true, data: result })
    } catch (err) {
      if (err instanceof EnrollmentError) {
        const statusCode = { NOT_FOUND: 404, INVALID_STATUS: 400, CLASS_FULL: 409 }[err.code]
        res.status(statusCode).json({ success: false, message: err.message })
      } else {
        console.error('POST /admissions/applications/:id/accept-offer error:', err)
        res.status(500).json({ success: false, message: 'Internal server error' })
      }
    }
  },
)

export default router
