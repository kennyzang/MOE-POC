import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

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
              user: { select: { displayName: true } },
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
              user: { select: { displayName: true } },
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
router.patch(
  '/cases/:id',
  authenticate,
  requireRole('counselor', 'admin', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string }
      const { status, notes } = req.body as { status?: string; notes?: string }

      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (status) {
        updateData.status = status
        if (status === 'RESOLVED' || status === 'CLOSED') {
          updateData.resolvedAt = new Date()
        }
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

export default router
