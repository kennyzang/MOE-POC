import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'
import { timesOverlap } from '../utils/timeUtils'

const router = Router()

// ─── TT-01/02/03: Check conflicts for a proposed slot ────────────
// POST /conflicts/check
// Body: { teacherId, room?, gradeLevel, className, dayOfWeek, startTime, endTime, semester, excludeSlotId? }

router.post('/check', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      teacherId, room, gradeLevel, className,
      dayOfWeek, startTime, endTime, semester,
      excludeSlotId,
    } = req.body as {
      teacherId: string
      room?: string
      gradeLevel: string
      className: string
      dayOfWeek: number
      startTime: string
      endTime: string
      semester: string
      excludeSlotId?: string
    }

    const existing = await prisma.timetableSlot.findMany({
      where: {
        dayOfWeek,
        semester,
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
      include: {
        course: { select: { name: true, code: true } },
        teacher: { include: { user: { select: { displayName: true } } } },
      },
    })

    const conflicts: Array<{
      type: 'teacher' | 'room' | 'class'
      message: string
      conflictingSlot: {
        id: string
        courseName: string
        teacherName: string
        room: string | null
        gradeLevel: string
        className: string | null
        startTime: string
        endTime: string
      }
    }> = []

    for (const slot of existing) {
      if (!timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) continue

      // TT-01: Teacher conflict
      if (slot.teacherId === teacherId) {
        conflicts.push({
          type: 'teacher',
          message: `Teacher ${slot.teacher.user.displayName} is already assigned to ${slot.course.name} (${slot.gradeLevel} ${slot.className}) at this time.`,
          conflictingSlot: {
            id: slot.id,
            courseName: slot.course.name,
            teacherName: slot.teacher.user.displayName,
            room: slot.room,
            gradeLevel: slot.gradeLevel,
            className: slot.className,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        })
      }

      // TT-02: Room conflict
      if (room && slot.room && slot.room.toLowerCase() === room.toLowerCase()) {
        conflicts.push({
          type: 'room',
          message: `Room ${room} is already booked for ${slot.course.name} (${slot.gradeLevel} ${slot.className}) at this time.`,
          conflictingSlot: {
            id: slot.id,
            courseName: slot.course.name,
            teacherName: slot.teacher.user.displayName,
            room: slot.room,
            gradeLevel: slot.gradeLevel,
            className: slot.className,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        })
      }

      // TT-03: Class conflict
      if (slot.gradeLevel === gradeLevel && slot.className === className) {
        conflicts.push({
          type: 'class',
          message: `Class ${gradeLevel} ${className} already has ${slot.course.name} scheduled at this time.`,
          conflictingSlot: {
            id: slot.id,
            courseName: slot.course.name,
            teacherName: slot.teacher.user.displayName,
            room: slot.room,
            gradeLevel: slot.gradeLevel,
            className: slot.className,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        })
      }
    }

    res.json({
      success: true,
      data: {
        hasConflicts: conflicts.length > 0,
        conflicts,
      },
    })
  } catch (error) {
    console.error('POST /conflicts/check error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── TT-04: Substitute Teacher Suggestions ───────────────────────
// GET /conflicts/substitute-suggestions?teacherId=&semester=&dayOfWeek=&startTime=&endTime=

router.get('/substitute-suggestions', authenticate, requireRole('admin', 'manager', 'principal', 'hod'), async (req: AuthRequest, res: Response) => {
  try {
    const { teacherId, semester = '2026-S1', dayOfWeek, startTime, endTime } = req.query as {
      teacherId: string
      semester?: string
      dayOfWeek: string
      startTime: string
      endTime: string
    }

    if (!teacherId || dayOfWeek === undefined || !startTime || !endTime) {
      res.status(400).json({ success: false, message: 'teacherId, dayOfWeek, startTime, endTime are required' })
      return
    }

    const day = Number(dayOfWeek)

    // Find teachers who are busy at this time slot
    const busySlots = await prisma.timetableSlot.findMany({
      where: { semester, dayOfWeek: day },
      select: { teacherId: true, startTime: true, endTime: true },
    })

    const busyTeacherIds = new Set<string>()
    for (const slot of busySlots) {
      if (timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
        busyTeacherIds.add(slot.teacherId)
      }
    }

    // Also exclude teachers on approved leave on any day overlapping
    const onLeave = await prisma.leaveApplication.findMany({
      where: { status: 'PRINCIPAL_APPROVED' },
      include: { teacher: { select: { id: true } } },
    })
    // We don't have exact day mapping from leave dates to dayOfWeek; exclude any on leave today
    const today = new Date()
    for (const leave of onLeave) {
      if (today >= leave.startDate && today <= leave.endDate) {
        busyTeacherIds.add(leave.teacher.id)
      }
    }

    busyTeacherIds.add(teacherId) // exclude the original teacher

    // Get available teachers
    const availableTeachers = await prisma.teacher.findMany({
      where: {
        id: { notIn: Array.from(busyTeacherIds) },
        status: 'active',
      },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
      take: 10,
    })

    // Enrich with their current schedule for that day
    const suggestions = await Promise.all(
      availableTeachers.map(async (t) => {
        const todaySlots = await prisma.timetableSlot.findMany({
          where: { teacherId: t.id, semester, dayOfWeek: day },
          include: { course: { select: { name: true } } },
          orderBy: { startTime: 'asc' },
        })
        return {
          teacherId: t.id,
          userId: t.user.id,
          displayName: t.user.displayName,
          email: t.user.email,
          designation: t.designation,
          department: t.department,
          subjects: t.subjects,
          todaySlots: todaySlots.map((s) => ({ courseName: s.course.name, startTime: s.startTime, endTime: s.endTime })),
          slotsToday: todaySlots.length,
        }
      })
    )

    // Sort: fewer slots today first
    suggestions.sort((a, b) => a.slotsToday - b.slotsToday)

    res.json({ success: true, data: suggestions })
  } catch (error) {
    console.error('GET /conflicts/substitute-suggestions error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── TT-04: Assign Substitute ─────────────────────────────────────
// PATCH /conflicts/assign-substitute
// Body: { slotId, substituteTeacherId }

router.patch('/assign-substitute', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const { slotId, substituteTeacherId } = req.body as { slotId: string; substituteTeacherId: string }

    const slot = await prisma.timetableSlot.findUnique({
      where: { id: slotId },
      include: {
        course: { select: { name: true } },
        teacher: { include: { user: { select: { displayName: true } } } },
      },
    })
    if (!slot) { res.status(404).json({ success: false, message: 'Slot not found' }); return }

    // Verify no conflict for substitute at this slot
    const conflictCheck = await prisma.timetableSlot.findFirst({
      where: {
        teacherId: substituteTeacherId,
        dayOfWeek: slot.dayOfWeek,
        semester: slot.semester,
        id: { not: slotId },
      },
    })
    const hasConflict = conflictCheck && timesOverlap(slot.startTime, slot.endTime, conflictCheck.startTime, conflictCheck.endTime)
    if (hasConflict) {
      res.status(409).json({ success: false, message: 'Substitute teacher has a conflicting slot at this time' })
      return
    }

    // Update the slot
    const updated = await prisma.timetableSlot.update({
      where: { id: slotId },
      data: { teacherId: substituteTeacherId },
      include: {
        course: { select: { name: true } },
        teacher: { include: { user: { select: { displayName: true } } } },
      },
    })

    // Notify substitute
    const sub = await prisma.teacher.findUnique({ where: { id: substituteTeacherId }, select: { userId: true } })
    if (sub) {
      const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      await send({
        userId: sub.userId,
        title: 'Substitute Assignment',
        message: `You have been assigned to substitute for ${slot.teacher.user.displayName} for ${slot.course.name} on ${DAYS[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime}.`,
        type: 'info',
        link: '/sms/timetable',
      })
    }

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /conflicts/assign-substitute error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── GET /conflicts/teacher-on-leave?semester= ────────────────────
// Returns teachers on approved leave with their affected timetable slots

router.get('/teacher-on-leave', authenticate, requireRole('admin', 'manager', 'principal', 'hod'), async (req: AuthRequest, res: Response) => {
  try {
    const { semester = '2026-S1' } = req.query as { semester?: string }

    const today = new Date()
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        status: 'PRINCIPAL_APPROVED',
        startDate: { lte: addDays(today, 14) },
        endDate: { gte: today },
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, displayName: true } },
            timetableSlots: {
              where: { semester },
              include: { course: { select: { name: true, code: true } } },
              orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
            },
          },
        },
      },
    })

    const data = leaves.map((l) => ({
      leaveId: l.id,
      teacherId: l.teacher.id,
      teacherName: l.teacher.user.displayName,
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      daysRemaining: Math.max(0, Math.ceil((l.endDate.getTime() - today.getTime()) / 86400000)),
      affectedSlots: l.teacher.timetableSlots.map((s) => ({
        slotId: s.id,
        courseName: s.course.name,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        gradeLevel: s.gradeLevel,
        className: s.className,
      })),
    }))

    res.json({ success: true, data })
  } catch (error) {
    console.error('GET /conflicts/teacher-on-leave error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default router
