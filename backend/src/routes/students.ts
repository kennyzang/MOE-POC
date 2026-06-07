import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, schoolFilter, type AuthRequest } from '../middleware/auth'
import { USER_SELECT_FULL, USER_SELECT_NAME } from '../lib/querySelects'

const router = Router()

// GET /students — list all students with user info
router.get(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'teacher', 'principal', 'counselor', 'hod', 'admissions'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { search, gradeLevel, className, status, schoolId } = req.query

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { ...schoolFilter(req) }

      // Sysadmin may pass schoolId to scope the listing to a specific school
      if (schoolId && req.user?.systemAdmin) where.schoolId = schoolId as string

      if (gradeLevel) where.gradeLevel = gradeLevel as string
      if (className) where.className = className as string
      if (status) where.enrollmentStatus = status as string

      if (search) {
        where.OR = [
          { studentId: { contains: search as string } },
          { user: { displayName: { contains: search as string } } },
          { user: { username: { contains: search as string } } },
        ]
      }

      // Teacher: scope to own form class + students enrolled in their courses
      if (req.user!.role === 'teacher') {
        const teacher = await prisma.teacher.findUnique({
          where: { userId: req.user!.userId },
          include: { courseAssignments: { select: { courseId: true } } },
        })
        if (teacher) {
          const courseIds = teacher.courseAssignments.map((a) => a.courseId)
          const formRoster = await prisma.classRoster.findFirst({
            where: { formTeacherId: teacher.id },
            select: { className: true, gradeLevel: true },
          })
          const formClassIds: string[] = []
          if (formRoster) {
            const fc = await prisma.student.findMany({
              where: { className: formRoster.className, gradeLevel: formRoster.gradeLevel, enrollmentStatus: 'enrolled' },
              select: { id: true },
            })
            formClassIds.push(...fc.map((s) => s.id))
          }
          const enrolled = await prisma.enrollment.findMany({
            where: { courseId: { in: courseIds }, status: 'enrolled' },
            select: { studentId: true },
          })
          const allowed = [...new Set([...formClassIds, ...enrolled.map((e) => e.studentId)])]
          if (allowed.length > 0) {
            where.id = { in: allowed }
          }
        }
      }

      const students = await prisma.student.findMany({
        where,
        include: {
          user: { select: USER_SELECT_FULL },
        },
        orderBy: { createdAt: 'desc' },
      })

      res.json({ success: true, data: students })
    } catch (error) {
      console.error('Error listing students:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// GET /students/me — return the current student's own record
router.get('/me', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId },
      include: {
        user: {
          select: USER_SELECT_FULL,
        },
        enrollments: { include: { course: true } },
        grades: { include: { gradeItem: true } },
      },
    })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found' })
      return
    }
    res.json({ success: true, data: student })
  } catch (error) {
    console.error('GET /students/me error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id — get single student with details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const { role, userId } = req.user!

    // Role check
    if (!['admin', 'manager', 'teacher', 'student', 'parent', 'counselor', 'hod', 'admissions', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            avatar: true,
            status: true,
          },
        },
        enrollments: {
          include: {
            course: {
              include: {
                assignments: {
                  include: {
                    teacher: {
                      include: { user: { select: USER_SELECT_NAME } },
                    },
                  },
                  take: 1,
                },
              },
            },
          },
        },
        grades: {
          include: {
            gradeItem: {
              include: { course: { select: { id: true, code: true, name: true } } },
            },
          },
        },
        riskScores: {
          orderBy: { computedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { counselorCases: true },
        },
      },
    })

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }

    // Student can only view own record
    if (role === 'student' && student.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    // Parent can only view own children
    if (role === 'parent') {
      const parent = await prisma.parent.findUnique({ where: { userId } })
      if (!parent) {
        res.status(403).json({ success: false, message: 'Forbidden' })
        return
      }
      const link = await prisma.parentStudent.findFirst({
        where: { parentId: parent.id, studentId: student.id },
      })
      if (!link) {
        res.status(403).json({ success: false, message: 'Forbidden' })
        return
      }
    }

    res.json({ success: true, data: student })
  } catch (error) {
    console.error('Error getting student:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id/attendance-history — all attendance records for a student
router.get('/:id/attendance-history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const studentId = req.params.id as string

    if (!['admin', 'manager', 'teacher', 'counselor', 'principal', 'student', 'parent'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }
    if (role === 'student' && student.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const records = await prisma.attendanceRecord.findMany({
      where: { studentId },
      include: {
        session: {
          include: { course: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: { session: { date: 'desc' } },
    })

    res.json({ success: true, data: records })
  } catch (error) {
    console.error('GET /students/:id/attendance-history error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id/standing-history — academic standing history
router.get('/:id/standing-history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const studentId = req.params.id as string

    if (!['admin', 'manager', 'teacher', 'counselor', 'principal', 'student', 'parent'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }
    if (role === 'student' && student.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const history = await prisma.academicStandingHistory.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: history })
  } catch (error) {
    console.error('GET /students/:id/standing-history error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id/invoices — fee invoices for a student
router.get('/:id/invoices', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const studentId = req.params.id as string

    if (!['admin', 'manager', 'finance', 'principal', 'student', 'parent'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }
    if (role === 'student' && student.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const invoices = await prisma.feeInvoice.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: invoices })
  } catch (error) {
    console.error('GET /students/:id/invoices error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/:id/counselor-cases — counselor cases for a student
router.get('/:id/counselor-cases', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.user!
    const studentId = req.params.id as string

    if (!['admin', 'manager', 'counselor', 'principal'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' })
      return
    }

    const cases = await prisma.counselorCase.findMany({
      where: { studentId },
      orderBy: { openedAt: 'desc' },
    })

    res.json({ success: true, data: cases })
  } catch (error) {
    console.error('GET /students/:id/counselor-cases error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /students/:id — update student fields
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { gradeLevel, className, enrollmentStatus, gender, nationality, dateOfBirth } = req.body

      const existing = await prisma.student.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, message: 'Student not found' })
        return
      }

      const data: any = {}
      if (gradeLevel !== undefined) data.gradeLevel = gradeLevel
      if (className !== undefined) data.className = className
      if (enrollmentStatus !== undefined) data.enrollmentStatus = enrollmentStatus
      if (gender !== undefined) data.gender = gender
      if (nationality !== undefined) data.nationality = nationality
      if (dateOfBirth !== undefined) data.dateOfBirth = new Date(dateOfBirth)

      const student = await prisma.student.update({
        where: { id },
        data,
        include: {
          user: { select: USER_SELECT_FULL },
        },
      })

      res.json({ success: true, data: student })
    } catch (error) {
      console.error('Error updating student:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// GET /students/me/assignments — published assignments for enrolled courses
router.get('/me/assignments', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
    if (!student) { res.json({ success: true, data: [] }); return }

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'enrolled' },
      select: { courseId: true },
    })
    const courseIds = enrollments.map((e) => e.courseId)

    const assignments = await prisma.assignment.findMany({
      where: { courseId: { in: courseIds }, status: 'published' },
      include: {
        course: { select: { name: true, code: true } },
        submissions: { where: { studentId: student.id } },
      },
      orderBy: { dueDate: 'asc' },
    })

    const data = assignments.map((a) => {
      const submission = a.submissions[0] ?? null
      return {
        ...a,
        submission,
        submissionStatus: submission
          ? submission.status
          : a.dueDate && new Date() > a.dueDate
            ? 'overdue'
            : 'pending',
      }
    })

    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Transcript helpers ─────────────────────────────────────────────────────

function scoreToLetter(avg: number | null): string {
  if (avg === null) return '-'
  if (avg >= 90) return 'A+'
  if (avg >= 80) return 'A'
  if (avg >= 70) return 'B'
  if (avg >= 60) return 'C'
  if (avg >= 50) return 'D'
  return 'F'
}

function letterToGPA(letter: string): number {
  const map: Record<string, number> = {
    'A+': 4.0, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0, '-': 0.0,
  }
  return map[letter] ?? 0.0
}

// GET /students/:id/transcript — full academic transcript (staff + student self + parent child)
router.get('/:id/transcript', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!
    const targetId = req.params.id as string

    // Access control
    if (role === 'student') {
      const me = await prisma.student.findUnique({ where: { userId }, select: { id: true } })
      if (!me || me.id !== targetId) {
        res.status(403).json({ success: false, message: 'Forbidden' }); return
      }
    } else if (role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId }, include: { childLinks: { select: { studentId: true } } },
      })
      const childIds = parent?.childLinks.map((l) => l.studentId) ?? []
      if (!childIds.includes(targetId)) {
        res.status(403).json({ success: false, message: 'Forbidden' }); return
      }
    } else if (!['admin', 'manager', 'principal', 'hod', 'teacher', 'counselor', 'admissions'].includes(role)) {
      res.status(403).json({ success: false, message: 'Forbidden' }); return
    }

    const student = await prisma.student.findUnique({
      where: { id: targetId },
      include: {
        user: { select: { displayName: true, email: true } },
        enrollments: {
          where: { status: { not: 'dropped' } },
          include: {
            course: {
              include: {
                gradeItems: {
                  include: { grades: { where: { studentId: targetId }, select: { score: true, letterGrade: true, gradedAt: true } } },
                  orderBy: { dueDate: 'asc' },
                },
                assignments: { select: { semester: true }, take: 1 },
              },
            },
          },
          orderBy: { enrolledAt: 'asc' },
        },
        attendances: {
          include: { session: { select: { courseId: true, date: true } } },
        },
        standingHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' }); return
    }

    // Behavior
    const behaviors = await prisma.behaviorRecord.findMany({ where: { studentId: targetId } })
    const merits   = behaviors.filter((b) => b.type === 'merit').reduce((s, b) => s + b.points, 0)
    const demerits = behaviors.filter((b) => b.type === 'demerit').reduce((s, b) => s + Math.abs(b.points), 0)

    // Per-course computation
    const courses = student.enrollments.map((e) => {
      const c = e.course
      let totalWeight = 0, weightedSum = 0
      const gradeItems = c.gradeItems.map((gi) => {
        const g = gi.grades[0] ?? null
        if (g?.score != null) {
          weightedSum += (g.score / gi.maxScore) * 100 * gi.weight
          totalWeight += gi.weight
        }
        return {
          id: gi.id,
          name: gi.name,
          type: gi.type,
          maxScore: gi.maxScore,
          weight: gi.weight,
          score: g?.score ?? null,
          letterGrade: g?.letterGrade ?? null,
          percentage: g?.score != null ? Math.round((g.score / gi.maxScore) * 1000) / 10 : null,
          dueDate: gi.dueDate,
          gradedAt: g?.gradedAt ?? null,
        }
      })
      const courseAverage = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null
      const letterGrade = scoreToLetter(courseAverage)

      const courseAtts = student.attendances.filter((a) => a.session.courseId === c.id)
      const attRate = courseAtts.length > 0
        ? Math.round((courseAtts.filter((a) => a.status === 'present' || a.status === 'late').length / courseAtts.length) * 1000) / 10
        : null

      return {
        courseId: c.id,
        courseCode: c.code,
        courseName: c.name,
        gradeLevel: c.gradeLevel,
        creditHours: c.creditHours,
        semester: e.semester ?? c.assignments[0]?.semester ?? '2026-S1',
        enrollmentStatus: e.status,
        courseAverage,
        letterGrade,
        gpaPoints: letterToGPA(letterGrade),
        courseAttendanceRate: attRate,
        gradeItems,
      }
    })

    // Cumulative GPA (credit-hour weighted)
    let totalCredits = 0, gpaSum = 0
    for (const c of courses.filter((c) => c.courseAverage !== null)) {
      gpaSum += c.gpaPoints * (c.creditHours || 3)
      totalCredits += c.creditHours || 3
    }
    const cumulativeGPA = totalCredits > 0 ? Math.round((gpaSum / totalCredits) * 100) / 100 : null

    // Attendance totals
    const atts = student.attendances
    const attPresent = atts.filter((a) => a.status === 'present').length
    const attLate    = atts.filter((a) => a.status === 'late').length
    const attAbsent  = atts.filter((a) => a.status === 'absent').length
    const attExcused = atts.filter((a) => a.status === 'excused').length
    const attTotal   = atts.length
    const attRate    = attTotal > 0 ? Math.round(((attPresent + attLate) / attTotal) * 1000) / 10 : 0

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          studentId: student.studentId,
          displayName: student.user.displayName,
          email: student.user.email,
          gradeLevel: student.gradeLevel,
          className: student.className,
          enrollmentStatus: student.enrollmentStatus,
          academicStanding: student.academicStanding,
          academicStandingUpdatedAt: student.academicStandingUpdatedAt,
        },
        courses,
        cumulativeGPA,
        totalCreditHours: totalCredits,
        attendance: {
          total: attTotal, present: attPresent, late: attLate,
          absent: attAbsent, excused: attExcused, rate: attRate,
        },
        conduct: { merits, demerits, netPoints: merits - demerits },
        standingHistory: student.standingHistory,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('GET /students/:id/transcript error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /students/me/behavior — own behavior records
router.get('/me/behavior', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.userId } })
    if (!student) { res.json({ success: true, data: { records: [], netPoints: 0, merits: 0, demerits: 0 } }); return }

    const records = await prisma.behaviorRecord.findMany({
      where: { studentId: student.id },
      include: { recordedBy: { select: { displayName: true, role: true } } },
      orderBy: { date: 'desc' },
    })
    const merits = records.filter((r) => r.type === 'merit').reduce((s, r) => s + r.points, 0)
    const demerits = records.filter((r) => r.type === 'demerit').reduce((s, r) => s + Math.abs(r.points), 0)
    res.json({ success: true, data: { records, netPoints: merits - demerits, merits, demerits } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
