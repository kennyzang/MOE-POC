import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, schoolFilter, type AuthRequest } from '../middleware/auth'

const router = Router()

// ─── RP-01: Teachers & Staff on Medical Leave (MC) ───────────────
router.get(
  '/staff/mc',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'hod'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { dateFrom, dateTo, department } = req.query as Record<string, string>
      const now = new Date()
      const from = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1)
      const to = dateTo ? new Date(dateTo) : new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const where: any = {
        leaveType: 'MEDICAL',
        status: { in: ['PRINCIPAL_APPROVED', 'HOD_APPROVED'] },
        OR: [
          { startDate: { lte: to }, endDate: { gte: from } },
        ],
      }

      const leaves = await prisma.leaveApplication.findMany({
        where,
        include: {
          teacher: {
            include: { user: { select: { displayName: true, email: true } } },
          },
        },
        orderBy: { startDate: 'desc' },
      })

      const filtered = department
        ? leaves.filter(l => l.teacher.department?.toLowerCase().includes(department.toLowerCase()))
        : leaves

      const data = filtered.map(l => ({
        id: l.id,
        teacherName: l.teacher.user.displayName,
        staffId: l.teacher.staffId,
        position: l.teacher.designation || '—',
        department: l.teacher.department || '—',
        staffType: l.teacher.staffType,
        mcStartDate: l.startDate,
        mcEndDate: l.endDate,
        duration: l.daysRequested,
        status: l.status,
        documentUrl: l.documentUrl,
      }))

      res.json({ success: true, data, meta: { total: data.length, from, to } })
    } catch (error) {
      console.error('GET /reports/staff/mc error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-02: All Staff Leave Report ───────────────────────────────
router.get(
  '/staff/leave',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'hod'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { dateFrom, dateTo, leaveType, department } = req.query as Record<string, string>
      const now = new Date()
      const from = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1)
      const to = dateTo ? new Date(dateTo) : new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const where: any = {
        startDate: { lte: to },
        endDate: { gte: from },
      }
      if (leaveType) where.leaveType = leaveType

      const leaves = await prisma.leaveApplication.findMany({
        where,
        include: {
          teacher: {
            include: { user: { select: { displayName: true } } },
          },
        },
        orderBy: { startDate: 'desc' },
      })

      const filtered = department
        ? leaves.filter(l => l.teacher.department?.toLowerCase().includes(department.toLowerCase()))
        : leaves

      const data = filtered.map(l => ({
        id: l.id,
        teacherName: l.teacher.user.displayName,
        staffId: l.teacher.staffId,
        department: l.teacher.department || '—',
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        duration: l.daysRequested,
        status: l.status,
      }))

      // Aggregates by type
      const byType: Record<string, number> = {}
      for (const d of data) {
        byType[d.leaveType] = (byType[d.leaveType] || 0) + 1
      }

      res.json({ success: true, data, meta: { total: data.length, byType, from, to } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-03: Staff Demographics Summary ───────────────────────────
router.get(
  '/staff/demographics',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const schoolWhere = schoolFilter(req)

      const teachers = await prisma.teacher.findMany({
        where: { ...schoolWhere, status: 'active' },
        select: {
          staffType: true,
          qualification: true,
          dateOfBirth: true,
          department: true,
        },
      })

      const total = teachers.length

      // By staffType
      const byStaffType: Record<string, number> = {}
      // By qualification
      const byQualification: Record<string, number> = {}
      // By age group
      const ageGroups: Record<string, number> = { 'Under 30': 0, '30–39': 0, '40–49': 0, '50–59': 0, '60+': 0 }

      for (const t of teachers) {
        byStaffType[t.staffType] = (byStaffType[t.staffType] || 0) + 1
        const q = t.qualification || 'Not Specified'
        byQualification[q] = (byQualification[q] || 0) + 1
        if (t.dateOfBirth) {
          const age = Math.floor((Date.now() - t.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000))
          if (age < 30) ageGroups['Under 30']++
          else if (age < 40) ageGroups['30–39']++
          else if (age < 50) ageGroups['40–49']++
          else if (age < 60) ageGroups['50–59']++
          else ageGroups['60+']++
        }
      }

      res.json({
        success: true,
        data: { total, byStaffType, byQualification, ageGroups },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-04: Students Receiving Financial Aid ──────────────────────
router.get(
  '/students/financial-aid',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'finance'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { aidType, className } = req.query as Record<string, string>

      const where: any = { eligibilityStatus: 'active' }
      if (aidType) where.aidType = aidType

      const aids = await prisma.financialAid.findMany({
        where,
        include: {
          student: {
            include: { user: { select: { displayName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      const filtered = className
        ? aids.filter(a => a.student.className?.toLowerCase().includes(className.toLowerCase()))
        : aids

      const data = filtered.map(a => ({
        id: a.id,
        studentName: a.student.user.displayName,
        studentId: a.student.studentId,
        className: a.student.className || '—',
        gradeLevel: a.student.gradeLevel || '—',
        aidType: a.aidType,
        amount: a.amount,
        startDate: a.startDate,
        endDate: a.endDate,
        eligibilityStatus: a.eligibilityStatus,
        approvedDate: a.approvedDate,
        notes: a.notes,
      }))

      const totalAmount = data.reduce((s, d) => s + (d.amount || 0), 0)
      const byType: Record<string, number> = {}
      for (const d of data) byType[d.aidType] = (byType[d.aidType] || 0) + 1

      res.json({ success: true, data, meta: { total: data.length, totalAmount, byType } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-05: Students Living in Hostel ────────────────────────────
router.get(
  '/students/hostel',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { hostelName, className, semester } = req.query as Record<string, string>

      const where: any = { status: 'active' }
      if (hostelName) where.hostelName = { contains: hostelName }
      if (semester) where.semester = semester

      const records = await prisma.hostelRecord.findMany({
        where,
        include: {
          student: {
            include: { user: { select: { displayName: true } } },
          },
        },
        orderBy: [{ hostelName: 'asc' }, { roomNumber: 'asc' }],
      })

      const filtered = className
        ? records.filter(r => r.student.className?.toLowerCase().includes(className.toLowerCase()))
        : records

      const data = filtered.map(r => ({
        id: r.id,
        studentName: r.student.user.displayName,
        studentId: r.student.studentId,
        className: r.student.className || '—',
        hostelName: r.hostelName,
        roomNumber: r.roomNumber || '—',
        checkInDate: r.checkInDate,
        emergencyContact: r.emergencyContact || '—',
        semester: r.semester || '—',
      }))

      const byHostel: Record<string, number> = {}
      for (const d of data) byHostel[d.hostelName] = (byHostel[d.hostelName] || 0) + 1

      res.json({ success: true, data, meta: { total: data.length, byHostel } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-06: Students Using School Bus ────────────────────────────
router.get(
  '/students/bus',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { route, className } = req.query as Record<string, string>

      const where: any = { status: 'active' }
      if (route) where.busRoute = { contains: route }

      const records = await prisma.busRecord.findMany({
        where,
        include: {
          student: {
            include: { user: { select: { displayName: true } } },
          },
        },
        orderBy: [{ busRoute: 'asc' }, { createdAt: 'asc' }],
      })

      const filtered = className
        ? records.filter(r => r.student.className?.toLowerCase().includes(className.toLowerCase()))
        : records

      const data = filtered.map(r => ({
        id: r.id,
        studentName: r.student.user.displayName,
        studentId: r.student.studentId,
        className: r.student.className || '—',
        busRoute: r.busRoute,
        busNumber: r.busNumber || '—',
        provider: r.provider || '—',
        pickupPoint: r.pickupPoint || '—',
        dropoffPoint: r.dropoffPoint || '—',
        parentContact: '—',
      }))

      const byRoute: Record<string, number> = {}
      for (const d of data) byRoute[d.busRoute] = (byRoute[d.busRoute] || 0) + 1

      res.json({ success: true, data, meta: { total: data.length, byRoute } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-07: Student Demographics Summary ─────────────────────────
router.get(
  '/students/demographics',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const schoolWhere = schoolFilter(req)

      const students = await prisma.student.findMany({
        where: { ...schoolWhere, enrollmentStatus: 'enrolled' },
        select: {
          gender: true,
          nationality: true,
          gradeLevel: true,
          senRecord: { select: { id: true } },
        },
      })

      const total = students.length
      const byGender: Record<string, number> = {}
      const byNationality: Record<string, number> = {}
      const byGrade: Record<string, number> = {}
      let senCount = 0

      for (const s of students) {
        const g = s.gender || 'Not Specified'
        byGender[g] = (byGender[g] || 0) + 1
        const n = s.nationality || 'Not Specified'
        byNationality[n] = (byNationality[n] || 0) + 1
        const gr = s.gradeLevel || 'Not Specified'
        byGrade[gr] = (byGrade[gr] || 0) + 1
        if (s.senRecord) senCount++
      }

      res.json({
        success: true,
        data: { total, byGender, byNationality, byGrade, senCount },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-08: School Profile Summary ───────────────────────────────
router.get(
  '/school/profile-summary',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const schoolWhere = schoolFilter(req)
      const schools = await prisma.school.findMany({ where: schoolWhere as any })

      const summaries = await Promise.all(
        schools.map(async (school) => {
          const [studentCount, teachingCount, nonTeachingCount, facilityCount] = await Promise.all([
            prisma.student.count({ where: { schoolId: school.id, enrollmentStatus: 'enrolled' } }),
            prisma.teacher.count({ where: { schoolId: school.id, status: 'active', staffType: 'TEACHING' } }),
            prisma.teacher.count({ where: { schoolId: school.id, status: 'active', staffType: { not: 'TEACHING' } } }),
            prisma.facility.count(),
          ])
          return {
            id: school.id,
            name: school.name,
            code: school.code,
            schoolType: school.schoolType,
            authority: school.authority,
            address: school.address || '—',
            principal: school.principal || '—',
            phone: school.phone || '—',
            totalStudents: studentCount,
            totalTeachingStaff: teachingCount,
            totalNonTeachingStaff: nonTeachingCount,
            totalFacilities: facilityCount,
            establishedYear: school.establishedYear,
            motto: school.motto,
          }
        }),
      )

      res.json({ success: true, data: summaries })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-09: Attendance Summary Report ────────────────────────────
router.get(
  '/school/attendance-summary',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'hod'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { month, year } = req.query as Record<string, string>
      const y = parseInt(year || String(new Date().getFullYear()))
      const m = parseInt(month || String(new Date().getMonth() + 1)) - 1
      const from = new Date(y, m, 1)
      const to = new Date(y, m + 1, 0, 23, 59, 59)

      // Student attendance
      const studentRecords = await prisma.attendanceRecord.findMany({
        where: { session: { date: { gte: from, lte: to } } },
        select: { status: true },
      })
      const studentTotal = studentRecords.length
      const studentPresent = studentRecords.filter(r => r.status === 'present').length
      const studentLate = studentRecords.filter(r => r.status === 'late').length
      const studentAbsent = studentRecords.filter(r => r.status === 'absent').length

      // Staff attendance
      const staffRecords = await prisma.staffAttendanceRecord.findMany({
        where: { date: { gte: from, lte: to } },
        include: { teacher: { select: { department: true } } },
      })
      const staffTotal = staffRecords.length
      const staffPresent = staffRecords.filter(r => r.status === 'PRESENT').length
      const staffLate = staffRecords.filter(r => r.status === 'LATE').length
      const staffAbsent = staffRecords.filter(r => r.status === 'ABSENT').length

      // Staff by department
      const staffByDept: Record<string, { present: number; late: number; absent: number }> = {}
      for (const r of staffRecords) {
        const dept = r.teacher.department || 'General'
        if (!staffByDept[dept]) staffByDept[dept] = { present: 0, late: 0, absent: 0 }
        if (r.status === 'PRESENT') staffByDept[dept].present++
        else if (r.status === 'LATE') staffByDept[dept].late++
        else staffByDept[dept].absent++
      }

      res.json({
        success: true,
        data: {
          period: { month: m + 1, year: y, from, to },
          students: {
            total: studentTotal,
            present: studentPresent,
            late: studentLate,
            absent: studentAbsent,
            rate: studentTotal > 0 ? Math.round((studentPresent / studentTotal) * 100) : 0,
          },
          staff: {
            total: staffTotal,
            present: staffPresent,
            late: staffLate,
            absent: staffAbsent,
            rate: staffTotal > 0 ? Math.round((staffPresent / staffTotal) * 100) : 0,
            byDepartment: staffByDept,
          },
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-10: Facility Utilization Report ──────────────────────────
router.get(
  '/school/facility-utilization',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { type } = req.query as Record<string, string>

      const where: any = {}
      if (type) where.type = type

      const facilities = await prisma.facility.findMany({
        where,
        include: {
          bookings: {
            where: { status: 'approved', date: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
          },
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      })

      const data = facilities.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        capacity: f.capacity || 0,
        location: f.location || '—',
        status: f.status,
        bookingsLast30d: f.bookings.length,
        utilizationPct: f.capacity && f.bookings.length > 0
          ? Math.min(Math.round((f.bookings.length / 20) * 100), 100)
          : 0,
      }))

      const byType: Record<string, number> = {}
      for (const d of data) byType[d.type] = (byType[d.type] || 0) + 1

      res.json({ success: true, data, meta: { total: data.length, byType } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── RP-11: Admin Dashboard Widgets ──────────────────────────────
router.get(
  '/dashboard/admin-widgets',
  authenticate,
  requireRole('admin', 'manager', 'principal', 'hod', 'finance', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)

      const [
        staffOnLeaveToday,
        pendingAdmissions,
        overdueLibraryLoans,
        lowStockAssets,
        upcomingExams,
        staffAttendanceToday,
      ] = await Promise.all([
        // Staff on leave today
        prisma.leaveApplication.count({
          where: {
            status: { in: ['PRINCIPAL_APPROVED', 'HOD_APPROVED'] },
            startDate: { lte: today },
            endDate: { gte: today },
          },
        }),
        // Pending admissions
        prisma.admission.count({ where: { status: { in: ['submitted', 'under_review', 'documents_required'] } } }),
        // Overdue library loans (not returned + past due)
        prisma.libraryLoan.count({ where: { returnedAt: null, dueDate: { lt: today } } }),
        // Assets in poor/condemned condition (proxy for low-stock alert)
        prisma.asset.count({ where: { condition: { in: ['Poor', 'Condemned'] } } }),
        // Upcoming exams in next 30 days
        prisma.exam.count({ where: { status: 'upcoming', examDate: { gte: today, lte: new Date(Date.now() + 30 * 24 * 3600 * 1000) } } }),
        // Staff attendance today
        prisma.staffAttendanceRecord.groupBy({
          by: ['status'],
          where: { date: { gte: today, lte: todayEnd } },
          _count: { id: true },
        }),
      ])

      const attendanceMap: Record<string, number> = {}
      for (const g of staffAttendanceToday) attendanceMap[g.status] = g._count.id

      res.json({
        success: true,
        data: {
          staffOnLeaveToday,
          pendingAdmissions,
          overdueLibraryLoans,
          lowStockAlerts: lowStockAssets,
          upcomingExams,
          staffAttendance: {
            present: attendanceMap['PRESENT'] ?? 0,
            late: attendanceMap['LATE'] ?? 0,
            absent: attendanceMap['ABSENT'] ?? 0,
          },
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// ─── CRUD for FinancialAid (admin) ───────────────────────────────
router.get('/students/financial-aid-list', authenticate, requireRole('admin', 'manager', 'principal', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await prisma.financialAid.findMany({ include: { student: { include: { user: { select: { displayName: true } } } } }, orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data })
  } catch { res.status(500).json({ success: false, message: 'Internal server error' }) }
})

router.post('/students/financial-aid', authenticate, requireRole('admin', 'manager', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, aidType, amount, startDate, endDate, notes, approvedDate } = req.body
    if (!studentId || !aidType) { res.status(400).json({ success: false, message: 'studentId and aidType required' }); return }
    const record = await prisma.financialAid.create({
      data: { studentId, aidType, amount: amount ? Number(amount) : null, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, notes, approvedDate: approvedDate ? new Date(approvedDate) : null, eligibilityStatus: 'active' },
    })
    res.status(201).json({ success: true, data: record })
  } catch { res.status(500).json({ success: false, message: 'Internal server error' }) }
})

router.delete('/students/financial-aid/:id', authenticate, requireRole('admin', 'manager', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.financialAid.delete({ where: { id: req.params.id as string } })
    res.json({ success: true })
  } catch { res.status(500).json({ success: false, message: 'Internal server error' }) }
})

// ─── CRUD for HostelRecord ────────────────────────────────────────
router.post('/students/hostel', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, hostelName, roomNumber, checkInDate, emergencyContact, semester } = req.body
    if (!studentId || !hostelName) { res.status(400).json({ success: false, message: 'studentId and hostelName required' }); return }
    const record = await prisma.hostelRecord.upsert({
      where: { studentId },
      update: { hostelName, roomNumber, checkInDate: checkInDate ? new Date(checkInDate) : null, emergencyContact, semester, status: 'active' },
      create: { studentId, hostelName, roomNumber, checkInDate: checkInDate ? new Date(checkInDate) : null, emergencyContact, semester },
    })
    res.status(201).json({ success: true, data: record })
  } catch { res.status(500).json({ success: false, message: 'Internal server error' }) }
})

// ─── CRUD for BusRecord ───────────────────────────────────────────
router.post('/students/bus', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, busRoute, busNumber, provider, pickupPoint, dropoffPoint, semester } = req.body
    if (!studentId || !busRoute) { res.status(400).json({ success: false, message: 'studentId and busRoute required' }); return }
    const record = await prisma.busRecord.upsert({
      where: { studentId },
      update: { busRoute, busNumber, provider, pickupPoint, dropoffPoint, semester, status: 'active' },
      create: { studentId, busRoute, busNumber, provider, pickupPoint, dropoffPoint, semester },
    })
    res.status(201).json({ success: true, data: record })
  } catch { res.status(500).json({ success: false, message: 'Internal server error' }) }
})

export default router
