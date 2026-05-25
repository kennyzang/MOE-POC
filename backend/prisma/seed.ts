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
