import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { USER_SELECT_NAME, USER_SELECT_CONTACT } from '../lib/querySelects'
import { validateTransition, COUNSELOR_CASE_TRANSITIONS } from '../lib/transitions'
import { send } from '../services/notificationService'

const router = Router()

// GET /counselor/dashboard — summary stats for counselor home
router.get(
  '/dashboard',
  authenticate,
  requireRole('counselor', 'admin', 'principal'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const [casesOpen, casesInProgress, casesResolved, casesClosed, riskBands] = await Promise.all([
        prisma.counselorCase.count({ where: { status: 'OPEN' } }),
        prisma.counselorCase.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.counselorCase.count({ where: { status: 'RESOLVED' } }),
        prisma.counselorCase.count({ where: { status: 'CLOSED' } }),
        prisma.riskScore.findMany({
          orderBy: { computedAt: 'desc' },
          distinct: ['studentId'],
          select: { band: true },
        }),
      ])

      const bandCounts: Record<string, number> = { HIGH_RISK: 0, MONITOR: 0, ON_TRACK: 0 }
      for (const rs of riskBands) {
        if (rs.band in bandCounts) bandCounts[rs.band]++
      }

      // Active cases with student info for the list
      const activeCases = await prisma.counselorCase.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        include: {
          student: {
            include: {
              user: { select: USER_SELECT_NAME },
              riskScores: {
                orderBy: { computedAt: 'desc' },
                take: 1,
                select: { score: true, band: true, computedAt: true },
              },
            },
          },
        },
        orderBy: { openedAt: 'desc' },
        take: 10,
      })

      const activeCaseData = activeCases.map((c) => ({
        id: c.id,
        studentId: c.studentId,
        studentName: c.student.user.displayName,
        openedReason: c.openedReason,
        status: c.status,
        openedAt: c.openedAt,
        currentRiskScore: c.student.riskScores[0]?.score ?? null,
        currentRiskBand: c.student.riskScores[0]?.band ?? null,
        lastRiskUpdate: c.student.riskScores[0]?.computedAt ?? null,
      }))

      res.json({
        success: true,
        data: {
          casesOpen,
          casesInProgress,
          casesResolved,
          casesClosed,
          totalActive: casesOpen + casesInProgress,
          riskBandDistribution: bandCounts,
          activeCases: activeCaseData,
        },
      })
    } catch (error) {
      console.error('GET /counselor/dashboard error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /counselor/cases — list all cases with filters
router.get(
  '/cases',
  authenticate,
  requireRole('counselor', 'admin', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, riskBand } = req.query as { status?: string; riskBand?: string }

      const where: Record<string, unknown> = {}
      if (status) where.status = status

      const cases = await prisma.counselorCase.findMany({
        where,
        include: {
          student: {
            include: {
              user: { select: USER_SELECT_NAME },
              riskScores: {
                orderBy: { computedAt: 'desc' },
                take: 1,
                select: { score: true, band: true, computedAt: true },
              },
            },
          },
        },
        orderBy: { openedAt: 'desc' },
      })

      const filtered = riskBand
        ? cases.filter((c) => c.student.riskScores[0]?.band === riskBand)
        : cases

      const data = filtered.map((c) => ({
        ...c,
        studentName: c.student.user.displayName,
        currentRiskScore: c.student.riskScores[0]?.score ?? null,
        currentRiskBand: c.student.riskScores[0]?.band ?? null,
        lastRiskUpdate: c.student.riskScores[0]?.computedAt ?? null,
      }))

      res.json({ success: true, data })
    } catch (error) {
      console.error('GET /counselor/cases error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /counselor/cases/:id — case detail with student stats
router.get(
  '/cases/:id',
  authenticate,
  requireRole('counselor', 'admin', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string }

      const counselorCase = await prisma.counselorCase.findUnique({
        where: { id },
        include: {
          actionItems: { orderBy: { createdAt: 'asc' } },
          evidenceDocs: { orderBy: { createdAt: 'asc' } },
          student: {
            include: {
              user: { select: { displayName: true, email: true } },
              riskScores: {
                orderBy: { computedAt: 'desc' },
                take: 8,
                select: { score: true, band: true, gradeAvg: true, absences14d: true, computedAt: true },
              },
              attendances: { select: { status: true } },
              grades: {
                include: { gradeItem: { select: { maxScore: true, weight: true } } },
              },
              parentLinks: {
                include: { parent: { include: { user: { select: { displayName: true, email: true } } } } },
              },
            },
          },
        },
      })

      if (!counselorCase) {
        res.status(404).json({ success: false, message: 'Case not found' })
        return
      }

      const student = counselorCase.student
      const totalAtt = student.attendances.length
      const presentAtt = student.attendances.filter(
        (a) => a.status === 'present' || a.status === 'late',
      ).length
      const attendanceRate =
        totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 10000) / 100 : 0

      let totalWeight = 0
      let weightedSum = 0
      for (const g of student.grades) {
        if (g.score === null) continue
        const pct = g.score / g.gradeItem.maxScore
        weightedSum += pct * g.gradeItem.weight
        totalWeight += g.gradeItem.weight
      }
      const gpa = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 4 * 100) / 100 : 0

      const riskHistory = student.riskScores.map((rs) => ({
        score: rs.score,
        band: rs.band,
        gradeAvg: rs.gradeAvg,
        absences14d: rs.absences14d,
        computedAt: rs.computedAt,
      }))

      const parents = student.parentLinks.map((pl) => ({
        name: pl.parent.user.displayName,
        email: pl.parent.user.email,
      }))

      res.json({
        success: true,
        data: {
          ...counselorCase,
          attendanceRate,
          gpa,
          riskHistory,
          parents,
        },
      })
    } catch (error) {
      console.error('GET /counselor/cases/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// PATCH /counselor/cases/:id — update case status/notes
// Transitioning to RESOLVED or CLOSED enforces: resolutionNotes, ≥1 evidence doc, all action items DONE
router.patch(
  '/cases/:id',
  authenticate,
  requireRole('counselor', 'admin', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string }
      const { status, notes, resolutionNotes } = req.body as { status?: string; notes?: string; resolutionNotes?: string }

      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (status) {
        const existing = await prisma.counselorCase.findUnique({ where: { id }, select: { status: true } })
        if (!existing) { res.status(404).json({ success: false, message: 'Case not found' }); return }
        const transitionResult = validateTransition(COUNSELOR_CASE_TRANSITIONS, existing.status, status)
        if (!transitionResult.ok) {
          res.status(400).json({ success: false, message: transitionResult.reason }); return
        }

        // Gate: closing/resolving requires documentation
        if (status === 'RESOLVED' || status === 'CLOSED') {
          if (!resolutionNotes || !resolutionNotes.trim()) {
            res.status(400).json({ success: false, message: 'A resolution summary is required before closing a case.' }); return
          }
          const evidenceCount = await prisma.counselorCaseEvidence.count({ where: { caseId: id } })
          if (evidenceCount === 0) {
            res.status(400).json({ success: false, message: 'At least one supporting evidence document must be recorded before closing.' }); return
          }
          const openItems = await prisma.counselorCaseActionItem.count({
            where: { caseId: id, status: { not: 'DONE' } },
          })
          if (openItems > 0) {
            res.status(400).json({ success: false, message: `${openItems} intervention(s) are still open. Complete all before closing.` }); return
          }
          updateData.resolvedAt = new Date()
          updateData.resolutionNotes = resolutionNotes.trim()
        }

        updateData.status = status
      }
      if (notes !== undefined) updateData.notes = notes

      const updated = await prisma.counselorCase.update({ where: { id }, data: updateData })
      res.json({ success: true, data: updated })
    } catch (error) {
      console.error('PATCH /counselor/cases/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /counselor/staff — list all assignable staff (non-student, non-parent users)
router.get(
  '/staff',
  authenticate,
  requireRole('counselor', 'admin', 'principal'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const staff = await prisma.user.findMany({
        where: {
          role: { notIn: ['student', 'parent'] },
          status: 'active',
        },
        select: { id: true, displayName: true, role: true, email: true },
        orderBy: { displayName: 'asc' },
      })
      res.json({ success: true, data: staff })
    } catch (err) {
      console.error('GET /counselor/staff error:', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /counselor/my-interventions — interventions assigned to the current user (any role)
router.get(
  '/my-interventions',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const items = await prisma.counselorCaseActionItem.findMany({
        where: { assignedToUserId: req.user!.userId },
        include: {
          case: {
            include: {
              student: { include: { user: { select: { displayName: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      const data = items.map((item) => ({
        ...item,
        studentName: item.case.student.user.displayName,
        caseStatus: item.case.status,
      }))

      res.json({ success: true, data })
    } catch (err) {
      console.error('GET /counselor/my-interventions error:', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// PATCH /counselor/interventions/:itemId — assignee updates their intervention (any role)
router.patch(
  '/interventions/:itemId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { itemId } = req.params as { itemId: string }
      const { status, resultNotes } = req.body as { status?: string; resultNotes?: string }

      // Only the assignee (or counselor/admin) may update
      const existing = await prisma.counselorCaseActionItem.findUnique({
        where: { id: itemId },
        include: {
          case: {
            include: { student: { include: { user: { select: { displayName: true } } } } },
          },
        },
      })
      if (!existing) { res.status(404).json({ success: false, message: 'Not found' }); return }

      const { userId, role } = req.user!
      const isCounselorAdmin = ['counselor', 'admin', 'principal'].includes(role)
      if (existing.assignedToUserId !== userId && !isCounselorAdmin) {
        res.status(403).json({ success: false, message: 'Forbidden' }); return
      }

      const updated = await prisma.counselorCaseActionItem.update({
        where: { id: itemId },
        data: {
          ...(status !== undefined && {
            status,
            closedAt: status === 'DONE' ? new Date() : null,
          }),
          ...(resultNotes !== undefined && { resultNotes: resultNotes.trim() }),
        },
      })

      // When assignee marks DONE, notify the counselor who opened the case
      if (status === 'DONE' && existing.case.counselorUserId) {
        const assigneeName = (await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true },
        }))?.displayName ?? 'Staff'

        await send({
          userId: existing.case.counselorUserId,
          title: 'Intervention Completed',
          message: `${assigneeName} has completed the intervention "${existing.title}" for student ${existing.case.student.user.displayName}.`,
          type: 'success',
          link: '/counselor/cases',
        }).catch((e) => console.error('[notify counselor on done]', e))
      }

      res.json({ success: true, data: updated })
    } catch (err) {
      console.error('PATCH /counselor/interventions/:itemId error:', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── Counselor Case Action Items ───────────────────────────────────────────

router.post('/cases/:id/action-items', authenticate, requireRole('counselor', 'admin', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const caseId = req.params['id'] as string
    const { title, description, assignedTo, assignedToUserId, dueDate, category } = req.body
    if (!title || !title.trim()) { res.status(400).json({ success: false, message: 'title is required' }); return }

    const item = await prisma.counselorCaseActionItem.create({
      data: {
        caseId,
        title: title.trim(),
        description: description?.trim() ?? null,
        assignedTo: assignedTo?.trim() ?? null,
        assignedToUserId: assignedToUserId ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        category: category?.trim() ?? null,
        createdByUserId: req.user!.userId,
      },
    })

    // Notify the assigned user
    if (assignedToUserId) {
      const counselorName = (await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { displayName: true },
      }))?.displayName ?? 'Counselor'

      const caseInfo = await prisma.counselorCase.findUnique({
        where: { id: caseId },
        include: { student: { include: { user: { select: { displayName: true } } } } },
      })
      const studentName = caseInfo?.student.user.displayName ?? 'a student'

      await send({
        userId: assignedToUserId,
        title: 'New Intervention Assigned',
        message: `${counselorName} has assigned you an intervention: "${title.trim()}" for student ${studentName}.${dueDate ? ` Due: ${new Date(dueDate).toLocaleDateString()}.` : ''}`,
        type: 'info',
        link: '/counselor/my-interventions',
      }).catch((e) => console.error('[notify assignee]', e))
    }

    res.status(201).json({ success: true, data: item })
  } catch (err) {
    console.error('POST /counselor/cases/:id/action-items error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.patch('/cases/:id/action-items/:itemId', authenticate, requireRole('counselor', 'admin', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params as { itemId: string }
    const { status, title, description, assignedTo, assignedToUserId, dueDate, category, resultNotes } = req.body
    const item = await prisma.counselorCaseActionItem.update({
      where: { id: itemId },
      data: {
        ...(status !== undefined && { status, closedAt: status === 'DONE' ? new Date() : null }),
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() ?? null }),
        ...(assignedTo !== undefined && { assignedTo: assignedTo?.trim() ?? null }),
        ...(assignedToUserId !== undefined && { assignedToUserId: assignedToUserId ?? null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(category !== undefined && { category: category?.trim() ?? null }),
        ...(resultNotes !== undefined && { resultNotes: resultNotes?.trim() ?? null }),
      },
    })
    res.json({ success: true, data: item })
  } catch (err) {
    console.error('PATCH /counselor/cases/:id/action-items/:itemId error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.delete('/cases/:id/action-items/:itemId', authenticate, requireRole('counselor', 'admin', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.counselorCaseActionItem.delete({ where: { id: req.params['itemId'] as string } })
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /counselor/cases/:id/action-items/:itemId error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Counselor Case Evidence ────────────────────────────────────────────────

router.post('/cases/:id/evidence', authenticate, requireRole('counselor', 'admin', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const caseId = req.params['id'] as string
    const { fileName, fileType, description, filePath } = req.body
    if (!fileName || !fileName.trim()) { res.status(400).json({ success: false, message: 'fileName is required' }); return }
    const doc = await prisma.counselorCaseEvidence.create({
      data: {
        caseId,
        fileName: fileName.trim(),
        // Use provided filePath (real upload URL) or compute a legacy placeholder
        filePath: filePath?.trim() ?? `/evidence/cases/${caseId}/${fileName.trim()}`,
        fileType: fileType?.trim() ?? null,
        description: description?.trim() ?? null,
        uploadedByUserId: req.user!.userId,
      },
    })
    res.status(201).json({ success: true, data: doc })
  } catch (err) {
    console.error('POST /counselor/cases/:id/evidence error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.delete('/cases/:id/evidence/:docId', authenticate, requireRole('counselor', 'admin', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.counselorCaseEvidence.delete({ where: { id: req.params['docId'] as string } })
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /counselor/cases/:id/evidence/:docId error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
