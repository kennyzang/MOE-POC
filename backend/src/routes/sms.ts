import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'
import { broadcast } from './events'

const router = Router()

// ─── Time slots definition ──────────────────────────────────────────────────
const TIME_SLOTS = [
  { startTime: '08:00', endTime: '09:30' },
  { startTime: '10:00', endTime: '11:30' },
  { startTime: '13:00', endTime: '14:30' },
  { startTime: '14:30', endTime: '16:00' },
]
const DAYS = [0, 1, 2, 3, 4] // Mon-Fri

// ─── GET /api/v1/sms/timetable ──────────────────────────────────────────────
// Query params: gradeLevel, className, semester
router.get(
  '/timetable',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { gradeLevel = 'Year 7', className = '7A', semester = '2026-S1' } = req.query

      const slots = await prisma.timetableSlot.findMany({
        where: {
          gradeLevel: gradeLevel as string,
          className: className as string,
          semester: semester as string,
        },
        include: {
          course: { select: { id: true, code: true, name: true } },
          teacher: {
            select: {
              id: true,
              user: { select: { displayName: true } },
            },
          },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      })

      res.json({ success: true, data: slots })
    } catch (error) {
      console.error('Error fetching timetable:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── POST /api/v1/sms/timetable/generate ────────────────────────────────────
// body: { gradeLevel, className, semester, constraints: [{teacherId, dayOfWeek, startTime, reason}] }
router.post(
  '/timetable/generate',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        gradeLevel = 'Year 7',
        className = '7A',
        semester = '2026-S1',
        constraints = [],
      } = req.body as {
        gradeLevel?: string
        className?: string
        semester?: string
        constraints?: Array<{ teacherId: string; dayOfWeek: number; startTime: string; reason?: string }>
      }

      // Build constraint set for fast lookup: key = `${teacherId}-${dayOfWeek}-${startTime}`
      const constraintSet = new Set(
        constraints.map((c) => `${c.teacherId}-${c.dayOfWeek}-${c.startTime}`)
      )

      // Fetch course assignments for this grade
      const assignments = await prisma.courseAssignment.findMany({
        where: { semester },
        include: {
          course: { select: { id: true, code: true, name: true, gradeLevel: true } },
          teacher: { select: { id: true } },
        },
      })

      // Filter to courses relevant for this grade level
      const relevantAssignments = assignments.filter(
        (a) => !a.course.gradeLevel || a.course.gradeLevel === gradeLevel
      )

      if (relevantAssignments.length === 0) {
        res.status(400).json({
          success: false,
          message: `No course assignments found for ${gradeLevel} in semester ${semester}`,
        })
        return
      }

      // Build schedule: track occupied slots per teacher per day
      // occupied key: `${teacherId}-${dayOfWeek}-${startTime}`
      const occupied = new Set<string>()

      // Each course assignment gets up to 2 slots per week
      const newSlots: Array<{
        courseId: string
        teacherId: string
        gradeLevel: string
        className: string
        dayOfWeek: number
        startTime: string
        endTime: string
        room: string
        semester: string
      }> = []

      // Determine default room per course
      const roomMap: Record<string, string> = {
        SCI701: 'Science Lab 1',
        ICT701: 'Computer Lab',
      }
      const defaultRoom = `Classroom ${className}`

      for (const assignment of relevantAssignments) {
        const { course, teacher } = assignment
        let slotsAssigned = 0
        const maxSlotsPerCourse = course.code === 'ICT701' || course.code === 'MIB701' ? 1 : 2

        for (const day of DAYS) {
          if (slotsAssigned >= maxSlotsPerCourse) break
          for (const slot of TIME_SLOTS) {
            if (slotsAssigned >= maxSlotsPerCourse) break

            const slotKey = `${teacher.id}-${day}-${slot.startTime}`
            const classSlotKey = `class-${className}-${day}-${slot.startTime}`

            // Skip if constraint forbids it
            if (constraintSet.has(slotKey)) continue
            // Skip if teacher is already occupied at this slot
            if (occupied.has(slotKey)) continue
            // Skip if the class already has a lesson at this slot
            if (occupied.has(classSlotKey)) continue

            // Assign
            occupied.add(slotKey)
            occupied.add(classSlotKey)
            slotsAssigned++

            newSlots.push({
              courseId: course.id,
              teacherId: teacher.id,
              gradeLevel,
              className,
              dayOfWeek: day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room: roomMap[course.code] ?? defaultRoom,
              semester,
            })
          }
        }

        if (slotsAssigned === 0) {
          res.status(409).json({
            success: false,
            message: `Cannot generate timetable with given constraints: no valid slot for ${course.name}`,
          })
          return
        }
      }

      // Artificial delay: 12-15 seconds so the loading animation feels real (spec §3.1)
      const delayMs = 12000 + Math.floor(Math.random() * 3000)
      await new Promise(resolve => setTimeout(resolve, delayMs))

      // Replace existing slots
      await prisma.timetableSlot.deleteMany({
        where: { gradeLevel, className, semester },
      })

      await prisma.timetableSlot.createMany({ data: newSlots })

      // Return fresh timetable with relations
      const result = await prisma.timetableSlot.findMany({
        where: { gradeLevel, className, semester },
        include: {
          course: { select: { id: true, code: true, name: true } },
          teacher: {
            select: {
              id: true,
              user: { select: { displayName: true } },
            },
          },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      })

      res.json({ success: true, data: result, count: result.length })
    } catch (error) {
      console.error('Error generating timetable:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── POST /api/v1/sms/timetable/publish ─────────────────────────────────────
// Marks the current timetable as published and broadcasts SSE to all students/teachers
router.post(
  '/timetable/publish',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { gradeLevel = 'Year 7', className = '7A', semester = '2026-S1' } = req.body as {
        gradeLevel?: string; className?: string; semester?: string
      }

      const count = await prisma.timetableSlot.count({ where: { gradeLevel, className, semester } })
      if (count === 0) {
        res.status(404).json({ success: false, message: 'No timetable slots found to publish' }); return
      }

      // Notify all enrolled students in this class/grade
      const students = await prisma.student.findMany({
        where: { gradeLevel, className, enrollmentStatus: 'enrolled' },
        include: {
          user: { select: { id: true } },
          parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
        },
      })

      const allNotifyIds = students.flatMap(s => [
        s.userId,
        ...s.parentLinks.map(l => l.parent.user.id),
      ]).filter(Boolean) as string[]

      const uniqueIds = [...new Set(allNotifyIds)]
      await Promise.all(
        uniqueIds.map(uid =>
          send({
            userId: uid,
            title: 'Timetable Updated',
            message: `The ${gradeLevel} (${className}) timetable for ${semester} has been published.`,
            type: 'info',
          }),
        ),
      )

      // SSE: update timetable health widget + notify class change
      broadcast('dashboard', 'dashboard.timetable.changed', { timetableHealth: 98 })
      broadcast('timetable', 'timetable.published', { gradeLevel, className, semester })

      res.json({ success: true, data: { published: true, notifiedCount: uniqueIds.length, gradeLevel, className, semester } })
    } catch (error) {
      console.error('Error publishing timetable:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── GET /api/v1/sms/facilities ─────────────────────────────────────────────
router.get(
  '/facilities',
  authenticate,
  async (_req: AuthRequest, res: Response) => {
    try {
      const facilities = await prisma.facility.findMany({
        include: {
          bookings: {
            orderBy: { date: 'desc' },
            take: 5,
          },
        },
        orderBy: { name: 'asc' },
      })
      res.json({ success: true, data: facilities })
    } catch (error) {
      console.error('Error fetching facilities:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── GET /api/v1/sms/facilities/bookings ────────────────────────────────────
router.get(
  '/facilities/bookings',
  authenticate,
  async (_req: AuthRequest, res: Response) => {
    try {
      const bookings = await prisma.facilityBooking.findMany({
        include: {
          facility: { select: { id: true, name: true, type: true } },
        },
        orderBy: { date: 'asc' },
      })
      res.json({ success: true, data: bookings })
    } catch (error) {
      console.error('Error fetching bookings:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── POST /api/v1/sms/facilities/check-conflict ─────────────────────────────
// Returns { available: true } or { available: false, conflict, alternatives }
router.post(
  '/facilities/check-conflict',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { facilityId, date, startTime, endTime } = req.body as {
        facilityId: string; date: string; startTime: string; endTime: string
      }

      if (!facilityId || !date || !startTime || !endTime) {
        res.status(400).json({ success: false, message: 'facilityId, date, startTime, endTime are required' }); return
      }

      const bookingDate = new Date(date)
      const dayStart = new Date(bookingDate); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(bookingDate); dayEnd.setHours(23, 59, 59, 999)

      // Check for conflict: same facility, same date, overlapping time
      const conflict = await prisma.facilityBooking.findFirst({
        where: {
          facilityId,
          date: { gte: dayStart, lte: dayEnd },
          status: { not: 'cancelled' },
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ],
        },
        include: {
          facility: { select: { name: true } },
        },
      })

      if (!conflict) {
        res.json({ success: true, data: { available: true } }); return
      }

      // Find same facility on other time slots today
      const allBookingsToday = await prisma.facilityBooking.findMany({
        where: { facilityId, date: { gte: dayStart, lte: dayEnd }, status: { not: 'cancelled' } },
      })
      const bookedTimes = new Set(allBookingsToday.map(b => `${b.startTime}-${b.endTime}`))
      const allSlots = [
        { startTime: '08:00', endTime: '09:30' },
        { startTime: '10:00', endTime: '11:30' },
        { startTime: '13:00', endTime: '14:30' },
        { startTime: '14:30', endTime: '16:00' },
      ]
      const sameFacilityOtherSlots = allSlots.filter(
        s => !bookedTimes.has(`${s.startTime}-${s.endTime}`) &&
             !(s.startTime < endTime && s.endTime > startTime),
      ).map(s => ({ date, startTime: s.startTime, endTime: s.endTime }))

      // Find other facilities of same type with no conflict at requested time
      const requestedFacility = await prisma.facility.findUnique({ where: { id: facilityId } })
      const otherFacilities = requestedFacility
        ? await prisma.facility.findMany({
            where: { id: { not: facilityId }, type: requestedFacility.type, status: 'available' },
          })
        : []

      const availableAlternates: Array<{ facilityId: string; facilityName: string }> = []
      for (const f of otherFacilities) {
        const hasConflict = await prisma.facilityBooking.findFirst({
          where: {
            facilityId: f.id,
            date: { gte: dayStart, lte: dayEnd },
            status: { not: 'cancelled' },
            AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
          },
        })
        if (!hasConflict) {
          availableAlternates.push({ facilityId: f.id, facilityName: f.name })
        }
      }

      // Look up who booked it
      const bookerUser = await prisma.user.findUnique({ where: { id: conflict.bookedBy }, select: { displayName: true } })

      res.status(409).json({
        success: false,
        data: {
          available: false,
          conflict: {
            bookedBy: bookerUser?.displayName ?? 'Unknown',
            purpose: conflict.purpose,
            startTime: conflict.startTime,
            endTime: conflict.endTime,
          },
          alternatives: {
            sameFacilityOtherSlots,
            otherFacilitiesSameSlot: availableAlternates.slice(0, 3),
          },
        },
      })
    } catch (error) {
      console.error('Error checking facility conflict:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── POST /api/v1/sms/facilities/book ───────────────────────────────────────
router.post(
  '/facilities/book',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { facilityId, purpose, date, startTime, endTime } = req.body as {
        facilityId: string
        purpose: string
        date: string
        startTime: string
        endTime: string
      }

      if (!facilityId || !purpose || !date || !startTime || !endTime) {
        res.status(400).json({ success: false, message: 'Missing required fields' })
        return
      }

      const facility = await prisma.facility.findUnique({ where: { id: facilityId } })
      if (!facility) {
        res.status(404).json({ success: false, message: 'Facility not found' })
        return
      }

      // Conflict check before confirming
      const bookingDate = new Date(date)
      const dayStart = new Date(bookingDate); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(bookingDate); dayEnd.setHours(23, 59, 59, 999)
      const conflict = await prisma.facilityBooking.findFirst({
        where: {
          facilityId,
          date: { gte: dayStart, lte: dayEnd },
          status: { not: 'cancelled' },
          AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
        },
      })
      if (conflict) {
        res.status(409).json({
          success: false,
          message: `Facility is already booked for ${conflict.startTime}–${conflict.endTime}. Use /check-conflict for alternatives.`,
        })
        return
      }

      const booking = await prisma.facilityBooking.create({
        data: {
          facilityId,
          bookedBy: req.user!.userId,
          purpose,
          date: new Date(date),
          startTime,
          endTime,
          status: 'approved',
        },
        include: {
          facility: { select: { id: true, name: true, type: true } },
        },
      })

      // Notify booker
      await send({
        userId: req.user!.userId,
        title: 'Facility Booking Confirmed',
        message: `Your booking for ${facility.name} on ${date} (${startTime}–${endTime}) has been confirmed.`,
        type: 'success',
      })

      res.status(201).json({ success: true, data: booking })
    } catch (error) {
      console.error('Error booking facility:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── GET /sms/calendar-events ──────────────────────────────────────────────
router.get('/calendar-events', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const events = await prisma.schoolEvent.findMany({
      orderBy: { date: 'asc' },
    })
    res.json({ success: true, data: events })
  } catch (error) {
    console.error('GET /sms/calendar-events error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── POST /sms/calendar-events ─────────────────────────────────────────────
router.post(
  '/calendar-events',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, date, endDate, type, description } = req.body as {
        title: string
        date: string
        endDate?: string
        type?: string
        description?: string
      }
      if (!title || !date) {
        res.status(400).json({ success: false, message: 'title and date are required' })
        return
      }
      const event = await prisma.schoolEvent.create({
        data: {
          title,
          date: new Date(date),
          endDate: endDate ? new Date(endDate) : undefined,
          type: type ?? 'event',
          description,
        },
      })
      res.status(201).json({ success: true, data: event })
    } catch (error) {
      console.error('POST /sms/calendar-events error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── DELETE /sms/calendar-events/:id ───────────────────────────────────────
router.delete(
  '/calendar-events/:id',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.schoolEvent.delete({ where: { id: req.params.id as string } })
      res.json({ success: true })
    } catch (error) {
      console.error('DELETE /sms/calendar-events error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

export default router
