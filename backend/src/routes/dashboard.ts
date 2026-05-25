import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// Helper: calculate attendance rate from records
function calcAttendanceRate(records: Array<{ status: string }>): number {
  if (records.length === 0) return 0
  const present = records.filter((r) => r.status === 'present' || r.status === 'late').length
  return Math.round((present / records.length) * 10000) / 100 // percentage with 2 decimals
}

// Helper: calculate weighted GPA from grades
function calcWeightedGpa(grades: Array<{ score: number | null; gradeItem: { maxScore: number; weight: number } }>): number {
  let totalWeight = 0
  let weightedSum = 0
  for (const g of grades) {
    if (g.score === null) continue
    const pct = g.score / g.gradeItem.maxScore // 0-1
    weightedSum += pct * g.gradeItem.weight
    totalWeight += g.gradeItem.weight
  }
  if (totalWeight === 0) return 0
  // Convert to 4.0 scale
  const ratio = weightedSum / totalWeight
  return Math.round(ratio * 4 * 100) / 100
}

// Helper: parse schedule string into day+time slots
// e.g. "Mon/Wed 08:00-09:30 (7A)" → [{day:"Mon",start:480,end:570},{day:"Wed",...}]
function parseScheduleSlots(schedule: string | null): Array<{ day: string; start: number; end: number }> {
  if (!schedule) return []
  const timeMatch = schedule.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/)
  const dayMatch = schedule.match(/^([A-Za-z]+(?:\/[A-Za-z]+)*)/)
  if (!timeMatch || !dayMatch) return []
  const start = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2])
  const end = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4])
  const days = dayMatch[1].split('/')
  return days.map((day) => ({ day, start, end }))
}

function detectTimetableConflicts(
  assignments: Array<{ teacherId: string; schedule: string | null; course: { name: string; code: string }; teacher: { user: { displayName: string } } }>
): Array<{ teacherName: string; course1: string; course2: string; day: string }> {
  const byTeacher: Record<string, typeof assignments> = {}
  for (const a of assignments) {
    if (!byTeacher[a.teacherId]) byTeacher[a.teacherId] = []
    byTeacher[a.teacherId].push(a)
  }
  const conflicts: Array<{ teacherName: string; course1: string; course2: string; day: string }> = []
  for (const teacherAssignments of Object.values(byTeacher)) {
    for (let i = 0; i < teacherAssignments.length; i++) {
      const slotsA = parseScheduleSlots(teacherAssignments[i].schedule)
      for (let j = i + 1; j < teacherAssignments.length; j++) {
        const slotsB = parseScheduleSlots(teacherAssignments[j].schedule)
        for (const a of slotsA) {
          for (const b of slotsB) {
            if (a.day === b.day && a.start < b.end && b.start < a.end) {
              conflicts.push({
                teacherName: teacherAssignments[i].teacher.user.displayName,
                course1: teacherAssignments[i].course.code,
                course2: teacherAssignments[j].course.code,
                day: a.day,
              })
            }
          }
        }
      }
    }
  }
  return conflicts
}

