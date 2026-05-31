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

// GET /parent/applications — admission applications submitted by this parent
router.get(
  '/applications',
  authenticate,
  requireRole('parent'),
  async (req: AuthRequest, res: Response) => {
    try {
      const applications = await prisma.admission.findMany({
        where: { guardianUserId: req.user!.userId },
        include: { documents: true },
        orderBy: { createdAt: 'desc' },
      })
      res.json({ success: true, data: applications })
    } catch (error) {
      console.error('GET /parent/applications error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /parent/meetings — list meetings for this parent
router.get(
  '/meetings',
  authenticate,
  requireRole('parent'),
  async (req: AuthRequest, res: Response) => {
    try {
      const meetings = await prisma.parentTeacherMeeting.findMany({
        where: { parentUserId: req.user!.userId },
        include: {
          teacher: { include: { user: { select: { displayName: true, email: true } } } },
          student: { include: { user: { select: { displayName: true } } } },
        },
        orderBy: { meetingDate: 'desc' },
      })
      res.json({ success: true, data: meetings })
    } catch (error) {
      console.error('GET /parent/meetings error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /parent/meetings/teachers — list teachers for the parent's children (for meeting booking)
router.get(
  '/meetings/teachers',
  authenticate,
  requireRole('parent'),
  async (req: AuthRequest, res: Response) => {
    try {
      const childIds = await getChildStudentIds(req.user!.userId)
      if (childIds.length === 0) {
        res.json({ success: true, data: [] })
        return
      }
      // Get courses assigned to teachers who teach the parent's children
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: { in: childIds }, status: 'enrolled' },
        include: {
          course: {
            include: {
              assignments: {
                include: { teacher: { include: { user: { select: { id: true, displayName: true, email: true } } } } },
              },
            },
          },
          student: { include: { user: { select: { displayName: true } } } },
        },
      })
      // Deduplicate teachers
      const teacherMap = new Map<string, { teacherId: string; teacherName: string; teacherEmail: string; courses: string[] }>()
      for (const e of enrollments) {
        for (const a of e.course.assignments) {
          const t = a.teacher
          if (!teacherMap.has(t.id)) {
            teacherMap.set(t.id, {
              teacherId: t.id,
              teacherName: t.user.displayName,
              teacherEmail: t.user.email ?? '',
              courses: [],
            })
          }
          const existing = teacherMap.get(t.id)!
          if (!existing.courses.includes(e.course.name)) existing.courses.push(e.course.name)
        }
      }
      res.json({ success: true, data: Array.from(teacherMap.values()) })
    } catch (error) {
      console.error('GET /parent/meetings/teachers error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
