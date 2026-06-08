import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, schoolFilter, type AuthRequest } from '../middleware/auth'
import { USER_SELECT_BASIC, USER_SELECT_CONTACT } from '../lib/querySelects'

const router = Router()

// GET /courses — list courses with assignments
router.get(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'hod', 'principal', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { search, gradeLevel, status } = req.query

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { ...schoolFilter(req) }

      if (gradeLevel) where.gradeLevel = gradeLevel as string
      if (status) where.status = status as string

      if (search) {
        where.OR = [
          { code: { contains: search as string } },
          { name: { contains: search as string } },
        ]
      }

      // Teacher: scope to only their assigned courses
      if (req.user!.role === 'teacher') {
        const teacher = await prisma.teacher.findUnique({
          where: { userId: req.user!.userId },
          select: { courseAssignments: { select: { courseId: true } } },
        })
        if (teacher) {
          const assignedIds = teacher.courseAssignments.map((a) => a.courseId)
          where.id = { in: assignedIds }
        }
      }

      const courses = await prisma.course.findMany({
        where,
        include: {
          assignments: {
            include: {
              teacher: {
                include: {
                  user: { select: USER_SELECT_BASIC },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      res.json({ success: true, data: courses })
    } catch (error) {
      console.error('Error listing courses:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// GET /courses/:id — full course detail
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'hod', 'principal', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params['id'] as string

      const course = await prisma.course.findUnique({
        where: { id },
        include: {
          assignments: {
            include: {
              teacher: {
                include: {
                  user: { select: USER_SELECT_CONTACT },
                },
              },
            },
          },
          enrollments: {
            include: {
              student: {
                include: {
                  user: { select: USER_SELECT_BASIC },
                  grades: {
                    include: { gradeItem: true },
                    where: { gradeItem: { courseId: id } },
                  },
                },
              },
            },
            orderBy: { enrolledAt: 'desc' },
          },
          attendanceSessions: {
            include: {
              _count: {
                select: {
                  records: true,
                },
              },
            },
            orderBy: { date: 'desc' },
          },
          gradeItems: {
            include: {
              _count: { select: { grades: true } },
            },
            orderBy: { dueDate: 'asc' },
          },
          timetableSlots: true,
        },
      })

      if (!course) {
        res.status(404).json({ success: false, message: 'Course not found' })
        return
      }

      // Compute per-student attendance counts for this course
      const studentIds = course.enrollments.map((e) => e.studentId)
      const sessionIds = course.attendanceSessions.map((s) => s.id)

      const attendanceCounts = sessionIds.length > 0 && studentIds.length > 0
        ? await prisma.attendanceRecord.groupBy({
            by: ['studentId', 'status'],
            where: { sessionId: { in: sessionIds }, studentId: { in: studentIds } },
            _count: true,
          })
        : []

      res.json({ success: true, data: { ...course, attendanceCounts } })
    } catch (error) {
      console.error('GET /courses/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// POST /courses — create course
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { code, name, description, gradeLevel, creditHours, status } = req.body

      if (!code || !name) {
        res.status(400).json({ success: false, message: 'Code and name are required' })
        return
      }

      const existing = await prisma.course.findFirst({ where: { code, schoolId: req.user!.schoolId ?? null } })
      if (existing) {
        res.status(409).json({ success: false, message: 'Course code already exists' })
        return
      }

      const course = await prisma.course.create({
        data: {
          code,
          name,
          description,
          gradeLevel,
          creditHours: creditHours ?? 1,
          status: status ?? 'active',
        },
      })

      res.status(201).json({ success: true, data: course })
    } catch (error) {
      console.error('Error creating course:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// PATCH /courses/:id — update course
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { name, description, gradeLevel, creditHours, status } = req.body

      const existing = await prisma.course.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, message: 'Course not found' })
        return
      }

      const data: any = {}
      if (name !== undefined) data.name = name
      if (description !== undefined) data.description = description
      if (gradeLevel !== undefined) data.gradeLevel = gradeLevel
      if (creditHours !== undefined) data.creditHours = creditHours
      if (status !== undefined) data.status = status

      const course = await prisma.course.update({
        where: { id },
        data,
      })

      res.json({ success: true, data: course })
    } catch (error) {
      console.error('Error updating course:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// DELETE /courses/:id — delete course (only if no enrollments)
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string

      const course = await prisma.course.findUnique({ where: { id } })
      if (!course) {
        res.status(404).json({ success: false, message: 'Course not found' })
        return
      }

      const enrollmentCount = await prisma.enrollment.count({ where: { courseId: id } })
      if (enrollmentCount > 0) {
        res.status(409).json({
          success: false,
          message: 'Cannot delete course with existing enrollments',
        })
        return
      }

      // Clean up related records before deleting
      await prisma.$transaction([
        prisma.courseAssignment.deleteMany({ where: { courseId: id } }),
        prisma.gradeItem.deleteMany({ where: { courseId: id } }),
        prisma.attendanceSession.deleteMany({ where: { courseId: id } }),
        prisma.course.delete({ where: { id } }),
      ])

      res.json({ success: true, data: { id } })
    } catch (error) {
      console.error('Error deleting course:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// GET /courses/workload-timetable
// Returns timetable slot data for the workload page.
// ?teacherId=<id>&semester=<s>
// No teacherId → aggregate workload summary (all teachers)
// With teacherId  → full slot list for that teacher (for grid display)
router.get(
  '/workload-timetable',
  authenticate,
  requireRole('admin', 'manager', 'hod', 'principal', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { teacherId, semester } = req.query as { teacherId?: string; semester?: string }
      const { role, userId } = req.user!

      // Teachers can only query their own timetable
      let resolvedTeacherId = teacherId
      if (role === 'teacher') {
        const me = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } })
        resolvedTeacherId = me?.id
      }

      const semesterFilter = semester ? { semester: semester as string } : {}

      if (resolvedTeacherId) {
        // Slot-level view for a specific teacher
        const slots = await prisma.timetableSlot.findMany({
          where: { teacherId: resolvedTeacherId, ...semesterFilter },
          include: {
            course: { select: { id: true, code: true, name: true, creditHours: true } },
            teacher: { include: { user: { select: { displayName: true } } } },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        })
        res.json({ success: true, mode: 'timetable', data: slots })
      } else {
        // Summary across all teachers
        const slots = await prisma.timetableSlot.findMany({
          where: { ...schoolFilter(req), ...semesterFilter },
          include: {
            course: { select: { id: true, code: true, name: true, creditHours: true } },
            teacher: { include: { user: { select: { displayName: true } } } },
          },
        })

        // Aggregate by teacher
        const map = new Map<string, { teacherId: string; teacherName: string; department: string; slots: typeof slots; totalPeriods: number; subjects: Set<string> }>()
        for (const s of slots) {
          const tid = s.teacherId
          if (!map.has(tid)) {
            map.set(tid, {
              teacherId: tid,
              teacherName: s.teacher.user.displayName,
              department: s.teacher.department ?? '',
              slots: [],
              totalPeriods: 0,
              subjects: new Set(),
            })
          }
          const entry = map.get(tid)!
          entry.slots.push(s)
          entry.totalPeriods++
          entry.subjects.add(s.course.name)
        }

        const summary = [...map.values()].map(e => ({
          teacherId: e.teacherId,
          teacherName: e.teacherName,
          department: e.department,
          totalPeriods: e.totalPeriods,
          subjects: [...e.subjects],
        })).sort((a, b) => b.totalPeriods - a.totalPeriods)

        res.json({ success: true, mode: 'summary', data: summary })
      }
    } catch (error) {
      console.error('GET /courses/workload-timetable error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

export default router
