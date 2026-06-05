import type { LeaveApplication } from '@prisma/client'
import prisma from '../lib/prisma'
import { send, sendMany } from './notificationService'
import { broadcast } from '../lib/sse'
import { validateTransition, LEAVE_TRANSITIONS } from '../lib/transitions'

// Duplicated from leaveEnhanced.ts to avoid circular import.
// Source of truth should be moved to lib/leaveConstants.ts if it needs sharing beyond these two files.
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

export class LeaveWorkflowError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'INVALID_STATUS' | 'FORBIDDEN',
    message: string,
  ) {
    super(message)
    this.name = 'LeaveWorkflowError'
  }
}

// Extracted from ems.ts POST /leave-applications/:id/approve
export async function hodApprove(
  leaveId: string,
  decision: 'APPROVE' | 'REJECT',
  hodUserId: string,
  comment?: string,
): Promise<LeaveApplication> {
  const application = await prisma.leaveApplication.findUnique({
    where: { id: leaveId },
    include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
  })
  if (!application) throw new LeaveWorkflowError('NOT_FOUND', 'Leave application not found')

  const newStatus = decision === 'APPROVE' ? 'HOD_APPROVED' : 'REJECTED'
  const transitionResult = validateTransition(LEAVE_TRANSITIONS, application.status, newStatus)
  if (!transitionResult.ok) throw new LeaveWorkflowError('INVALID_STATUS', transitionResult.reason)

  const updated = await prisma.leaveApplication.update({
    where: { id: leaveId },
    data: { status: newStatus, hodApproverId: hodUserId, hodApprovedAt: new Date(), hodRemarks: comment ?? null },
  })

  await send({
    userId: application.teacher.user.id,
    title: decision === 'APPROVE' ? 'Leave Approved' : 'Leave Rejected',
    message: decision === 'APPROVE'
      ? `Your ${application.leaveType} leave from ${application.startDate.toDateString()} to ${application.endDate.toDateString()} has been approved.`
      : `Your ${application.leaveType} leave application has been rejected. Reason: ${comment ?? 'No reason provided'}`,
    type: decision === 'APPROVE' ? 'success' : 'warning',
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

    const principalUsers = await prisma.user.findMany({ where: { role: 'principal' }, select: { id: true } })
    await sendMany(
      principalUsers.map(u => u.id),
      {
        title: 'Substitute Assignment Needed',
        message: `${application.teacher.user.displayName}'s leave (${application.startDate.toDateString()}–${application.endDate.toDateString()}) has been approved. Please assign a substitute.`,
        type: 'info',
      },
    )
    broadcast('dashboard', 'dashboard.staff.changed', {})
  }

  return updated
}

// Extracted from leaveEnhanced.ts PATCH /:id/principal-approve
export async function principalDecide(
  leaveId: string,
  decision: 'APPROVE' | 'REJECT',
  principalUserId: string,
  remarks?: string,
): Promise<LeaveApplication> {
  const application = await prisma.leaveApplication.findUnique({
    where: { id: leaveId },
    include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
  })
  if (!application) throw new LeaveWorkflowError('NOT_FOUND', 'Leave application not found')

  const newStatus = decision === 'APPROVE' ? 'PRINCIPAL_APPROVED' : 'REJECTED'
  const transitionResult = validateTransition(LEAVE_TRANSITIONS, application.status, newStatus)
  if (!transitionResult.ok) throw new LeaveWorkflowError('INVALID_STATUS', transitionResult.reason)

  const updated = await prisma.leaveApplication.update({
    where: { id: leaveId },
    data: {
      status: newStatus,
      principalApproverId: principalUserId,
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

  return updated
}

// Extracted from leaveEnhanced.ts PATCH /:id/cancel
export async function cancelLeave(
  leaveId: string,
  requesterId: string,
  cancellationReason?: string,
): Promise<LeaveApplication> {
  const application = await prisma.leaveApplication.findUnique({
    where: { id: leaveId },
    include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
  })
  if (!application) throw new LeaveWorkflowError('NOT_FOUND', 'Leave application not found')

  // Ownership check: must be the owning teacher or an admin
  const ownTeacher = await prisma.teacher.findUnique({ where: { userId: requesterId } })
  const requesterUser = await prisma.user.findUnique({ where: { id: requesterId }, select: { role: true } })
  const isOwner = ownTeacher?.id === application.teacherId
  const isAdmin = ['admin', 'manager', 'principal'].includes(requesterUser?.role ?? '')
  if (!isOwner && !isAdmin) throw new LeaveWorkflowError('FORBIDDEN', 'Forbidden')

  const transitionResult = validateTransition(LEAVE_TRANSITIONS, application.status, 'CANCELLED')
  if (!transitionResult.ok) throw new LeaveWorkflowError('INVALID_STATUS', transitionResult.reason)

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
    where: { id: leaveId },
    data: {
      status: 'CANCELLED',
      cancellationReason: cancellationReason ?? null,
      cancelledAt: new Date(),
      cancelledBy: requesterId,
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

  return updated
}
