import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'

const router = Router()

const financeRoles = ['admin', 'manager', 'finance'] as const

// GET /invoices — list fee invoices with student info
router.get(
  '/invoices',
  authenticate,
  requireRole(...financeRoles),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, semester } = req.query as { status?: string; semester?: string }

      const where: any = {}
      if (status) where.status = status
      if (semester) where.semester = semester

      const invoices = await prisma.feeInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })

      // Manual join: FeeInvoice.studentId has no Prisma relation
      const studentIds = [...new Set(invoices.map((inv) => inv.studentId))]
      const students = await prisma.student.findMany({
        where: { id: { in: studentIds } },
        include: { user: { select: { id: true, displayName: true, username: true } } },
      })
      const studentMap = new Map(students.map((s) => [s.id, s]))

      const data = invoices.map((inv) => ({
        ...inv,
        student: studentMap.get(inv.studentId) || null,
      }))

      res.json({ success: true, data })
    } catch (error) {
      console.error('GET /finance/invoices error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /expenses — list school expenses
router.get(
  '/expenses',
  authenticate,
  requireRole(...financeRoles),
  async (req: AuthRequest, res: Response) => {
    try {
      const { category, status } = req.query as { category?: string; status?: string }

      const where: any = {}
      if (category) where.category = category
      if (status) where.status = status

      const expenses = await prisma.schoolExpense.findMany({
        where,
        orderBy: { date: 'desc' },
      })

      res.json({ success: true, data: expenses })
    } catch (error) {
      console.error('GET /finance/expenses error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /summary — aggregate financial data
router.get(
  '/summary',
  authenticate,
  requireRole(...financeRoles),
  async (req: AuthRequest, res: Response) => {
    try {
      const invoices = await prisma.feeInvoice.findMany()
      const expenses = await prisma.schoolExpense.findMany()

      const totalFees = invoices.reduce((sum, inv) => sum + inv.amount, 0)
      const collected = invoices
        .filter((inv) => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.amount, 0)
      const outstanding = totalFees - collected

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)

      const expensesByCategory: Record<string, number> = {}
      for (const exp of expenses) {
        expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + exp.amount
      }

      res.json({
        success: true,
        data: { totalFees, collected, outstanding, totalExpenses, expensesByCategory },
      })
    } catch (error) {
      console.error('GET /finance/summary error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// POST /invoices — create a fee invoice and notify student + parents
router.post(
  '/invoices',
  authenticate,
  requireRole(...financeRoles),
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, semester, amount, dueDate, description } = req.body as {
        studentId: string
        semester?: string
        amount: number
        dueDate?: string
        description?: string
      }

      if (!studentId || amount === undefined) {
        res.status(400).json({ success: false, message: 'studentId and amount are required' })
        return
      }

      const invoice = await prisma.feeInvoice.create({
        data: {
          studentId,
          semester,
          amount: Number(amount),
          dueDate: dueDate ? new Date(dueDate) : undefined,
          description,
        },
      })

      // Notify student + parents
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { id: true, displayName: true } },
          parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
        },
      })
      if (student) {
        const notifyIds = [student.userId, ...student.parentLinks.map(l => l.parent.user.id)]
        await Promise.all(
          notifyIds.map(uid =>
            send({
              userId: uid,
              title: 'Fee Invoice Generated',
              message: `A fee invoice of BND ${Number(amount).toFixed(2)} has been issued for ${student.user.displayName}${semester ? ` (${semester})` : ''}.`,
              type: 'warning',
            }),
          ),
        )
      }

      res.status(201).json({ success: true, data: invoice })
    } catch (error) {
      console.error('POST /finance/invoices error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// PATCH /finance/invoices/:id/pay — simulate payment (clears holdActive)
router.patch(
  '/invoices/:id/pay',
  authenticate,
  requireRole(...financeRoles, 'principal', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const invoice = await prisma.feeInvoice.findUnique({ where: { id } })
      if (!invoice) { res.status(404).json({ success: false, message: 'Invoice not found' }); return }

      const updated = await prisma.feeInvoice.update({
        where: { id },
        data: { status: 'paid', paidAt: new Date(), holdActive: false, holdReason: null },
        include: { student: { select: { id: true, enrollmentStatus: true } } },
      })

      // Broadcast updated outstanding count
      const { broadcast } = await import('./events')
      const outstandingCount = await prisma.feeInvoice.count({ where: { status: { in: ['unpaid', 'overdue'] } } })
      broadcast('dashboard', 'dashboard.fees.changed', { outstandingFeeInvoices: outstandingCount })

      res.json({ success: true, data: updated })
    } catch (error) {
      console.error('PATCH /finance/invoices/:id/pay error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /finance/invoices/student/:studentId — all invoices for a student + hold status
router.get(
  '/invoices/student/:studentId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId } = req.params as { studentId: string }
      const invoices = await prisma.feeInvoice.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
      })
      const holdActive = invoices.some(inv => inv.holdActive)
      const outstanding = invoices.filter(inv => inv.status !== 'paid').reduce((s, inv) => s + inv.amount, 0)
      res.json({ success: true, data: { invoices, holdActive, outstanding } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /finance/dashboard — rich KPI dashboard for finance officer
router.get(
  '/dashboard',
  authenticate,
  requireRole(...financeRoles, 'principal', 'admin'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const [invoices, expenses] = await Promise.all([
        prisma.feeInvoice.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.schoolExpense.findMany({ orderBy: { date: 'asc' } }),
      ])

      const totalFees = invoices.reduce((s, i) => s + i.amount, 0)
      const collected = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
      const outstanding = totalFees - collected
      const collectionRate = totalFees > 0 ? Math.round((collected / totalFees) * 10000) / 100 : 0

      const overdueInvoices = invoices
        .filter((i) => i.status === 'overdue')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)

      const recentPayments = invoices
        .filter((i) => i.status === 'paid' && i.paidAt)
        .sort((a, b) => b.paidAt!.getTime() - a.paidAt!.getTime())
        .slice(0, 10)

      // Monthly revenue vs expense trend (last 6 months)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const monthlyTrend: Record<string, { revenue: number; expense: number }> = {}
      for (const inv of invoices.filter(
        (i) => i.status === 'paid' && i.paidAt && i.paidAt >= sixMonthsAgo,
      )) {
        const month = inv.paidAt!.toISOString().slice(0, 7)
        if (!monthlyTrend[month]) monthlyTrend[month] = { revenue: 0, expense: 0 }
        monthlyTrend[month].revenue += inv.amount
      }
      for (const exp of expenses.filter((e) => e.date >= sixMonthsAgo)) {
        const month = exp.date.toISOString().slice(0, 7)
        if (!monthlyTrend[month]) monthlyTrend[month] = { revenue: 0, expense: 0 }
        monthlyTrend[month].expense += exp.amount
      }

      const trendData = Object.entries(monthlyTrend)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data }))

      const pendingApprovals = await prisma.approvalRequest.count({
        where: { entityType: 'SchoolExpense', status: { in: ['PENDING', 'LEVEL1_APPROVED'] } },
      })

      res.json({
        success: true,
        data: {
          totalFees,
          collected,
          outstanding,
          collectionRate,
          overdueCount: overdueInvoices.length,
          overdueInvoices,
          recentPayments,
          monthlyTrend: trendData,
          pendingApprovals,
        },
      })
    } catch (error) {
      console.error('GET /finance/dashboard error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// POST /finance/fees/check-overdue — scan and flag overdue invoices
router.post(
  '/fees/check-overdue',
  authenticate,
  requireRole('admin', 'finance', 'manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const { getConfigInt } = await import('../lib/config')
      const holdDays = await getConfigInt('fee_hold_overdue_days', 30)
      const cutoff = new Date(Date.now() - holdDays * 24 * 3600 * 1000)

      const updated = await prisma.feeInvoice.updateMany({
        where: { status: 'unpaid', dueDate: { lt: cutoff } },
        data: { status: 'overdue', holdActive: true, holdReason: `Payment overdue by more than ${holdDays} days` },
      })

      const { broadcast } = await import('./events')
      const outstandingCount = await prisma.feeInvoice.count({ where: { status: { in: ['unpaid', 'overdue'] } } })
      broadcast('dashboard', 'dashboard.fees.changed', { outstandingFeeInvoices: outstandingCount })

      res.json({ success: true, data: { flagged: updated.count } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
