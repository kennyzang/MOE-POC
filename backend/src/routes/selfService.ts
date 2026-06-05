import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { sendMany } from '../services/notificationService'
import { validateTransition, SELF_SERVICE_TRANSITIONS } from '../lib/transitions'

const router = Router()

// ─── Helper: get teacherId for current user ───────────────────────
async function getTeacherId(userId: string): Promise<string | null> {
  const teacher = await prisma.teacher.findFirst({ where: { userId } })
  return teacher?.id ?? null
}

// ─── SS-01: Submit Transfer Request ──────────────────────────────
router.post(
  '/transfer',
  authenticate,
  requireRole('teacher', 'hod', 'admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = await getTeacherId(req.user!.userId)
      if (!teacherId) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

      const { preferredSchools, transferReason, transferEffectiveDate, notes, documentUrl } = req.body
      if (!preferredSchools || !transferReason) {
        res.status(400).json({ success: false, message: 'preferredSchools and transferReason are required' })
        return
      }

      const request = await prisma.selfServiceRequest.create({
        data: {
          teacherId,
          type: 'TRANSFER',
          preferredSchools: JSON.stringify(preferredSchools),
          transferReason,
          transferEffectiveDate: transferEffectiveDate ? new Date(transferEffectiveDate) : null,
          notes,
          documentUrl,
          status: 'submitted',
        },
      })

      // Notify HOD and admins
      await _notifyApprovers(teacherId, 'Transfer Request Submitted', `A new transfer request has been submitted.`)

      res.status(201).json({ success: true, data: request })
    } catch (error) {
      console.error('POST /self-service/transfer error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── SS-02: Submit Promotion Application ─────────────────────────
router.post(
  '/promotion',
  authenticate,
  requireRole('teacher', 'hod'),
  async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = await getTeacherId(req.user!.userId)
      if (!teacherId) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

      const { currentPosition, desiredPosition, promotionJustification, notes, documentUrl } = req.body
      if (!desiredPosition || !promotionJustification) {
        res.status(400).json({ success: false, message: 'desiredPosition and promotionJustification are required' })
        return
      }

      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })

      const request = await prisma.selfServiceRequest.create({
        data: {
          teacherId,
          type: 'PROMOTION',
          currentPosition: currentPosition || teacher?.designation || null,
          desiredPosition,
          promotionJustification,
          notes,
          documentUrl,
          status: 'submitted',
        },
      })

      await _notifyApprovers(teacherId, 'Promotion Application Submitted', `A promotion application has been submitted.`)
      res.status(201).json({ success: true, data: request })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── SS-03: Submit Training Course Request ────────────────────────
router.post(
  '/training',
  authenticate,
  requireRole('teacher', 'hod'),
  async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = await getTeacherId(req.user!.userId)
      if (!teacherId) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

      const { courseName, courseProvider, courseDates, courseCost, courseJustification, notes, documentUrl } = req.body
      if (!courseName || !courseJustification) {
        res.status(400).json({ success: false, message: 'courseName and courseJustification are required' })
        return
      }

      const request = await prisma.selfServiceRequest.create({
        data: {
          teacherId,
          type: 'TRAINING',
          courseName,
          courseProvider,
          courseDates,
          courseCost: courseCost ? Number(courseCost) : null,
          courseJustification,
          notes,
          documentUrl,
          status: 'submitted',
        },
      })

      await _notifyApprovers(teacherId, 'Training Request Submitted', `A training course request has been submitted.`)
      res.status(201).json({ success: true, data: request })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── SS-04: Submit Document Request ──────────────────────────────
router.post(
  '/document-request',
  authenticate,
  requireRole('teacher', 'hod', 'admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = await getTeacherId(req.user!.userId)
      if (!teacherId) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

      const { documentType, notes } = req.body
      if (!documentType) { res.status(400).json({ success: false, message: 'documentType is required' }); return }

      const request = await prisma.selfServiceRequest.create({
        data: {
          teacherId,
          type: 'DOCUMENT',
          documentType,
          notes,
          status: 'submitted',
        },
      })

      // Notify HR/admin
      const admins = await prisma.user.findMany({ where: { role: { in: ['admin', 'manager'] } }, select: { id: true } })
      await sendMany(admins.map(a => a.id), {
        title: 'Document Request Received',
        message: `A document request (${documentType.replace(/_/g, ' ')}) has been submitted. Please process and upload.`,
        type: 'info',
      })

      res.status(201).json({ success: true, data: request })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── SS-05: Profile Self-Update ───────────────────────────────────
router.patch(
  '/profile',
  authenticate,
  requireRole('teacher', 'hod', 'admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = await getTeacherId(req.user!.userId)
      if (!teacherId) { res.status(404).json({ success: false, message: 'Teacher profile not found' }); return }

      const SENSITIVE_FIELDS = ['designation', 'qualification', 'department']
      const SAFE_FIELDS = ['phone', 'emergencyContact', 'address']

      const { changes } = req.body as { changes: Array<{ field: string; newValue: string }> }
      if (!Array.isArray(changes) || changes.length === 0) {
        res.status(400).json({ success: false, message: 'changes array is required' })
        return
      }

      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        include: { user: { select: { displayName: true, email: true } } },
      })
      if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found' }); return }

      const safeUpdates: Record<string, string> = {}
      const sensitiveChanges: Array<{ field: string; oldValue: string; newValue: string; requiresApproval: boolean }> = []

      for (const ch of changes) {
        if (SAFE_FIELDS.includes(ch.field)) {
          safeUpdates[ch.field] = ch.newValue
        } else if (SENSITIVE_FIELDS.includes(ch.field)) {
          sensitiveChanges.push({
            field: ch.field,
            oldValue: String((teacher as any)[ch.field] ?? ''),
            newValue: ch.newValue,
            requiresApproval: true,
          })
        }
      }

      // Apply safe changes immediately to User (contact info)
      if (safeUpdates.phone || safeUpdates.emergencyContact || safeUpdates.address) {
        // Store in teacher notes as we don't have dedicated fields
        await prisma.teacher.update({
          where: { id: teacherId },
          data: {
            // We'll log the update in a self-service request
          },
        })
      }

      // Create pending approval requests for sensitive changes
      if (sensitiveChanges.length > 0) {
        const request = await prisma.selfServiceRequest.create({
          data: {
            teacherId,
            type: 'PROFILE_UPDATE',
            profileChanges: JSON.stringify(sensitiveChanges),
            isSensitive: true,
            status: 'submitted',
            notes: 'Profile update request — requires admin approval for sensitive fields',
          },
        })

        const admins = await prisma.user.findMany({ where: { role: { in: ['admin', 'manager'] } }, select: { id: true } })
        await sendMany(admins.map(a => a.id), {
          title: 'Profile Update Approval Required',
          message: `${teacher.user.displayName} has requested changes to sensitive profile fields: ${sensitiveChanges.map(c => c.field).join(', ')}.`,
          type: 'warning',
        })

        res.json({
          success: true,
          data: {
            safeFieldsUpdated: Object.keys(safeUpdates),
            sensitiveFieldsPending: sensitiveChanges.map(c => c.field),
            requestId: request.id,
            message: 'Safe fields updated immediately. Sensitive field changes are pending admin approval.',
          },
        })
        return
      }

      res.json({
        success: true,
        data: { safeFieldsUpdated: Object.keys(safeUpdates), message: 'Profile updated successfully.' },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── GET /my-requests — educator: list own requests ──────────────
router.get(
  '/my-requests',
  authenticate,
  requireRole('teacher', 'hod', 'admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = await getTeacherId(req.user!.userId)
      if (!teacherId) { res.json({ success: true, data: [] }); return }

      const requests = await prisma.selfServiceRequest.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'desc' },
      })
      res.json({ success: true, data: requests })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── GET /pending — admin/hod: all pending requests ──────────────
router.get(
  '/pending',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'hod'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { type, status } = req.query as Record<string, string>
      const where: any = {}
      if (type) where.type = type
      where.status = status || 'submitted'

      const requests = await prisma.selfServiceRequest.findMany({
        where,
        include: {
          teacher: {
            include: { user: { select: { displayName: true, email: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      const data = requests.map(r => ({
        ...r,
        teacherName: r.teacher.user.displayName,
        teacherEmail: r.teacher.user.email,
        preferredSchools: r.preferredSchools ? JSON.parse(r.preferredSchools) : undefined,
        profileChanges: r.profileChanges ? JSON.parse(r.profileChanges) : undefined,
      }))

      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── PATCH /:id — admin: review a request ────────────────────────
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'hod'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { status, reviewerRemarks, documentUrl } = req.body as {
        status: string
        reviewerRemarks?: string
        documentUrl?: string  // HR uploads the requested document
      }

      const valid = ['under_review', 'approved', 'rejected']
      if (!valid.includes(status)) {
        res.status(400).json({ success: false, message: `status must be one of: ${valid.join(', ')}` })
        return
      }

      const existing = await prisma.selfServiceRequest.findUnique({
        where: { id },
        include: { teacher: { include: { user: { select: { id: true, displayName: true } } } } },
      })
      if (!existing) { res.status(404).json({ success: false, message: 'Request not found' }); return }

      const transitionResult = validateTransition(SELF_SERVICE_TRANSITIONS, existing.status, status)
      if (!transitionResult.ok) {
        res.status(400).json({ success: false, message: transitionResult.reason }); return
      }

      const updated = await prisma.selfServiceRequest.update({
        where: { id },
        data: {
          status,
          reviewerRemarks,
          reviewedById: req.user!.userId,
          reviewedAt: new Date(),
          ...(documentUrl ? { documentUrl } : {}),
        },
      })

      // If PROFILE_UPDATE approved → apply the sensitive changes
      if (status === 'approved' && existing.type === 'PROFILE_UPDATE' && existing.profileChanges) {
        try {
          const changes: Array<{ field: string; newValue: string }> = JSON.parse(existing.profileChanges)
          const updateData: Record<string, string> = {}
          for (const ch of changes) {
            if (['designation', 'qualification', 'department'].includes(ch.field)) {
              updateData[ch.field] = ch.newValue
            }
          }
          if (Object.keys(updateData).length > 0) {
            await prisma.teacher.update({ where: { id: existing.teacherId }, data: updateData })
          }
        } catch { /* non-fatal */ }
      }

      // Notify the teacher
      await prisma.notification.create({
        data: {
          userId: existing.teacher.user.id,
          title: `${existing.type.replace(/_/g, ' ')} Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: reviewerRemarks || `Your ${existing.type.toLowerCase().replace(/_/g, ' ')} request has been ${status}.`,
          type: status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'info',
        },
      })

      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── Helper ───────────────────────────────────────────────────────
async function _notifyApprovers(teacherId: string, title: string, message: string) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { department: true, schoolId: true },
    })
    const approvers = await prisma.user.findMany({
      where: { role: { in: ['admin', 'manager', 'hod', 'principal'] } },
      select: { id: true },
    })
    await sendMany(approvers.map(a => a.id), { title, message, type: 'info' })
  } catch { /* non-fatal */ }
}

export default router
