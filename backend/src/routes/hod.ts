import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET /hod/dashboard — department-scoped stats for HOD
router.get(
  '/dashboard',
  authenticate,
  requireRole('hod', 'admin', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId, role } = req.user!

      // For HOD: scope to their own department. For admin/principal: show all.
      let department: string | null = null
      if (role === 'hod') {
        const hodTeacher = await prisma.teacher.findUnique({
          where: { userId },
          select: { department: true },
        })
        department = hodTeacher?.department ?? null
      }

      const teacherWhere = department ? { department } : {}
      const teachers = await prisma.teacher.findMany({
        where: teacherWhere,
        include: {
          user: { select: { displayName: true } },
          performanceEvaluations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { overallScore: true, teachingScore: true, professionalScore: true, conductScore: true, status: true },
          },
        },
      })

      const totalTeachers = teachers.length
      const cpdCompliant = teachers.filter((t) => t.cpdHours >= (t.cpdTarget || 20)).length
      const cpdComplianceRate =
        totalTeachers > 0 ? Math.round((cpdCompliant / totalTeachers) * 100) : 0

      const scoredTeachers = teachers.filter(
        (t) => t.performanceEvaluations[0]?.overallScore != null,
      )
      const avgPerformanceScore =
        scoredTeachers.length > 0
          ? Math.round(
              (scoredTeachers.reduce(
                (s, t) => s + (t.performanceEvaluations[0]?.overallScore ?? 0),
                0,
              ) /
                scoredTeachers.length) *
                10,
            ) / 10
          : 0

      const teacherIds = teachers.map((t) => t.id)

      const [pendingLeave, pendingEvals, recentEvals] = await Promise.all([
        prisma.leaveApplication.count({
          where: { teacherId: { in: teacherIds }, status: 'PENDING' },
        }),
        prisma.performanceEvaluation.count({
          where: { teacherId: { in: teacherIds }, status: 'submitted' },
        }),
        prisma.performanceEvaluation.findMany({
          where: { teacherId: { in: teacherIds }, status: 'submitted' },
          include: {
            teacher: { include: { user: { select: { displayName: true } } } },
          },
          orderBy: { submittedAt: 'desc' },
          take: 5,
        }),
      ])

      const cpdProgress = teachers.map((t) => ({
        id: t.id,
        name: t.user.displayName,
        cpdHours: t.cpdHours,
        cpdTarget: t.cpdTarget,
        compliant: t.cpdHours >= t.cpdTarget,
        overallScore: t.performanceEvaluations[0]?.overallScore ?? null,
        teachingScore: t.performanceEvaluations[0]?.teachingScore ?? null,
        professionalScore: t.performanceEvaluations[0]?.professionalScore ?? null,
        conductScore: t.performanceEvaluations[0]?.conductScore ?? null,
      }))

      // Pending leave applications with teacher info
      const pendingLeaveList = await prisma.leaveApplication.findMany({
        where: { teacherId: { in: teacherIds }, status: 'PENDING' },
        include: {
          teacher: { include: { user: { select: { displayName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      res.json({
        success: true,
        data: {
          department,
          totalTeachers,
          cpdComplianceRate,
          avgPerformanceScore,
          pendingLeave,
          pendingEvals,
          cpdProgress,
          recentEvals,
          pendingLeaveList,
        },
      })
    } catch (error) {
      console.error('GET /hod/dashboard error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
