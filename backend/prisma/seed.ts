import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding MOE SERPS database...')

  const hash = (pw: string) => bcrypt.hashSync(pw, 10)
  const pwd = hash('Demo@2026')

  // ─── Users ────────────────────────────────────────────────────

  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      password: pwd,
      displayName: 'System Admin',
      email: 'admin@moe.edu.bn',
      role: 'admin',
    },
  })

  const managerUser = await prisma.user.create({
    data: {
      username: 'manager',
      password: pwd,
      displayName: 'Hj Kamaruddin',
      email: 'kamaruddin@moe.edu.bn',
      role: 'manager',
    },
  })

  const financeUser = await prisma.user.create({
    data: {
      username: 'finance',
      password: pwd,
      displayName: 'Finance Officer',
      email: 'finance@moe.edu.bn',
      role: 'finance',
    },
  })

  const admissionsUser = await prisma.user.create({
    data: {
      username: 'admissions',
      password: pwd,
      displayName: 'Admissions Officer',
      email: 'admissions@moe.edu.bn',
      role: 'admissions',
    },
  })

  // Teachers
  const drsitiUser = await prisma.user.create({
    data: {
      username: 'drsiti',
      password: pwd,
      displayName: 'Dr. Siti Nurhaliza',
      email: 'siti@moe.edu.bn',
      role: 'teacher',
    },
  })

  const faizalUser = await prisma.user.create({
    data: {
      username: 'faizal',
      password: pwd,
      displayName: 'Mohd Faizal Bin Aziz',
      email: 'faizal@moe.edu.bn',
      role: 'teacher',
    },
  })

  // Students
  const adamUser = await prisma.user.create({
    data: {
      username: 'adam',
      password: pwd,
      displayName: 'Adam Bin Haris',
      email: 'adam@student.moe.edu.bn',
      role: 'student',
    },
  })

  const nurulUser = await prisma.user.create({
    data: {
      username: 'nurul',
      password: pwd,
      displayName: 'Nurul Binti Rahman',
      email: 'nurul@student.moe.edu.bn',
      role: 'student',
    },
  })

  // Parent
  const fatimahUser = await prisma.user.create({
    data: {
      username: 'fatimah',
      password: pwd,
      displayName: 'Fatimah Binti Yusof',
      email: 'fatimah@parent.moe.edu.bn',
      role: 'parent',
    },
  })

  // ─── Teachers ─────────────────────────────────────────────────

  const drsiti = await prisma.teacher.create({
    data: {
      userId: drsitiUser.id,
      staffId: 'T2026001',
      designation: 'Senior Teacher',
      department: 'Science & Mathematics',
      qualification: 'PhD in Education',
      subjects: 'Mathematics,Physics',
      joinDate: new Date('2020-01-15'),
    },
  })

  const faizal = await prisma.teacher.create({
    data: {
      userId: faizalUser.id,
      staffId: 'T2026002',
      designation: 'Teacher',
      department: 'Languages',
      qualification: 'Masters in English Literature',
      subjects: 'English,Bahasa Melayu',
      joinDate: new Date('2021-06-01'),
    },
  })

  // ─── Students ─────────────────────────────────────────────────

  const adam = await prisma.student.create({
    data: {
      userId: adamUser.id,
      studentId: '2026001',
      dateOfBirth: new Date('2012-03-15'),
      gender: 'Male',
      nationality: 'Bruneian',
      gradeLevel: 'Year 7',
      className: '7A',
      enrollmentStatus: 'enrolled',
    },
  })

  const nurul = await prisma.student.create({
    data: {
      userId: nurulUser.id,
      studentId: '2026002',
      dateOfBirth: new Date('2012-07-22'),
      gender: 'Female',
      nationality: 'Bruneian',
      gradeLevel: 'Year 7',
      className: '7A',
      enrollmentStatus: 'enrolled',
    },
  })

  // ─── Parent ───────────────────────────────────────────────────

  const fatimah = await prisma.parent.create({
    data: {
      userId: fatimahUser.id,
      phone: '+673-8123456',
      occupation: 'Government Officer',
      relationship: 'mother',
    },
  })

  // Link parent to student
  await prisma.parentStudent.create({
    data: { parentId: fatimah.id, studentId: adam.id },
  })

  // ─── School ───────────────────────────────────────────────────

  await prisma.school.create({
    data: {
      name: 'Sekolah Menengah Hj Kamaruddin',
      code: 'SMHK',
      type: 'secondary',
      address: 'Jalan Kota Batu, Bandar Seri Begawan, Brunei',
      phone: '+673-2234567',
      principal: 'Hj Kamaruddin',
    },
  })

  // ─── Courses ──────────────────────────────────────────────────

  const mathCourse = await prisma.course.create({
    data: {
      code: 'MATH701',
      name: 'Mathematics Year 7',
      description: 'Foundation mathematics covering algebra, geometry, and statistics',
      gradeLevel: 'Year 7',
      creditHours: 4,
    },
  })

  const engCourse = await prisma.course.create({
    data: {
      code: 'ENG701',
      name: 'English Language Year 7',
      description: 'English reading, writing, grammar and communication skills',
      gradeLevel: 'Year 7',
      creditHours: 4,
    },
  })

  const sciCourse = await prisma.course.create({
    data: {
      code: 'SCI701',
      name: 'Science Year 7',
      description: 'Integrated science covering biology, chemistry and physics fundamentals',
      gradeLevel: 'Year 7',
      creditHours: 3,
    },
  })

  const mibCourse = await prisma.course.create({
    data: {
      code: 'MIB701',
      name: 'Melayu Islam Beraja Year 7',
      description: 'National philosophy education covering Malay, Islamic and Monarchy values',
      gradeLevel: 'Year 7',
      creditHours: 2,
    },
  })

  const icCourse = await prisma.course.create({
    data: {
      code: 'ICT701',
      name: 'ICT Year 7',
      description: 'Information and communication technology fundamentals',
      gradeLevel: 'Year 7',
      creditHours: 2,
    },
  })

  // ─── Course Assignments (teacher -> course) ───────────────────

  await prisma.courseAssignment.createMany({
    data: [
      { courseId: mathCourse.id, teacherId: drsiti.id, semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30' },
      { courseId: sciCourse.id, teacherId: drsiti.id, semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30' },
      { courseId: engCourse.id, teacherId: faizal.id, semester: '2026-S1', schedule: 'Mon/Wed 10:00-11:30' },
      { courseId: mibCourse.id, teacherId: faizal.id, semester: '2026-S1', schedule: 'Fri 08:00-10:00' },
      { courseId: icCourse.id, teacherId: drsiti.id, semester: '2026-S1', schedule: 'Fri 10:00-12:00' },
    ],
  })

  // ─── Enrollments ──────────────────────────────────────────────

  const courses = [mathCourse, engCourse, sciCourse, mibCourse, icCourse]
  for (const course of courses) {
    await prisma.enrollment.createMany({
      data: [
        { studentId: adam.id, courseId: course.id, semester: '2026-S1' },
        { studentId: nurul.id, courseId: course.id, semester: '2026-S1' },
      ],
    })
  }

  // ─── Grade Items ──────────────────────────────────────────────

  for (const course of courses) {
    await prisma.gradeItem.createMany({
      data: [
        { courseId: course.id, name: 'Quiz 1', type: 'quiz', maxScore: 20, weight: 0.1 },
        { courseId: course.id, name: 'Midterm Exam', type: 'exam', maxScore: 100, weight: 0.3 },
        { courseId: course.id, name: 'Assignment 1', type: 'assignment', maxScore: 50, weight: 0.2 },
        { courseId: course.id, name: 'Final Exam', type: 'exam', maxScore: 100, weight: 0.4 },
      ],
    })
  }

  // ─── Certifications ───────────────────────────────────────────

  await prisma.certification.createMany({
    data: [
      {
        teacherId: drsiti.id,
        name: 'Teaching License - Mathematics',
        issuedBy: 'Ministry of Education Brunei',
        issuedDate: new Date('2019-06-15'),
        expiryDate: new Date('2027-06-15'),
        status: 'active',
      },
      {
        teacherId: drsiti.id,
        name: 'Cambridge International Teaching Certificate',
        issuedBy: 'Cambridge Assessment',
        issuedDate: new Date('2020-03-01'),
        expiryDate: new Date('2026-03-01'),
        status: 'active',
      },
      {
        teacherId: faizal.id,
        name: 'Teaching License - English',
        issuedBy: 'Ministry of Education Brunei',
        issuedDate: new Date('2021-01-10'),
        expiryDate: new Date('2028-01-10'),
        status: 'active',
      },
    ],
  })

  // ─── Facilities ───────────────────────────────────────────────

  await prisma.facility.createMany({
    data: [
      { name: 'Hall A', type: 'hall', capacity: 300, location: 'Block A', status: 'available' },
      { name: 'Science Lab 1', type: 'lab', capacity: 40, location: 'Block B', status: 'available' },
      { name: 'Computer Lab', type: 'lab', capacity: 35, location: 'Block C', status: 'available' },
      { name: 'Classroom 7A', type: 'classroom', capacity: 40, location: 'Block A, Level 2', status: 'occupied' },
      { name: 'Classroom 7B', type: 'classroom', capacity: 40, location: 'Block A, Level 2', status: 'available' },
      { name: 'Sports Field', type: 'sports', capacity: 200, location: 'Outdoor', status: 'available' },
      { name: 'Library', type: 'classroom', capacity: 80, location: 'Block D', status: 'available' },
    ],
  })

  // ─── Sample Admissions ────────────────────────────────────────

  await prisma.admission.createMany({
    data: [
      {
        applicantName: 'Aiman Bin Yusuf',
        dateOfBirth: new Date('2013-05-10'),
        gender: 'Male',
        nationality: 'Bruneian',
        parentName: 'Yusuf Bin Ahmad',
        parentPhone: '+673-8234567',
        parentEmail: 'yusuf@email.com',
        gradeApplied: 'Year 7',
        previousSchool: 'Sekolah Rendah Kota Batu',
        status: 'pending',
      },
      {
        applicantName: 'Aisyah Binti Hamid',
        dateOfBirth: new Date('2013-08-22'),
        gender: 'Female',
        nationality: 'Bruneian',
        parentName: 'Hamid Bin Ismail',
        parentPhone: '+673-8345678',
        parentEmail: 'hamid@email.com',
        gradeApplied: 'Year 7',
        previousSchool: 'Sekolah Rendah Berakas',
        status: 'under_review',
      },
      {
        applicantName: 'Muhammad Haziq Bin Rosli',
        dateOfBirth: new Date('2013-02-14'),
        gender: 'Male',
        nationality: 'Bruneian',
        parentName: 'Rosli Bin Hj Omar',
        parentPhone: '+673-8456789',
        parentEmail: 'rosli@email.com',
        gradeApplied: 'Year 7',
        previousSchool: 'Sekolah Rendah Rimba',
        status: 'accepted',
        decidedAt: new Date('2026-04-15'),
        remarks: 'Excellent academic record',
      },
      {
        applicantName: 'Siti Aminah Binti Latif',
        dateOfBirth: new Date('2013-11-03'),
        gender: 'Female',
        nationality: 'Bruneian',
        parentName: 'Latif Bin Awang',
        parentPhone: '+673-8567890',
        parentEmail: 'latif@email.com',
        gradeApplied: 'Year 7',
        previousSchool: 'Sekolah Rendah Gadong',
        status: 'rejected',
        decidedAt: new Date('2026-04-20'),
        remarks: 'Insufficient documentation',
      },
    ],
  })

  // ─── Grades ───────────────────────────────────────────────────

  const allGradeItems = await prisma.gradeItem.findMany({ orderBy: { courseId: 'asc' } })
  const gradeScores: Record<string, [number, number]> = {
    // [adam score, nurul score] per grade item type
    'Quiz 1': [17, 19],
    'Midterm Exam': [78, 92],
    'Assignment 1': [42, 47],
    'Final Exam': [82, 88],
  }

  for (const gi of allGradeItems) {
    const scores = gradeScores[gi.name] ?? [75, 80]
    const adamScore = scores[0] + Math.floor(Math.random() * 5 - 2)
    const nurulScore = scores[1] + Math.floor(Math.random() * 5 - 2)

    const letterGrade = (score: number, max: number) => {
      const pct = (score / max) * 100
      if (pct >= 90) return 'A'
      if (pct >= 80) return 'B'
      if (pct >= 70) return 'C'
      if (pct >= 60) return 'D'
      return 'F'
    }

    await prisma.grade.createMany({
      data: [
        {
          studentId: adam.id,
          gradeItemId: gi.id,
          score: Math.min(adamScore, gi.maxScore),
          letterGrade: letterGrade(adamScore, gi.maxScore),
          gradedAt: new Date('2026-04-30'),
        },
        {
          studentId: nurul.id,
          gradeItemId: gi.id,
          score: Math.min(nurulScore, gi.maxScore),
          letterGrade: letterGrade(nurulScore, gi.maxScore),
          gradedAt: new Date('2026-04-30'),
        },
      ],
    })
  }

  // ─── Attendance Sessions & Records ────────────────────────────

  const sessionDates = [
    new Date('2026-05-12'),
    new Date('2026-05-14'),
    new Date('2026-05-19'),
    new Date('2026-05-21'),
  ]
  const attendanceStatuses = ['present', 'present', 'present', 'late', 'present', 'absent', 'present', 'present']
  let statusIdx = 0

  for (const course of courses.slice(0, 3)) {
    for (const date of sessionDates.slice(0, 2)) {
      const session = await prisma.attendanceSession.create({
        data: {
          courseId: course.id,
          date,
          topic: `${course.name} - Week ${date.getDate() < 15 ? 1 : 2}`,
          status: 'completed',
        },
      })
      for (const student of [adam, nurul]) {
        const st = attendanceStatuses[statusIdx % attendanceStatuses.length]
        await prisma.attendanceRecord.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
            status: st,
            checkedInAt: st !== 'absent' ? new Date(`${date.toISOString().slice(0, 10)}T08:05:00`) : null,
          },
        })
        statusIdx++
      }
    }
  }

  // Active session for today (for demo)
  const todaySession = await prisma.attendanceSession.create({
    data: {
      courseId: mathCourse.id,
      date: new Date(),
      topic: 'Algebra Review',
      status: 'active',
    },
  })
  await prisma.attendanceRecord.createMany({
    data: [
      { sessionId: todaySession.id, studentId: adam.id, status: 'present', checkedInAt: new Date() },
      { sessionId: todaySession.id, studentId: nurul.id, status: 'present', checkedInAt: new Date() },
    ],
  })

  // ─── Fee Invoices ─────────────────────────────────────────────

  await prisma.feeInvoice.createMany({
    data: [
      {
        studentId: adam.id,
        semester: '2026-S1',
        amount: 350.0,
        status: 'paid',
        dueDate: new Date('2026-02-28'),
        paidAt: new Date('2026-02-20'),
        description: 'Tuition Fee - Semester 1',
      },
      {
        studentId: adam.id,
        semester: '2026-S1',
        amount: 50.0,
        status: 'paid',
        dueDate: new Date('2026-02-28'),
        paidAt: new Date('2026-02-20'),
        description: 'Science Lab Fee',
      },
      {
        studentId: nurul.id,
        semester: '2026-S1',
        amount: 350.0,
        status: 'unpaid',
        dueDate: new Date('2026-06-30'),
        description: 'Tuition Fee - Semester 1',
      },
      {
        studentId: nurul.id,
        semester: '2026-S1',
        amount: 50.0,
        status: 'overdue',
        dueDate: new Date('2026-03-31'),
        description: 'Science Lab Fee',
      },
    ],
  })

  // ─── School Expenses ──────────────────────────────────────────

  await prisma.schoolExpense.createMany({
    data: [
      { category: 'supplies', description: 'Science lab equipment restocking', amount: 2500.0, date: new Date('2026-03-10'), approvedBy: 'Hj Kamaruddin', status: 'approved' },
      { category: 'maintenance', description: 'Classroom 7A air conditioning repair', amount: 800.0, date: new Date('2026-04-05'), approvedBy: 'Hj Kamaruddin', status: 'approved' },
      { category: 'utilities', description: 'Electricity bill - April 2026', amount: 3200.0, date: new Date('2026-04-30'), approvedBy: 'Hj Kamaruddin', status: 'approved' },
      { category: 'supplies', description: 'Sports equipment for field day', amount: 1500.0, date: new Date('2026-05-01'), status: 'pending' },
      { category: 'maintenance', description: 'Library shelving replacement', amount: 1200.0, date: new Date('2026-05-10'), status: 'pending' },
      { category: 'utilities', description: 'Internet service upgrade', amount: 450.0, date: new Date('2026-05-15'), approvedBy: 'Hj Kamaruddin', status: 'approved' },
    ],
  })

  // ─── Notifications ────────────────────────────────────────────

  await prisma.notification.createMany({
    data: [
      { userId: adamUser.id, title: 'Grade Published', message: 'Your Mathematics Quiz 1 grade has been published.', type: 'success' },
      { userId: adamUser.id, title: 'Fee Due Reminder', message: 'Your Science Lab Fee is due by March 31.', type: 'warning' },
      { userId: drsitiUser.id, title: 'Certification Expiring', message: 'Your Cambridge International Teaching Certificate expires on March 1, 2026.', type: 'warning' },
      { userId: fatimahUser.id, title: 'Attendance Alert', message: 'Adam was marked absent for English Language on May 14.', type: 'error' },
      { userId: adminUser.id, title: 'New Admission', message: '2 new admission applications require review.', type: 'info' },
    ],
  })

  console.log('Seed completed successfully!')
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
