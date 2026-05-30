import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { execSync } from 'child_process'
import path from 'path'

const router = Router()

/**
 * POST /api/v1/admin/demo-reset
 * Restores the database to its "before demo" state by re-running the seed.
 * Admin only.
 */
router.post(
  '/demo-reset',
  authenticate,
  requireRole('admin'),
  async (_req: AuthRequest, res: Response) => {
    try {
      // Truncate all transactional tables
      const tablesReset = [
        'AuditEvent',
        'CounselorCase',
        'RiskScore',
        'LeaveApplication',
        'AdmissionDocument',
        'Admission',
        'AttendanceRecord',
        'AttendanceSession',
        'Grade',
        'GradeItem',
        'Enrollment',
        'CourseAssignment',
        'Notification',
        'FacilityBooking',
        'ChatbotConversation',
        'PushSubscription',
        'SchoolEvent',
        'Certification',
        'PerformanceEvaluation',
        'TimetableSlot',
        'Course',
        'FeeInvoice',
        'ParentStudent',
        'Parent',
        'Student',
        'Teacher',
        'User',
        'SystemConfig',
        'Facility',
        'School',
        'SchoolExpense',
      ]

      // Delete all transactional data in reverse dependency order
      await prisma.$transaction([
        prisma.auditEvent.deleteMany(),
        prisma.gradeAmendment.deleteMany(),
        prisma.approvalRequest.deleteMany(),
        prisma.academicStandingHistory.deleteMany(),
        prisma.counselorCase.deleteMany(),
        prisma.riskScore.deleteMany(),
        prisma.parentTeacherMeeting.deleteMany(),
        prisma.cpdEnrollment.deleteMany(),
        prisma.cpdWorkshop.deleteMany(),
        prisma.leaveApplication.deleteMany(),
        prisma.admissionDocument.deleteMany(),
        prisma.admission.deleteMany(),
        prisma.attendanceRecord.deleteMany(),
        prisma.attendanceSession.deleteMany(),
        prisma.grade.deleteMany(),
        prisma.gradeItem.deleteMany(),
        prisma.enrollment.deleteMany(),
        prisma.courseAssignment.deleteMany(),
        prisma.timetableSlot.deleteMany(),
        prisma.course.deleteMany(),
        prisma.notification.deleteMany(),
        prisma.facilityBooking.deleteMany(),
        prisma.facility.deleteMany(),
        prisma.chatbotConversation.deleteMany(),
        prisma.pushSubscription.deleteMany(),
        prisma.schoolEvent.deleteMany(),
        prisma.certification.deleteMany(),
        prisma.performanceEvaluation.deleteMany(),
        prisma.feeInvoice.deleteMany(),
        prisma.feeType.deleteMany(),
        prisma.schoolExpense.deleteMany(),
        prisma.classRoster.deleteMany(),
        prisma.systemConfig.deleteMany(),
        prisma.parentStudent.deleteMany(),
        prisma.parent.deleteMany(),
        prisma.student.deleteMany(),
        prisma.teacher.deleteMany(),
        prisma.user.deleteMany(),
        prisma.school.deleteMany(),
      ])

      // Re-run seed using tsx (same runner as dev)
      const seedScript = path.resolve(__dirname, '../../')
      execSync('npx tsx prisma/seed.ts', {
        cwd: seedScript,
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      })

      res.json({
        success: true,
        status: 'ok',
        resetAt: new Date().toISOString(),
        tablesReset: tablesReset.length,
        message: 'Demo reset complete. Database restored to before-demo state.',
      })
    } catch (error) {
      console.error('Demo reset error:', error)
      res.status(500).json({
        success: false,
        message: 'Demo reset failed',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },
)

/**
 * GET /api/v1/admin/demo-config
 * Returns current DEMO_CONFIG values from SystemConfig table.
 */
router.get(
  '/demo-config',
  authenticate,
  requireRole('admin'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const configs = await prisma.systemConfig.findMany({
        where: { key: { startsWith: 'demo_' } },
      })
      const result: Record<string, string> = {}
      configs.forEach((c) => {
        result[c.key] = c.value
      })
      res.json({ success: true, data: result })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

/**
 * GET /api/v1/admin/audit-log
 * Returns recent audit events. Admin only.
 */
router.get(
  '/audit-log',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { limit = '50', entityType, action } = req.query as {
        limit?: string
        entityType?: string
        action?: string
      }

      const where: Record<string, unknown> = {}
      if (entityType) where.entityType = entityType
      if (action) where.action = action

      const events = await prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit), 200),
      })

      res.json({ success: true, data: events })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

/**
 * GET /api/v1/admin/counselor-cases
 * Returns counselor cases with student info.
 */
router.get(
  '/counselor-cases',
  authenticate,
  requireRole('admin', 'principal', 'counselor'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const cases = await prisma.counselorCase.findMany({
        include: {
          student: {
            include: { user: { select: { displayName: true } } },
          },
        },
        orderBy: { openedAt: 'desc' },
      })
      res.json({ success: true, data: cases })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

/**
 * GET /api/v1/admin/risk-scores
 * Returns latest risk score per student (highest risk first).
 */
router.get(
  '/risk-scores',
  authenticate,
  requireRole('admin', 'principal', 'counselor'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const scores = await prisma.riskScore.findMany({
        orderBy: { computedAt: 'desc' },
        distinct: ['studentId'],
        include: {
          student: {
            include: { user: { select: { displayName: true } } },
          },
        },
      })
      res.json({ success: true, data: scores })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

export default router