// GET /stats — role-aware dashboard statistics
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!

    if (role === 'admin' || role === 'manager' || role === 'principal') {
      const [totalStudents, totalTeachers, totalCourses, pendingAdmissions, allRecords, students, recentAdmissions, invoices, allTeachers, courseAssignments] =
        await Promise.all([
          prisma.student.count(),
          prisma.teacher.count(),
          prisma.course.count({ where: { status: 'active' } }),
          prisma.admission.count({ where: { status: 'pending' } }),
          prisma.attendanceRecord.findMany({ select: { status: true } }),
          prisma.student.findMany({ select: { gradeLevel: true } }),
          prisma.admission.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
          prisma.feeInvoice.findMany(),
          prisma.teacher.findMany({ select: { employmentStatus: true } }),
          prisma.courseAssignment.findMany({
            include: {
              course: { select: { name: true, code: true } },
              teacher: { include: { user: { select: { displayName: true } } } },
            },
          }),
        ])

      const attendanceRate = calcAttendanceRate(allRecords)

      const gradeCounts: Record<string, number> = {}
      for (const s of students) {
        const level = s.gradeLevel || 'Unassigned'
        gradeCounts[level] = (gradeCounts[level] || 0) + 1
      }
      // Sort by numeric year level (Year 7 < Year 8 ... < Year 11)
      const enrollmentByGrade = Object.entries(gradeCounts)
        .sort((a, b) => {
          const numA = parseInt(a[0].replace(/\D/g, '')) || 0
          const numB = parseInt(b[0].replace(/\D/g, '')) || 0
          return numA - numB
        })
        .map(([gradeLevel, count]) => ({ gradeLevel, count }))

      const totalFees = invoices.reduce((sum, inv) => sum + inv.amount, 0)
      const collected = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)

      const staffStatus = {
        active: allTeachers.filter((t) => t.employmentStatus === 'active').length,
        onLeave: allTeachers.filter((t) => t.employmentStatus === 'onLeave').length,
        inTraining: allTeachers.filter((t) => t.employmentStatus === 'inTraining').length,
      }

      const timetableConflictList = detectTimetableConflicts(courseAssignments)

      res.json({
        success: true,
        data: {
          totalStudents,
          totalTeachers,
          totalCourses,
          attendanceRate,
          pendingAdmissions,
          enrollmentByGrade,
          recentAdmissions,
          financeSummary: { totalFees, collected, outstanding: totalFees - collected },
          staffStatus,
          timetableConflicts: { count: timetableConflictList.length, conflicts: timetableConflictList },
        },
      })
      return
    }

    if (role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId },
        include: { courseAssignments: true },
      })
      const courseIds = teacher ? teacher.courseAssignments.map((a) => a.courseId) : []

      const [myStudents, upcomingSessions, recentGrades] = await Promise.all([
        prisma.enrollment.count({ where: { courseId: { in: courseIds }, status: 'enrolled' } }),
        prisma.attendanceSession.findMany({
          where: { courseId: { in: courseIds }, status: 'active' },
          include: { course: { select: { id: true, code: true, name: true } } },
          orderBy: { date: 'desc' },
          take: 10,
        }),
        prisma.grade.findMany({
          where: { gradeItem: { courseId: { in: courseIds } } },
          include: {
            gradeItem: { select: { name: true, courseId: true } },
            student: { include: { user: { select: { displayName: true } } } },
          },
          orderBy: { gradedAt: 'desc' },
          take: 10,
        }),
      ])

      res.json({
        success: true,
        data: {
          myCourses: courseIds.length,
          myStudents,
          upcomingSessions,
          recentGrades,
        },
      })
      return
    }

    if (role === 'student') {
      const student = await prisma.student.findUnique({ where: { userId } })
      if (!student) {
        res.json({ success: true, data: {} })
        return
      }

      const [enrolledCourses, attendanceRecords, grades, allGradeItems] = await Promise.all([
        prisma.enrollment.count({ where: { studentId: student.id, status: 'enrolled' } }),
        prisma.attendanceRecord.findMany({
          where: { studentId: student.id },
          select: { status: true },
        }),
        prisma.grade.findMany({
          where: { studentId: student.id },
          include: { gradeItem: { select: { id: true, maxScore: true, weight: true, name: true, courseId: true } } },
        }),
        // Get all grade items for enrolled courses to find upcoming items without grades
        prisma.enrollment.findMany({
          where: { studentId: student.id, status: 'enrolled' },
          select: { courseId: true },
        }),
      ])

      const enrolledCourseIds = allGradeItems.map((e) => e.courseId)
      const gradedItemIds = new Set(grades.map((g) => g.gradeItemId))

      const upcomingItems = await prisma.gradeItem.findMany({
        where: {
          courseId: { in: enrolledCourseIds },
          id: { notIn: [...gradedItemIds] },
        },
        include: { course: { select: { name: true, code: true } } },
        orderBy: { dueDate: 'asc' },
      })

      res.json({
        success: true,
        data: {
          enrolledCourses,
          attendanceRate: calcAttendanceRate(attendanceRecords),
          gpa: calcWeightedGpa(grades),
          upcomingItems,
        },
      })
      return
    }

    if (role === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { userId },
        include: {
          childLinks: {
            include: {
              student: {
                include: {
                  user: { select: { id: true, displayName: true } },
                  grades: { include: { gradeItem: { select: { maxScore: true, weight: true } } } },
                  attendances: { select: { status: true } },
                },
              },
            },
          },
        },
      })

      const children = (parent?.childLinks || []).map((link) => {
        const s = link.student
        const grades = s.grades
        // Weighted percentage average (0-100)
        let totalWeight = 0
        let weightedSum = 0
        for (const g of grades) {
          if (g.score === null) continue
          const pct = g.score / g.gradeItem.maxScore
          weightedSum += pct * g.gradeItem.weight
          totalWeight += g.gradeItem.weight
        }
        const gradeAverage = totalWeight === 0 ? 0 : Math.round((weightedSum / totalWeight) * 10000) / 100

        return {
          id: s.id,
          studentId: s.id,
          gradeLevel: s.gradeLevel ?? '',
          className: s.className ?? '',
          user: { displayName: s.user.displayName },
          gpa: calcWeightedGpa(grades),
          gradeAverage,
          attendanceRate: calcAttendanceRate(s.attendances),
        }
      })

      res.json({ success: true, data: { children } })
      return
    }

    if (role === 'finance') {
      const invoices = await prisma.feeInvoice.findMany()

      const totalFees = invoices.reduce((sum, i) => sum + i.amount, 0)
      const collected = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)
      const outstanding = totalFees - collected
      const overdueCount = invoices.filter((i) => i.status === 'overdue').length
      const recentPayments = invoices
        .filter((i) => i.status === 'paid' && i.paidAt)
        .sort((a, b) => (b.paidAt!.getTime() - a.paidAt!.getTime()))
        .slice(0, 5)

      res.json({
        success: true,
        data: { totalFees, collected, outstanding, overdueCount, recentPayments },
      })
      return
    }

    // Fallback for admissions or other roles
    res.json({ success: true, data: {} })
  } catch (error) {
    console.error('GET /dashboard/stats error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
