import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function hash(pw: string) {
  return bcrypt.hashSync(pw, 10)
}

// Date helpers
function weeksAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n * 7)
  d.setHours(8, 0, 0, 0)
  return d
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(8, 0, 0, 0)
  return d
}

async function main() {
  console.log('Seeding MOE SERPS database...')

  // ─── Users ─────────────────────────────────────────────────────────────

  // Admin
  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      password: hash('admin123'),
      displayName: 'System Admin',
      email: 'admin@moe.edu.bn',
      role: 'admin',
    },
  })

  // Principal
  const principalUser = await prisma.user.create({
    data: {
      username: 'principal',
      password: hash('principal123'),
      displayName: 'Hjh Rashidah Binti Mohamad',
      email: 'principal@moe.edu.bn',
      role: 'principal',
    },
  })

  // HOD
  const hodUser = await prisma.user.create({
    data: {
      username: 'hod01',
      password: hash('hod123'),
      displayName: 'Dr. Azman Bin Ishak',
      email: 'azman@moe.edu.bn',
      role: 'hod',
    },
  })

  // Manager (retained, Demo@2026)
  const managerUser = await prisma.user.create({
    data: {
      username: 'manager',
      password: hash('Demo@2026'),
      displayName: 'Hj Kamaruddin',
      email: 'kamaruddin@moe.edu.bn',
      role: 'manager',
    },
  })

  // Finance (new: finance123)
  const financeUser = await prisma.user.create({
    data: {
      username: 'finance',
      password: hash('finance123'),
      displayName: 'Finance Officer',
      email: 'finance@moe.edu.bn',
      role: 'finance',
    },
  })

  // Admissions (new username: admission, admission123)
  const admissionUser = await prisma.user.create({
    data: {
      username: 'admission',
      password: hash('admission123'),
      displayName: 'Admission Officer',
      email: 'admission@moe.edu.bn',
      role: 'admissions',
    },
  })

  // Legacy admissions user retained
  const admissionsUser = await prisma.user.create({
    data: {
      username: 'admissions',
      password: hash('Demo@2026'),
      displayName: 'Admissions Officer',
      email: 'admissions@moe.edu.bn',
      role: 'admissions',
    },
  })

  // ─── Teachers ──────────────────────────────────────────────────────────

  // drsiti (retained, Demo@2026)
  const drsitiUser = await prisma.user.create({
    data: {
      username: 'drsiti',
      password: hash('Demo@2026'),
      displayName: 'Dr. Siti Nurhaliza',
      email: 'siti@moe.edu.bn',
      role: 'teacher',
    },
  })

  // faizal (retained, Demo@2026)
  const faizalUser = await prisma.user.create({
    data: {
      username: 'faizal',
      password: hash('Demo@2026'),
      displayName: 'Mohd Faizal Bin Aziz',
      email: 'faizal@moe.edu.bn',
      role: 'teacher',
    },
  })

  // teacher01 (new demo teacher)
  const teacher01User = await prisma.user.create({
    data: {
      username: 'teacher01',
      password: hash('teacher123'),
      displayName: 'Ms. Aminah Binti Hassan',
      email: 'aminah@moe.edu.bn',
      role: 'teacher',
    },
  })

  // ─── Students ──────────────────────────────────────────────────────────

  // student001 = Ahmad (demo story protagonist)
  const student001User = await prisma.user.create({
    data: {
      username: 'student001',
      password: hash('student123'),
      displayName: 'Ahmad Bin Abdullah',
      email: 'ahmad@student.moe.edu.bn',
      role: 'student',
    },
  })

  // adam (retained, Demo@2026)
  const adamUser = await prisma.user.create({
    data: {
      username: 'adam',
      password: hash('Demo@2026'),
      displayName: 'Adam Bin Haris',
      email: 'adam@student.moe.edu.bn',
      role: 'student',
    },
  })

  // nurul (retained, Demo@2026)
  const nurulUser = await prisma.user.create({
    data: {
      username: 'nurul',
      password: hash('Demo@2026'),
      displayName: 'Nurul Binti Rahman',
      email: 'nurul@student.moe.edu.bn',
      role: 'student',
    },
  })

  // ─── Parents ───────────────────────────────────────────────────────────

  // parent01 = Ahmad's father
  const parent01User = await prisma.user.create({
    data: {
      username: 'parent01',
      password: hash('parent123'),
      displayName: 'Hj Abdullah Bin Mahmud',
      email: 'abdullah@email.com',
      role: 'parent',
    },
  })

  // fatimah (retained, Demo@2026)
  const fatimahUser = await prisma.user.create({
    data: {
      username: 'fatimah',
      password: hash('Demo@2026'),
      displayName: 'Fatimah Binti Yusof',
      email: 'fatimah@parent.moe.edu.bn',
      role: 'parent',
    },
  })

  // ─── Extra Year 7-11 Students (for dashboard bar chart) ────────────────
  // Year 7 extra 4 (student001=Ahmad already counts as Year 7 student)
  const y7extra = [
    { username: 'nurulain', displayName: 'Nurul Ain Binti Hafiz', className: '7A' },
    { username: 'haziq2', displayName: 'Haziq Bin Roslan', className: '7A' },
    { username: 'syahirah', displayName: 'Syahirah Binti Daud', className: '7B' },
    { username: 'arif', displayName: 'Arif Bin Salleh', className: '7B' },
  ]

  const y8students = [
    { username: 'farah', displayName: 'Farah Binti Zainal' },
    { username: 'danial', displayName: 'Danial Bin Yusof' },
    { username: 'izzah', displayName: 'Izzah Binti Hamdi' },
    { username: 'zarif', displayName: 'Zarif Bin Lokman' },
    { username: 'hana', displayName: 'Hana Binti Sulaiman' },
  ]

  const y9students = [
    { username: 'aqilah', displayName: 'Aqilah Binti Rashid' },
    { username: 'naqib', displayName: 'Naqib Bin Latif' },
    { username: 'sarina', displayName: 'Sarina Binti Wahid' },
    { username: 'hafiz2', displayName: 'Hafiz Bin Noor' },
    { username: 'zara', displayName: 'Zara Binti Idris' },
  ]

  const y10students = [
    { username: 'amirah', displayName: 'Amirah Binti Tajudin' },
    { username: 'syafiq', displayName: 'Syafiq Bin Zainol' },
    { username: 'liyana', displayName: 'Liyana Binti Kasim' },
    { username: 'azfar', displayName: 'Azfar Bin Omar' },
    { username: 'faizah', displayName: 'Faizah Binti Ghani' },
  ]

  const y11students = [
    { username: 'husna', displayName: 'Husna Binti Ramli' },
    { username: 'irfan', displayName: 'Irfan Bin Hashim' },
    { username: 'dalila', displayName: 'Dalila Binti Said' },
    { username: 'imran', displayName: 'Imran Bin Mamat' },
    { username: 'roslina', displayName: 'Roslina Binti Jaafar' },
  ]

  // Create Year 7 extra students
  const y7extraStudentIds: string[] = []
  for (const s of y7extra) {
    const u = await prisma.user.create({
      data: { username: s.username, password: hash('Demo@2026'), displayName: s.displayName, role: 'student' },
    })
    const st = await prisma.student.create({
      data: {
        userId: u.id,
        studentId: `STU2026Y7${s.username.toUpperCase()}`,
        gradeLevel: 'Year 7',
        className: s.className,
        enrollmentStatus: 'enrolled',
      },
    })
    y7extraStudentIds.push(st.id)
  }

  // Create Year 8-11 students
  const allExtraGroups = [
    { year: 'Year 8', className: '8A', list: y8students },
    { year: 'Year 9', className: '9A', list: y9students },
    { year: 'Year 10', className: '10A', list: y10students },
    { year: 'Year 11', className: '11A', list: y11students },
  ]
  const extraStudentIdsByYear: Record<string, string[]> = {}
  for (const group of allExtraGroups) {
    const ids: string[] = []
    for (const s of group.list) {
      const u = await prisma.user.create({
        data: { username: s.username, password: hash('Demo@2026'), displayName: s.displayName, role: 'student' },
      })
      const st = await prisma.student.create({
        data: {
          userId: u.id,
          studentId: `STU2026${group.year.replace(' ', '')}${s.username.toUpperCase()}`,
          gradeLevel: group.year,
          className: group.className,
          enrollmentStatus: 'enrolled',
        },
      })
      ids.push(st.id)
    }
    extraStudentIdsByYear[group.year] = ids
  }

  // ─── Teacher records ───────────────────────────────────────────────────

  const drsiti = await prisma.teacher.create({
    data: {
      userId: drsitiUser.id,
      staffId: 'T2026001',
      designation: 'Senior Teacher',
      department: 'Science & Mathematics',
      qualification: 'PhD in Education',
      subjects: 'Mathematics,Physics',
      joinDate: new Date('2020-01-15'),
      cpdHours: 25,
      cpdTarget: 20,
      employmentStatus: 'active',
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
      cpdHours: 12,
      cpdTarget: 20,
      employmentStatus: 'onLeave',
    },
  })

  const teacher01 = await prisma.teacher.create({
    data: {
      userId: teacher01User.id,
      staffId: 'T2026003',
      designation: 'Teacher',
      department: 'Science & Mathematics',
      qualification: 'BSc Mathematics, Universiti Brunei Darussalam',
      subjects: 'Mathematics,Science',
      joinDate: new Date('2018-08-01'),
      cpdHours: 18,
      cpdTarget: 20,
      employmentStatus: 'active',
    },
  })

  // ─── Student records ───────────────────────────────────────────────────

  // Ahmad (student001) - demo story protagonist
  const ahmad = await prisma.student.create({
    data: {
      userId: student001User.id,
      studentId: 'STU2026001',
      dateOfBirth: new Date('2010-03-12'),
      gender: 'Male',
      nationality: 'Bruneian',
      icNumber: 'BN20100312',
      gradeLevel: 'Year 7',
      className: '7A',
      enrollmentStatus: 'enrolled',
    },
  })

  // adam (retained)
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

  // nurul (retained)
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

  // ─── Parent records ────────────────────────────────────────────────────

  const parent01 = await prisma.parent.create({
    data: {
      userId: parent01User.id,
      phone: '+673-8123456',
      occupation: 'Government Servant',
      relationship: 'father',
    },
  })

  // Link parent01 to Ahmad
  await prisma.parentStudent.create({
    data: { parentId: parent01.id, studentId: ahmad.id },
  })

  const fatimah = await prisma.parent.create({
    data: {
      userId: fatimahUser.id,
      phone: '+673-8123456',
      occupation: 'Government Officer',
      relationship: 'mother',
    },
  })

  // Link fatimah to adam
  await prisma.parentStudent.create({
    data: { parentId: fatimah.id, studentId: adam.id },
  })

  // ─── School ────────────────────────────────────────────────────────────

  await prisma.school.create({
    data: {
      name: 'Sekolah Menengah Hj Kamaruddin',
      code: 'SMHK',
      type: 'secondary',
      address: 'Jalan Kota Batu, Bandar Seri Begawan, Brunei',
      phone: '+673-2234567',
      principal: 'Hjh Rashidah Binti Mohamad',
    },
  })

  // ─── Courses ───────────────────────────────────────────────────────────

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

  const courses = [mathCourse, engCourse, sciCourse, mibCourse, icCourse]

  // ─── Course Assignments ────────────────────────────────────────────────
  // drsiti teaches 7B Math and Science; teacher01 teaches 7A Math and Science
  // faizal teaches English and MIB; drsiti also teaches ICT

  await prisma.courseAssignment.createMany({
    data: [
      // drsiti - 7B
      { courseId: mathCourse.id, teacherId: drsiti.id, semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30 (7B)' },
      { courseId: sciCourse.id, teacherId: drsiti.id, semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30 (7B)' },
      { courseId: icCourse.id, teacherId: drsiti.id, semester: '2026-S1', schedule: 'Fri 10:00-12:00' },
      // faizal
      { courseId: engCourse.id, teacherId: faizal.id, semester: '2026-S1', schedule: 'Mon/Wed 10:00-11:30' },
      { courseId: mibCourse.id, teacherId: faizal.id, semester: '2026-S1', schedule: 'Fri 08:00-10:00' },
      // teacher01 (Aminah) - 7A
      { courseId: mathCourse.id, teacherId: teacher01.id, semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30 (7A)' },
      { courseId: sciCourse.id, teacherId: teacher01.id, semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30 (7A)' },
    ],
  })

  // ─── Enrollments ──────────────────────────────────────────────────────

  // Ahmad enrolled in all 5 courses
  for (const course of courses) {
    await prisma.enrollment.create({
      data: { studentId: ahmad.id, courseId: course.id, semester: '2026-S1' },
    })
  }

  // adam and nurul enrolled in all 5 courses
  for (const course of courses) {
    await prisma.enrollment.createMany({
      data: [
        { studentId: adam.id, courseId: course.id, semester: '2026-S1' },
        { studentId: nurul.id, courseId: course.id, semester: '2026-S1' },
      ],
    })
  }

  // ─── Grade Items for Ahmad's 4-week declining trend ────────────────────
  // 5 courses × 4 weeks = 20 GradeItems named "Week N Quiz"
  // Week1 = 4 weeks ago, Week2 = 3 weeks ago, Week3 = 2 weeks ago, Week4 = 1 week ago

  const ahmadCourseOrder = [mathCourse, sciCourse, engCourse, mibCourse, icCourse]
  const ahmadWeekScores: Record<string, number[]> = {
    // [Math, Science, English, MIB, ICT] per week
    'Week 1': [78, 72, 75, 80, 77],
    'Week 2': [72, 68, 70, 75, 71],
    'Week 3': [68, 62, 66, 70, 65],
    'Week 4': [65, 58, 62, 67, 60],
  }

  // Create Ahmad's GradeItems (Week 1-4 Quiz per course)
  const ahmadGradeItems: { gradeItemId: string; courseIdx: number; weekIdx: number }[] = []
  for (let ci = 0; ci < ahmadCourseOrder.length; ci++) {
    const course = ahmadCourseOrder[ci]
    for (let wi = 0; wi < 4; wi++) {
      const weekLabel = `Week ${wi + 1}`
      const gi = await prisma.gradeItem.create({
        data: {
          courseId: course.id,
          name: `${weekLabel} Quiz`,
          type: 'quiz',
          maxScore: 100,
          weight: 0.1,
          dueDate: weeksAgo(4 - wi),
        },
      })
      ahmadGradeItems.push({ gradeItemId: gi.id, courseIdx: ci, weekIdx: wi })
    }
  }

  // Create Grade records for Ahmad
  for (const item of ahmadGradeItems) {
    const weekLabel = `Week ${item.weekIdx + 1}`
    const score = ahmadWeekScores[weekLabel][item.courseIdx]
    const letterGrade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
    await prisma.grade.create({
      data: {
        studentId: ahmad.id,
        gradeItemId: item.gradeItemId,
        score,
        letterGrade,
        gradedAt: weeksAgo(4 - item.weekIdx),
      },
    })
  }

  // ─── Grade Items for adam/nurul (original grade items) ────────────────

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

  const allLegacyGradeItems = await prisma.gradeItem.findMany({
    where: {
      name: { in: ['Quiz 1', 'Midterm Exam', 'Assignment 1', 'Final Exam'] },
    },
  })

  const gradeScores: Record<string, [number, number]> = {
    'Quiz 1': [17, 19],
    'Midterm Exam': [78, 92],
    'Assignment 1': [42, 47],
    'Final Exam': [82, 88],
  }

  const letterGrade = (score: number, max: number) => {
    const pct = (score / max) * 100
    if (pct >= 90) return 'A'
    if (pct >= 80) return 'B'
    if (pct >= 70) return 'C'
    if (pct >= 60) return 'D'
    return 'F'
  }

  for (const gi of allLegacyGradeItems) {
    const scores = gradeScores[gi.name] ?? [75, 80]
    const adamScore = Math.min(scores[0] + Math.floor(Math.random() * 5 - 2), gi.maxScore)
    const nurulScore = Math.min(scores[1] + Math.floor(Math.random() * 5 - 2), gi.maxScore)

    await prisma.grade.createMany({
      data: [
        {
          studentId: adam.id,
          gradeItemId: gi.id,
          score: adamScore,
          letterGrade: letterGrade(adamScore, gi.maxScore),
          gradedAt: new Date('2026-04-30'),
        },
        {
          studentId: nurul.id,
          gradeItemId: gi.id,
          score: nurulScore,
          letterGrade: letterGrade(nurulScore, gi.maxScore),
          gradedAt: new Date('2026-04-30'),
        },
      ],
    })
  }

  // ─── Attendance Sessions & Records for Ahmad (60% attendance) ────────
  // 10 sessions over 10 weeks for Math course
  // present, present, absent, present, absent, present, absent, absent, present, present
  // = 6 present / 4 absent = 60%

  const ahmadAttendanceStatuses = [
    'present', 'present', 'absent', 'present', 'absent',
    'present', 'absent', 'absent', 'present', 'present',
  ]

  for (let i = 0; i < 10; i++) {
    const sessionDate = weeksAgo(10 - i)
    const session = await prisma.attendanceSession.create({
      data: {
        courseId: mathCourse.id,
        date: sessionDate,
        topic: `Mathematics - Week ${i + 1}`,
        status: 'completed',
      },
    })
    const status = ahmadAttendanceStatuses[i]
    await prisma.attendanceRecord.create({
      data: {
        sessionId: session.id,
        studentId: ahmad.id,
        status,
        checkedInAt: status !== 'absent' ? sessionDate : null,
      },
    })
  }

  // ─── Attendance Sessions for adam/nurul (original) ────────────────────

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

  // ─── Certifications ────────────────────────────────────────────────────

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
      {
        teacherId: teacher01.id,
        name: 'Teaching License - Mathematics',
        issuedBy: 'Ministry of Education Brunei',
        issuedDate: new Date('2018-08-15'),
        expiryDate: new Date('2028-08-15'),
        status: 'active',
      },
    ],
  })

  // ─── Admissions ────────────────────────────────────────────────────────

  // Ahmad's admission record (demo story start)
  await prisma.admission.create({
    data: {
      applicantName: 'Ahmad Bin Abdullah',
      dateOfBirth: new Date('2010-03-12'),
      gender: 'Male',
      icNumber: 'BN20100312',
      nationality: 'Bruneian',
      parentName: 'Hj Abdullah Bin Mahmud',
      parentPhone: '+673-8123456',
      parentEmail: 'abdullah@email.com',
      gradeApplied: 'Year 7',
      previousSchool: 'Sekolah Rendah Hj Tahir',
      status: 'pending',
    },
  })

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

  // ─── Facilities ────────────────────────────────────────────────────────

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

  // ─── Fee Invoices (at least 10, total ≥ 5000 BND) ─────────────────────

  // All Year 7-8 student ids for fee invoices
  const feeStudents = [
    ahmad.id, adam.id, nurul.id,
    ...y7extraStudentIds,
    ...(extraStudentIdsByYear['Year 8'] ?? []),
  ]

  for (let i = 0; i < feeStudents.length && i < 12; i++) {
    const sid = feeStudents[i]
    const isPaid = i % 3 !== 2
    await prisma.feeInvoice.create({
      data: {
        studentId: sid,
        semester: '2026-S1',
        amount: 350.0,
        status: isPaid ? 'paid' : 'unpaid',
        dueDate: new Date('2026-06-30'),
        paidAt: isPaid ? daysAgo(30 + i * 3) : null,
        description: 'Tuition Fee - Semester 1',
      },
    })
  }

  // Additional lab fees
  for (let i = 0; i < 5; i++) {
    const sid = feeStudents[i]
    await prisma.feeInvoice.create({
      data: {
        studentId: sid,
        semester: '2026-S1',
        amount: i === 3 ? 80.0 : 50.0,
        status: i < 3 ? 'paid' : 'overdue',
        dueDate: new Date('2026-03-31'),
        paidAt: i < 3 ? daysAgo(60 - i * 5) : null,
        description: 'Science Lab Fee',
      },
    })
  }

  // ─── School Expenses ───────────────────────────────────────────────────

  await prisma.schoolExpense.createMany({
    data: [
      { category: 'supplies', description: 'Science lab equipment restocking', amount: 2500.0, date: new Date('2026-03-10'), approvedBy: 'Hjh Rashidah Binti Mohamad', status: 'approved' },
      { category: 'maintenance', description: 'Classroom 7A air conditioning repair', amount: 800.0, date: new Date('2026-04-05'), approvedBy: 'Hjh Rashidah Binti Mohamad', status: 'approved' },
      { category: 'utilities', description: 'Electricity bill - April 2026', amount: 3200.0, date: new Date('2026-04-30'), approvedBy: 'Hjh Rashidah Binti Mohamad', status: 'approved' },
      { category: 'supplies', description: 'Sports equipment for field day', amount: 1500.0, date: new Date('2026-05-01'), status: 'pending' },
      { category: 'maintenance', description: 'Library shelving replacement', amount: 1200.0, date: new Date('2026-05-10'), status: 'pending' },
      { category: 'utilities', description: 'Internet service upgrade', amount: 450.0, date: new Date('2026-05-15'), approvedBy: 'Hjh Rashidah Binti Mohamad', status: 'approved' },
    ],
  })

  // ─── Notifications ─────────────────────────────────────────────────────

  await prisma.notification.createMany({
    data: [
      { userId: student001User.id, title: 'Grade Published', message: 'Your Mathematics Week 4 Quiz grade has been published.', type: 'success' },
      { userId: student001User.id, title: 'Attendance Warning', message: 'Your attendance rate has dropped below 70%. Please improve attendance.', type: 'warning' },
      { userId: adamUser.id, title: 'Grade Published', message: 'Your Mathematics Quiz 1 grade has been published.', type: 'success' },
      { userId: adamUser.id, title: 'Fee Due Reminder', message: 'Your Science Lab Fee is due by March 31.', type: 'warning' },
      { userId: drsitiUser.id, title: 'Certification Expiring', message: 'Your Cambridge International Teaching Certificate expires on March 1, 2026.', type: 'warning' },
      { userId: teacher01User.id, title: 'CPD Reminder', message: 'You have completed 18/20 CPD hours. Complete 2 more hours before year end.', type: 'warning' },
      { userId: fatimahUser.id, title: 'Attendance Alert', message: 'Adam was marked absent for English Language on May 14.', type: 'error' },
      { userId: parent01User.id, title: 'Attendance Alert', message: 'Ahmad attendance rate is at 60%. Please contact the school.', type: 'error' },
      { userId: adminUser.id, title: 'New Admission', message: '5 new admission applications require review.', type: 'info' },
    ],
  })

  // ─── Performance Evaluations ──────────────────────────────────

  // teacher01 (Ms. Aminah) — submitted, pending principal approval
  await prisma.performanceEvaluation.create({
    data: {
      teacherId: teacher01.id,
      academicYear: '2025/2026',
      evaluatorId: hodUser.id,
      teachingScore: 82,
      professionalScore: 78,
      conductScore: 85,
      overallScore: 81.7,
      rating: 'Good',
      comments:
        'Ms. Aminah demonstrates good classroom management skills. CPD hours slightly below target — needs to complete remaining 2 hours before year end.',
      status: 'submitted',
      submittedAt: daysAgo(5),
    },
  })

  // drsiti — approved
  await prisma.performanceEvaluation.create({
    data: {
      teacherId: drsiti.id,
      academicYear: '2025/2026',
      evaluatorId: hodUser.id,
      teachingScore: 92,
      professionalScore: 90,
      conductScore: 95,
      overallScore: 92.3,
      rating: 'Excellent',
      comments: 'Dr. Siti consistently exceeds expectations. Recommended for senior role consideration.',
      status: 'approved',
      submittedAt: daysAgo(20),
      reviewerId: principalUser.id,
      reviewerComments: 'Approved. Excellent performance.',
      reviewedAt: daysAgo(15),
    },
  })

  // ─── Timetable Slots (Year 7A pre-generated) ─────────────────────
  // Mon 0, Tue 1, Wed 2, Thu 3, Fri 4
  const y7aSlots = [
    { courseId: mathCourse.id, teacherId: teacher01.id, dayOfWeek: 0, startTime: '08:00', endTime: '09:30', room: 'Classroom 7A' },
    { courseId: mathCourse.id, teacherId: teacher01.id, dayOfWeek: 2, startTime: '08:00', endTime: '09:30', room: 'Classroom 7A' },
    { courseId: sciCourse.id, teacherId: teacher01.id, dayOfWeek: 1, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: sciCourse.id, teacherId: teacher01.id, dayOfWeek: 3, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: engCourse.id, teacherId: faizal.id, dayOfWeek: 0, startTime: '10:00', endTime: '11:30', room: 'Classroom 7A' },
    { courseId: engCourse.id, teacherId: faizal.id, dayOfWeek: 2, startTime: '10:00', endTime: '11:30', room: 'Classroom 7A' },
    { courseId: mibCourse.id, teacherId: faizal.id, dayOfWeek: 4, startTime: '08:00', endTime: '10:00', room: 'Classroom 7A' },
    { courseId: icCourse.id, teacherId: drsiti.id, dayOfWeek: 4, startTime: '10:00', endTime: '12:00', room: 'Computer Lab' },
  ]

  for (const slot of y7aSlots) {
    await prisma.timetableSlot.create({
      data: { ...slot, gradeLevel: 'Year 7', className: '7A', semester: '2026-S1' },
    })
  }

  // ─── Facility Bookings ──────────────────────────────────────────
  const facilities = await prisma.facility.findMany()
  const hallA = facilities.find(f => f.name === 'Hall A')
  const sciLab = facilities.find(f => f.name === 'Science Lab 1')
  const compLab = facilities.find(f => f.name === 'Computer Lab')

  if (hallA) {
    await prisma.facilityBooking.create({
      data: {
        facilityId: hallA.id,
        bookedBy: principalUser.id,
        purpose: 'Year 7 Orientation Assembly',
        date: new Date('2026-06-02'),
        startTime: '09:00',
        endTime: '11:00',
        status: 'approved',
      },
    })
  }
  if (sciLab) {
    await prisma.facilityBooking.createMany({
      data: [
        { facilityId: sciLab.id, bookedBy: drsitiUser.id, purpose: 'Chemistry Practical - Year 9', date: new Date('2026-05-27'), startTime: '14:00', endTime: '16:00', status: 'approved' },
        { facilityId: sciLab.id, bookedBy: teacher01User.id, purpose: 'Science Fair Preparation - Year 7', date: new Date('2026-06-05'), startTime: '13:00', endTime: '15:00', status: 'pending' },
      ],
    })
  }
  if (compLab) {
    await prisma.facilityBooking.create({
      data: {
        facilityId: compLab.id,
        bookedBy: drsitiUser.id,
        purpose: 'ICT Examination - Year 10',
        date: new Date('2026-06-03'),
        startTime: '08:00',
        endTime: '10:00',
        status: 'approved',
      },
    })
  }

  console.log('Seed completed successfully!')
  console.log('Summary:')
  const userCount = await prisma.user.count()
  const studentCount = await prisma.student.count()
  const teacherCount = await prisma.teacher.count()
  const parentCount = await prisma.parent.count()
  const enrollmentCount = await prisma.enrollment.count()
  const gradeItemCount = await prisma.gradeItem.count()
  const gradeCount = await prisma.grade.count()
  const attendanceSessionCount = await prisma.attendanceSession.count()
  const attendanceRecordCount = await prisma.attendanceRecord.count()
  const admissionCount = await prisma.admission.count()
  const feeInvoiceCount = await prisma.feeInvoice.count()
  console.log(`  Users: ${userCount}`)
  console.log(`  Students: ${studentCount}`)
  console.log(`  Teachers: ${teacherCount}`)
  console.log(`  Parents: ${parentCount}`)
  console.log(`  Enrollments: ${enrollmentCount}`)
  console.log(`  GradeItems: ${gradeItemCount}`)
  console.log(`  Grades: ${gradeCount}`)
  console.log(`  AttendanceSessions: ${attendanceSessionCount}`)
  console.log(`  AttendanceRecords: ${attendanceRecordCount}`)
  console.log(`  Admissions: ${admissionCount}`)
  console.log(`  FeeInvoices: ${feeInvoiceCount}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
