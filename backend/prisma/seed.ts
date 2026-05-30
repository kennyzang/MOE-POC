import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function hash(pw: string) {
  return bcrypt.hashSync(pw, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(8, 0, 0, 0)
  return d
}

function weeksAgo(n: number): Date {
  return daysAgo(n * 7)
}

// ─── Malay name generator ────────────────────────────────────────────────────

const MALE_FIRST = [
  'Ahmad', 'Muhammad', 'Mohd', 'Hafiz', 'Azlan', 'Faizal', 'Ridwan',
  'Ismail', 'Rashid', 'Zulkifli', 'Ibrahim', 'Hassan', 'Amirul', 'Khairul',
  'Firdaus', 'Syafiq', 'Hazim', 'Ruzaini', 'Farhan', 'Nizam',
]
const FEMALE_FIRST = [
  'Nurul', 'Siti', 'Nur', 'Farah', 'Aminah', 'Hidayah', 'Syahirah',
  'Nabilah', 'Afiqah', 'Fatimah', 'Aisyah', 'Hafeeza', 'Nabila',
  'Zulaikha', 'Shahirah',
]
const BIN_BINTI_NAMES = [
  'Abdullah', 'Ibrahim', 'Hassan', 'Ahmad', 'Mohd', 'Sulaiman', 'Yusof',
  'Ismail', 'Rahman', 'Kadir', 'Manaf', 'Daud', 'Othman', 'Razak',
  'Hamid', 'Latif', 'Wahab', 'Salleh', 'Jaafar', 'Noor',
]

function generateName(idx: number, forceGender?: 'M' | 'F'): { name: string; gender: string } {
  const isMale = forceGender ? forceGender === 'M' : idx % 2 === 0
  const firstNames = isMale ? MALE_FIRST : FEMALE_FIRST
  const firstName = firstNames[idx % firstNames.length]
  const binBinti = BIN_BINTI_NAMES[idx % BIN_BINTI_NAMES.length]
  const connector = isMale ? 'Bin' : 'Binti'
  return {
    name: `${firstName} ${connector} ${binBinti}`,
    gender: isMale ? 'Male' : 'Female',
  }
}

// ─── Classes per year ────────────────────────────────────────────────────────
// 576 students per year, 15 classes (7A-7O), ~38-39 per class
// Year 7A special: exactly 31 named students (Ahmad + 30 others)
// so the class has 31 enrolled when seeded, leaving Ahmad as 32nd to add live

const YEAR_LABELS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12']
const CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']
const STUDENTS_PER_YEAR = 576

async function main() {
  console.log('Seeding MOE SERPS database (EXACT SPEC numbers)...')

  // ─── Named users (all individual creates for variable capture) ────────────

  const adminUser = await prisma.user.create({
    data: { username: 'admin', password: hash('admin123'), displayName: 'System Admin', email: 'admin@moe.edu.bn', role: 'admin' },
  })

  const principalUser = await prisma.user.create({
    data: { username: 'principal', password: hash('principal123'), displayName: 'Hjh Rashidah Binti Mohamad', email: 'principal@moe.edu.bn', role: 'principal' },
  })

  const hodUser = await prisma.user.create({
    data: { username: 'hod01', password: hash('hod123'), displayName: 'Dr. Azman Bin Ishak', email: 'azman@moe.edu.bn', role: 'hod' },
  })

  await prisma.user.create({
    data: { username: 'manager', password: hash('Demo@2026'), displayName: 'Hj Kamaruddin', email: 'kamaruddin@moe.edu.bn', role: 'manager' },
  })

  await prisma.user.create({
    data: { username: 'finance', password: hash('finance123'), displayName: 'Finance Officer', email: 'finance@moe.edu.bn', role: 'finance' },
  })

  await prisma.user.create({
    data: { username: 'admission', password: hash('admission123'), displayName: 'Cik Nurul Binti Ali', email: 'admission@moe.edu.bn', role: 'admissions' },
  })

  await prisma.user.create({
    data: { username: 'admissions', password: hash('Demo@2026'), displayName: 'Admissions Officer', email: 'admissions@moe.edu.bn', role: 'admissions' },
  })

  // Teachers
  const drsitiUser = await prisma.user.create({
    data: { username: 'drsiti', password: hash('Demo@2026'), displayName: 'Dr. Siti Nurhaliza', email: 'siti@moe.edu.bn', role: 'teacher' },
  })

  const faizalUser = await prisma.user.create({
    data: { username: 'faizal', password: hash('Demo@2026'), displayName: 'Mohd Faizal Bin Aziz', email: 'faizal@moe.edu.bn', role: 'teacher' },
  })

  // teacher01 = Ms. Aminah (CPD 18h)
  const teacher01User = await prisma.user.create({
    data: { username: 'teacher01', password: hash('teacher123'), displayName: 'Ms. Aminah Binti Hassan', email: 'aminah@moe.edu.bn', role: 'teacher' },
  })

  // Counselor - Ms. Farah
  const farahUser = await prisma.user.create({
    data: { username: 'farah', password: hash('Demo@2026'), displayName: 'Ms. Farah Binti Aziz', email: 'farah@moe.edu.bn', role: 'counselor' },
  })

  // Students
  const student001User = await prisma.user.create({
    data: { username: 'student001', password: hash('student123'), displayName: 'Ahmad Bin Abdullah', email: 'ahmad@student.moe.edu.bn', role: 'student' },
  })

  const adamUser = await prisma.user.create({
    data: { username: 'adam', password: hash('Demo@2026'), displayName: 'Adam Bin Haris', email: 'adam@student.moe.edu.bn', role: 'student' },
  })

  const nurulUser = await prisma.user.create({
    data: { username: 'nurul', password: hash('Demo@2026'), displayName: 'Nurul Binti Rahman', email: 'nurul@student.moe.edu.bn', role: 'student' },
  })

  // Parents
  const parent01User = await prisma.user.create({
    data: { username: 'parent01', password: hash('parent123'), displayName: 'Hj Abdullah Bin Mahmud', email: 'abdullah@email.com', role: 'parent' },
  })

  const fatimahUser = await prisma.user.create({
    data: { username: 'fatimah', password: hash('Demo@2026'), displayName: 'Fatimah Binti Yusof', email: 'fatimah@parent.moe.edu.bn', role: 'parent' },
  })

  // ─── Teacher records ──────────────────────────────────────────────────────

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

  // Ms. Aminah — CPD = 18h (6 + 8 + 4)
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

  // ─── School ───────────────────────────────────────────────────────────────

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

  // ─── Courses ──────────────────────────────────────────────────────────────

  const mathCourse = await prisma.course.create({
    data: { code: 'MATH701', name: 'Mathematics Year 7', description: 'Foundation mathematics covering algebra, geometry, and statistics', gradeLevel: 'Year 7', creditHours: 4 },
  })

  const engCourse = await prisma.course.create({
    data: { code: 'ENG701', name: 'English Language Year 7', description: 'English reading, writing, grammar and communication skills', gradeLevel: 'Year 7', creditHours: 4 },
  })

  const sciCourse = await prisma.course.create({
    data: { code: 'SCI701', name: 'Science Year 7', description: 'Integrated science covering biology, chemistry and physics fundamentals', gradeLevel: 'Year 7', creditHours: 3 },
  })

  const mibCourse = await prisma.course.create({
    data: { code: 'MIB701', name: 'Melayu Islam Beraja Year 7', description: 'National philosophy education covering Malay, Islamic and Monarchy values', gradeLevel: 'Year 7', creditHours: 2 },
  })

  const icCourse = await prisma.course.create({
    data: { code: 'ICT701', name: 'ICT Year 7', description: 'Information and communication technology fundamentals', gradeLevel: 'Year 7', creditHours: 2 },
  })

  // Daily roll-call course for bulk attendance sessions
  const rollCallCourse = await prisma.course.create({
    data: { code: 'DAILY001', name: 'Daily Roll Call', description: 'School-wide daily attendance roll call', gradeLevel: 'All', creditHours: 0 },
  })

  const courses = [mathCourse, engCourse, sciCourse, mibCourse, icCourse]

  // ─── Course Assignments ───────────────────────────────────────────────────

  await prisma.courseAssignment.createMany({
    data: [
      { courseId: mathCourse.id, teacherId: drsiti.id,   semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30 (7B)' },
      { courseId: sciCourse.id,  teacherId: drsiti.id,   semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30 (7B)' },
      { courseId: icCourse.id,   teacherId: drsiti.id,   semester: '2026-S1', schedule: 'Fri 10:00-12:00' },
      { courseId: engCourse.id,  teacherId: faizal.id,   semester: '2026-S1', schedule: 'Mon/Wed 10:00-11:30' },
      { courseId: mibCourse.id,  teacherId: faizal.id,   semester: '2026-S1', schedule: 'Fri 08:00-10:00' },
      { courseId: mathCourse.id, teacherId: teacher01.id, semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30 (7A)' },
      { courseId: sciCourse.id,  teacherId: teacher01.id, semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30 (7A)' },
    ],
  })

  // ─── Bulk student generation ──────────────────────────────────────────────
  // Strategy:
  // - Named users above: student001 (Ahmad), adam, nurul → created individually
  // - Bulk: generate remaining students to reach 3,456 total
  // - Year 7A: Ahmad + adam + nurul = 3 named. Need 28 more to reach 31 (spec: Year 7A has 31 enrolled)
  //   → Then Ahmad is the 32nd to be added live in the demo
  // - Each year: 576 students. Year 7A = 31. Remaining Y7 classes (7B-7O = 14 classes) get (576-31)/14 = ~38-39

  // First, create named students (Ahmad, adam, nurul)
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

  const adam = await prisma.student.create({
    data: {
      userId: adamUser.id,
      studentId: 'STU2026002',
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
      studentId: 'STU2026003',
      dateOfBirth: new Date('2012-07-22'),
      gender: 'Female',
      nationality: 'Bruneian',
      gradeLevel: 'Year 7',
      className: '7A',
      enrollmentStatus: 'enrolled',
    },
  })

  // ─── Bulk generate: 28 more Year 7A students (to reach 31 in 7A) ─────────
  // Note: Ahmad (STU2026001), adam (STU2026002), nurul (STU2026003) already in 7A
  // Bulk users + students use index-based studentIds
  // We'll use a global index counter for uniqueness

  let globalIdx = 100 // start bulk index at 100 to avoid collisions

  async function bulkCreateStudents(
    count: number,
    year: string,
    className: string,
    idxOffset: number,
  ): Promise<string[]> {
    // Create users first in batch
    const userData = []
    for (let i = 0; i < count; i++) {
      const idx = idxOffset + i
      const { name, gender } = generateName(idx)
      const username = `s${year.replace('Year ', 'y')}${className.toLowerCase()}${String(idx).padStart(4, '0')}`
      userData.push({
        username,
        password: hash('Demo@2026'),
        displayName: name,
        email: `${username}@student.moe.edu.bn`,
        role: 'student',
      })
    }

    // SQLite createMany doesn't support skipDuplicates well, use individual inserts in a tx
    const createdUserIds: string[] = []
    for (const u of userData) {
      const created = await prisma.user.create({ data: u })
      createdUserIds.push(created.id)
    }

    // Create student records
    const studentData = createdUserIds.map((userId, i) => {
      const idx = idxOffset + i
      const { gender } = generateName(idx)
      const yearNum = year.replace('Year ', '')
      return {
        userId,
        studentId: `STU${yearNum}${className}${String(idx).padStart(5, '0')}`,
        gender: gender,
        nationality: 'Bruneian',
        gradeLevel: year,
        className: `${yearNum}${className}`,
        enrollmentStatus: 'enrolled',
      }
    })

    const insertedIds: string[] = []
    for (const sd of studentData) {
      const s = await prisma.student.create({ data: sd })
      insertedIds.push(s.id)
    }

    return insertedIds
  }

  // Year 7A: need 28 more (ahmad+adam+nurul = 3, target = 31)
  console.log('Creating Year 7A bulk students (28)...')
  const y7aExtraIds = await bulkCreateStudents(28, 'Year 7', 'A', globalIdx)
  globalIdx += 28

  // Year 7 remaining classes (7B-7O = 14 classes), 545 more students (576 - 31 = 545)
  // 545 / 14 = 38.9 → first 7 classes get 39, next 7 get 38 → 7*39 + 7*38 = 273+266 = 539 ❌
  // Let's do: 576 - 31 = 545 students. Distribute across 14 classes: 545 = 14*38 + 13 → 13 classes get 39, 1 class gets 38
  const y7OtherClassStudentIds: string[][] = []
  {
    const remainingY7Classes = CLASS_LETTERS.slice(1, 15) // B through O
    const remainingCount = STUDENTS_PER_YEAR - 31 // 545
    const basePerClass = Math.floor(remainingCount / remainingY7Classes.length) // 38
    const extras = remainingCount % remainingY7Classes.length // 13
    console.log(`Creating Year 7 classes B-O (${remainingCount} students)...`)
    for (let ci = 0; ci < remainingY7Classes.length; ci++) {
      const letter = remainingY7Classes[ci]
      const count = ci < extras ? basePerClass + 1 : basePerClass
      const ids = await bulkCreateStudents(count, 'Year 7', letter, globalIdx)
      y7OtherClassStudentIds.push(ids)
      globalIdx += count
    }
  }

  // Years 8-11: 576 each, 15 classes (A-O), ~38-39 per class
  // Year 9C must contain Hafiz Bin Abdullah — create him specially
  const hafizUser = await prisma.user.create({
    data: {
      username: 'hafiz_y9c',
      password: hash('Demo@2026'),
      displayName: 'Hafiz Bin Abdullah',
      email: 'hafiz.y9c@student.moe.edu.bn',
      role: 'student',
    },
  })
  const hafiz = await prisma.student.create({
    data: {
      userId: hafizUser.id,
      studentId: 'STU9C00001',
      dateOfBirth: new Date('2012-07-15'),
      gender: 'Male',
      nationality: 'Bruneian',
      gradeLevel: 'Year 9',
      className: '9C',
      enrollmentStatus: 'enrolled',
    },
  })

  // Generate years 8-12 (576 each)
  // Year 9C gets 1 less (Hafiz already there) → 575 - (38 or 39 for class C position) + 1 already seeded
  // Simpler: just reduce Year 9C by 1 in bulk
  const counselorCaseStudentIds: string[] = [] // collect some for counselor cases

  for (const year of ['Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12']) {
    const yearNum = year.replace('Year ', '')
    const isYear9 = year === 'Year 9'
    const totalForYear = STUDENTS_PER_YEAR // 576
    // Use full 576 for distribution math; isHafizClass reduces its slot by 1,
    // so bulk total = 575 and Hafiz accounts for the last slot → 576 total.
    const adjustedTotal = totalForYear
    const basePerClass = Math.floor(adjustedTotal / CLASS_LETTERS.length) // ~38
    const extras = adjustedTotal % CLASS_LETTERS.length

    console.log(`Creating ${year} (${adjustedTotal} bulk students)...`)
    for (let ci = 0; ci < CLASS_LETTERS.length; ci++) {
      const letter = CLASS_LETTERS[ci]
      // Skip position for Hafiz in Year 9C (ci=2 → 'C')
      const isHafizClass = isYear9 && letter === 'C'
      // Hafiz-class gets 1 less (already seeded Hafiz)
      const baseCount = ci < extras ? basePerClass + 1 : basePerClass
      const count = isHafizClass ? baseCount - 1 : baseCount
      if (count <= 0) continue

      const ids = await bulkCreateStudents(count, year, letter, globalIdx)
      globalIdx += count

      // Collect some students for counselor cases (from years 8-11)
      if (counselorCaseStudentIds.length < 4 && ['Year 8', 'Year 9', 'Year 10', 'Year 11'].includes(year) && letter === 'A') {
        counselorCaseStudentIds.push(...ids.slice(0, 1))
      }
    }
  }

  // ─── Parent records ───────────────────────────────────────────────────────

  const parent01 = await prisma.parent.create({
    data: { userId: parent01User.id, phone: '+673 8123 4567', occupation: 'Government Servant', relationship: 'father' },
  })

  await prisma.parentStudent.create({
    data: { parentId: parent01.id, studentId: ahmad.id },
  })

  const fatimah = await prisma.parent.create({
    data: { userId: fatimahUser.id, phone: '+673 8765 4321', occupation: 'Teacher', relationship: 'mother' },
  })

  await prisma.parentStudent.createMany({
    data: [
      { parentId: fatimah.id, studentId: adam.id },
      { parentId: fatimah.id, studentId: nurul.id },
    ],
  })

  // ─── Courses: Enrollments for Ahmad, adam, nurul ──────────────────────────

  for (const course of courses) {
    await prisma.enrollment.create({ data: { studentId: ahmad.id, courseId: course.id, semester: '2026-S1' } })
  }
  for (const course of courses) {
    await prisma.enrollment.createMany({
      data: [
        { studentId: adam.id, courseId: course.id, semester: '2026-S1' },
        { studentId: nurul.id, courseId: course.id, semester: '2026-S1' },
      ],
    })
  }

  // ─── Grade Items for Ahmad (4-week declining trend, Math = Week 1 score 78) ─

  const ahmadCourseOrder = [mathCourse, sciCourse, engCourse, mibCourse, icCourse]
  // Week 1 Math score = 78 (spec: Ahmad's Maths grade = 78)
  const ahmadWeekScores: Record<string, number[]> = {
    'Week 1': [78, 72, 75, 80, 77],
    'Week 2': [72, 68, 70, 75, 71],
    'Week 3': [68, 62, 66, 70, 65],
    'Week 4': [65, 58, 62, 67, 60],
  }

  const ahmadGradeItems: { gradeItemId: string; courseIdx: number; weekIdx: number }[] = []
  for (let ci = 0; ci < ahmadCourseOrder.length; ci++) {
    const course = ahmadCourseOrder[ci]
    for (let wi = 0; wi < 4; wi++) {
      const weekLabel = `Week ${wi + 1}`
      const gi = await prisma.gradeItem.create({
        data: { courseId: course.id, name: `${weekLabel} Quiz`, type: 'quiz', maxScore: 100, weight: 0.1, dueDate: weeksAgo(4 - wi) },
      })
      ahmadGradeItems.push({ gradeItemId: gi.id, courseIdx: ci, weekIdx: wi })
    }
  }

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

  // Grade items for adam/nurul
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

  const legacyGradeItems = await prisma.gradeItem.findMany({
    where: { name: { in: ['Quiz 1', 'Midterm Exam', 'Assignment 1', 'Final Exam'] } },
  })

  const legacyScores: Record<string, [number, number]> = {
    'Quiz 1': [17, 19], 'Midterm Exam': [78, 92], 'Assignment 1': [42, 47], 'Final Exam': [82, 88],
  }
  const letterGradeFn = (score: number, max: number) => {
    const pct = (score / max) * 100
    return pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F'
  }

  for (const gi of legacyGradeItems) {
    const scores = legacyScores[gi.name] ?? [75, 80]
    const adamScore = Math.min(scores[0] + 2, gi.maxScore)
    const nurulScore = Math.min(scores[1] + 2, gi.maxScore)
    await prisma.grade.createMany({
      data: [
        { studentId: adam.id, gradeItemId: gi.id, score: adamScore, letterGrade: letterGradeFn(adamScore, gi.maxScore), gradedAt: new Date('2026-04-30') },
        { studentId: nurul.id, gradeItemId: gi.id, score: nurulScore, letterGrade: letterGradeFn(nurulScore, gi.maxScore), gradedAt: new Date('2026-04-30') },
      ],
    })
  }

  // ─── Ahmad's attendance history (term absences = 2 in last 14 days) ───────
  // Per spec: Ahmad has exactly 2 absences in the last 14 days (before today's session)
  // Create sessions over past 10 weeks. Last 14 days = days 1-14 ago.
  // Put 2 absences within last 14 days, rest are present.

  const ahmadAttendancePlan = [
    // [daysAgo, status]
    { day: 63, status: 'present' },
    { day: 56, status: 'present' },
    { day: 49, status: 'absent' },  // absent (outside 14-day window)
    { day: 42, status: 'present' },
    { day: 35, status: 'absent' },  // absent (outside 14-day window)
    { day: 28, status: 'present' },
    { day: 21, status: 'present' },
    { day: 10, status: 'absent' },  // ABSENT - within last 14 days (day 10)
    { day: 6,  status: 'absent' },  // ABSENT - within last 14 days (day 6)
    { day: 3,  status: 'present' },
  ]

  for (const plan of ahmadAttendancePlan) {
    const sessionDate = daysAgo(plan.day)
    const session = await prisma.attendanceSession.create({
      data: { courseId: mathCourse.id, date: sessionDate, topic: `Mathematics - Session`, status: 'completed' },
    })
    await prisma.attendanceRecord.create({
      data: {
        sessionId: session.id,
        studentId: ahmad.id,
        status: plan.status,
        checkedInAt: plan.status !== 'absent' ? sessionDate : null,
      },
    })
  }

  // Sessions for adam/nurul
  const adamNurulSessionDates = [new Date('2026-05-12'), new Date('2026-05-14')]
  const adamNurulStatuses = ['present', 'present', 'present', 'late']
  let snIdx = 0
  for (const course of courses.slice(0, 2)) {
    for (const date of adamNurulSessionDates) {
      const session = await prisma.attendanceSession.create({
        data: { courseId: course.id, date, topic: `${course.name} - Session`, status: 'completed' },
      })
      for (const student of [adam, nurul]) {
        const st = adamNurulStatuses[snIdx % adamNurulStatuses.length]
        await prisma.attendanceRecord.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
            status: st,
            checkedInAt: st !== 'absent' ? new Date(`${date.toISOString().slice(0, 10)}T08:05:00`) : null,
          },
        })
        snIdx++
      }
    }
  }

  // ─── TODAY'S BULK ATTENDANCE: 3,456 records (3201 present, 156 absent, 99 late) ──

  console.log('Creating today\'s bulk attendance session...')
  const todayDate = new Date()
  todayDate.setHours(7, 30, 0, 0)

  const todaySession = await prisma.attendanceSession.create({
    data: { courseId: rollCallCourse.id, date: todayDate, topic: 'Daily Morning Roll Call', status: 'completed' },
  })

  // Gather ALL 3,456 enrolled student IDs
  // We'll fetch them from the DB (they've all been created above)
  const allStudents = await prisma.student.findMany({
    select: { id: true },
    where: { enrollmentStatus: 'enrolled' },
    orderBy: { createdAt: 'asc' },
  })

  const totalStudents = allStudents.length
  console.log(`Total enrolled students found: ${totalStudents}`)

  // Build attendance: 3201 present, 156 absent, 99 late
  // Ahmad is in this list — mark him present today (he has 2 historical absences already)
  const TARGET_PRESENT = 3201
  const TARGET_ABSENT = 156
  const TARGET_LATE = 99
  // Total = 3456

  // Assign statuses deterministically
  // Ahmad → present (index 0 since sorted by createdAt, he was created early)
  const attendanceDataBatch: { sessionId: string; studentId: string; status: string; checkedInAt: Date | null }[] = []

  for (let i = 0; i < allStudents.length; i++) {
    const sid = allStudents[i].id
    let status: string
    if (i < TARGET_PRESENT) {
      status = 'present'
    } else if (i < TARGET_PRESENT + TARGET_ABSENT) {
      status = 'absent'
    } else {
      status = 'late'
    }
    attendanceDataBatch.push({
      sessionId: todaySession.id,
      studentId: sid,
      status,
      checkedInAt: status !== 'absent' ? new Date() : null,
    })
  }

  // Insert in chunks of 500 to avoid SQLite limits
  const CHUNK_SIZE = 500
  for (let i = 0; i < attendanceDataBatch.length; i += CHUNK_SIZE) {
    const chunk = attendanceDataBatch.slice(i, i + CHUNK_SIZE)
    await prisma.attendanceRecord.createMany({ data: chunk })
  }

  // ─── Risk Score for Ahmad ─────────────────────────────────────────────────
  // score=0.21, band=LOW_RISK, absences14d=2, gradeAvg=78

  await prisma.riskScore.create({
    data: {
      studentId: ahmad.id,
      score: 0.21,
      band: 'LOW_RISK',
      absences14d: 2,
      gradeAvg: 78,
      gradeTrend: -5.0,
      computedAt: new Date(),
    },
  })

  // ─── Counselor Cases (4 open cases) ──────────────────────────────────────
  // Need 4 students. Use hafiz + 3 from counselorCaseStudentIds

  const counselorStudents = [hafiz.id, ...counselorCaseStudentIds.slice(0, 3)]
  // If we don't have enough, fill from allStudents
  while (counselorStudents.length < 4) {
    const extra = allStudents.find(s => !counselorStudents.includes(s.id))
    if (extra) counselorStudents.push(extra.id)
    else break
  }

  const caseReasons = [
    'AUTO_RISK_THRESHOLD',
    'AUTO_ABSENCE_THRESHOLD',
    'TEACHER_REFERRAL',
    'AUTO_RISK_THRESHOLD',
  ]
  const caseStatuses = ['OPEN', 'IN_PROGRESS', 'OPEN', 'OPEN']
  const caseNotes = [
    'Student risk score exceeded 0.70 threshold. Referred for counseling.',
    'Absence rate exceeded 20% in last 30 days. Counselor follow-up required.',
    'Teacher referred student due to observed behavioral changes.',
    'Automated risk threshold triggered. Initial assessment pending.',
  ]

  for (let i = 0; i < 4; i++) {
    await prisma.counselorCase.create({
      data: {
        studentId: counselorStudents[i],
        counselorUserId: farahUser.id,
        openedReason: caseReasons[i],
        status: caseStatuses[i],
        notes: caseNotes[i],
        openedAt: daysAgo(14 - i * 3),
      },
    })
  }

  // ─── HIGH_RISK RiskScores for counselor-case students ────────────────────
  const riskScores = [0.78, 0.82, 0.71, 0.85]
  const riskAbsences = [18, 22, 15, 25]
  const riskGradeAvgs = [42.0, 38.5, 45.0, 36.0]
  for (let i = 0; i < counselorStudents.length; i++) {
    await prisma.riskScore.create({
      data: {
        studentId: counselorStudents[i],
        score: riskScores[i],
        band: 'HIGH_RISK',
        absences14d: riskAbsences[i],
        gradeAvg: riskGradeAvgs[i],
        gradeTrend: -0.05,
        computedAt: daysAgo(1),
      },
    })
  }

  // ─── Admissions ───────────────────────────────────────────────────────────
  // Ahmad's application: status "draft", applicationNumber APP-2026-00012

  const ahmadAdmission = await prisma.admission.create({
    data: {
      applicationNumber: 'APP-2026-00012',
      applicantName: 'Ahmad Bin Abdullah',
      icNumber: '01-456789',
      dateOfBirth: new Date('2014-03-12'),
      gender: 'MALE',
      nationality: 'Brunei',
      parentName: 'Mrs. Siti Binti Mohamed',
      parentPhone: '+673 8123 4567',
      parentEmail: 'siti.mohamed@gmail.com',
      guardianUserId: parent01User.id,
      gradeApplied: 'Year 7',
      programmeStream: 'Academic',
      previousSchool: 'Sekolah Rendah Berakas',
      medicalConditions: 'Mild asthma',
      hasSiblingPriority: true,
      siblingName: 'Hafiz Bin Abdullah',
      siblingStudentId: hafiz.id,
      docsComplete: true,
      previousAcademicAvg: 55,
      eligibilityScore: 82,
      status: 'draft',
    },
  })

  // Ahmad's 3 documents
  await prisma.admissionDocument.createMany({
    data: [
      { admissionId: ahmadAdmission.id, type: 'BIRTH_CERTIFICATE', filename: 'ahmad_birth_cert.pdf', filePath: '/uploads/admissions/ahmad_birth_cert.pdf', uploadedAt: new Date('2026-05-10') },
      { admissionId: ahmadAdmission.id, type: 'REPORT_CARD', filename: 'ahmad_report_card_2025.pdf', filePath: '/uploads/admissions/ahmad_report_card_2025.pdf', uploadedAt: new Date('2026-05-10') },
      { admissionId: ahmadAdmission.id, type: 'IC_COPY', filename: 'ahmad_ic_copy.pdf', filePath: '/uploads/admissions/ahmad_ic_copy.pdf', uploadedAt: new Date('2026-05-10') },
    ],
  })

  // 11 other submitted applications
  const submittedApplicants = [
    { name: 'Aiman Bin Yusuf',        dob: '2013-05-10', gender: 'MALE',   grade: 'Year 7',  score: 85, school: 'Sekolah Rendah Kota Batu',   parent: 'Yusuf Bin Ahmad',     phone: '+673 8234567' },
    { name: 'Aisyah Binti Hamid',     dob: '2013-08-22', gender: 'FEMALE', grade: 'Year 7',  score: 78, school: 'Sekolah Rendah Rimba',        parent: 'Hamid Bin Ismail',    phone: '+673 8345678' },
    { name: 'Muhammad Haziq Bin Rosli', dob: '2013-02-14', gender: 'MALE', grade: 'Year 7',  score: 91, school: 'Sekolah Rendah Gadong',       parent: 'Rosli Bin Hj Omar',   phone: '+673 8456789' },
    { name: 'Siti Aminah Binti Latif', dob: '2013-11-03', gender: 'FEMALE', grade: 'Year 7', score: 73, school: 'Sekolah Rendah Seria',        parent: 'Latif Bin Awang',     phone: '+673 8567890' },
    { name: 'Danial Bin Zulkifli',    dob: '2012-06-18', gender: 'MALE',   grade: 'Year 8',  score: 88, school: 'Sekolah Rendah Berakas',      parent: 'Zulkifli Bin Hamid',  phone: '+673 8678901' },
    { name: 'Nabilah Binti Othman',   dob: '2012-09-05', gender: 'FEMALE', grade: 'Year 8',  score: 76, school: 'Sekolah Rendah Tutong',       parent: 'Othman Bin Rashid',   phone: '+673 8789012' },
    { name: 'Farhan Bin Sulaiman',    dob: '2012-04-22', gender: 'MALE',   grade: 'Year 9',  score: 95, school: 'Sekolah Rendah Kiulap',       parent: 'Sulaiman Bin Daud',   phone: '+673 8890123' },
    { name: 'Zulaikha Binti Wahab',   dob: '2011-12-11', gender: 'FEMALE', grade: 'Year 9',  score: 82, school: 'Sekolah Rendah Salambigar',   parent: 'Wahab Bin Manaf',     phone: '+673 8901234' },
    { name: 'Khairul Bin Salleh',     dob: '2011-07-30', gender: 'MALE',   grade: 'Year 10', score: 69, school: 'Sekolah Menengah Lambak',     parent: 'Salleh Bin Jaafar',   phone: '+673 8012345' },
    { name: 'Afiqah Binti Noor',      dob: '2011-03-17', gender: 'FEMALE', grade: 'Year 10', score: 61, school: 'Sekolah Menengah Berakas',    parent: 'Noor Bin Abdullah',   phone: '+673 8123456' },
    { name: 'Ridwan Bin Kadir',       dob: '2010-11-25', gender: 'MALE',   grade: 'Year 7',  score: 74, school: 'Sekolah Rendah Mentiri',      parent: 'Kadir Bin Rahman',    phone: '+673 8234568' },
  ]

  let appNum = 1
  for (const app of submittedApplicants) {
    await prisma.admission.create({
      data: {
        applicationNumber: `APP-2026-${String(appNum).padStart(5, '0')}`,
        applicantName: app.name,
        dateOfBirth: new Date(app.dob),
        gender: app.gender,
        nationality: 'Brunei',
        parentName: app.parent,
        parentPhone: app.phone,
        gradeApplied: app.grade,
        previousSchool: app.school,
        eligibilityScore: app.score,
        docsComplete: true,
        status: 'submitted',
        submittedAt: daysAgo(7 + appNum),
      },
    })
    appNum++
  }

  // ─── Certifications ───────────────────────────────────────────────────────

  await prisma.certification.createMany({
    data: [
      { teacherId: drsiti.id, name: 'Teaching License - Mathematics', issuedBy: 'Ministry of Education Brunei', issuedDate: new Date('2019-06-15'), expiryDate: new Date('2027-06-15'), status: 'active' },
      { teacherId: drsiti.id, name: 'Cambridge International Teaching Certificate', issuedBy: 'Cambridge Assessment', issuedDate: new Date('2020-03-01'), expiryDate: new Date('2026-03-01'), status: 'active' },
      { teacherId: faizal.id, name: 'Teaching License - English', issuedBy: 'Ministry of Education Brunei', issuedDate: new Date('2021-01-10'), expiryDate: new Date('2028-01-10'), status: 'active' },
      { teacherId: teacher01.id, name: 'Teaching License - Mathematics', issuedBy: 'Ministry of Education Brunei', issuedDate: new Date('2018-08-15'), expiryDate: new Date('2028-08-15'), status: 'active' },
    ],
  })

  // ─── Facilities ───────────────────────────────────────────────────────────

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

  // ─── Fee Invoices ─────────────────────────────────────────────────────────

  const feeStudentIds = [ahmad.id, adam.id, nurul.id, ...y7aExtraIds.slice(0, 9)]
  for (let i = 0; i < feeStudentIds.length && i < 12; i++) {
    const isPaid = i % 3 !== 2
    await prisma.feeInvoice.create({
      data: {
        studentId: feeStudentIds[i],
        semester: '2026-S1',
        amount: 350.0,
        status: isPaid ? 'paid' : 'unpaid',
        dueDate: new Date('2026-06-30'),
        paidAt: isPaid ? daysAgo(30 + i * 3) : null,
        description: 'Tuition Fee - Semester 1',
      },
    })
  }
  for (let i = 0; i < 5; i++) {
    await prisma.feeInvoice.create({
      data: {
        studentId: feeStudentIds[i],
        semester: '2026-S1',
        amount: i === 3 ? 80.0 : 50.0,
        status: i < 3 ? 'paid' : 'overdue',
        dueDate: new Date('2026-03-31'),
        paidAt: i < 3 ? daysAgo(60 - i * 5) : null,
        description: 'Science Lab Fee',
      },
    })
  }

  // ─── School Expenses ──────────────────────────────────────────────────────

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

  // ─── Performance Evaluations ──────────────────────────────────────────────

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
      comments: 'Ms. Aminah demonstrates good classroom management skills. CPD hours at 18/20 — on track to complete before year end.',
      status: 'submitted',
      submittedAt: daysAgo(5),
    },
  })

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

  // ─── Timetable Slots ──────────────────────────────────────────────────────

  const y7aSlots = [
    { courseId: mathCourse.id, teacherId: teacher01.id, dayOfWeek: 0, startTime: '08:00', endTime: '09:30', room: 'Classroom 7A' },
    { courseId: mathCourse.id, teacherId: teacher01.id, dayOfWeek: 2, startTime: '08:00', endTime: '09:30', room: 'Classroom 7A' },
    { courseId: sciCourse.id,  teacherId: teacher01.id, dayOfWeek: 1, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: sciCourse.id,  teacherId: teacher01.id, dayOfWeek: 3, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: engCourse.id,  teacherId: faizal.id,    dayOfWeek: 0, startTime: '10:00', endTime: '11:30', room: 'Classroom 7A' },
    { courseId: engCourse.id,  teacherId: faizal.id,    dayOfWeek: 2, startTime: '10:00', endTime: '11:30', room: 'Classroom 7A' },
    { courseId: mibCourse.id,  teacherId: faizal.id,    dayOfWeek: 4, startTime: '08:00', endTime: '10:00', room: 'Classroom 7A' },
    { courseId: icCourse.id,   teacherId: drsiti.id,    dayOfWeek: 4, startTime: '10:00', endTime: '12:00', room: 'Computer Lab' },
  ]
  for (const slot of y7aSlots) {
    await prisma.timetableSlot.create({ data: { ...slot, gradeLevel: 'Year 7', className: '7A', semester: '2026-S1' } })
  }

  // ─── Facility Bookings ────────────────────────────────────────────────────

  const facilities = await prisma.facility.findMany()
  const hallA = facilities.find(f => f.name === 'Hall A')
  const sciLab = facilities.find(f => f.name === 'Science Lab 1')
  const compLab = facilities.find(f => f.name === 'Computer Lab')

  if (hallA) {
    await prisma.facilityBooking.create({
      data: { facilityId: hallA.id, bookedBy: principalUser.id, purpose: 'Year 7 Orientation Assembly', date: new Date('2026-06-02'), startTime: '09:00', endTime: '11:00', status: 'approved' },
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
      data: { facilityId: compLab.id, bookedBy: drsitiUser.id, purpose: 'ICT Examination - Year 10', date: new Date('2026-06-03'), startTime: '08:00', endTime: '10:00', status: 'approved' },
    })
  }

  // ─── School Calendar Events ────────────────────────────────────────────────

  const schoolEvents = [
    { title: 'Mid-Term Examinations', date: new Date('2026-05-20'), endDate: new Date('2026-05-22'), type: 'exam', description: 'Year 7-11 mid-term examinations' },
    { title: 'Sports Day', date: new Date('2026-06-05'), type: 'activity', description: 'Annual school sports day — all students participate' },
    { title: 'School Open Day', date: new Date('2026-06-10'), type: 'event', description: 'Annual school open day for parents and prospective students' },
    { title: 'Hari Raya Aidiladha', date: new Date('2026-06-07'), endDate: new Date('2026-06-08'), type: 'holiday', description: 'Public holiday — school closed' },
    { title: 'Final Examinations Begin', date: new Date('2026-07-06'), endDate: new Date('2026-07-17'), type: 'exam', description: 'End-of-year final examinations Year 7-11' },
    { title: 'Science Fair', date: new Date('2026-05-30'), type: 'activity', description: 'Students present science projects to judges and parents' },
    { title: 'Parent-Teacher Meeting', date: new Date('2026-06-20'), type: 'event', description: 'Semester 1 progress review with parents' },
    { title: 'School Holiday (Semester Break)', date: new Date('2026-07-20'), endDate: new Date('2026-08-02'), type: 'holiday', description: 'Mid-year school holiday' },
  ]
  for (const ev of schoolEvents) {
    await prisma.schoolEvent.create({ data: ev })
  }

  // ─── Notifications ─────────────────────────────────────────────────────────

  await prisma.notification.createMany({
    data: [
      { userId: student001User.id, title: 'Grade Published', message: 'Your Mathematics Week 1 Quiz grade (78) has been published.', type: 'success' },
      { userId: student001User.id, title: 'Attendance Warning', message: 'You have 2 absences in the last 14 days. Please maintain good attendance.', type: 'warning' },
      { userId: adamUser.id, title: 'Grade Published', message: 'Your Mathematics Quiz 1 grade has been published.', type: 'success' },
      { userId: adamUser.id, title: 'Fee Due Reminder', message: 'Your Science Lab Fee is due by March 31.', type: 'warning' },
      { userId: drsitiUser.id, title: 'Certification Expiring', message: 'Your Cambridge International Teaching Certificate expires on March 1, 2026.', type: 'warning' },
      { userId: teacher01User.id, title: 'CPD Reminder', message: 'You have completed 18/20 CPD hours. Complete 2 more hours before year end.', type: 'warning' },
      { userId: parent01User.id, title: 'Attendance Alert', message: 'Ahmad has 2 absences in the last 14 days. Please contact the school if needed.', type: 'warning' },
      { userId: adminUser.id, title: 'New Admissions', message: '11 new admission applications have been submitted and require review.', type: 'info' },
      { userId: farahUser.id, title: 'New Counselor Cases', message: 'You have 4 open counselor cases requiring attention.', type: 'warning' },
    ],
  })

  // ─── Fee Types ────────────────────────────────────────────────────────────

  for (const ft of [
    { code: 'TUITION',     name: 'Tuition Fee',     amount: 200, gradeLevel: 'Year 7', description: 'Academic instruction fee' },
    { code: 'ACTIVITY',    name: 'Activity Fee',    amount: 50,  gradeLevel: null as string | null, description: 'Co-curricular activities' },
    { code: 'LIBRARY',     name: 'Library Fee',     amount: 20,  gradeLevel: null as string | null, description: 'Library access and resources' },
    { code: 'EXAMINATION', name: 'Examination Fee', amount: 30,  gradeLevel: 'Year 7', description: 'Semester examination administration' },
  ]) {
    await prisma.feeType.upsert({ where: { code: ft.code }, create: ft, update: { amount: ft.amount } })
  }

  // Seed Adam's existing fee invoice as overdue with hold active (edge-case demo)
  const adamFeeInvoice = await prisma.feeInvoice.findFirst({ where: { studentId: adam.id } })
  if (adamFeeInvoice) {
    await prisma.feeInvoice.update({
      where: { id: adamFeeInvoice.id },
      data: { status: 'overdue', holdActive: true, holdReason: 'Payment overdue by 60+ days', dueDate: daysAgo(65) },
    })
  } else {
    // Create it if not present
    await prisma.feeInvoice.create({
      data: {
        studentId: adam.id,
        invoiceNumber: 'INV-2026-ADAM01',
        semester: '2025-S2',
        amount: 300,
        status: 'overdue',
        holdActive: true,
        holdReason: 'Payment overdue by 60+ days',
        dueDate: daysAgo(65),
        description: 'Year 7 Enrolment Fees — Semester 2 (OVERDUE)',
        lineItems: JSON.stringify([
          { code: 'TUITION', name: 'Tuition Fee', amount: 200 },
          { code: 'ACTIVITY', name: 'Activity Fee', amount: 50 },
          { code: 'LIBRARY', name: 'Library Fee', amount: 20 },
          { code: 'EXAMINATION', name: 'Examination Fee', amount: 30 },
        ]),
      },
    })
  }

  // ─── Class Rosters ────────────────────────────────────────────────────────

  const PROGRAMMES = { A: 'Academic', B: 'Academic', C: 'Academic', D: 'Academic', E: 'Academic',
                       F: 'Vocational', G: 'Vocational', H: 'Vocational', I: 'Vocational', J: 'Vocational',
                       K: 'Religious', L: 'Religious', M: 'Religious', N: 'Religious', O: 'Religious' }
  const CLASS_LETTERS_SEED = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']
  for (const yearLabel of ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12']) {
    const gradeNum = parseInt(yearLabel.replace('Year ', ''))
    for (const letter of CLASS_LETTERS_SEED) {
      // Year 7A is the demo focal class with capacity 35 (31 students, Ahmad adds 32nd)
      // All other classes have capacity 40 to reflect existing legacy distribution (~38-39 per class)
      const isDemoClass = (yearLabel === 'Year 7' && letter === 'A')
      await prisma.classRoster.upsert({
        where: { className_academicYear: { className: `${gradeNum}${letter}`, academicYear: '2025/2026' } },
        create: {
          gradeLevel: yearLabel,
          className: `${gradeNum}${letter}`,
          academicYear: '2025/2026',
          capacity: isDemoClass ? 35 : 40,
          programme: PROGRAMMES[letter as keyof typeof PROGRAMMES],
          formTeacherId: isDemoClass ? teacher01.id : undefined,
        },
        update: {},
      })
    }
  }

  // ─── Teacher Leave Balances ────────────────────────────────────────────────

  await prisma.teacher.update({ where: { id: teacher01.id }, data: { annualLeaveBalance: 14, medicalLeaveBalance: 14 } })

  // ─── Ahmad Academic Standing pre-seed ────────────────────────────────────

  await prisma.student.update({
    where: { id: ahmad.id },
    data: { academicStanding: 'ACADEMIC_WATCH', academicStandingUpdatedAt: daysAgo(7) },
  })
  await prisma.academicStandingHistory.create({
    data: {
      studentId: ahmad.id,
      previousStanding: 'GOOD_STANDING',
      newStanding: 'ACADEMIC_WATCH',
      trigger: 'GRADE_UPDATE',
      gradeAvg: 69.2,
      thresholdUsed: 60,
      createdAt: daysAgo(7),
    },
  })

  // ─── Aminah Expiring Certification ────────────────────────────────────────

  await prisma.certification.create({
    data: {
      teacherId: teacher01.id,
      name: 'First Aid & CPR Certificate',
      issuedBy: 'Red Crescent Society of Brunei',
      issuedDate: new Date('2023-06-01'),
      expiryDate: new Date(Date.now() + 45 * 24 * 3600 * 1000),  // expires in 45 days
      status: 'active',
    },
  })

  // ─── Hafiz Probation-Trigger Grade ────────────────────────────────────────

  // Find a math course for Hafiz's grade (Year 9)
  const hafizMathCourse = await prisma.course.findFirst({ where: { gradeLevel: 'Year 9' } })
    ?? await prisma.course.findFirst({ where: { code: 'MATH701' } })
  if (hafizMathCourse) {
    const hafizItem = await prisma.gradeItem.create({
      data: {
        courseId: hafizMathCourse.id,
        name: 'End of Year Mathematics Exam',
        type: 'exam',
        maxScore: 100,
        weight: 0.5,
        dueDate: daysAgo(20),
      },
    })
    const hafizEnrollment = await prisma.enrollment.findFirst({ where: { studentId: hafiz.id, courseId: hafizMathCourse.id } })
    if (hafizEnrollment) {
      await prisma.grade.upsert({
        where: { studentId_gradeItemId: { studentId: hafiz.id, gradeItemId: hafizItem.id } },
        create: { studentId: hafiz.id, gradeItemId: hafizItem.id, score: 42, letterGrade: 'F', gradedAt: daysAgo(14) },
        update: { score: 42, letterGrade: 'F' },
      })
    }
    await prisma.student.update({ where: { id: hafiz.id }, data: { academicStanding: 'PROBATION' } })
  }

  // ─── Approval Inbox pre-seeded items (for HOD demo) ───────────────────────

  // Sports equipment expense
  const sportsExpense = await prisma.schoolExpense.create({
    data: {
      category: 'supplies',
      description: 'Sports equipment for annual field day',
      amount: 1500,
      date: daysAgo(3),
      status: 'pending',
      submittedBy: adminUser.id,
    },
  })
  await prisma.approvalRequest.create({
    data: {
      entityType: 'SchoolExpense',
      entityId: sportsExpense.id,
      requestedBy: adminUser.id,
      currentLevel: 1,
      levelsRequired: 2,
      status: 'PENDING',
      metadata: JSON.stringify({ amount: 1500, description: 'Sports equipment for annual field day', category: 'supplies' }),
      createdAt: daysAgo(3),
    },
  })

  // Library shelving expense
  const libraryExpense = await prisma.schoolExpense.create({
    data: {
      category: 'supplies',
      description: 'Library shelving replacement — Block B',
      amount: 1200,
      date: daysAgo(2),
      status: 'pending',
      submittedBy: adminUser.id,
    },
  })
  await prisma.approvalRequest.create({
    data: {
      entityType: 'SchoolExpense',
      entityId: libraryExpense.id,
      requestedBy: adminUser.id,
      currentLevel: 1,
      levelsRequired: 1,
      status: 'PENDING',
      metadata: JSON.stringify({ amount: 1200, description: 'Library shelving replacement — Block B', category: 'supplies' }),
      createdAt: daysAgo(2),
    },
  })

  // ─── System Config ─────────────────────────────────────────────────────────

  const systemConfigs = [
    // SMTP (non-sensitive)
    { key: 'smtp_host', value: 'smtp.office365.com', description: 'SMTP server host' },
    { key: 'smtp_port', value: '587', description: 'SMTP server port' },
    { key: 'smtp_user', value: 'noreply@moe.edu.bn', description: 'SMTP username / sender address' },
    { key: 'smtp_from', value: 'MOE SERPS <noreply@moe.edu.bn>', description: 'Sender display name and address' },
    // AI (non-sensitive)
    { key: 'ai_enabled', value: 'true', description: 'AI features enabled' },
    { key: 'ai_provider', value: 'custom', description: 'AI provider (anthropic / openai / custom)' },
    { key: 'ai_model', value: 'deepseek-chat', description: 'AI model ID' },
    { key: 'ai_base_url', value: 'https://api.deepseek.com/v1', description: 'Custom API base URL' },
    { key: 'ai_temperature', value: '0.7', description: 'LLM temperature (0-1)' },
    { key: 'ai_max_tokens', value: '2048', description: 'Max tokens per response' },
    // Demo timing config
    { key: 'demo_attendance_push_delay', value: '30', description: 'Demo: attendance push notification delay (seconds)' },
    { key: 'demo_offer_letter_delivery', value: '5', description: 'Demo: offer letter delivery delay (seconds)' },
    { key: 'demo_timetable_gen_min', value: '12', description: 'Demo: timetable generation min time (seconds)' },
    { key: 'demo_timetable_gen_max', value: '15', description: 'Demo: timetable generation max time (seconds)' },
    { key: 'demo_risk_recalc_delay', value: '1500', description: 'Demo: risk recalculation delay (ms)' },
    // Operational thresholds (configurable via admin UI)
    { key: 'risk_threshold_high',          value: '0.7',  description: 'Risk score threshold for HIGH_RISK band' },
    { key: 'risk_threshold_monitor',       value: '0.4',  description: 'Risk score threshold for MONITOR band' },
    { key: 'cpd_annual_target',            value: '20',   description: 'CPD annual target hours for all teachers' },
    { key: 'class_capacity_max',           value: '35',   description: 'Hard cap — blocks new enrolment if reached' },
    { key: 'class_capacity_warning',       value: '32',   description: 'Class shows amber badge at this count' },
    { key: 'absence_counselor_threshold',  value: '5',    description: 'Rolling 14-day absences to open counselor case' },
    { key: 'absence_parent_threshold',     value: '3',    description: 'Absences in 14 days before parent notification' },
    { key: 'fee_hold_overdue_days',        value: '30',   description: 'Days overdue before fee hold activates' },
    { key: 'academic_watch_threshold',     value: '60',   description: 'Grade average below which = Academic Watch' },
    { key: 'academic_probation_threshold', value: '50',   description: 'Grade average below which = Probation' },
  ]

  for (const cfg of systemConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      create: cfg,
      update: { value: cfg.value, description: cfg.description },
    })
  }

  // ─── CPD Workshops ────────────────────────────────────────────────────────
  // Seeded for demo: 6 open workshops, filtered to teacher subjects

  const futureDate = (daysFromNow: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    return d
  }

  await prisma.cpdWorkshop.createMany({
    data: [
      {
        title: 'Digital Pedagogy for Mathematics',
        provider: 'MOE Professional Development Centre',
        subject: 'Mathematics',
        hours: 4,
        startDate: futureDate(14),
        endDate: futureDate(14),
        location: 'Resource Centre, Block B',
        maxParticipants: 25,
        status: 'open',
      },
      {
        title: 'Inquiry-Based Science Teaching',
        provider: 'MOE Professional Development Centre',
        subject: 'Science',
        hours: 6,
        startDate: futureDate(21),
        endDate: futureDate(22),
        location: 'Science Lab Wing',
        maxParticipants: 20,
        status: 'open',
      },
      {
        title: 'Classroom Management & Student Engagement',
        provider: 'Universiti Brunei Darussalam',
        subject: 'General',
        hours: 3,
        startDate: futureDate(10),
        endDate: futureDate(10),
        location: 'UBD Main Campus',
        maxParticipants: 40,
        status: 'open',
      },
      {
        title: 'Assessment for Learning: Formative Strategies',
        provider: 'MOE Professional Development Centre',
        subject: 'General',
        hours: 5,
        startDate: futureDate(28),
        endDate: futureDate(29),
        location: 'Resource Centre, Block A',
        maxParticipants: 30,
        status: 'open',
      },
      {
        title: 'Inclusive Education & SEN Strategies',
        provider: 'Brunei Darussalam National Institute of Education',
        subject: 'General',
        hours: 8,
        startDate: futureDate(35),
        endDate: futureDate(36),
        location: 'BDNIE Conference Hall',
        maxParticipants: 50,
        status: 'open',
      },
      {
        title: 'ICT Integration in the Secondary Classroom',
        provider: 'MOE ICT Division',
        subject: 'ICT',
        hours: 4,
        startDate: futureDate(18),
        endDate: futureDate(18),
        location: 'Computer Lab, Block C',
        maxParticipants: 20,
        status: 'open',
      },
    ],
  })

  console.log('  CPD Workshops seeded.')

  // ─── Final summary ────────────────────────────────────────────────────────

  console.log('\n✓ Seed completed successfully!')
  const userCount = await prisma.user.count()
  const studentCount = await prisma.student.count()
  const enrolledCount = await prisma.student.count({ where: { enrollmentStatus: 'enrolled' } })
  const y7aCount = await prisma.student.count({ where: { gradeLevel: 'Year 7', className: '7A', enrollmentStatus: 'enrolled' } })
  const teacherCount = await prisma.teacher.count()
  const parentCount = await prisma.parent.count()
  const enrollmentCount = await prisma.enrollment.count()
  const gradeItemCount = await prisma.gradeItem.count()
  const gradeCount = await prisma.grade.count()
  const sessionCount = await prisma.attendanceSession.count()
  const attendanceRecordCount = await prisma.attendanceRecord.count()
  const admissionCount = await prisma.admission.count()
  const feeInvoiceCount = await prisma.feeInvoice.count()
  const riskScoreCount = await prisma.riskScore.count()
  const counselorCaseCount = await prisma.counselorCase.count()
  const todayRecords = await prisma.attendanceRecord.count({ where: { sessionId: todaySession.id } })
  const todayPresent = await prisma.attendanceRecord.count({ where: { sessionId: todaySession.id, status: 'present' } })
  const todayAbsent = await prisma.attendanceRecord.count({ where: { sessionId: todaySession.id, status: 'absent' } })
  const todayLate = await prisma.attendanceRecord.count({ where: { sessionId: todaySession.id, status: 'late' } })
  const ahmadRisk = await prisma.riskScore.findFirst({ where: { studentId: ahmad.id } })
  const aminahTeacher = await prisma.teacher.findFirst({ where: { userId: teacher01User.id } })
  const hafizCheck = await prisma.student.findFirst({ where: { userId: hafizUser.id } })

  console.log('\n=== SPEC VERIFICATION ===')
  console.log(`  Total users:              ${userCount}`)
  console.log(`  Total students:           ${studentCount}`)
  console.log(`  Enrolled students:        ${enrolledCount}  [TARGET: 3,456]`)
  console.log(`  Year 7A enrolled:         ${y7aCount}       [TARGET: 31]`)
  console.log(`  Teachers:                 ${teacherCount}`)
  console.log(`  Parents:                  ${parentCount}`)
  console.log(`  Enrollments:              ${enrollmentCount}`)
  console.log(`  GradeItems:               ${gradeItemCount}`)
  console.log(`  Grades:                   ${gradeCount}`)
  console.log(`  AttendanceSessions:       ${sessionCount}`)
  console.log(`  AttendanceRecords:        ${attendanceRecordCount}`)
  console.log(`  Today's records:          ${todayRecords} [TARGET: 3,456]`)
  console.log(`    Present:                ${todayPresent}  [TARGET: 3,201]`)
  console.log(`    Absent:                 ${todayAbsent}  [TARGET: 156]`)
  console.log(`    Late:                   ${todayLate}   [TARGET: 99]`)
  console.log(`  Admissions:               ${admissionCount} [TARGET: 12]`)
  console.log(`  FeeInvoices:              ${feeInvoiceCount}`)
  console.log(`  RiskScores:               ${riskScoreCount}`)
  console.log(`  CounselorCases:           ${counselorCaseCount} [TARGET: 4]`)
  console.log(`  Ahmad risk score:         ${ahmadRisk?.score}  [TARGET: 0.21]`)
  console.log(`  Ahmad risk band:          ${ahmadRisk?.band}  [TARGET: LOW_RISK]`)
  console.log(`  Ahmad absences14d:        ${ahmadRisk?.absences14d}  [TARGET: 2]`)
  console.log(`  Ahmad gradeAvg:           ${ahmadRisk?.gradeAvg}  [TARGET: 78]`)
  console.log(`  Aminah CPD hours:         ${aminahTeacher?.cpdHours}  [TARGET: 18]`)
  console.log(`  Hafiz className:          ${hafizCheck?.className}  [TARGET: 9C]`)
  console.log(`  Hafiz gradeLevel:         ${hafizCheck?.gradeLevel}  [TARGET: Year 9]`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
