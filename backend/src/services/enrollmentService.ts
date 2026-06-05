import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { getConfigInt } from '../lib/config'
import { broadcast } from '../lib/sse'
import { send } from './notificationService'
import { validateTransition, ADMISSION_TRANSITIONS } from '../lib/transitions'

export class EnrollmentError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'INVALID_STATUS' | 'CLASS_FULL',
    message: string,
  ) {
    super(message)
    this.name = 'EnrollmentError'
  }
}

export interface AcceptOfferResult {
  studentId: string
  allocatedClass: { name: string; className: string; grade: number }
  credentialsSentTo: string | null
  libraryId: string
  timetableGenerated: boolean
}

// Private — not exported. Only used within this service.
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
    return { className: `${gradeNum}A`, waitlisted: false }
  }

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

    let score = (maxCapacity - enrolledCount) * 2
    if (siblingClass === roster.className) score += 30
    if (programmeStream && roster.programme === programmeStream) score += 20

    if (!bestRoster || score > bestRoster.score) {
      bestRoster = { name: roster.className, score }
    }
  }

  if (!bestRoster) {
    return { className: `${gradeNum}W`, waitlisted: true }
  }
  return { className: bestRoster.name, waitlisted: false }
}

export async function acceptOffer(
  admissionId: string,
  actorUserId: string,
): Promise<AcceptOfferResult> {
  const application = await prisma.admission.findUnique({ where: { id: admissionId } })
  if (!application) {
    throw new EnrollmentError('NOT_FOUND', 'Application not found')
  }

  const transitionResult = validateTransition(ADMISSION_TRANSITIONS, application.status, 'offer_accepted')
  if (!transitionResult.ok) {
    throw new EnrollmentError('INVALID_STATUS', transitionResult.reason)
  }

  const gradeNum = parseInt(String(application.gradeApplied).replace(/\D/g, '')) || 7

  const { className, waitlisted } = await allocateClass(
    gradeNum,
    (application as any).siblingStudentId ?? null,
    (application as any).programmeStream ?? null,
  )

  if (waitlisted) {
    await prisma.admission.update({ where: { id: admissionId }, data: { status: 'waitlisted' } })
    const cap = await getConfigInt('class_capacity_max', 35)
    throw new EnrollmentError('CLASS_FULL', `All Year ${gradeNum} classes are at full capacity (${cap} students). The applicant has been placed on the waitlist.`)
  }

  const classCount = await prisma.student.count({ where: { className } })
  const studentId = `${new Date().getFullYear()}-${className}-${String(classCount + 1).padStart(3, '0')}`

  const tempPassword = `S${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const newUser = await prisma.user.create({
    data: {
      username: `student.${studentId.replace(/-/g, '').toLowerCase()}`,
      password: bcrypt.hashSync(tempPassword, 10),
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

  await prisma.admission.update({
    where: { id: admissionId },
    data: { status: 'offer_accepted', decidedAt: new Date() },
  })

  // Fee invoice generation — non-fatal
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
          description: `Year ${gradeNum} Enrolment Fees — Semester 1`,
          lineItems: JSON.stringify(feeTypes.map(f => ({ code: f.code, name: f.name, amount: f.amount }))),
          status: 'unpaid',
        },
      })
      const outstandingCount = await prisma.feeInvoice.count({ where: { status: { in: ['unpaid', 'overdue'] } } })
      broadcast('dashboard', 'dashboard.fees.changed', { outstandingFeeInvoices: outstandingCount })
    }
  } catch (feeErr) {
    console.error('[enrollmentService][fee] Invoice generation failed (non-fatal):', feeErr)
  }

  const libraryId = `KOHA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`

  await prisma.auditEvent.create({
    data: {
      actorUserId,
      action: 'STUDENT_ENROLLED',
      entityType: 'Student',
      entityId: newStudent.id,
      details: JSON.stringify({ studentId, className, libraryId }),
    },
  })

  if (application.guardianUserId) {
    await send({
      userId: application.guardianUserId,
      title: 'Enrolment Complete',
      message: `${application.applicantName} has been enrolled in Year ${gradeNum}. Student ID: ${studentId}. Login credentials have been sent to ${application.parentEmail}.`,
      type: 'success',
    })
  }

  const newEnrolment = await prisma.student.count({ where: { enrollmentStatus: 'enrolled' } })
  const newPending = await prisma.admission.count({ where: { status: { in: ['draft', 'submitted', 'under_review'] } } })
  broadcast('dashboard', 'dashboard.enrolment.changed', { totalEnrolment: newEnrolment, delta: 1 })
  broadcast('dashboard', 'dashboard.applications.changed', { pendingApplications: newPending, delta: -1 })

  return {
    studentId,
    allocatedClass: { name: `Year ${gradeNum} (${className})`, className, grade: gradeNum },
    credentialsSentTo: application.parentEmail ?? null,
    libraryId,
    timetableGenerated: true,
  }
}
