import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, schoolFilter, type AuthRequest } from '../middleware/auth'

const router = Router()

// GET /transitions — list transitions scoped to the user's school
router.get('/', authenticate, requireRole('admin', 'manager', 'principal', 'hod', 'admissions'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, academicYear } = req.query as Record<string, string>
    const sf = schoolFilter(req)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}
    if (status) where.status = status
    if (type) where.transitionType = type
    if (academicYear) where.academicYear = academicYear
    // scope to either the fromSchool or toSchool being the user's school
    if (sf.schoolId) {
      where.OR = [{ fromSchoolId: sf.schoolId }, { toSchoolId: sf.schoolId }]
    }

    const transitions = await prisma.studentTransition.findMany({
      where,
      include: {
        student: { include: { user: { select: { displayName: true } } } },
        fromSchool: { select: { id: true, name: true, code: true, authority: true } },
        toSchool: { select: { id: true, name: true, code: true, authority: true } },
      },
      orderBy: { effectiveDate: 'asc' },
    })

    res.json({ success: true, data: transitions })
  } catch (error) {
    console.error('GET /transitions error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /transitions/eligible — students in their final grade, eligible for next transition
router.get('/eligible', authenticate, requireRole('admin', 'manager', 'principal', 'hod'), async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user?.schoolId
    if (!schoolId && !req.user?.systemAdmin) { res.json({ success: true, data: [] }); return }

    // Get school to find its grade levels
    const schoolWhere = schoolId ? { id: schoolId } : {}
    const schools = await prisma.school.findMany({ where: schoolWhere })

    const eligibleStudents = []
    for (const school of schools) {
      const gradeLevels = JSON.parse(school.gradeLevels) as string[]
      const finalGrade = gradeLevels[gradeLevels.length - 1]  // last grade = eligible for transition

      const students = await prisma.student.findMany({
        where: { schoolId: school.id, gradeLevel: finalGrade, enrollmentStatus: 'enrolled' },
        include: {
          user: { select: { displayName: true } },
          transitions: { where: { status: { in: ['planned', 'approved'] } }, take: 1 },
        },
      })

      for (const s of students) {
        eligibleStudents.push({
          studentId: s.id,
          studentName: s.user.displayName,
          currentGradeLevel: s.gradeLevel,
          currentClassName: s.className,
          schoolId: school.id,
          schoolName: school.name,
          schoolType: school.schoolType,
          authority: school.authority,
          hasExistingPlan: s.transitions.length > 0,
        })
      }
    }

    res.json({ success: true, data: eligibleStudents })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /transitions — create a transition plan
router.post('/', authenticate, requireRole('admin', 'manager', 'principal', 'hod', 'admissions'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      studentId, fromSchoolId, toSchoolId, fromGradeLevel, toGradeLevel,
      fromClassName, toClassName, transitionType, academicYear, effectiveDate, notes,
    } = req.body as {
      studentId: string; fromSchoolId?: string; toSchoolId: string
      fromGradeLevel?: string; toGradeLevel?: string; fromClassName?: string; toClassName?: string
      transitionType?: string; academicYear: string; effectiveDate: string; notes?: string
    }

    const transition = await prisma.studentTransition.create({
      data: {
        studentId, fromSchoolId, toSchoolId, fromGradeLevel, toGradeLevel,
        fromClassName, toClassName,
        transitionType: transitionType ?? 'GRADE_PROMOTION',
        academicYear, effectiveDate: new Date(effectiveDate), notes,
        processedById: req.user!.userId,
      },
      include: {
        student: { include: { user: { select: { displayName: true } } } },
        fromSchool: { select: { name: true, code: true } },
        toSchool: { select: { name: true, code: true } },
      },
    })

    res.status(201).json({ success: true, data: transition })
  } catch (error) {
    console.error('POST /transitions error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /transitions/:id — update status or approve
router.patch('/:id', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { status, notes, toClassName } = req.body as { status?: string; notes?: string; toClassName?: string }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}
    if (status) { data.status = status; data.processedById = req.user!.userId; data.processedAt = new Date() }
    if (notes !== undefined) data.notes = notes
    if (toClassName !== undefined) data.toClassName = toClassName

    const updated = await prisma.studentTransition.update({
      where: { id },
      data,
      include: {
        student: { include: { user: { select: { displayName: true } } } },
        fromSchool: { select: { name: true, code: true } },
        toSchool: { select: { name: true, code: true } },
      },
    })

    // If completing the transition, actually move the student
    if (status === 'completed') {
      const t = await prisma.studentTransition.findUnique({ where: { id } })
      if (t) {
        await prisma.student.update({
          where: { id: t.studentId },
          data: {
            schoolId: t.toSchoolId,
            gradeLevel: t.toGradeLevel ?? undefined,
            className: t.toClassName ?? undefined,
            enrollmentStatus: 'enrolled',
          },
        })
        // Also update the User's schoolId if cross-school
        const student = await prisma.student.findUnique({ where: { id: t.studentId } })
        if (student && t.fromSchoolId !== t.toSchoolId) {
          await prisma.user.update({
            where: { id: student.userId },
            data: { schoolId: t.toSchoolId },
          })
        }
      }
    }

    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /transitions/bulk-promote — promote all students in a grade level one step up
router.post('/bulk-promote', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user!.schoolId
    if (!schoolId) { res.status(400).json({ success: false, message: 'System admins must specify schoolId' }); return }

    const { fromGradeLevel, toGradeLevel, academicYear } = req.body as {
      fromGradeLevel: string; toGradeLevel: string; academicYear: string
    }

    const students = await prisma.student.findMany({
      where: { schoolId, gradeLevel: fromGradeLevel, enrollmentStatus: 'enrolled' },
      select: { id: true, className: true },
    })

    const transitions = await prisma.studentTransition.createMany({
      data: students.map((s) => ({
        studentId: s.id,
        fromSchoolId: schoolId,
        toSchoolId: schoolId,
        fromGradeLevel,
        toGradeLevel,
        fromClassName: s.className ?? undefined,
        transitionType: 'GRADE_PROMOTION',
        academicYear,
        effectiveDate: new Date(),
        status: 'planned',
        processedById: req.user!.userId,
      })),
    })

    res.json({ success: true, data: { created: transitions.count } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
