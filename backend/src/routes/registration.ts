import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import prisma from '../lib/prisma'
import { sendMany } from '../services/notificationService'
import { broadcast } from './events'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'admission-docs')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const router = Router()

// ─── GET /schools — public list of schools for dropdown ──────────
router.get('/schools', async (_req: Request, res: Response) => {
  try {
    const schools = await prisma.school.findMany({
      select: { id: true, name: true, code: true, schoolType: true, gradeLevels: true },
      orderBy: { name: 'asc' },
    })
    res.json({ success: true, data: schools })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Helper: sequential app number ───────────────────────────────
async function genApplicationNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.admission.count()
  return `APP-${year}-${String(count + 1).padStart(4, '0')}`
}

// ─── Helper: age-to-eligible-grade ───────────────────────────────
function ageToEligibleGrade(dob: Date): { eligibleGrade: number; alternativeGrades: number[] } {
  const jan1 = new Date(new Date().getFullYear(), 0, 1)
  const age = Math.floor((jan1.getTime() - dob.getTime()) / (365.25 * 24 * 3600 * 1000))
  const grade = Math.min(Math.max(age - 5, 1), 12)
  return { eligibleGrade: grade, alternativeGrades: [grade - 1, grade + 1].filter(g => g >= 1 && g <= 12) }
}

// ─── POST /submit — public application submission (no auth) ──────
// SR-01, SR-02, SR-03, SR-04, SR-06, SR-12, SR-13
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const {
      // Student
      applicantName, icNumber, dateOfBirth, gender, nationality,
      // Parent/Guardian
      parentName, parentIcNumber, parentRelationship, parentPhone, parentEmail, homeAddress,
      // School & Academic
      schoolId, gradeApplied, programmeStream, previousSchool, specialNeeds, medicalConditions,
      // Documents (base64 or filenames — we store the list, actual upload via /files)
      documentFilenames,
      // Academic
      previousAcademicAvg,
    } = req.body

    if (!applicantName || !gradeApplied || !parentName || !parentPhone) {
      res.status(400).json({ success: false, message: 'applicantName, gradeApplied, parentName, and parentPhone are required' })
      return
    }

    // SR-12: Duplicate IC check
    if (icNumber) {
      const existing = await prisma.student.findFirst({ where: { icNumber } })
      if (existing) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_IC',
          message: 'A student with this IC/Passport number is already registered in the system. If this is an error, please contact the school.',
        })
        return
      }
      // Also check existing pending applications with same IC
      const dupApp = await prisma.admission.findFirst({
        where: { icNumber, status: { notIn: ['rejected'] } },
      })
      if (dupApp) {
        res.status(409).json({
          success: false,
          code: 'DUPLICATE_APPLICATION',
          message: `An application for a student with this IC number already exists (${dupApp.applicationNumber}). Please check your application status using that ID.`,
        })
        return
      }
    }

    // SR-13: Sibling detection via parent IC
    let siblingStudentId: string | null = null
    let siblingName: string | null = null
    let hasSiblingPriority = false
    if (parentIcNumber) {
      // Find parent user with matching IC (stored in Parent profile or User email match)
      // Simpler: look for a parent whose child is enrolled and parent phone/email matches
      const parentRecord = await prisma.parent.findFirst({
        where: { user: { email: { equals: parentEmail || '' } } },
        include: { childLinks: { include: { student: { include: { user: true } } } } },
      })
      if (parentRecord && parentRecord.childLinks.length > 0) {
        const sibling = parentRecord.childLinks[0].student
        siblingStudentId = sibling.id
        siblingName = sibling.user.displayName
        hasSiblingPriority = true
      }
    }

    // Eligibility flags (SR-09)
    const flags: Array<{ flag: string; passed: boolean; message: string }> = []
    const dob = dateOfBirth ? new Date(dateOfBirth) : null
    if (dob) {
      const { eligibleGrade } = ageToEligibleGrade(dob)
      const appliedNum = parseInt(String(gradeApplied).replace(/\D/g, '')) || 0
      const ageMatch = eligibleGrade > 0 && eligibleGrade === appliedNum
      flags.push({
        flag: 'AGE_GRADE_MATCH',
        passed: ageMatch,
        message: ageMatch
          ? `Age is appropriate for ${gradeApplied}.`
          : `Age suggests Year ${eligibleGrade} but applying for ${gradeApplied}.`,
      })
    }
    if (schoolId) {
      const school = await prisma.school.findUnique({ where: { id: schoolId } })
      if (school) {
        const gradeLevels: string[] = JSON.parse(school.gradeLevels || '[]')
        const schoolHasGrade = gradeLevels.includes(gradeApplied) || gradeLevels.some(g => g.includes(String(gradeApplied).replace(/\D/g, '')))
        flags.push({
          flag: 'SCHOOL_OFFERS_GRADE',
          passed: schoolHasGrade,
          message: schoolHasGrade ? `${school.name} offers ${gradeApplied}.` : `${school.name} may not offer ${gradeApplied}.`,
        })
      }
    }
    flags.push({
      flag: 'NO_DUPLICATE',
      passed: true,
      message: 'No duplicate application or student record found.',
    })

    // Eligibility score
    const appliedNum = parseInt(String(gradeApplied).replace(/\D/g, '')) || 0
    const ageGradeFlag = flags.find(f => f.flag === 'AGE_GRADE_MATCH')
    const ageGradeMatch = ageGradeFlag ? ageGradeFlag.passed : false
    const score = Math.round(
      0.4 * (previousAcademicAvg ? Number(previousAcademicAvg) : 50) +
      0.3 * (ageGradeMatch ? 100 : 0) +
      0.15 * (hasSiblingPriority ? 100 : 0) +
      0.15 * 60, // docs not yet verified at submission
    )

    const appNumber = await genApplicationNumber()

    const application = await prisma.admission.create({
      data: {
        applicationNumber: appNumber,
        applicantName,
        icNumber: icNumber || null,
        dateOfBirth: dob ?? undefined,
        gender: gender || null,
        nationality: nationality || null,
        homeAddress: homeAddress || null,
        parentName,
        parentIcNumber: parentIcNumber || null,
        parentPhone,
        parentEmail: parentEmail || null,
        parentRelationship: parentRelationship || null,
        schoolId: schoolId || null,
        gradeApplied,
        programmeStream: programmeStream || null,
        previousSchool: previousSchool || null,
        medicalConditions: medicalConditions || null,
        specialNeeds: specialNeeds || null,
        previousAcademicAvg: previousAcademicAvg ? Number(previousAcademicAvg) : null,
        hasSiblingPriority,
        siblingName,
        siblingStudentId,
        docsComplete: false,
        eligibilityScore: score,
        eligibilityFlags: JSON.stringify(flags),
        status: 'submitted',
        submittedAt: new Date(),
      },
    })

    // Create document records from uploaded files (SR-03)
    if (Array.isArray(documentFilenames) && documentFilenames.length > 0) {
      const docs = await Promise.all(
        documentFilenames.map(async (f: { type: string; filename: string; data?: string; mimeType?: string }) => {
          let filePath: string | null = null
          if (f.data) {
            const ext = path.extname(f.filename) || '.bin'
            const savedName = `${randomUUID()}${ext}`
            const fullPath = path.join(UPLOADS_DIR, savedName)
            fs.writeFileSync(fullPath, Buffer.from(f.data, 'base64'))
            filePath = fullPath
          }
          return {
            admissionId: application.id,
            type: f.type || 'OTHER',
            filename: f.filename,
            filePath,
            docStatus: 'pending',
          }
        }),
      )
      await prisma.admissionDocument.createMany({ data: docs })
    }

    // SR-06: Notify admissions officers — try school-specific first, fall back to all
    let admissionsUsers = schoolId
      ? await prisma.user.findMany({ where: { role: 'admissions', schoolId }, select: { id: true } })
      : []
    if (admissionsUsers.length === 0) {
      // No school-specific officers found — notify all admissions users
      admissionsUsers = await prisma.user.findMany({ where: { role: 'admissions' }, select: { id: true } })
    }
    if (admissionsUsers.length > 0) {
      await sendMany(
        admissionsUsers.map(u => u.id),
        {
          title: 'New Registration Application',
          message: `${applicantName} has submitted an enrolment application (${appNumber}) for ${gradeApplied}.`,
          type: 'info',
          link: '/sis/admissions',
        },
      )
    }

    // SSE broadcast for dashboard
    const pendingCount = await prisma.admission.count({ where: { status: { in: ['submitted', 'under_review'] } } })
    broadcast('dashboard', 'dashboard.applications.changed', { pendingApplications: pendingCount, delta: 1 })

    await prisma.auditEvent.create({
      data: {
        actorUserId: 'public',
        action: 'PUBLIC_REGISTRATION_SUBMITTED',
        entityType: 'Admission',
        entityId: application.id,
        details: JSON.stringify({ applicationNumber: appNumber, applicantName }),
      },
    })

    res.status(201).json({
      success: true,
      data: {
        applicationId: application.id,
        applicationNumber: appNumber,
        eligibilityScore: score,
        hasSiblingPriority,
        siblingName: siblingName || undefined,
        message: `Application submitted successfully. Your application ID is ${appNumber}. Please save this ID to track your application status.`,
      },
    })
  } catch (error) {
    console.error('POST /registration/submit error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /status — public status check (no auth) ─────────────────
// SR-05: lookup by applicationNumber + parentIcNumber
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { appId, parentIc } = req.query as { appId?: string; parentIc?: string }

    if (!appId || !parentIc) {
      res.status(400).json({ success: false, message: 'appId and parentIc are required' })
      return
    }

    const application = await prisma.admission.findFirst({
      where: {
        applicationNumber: appId.trim().toUpperCase(),
        parentIcNumber: parentIc.trim(),
      },
      include: {
        documents: { select: { id: true, type: true, filename: true, docStatus: true, rejectionReason: true, uploadedAt: true } },
      },
    })

    // When enrolled, look up the new student record for credentials display
    let enrolledStudent: { studentId: string; className: string; gradeLevel: string; username: string } | null = null
    if (application && application.status === 'offer_accepted' && application.icNumber) {
      const student = await prisma.student.findFirst({
        where: { icNumber: application.icNumber },
        include: { user: { select: { username: true } } },
      })
      if (student) {
        enrolledStudent = {
          studentId: student.studentId,
          className: student.className ?? '',
          gradeLevel: student.gradeLevel ?? '',
          username: student.user.username,
        }
      }
    }

    if (!application) {
      res.status(404).json({
        success: false,
        message: 'No application found with that ID and Parent IC combination. Please check your details.',
      })
      return
    }

    const STATUS_LABELS: Record<string, string> = {
      draft: 'Draft',
      submitted: 'Submitted — Awaiting Review',
      under_review: 'Under Review',
      documents_required: 'Additional Documents Required',
      offer_issued: 'Offer Issued',
      offer_accepted: 'Enrolled',
      rejected: 'Application Rejected',
      waitlisted: 'Waitlisted',
    }

    const timeline = [
      { step: 'Submitted', done: !!application.submittedAt, date: application.submittedAt },
      { step: 'Under Review', done: ['under_review', 'documents_required', 'offer_issued', 'offer_accepted', 'rejected', 'waitlisted'].includes(application.status) },
      { step: 'Decision', done: ['offer_issued', 'offer_accepted', 'rejected', 'waitlisted'].includes(application.status), date: application.decidedAt },
      { step: 'Enrolled', done: application.status === 'offer_accepted' },
    ]

    res.json({
      success: true,
      data: {
        applicationNumber: application.applicationNumber,
        applicantName: application.applicantName,
        gradeApplied: application.gradeApplied,
        status: application.status,
        statusLabel: STATUS_LABELS[application.status] ?? application.status,
        submittedAt: application.submittedAt,
        decidedAt: application.decidedAt,
        remarks: application.remarks,
        documentsRequiredNote: application.documentsRequiredNote,
        documents: application.documents,
        timeline,
        enrolledStudent,
        parentEmail: application.parentEmail,
      },
    })
  } catch (error) {
    console.error('GET /registration/status error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
