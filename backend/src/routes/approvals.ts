import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send, sendMany } from '../services/notificationService'
import { broadcast } from './events'

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function routingLabel(amount: number): string {
  if (amount < 500) return 'Auto-approved (< BND 500)'
  if (amount < 2000) return 'HOD approval required (BND 500 – 2,000)'
  return 'HOD + Principal approval required (> BND 2,000)'
}

async function enrichRequest(req: any) {
  let entitySummary = ''
  try {
    const meta = req.metadata ? JSON.parse(req.metadata) : {}
    entitySummary = meta.description ?? meta.entitySummary ?? ''
  } catch { /* ignore */ }

  let requesterName = 'Unknown'
  if (req.requestedBy) {
    const u = await prisma.user.findUnique({ where: { id: req.requestedBy }, select: { displayName: true } })
    requesterName = u?.displayName ?? 'Unknown'
  }
  return { ...req, entitySummary, requesterName }
}

// ── GET /approvals/inbox ──────────────────────────────────────────────────────
router.get(
  '/inbox',
  authenticate,
  requireRole('hod', 'principal', 'admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { role } = req.user!

      let where: Record<string, unknown> = {}
      if (role === 'hod') {
        where = { currentLevel: 1, status: 'PENDING' }
      } else if (role === 'principal') {
        where = {
          OR: [
            { currentLevel: 2, status: 'LEVEL1_APPROVED' },
            { currentLevel: 1, levelsRequired: 1, status: 'PENDING' },
          ],
        }
      }

      const requests = await prisma.approvalRequest.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      })

      const enriched = await Promise.all(requests.map(enrichRequest))
      res.json({ success: true, data: enriched })
    } catch (error) {
      console.error('GET /approvals/inbox error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ── POST /approvals/:id/decide ────────────────────────────────────────────────
router.post(
  '/:id/decide',
  authenticate,
  requireRole('hod', 'principal', 'admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { role, userId } = req.user!
      const id = req.params.id as string
      const { decision, remarks } = req.body as { decision: 'APPROVE' | 'REJECT'; remarks?: string }

      if (!['APPROVE', 'REJECT'].includes(decision)) {
        res.status(400).json({ success: false, message: 'decision must be APPROVE or REJECT' }); return
      }

      const approval = await prisma.approvalRequest.findUnique({ where: { id } })
      if (!approval) { res.status(404).json({ success: false, message: 'Approval request not found' }); return }

      if (decision === 'REJECT') {
        await prisma.approvalRequest.update({
          where: { id },
          data: { status: 'REJECTED', rejectedBy: userId, rejectedAt: new Date(), rejectionReason: remarks },
        })
        // Update entity status to rejected
        await updateEntityStatus(approval, 'rejected')
        res.json({ success: true, data: { status: 'REJECTED' } }); return
      }

      // APPROVE
      if (approval.currentLevel === 1) {
        if (approval.levelsRequired === 1) {
          // Single-level: fully approved
          await prisma.approvalRequest.update({
            where: { id },
            data: {
              status: 'FULLY_APPROVED',
              level1ApproverId: userId,
              level1ApprovedAt: new Date(),
              level1Remarks: remarks,
            },
          })
          await updateEntityStatus(approval, 'approved')

          // Notify requester
          const requester = await prisma.user.findUnique({ where: { id: approval.requestedBy }, select: { displayName: true } })
          const meta = approval.metadata ? JSON.parse(approval.metadata) : {}
          await send({
            userId: approval.requestedBy,
            title: 'Request Approved',
            message: `Your ${approval.entityType} request "${meta.description ?? ''}" has been approved.`,
            type: 'success',
          })
          broadcast('dashboard', 'dashboard.approvals.changed', { entityType: approval.entityType })
        } else {
          // Two-level: advance to level 2
          await prisma.approvalRequest.update({
            where: { id },
            data: {
              status: 'LEVEL1_APPROVED',
              currentLevel: 2,
              level1ApproverId: userId,
              level1ApprovedAt: new Date(),
              level1Remarks: remarks,
            },
          })
          // Notify principals
          const principals = await prisma.user.findMany({ where: { role: { in: ['principal', 'admin'] } }, select: { id: true } })
          const meta = approval.metadata ? JSON.parse(approval.metadata) : {}
          await sendMany(principals.map(p => p.id), {
            title: 'Approval Required',
            message: `${approval.entityType} request "${meta.description ?? ''}" has been HOD-approved and requires your final approval.`,
            type: 'info',
          })
          broadcast('dashboard', 'dashboard.approvals.changed', { entityType: approval.entityType })
        }
      } else if (approval.currentLevel === 2) {
        // Principal final approval
        await prisma.approvalRequest.update({
          where: { id },
          data: {
            status: 'FULLY_APPROVED',
            level2ApproverId: userId,
            level2ApprovedAt: new Date(),
            level2Remarks: remarks,
          },
        })
        await updateEntityStatus(approval, 'approved')
        const meta = approval.metadata ? JSON.parse(approval.metadata) : {}
        await send({
          userId: approval.requestedBy,
          title: 'Request Fully Approved',
          message: `Your ${approval.entityType} request "${meta.description ?? ''}" has been approved by the Principal.`,
          type: 'success',
        })
        broadcast('dashboard', 'dashboard.approvals.changed', { entityType: approval.entityType })
      }

      const updated = await prisma.approvalRequest.findUnique({ where: { id } })
      res.json({ success: true, data: updated })
    } catch (error) {
      console.error('POST /approvals/:id/decide error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

async function updateEntityStatus(approval: any, newStatus: string) {
  if (approval.entityType === 'SchoolExpense') {
    await prisma.schoolExpense.update({ where: { id: approval.entityId }, data: { status: newStatus } })
  } else if (approval.entityType === 'GradeAmendment' && newStatus === 'approved') {
    const amendment = await prisma.gradeAmendment.findUnique({ where: { id: approval.entityId } })
    if (amendment) {
      await prisma.grade.update({ where: { id: amendment.gradeId }, data: { score: amendment.proposedScore } })
      await prisma.gradeAmendment.update({ where: { id: approval.entityId }, data: { status: 'APPROVED' } })
      await prisma.auditEvent.create({
        data: {
          actorUserId: approval.requestedBy,
          action: 'GRADE_AMENDED',
          entityType: 'Grade',
          entityId: amendment.gradeId,
          details: JSON.stringify({ before: amendment.originalScore, after: amendment.proposedScore, reason: amendment.reason }),
        },
      })
    }
  }
}

// ── POST /approvals/expenses ──────────────────────────────────────────────────
router.post(
  '/expenses',
  authenticate,
  requireRole('admin', 'manager', 'teacher', 'hod', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.user!
      const { category, description, amount, date } = req.body as {
        category: string; description: string; amount: number; date: string
      }

      if (!category || !description || !amount || !date) {
        res.status(400).json({ success: false, message: 'category, description, amount, date are required' }); return
      }

      const amt = Number(amount)

      // Create the expense
      const expense = await prisma.schoolExpense.create({
        data: {
          category, description, amount: amt,
          date: new Date(date),
          status: amt < 500 ? 'approved' : 'pending',
          submittedBy: userId,
          approvedBy: amt < 500 ? 'AUTO' : undefined,
        },
      })

      if (amt >= 500) {
        const levelsRequired = amt >= 2000 ? 2 : 1
        const approvalReq = await prisma.approvalRequest.create({
          data: {
            entityType: 'SchoolExpense',
            entityId: expense.id,
            requestedBy: userId,
            levelsRequired,
            metadata: JSON.stringify({ amount: amt, description, category }),
          },
        })
        await prisma.schoolExpense.update({ where: { id: expense.id }, data: { approvalRequestId: approvalReq.id } })

        // Notify approvers
        const targets = await prisma.user.findMany({ where: { role: { in: ['hod', 'admin', 'manager'] } }, select: { id: true } })
        await sendMany(targets.map(t => t.id), {
          title: 'Expense Approval Required',
          message: `${description} — BND ${amt.toFixed(2)} requires approval. ${routingLabel(amt)}`,
          type: 'info',
        })
      }

      res.status(201).json({
        success: true,
        data: { ...expense, routingLabel: routingLabel(amt) },
      })
    } catch (error) {
      console.error('POST /approvals/expenses error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ── POST /approvals/grade-amendment ──────────────────────────────────────────
router.post(
  '/grade-amendment',
  authenticate,
  requireRole('admin', 'manager', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.user!
      const { gradeId, proposedScore, reason } = req.body as {
        gradeId: string; proposedScore: number; reason: string
      }

      if (!gradeId || proposedScore === undefined || !reason) {
        res.status(400).json({ success: false, message: 'gradeId, proposedScore, reason are required' }); return
      }

      const grade = await prisma.grade.findUnique({ where: { id: gradeId }, include: { gradeItem: true } })
      if (!grade) { res.status(404).json({ success: false, message: 'Grade not found' }); return }

      const teacher = await prisma.teacher.findUnique({ where: { userId } })

      const amendment = await prisma.gradeAmendment.create({
        data: {
          gradeId,
          teacherId: teacher?.id ?? userId,
          originalScore: grade.score ?? 0,
          proposedScore: Number(proposedScore),
          reason,
        },
      })

      const approvalReq = await prisma.approvalRequest.create({
        data: {
          entityType: 'GradeAmendment',
          entityId: amendment.id,
          requestedBy: userId,
          levelsRequired: 1,
          metadata: JSON.stringify({
            description: `Grade amendment: ${grade.gradeItem?.name ?? 'Assessment'} — ${grade.score} → ${proposedScore}`,
            originalScore: grade.score,
            proposedScore,
            reason,
          }),
        },
      })

      const hodUsers = await prisma.user.findMany({ where: { role: { in: ['hod', 'admin'] } }, select: { id: true } })
      await sendMany(hodUsers.map(h => h.id), {
        title: 'Grade Amendment Request',
        message: `A teacher is requesting a grade change: ${grade.gradeItem?.name ?? 'Assessment'} from ${grade.score} → ${proposedScore}. Reason: ${reason}`,
        type: 'warning',
      })

      res.status(201).json({ success: true, data: { amendment, approvalRequestId: approvalReq.id } })
    } catch (error) {
      console.error('POST /approvals/grade-amendment error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
