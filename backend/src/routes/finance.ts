import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

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

export default router
