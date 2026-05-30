import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

// Helper: get student IDs accessible by this parent
async function getChildStudentIds(userId: string): Promise<string[]> {
  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: { childLinks: { select: { studentId: true } } },
  })
  return parent?.childLinks.map((l) => l.studentId) ?? []
}

// GET /parent/grades?childId= — detailed grade breakdown per subject
router.get(
  '/grades',
  authenticate,
  requireRole('parent'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { childId } = req.query as { childId?: string }
      const childIds = await getChildStudentIds(req.user!.userId)

      if (childIds.length === 0) {
        res.json({ success: true, data: [] })
        return
      }

      // Validate that requested childId belongs to this parent
      const targetId = childId && childIds.includes(childId) ? childId : childIds[0]

      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: targetId, status: 'enrolled' },
        include: {
          course: {
            include: {
              gradeItems: {
                include: {
                  grades: {
                    where: { studentId: targetId },
                    select: { score: true, letterGrade: true, remarks: true, gradedAt: true },
                  },
                },
              },
            },
          },
        },
      })

      const subjectData = enrollments.map((e) => {
        const items = e.course.gradeItems.map((gi) => {
          const grade = gi.grades[0]
          const pct = grade?.score != null ? Math.round((grade.score / gi.maxScore) * 10000) / 100 : null
          return {
            id: gi.id,
            name: gi.name,
            type: gi.type,
            maxScore: gi.maxScore,
            weight: gi.weight,
            dueDate: gi.dueDate,
            score: grade?.score ?? null,
            letterGrade: grade?.letterGrade ?? null,
            remarks: grade?.remarks ?? null,
            gradedAt: grade?.gradedAt ?? null,
            percentage: pct,
          }
        })

        // Weighted average for this course
        let totalWeight = 0, weightedSum = 0
        for (const item of items) {
          if (item.score == null) continue
          weightedSum += (item.score / item.maxScore) * item.weight
          totalWeight += item.weight
        }
        const courseAvg = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10000) / 100 : null

        return {
          courseId: e.course.id,
          courseCode: e.course.code,
          courseName: e.course.name,
          gradeLevel: e.course.gradeLevel,
          courseAverage: courseAvg,
          gradeItems: items,
        }
      })

      res.json({ success: true, data: subjectData })
    } catch (error) {
      console.error('GET /parent/grades error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /parent/fees — fee invoices for all children
router.get(
  '/fees',
  authenticate,
  requireRole('parent'),
  async (req: AuthRequest, res: Response) => {
    try {
      const childIds = await getChildStudentIds(req.user!.userId)

      if (childIds.length === 0) {
        res.json({ success: true, data: { invoices: [], summary: { totalBilled: 0, paid: 0, outstanding: 0 } } })
        return
      }

      const invoices = await prisma.feeInvoice.findMany({
        where: { studentId: { in: childIds } },
        orderBy: { createdAt: 'desc' },
      })

      // Attach student name
      const students = await prisma.student.findMany({
        where: { id: { in: childIds } },
        include: { user: { select: { displayName: true } } },
      })
      const studentMap = new Map(students.map((s) => [s.id, s.user.displayName]))

      const data = invoices.map((inv) => ({
        ...inv,
        studentName: studentMap.get(inv.studentId) ?? '',
      }))

      const totalBilled = invoices.reduce((s, i) => s + i.amount, 0)
      const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
      const outstanding = totalBilled - paid

      res.json({
        success: true,
        data: {
          invoices: data,
          summary: { totalBilled, paid, outstanding },
        },
      })
    } catch (error) {
      console.error('GET /parent/fees error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
