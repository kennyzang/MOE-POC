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

  // ─── Schools (create first so we can assign schoolId to users) ────────────

  const smhk = await prisma.school.create({
    data: {
      name: 'Sekolah Menengah Hj Kamaruddin',
      code: 'SMHK',
      authority: 'MOE',
      schoolType: 'secondary',
      address: 'Jalan Kota Batu, Bandar Seri Begawan, Brunei',
      phone: '+673-2234567',
      principal: 'Hjh Rashidah Binti Mohamad',
      gradeLevels: JSON.stringify(['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12']),
      programmes: JSON.stringify(['Academic', 'Science', 'Arts', 'Vocational']),
      classLetters: JSON.stringify(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']),
      establishedYear: 1978,
    },
  })

  const srpb = await prisma.school.create({
    data: {
      name: 'Sekolah Rendah Pusat Bandar',
      code: 'SRPB',
      authority: 'MOE',
      schoolType: 'primary',
      address: 'Jalan Sultan, Bandar Seri Begawan, Brunei',
      phone: '+673-2221234',
      principal: 'Pg Hajah Noraini Binti Pg Damit',
      gradeLevels: JSON.stringify(['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6']),
      programmes: JSON.stringify(['Standard']),
      classLetters: JSON.stringify(['A', 'B', 'C', 'D', 'E']),
      establishedYear: 1965,
    },
  })

  const smab = await prisma.school.create({
    data: {
      name: 'Sekolah Menengah Agama Berakas',
      code: 'SMAB',
      authority: 'MORA',
      schoolType: 'religious_secondary',
      address: 'Jalan Berakas, Brunei-Muara, Brunei',
      phone: '+673-2384567',
      principal: 'Ustaz Hj Mahyuddin Bin Hj Sarawak',
      gradeLevels: JSON.stringify(['Tingkatan 1', 'Tingkatan 2', 'Tingkatan 3', 'Tingkatan 4', 'Tingkatan 5']),
      programmes: JSON.stringify(['Academic', 'Religious']),
      classLetters: JSON.stringify(['Alif', 'Ba', 'Ta', 'Tha']),
      establishedYear: 1985,
    },
  })

  const isb = await prisma.school.create({
    data: {
      name: 'International School of Brunei',
      code: 'ISB',
      authority: 'PRIVATE',
      schoolType: 'secondary',
      address: 'Jalan Tungku Link, Gadong, Brunei',
      phone: '+673-2421000',
      principal: 'Ms. Eleanor Whitfield',
      gradeLevels: JSON.stringify(['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']),
      programmes: JSON.stringify(['IB', 'Cambridge', 'National']),
      classLetters: JSON.stringify(['Alpha', 'Beta', 'Gamma', 'Delta']),
      establishedYear: 1994,
    },
  })

  // ─── System Admin (no school — cross-school access) ───────────────────────

  await prisma.user.create({
    data: { username: 'sysadmin', password: hash('sysadmin123'), displayName: 'System Administrator', email: 'sysadmin@moe.gov.bn', role: 'admin', systemAdmin: true },
  })

  // ─── Named users (SMHK school) ────────────────────────────────────────────

  const adminUser = await prisma.user.create({
    data: { username: 'admin', password: hash('admin123'), displayName: 'SMHK Admin', email: 'admin@smhk.edu.bn', role: 'admin', schoolId: smhk.id },
  })

  const principalUser = await prisma.user.create({
    data: { username: 'principal', password: hash('principal123'), displayName: 'Hjh Rashidah Binti Mohamad', email: 'principal@smhk.edu.bn', role: 'principal', schoolId: smhk.id },
  })

  const hodUser = await prisma.user.create({
    data: { username: 'hod01', password: hash('hod123'), displayName: 'Dr. Azman Bin Ishak', email: 'azman@smhk.edu.bn', role: 'hod', schoolId: smhk.id },
  })

  await prisma.user.create({
    data: { username: 'manager', password: hash('Demo@2026'), displayName: 'Hj Kamaruddin', email: 'kamaruddin@smhk.edu.bn', role: 'manager', schoolId: smhk.id },
  })

  await prisma.user.create({
    data: { username: 'finance', password: hash('finance123'), displayName: 'Finance Officer', email: 'finance@smhk.edu.bn', role: 'finance', schoolId: smhk.id },
  })

  await prisma.user.create({
    data: { username: 'admission', password: hash('admission123'), displayName: 'Cik Nurul Binti Ali', email: 'admission@smhk.edu.bn', role: 'admissions', schoolId: smhk.id },
  })

  await prisma.user.create({
    data: { username: 'admissions', password: hash('Demo@2026'), displayName: 'Admissions Officer', email: 'admissions@smhk.edu.bn', role: 'admissions', schoolId: smhk.id },
  })

  // Teachers
  const drsitiUser = await prisma.user.create({
    data: { username: 'drsiti', password: hash('Demo@2026'), displayName: 'Dr. Siti Nurhaliza', email: 'siti@smhk.edu.bn', role: 'teacher', schoolId: smhk.id },
  })

  const faizalUser = await prisma.user.create({
    data: { username: 'faizal', password: hash('Demo@2026'), displayName: 'Mohd Faizal Bin Aziz', email: 'faizal@smhk.edu.bn', role: 'teacher', schoolId: smhk.id },
  })

  // teacher01 = Ms. Aminah (CPD 18h)
  const teacher01User = await prisma.user.create({
    data: { username: 'teacher01', password: hash('teacher123'), displayName: 'Ms. Aminah Binti Hassan', email: 'aminah@smhk.edu.bn', role: 'teacher', schoolId: smhk.id },
  })

  // Counselor - Ms. Farah
  const farahUser = await prisma.user.create({
    data: { username: 'farah', password: hash('Demo@2026'), displayName: 'Ms. Farah Binti Aziz', email: 'farah@smhk.edu.bn', role: 'counselor', schoolId: smhk.id },
  })

  // Demo script personas — matches MOE_SERPS_POC_Demo_v3 run book accounts
  const sitiUser = await prisma.user.create({
    data: { username: 'parent.siti', password: hash('Demo@2026'), displayName: 'Mrs. Siti Binti Mohamed', email: 'siti.mohamed@gmail.com', role: 'parent', schoolId: smhk.id },
  })

  const ridwanUser = await prisma.user.create({
    data: { username: 'teacher.ridwan', password: hash('Demo@2026'), displayName: 'Mr. Ridwan Bin Jamal', email: 'ridwan@smhk.edu.bn', role: 'teacher', schoolId: smhk.id },
  })

  // Students (SMHK)
  const student001User = await prisma.user.create({
    data: { username: 'student001', password: hash('student123'), displayName: 'Ahmad Bin Abdullah', email: 'ahmad@student.smhk.edu.bn', role: 'student', schoolId: smhk.id },
  })

  const adamUser = await prisma.user.create({
    data: { username: 'adam', password: hash('Demo@2026'), displayName: 'Adam Bin Haris', email: 'adam@student.smhk.edu.bn', role: 'student', schoolId: smhk.id },
  })

  const nurulUser = await prisma.user.create({
    data: { username: 'nurul', password: hash('Demo@2026'), displayName: 'Nurul Binti Rahman', email: 'nurul@student.smhk.edu.bn', role: 'student', schoolId: smhk.id },
  })

  // Year 9-12 named student users
  const fatinUser = await prisma.user.create({
    data: { username: 'fatin', password: hash('Demo@2026'), displayName: 'Fatin Binti Mohd Noor', email: 'fatin@student.smhk.edu.bn', role: 'student', schoolId: smhk.id },
  })
  const nadiaY10User = await prisma.user.create({
    data: { username: 'nadia_y10', password: hash('Demo@2026'), displayName: 'Nadia Binti Yusof', email: 'nadia.y10@student.smhk.edu.bn', role: 'student', schoolId: smhk.id },
  })
  const hanaY11User = await prisma.user.create({
    data: { username: 'hana_y11', password: hash('Demo@2026'), displayName: 'Hana Binti Ibrahim', email: 'hana.y11@student.smhk.edu.bn', role: 'student', schoolId: smhk.id },
  })
  const danialY12User = await prisma.user.create({
    data: { username: 'danial_y12', password: hash('Demo@2026'), displayName: 'Danial Bin Ahmad', email: 'danial.y12@student.smhk.edu.bn', role: 'student', schoolId: smhk.id },
  })

  // Year 9-12 specialist teachers
  const hassanUser = await prisma.user.create({
    data: { username: 'hassan', password: hash('Demo@2026'), displayName: 'Mr. Hassan Bin Razak', email: 'hassan@smhk.edu.bn', role: 'teacher', schoolId: smhk.id },
  })
  const zuraidahUser = await prisma.user.create({
    data: { username: 'zuraidah', password: hash('Demo@2026'), displayName: 'Ms. Zuraidah Binti Hamid', email: 'zuraidah@smhk.edu.bn', role: 'teacher', schoolId: smhk.id },
  })

  // Parents
  const parent01User = await prisma.user.create({
    data: { username: 'parent01', password: hash('parent123'), displayName: 'Hj Abdullah Bin Mahmud', email: 'abdullah@email.com', role: 'parent', schoolId: smhk.id },
  })

  const fatimahUser = await prisma.user.create({
    data: { username: 'fatimah', password: hash('Demo@2026'), displayName: 'Fatimah Binti Yusof', email: 'fatimah@parent.moe.edu.bn', role: 'parent' },
  })

  // ─── Teacher records ──────────────────────────────────────────────────────

  const drsiti = await prisma.teacher.create({
    data: { userId: drsitiUser.id, staffId: 'T2026001', designation: 'Senior Teacher', department: 'Science & Mathematics', qualification: 'PhD in Education', subjects: 'Mathematics,Physics', joinDate: new Date('2020-01-15'), cpdHours: 25, cpdTarget: 20, employmentStatus: 'active', schoolId: smhk.id },
  })

  const faizal = await prisma.teacher.create({
    data: { userId: faizalUser.id, staffId: 'T2026002', designation: 'Teacher', department: 'Languages', qualification: 'Masters in English Literature', subjects: 'English,Bahasa Melayu', joinDate: new Date('2021-06-01'), cpdHours: 12, cpdTarget: 20, employmentStatus: 'onLeave', schoolId: smhk.id },
  })

  const teacher01 = await prisma.teacher.create({
    data: { userId: teacher01User.id, staffId: 'T2026003', designation: 'Teacher', department: 'Science & Mathematics', qualification: 'BSc Mathematics, Universiti Brunei Darussalam', subjects: 'Mathematics,Science', joinDate: new Date('2018-08-01'), cpdHours: 18, cpdTarget: 20, employmentStatus: 'active', schoolId: smhk.id },
  })

  const ridwan = await prisma.teacher.create({
    data: { userId: ridwanUser.id, staffId: 'T2026004', designation: 'Teacher', department: 'Science & Mathematics', qualification: 'BSc Mathematics, Universiti Teknologi Brunei', subjects: 'Mathematics,Science', joinDate: new Date('2022-01-10'), cpdHours: 14, cpdTarget: 20, employmentStatus: 'active', schoolId: smhk.id },
  })

  const hassan = await prisma.teacher.create({
    data: { userId: hassanUser.id, staffId: 'T2026005', designation: 'Teacher', department: 'Science & Mathematics', qualification: 'BSc Biology, Universiti Brunei Darussalam', subjects: 'Biology,Chemistry,Science', joinDate: new Date('2019-03-01'), cpdHours: 16, cpdTarget: 20, employmentStatus: 'active', schoolId: smhk.id },
  })

  const zuraidah = await prisma.teacher.create({
    data: { userId: zuraidahUser.id, staffId: 'T2026006', designation: 'Senior Teacher', department: 'Languages & Humanities', qualification: 'Masters in English Literature, University of Malaya', subjects: 'English,Literature', joinDate: new Date('2017-08-10'), cpdHours: 22, cpdTarget: 20, employmentStatus: 'active', schoolId: smhk.id },
  })

  // ─── Schools already created at top of main() ─────────────────────────────
  // smhk, srpb, smab, isb are available above

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

  // ─── Year 8-12 Courses ─────────────────────────────────────────────────────

  // Year 8
  const math8 = await prisma.course.create({ data: { code: 'MATH801', name: 'Mathematics Year 8', description: 'Algebra, geometry, and number theory', gradeLevel: 'Year 8', creditHours: 4 } })
  const eng8  = await prisma.course.create({ data: { code: 'ENG801',  name: 'English Language Year 8', description: 'Advanced reading, writing and communication', gradeLevel: 'Year 8', creditHours: 4 } })
  const sci8  = await prisma.course.create({ data: { code: 'SCI801',  name: 'Science Year 8', description: 'Physics, chemistry and biology foundations', gradeLevel: 'Year 8', creditHours: 3 } })
  const mib8  = await prisma.course.create({ data: { code: 'MIB801',  name: 'Melayu Islam Beraja Year 8', description: 'National philosophy — advanced civic studies', gradeLevel: 'Year 8', creditHours: 2 } })
  const ict8  = await prisma.course.create({ data: { code: 'ICT801',  name: 'ICT Year 8', description: 'Programming fundamentals and digital literacy', gradeLevel: 'Year 8', creditHours: 2 } })

  // Year 9
  const math9 = await prisma.course.create({ data: { code: 'MATH901', name: 'Mathematics Year 9', description: 'Advanced algebra, trigonometry and statistics', gradeLevel: 'Year 9', creditHours: 4 } })
  const eng9  = await prisma.course.create({ data: { code: 'ENG901',  name: 'English Language Year 9', description: 'Literature, critical writing and oral communication', gradeLevel: 'Year 9', creditHours: 4 } })
  const sci9  = await prisma.course.create({ data: { code: 'SCI901',  name: 'Science Year 9', description: 'Integrated sciences — motion, matter and energy', gradeLevel: 'Year 9', creditHours: 3 } })
  const mib9  = await prisma.course.create({ data: { code: 'MIB901',  name: 'Melayu Islam Beraja Year 9', description: 'National philosophy — advanced civic studies', gradeLevel: 'Year 9', creditHours: 2 } })
  const geog9 = await prisma.course.create({ data: { code: 'GEOG901', name: 'Geography Year 9', description: 'Physical and human geography — ASEAN focus', gradeLevel: 'Year 9', creditHours: 2 } })

  // Year 10
  const math10    = await prisma.course.create({ data: { code: 'MATH1001',    name: 'Mathematics Year 10', description: 'O-Level Mathematics — calculus, vectors, and proof', gradeLevel: 'Year 10', creditHours: 4 } })
  const addMath10 = await prisma.course.create({ data: { code: 'AMATH1001',   name: 'Additional Mathematics Year 10', description: 'Advanced mathematics for science stream students', gradeLevel: 'Year 10', creditHours: 3 } })
  const phy10     = await prisma.course.create({ data: { code: 'PHY1001',     name: 'Physics Year 10', description: 'Mechanics, thermodynamics and electromagnetism', gradeLevel: 'Year 10', creditHours: 3 } })
  const chem10    = await prisma.course.create({ data: { code: 'CHEM1001',    name: 'Chemistry Year 10', description: 'Atomic structure, bonding and chemical reactions', gradeLevel: 'Year 10', creditHours: 3 } })
  const bio10     = await prisma.course.create({ data: { code: 'BIO1001',     name: 'Biology Year 10', description: 'Cell biology, genetics and ecology', gradeLevel: 'Year 10', creditHours: 3 } })
  const eng10     = await prisma.course.create({ data: { code: 'ENG1001',     name: 'English Language & Literature Year 10', description: 'Analytical writing, poetry and prose', gradeLevel: 'Year 10', creditHours: 3 } })

  // Year 11
  const math11    = await prisma.course.create({ data: { code: 'MATH1101',    name: 'Mathematics Year 11', description: 'O-Level final year — integration, statistics, proof', gradeLevel: 'Year 11', creditHours: 4 } })
  const addMath11 = await prisma.course.create({ data: { code: 'AMATH1101',   name: 'Additional Mathematics Year 11', description: 'Advanced O-Level — differential equations and matrices', gradeLevel: 'Year 11', creditHours: 3 } })
  const phy11     = await prisma.course.create({ data: { code: 'PHY1101',     name: 'Physics Year 11', description: 'Advanced mechanics, nuclear physics and waves', gradeLevel: 'Year 11', creditHours: 3 } })
  const chem11    = await prisma.course.create({ data: { code: 'CHEM1101',    name: 'Chemistry Year 11', description: 'Organic chemistry, equilibrium and electrochemistry', gradeLevel: 'Year 11', creditHours: 3 } })
  const bio11     = await prisma.course.create({ data: { code: 'BIO1101',     name: 'Biology Year 11', description: 'Human biology, evolution and ecosystems', gradeLevel: 'Year 11', creditHours: 3 } })
  const eng11     = await prisma.course.create({ data: { code: 'ENG1101',     name: 'English Literature Year 11', description: 'Shakespearean drama, modern poetry and critical analysis', gradeLevel: 'Year 11', creditHours: 3 } })

  // Year 12
  const math12    = await prisma.course.create({ data: { code: 'MATH1201',    name: 'Mathematics Year 12', description: 'A-Level Mathematics — complex numbers and sequences', gradeLevel: 'Year 12', creditHours: 4 } })
  const addMath12 = await prisma.course.create({ data: { code: 'AMATH1201',   name: 'Further Mathematics Year 12', description: 'A-Level Further Mathematics — matrices and differential equations', gradeLevel: 'Year 12', creditHours: 3 } })
  const phy12     = await prisma.course.create({ data: { code: 'PHY1201',     name: 'Physics Year 12', description: 'A-Level Physics — quantum mechanics and particle physics', gradeLevel: 'Year 12', creditHours: 3 } })
  const chem12    = await prisma.course.create({ data: { code: 'CHEM1201',    name: 'Chemistry Year 12', description: 'A-Level Chemistry — reaction mechanisms and spectroscopy', gradeLevel: 'Year 12', creditHours: 3 } })
  const bio12     = await prisma.course.create({ data: { code: 'BIO1201',     name: 'Biology Year 12', description: 'A-Level Biology — molecular biology and genetics', gradeLevel: 'Year 12', creditHours: 3 } })
  const eng12     = await prisma.course.create({ data: { code: 'ENG1201',     name: 'English Language & Literature Year 12', description: 'A-Level — comparative literature and critical essay', gradeLevel: 'Year 12', creditHours: 3 } })

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

  await prisma.courseAssignment.createMany({
    data: [
      // Year 8
      { courseId: math8.id, teacherId: teacher01.id, semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30' },
      { courseId: eng8.id,  teacherId: faizal.id,    semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30' },
      { courseId: sci8.id,  teacherId: hassan.id,    semester: '2026-S1', schedule: 'Mon/Wed 10:00-11:30' },
      { courseId: mib8.id,  teacherId: faizal.id,    semester: '2026-S1', schedule: 'Fri 08:00-10:00' },
      { courseId: ict8.id,  teacherId: drsiti.id,    semester: '2026-S1', schedule: 'Fri 10:00-12:00' },
      // Year 9
      { courseId: math9.id, teacherId: drsiti.id,    semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30' },
      { courseId: eng9.id,  teacherId: zuraidah.id,  semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30' },
      { courseId: sci9.id,  teacherId: hassan.id,    semester: '2026-S1', schedule: 'Mon/Wed 10:00-11:30' },
      { courseId: mib9.id,  teacherId: faizal.id,    semester: '2026-S1', schedule: 'Fri 08:00-10:00' },
      { courseId: geog9.id, teacherId: ridwan.id,    semester: '2026-S1', schedule: 'Fri 10:00-12:00' },
      // Year 10
      { courseId: math10.id,    teacherId: teacher01.id, semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30' },
      { courseId: addMath10.id, teacherId: drsiti.id,    semester: '2026-S1', schedule: 'Tue/Thu 10:00-11:30' },
      { courseId: phy10.id,     teacherId: drsiti.id,    semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30' },
      { courseId: chem10.id,    teacherId: hassan.id,    semester: '2026-S1', schedule: 'Mon/Wed 10:00-11:30' },
      { courseId: bio10.id,     teacherId: hassan.id,    semester: '2026-S1', schedule: 'Fri 08:00-10:00' },
      { courseId: eng10.id,     teacherId: zuraidah.id,  semester: '2026-S1', schedule: 'Fri 10:00-12:00' },
      // Year 11
      { courseId: math11.id,    teacherId: teacher01.id, semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30' },
      { courseId: addMath11.id, teacherId: drsiti.id,    semester: '2026-S1', schedule: 'Tue/Thu 10:00-11:30' },
      { courseId: phy11.id,     teacherId: drsiti.id,    semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30' },
      { courseId: chem11.id,    teacherId: hassan.id,    semester: '2026-S1', schedule: 'Mon/Wed 10:00-11:30' },
      { courseId: bio11.id,     teacherId: hassan.id,    semester: '2026-S1', schedule: 'Fri 08:00-10:00' },
      { courseId: eng11.id,     teacherId: zuraidah.id,  semester: '2026-S1', schedule: 'Fri 10:00-12:00' },
      // Year 12
      { courseId: math12.id,    teacherId: drsiti.id,    semester: '2026-S1', schedule: 'Mon/Wed 08:00-09:30' },
      { courseId: addMath12.id, teacherId: drsiti.id,    semester: '2026-S1', schedule: 'Tue/Thu 10:00-11:30' },
      { courseId: phy12.id,     teacherId: drsiti.id,    semester: '2026-S1', schedule: 'Tue/Thu 08:00-09:30' },
      { courseId: chem12.id,    teacherId: hassan.id,    semester: '2026-S1', schedule: 'Mon/Wed 10:00-11:30' },
      { courseId: bio12.id,     teacherId: hassan.id,    semester: '2026-S1', schedule: 'Fri 08:00-10:00' },
      { courseId: eng12.id,     teacherId: zuraidah.id,  semester: '2026-S1', schedule: 'Fri 10:00-12:00' },
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

  // Year 9-12 named students (one per focal class; bulk counts reduced accordingly)
  const fatin = await prisma.student.create({
    data: {
      userId: fatinUser.id,
      studentId: 'STU9A00001',
      dateOfBirth: new Date('2012-05-20'),
      gender: 'Female',
      nationality: 'Bruneian',
      gradeLevel: 'Year 9',
      className: '9A',
      enrollmentStatus: 'enrolled',
      academicStanding: 'GOOD_STANDING',
    },
  })

  const nadia = await prisma.student.create({
    data: {
      userId: nadiaY10User.id,
      studentId: 'STU10A00001',
      dateOfBirth: new Date('2011-02-14'),
      gender: 'Female',
      nationality: 'Bruneian',
      gradeLevel: 'Year 10',
      className: '10A',
      enrollmentStatus: 'enrolled',
      academicStanding: 'GOOD_STANDING',
    },
  })

  const hana = await prisma.student.create({
    data: {
      userId: hanaY11User.id,
      studentId: 'STU11A00001',
      dateOfBirth: new Date('2010-09-08'),
      gender: 'Female',
      nationality: 'Bruneian',
      gradeLevel: 'Year 11',
      className: '11A',
      enrollmentStatus: 'enrolled',
      academicStanding: 'GOOD_STANDING',
    },
  })

  const danial = await prisma.student.create({
    data: {
      userId: danialY12User.id,
      studentId: 'STU12A00001',
      dateOfBirth: new Date('2009-11-30'),
      gender: 'Male',
      nationality: 'Bruneian',
      gradeLevel: 'Year 12',
      className: '12A',
      enrollmentStatus: 'enrolled',
      academicStanding: 'GOOD_STANDING',
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
      // Reduce bulk count for classes that already have a named student
      const isNamedStudentClass =
        (isYear9 && letter === 'C') ||                   // Hafiz
        (isYear9 && letter === 'A') ||                   // Fatin
        (year === 'Year 10' && letter === 'A') ||        // Nadia
        (year === 'Year 11' && letter === 'A') ||        // Hana
        (year === 'Year 12' && letter === 'A')           // Danial
      const baseCount = ci < extras ? basePerClass + 1 : basePerClass
      const count = isNamedStudentClass ? baseCount - 1 : baseCount
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

  // Demo script parent — Mrs. Siti Binti Mohamed, mother of Ahmad and Hafiz
  const sitiParent = await prisma.parent.create({
    data: { userId: sitiUser.id, phone: '+673 8123 4567', occupation: 'Nurse', relationship: 'mother' },
  })

  await prisma.parentStudent.createMany({
    data: [
      { parentId: sitiParent.id, studentId: ahmad.id },
      { parentId: sitiParent.id, studentId: hafiz.id },
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

  // ─── Enroll bulk 7A students in MATH701 and SCI701 ────────────────────────
  // This gives the form teacher's mark modal all 31 students (not just 3 named ones)
  if (y7aExtraIds.length > 0) {
    const bulkEnrollData = y7aExtraIds.flatMap((sid) => [
      { studentId: sid, courseId: mathCourse.id, semester: '2026-S1' },
      { studentId: sid, courseId: sciCourse.id, semester: '2026-S1' },
    ])
    for (const enr of bulkEnrollData) {
      await prisma.enrollment.create({ data: enr })
    }
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

  const ahmadAttendancePlan: { day: number; status: string; reason?: string }[] = [
    { day: 63, status: 'present' },
    { day: 56, status: 'late',    reason: 'Traffic delay' },
    { day: 49, status: 'excused', reason: 'Medical appointment' },
    { day: 42, status: 'present' },
    { day: 35, status: 'late',    reason: 'Bus delay' },
    { day: 28, status: 'present' },
    { day: 21, status: 'present' },
    { day: 10, status: 'absent',  reason: 'Sick' },         // ABSENT within 14 days
    { day: 6,  status: 'absent',  reason: 'Unexplained' },  // ABSENT within 14 days
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
        absenceReason: plan.reason ?? null,
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

  // ─── Add attendance records for bulk 7A students in existing sessions ─────
  // Now that bulk students are enrolled in MATH701 and SCI701, add realistic
  // attendance records for each existing session so that session totals reflect
  // the full class size.
  if (y7aExtraIds.length > 0) {
    const bulkStatuses = ['present', 'present', 'present', 'present', 'present', 'present', 'late', 'absent']
    const math701Sessions = await prisma.attendanceSession.findMany({
      where: { courseId: mathCourse.id, status: 'completed' },
      orderBy: { date: 'asc' },
    })
    for (let si = 0; si < math701Sessions.length; si++) {
      const sess = math701Sessions[si]
      for (let i = 0; i < y7aExtraIds.length; i++) {
        const st = bulkStatuses[(i + si * 3) % bulkStatuses.length]
        await prisma.attendanceRecord.create({
          data: {
            sessionId: sess.id,
            studentId: y7aExtraIds[i],
            status: st,
            checkedInAt: st !== 'absent' ? new Date(sess.date) : null,
          },
        })
      }
    }
    const sci701Sessions = await prisma.attendanceSession.findMany({
      where: { courseId: sciCourse.id, status: 'completed' },
      orderBy: { date: 'asc' },
    })
    for (let si = 0; si < sci701Sessions.length; si++) {
      const sess = sci701Sessions[si]
      for (let i = 0; i < y7aExtraIds.length; i++) {
        const st = bulkStatuses[(i + si * 5) % bulkStatuses.length]
        await prisma.attendanceRecord.create({
          data: {
            sessionId: sess.id,
            studentId: y7aExtraIds[i],
            status: st,
            checkedInAt: st !== 'absent' ? new Date(sess.date) : null,
          },
        })
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
  // Demo script requires Ahmad at HIGH RISK 82% — "60% attendance, declining grades"

  await prisma.riskScore.create({
    data: {
      studentId: ahmad.id,
      score: 0.82,
      band: 'HIGH_RISK',
      absences14d: 22,
      gradeAvg: 45,
      gradeTrend: -8.0,
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
    const cc = await prisma.counselorCase.create({
      data: {
        studentId: counselorStudents[i],
        counselorUserId: farahUser.id,
        openedReason: caseReasons[i],
        status: caseStatuses[i],
        notes: caseNotes[i],
        openedAt: daysAgo(14 - i * 3),
      },
    })

    // Case 0 (OPEN, risk threshold): 2 interventions assigned, no evidence yet
    if (i === 0) {
      await prisma.counselorCaseActionItem.createMany({
        data: [
          { caseId: cc.id, category: 'Academic', title: 'Schedule initial assessment session with student', description: 'Conduct a 1-on-1 session to assess academic and social-emotional factors contributing to high risk score.', assignedTo: 'Ms. Farah (Counselor)', dueDate: daysAgo(-3), status: 'IN_PROGRESS', createdByUserId: farahUser.id },
          { caseId: cc.id, category: 'Family', title: 'Contact parent/guardian for situation update', description: 'Phone or email parent to discuss student\'s recent performance and risk indicators.', assignedTo: 'Ms. Farah (Counselor)', dueDate: daysAgo(-7), status: 'OPEN', createdByUserId: farahUser.id },
        ],
      })
    }

    // Case 1 (IN_PROGRESS, absence): has interventions in progress + one session note
    if (i === 1) {
      await prisma.counselorCaseActionItem.createMany({
        data: [
          { caseId: cc.id, category: 'Attendance', title: 'Conduct weekly attendance check-in for 4 weeks', description: 'Meet student each Monday to review attendance and address any barriers to attending school.', assignedTo: 'Ms. Farah (Counselor)', dueDate: daysAgo(-5), status: 'IN_PROGRESS', createdByUserId: farahUser.id },
          { caseId: cc.id, category: 'Family', title: 'Refer to Student Welfare Officer if absences continue', description: 'If absence rate does not improve within 2 weeks, escalate to Student Welfare Officer.', assignedTo: 'Student Welfare Officer', dueDate: daysAgo(-10), status: 'OPEN', createdByUserId: farahUser.id },
        ],
      })
      await prisma.counselorCaseEvidence.create({
        data: { caseId: cc.id, fileName: 'Session-Notes-Week1-Attendance.pdf', filePath: `/evidence/cases/${cc.id}/Session-Notes-Week1-Attendance.pdf`, fileType: 'Session Notes', description: 'Written notes from first attendance counseling session', uploadedByUserId: farahUser.id },
      })
    }

    // Case 2 (OPEN, teacher referral): 1 intervention, no evidence
    if (i === 2) {
      await prisma.counselorCaseActionItem.create({
        data: { caseId: cc.id, category: 'Behaviour', title: 'Gather behavioural report from referring teacher', description: 'Request written incident/observation report from the teacher who made the referral. Use Form COU-01.', assignedTo: 'Form Teacher', dueDate: daysAgo(-5), status: 'OPEN', createdByUserId: farahUser.id },
      })
    }

    // Case 3 (OPEN, risk threshold): newly opened, no interventions yet
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
      guardianUserId: sitiUser.id,
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
      selfAssessment: 'This year I have focused on improving my questioning techniques in classroom discussions. I incorporated more Socratic questioning in my Year 7 and Year 8 classes, which I believe has improved student engagement and critical thinking. I completed 18 CPD hours including the Digital Pedagogy workshop in March. For improvement, I aim to incorporate more differentiated assessment methods to better cater to diverse learners in my classes. I also plan to complete the remaining 2 CPD hours before the year-end deadline.',
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
      selfAssessment: 'I believe I have performed strongly this academic year. As Head of Department, I supported three younger colleagues in developing their lesson plans and assessment strategies. In my own classes, I introduced project-based learning for the Year 9 and Year 10 ICT curriculum, resulting in noticeably improved student motivation. I have completed all 20 required CPD hours and attended the national STEM conference in April as a presenter. I aim to continue mentoring junior teachers and lead the department curriculum review scheduled for Term 3.',
      status: 'approved',
      submittedAt: daysAgo(20),
      reviewerId: principalUser.id,
      reviewerComments: 'Approved. Excellent performance.',
      reviewedAt: daysAgo(15),
    },
  })

  await prisma.performanceEvaluation.create({
    data: {
      teacherId: faizal.id,
      academicYear: '2025/2026',
      evaluatorId: hodUser.id,
      teachingScore: 75,
      professionalScore: 72,
      conductScore: 80,
      overallScore: 75.7,
      rating: 'Satisfactory',
      comments: 'Mr. Faizal shows dedication but requires improvement in lesson pacing. Recommend completing the Classroom Management CPD module.',
      selfAssessment: 'I acknowledge areas for growth in my teaching practice this year. I have worked to improve my lesson delivery by attending two CPD sessions on active learning strategies. I found the smaller Year 7 classes easier to manage; the larger Year 9 classes remain a challenge. I plan to complete the Classroom Management CPD module recommended by the HOD and apply those techniques from Term 3 onward.',
      status: 'submitted',
      submittedAt: daysAgo(12),
    },
  })

  await prisma.performanceEvaluation.create({
    data: {
      teacherId: ridwan.id,
      academicYear: '2025/2026',
      evaluatorId: hodUser.id,
      teachingScore: 88,
      professionalScore: 85,
      conductScore: 90,
      overallScore: 87.7,
      rating: 'Good',
      comments: 'Mr. Ridwan is a reliable and effective teacher. His Year 10 students consistently perform well in assessments.',
      selfAssessment: "I am satisfied with my performance this year. My Year 10 Mathematics class achieved a class average of 78% in the mid-term assessment. I have completed 19 of 20 CPD hours. I participated in the inter-school Mathematics competition as a coach, which was rewarding. I intend to explore more technology-integrated lessons using the school's iPads next semester.",
      status: 'draft',
    },
  })

  await prisma.performanceEvaluation.create({
    data: {
      teacherId: hassan.id,
      academicYear: '2025/2026',
      evaluatorId: hodUser.id,
      teachingScore: 70,
      professionalScore: 68,
      conductScore: 78,
      overallScore: 72.0,
      rating: 'Satisfactory',
      comments: 'Mr. Hassan needs to improve CPD hours (currently at 12/20). Lesson objectives could be more clearly stated.',
      selfAssessment: 'This academic year has been challenging but I have maintained my commitment to my students. I completed 12 CPD hours and plan to attend two more workshops before the deadline. I will work on making my lesson objectives more explicit, as noted in the evaluation feedback.',
      status: 'submitted',
      submittedAt: daysAgo(3),
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

  // Year 8A timetable
  const y8aSlots = [
    { courseId: math8.id, teacherId: teacher01.id, dayOfWeek: 1, startTime: '10:00', endTime: '11:30', room: 'Classroom 8A' },
    { courseId: math8.id, teacherId: teacher01.id, dayOfWeek: 3, startTime: '10:00', endTime: '11:30', room: 'Classroom 8A' },
    { courseId: sci8.id,  teacherId: hassan.id,    dayOfWeek: 0, startTime: '10:00', endTime: '11:30', room: 'Science Lab 1' },
    { courseId: sci8.id,  teacherId: hassan.id,    dayOfWeek: 2, startTime: '10:00', endTime: '11:30', room: 'Science Lab 1' },
    { courseId: eng8.id,  teacherId: faizal.id,    dayOfWeek: 0, startTime: '13:00', endTime: '14:30', room: 'Classroom 8A' },
    { courseId: eng8.id,  teacherId: faizal.id,    dayOfWeek: 2, startTime: '13:00', endTime: '14:30', room: 'Classroom 8A' },
    { courseId: mib8.id,  teacherId: faizal.id,    dayOfWeek: 4, startTime: '08:00', endTime: '09:30', room: 'Classroom 8A' },
    { courseId: ict8.id,  teacherId: drsiti.id,    dayOfWeek: 4, startTime: '10:00', endTime: '11:30', room: 'Computer Lab' },
  ]
  for (const slot of y8aSlots) {
    await prisma.timetableSlot.create({ data: { ...slot, gradeLevel: 'Year 8', className: '8A', semester: '2026-S1' } })
  }

  // ─── Facility Bookings ────────────────────────────────────────────────────

  const facilities = await prisma.facility.findMany()
  const hallA = facilities.find(f => f.name === 'Hall A')
  const sciLab = facilities.find(f => f.name === 'Science Lab 1')
  const compLab = facilities.find(f => f.name === 'Computer Lab')

  if (hallA) {
    await prisma.facilityBooking.createMany({
      data: [
        // Past booking (9 June = 2 days before demo)
        { facilityId: hallA.id, bookedBy: principalUser.id, purpose: 'Year 7 Mid-Semester Assembly', date: new Date('2026-06-09'), startTime: '09:00', endTime: '11:00', status: 'approved' },
        // Today's booking (11 June = demo day)
        { facilityId: hallA.id, bookedBy: principalUser.id, purpose: 'Staff Briefing — Semester 2 Planning', date: new Date('2026-06-11'), startTime: '14:00', endTime: '16:00', status: 'approved' },
      ],
    })
  }
  if (sciLab) {
    await prisma.facilityBooking.createMany({
      data: [
        { facilityId: sciLab.id, bookedBy: drsitiUser.id, purpose: 'Chemistry Practical - Year 9', date: new Date('2026-05-27'), startTime: '14:00', endTime: '16:00', status: 'approved' },
        // 18 June (Thu) = upcoming working day in Brunei
        { facilityId: sciLab.id, bookedBy: teacher01User.id, purpose: 'Science Fair Preparation - Year 7', date: new Date('2026-06-18'), startTime: '13:00', endTime: '15:00', status: 'pending' },
      ],
    })
  }
  if (compLab) {
    // 16 June (Tue) = upcoming working day in Brunei
    await prisma.facilityBooking.create({
      data: { facilityId: compLab.id, bookedBy: drsitiUser.id, purpose: 'ICT Examination - Year 11', date: new Date('2026-06-16'), startTime: '08:00', endTime: '10:00', status: 'approved' },
    })
  }

  // ─── School Calendar Events ────────────────────────────────────────────────

  const schoolEvents = [
    { title: 'Mid-Term Examinations', date: new Date('2026-05-20'), endDate: new Date('2026-05-22'), type: 'exam', description: 'Year 7-12 mid-term examinations' },
    { title: 'Science Fair', date: new Date('2026-05-28'), type: 'activity', description: 'Students present science projects to judges and parents' },
    // Sports Day on Thu 4 June — last working day before weekend (Fri-Sat = weekend in Brunei)
    { title: 'Sports Day', date: new Date('2026-06-04'), type: 'activity', description: 'Annual school sports day — all students participate' },
    { title: 'Hari Raya Aidiladha', date: new Date('2026-06-07'), endDate: new Date('2026-06-08'), type: 'holiday', description: 'Public holiday — school closed' },
    // School Open Day on Wed 10 June — yesterday before demo
    { title: 'School Open Day', date: new Date('2026-06-10'), type: 'event', description: 'Annual school open day for parents and prospective students' },
    { title: 'Year 9-10 Mock Examinations', date: new Date('2026-06-22'), endDate: new Date('2026-06-24'), type: 'exam', description: 'Mid-year mock examinations for Year 9 and Year 10 students' },
    // Parent-Teacher Meeting on Mon 22 June — working day (Sun-Thu week in Brunei)
    { title: 'Parent-Teacher Meeting', date: new Date('2026-06-29'), type: 'event', description: 'Semester 1 progress review with parents' },
    { title: 'Final Examinations Begin', date: new Date('2026-07-06'), endDate: new Date('2026-07-17'), type: 'exam', description: 'End-of-year final examinations Year 7-12' },
    { title: 'School Holiday (Semester Break)', date: new Date('2026-07-20'), endDate: new Date('2026-08-02'), type: 'holiday', description: 'Mid-year school holiday' },
  ]
  for (const ev of schoolEvents) {
    await prisma.schoolEvent.create({ data: ev })
  }

  // ─── Homework Assignments & Submissions (for parent portal demo) ─────────────

  const ahmadStudentRecord = await prisma.student.findFirst({ where: { userId: adamUser.id } })
  const teacher01ForHw = await prisma.teacher.findFirst({ where: { userId: teacher01User.id } })
  const year7Courses = await prisma.course.findMany({ where: { gradeLevel: 'Year 7' }, select: { id: true, name: true, code: true } })

  if (ahmadStudentRecord && teacher01ForHw && year7Courses.length > 0) {
    const hwTemplates = [
      { suffix: 'Chapter 1 Review Exercises', type: 'homework', daysBack: 28, desc: 'Complete all exercises from Chapter 1. Show your working clearly for full marks.', maxScore: 100 },
      { suffix: 'Week 3 Quiz', type: 'quiz', daysBack: 21, desc: 'Short quiz covering weeks 1–3 topics. Open-notes. 30 minutes.', maxScore: 20 },
      { suffix: 'Mid-Term Written Assignment', type: 'project', daysBack: 14, desc: 'Write a 2-page response to the set question. Include evidence and references.', maxScore: 100 },
      { suffix: 'Chapter 3 Review', type: 'homework', daysBack: 7, desc: 'Answer all review questions at the end of Chapter 3 in your textbook.', maxScore: 100 },
      { suffix: 'Term 2 Project', type: 'project', daysBack: -7, desc: 'Submit individual project report. Printed or digital copy accepted.', maxScore: 100 },
      { suffix: 'Chapter 4 Worksheet', type: 'homework', daysBack: -14, desc: 'Complete the worksheet distributed in class. Show all workings for calculation questions.', maxScore: 50 },
    ]
    const hwToCreate = year7Courses.flatMap(c =>
      hwTemplates.map(t => ({
        courseId: c.id, teacherId: teacher01ForHw.id,
        title: `${t.suffix} — ${c.name}`, description: t.desc,
        type: t.type, dueDate: weeksAgo(Math.ceil(t.daysBack / 7)), maxScore: t.maxScore, status: 'published',
      }))
    )
    for (const hw of hwToCreate) {
      await prisma.assignment.create({ data: hw })
    }

    // Submissions for Ahmad for all past assignments
    const ahmadEnrolledCourseIds = (await prisma.enrollment.findMany({ where: { studentId: ahmadStudentRecord.id, status: 'enrolled' }, select: { courseId: true } })).map(e => e.courseId)
    const pastHwAsgns = await prisma.assignment.findMany({
      where: { courseId: { in: ahmadEnrolledCourseIds }, dueDate: { lte: new Date() } },
      orderBy: { dueDate: 'asc' },
    })
    const hwGrades = [85, 72, 91, 68, 78, 88, 95, 73, 82, 77, 90, 65, 83, 79, 94, 87, 71, 93, 76, 88, 84, 69, 92, 75, 89]
    for (let i = 0; i < pastHwAsgns.length; i++) {
      const a = pastHwAsgns[i]
      const g = hwGrades[i % hwGrades.length]
      const isLate = i % 7 === 3
      await prisma.assignmentSubmission.create({
        data: {
          assignmentId: a.id, studentId: ahmadStudentRecord.id,
          submittedAt: weeksAgo(Math.max(0, Math.ceil(((Date.now() - (a.dueDate?.getTime() ?? 0)) / 86400000) / 7) - 1)),
          isLate, score: g, status: 'graded',
          feedback: g >= 80 ? 'Good work! Keep it up.' : g >= 65 ? 'Needs improvement in a few areas — see comments.' : 'Please review this topic and see me for support.',
        },
      })
    }
    console.log(`  Created ${hwToCreate.length} assignments + ${pastHwAsgns.length} submissions`)
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

  // Additional fee invoices for Ahmad — unpaid current + overdue previous
  await prisma.feeInvoice.createMany({
    data: [
      {
        studentId: adam.id, invoiceNumber: 'INV-2026-S1-ACT', semester: '2026-S1', amount: 50,
        status: 'unpaid', dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d })(),
        description: 'Year 7 Activity & Co-curricular Fee — Term 2 2026',
        lineItems: JSON.stringify([{ code: 'ACTIVITY', name: 'Activity Fee', amount: 50 }]),
      },
      {
        studentId: adam.id, invoiceNumber: 'INV-2026-S1-TUI', semester: '2026-S1', amount: 350,
        status: 'paid', dueDate: daysAgo(90), paidAt: daysAgo(85),
        description: 'Year 7 Tuition & Library Fee — Semester 1 Term 1 2026',
        lineItems: JSON.stringify([{ code: 'TUITION', name: 'Tuition Fee', amount: 300 }, { code: 'LIBRARY', name: 'Library Fee', amount: 50 }]),
      },
    ],
  })

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
        where: { className_academicYear_schoolId: { className: `${gradeNum}${letter}`, academicYear: '2025/2026', schoolId: smhk.id } },
        create: {
          gradeLevel: yearLabel,
          className: `${gradeNum}${letter}`,
          academicYear: '2025/2026',
          capacity: isDemoClass ? 35 : 40,
          programme: PROGRAMMES[letter as keyof typeof PROGRAMMES],
          formTeacherId: isDemoClass ? teacher01.id : undefined,
          schoolId: smhk.id,
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

  // ─── Aminah Certifications ────────────────────────────────────────────────

  await prisma.certification.createMany({
    data: [
      {
        teacherId: teacher01.id,
        name: 'Teaching License — Mathematics (Secondary)',
        issuedBy: 'Ministry of Education Brunei',
        issuedDate: new Date('2014-01-10'),
        expiryDate: new Date('2029-01-10'),
        status: 'active',
      },
      {
        teacherId: teacher01.id,
        name: 'Cambridge International Certificate in Teaching and Learning',
        issuedBy: 'Cambridge Assessment International Education',
        issuedDate: new Date('2020-09-15'),
        expiryDate: new Date('2025-09-15'),  // already expired — triggers the warning badge
        status: 'active',
      },
      {
        teacherId: teacher01.id,
        name: 'First Aid & CPR Certificate',
        issuedBy: 'Red Crescent Society of Brunei',
        issuedDate: new Date('2023-06-01'),
        expiryDate: new Date(Date.now() + 45 * 24 * 3600 * 1000),  // expires in ~45 days
        status: 'active',
      },
    ],
  })

  // ─── Hafiz Probation marker ────────────────────────────────────────────────
  // Enrollment, grade items, and grades for Hafiz are seeded in the Year 9-12 demo block.
  // This section only records the academic standing history trigger.
  await prisma.academicStandingHistory.create({
    data: {
      studentId: hafiz.id,
      previousStanding: 'GOOD_STANDING',
      newStanding: 'PROBATION',
      trigger: 'GRADE_UPDATE',
      gradeAvg: 52.0,
      thresholdUsed: 50,
      createdAt: daysAgo(10),
    },
  })

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

  // Individual creates so we can attach sessions and resources
  const wClassroom = await prisma.cpdWorkshop.create({ data: {
    title: 'Classroom Management & Student Engagement',
    provider: 'Universiti Brunei Darussalam',
    subject: 'General',
    description: 'A full-day practical workshop on building positive classroom culture and sustaining student engagement. Participants will analyse real classroom scenarios, practise de-escalation techniques, and co-design engagement strategies tailored to secondary learners.',
    objectives: 'Apply at least three evidence-based engagement strategies in a lesson plan\nUse restorative practices to resolve classroom disruptions\nDesign seating arrangements and routines that reduce off-task behaviour\nDevelop a personal classroom management toolkit',
    targetAudience: 'All teaching staff — particularly beneficial for teachers with fewer than 5 years of experience',
    prerequisites: 'None. Open to all teaching staff.',
    facilitatorId: drsiti.id,
    hours: 3,
    startDate: futureDate(10),
    endDate: futureDate(10),
    location: 'UBD Main Campus',
    maxParticipants: 40,
    category: 'Pedagogy',
    status: 'open',
  }})

  const wMath = await prisma.cpdWorkshop.create({ data: {
    title: 'Digital Pedagogy for Mathematics',
    provider: 'MOE Professional Development Centre',
    subject: 'Mathematics',
    description: 'A one-day hands-on workshop exploring how digital tools and platforms can transform mathematics instruction. Participants will work with GeoGebra, Desmos, and MOE\'s digital resource library to design technology-enhanced lessons.',
    objectives: 'Design at least one technology-enhanced mathematics lesson\nNavigate and curate resources from MOE\'s digital library\nApply formative assessment via digital quiz platforms\nEvaluate the impact of digital tools on student engagement',
    targetAudience: 'Mathematics Teachers, Years 7–12',
    prerequisites: 'Minimum 1 year teaching experience. Basic familiarity with computers and internet browsing.',
    facilitatorId: drsiti.id,
    hours: 4,
    startDate: futureDate(14),
    endDate: futureDate(14),
    location: 'Resource Centre, Block B',
    maxParticipants: 25,
    category: 'Educational Technology',
    status: 'open',
  }})

  const wICT = await prisma.cpdWorkshop.create({ data: {
    title: 'ICT Integration in the Secondary Classroom',
    provider: 'MOE ICT Division',
    subject: 'ICT',
    description: 'Practical training on embedding ICT tools into everyday teaching — from interactive presentations and digital assessments to online collaboration spaces and learning management systems.',
    objectives: 'Set up and manage a class using MOE\'s LMS platform\nCreate interactive digital assessments\nUse collaborative tools (shared docs, digital whiteboards) in lessons\nApply basic data literacy to interpret student analytics',
    targetAudience: 'All teaching staff, particularly those new to digital teaching tools',
    prerequisites: 'None.',
    hours: 4,
    startDate: futureDate(18),
    endDate: futureDate(18),
    location: 'Computer Lab, Block C',
    maxParticipants: 20,
    category: 'Educational Technology',
    status: 'open',
  }})

  const wScience = await prisma.cpdWorkshop.create({ data: {
    title: 'Inquiry-Based Science Teaching',
    provider: 'MOE Professional Development Centre',
    subject: 'Science',
    description: 'A two-day immersive workshop on transforming science classrooms into centres of inquiry and discovery. Teachers will experience inquiry cycles first-hand through lab activities, then deconstruct the pedagogy to apply it in their own contexts.',
    objectives: 'Distinguish guided, structured and open inquiry models\nDesign a full inquiry-based investigation for secondary students\nFacilitate student-led scientific discourse without over-scaffolding\nAdapt existing textbook lessons to an inquiry-first sequence\nAssess the inquiry process, not just the outcome',
    targetAudience: 'Science Teachers (Physics, Chemistry, Biology, Combined Science), Years 7–12',
    prerequisites: 'None. Open to all science teachers regardless of experience level.',
    facilitatorId: drsiti.id,
    imageUrl: 'https://images.unsplash.com/photo-1532094349884-543559244e3f?w=800&q=80',
    hours: 6,
    startDate: futureDate(21),
    endDate: futureDate(22),
    location: 'Science Lab Wing',
    maxParticipants: 20,
    category: 'Pedagogy',
    status: 'open',
  }})

  const wAssessment = await prisma.cpdWorkshop.create({ data: {
    title: 'Assessment for Learning: Formative Strategies',
    provider: 'MOE Professional Development Centre',
    subject: 'General',
    description: 'A two-day workshop on embedding formative assessment into daily teaching practice. Participants will leave with a full toolkit of strategies — from exit tickets and peer assessment to questioning techniques and learning progressions.',
    objectives: 'Distinguish formative from summative assessment and explain the pedagogical value of each\nImplement at least five different formative assessment techniques\nUse student data from formative tasks to adjust instruction in real time\nDesign a unit of work with integrated formative checkpoints\nProvide effective written and verbal feedback that moves learning forward',
    targetAudience: 'All teaching staff. Particularly relevant for teachers preparing students for national examinations.',
    prerequisites: 'None.',
    hours: 5,
    startDate: futureDate(28),
    endDate: futureDate(29),
    location: 'Resource Centre, Block A',
    maxParticipants: 30,
    category: 'Pedagogy',
    status: 'open',
  }})

  const wInclusive = await prisma.cpdWorkshop.create({ data: {
    title: 'Inclusive Education & SEN Strategies',
    provider: 'Brunei Darussalam National Institute of Education',
    subject: 'General',
    description: 'A two-day professional development programme designed to equip teachers with the knowledge, skills and attitudes needed to support students with special educational needs in mainstream classrooms. Covers identification, differentiation, co-teaching models and communication with parents.',
    objectives: 'Identify common SEN profiles and their classroom manifestations\nApply Universal Design for Learning (UDL) principles to lesson planning\nDifferentiate instruction across three tiers of support\nCollaborate effectively with the SEN team and external specialists\nCommunicate sensitively with parents of students with SEN',
    targetAudience: 'All teaching staff. Priority given to Form Teachers and subject teachers with identified SEN students in their classes.',
    prerequisites: 'Recommended to complete \'Classroom Management & Student Engagement\' first.',
    hours: 8,
    startDate: futureDate(35),
    endDate: futureDate(36),
    location: 'BDNIE Conference Hall',
    maxParticipants: 50,
    category: 'Special Education',
    status: 'open',
  }})

  // Sessions for multi-day workshops
  await prisma.cpdWorkshopSession.createMany({ data: [
    { workshopId: wScience.id, title: 'Day 1: Understanding Inquiry & Lab Investigations', sessionDate: futureDate(21), startTime: '08:30', endTime: '16:00', room: 'Science Lab 1' },
    { workshopId: wScience.id, title: 'Day 2: Lesson Redesign & Peer Sharing', sessionDate: futureDate(22), startTime: '08:30', endTime: '13:00', room: 'Science Lab 1' },
    { workshopId: wAssessment.id, title: 'Day 1: Foundations of Formative Assessment', sessionDate: futureDate(28), startTime: '08:00', endTime: '16:30', room: 'Resource Centre, Block A' },
    { workshopId: wAssessment.id, title: 'Day 2: Designing Assessment Into Units', sessionDate: futureDate(29), startTime: '08:00', endTime: '13:00', room: 'Resource Centre, Block A' },
    { workshopId: wInclusive.id, title: 'Day 1: SEN Profiles, UDL & Differentiation', sessionDate: futureDate(35), startTime: '08:30', endTime: '17:00', room: 'BDNIE Main Hall' },
    { workshopId: wInclusive.id, title: 'Day 2: Co-Teaching Models & Parent Communication', sessionDate: futureDate(36), startTime: '08:30', endTime: '16:00', room: 'BDNIE Main Hall' },
  ]})

  // Resources for select workshops
  await prisma.cpdWorkshopResource.createMany({ data: [
    { workshopId: wScience.id, title: 'Workshop Overview & Schedule', type: 'document', url: 'https://www.moe.gov.bn/resources/cpd/inquiry-science-overview.pdf', uploadedById: hodUser.id },
    { workshopId: wScience.id, title: 'Inquiry Cycle Framework (Slides)', type: 'slides', url: 'https://www.moe.gov.bn/resources/cpd/inquiry-cycle-slides.pdf', uploadedById: hodUser.id },
    { workshopId: wScience.id, title: 'Inquiry Lab Activity Worksheet', type: 'document', url: 'https://www.moe.gov.bn/resources/cpd/inquiry-lab-worksheet.pdf', uploadedById: hodUser.id },
    { workshopId: wAssessment.id, title: 'Formative Assessment Strategy Toolkit', type: 'document', url: 'https://www.moe.gov.bn/resources/cpd/formative-toolkit.pdf', uploadedById: hodUser.id },
    { workshopId: wAssessment.id, title: 'Workshop Slides — Day 1', type: 'slides', url: 'https://www.moe.gov.bn/resources/cpd/assessment-slides-day1.pdf', uploadedById: hodUser.id },
    { workshopId: wMath.id, title: 'Getting Started with GeoGebra', type: 'link', url: 'https://www.geogebra.org/learn', uploadedById: hodUser.id },
    { workshopId: wMath.id, title: 'Digital Maths Resources Catalogue', type: 'document', url: 'https://www.moe.gov.bn/resources/cpd/digital-maths-catalogue.pdf', uploadedById: hodUser.id },
    { workshopId: wInclusive.id, title: 'Universal Design for Learning Guidelines', type: 'link', url: 'https://udlguidelines.cast.org', uploadedById: hodUser.id },
    { workshopId: wInclusive.id, title: 'SEN Identification Checklist', type: 'document', url: 'https://www.moe.gov.bn/resources/cpd/sen-checklist.pdf', uploadedById: hodUser.id },
  ]})

  console.log('  CPD Workshops seeded.')

  // ─── Year 9-12 Demo Data ──────────────────────────────────────────────────
  console.log('Creating Year 9-12 named student data...')

  const lg = (score: number, max: number) => {
    const p = (score / max) * 100
    return p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F'
  }

  // ── Parent records for Year 9-12 ────────────────────────────────────────

  const fatinParentUser = await prisma.user.create({
    data: { username: 'parent.fatin', password: hash('Demo@2026'), displayName: 'Hjh Norzalina Binti Idris', email: 'norzalina@parent.moe.edu.bn', role: 'parent' },
  })
  const fatinParent = await prisma.parent.create({
    data: { userId: fatinParentUser.id, phone: '+673 8234 5678', occupation: 'Civil Servant', relationship: 'mother' },
  })
  await prisma.parentStudent.create({ data: { parentId: fatinParent.id, studentId: fatin.id } })

  const nadiaParentUser = await prisma.user.create({
    data: { username: 'parent.nadia', password: hash('Demo@2026'), displayName: 'Dr. Yusof Bin Hazmi', email: 'yusof@parent.moe.edu.bn', role: 'parent' },
  })
  const nadiaParent = await prisma.parent.create({
    data: { userId: nadiaParentUser.id, phone: '+673 8345 6789', occupation: 'Medical Officer', relationship: 'father' },
  })
  await prisma.parentStudent.create({ data: { parentId: nadiaParent.id, studentId: nadia.id } })

  const hanaParentUser = await prisma.user.create({
    data: { username: 'parent.hana', password: hash('Demo@2026'), displayName: 'Hjh Roslina Binti Salleh', email: 'roslina@parent.moe.edu.bn', role: 'parent' },
  })
  const hanaParent = await prisma.parent.create({
    data: { userId: hanaParentUser.id, phone: '+673 8456 7890', occupation: 'Business Owner', relationship: 'mother' },
  })
  await prisma.parentStudent.create({ data: { parentId: hanaParent.id, studentId: hana.id } })

  const danialParentUser = await prisma.user.create({
    data: { username: 'parent.danial', password: hash('Demo@2026'), displayName: 'Hj Ahmad Bin Hamid', email: 'ahmadhamid@parent.moe.edu.bn', role: 'parent' },
  })
  const danialParent = await prisma.parent.create({
    data: { userId: danialParentUser.id, phone: '+673 8567 8901', occupation: 'Senior Civil Servant', relationship: 'father' },
  })
  await prisma.parentStudent.create({ data: { parentId: danialParent.id, studentId: danial.id } })

  // ── Enrollments ──────────────────────────────────────────────────────────

  for (const c of [math9, eng9, sci9, mib9, geog9]) {
    await prisma.enrollment.create({ data: { studentId: hafiz.id, courseId: c.id, semester: '2026-S1' } })
    await prisma.enrollment.create({ data: { studentId: fatin.id, courseId: c.id, semester: '2026-S1' } })
  }
  for (const c of [math10, addMath10, phy10, chem10, bio10, eng10]) {
    await prisma.enrollment.create({ data: { studentId: nadia.id, courseId: c.id, semester: '2026-S1' } })
  }
  for (const c of [math11, addMath11, phy11, chem11, bio11, eng11]) {
    await prisma.enrollment.create({ data: { studentId: hana.id, courseId: c.id, semester: '2026-S1' } })
  }
  for (const c of [math12, addMath12, phy12, chem12, bio12, eng12]) {
    await prisma.enrollment.create({ data: { studentId: danial.id, courseId: c.id, semester: '2026-S1' } })
  }

  // ── Grade Items helper ────────────────────────────────────────────────────

  async function makeGradeItems(courseId: string, hasMock: boolean) {
    const base = [
      { name: 'Quiz 1',       type: 'quiz',       maxScore: 20,  weight: 0.1,  dueDate: weeksAgo(10) },
      { name: 'Assignment 1', type: 'assignment',  maxScore: 50,  weight: 0.15, dueDate: weeksAgo(8) },
      { name: 'Midterm Exam', type: 'exam',        maxScore: 100, weight: 0.3,  dueDate: weeksAgo(6) },
      { name: 'Assignment 2', type: 'assignment',  maxScore: 50,  weight: 0.15, dueDate: weeksAgo(3) },
      { name: 'Final Exam',   type: 'exam',        maxScore: 100, weight: hasMock ? 0.2 : 0.4, dueDate: weeksAgo(1) },
    ]
    if (hasMock) base.push({ name: 'Mock Exam', type: 'exam', maxScore: 100, weight: 0.2, dueDate: weeksAgo(2) })
    const out: { id: string; maxScore: number }[] = []
    for (const item of base) {
      const gi = await prisma.gradeItem.create({ data: { courseId, ...item } })
      out.push({ id: gi.id, maxScore: gi.maxScore })
    }
    return out
  }

  // Year 9 items
  const gi9Math = await makeGradeItems(math9.id, false)
  const gi9Eng  = await makeGradeItems(eng9.id,  false)
  const gi9Sci  = await makeGradeItems(sci9.id,  false)
  const gi9Mib  = await makeGradeItems(mib9.id,  false)
  const gi9Geo  = await makeGradeItems(geog9.id, false)

  // Year 10 items
  const gi10Math    = await makeGradeItems(math10.id,    false)
  const gi10AddMath = await makeGradeItems(addMath10.id, false)
  const gi10Phy     = await makeGradeItems(phy10.id,     false)
  const gi10Chem    = await makeGradeItems(chem10.id,    false)
  const gi10Bio     = await makeGradeItems(bio10.id,     false)
  const gi10Eng     = await makeGradeItems(eng10.id,     false)

  // Year 11 items (with mock exam)
  const gi11Math    = await makeGradeItems(math11.id,    true)
  const gi11AddMath = await makeGradeItems(addMath11.id, true)
  const gi11Phy     = await makeGradeItems(phy11.id,     true)
  const gi11Chem    = await makeGradeItems(chem11.id,    true)
  const gi11Bio     = await makeGradeItems(bio11.id,     true)
  const gi11Eng     = await makeGradeItems(eng11.id,     true)

  // Year 12 items (with mock exam)
  const gi12Math    = await makeGradeItems(math12.id,    true)
  const gi12AddMath = await makeGradeItems(addMath12.id, true)
  const gi12Phy     = await makeGradeItems(phy12.id,     true)
  const gi12Chem    = await makeGradeItems(chem12.id,    true)
  const gi12Bio     = await makeGradeItems(bio12.id,     true)
  const gi12Eng     = await makeGradeItems(eng12.id,     true)

  // ── Grade helper ──────────────────────────────────────────────────────────

  async function seedGrades(studentId: string, sets: Array<{ items: { id: string; maxScore: number }[]; scores: number[] }>) {
    for (const { items, scores } of sets) {
      for (let i = 0; i < items.length; i++) {
        const { id: gradeItemId, maxScore } = items[i]
        const score = Math.min(scores[i] ?? scores[scores.length - 1], maxScore)
        await prisma.grade.create({
          data: { studentId, gradeItemId, score, letterGrade: lg(score, maxScore), gradedAt: daysAgo(7 - i) },
        })
      }
    }
  }

  // ── HAFIZ — failing across all Year 9 subjects ───────────────────────────
  await seedGrades(hafiz.id, [
    { items: gi9Math, scores: [6, 17, 42, 18, 42] },    // Math: F (~42%)
    { items: gi9Eng,  scores: [11, 27, 55, 25, 55] },   // Eng: D (~55%)
    { items: gi9Sci,  scores: [10, 26, 52, 24, 52] },   // Sci: D (~52%)
    { items: gi9Mib,  scores: [12, 31, 62, 29, 63] },   // MIB: D/C (~62%)
    { items: gi9Geo,  scores: [10, 25, 50, 23, 50] },   // Geog: D (~50%)
  ])
  await prisma.student.update({ where: { id: hafiz.id }, data: { academicStanding: 'PROBATION' } })

  // ── FATIN — solid B-student, Year 9A ─────────────────────────────────────
  await seedGrades(fatin.id, [
    { items: gi9Math, scores: [16, 42, 82, 40, 85] },   // Math: B
    { items: gi9Eng,  scores: [17, 44, 88, 42, 88] },   // Eng: B
    { items: gi9Sci,  scores: [15, 40, 80, 39, 82] },   // Sci: B
    { items: gi9Mib,  scores: [18, 45, 90, 43, 91] },   // MIB: A
    { items: gi9Geo,  scores: [14, 38, 78, 37, 79] },   // Geog: C
  ])
  await prisma.riskScore.create({
    data: { studentId: fatin.id, score: 0.18, band: 'LOW_RISK', absences14d: 0, gradeAvg: 84.8, gradeTrend: 1.2, computedAt: daysAgo(1) },
  })

  // ── NADIA — top student, Year 10A science stream ─────────────────────────
  await seedGrades(nadia.id, [
    { items: gi10Math,    scores: [19, 48, 95, 47, 96] },
    { items: gi10AddMath, scores: [20, 49, 98, 48, 98] },
    { items: gi10Phy,     scores: [19, 47, 92, 46, 94] },
    { items: gi10Chem,    scores: [19, 46, 94, 46, 95] },
    { items: gi10Bio,     scores: [20, 48, 96, 47, 97] },
    { items: gi10Eng,     scores: [18, 44, 88, 43, 89] },
  ])
  await prisma.riskScore.create({
    data: { studentId: nadia.id, score: 0.05, band: 'LOW_RISK', absences14d: 0, gradeAvg: 94.3, gradeTrend: 0.5, computedAt: daysAgo(1) },
  })

  // ── HANA — O-Level year student, Year 11A ────────────────────────────────
  await seedGrades(hana.id, [
    { items: gi11Math,    scores: [18, 44, 88, 43, 90, 89] },
    { items: gi11AddMath, scores: [19, 46, 92, 45, 91, 92] },
    { items: gi11Phy,     scores: [17, 43, 86, 42, 88, 87] },
    { items: gi11Chem,    scores: [18, 44, 89, 43, 90, 90] },
    { items: gi11Bio,     scores: [19, 46, 92, 45, 93, 92] },
    { items: gi11Eng,     scores: [16, 41, 83, 40, 85, 84] },
  ])
  await prisma.riskScore.create({
    data: { studentId: hana.id, score: 0.08, band: 'LOW_RISK', absences14d: 0, gradeAvg: 89.6, gradeTrend: 1.0, computedAt: daysAgo(1) },
  })

  // ── DANIAL — top Year 12 student, A-Level final year ─────────────────────
  await seedGrades(danial.id, [
    { items: gi12Math,    scores: [20, 48, 96, 47, 97, 97] },
    { items: gi12AddMath, scores: [19, 47, 94, 46, 96, 95] },
    { items: gi12Phy,     scores: [19, 48, 95, 47, 96, 95] },
    { items: gi12Chem,    scores: [20, 48, 96, 47, 97, 96] },
    { items: gi12Bio,     scores: [20, 49, 98, 48, 98, 98] },
    { items: gi12Eng,     scores: [18, 44, 88, 43, 89, 89] },
  ])
  await prisma.riskScore.create({
    data: { studentId: danial.id, score: 0.03, band: 'LOW_RISK', absences14d: 0, gradeAvg: 95.4, gradeTrend: 0.3, computedAt: daysAgo(1) },
  })

  // ── Attendance for Year 9-12 named students ───────────────────────────────

  // Hafiz: poor attendance (~55%), enriched with late/excused/reasons
  for (const { day, status, reason } of [
    { day: 60, status: 'absent',  reason: 'Sick' },
    { day: 55, status: 'present', reason: undefined },
    { day: 50, status: 'late',    reason: 'Overslept' },
    { day: 45, status: 'present', reason: undefined },
    { day: 40, status: 'excused', reason: 'Family emergency' },
    { day: 30, status: 'absent',  reason: 'Unexplained' },
    { day: 21, status: 'present', reason: undefined },
    { day: 14, status: 'late',    reason: 'Medical check-up — arrived at Period 2' },
    { day: 7,  status: 'absent',  reason: 'Sick' },
    { day: 3,  status: 'present', reason: undefined },
  ]) {
    const d = daysAgo(day)
    const sess = await prisma.attendanceSession.create({ data: { courseId: math9.id, date: d, topic: 'Mathematics Year 9', status: 'completed' } })
    await prisma.attendanceRecord.create({ data: { sessionId: sess.id, studentId: hafiz.id, status, checkedInAt: status !== 'absent' ? d : null, absenceReason: reason ?? null } })
  }

  // Fatin: good attendance (1 absence in 10 sessions)
  for (const [day, status] of [
    [60, 'present'], [55, 'present'], [50, 'present'], [45, 'absent'], [40, 'present'],
    [30, 'present'], [21, 'present'], [14, 'present'], [7, 'present'], [3, 'present'],
  ] as [number, string][]) {
    const d = daysAgo(day)
    const sess = await prisma.attendanceSession.create({ data: { courseId: math9.id, date: d, topic: 'Mathematics Year 9', status: 'completed' } })
    await prisma.attendanceRecord.create({ data: { sessionId: sess.id, studentId: fatin.id, status, checkedInAt: status !== 'absent' ? d : null } })
  }

  // Nadia, Hana, Danial: perfect attendance
  for (const [student, course, topic] of [
    [nadia,  phy10, 'Physics Year 10'],
    [hana,   phy11, 'Physics Year 11'],
    [danial, phy12, 'Physics Year 12'],
  ] as [typeof nadia, typeof phy10, string][]) {
    for (let dAgo = 56; dAgo > 0; dAgo -= 7) {
      const d = daysAgo(dAgo)
      const sess = await prisma.attendanceSession.create({ data: { courseId: course.id, date: d, topic, status: 'completed' } })
      await prisma.attendanceRecord.create({ data: { sessionId: sess.id, studentId: student.id, status: 'present', checkedInAt: d } })
    }
  }

  // ── Fee Invoices for Year 9-12 ────────────────────────────────────────────

  await prisma.feeInvoice.create({ data: { studentId: hafiz.id, semester: '2026-S1', amount: 350, status: 'overdue', dueDate: daysAgo(30), description: 'Tuition Fee - Semester 1' } })
  await prisma.feeInvoice.create({ data: { studentId: hafiz.id, semester: '2026-S1', amount: 50, status: 'unpaid', dueDate: new Date('2026-06-30'), description: 'Science Lab Fee' } })
  await prisma.feeInvoice.create({ data: { studentId: fatin.id, semester: '2026-S1', amount: 350, status: 'paid', dueDate: new Date('2026-06-30'), paidAt: daysAgo(20), description: 'Tuition Fee - Semester 1' } })
  await prisma.feeInvoice.create({ data: { studentId: nadia.id, semester: '2026-S1', amount: 400, status: 'paid', dueDate: new Date('2026-06-30'), paidAt: daysAgo(15), description: 'Tuition Fee - Semester 1' } })
  await prisma.feeInvoice.create({ data: { studentId: nadia.id, semester: '2026-S1', amount: 120, status: 'paid', dueDate: new Date('2026-03-31'), paidAt: daysAgo(55), description: 'Science & Lab Fee' } })
  await prisma.feeInvoice.create({ data: { studentId: hana.id, semester: '2026-S1', amount: 420, status: 'paid', dueDate: new Date('2026-06-30'), paidAt: daysAgo(10), description: 'Tuition Fee - Semester 1' } })
  await prisma.feeInvoice.create({ data: { studentId: danial.id, semester: '2026-S1', amount: 450, status: 'paid', dueDate: new Date('2026-06-30'), paidAt: daysAgo(5), description: 'Tuition Fee - Semester 1' } })
  await prisma.feeInvoice.create({ data: { studentId: danial.id, semester: '2026-S1', amount: 150, status: 'paid', dueDate: new Date('2026-03-31'), paidAt: daysAgo(60), description: 'A-Level Examination Registration Fee' } })

  // ── Timetable Slots for Year 9-12 ────────────────────────────────────────

  const y9aSlots = [
    { courseId: math9.id, teacherId: drsiti.id,   dayOfWeek: 0, startTime: '08:00', endTime: '09:30', room: 'Classroom 9A' },
    { courseId: math9.id, teacherId: drsiti.id,   dayOfWeek: 2, startTime: '08:00', endTime: '09:30', room: 'Classroom 9A' },
    { courseId: sci9.id,  teacherId: hassan.id,   dayOfWeek: 1, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: sci9.id,  teacherId: hassan.id,   dayOfWeek: 3, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: eng9.id,  teacherId: zuraidah.id, dayOfWeek: 0, startTime: '10:00', endTime: '11:30', room: 'Classroom 9A' },
    { courseId: eng9.id,  teacherId: zuraidah.id, dayOfWeek: 2, startTime: '10:00', endTime: '11:30', room: 'Classroom 9A' },
    { courseId: mib9.id,  teacherId: faizal.id,   dayOfWeek: 4, startTime: '08:00', endTime: '10:00', room: 'Classroom 9A' },
    { courseId: geog9.id, teacherId: ridwan.id,   dayOfWeek: 4, startTime: '10:00', endTime: '12:00', room: 'Classroom 9A' },
  ]
  for (const slot of y9aSlots) {
    await prisma.timetableSlot.create({ data: { ...slot, gradeLevel: 'Year 9', className: '9A', semester: '2026-S1' } })
  }

  const y10aSlots = [
    { courseId: math10.id,    teacherId: teacher01.id, dayOfWeek: 0, startTime: '08:00', endTime: '09:30', room: 'Classroom 10A' },
    { courseId: math10.id,    teacherId: teacher01.id, dayOfWeek: 2, startTime: '08:00', endTime: '09:30', room: 'Classroom 10A' },
    { courseId: phy10.id,     teacherId: drsiti.id,    dayOfWeek: 1, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: phy10.id,     teacherId: drsiti.id,    dayOfWeek: 3, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: chem10.id,    teacherId: hassan.id,    dayOfWeek: 0, startTime: '10:00', endTime: '11:30', room: 'Science Lab 1' },
    { courseId: bio10.id,     teacherId: hassan.id,    dayOfWeek: 2, startTime: '10:00', endTime: '11:30', room: 'Science Lab 1' },
    { courseId: addMath10.id, teacherId: drsiti.id,    dayOfWeek: 1, startTime: '10:00', endTime: '11:30', room: 'Classroom 10A' },
    { courseId: eng10.id,     teacherId: zuraidah.id,  dayOfWeek: 4, startTime: '08:00', endTime: '10:00', room: 'Classroom 10A' },
  ]
  for (const slot of y10aSlots) {
    await prisma.timetableSlot.create({ data: { ...slot, gradeLevel: 'Year 10', className: '10A', semester: '2026-S1' } })
  }

  const y11aSlots = [
    { courseId: math11.id,    teacherId: teacher01.id, dayOfWeek: 0, startTime: '08:00', endTime: '09:30', room: 'Classroom 11A' },
    { courseId: math11.id,    teacherId: teacher01.id, dayOfWeek: 2, startTime: '08:00', endTime: '09:30', room: 'Classroom 11A' },
    { courseId: phy11.id,     teacherId: drsiti.id,    dayOfWeek: 1, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: phy11.id,     teacherId: drsiti.id,    dayOfWeek: 3, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: chem11.id,    teacherId: hassan.id,    dayOfWeek: 0, startTime: '10:00', endTime: '11:30', room: 'Science Lab 1' },
    { courseId: bio11.id,     teacherId: hassan.id,    dayOfWeek: 2, startTime: '10:00', endTime: '11:30', room: 'Science Lab 1' },
    { courseId: addMath11.id, teacherId: drsiti.id,    dayOfWeek: 1, startTime: '10:00', endTime: '11:30', room: 'Classroom 11A' },
    { courseId: eng11.id,     teacherId: zuraidah.id,  dayOfWeek: 4, startTime: '08:00', endTime: '10:00', room: 'Classroom 11A' },
  ]
  for (const slot of y11aSlots) {
    await prisma.timetableSlot.create({ data: { ...slot, gradeLevel: 'Year 11', className: '11A', semester: '2026-S1' } })
  }

  const y12aSlots = [
    { courseId: math12.id,    teacherId: drsiti.id,   dayOfWeek: 0, startTime: '08:00', endTime: '09:30', room: 'Classroom 12A' },
    { courseId: math12.id,    teacherId: drsiti.id,   dayOfWeek: 2, startTime: '08:00', endTime: '09:30', room: 'Classroom 12A' },
    { courseId: phy12.id,     teacherId: drsiti.id,   dayOfWeek: 1, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: phy12.id,     teacherId: drsiti.id,   dayOfWeek: 3, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1' },
    { courseId: chem12.id,    teacherId: hassan.id,   dayOfWeek: 0, startTime: '10:00', endTime: '11:30', room: 'Science Lab 1' },
    { courseId: bio12.id,     teacherId: hassan.id,   dayOfWeek: 2, startTime: '10:00', endTime: '11:30', room: 'Science Lab 1' },
    { courseId: addMath12.id, teacherId: drsiti.id,   dayOfWeek: 1, startTime: '10:00', endTime: '11:30', room: 'Classroom 12A' },
    { courseId: eng12.id,     teacherId: zuraidah.id, dayOfWeek: 4, startTime: '08:00', endTime: '10:00', room: 'Classroom 12A' },
  ]
  for (const slot of y12aSlots) {
    await prisma.timetableSlot.create({ data: { ...slot, gradeLevel: 'Year 12', className: '12A', semester: '2026-S1' } })
  }

  // ── Notifications for Year 9-12 students ─────────────────────────────────

  await prisma.notification.createMany({
    data: [
      { userId: hafizUser.id,     title: 'Academic Probation Notice',     message: 'You have been placed on Academic Probation. Grade average below 50%. Please meet your counselor immediately.', type: 'warning' },
      { userId: hafizUser.id,     title: 'Attendance Warning',            message: 'Your attendance rate has fallen below 60%. Immediate improvement is required to avoid further action.', type: 'warning' },
      { userId: fatinUser.id,     title: 'Midterm Results Published',     message: 'Your Year 9 midterm results are available. Mathematics: 82, English: 88. Keep up the great work!', type: 'success' },
      { userId: nadiaY10User.id,  title: 'Top Student Recognition',       message: 'Congratulations! You achieved the highest Year 10 average this semester — 94.3%. Outstanding work.', type: 'success' },
      { userId: nadiaY10User.id,  title: 'Physics Lab Practical',         message: 'Year 10 Physics practical examination is on June 15. Please review Chapters 5–8.', type: 'info' },
      { userId: hanaY11User.id,   title: 'Mock O-Level Results',          message: 'Your Mock O-Level results are available. Average 89.6% — excellent preparation for the national exams.', type: 'success' },
      { userId: hanaY11User.id,   title: 'O-Level Study Group',           message: 'Revision group with Ms. Zuraidah: tomorrow 2:00 PM, Library. All Year 11 students welcome.', type: 'info' },
      { userId: danialY12User.id, title: 'Conditional University Offer',  message: 'Congratulations! You have received a conditional offer from Universiti Brunei Darussalam, pending A-Level results.', type: 'success' },
      { userId: danialY12User.id, title: 'Final Year Project Accepted',   message: 'Your A-Level research project has been accepted for submission. Results will be included in your final grade.', type: 'success' },
      { userId: fatinParentUser.id, title: 'Midterm Results Available',   message: "Fatin's Year 9 midterm results are now available on the Parent Portal.", type: 'info' },
      { userId: nadiaParentUser.id, title: 'Top Student Achievement',     message: 'Nadia achieved the highest Year 10 average this semester. Congratulations!', type: 'success' },
      { userId: danialParentUser.id, title: 'University Conditional Offer', message: 'Danial has received a conditional university offer. Please log in to view details.', type: 'success' },
    ],
  })

  // ── Additional school calendar events for Year 9-12 ──────────────────────

  await prisma.schoolEvent.createMany({
    data: [
      { title: 'Year 11 O-Level Examinations',  date: new Date('2026-07-06'), endDate: new Date('2026-07-17'), type: 'exam',  description: 'National O-Level examinations for Year 11 students' },
      { title: 'Year 12 A-Level Examinations',  date: new Date('2026-07-06'), endDate: new Date('2026-07-10'), type: 'exam',  description: 'A-Level final examinations for Year 12 students' },
      { title: 'Year 12 Graduation Ceremony',   date: new Date('2026-08-16'), type: 'event', description: 'Annual graduation ceremony for Year 12 leavers and parents' },
      { title: 'A-Level Results Day',           date: new Date('2026-08-20'), type: 'event', description: 'Year 12 A-Level examination results released' },
      { title: 'O-Level Results Day',           date: new Date('2026-08-25'), type: 'event', description: 'Year 11 O-Level national examination results released' },
    ],
  })

  // ── Full-year academic calendar ───────────────────────────────────────────

  await prisma.schoolEvent.createMany({
    data: [
      // ─ Term 1 (Jan–Mar 2026) ─
      { title: 'First Day of School — Term 1',      date: new Date('2026-01-05'), type: 'event',    description: 'Term 1 begins. Year 7 welcome assembly at 7:30 AM, all other years normal schedule.' },
      { title: 'Chinese New Year',                  date: new Date('2026-01-29'), endDate: new Date('2026-01-30'), type: 'holiday', description: 'Public holiday — school closed.' },
      { title: 'Year 7 Orientation Week',           date: new Date('2026-02-09'), endDate: new Date('2026-02-13'), type: 'activity', description: 'New Year 7 students join their form classes and complete orientation activities.' },
      { title: 'National Day',                      date: new Date('2026-02-23'), type: 'holiday',  description: 'Brunei National Day — public holiday. School closed.' },
      { title: 'Year 11 & 12 Trial Examinations',   date: new Date('2026-02-26'), endDate: new Date('2026-03-06'), type: 'exam', description: 'Internal trial exams for O-Level and A-Level candidates. Normal timetable suspended for affected classes.' },
      { title: 'Teacher Professional Development',  date: new Date('2026-03-11'), type: 'activity', description: 'Whole-school CPD day. Students do not attend. Teachers report at 8:00 AM for workshops.' },
      { title: 'End of Term 1',                     date: new Date('2026-03-20'), type: 'event',    description: 'Last day of Term 1. Half-day — school dismisses at 12:00 noon.' },
      // ─ Term break (Mar–Apr 2026) ─
      { title: 'Hari Raya Puasa (Eid al-Fitr)',     date: new Date('2026-03-31'), endDate: new Date('2026-04-01'), type: 'holiday', description: 'Public holiday — school closed.' },
      { title: 'Term 1 School Holiday',             date: new Date('2026-03-21'), endDate: new Date('2026-04-05'), type: 'holiday', description: 'Term 1 school holiday break.' },
      // ─ Term 2 (Apr–Jun 2026) ─
      { title: 'Term 2 Begins',                     date: new Date('2026-04-06'), type: 'event',    description: 'Students return to school for Term 2.' },
      { title: 'Year 11 & 12 Internal Assessment',  date: new Date('2026-04-20'), endDate: new Date('2026-04-24'), type: 'exam', description: 'Internal coursework assessments and oral examinations for Year 11 and Year 12.' },
      { title: 'Labour Day',                        date: new Date('2026-05-01'), type: 'holiday',  description: 'Public holiday — school closed.' },
      { title: 'Annual School Assembly',            date: new Date('2026-05-11'), type: 'activity', description: 'Full school assembly. Prize presentations, head boy and head girl announcement.' },
      { title: 'Royal Brunei Armed Forces Day',     date: new Date('2026-05-31'), type: 'holiday',  description: 'Public holiday — school closed.' },
      { title: 'End of Term 2',                     date: new Date('2026-06-19'), type: 'event',    description: 'Last day of Term 2.' },
      // ─ Term 3 (Aug–Oct 2026) ─
      { title: 'Term 3 Begins',                     date: new Date('2026-08-03'), type: 'event',    description: 'Students return to school for Term 3.' },
      { title: 'Year 7–10 Semester Assessment',     date: new Date('2026-09-07'), endDate: new Date('2026-09-18'), type: 'exam', description: 'End-of-semester assessments for Year 7, 8, 9, and 10. Some afternoon periods repurposed for written exams.' },
      { title: 'School Foundation Day',             date: new Date('2026-09-16'), type: 'activity', description: 'Celebrating the school\'s founding anniversary. Cultural performances and alumni display.' },
      { title: 'Prophet Muhammad\'s Birthday',      date: new Date('2026-09-04'), type: 'holiday',  description: 'Public holiday — school closed.' },
      { title: 'Inter-School Debate Competition',   date: new Date('2026-09-26'), type: 'activity', description: 'SMHK hosts the annual inter-school debate. Students from 12 schools competing.' },
      { title: 'Cultural Day',                      date: new Date('2026-10-01'), type: 'activity', description: 'Annual Cultural Day celebration. Students perform traditional dances, music, and display handicrafts.' },
      { title: 'Teacher CPD Days',                  date: new Date('2026-10-05'), endDate: new Date('2026-10-07'), type: 'activity', description: 'Three-day school-wide professional development. Students do not attend school.' },
      { title: 'Prize-Giving Ceremony',             date: new Date('2026-10-15'), type: 'event',    description: 'Annual prize-giving for academic excellence and co-curricular achievement. Parents invited.' },
      { title: 'Last Day of School — Term 3',       date: new Date('2026-10-23'), type: 'event',    description: 'Last day of the academic year 2026. Half-day — dismissal at 12:00 noon.' },
      // ─ Year-end holiday (Oct–Dec 2026) ─
      { title: 'Year-End School Holiday',           date: new Date('2026-10-24'), endDate: new Date('2026-12-31'), type: 'holiday', description: 'Year-end school holiday. School reopens in January 2027.' },
      { title: 'Christmas Day',                     date: new Date('2026-12-25'), type: 'holiday',  description: 'Public holiday.' },
    ],
  })

  console.log('  Year 9-12 demo data seeded.')

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
  console.log(`  Ahmad risk score:         ${ahmadRisk?.score}  [TARGET: 0.82]`)
  console.log(`  Ahmad risk band:          ${ahmadRisk?.band}  [TARGET: HIGH_RISK]`)
  console.log(`  Ahmad absences14d:        ${ahmadRisk?.absences14d}  [TARGET: 22]`)
  console.log(`  Ahmad gradeAvg:           ${ahmadRisk?.gradeAvg}  [TARGET: 45]`)
  console.log(`  Aminah CPD hours:         ${aminahTeacher?.cpdHours}  [TARGET: 18]`)
  console.log(`  Hafiz className:          ${hafizCheck?.className}  [TARGET: 9C]`)
  console.log(`  Hafiz gradeLevel:         ${hafizCheck?.gradeLevel}  [TARGET: Year 9]`)

  // ─── Backfill schoolId for all SMHK data ─────────────────────────────────
  console.log('\nBackfilling SMHK schoolId for bulk-created entities...')
  await prisma.student.updateMany({ where: { schoolId: null }, data: { schoolId: smhk.id } })
  await prisma.course.updateMany({ where: { schoolId: null }, data: { schoolId: smhk.id } })
  await prisma.classRoster.updateMany({ where: { schoolId: null }, data: { schoolId: smhk.id } })
  console.log('Backfill done.')

  // ─── SRPB — MOE Primary School ────────────────────────────────────────────
  console.log('\nSeeding SRPB (MOE Primary)...')

  const srpbAdminUser = await prisma.user.create({
    data: { username: 'admin.srpb', password: hash('Demo@2026'), displayName: 'SRPB Admin', email: 'admin@srpb.edu.bn', role: 'admin', schoolId: srpb.id },
  })
  const srpbPrincipalUser = await prisma.user.create({
    data: { username: 'principal.srpb', password: hash('Demo@2026'), displayName: 'Pg Hajah Noraini Binti Pg Damit', email: 'principal@srpb.edu.bn', role: 'principal', schoolId: srpb.id },
  })
  const srpbTeacher1User = await prisma.user.create({
    data: { username: 'teacher.srpb1', password: hash('Demo@2026'), displayName: 'Cikgu Aisyah Binti Salleh', email: 'aisyah@srpb.edu.bn', role: 'teacher', schoolId: srpb.id },
  })
  const srpbTeacher2User = await prisma.user.create({
    data: { username: 'teacher.srpb2', password: hash('Demo@2026'), displayName: 'Cikgu Zulkifli Bin Omar', email: 'zulkifli@srpb.edu.bn', role: 'teacher', schoolId: srpb.id },
  })
  const srpbParentUser = await prisma.user.create({
    data: { username: 'parent.srpb', password: hash('Demo@2026'), displayName: 'Hjh Roslinda Binti Ahmad', email: 'roslinda@gmail.com', role: 'parent', schoolId: srpb.id },
  })

  await prisma.teacher.create({
    data: { userId: srpbTeacher1User.id, staffId: 'TS2026001', designation: 'Teacher', department: 'Primary Education', qualification: 'Bachelor of Education', subjects: 'Mathematics,Science', joinDate: new Date('2019-01-10'), cpdHours: 12, employmentStatus: 'active', schoolId: srpb.id },
  })
  const srpbTeacher2 = await prisma.teacher.create({
    data: { userId: srpbTeacher2User.id, staffId: 'TS2026002', designation: 'Teacher', department: 'Languages', qualification: 'Bachelor of Education (BM)', subjects: 'Bahasa Melayu,English', joinDate: new Date('2021-07-15'), cpdHours: 8, employmentStatus: 'active', schoolId: srpb.id },
  })

  // SRPB Courses (Year 1-6)
  await prisma.course.createMany({
    data: [
      { code: 'MATH101', name: 'Mathematics Year 1', gradeLevel: 'Year 1', creditHours: 4, schoolId: srpb.id },
      { code: 'BM101', name: 'Bahasa Melayu Year 1', gradeLevel: 'Year 1', creditHours: 4, schoolId: srpb.id },
      { code: 'MATH601', name: 'Mathematics Year 6', gradeLevel: 'Year 6', creditHours: 4, schoolId: srpb.id },
      { code: 'BM601', name: 'Bahasa Melayu Year 6', gradeLevel: 'Year 6', creditHours: 4, schoolId: srpb.id },
      { code: 'SCI601', name: 'Science Year 6', gradeLevel: 'Year 6', creditHours: 3, schoolId: srpb.id },
    ],
  })

  // SRPB Year 6 class (students eligible for primary→secondary transition)
  const srpbYear6Students: string[] = []
  for (let i = 0; i < 15; i++) {
    const { name, gender } = generateName(1000 + i)
    const srpbStudentUser = await prisma.user.create({
      data: { username: `srpb.y6.${i}`, password: hash('Demo@2026'), displayName: name, role: 'student', schoolId: srpb.id },
    })
    const srpbStudent = await prisma.student.create({
      data: {
        userId: srpbStudentUser.id,
        studentId: `SRPB6-${String(i + 1).padStart(3, '0')}`,
        gradeLevel: 'Year 6',
        className: '6A',
        gender,
        enrollmentStatus: 'enrolled',
        schoolId: srpb.id,
      },
    })
    srpbYear6Students.push(srpbStudent.id)
  }

  // SRPB Year 1 class
  for (let i = 0; i < 10; i++) {
    const { name, gender } = generateName(1100 + i)
    const u = await prisma.user.create({
      data: { username: `srpb.y1.${i}`, password: hash('Demo@2026'), displayName: name, role: 'student', schoolId: srpb.id },
    })
    await prisma.student.create({
      data: { userId: u.id, studentId: `SRPB1-${String(i + 1).padStart(3, '0')}`, gradeLevel: 'Year 1', className: '1A', gender, enrollmentStatus: 'enrolled', schoolId: srpb.id },
    })
  }

  // SRPB Class Rosters
  await prisma.classRoster.createMany({
    data: [
      { gradeLevel: 'Year 6', className: '6A', academicYear: '2025/2026', capacity: 30, programme: 'Standard', formTeacherId: srpbTeacher2.id, schoolId: srpb.id },
      { gradeLevel: 'Year 1', className: '1A', academicYear: '2025/2026', capacity: 30, programme: 'Standard', schoolId: srpb.id },
    ],
  })

  // Parent link
  const srpbParent = await prisma.parent.create({ data: { userId: srpbParentUser.id } })
  if (srpbYear6Students[0]) {
    await prisma.parentStudent.create({ data: { parentId: srpbParent.id, studentId: srpbYear6Students[0] } })
  }

  // ─── SMAB — MORA Secondary School ────────────────────────────────────────
  console.log('Seeding SMAB (MORA Secondary)...')

  await prisma.user.create({
    data: { username: 'admin.smab', password: hash('Demo@2026'), displayName: 'SMAB Admin', email: 'admin@smab.edu.bn', role: 'admin', schoolId: smab.id },
  })
  await prisma.user.create({
    data: { username: 'principal.smab', password: hash('Demo@2026'), displayName: 'Ustaz Hj Mahyuddin Bin Hj Sarawak', email: 'principal@smab.edu.bn', role: 'principal', schoolId: smab.id },
  })
  const smabTeacher1User = await prisma.user.create({
    data: { username: 'teacher.smab1', password: hash('Demo@2026'), displayName: 'Ustaz Hafizuddin Bin Daud', email: 'hafizuddin@smab.edu.bn', role: 'teacher', schoolId: smab.id },
  })
  await prisma.teacher.create({
    data: { userId: smabTeacher1User.id, staffId: 'TM2026001', designation: 'Teacher', department: 'Islamic Studies', qualification: 'BA Islamic Studies (UBD)', subjects: 'Quran,Fiqh,Tawhid', joinDate: new Date('2018-08-01'), cpdHours: 15, employmentStatus: 'active', schoolId: smab.id },
  })

  await prisma.course.createMany({
    data: [
      { code: 'QURAN301', name: 'Quran Tingkatan 3', gradeLevel: 'Tingkatan 3', creditHours: 3, schoolId: smab.id },
      { code: 'FIQH301', name: 'Fiqh Tingkatan 3', gradeLevel: 'Tingkatan 3', creditHours: 3, schoolId: smab.id },
      { code: 'MATH301', name: 'Mathematics Tingkatan 3', gradeLevel: 'Tingkatan 3', creditHours: 4, schoolId: smab.id },
      { code: 'BM301', name: 'Bahasa Melayu Tingkatan 3', gradeLevel: 'Tingkatan 3', creditHours: 4, schoolId: smab.id },
      { code: 'QURAN101', name: 'Quran Tingkatan 1', gradeLevel: 'Tingkatan 1', creditHours: 3, schoolId: smab.id },
    ],
  })

  for (let i = 0; i < 12; i++) {
    const { name, gender } = generateName(2000 + i)
    const u = await prisma.user.create({
      data: { username: `smab.t3.${i}`, password: hash('Demo@2026'), displayName: name, role: 'student', schoolId: smab.id },
    })
    await prisma.student.create({
      data: { userId: u.id, studentId: `SMAB3-${String(i + 1).padStart(3, '0')}`, gradeLevel: 'Tingkatan 3', className: 'Alif', gender, enrollmentStatus: 'enrolled', schoolId: smab.id },
    })
  }

  await prisma.classRoster.createMany({
    data: [
      { gradeLevel: 'Tingkatan 3', className: 'Alif-T3', academicYear: '2025/2026', capacity: 25, programme: 'Religious', schoolId: smab.id },
      { gradeLevel: 'Tingkatan 1', className: 'Alif-T1', academicYear: '2025/2026', capacity: 25, programme: 'Religious', schoolId: smab.id },
    ],
  })

  // ─── ISB — Private International School ──────────────────────────────────
  console.log('Seeding ISB (Private International)...')

  await prisma.user.create({
    data: { username: 'admin.isb', password: hash('Demo@2026'), displayName: 'ISB Admin', email: 'admin@isb.edu.bn', role: 'admin', schoolId: isb.id },
  })
  await prisma.user.create({
    data: { username: 'principal.isb', password: hash('Demo@2026'), displayName: 'Ms. Eleanor Whitfield', email: 'principal@isb.edu.bn', role: 'principal', schoolId: isb.id },
  })
  const isbTeacher1User = await prisma.user.create({
    data: { username: 'teacher.isb1', password: hash('Demo@2026'), displayName: 'Mr. James Thornton', email: 'james@isb.edu.bn', role: 'teacher', schoolId: isb.id },
  })
  await prisma.teacher.create({
    data: { userId: isbTeacher1User.id, staffId: 'TI2026001', designation: 'Subject Teacher', department: 'Mathematics', qualification: 'BSc Mathematics, University of Nottingham', subjects: 'Mathematics,Further Mathematics', joinDate: new Date('2020-08-01'), cpdHours: 18, employmentStatus: 'active', schoolId: isb.id },
  })

  await prisma.course.createMany({
    data: [
      { code: 'IB-MATH11', name: 'IB Mathematics Grade 11', gradeLevel: 'Grade 11', creditHours: 4, schoolId: isb.id },
      { code: 'IB-ENG11', name: 'IB English Grade 11', gradeLevel: 'Grade 11', creditHours: 4, schoolId: isb.id },
      { code: 'IB-SCI11', name: 'IB Science Grade 11', gradeLevel: 'Grade 11', creditHours: 3, schoolId: isb.id },
    ],
  })

  for (let i = 0; i < 10; i++) {
    const { name, gender } = generateName(3000 + i)
    const u = await prisma.user.create({
      data: { username: `isb.g11.${i}`, password: hash('Demo@2026'), displayName: name, role: 'student', schoolId: isb.id },
    })
    await prisma.student.create({
      data: { userId: u.id, studentId: `ISB11-${String(i + 1).padStart(3, '0')}`, gradeLevel: 'Grade 11', className: 'Alpha', gender, enrollmentStatus: 'enrolled', schoolId: isb.id },
    })
  }

  await prisma.classRoster.create({
    data: { gradeLevel: 'Grade 11', className: 'Alpha', academicYear: '2025/2026', capacity: 20, programme: 'IB', schoolId: isb.id },
  })

  // ─── Transition Records (Primary → Secondary) ─────────────────────────────
  console.log('Seeding transition records...')

  // Plan: Year 6 SRPB students → SMHK Year 7 (2026/2027 academic year)
  const transitionStudents = srpbYear6Students.slice(0, 5)
  for (const studentId of transitionStudents) {
    await prisma.studentTransition.create({
      data: {
        studentId,
        fromSchoolId: srpb.id,
        toSchoolId: smhk.id,
        fromGradeLevel: 'Year 6',
        toGradeLevel: 'Year 7',
        fromClassName: '6A',
        transitionType: 'PRIMARY_TO_SECONDARY',
        academicYear: '2026/2027',
        effectiveDate: new Date('2026-07-01'),
        status: 'planned',
        notes: 'Eligible for secondary school enrollment at SMHK Year 7',
      },
    })
  }

  // 2 students with approved transition
  if (srpbYear6Students[5] && srpbYear6Students[6]) {
    for (const studentId of [srpbYear6Students[5], srpbYear6Students[6]]) {
      await prisma.studentTransition.create({
        data: {
          studentId,
          fromSchoolId: srpb.id,
          toSchoolId: smhk.id,
          fromGradeLevel: 'Year 6',
          toGradeLevel: 'Year 7',
          fromClassName: '6A',
          transitionType: 'PRIMARY_TO_SECONDARY',
          academicYear: '2026/2027',
          effectiveDate: new Date('2026-07-01'),
          status: 'approved',
          notes: 'Approved — secondary school placement confirmed',
        },
      })
    }
  }

  // Grade promotion within SMHK (Year 10 → Year 11 — planned for next year)
  const smhkYear10Students = await prisma.student.findMany({
    where: { schoolId: smhk.id, gradeLevel: 'Year 10', enrollmentStatus: 'enrolled' },
    take: 5,
  })
  for (const s of smhkYear10Students) {
    await prisma.studentTransition.create({
      data: {
        studentId: s.id,
        fromSchoolId: smhk.id,
        toSchoolId: smhk.id,
        fromGradeLevel: 'Year 10',
        toGradeLevel: 'Year 11',
        fromClassName: s.className ?? undefined,
        transitionType: 'GRADE_PROMOTION',
        academicYear: '2026/2027',
        effectiveDate: new Date('2026-07-01'),
        status: 'planned',
      },
    })
  }

  console.log(`  Transitions created: ${5 + 2 + smhkYear10Students.length}`)

  // ─── Non-Teaching Staff (SMHK) ───────────────────────────────────────────
  console.log('Seeding non-teaching staff...')

  const ntSecretaryUser = await prisma.user.create({
    data: { username: 'staff.secretary', password: hash('Demo@2026'), displayName: 'Cik Rosnah Binti Hamid', email: 'rosnah@smhk.edu.bn', role: 'admin', schoolId: smhk.id },
  })
  await prisma.teacher.create({
    data: { userId: ntSecretaryUser.id, staffId: 'NT2026001', designation: 'School Secretary', department: 'Administration', qualification: 'Diploma in Business Administration', subjects: '', joinDate: new Date('2015-03-01'), cpdHours: 0, cpdTarget: 0, employmentStatus: 'active', staffType: 'ADMINISTRATIVE', schoolId: smhk.id },
  })

  const ntLibrarianUser = await prisma.user.create({
    data: { username: 'staff.librarian', password: hash('Demo@2026'), displayName: 'Cik Hidayah Binti Rosli', email: 'hidayah@smhk.edu.bn', role: 'admin', schoolId: smhk.id },
  })
  await prisma.teacher.create({
    data: { userId: ntLibrarianUser.id, staffId: 'NT2026002', designation: 'Librarian', department: 'Library', qualification: 'Diploma in Library Science', subjects: '', joinDate: new Date('2018-08-01'), cpdHours: 0, cpdTarget: 0, employmentStatus: 'active', staffType: 'SUPPORT', schoolId: smhk.id },
  })

  const ntSecurityUser = await prisma.user.create({
    data: { username: 'staff.security', password: hash('Demo@2026'), displayName: 'Awang Matnor Bin Salleh', email: 'matnor@smhk.edu.bn', role: 'admin', schoolId: smhk.id },
  })
  await prisma.teacher.create({
    data: { userId: ntSecurityUser.id, staffId: 'NT2026003', designation: 'Security Guard', department: 'Security', qualification: 'Certificate in Security Management', subjects: '', joinDate: new Date('2020-01-15'), cpdHours: 0, cpdTarget: 0, employmentStatus: 'active', staffType: 'SECURITY', schoolId: smhk.id },
  })

  const ntDriverUser = await prisma.user.create({
    data: { username: 'staff.driver', password: hash('Demo@2026'), displayName: 'Awang Saiful Bin Awang Damit', email: 'saiful@smhk.edu.bn', role: 'admin', schoolId: smhk.id },
  })
  await prisma.teacher.create({
    data: { userId: ntDriverUser.id, staffId: 'NT2026004', designation: 'School Driver', department: 'Operations', qualification: 'Class 3 Driving License', subjects: '', joinDate: new Date('2022-06-01'), cpdHours: 0, cpdTarget: 0, employmentStatus: 'active', staffType: 'SUPPORT', schoolId: smhk.id },
  })

  // ─── Integration Logs (SIM-IL) ───────────────────────────────────────────
  console.log('Seeding integration logs...')

  const integrationSystems = [
    { system: 'BRUNEI_ID', endpoint: '/api/brunei-id/verify-citizen', payloadSize: 1240 },
    { system: 'EGNC',      endpoint: '/api/egnc/sync-staff-records',  payloadSize: 8450 },
    { system: 'NIH',       endpoint: '/api/nih/push-attendance-stats', payloadSize: 22800 },
    { system: 'SSM',       endpoint: '/api/ssm/sync-leave-balances',   payloadSize: 4120 },
    { system: 'KOHA',      endpoint: '/api/koha/z3950/sync-catalogue', payloadSize: 31500 },
  ]

  for (const sys of integrationSystems) {
    for (let i = 0; i < 5; i++) {
      const minsAgo = (i + 1) * 18 + Math.floor(Math.random() * 10)
      const createdAt = new Date(Date.now() - minsAgo * 60 * 1000)
      await prisma.integrationLog.create({
        data: {
          system: sys.system,
          endpoint: sys.endpoint,
          payloadSize: sys.payloadSize + Math.floor(Math.random() * 1000 - 500),
          status: i === 2 ? 'error' : 'success',
          triggeredBy: 'system',
          createdAt,
        },
      })
    }
  }

  // ─── Exam Management (PSR 2026 at SRPB) ─────────────────────────────────
  console.log('Seeding exam data...')

  const psrExam = await prisma.exam.create({
    data: {
      schoolId: srpb.id,
      examType: 'PSR',
      year: 2026,
      examDate: new Date('2026-09-15T08:00:00Z'),
      venue: 'SRPB Main Hall',
      status: 'upcoming',
    },
  })

  const psrSubjects = ['ENG', 'MAL', 'MATH', 'SCI']
  const psrSubjectNames: Record<string, string> = { ENG: 'English', MAL: 'Bahasa Melayu', MATH: 'Mathematics', SCI: 'Science' }
  let seatCounter = 1

  for (const studentId of srpbYear6Students) {
    for (const subjectCode of psrSubjects) {
      const seatNum = `A${String(seatCounter).padStart(3, '0')}`
      await prisma.examCandidate.create({
        data: {
          examId: psrExam.id,
          studentId,
          subjectCode,
          seatNumber: seatNum,
          status: 'registered',
        },
      })
      seatCounter++
    }
  }

  console.log(`  PSR exam seeded: ${srpbYear6Students.length} candidates × ${psrSubjects.length} subjects = ${srpbYear6Students.length * psrSubjects.length} rows`)

  // ─── Exam Management (O-Level & Year-End at SMHK) ────────────────────────
  const smhkYear11Students = await prisma.student.findMany({
    where: { schoolId: smhk.id, gradeLevel: 'Year 11', enrollmentStatus: 'enrolled' },
    select: { id: true },
    take: 30,
  })
  const smhkYear7Students = await prisma.student.findMany({
    where: { schoolId: smhk.id, gradeLevel: 'Year 7', enrollmentStatus: 'enrolled' },
    select: { id: true },
    take: 30,
  })
  const oLevelExam = await prisma.exam.create({
    data: {
      schoolId: smhk.id,
      examType: 'O_LEVEL',
      year: 2026,
      examDate: new Date('2026-07-06T08:00:00'),
      venue: 'SMHK Main Examination Hall',
      status: 'upcoming',
    },
  })
  const oLevelSubjects = ['ENG', 'MAL', 'MATH', 'PHY', 'CHEM', 'BIO']
  let oSeat = 1
  for (const stu of smhkYear11Students) {
    for (const sub of oLevelSubjects) {
      try {
        await prisma.examCandidate.create({
          data: {
            examId: oLevelExam.id,
            studentId: stu.id,
            subjectCode: sub,
            seatNumber: `B${String(oSeat).padStart(3, '0')}`,
            status: 'registered',
          },
        })
        oSeat++
      } catch (_) { /* skip duplicates */ }
    }
  }
  const semExam = await prisma.exam.create({
    data: {
      schoolId: smhk.id,
      examType: 'O_LEVEL',
      year: 2026,
      examDate: new Date('2026-09-07T08:00:00'),
      venue: 'SMHK Classrooms',
      status: 'upcoming',
    },
  })
  const semSubjects = ['MATH', 'ENG', 'SCI']
  let sSeat = 1
  for (const stu of smhkYear7Students) {
    for (const sub of semSubjects) {
      try {
        await prisma.examCandidate.create({
          data: {
            examId: semExam.id,
            studentId: stu.id,
            subjectCode: sub,
            seatNumber: `C${String(sSeat).padStart(3, '0')}`,
            status: 'registered',
          },
        })
        sSeat++
      } catch (_) { /* skip duplicates */ }
    }
  }
  console.log(`  SMHK exams seeded: O-Level (${smhkYear11Students.length} Year 11 × ${oLevelSubjects.length} subjects), Semester (${smhkYear7Students.length} Year 7 × ${semSubjects.length} subjects)`)

  // ─── SEN / Special Education ─────────────────────────────────────────────
  console.log('Seeding SEN data...')

  // SEN Student 1: Ahmad (DYSLEXIA, Level 2)
  const senAhmad = await prisma.senStudent.create({
    data: {
      studentId: ahmad.id,
      diagnosisType: 'DYSLEXIA',
      supportLevel: 'LEVEL_2',
      notes: 'Ahmad demonstrates difficulty with reading and written tasks. Benefits from extended time and text-to-speech support.',
    },
  })

  await prisma.iepGoal.createMany({
    data: [
      {
        senStudentId: senAhmad.id,
        subject: 'English',
        description: 'Improve reading fluency from 45 wpm to 80 wpm using decodable text strategies within 3 months',
        targetDate: new Date('2026-08-31'),
        status: 'active',
      },
      {
        senStudentId: senAhmad.id,
        subject: 'Mathematics',
        description: 'Independently solve 2-step word problems with 80% accuracy using graphic organizers',
        targetDate: new Date('2026-07-31'),
        status: 'active',
      },
      {
        senStudentId: senAhmad.id,
        subject: 'General',
        description: 'Use text-to-speech assistive technology independently during all written assessments',
        targetDate: new Date('2026-06-30'),
        status: 'achieved',
      },
    ],
  })

  await prisma.iepSessionLog.createMany({
    data: [
      {
        senStudentId: senAhmad.id,
        date: daysAgo(28),
        durationMins: 45,
        conductedBy: farahUser.id,
        notes: 'Initial assessment session. Ahmad engaged well. Identified phonological awareness gaps.',
      },
      {
        senStudentId: senAhmad.id,
        date: daysAgo(21),
        durationMins: 45,
        conductedBy: farahUser.id,
        notes: 'Introduced Orton-Gillingham reading strategies. Ahmad completed 2 decodable texts with prompting.',
      },
      {
        senStudentId: senAhmad.id,
        date: daysAgo(14),
        durationMins: 45,
        conductedBy: farahUser.id,
        notes: 'Reading fluency check: 52 wpm (up from 45 wpm). Ahmad is responding positively to multisensory techniques.',
      },
      {
        senStudentId: senAhmad.id,
        date: daysAgo(7),
        durationMins: 30,
        conductedBy: farahUser.id,
        notes: 'Reviewed text-to-speech tool setup on school iPad. Ahmad used it independently for the first time. Goal 3 marked achieved.',
      },
    ],
  })

  // SEN Student 2: Hafiz (AUTISM, Level 3)
  const senHafiz = await prisma.senStudent.create({
    data: {
      studentId: hafiz.id,
      diagnosisType: 'AUTISM',
      supportLevel: 'LEVEL_3',
      notes: 'Hafiz requires a structured and predictable learning environment. Strong in mathematics; challenges with social communication and transitions between activities.',
    },
  })

  await prisma.iepGoal.createMany({
    data: [
      {
        senStudentId: senHafiz.id,
        subject: 'Social Skills',
        description: 'Initiate a greeting with at least 3 different peers per day in structured settings with visual prompt card',
        targetDate: new Date('2026-09-30'),
        status: 'active',
      },
      {
        senStudentId: senHafiz.id,
        subject: 'Self-Regulation',
        description: 'Use the calming corner independently when identifying emotional escalation, without adult prompting, 4 out of 5 times',
        targetDate: new Date('2026-08-31'),
        status: 'active',
      },
    ],
  })

  await prisma.iepSessionLog.createMany({
    data: [
      {
        senStudentId: senHafiz.id,
        date: daysAgo(14),
        durationMins: 60,
        conductedBy: farahUser.id,
        notes: 'Introduced visual schedule board. Hafiz responded well to the predictable structure. Minor transition difficulty at the 30-minute mark.',
      },
      {
        senStudentId: senHafiz.id,
        date: daysAgo(7),
        durationMins: 60,
        conductedBy: farahUser.id,
        notes: 'Practiced greeting script using social story cards. Hafiz greeted 2 peers independently. Continuing to build consistency.',
      },
    ],
  })

  // ─── Library ─────────────────────────────────────────────────────────────
  console.log('Seeding library data...')

  const libraryBooksData = [
    { title: 'The Alchemist', author: 'Paulo Coelho', category: 'Fiction', totalCopies: 3, availableCopies: 2, isbn: '978-0062315007', kohaId: 'KOHA-0001' },
    { title: 'A Brief History of Time', author: 'Stephen Hawking', category: 'Science', totalCopies: 2, availableCopies: 2, isbn: '978-0553380163', kohaId: 'KOHA-0002' },
    { title: 'Brunei History and Culture', author: 'Dato D.S. Ranjit Singh', category: 'History', totalCopies: 4, availableCopies: 4, isbn: '978-9991705699', kohaId: 'KOHA-0003' },
    { title: 'Mathematics for O-Level', author: 'Chan Boon Tat', category: 'Textbook', totalCopies: 10, availableCopies: 9, isbn: '978-9814253024', kohaId: 'KOHA-0004' },
    { title: 'English Grammar in Use', author: 'Raymond Murphy', category: 'Reference', totalCopies: 5, availableCopies: 5, isbn: '978-1107539334', kohaId: 'KOHA-0005' },
    { title: 'Totto-chan: The Little Girl at the Window', author: 'Tetsuko Kuroyanagi', category: 'Fiction', totalCopies: 2, availableCopies: 2, isbn: '978-4062019019', kohaId: 'KOHA-0006' },
    { title: 'The Diary of a Young Girl', author: 'Anne Frank', category: 'Biography', totalCopies: 2, availableCopies: 1, isbn: '978-0553577129', kohaId: 'KOHA-0007' },
    { title: 'Biology for Cambridge IGCSE', author: 'D.G. Mackean', category: 'Textbook', totalCopies: 8, availableCopies: 8, isbn: '978-1444176360', kohaId: 'KOHA-0008' },
    { title: 'Chemistry: A Molecular Approach', author: 'Nivaldo Tro', category: 'Textbook', totalCopies: 6, availableCopies: 6, isbn: '978-0134112831', kohaId: 'KOHA-0009' },
    { title: 'Malay Language and Literature', author: 'Abdullah Hassan', category: 'Textbook', totalCopies: 8, availableCopies: 8, isbn: '978-9835000000', kohaId: 'KOHA-0010' },
    { title: 'National Geographic: Planet Earth', author: 'David Attenborough', category: 'Science', totalCopies: 2, availableCopies: 2, isbn: '978-1426200069', kohaId: 'KOHA-0011' },
    { title: 'The Art of War', author: 'Sun Tzu', category: 'Philosophy', totalCopies: 3, availableCopies: 3, isbn: '978-1590302255', kohaId: 'KOHA-0012' },
    { title: 'Sherlock Holmes: Complete Stories', author: 'Arthur Conan Doyle', category: 'Fiction', totalCopies: 2, availableCopies: 2, isbn: '978-0785833918', kohaId: 'KOHA-0013' },
    { title: 'Physics for Scientists and Engineers', author: 'Serway & Jewett', category: 'Textbook', totalCopies: 6, availableCopies: 6, isbn: '978-1133947271', kohaId: 'KOHA-0014' },
    { title: 'Introduction to Algorithms', author: 'Cormen et al.', category: 'Textbook', totalCopies: 3, availableCopies: 3, isbn: '978-0262033848', kohaId: 'KOHA-0015' },
    { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', category: 'History', totalCopies: 3, availableCopies: 2, isbn: '978-0062316097', kohaId: 'KOHA-0016' },
    { title: 'Rich Dad Poor Dad', author: 'Robert Kiyosaki', category: 'Non-Fiction', totalCopies: 2, availableCopies: 2, isbn: '978-1612680194', kohaId: 'KOHA-0017' },
    { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', category: 'Non-Fiction', totalCopies: 2, availableCopies: 2, isbn: '978-0374533557', kohaId: 'KOHA-0018' },
    { title: 'The Old Man and the Sea', author: 'Ernest Hemingway', category: 'Fiction', totalCopies: 3, availableCopies: 3, isbn: '978-0684801223', kohaId: 'KOHA-0019' },
    { title: 'Geografi untuk SPM', author: 'Mohd Fadzil Hassan', category: 'Textbook', totalCopies: 5, availableCopies: 5, isbn: '978-9830082264', kohaId: 'KOHA-0020' },
  ]

  const createdBooks: { id: string; availableCopies: number }[] = []
  for (const b of libraryBooksData) {
    const book = await prisma.libraryBook.create({ data: { ...b, schoolId: smhk.id } })
    createdBooks.push({ id: book.id, availableCopies: b.availableCopies })
  }

  // 5 loans: 3 active (future due), 2 overdue (past due, not yet returned)
  const loanData = [
    { bookIdx: 0, studentId: ahmad.id,  borrowedDaysAgo: 5,  dueDaysFromNow: 9  }, // active
    { bookIdx: 3, studentId: adam.id,   borrowedDaysAgo: 8,  dueDaysFromNow: 6  }, // active
    { bookIdx: 6, studentId: nurul.id,  borrowedDaysAgo: 20, dueDaysFromNow: -6 }, // overdue (6 days past due)
    { bookIdx: 9, studentId: hafiz.id,  borrowedDaysAgo: 25, dueDaysFromNow: -11 }, // overdue (11 days past due)
    { bookIdx: 15, studentId: fatin.id, borrowedDaysAgo: 3,  dueDaysFromNow: 11 }, // active
  ]

  for (const loan of loanData) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + loan.dueDaysFromNow)
    dueDate.setHours(23, 59, 0, 0)

    const overdueDays = loan.dueDaysFromNow < 0 ? Math.abs(loan.dueDaysFromNow) : 0
    const fineAmount = overdueDays > 0 ? parseFloat((overdueDays * 0.10).toFixed(2)) : 0

    await prisma.libraryLoan.create({
      data: {
        bookId: createdBooks[loan.bookIdx].id,
        studentId: loan.studentId,
        borrowedAt: daysAgo(loan.borrowedDaysAgo),
        dueDate,
        returnedAt: null,
        fineAmount,
      },
    })
    // Decrement availableCopies for the book used (already reflected in seed data above)
  }

  // 3 holds on books with limited availability
  await prisma.libraryHold.createMany({
    data: [
      { bookId: createdBooks[6].id,  studentId: adam.id,  status: 'waiting' },  // Diary of a Young Girl (1 available, but Ahmad has a loan — so this is a preemptive hold)
      { bookId: createdBooks[15].id, studentId: ahmad.id, status: 'ready' },     // Sapiens — notified ready
      { bookId: createdBooks[0].id,  studentId: hafiz.id, status: 'waiting' },   // The Alchemist (waiting)
    ],
  })

  // ─── Inventory / Assets ───────────────────────────────────────────────────
  console.log('Seeding inventory data...')

  const catFurniture = await prisma.assetCategory.create({
    data: { name: 'Furniture', description: 'Chairs, tables, shelving, cabinets', schoolId: smhk.id },
  })
  const catIT = await prisma.assetCategory.create({
    data: { name: 'IT Equipment', description: 'Computers, projectors, printers, tablets', schoolId: smhk.id },
  })
  const catSports = await prisma.assetCategory.create({
    data: { name: 'Sports Equipment', description: 'Balls, nets, athletic equipment', schoolId: smhk.id },
  })

  const assetsData = [
    // Furniture (4) — index 0-3
    { assetTag: 'FUR-2023-0001', name: 'Student Desk (Set of 10)', categoryId: catFurniture.id, location: 'Classroom 7A', condition: 'Good', purchaseDate: new Date('2023-01-15'), value: 1200.0 },
    { assetTag: 'FUR-2021-0002', name: 'Whiteboard (3m×1.2m)', categoryId: catFurniture.id, location: 'Classroom 8B', condition: 'Fair', purchaseDate: new Date('2021-08-01'), value: 450.0 },
    { assetTag: 'FUR-2019-0003', name: 'Library Bookshelf (6-tier)', categoryId: catFurniture.id, location: 'Library', condition: 'Fair', purchaseDate: new Date('2019-03-10'), value: 320.0 },
    { assetTag: 'FUR-2018-0004', name: 'Principal Office Chair', categoryId: catFurniture.id, location: 'Principal Office', condition: 'Poor', purchaseDate: new Date('2018-06-01'), value: 250.0 },
    // IT Equipment (4) — index 4-7
    { assetTag: 'IT-2024-0005', name: 'Dell Optiplex Desktop PC', categoryId: catIT.id, location: 'ICT Lab', condition: 'Good', purchaseDate: new Date('2024-02-01'), value: 1800.0 },
    { assetTag: 'IT-2022-0006', name: 'Epson Projector EB-X49', categoryId: catIT.id, location: 'Classroom 9A', condition: 'Good', purchaseDate: new Date('2022-08-15'), value: 950.0 },
    { assetTag: 'IT-2022-0007', name: 'Epson Projector EB-X49', categoryId: catIT.id, location: 'Classroom 10B', condition: 'Fair', purchaseDate: new Date('2022-08-15'), value: 950.0 },
    { assetTag: 'IT-2019-0008', name: 'Samsung Smart TV 55"', categoryId: catIT.id, location: 'Staff Room', condition: 'Good', purchaseDate: new Date('2019-07-20'), value: 1100.0 },
    // Sports Equipment (4) — index 8-11
    { assetTag: 'SPT-2023-0009', name: 'Football (Size 5) ×10', categoryId: catSports.id, location: 'Sports Storeroom', condition: 'Good', purchaseDate: new Date('2023-09-01'), value: 300.0 },
    { assetTag: 'SPT-2023-0010', name: 'Badminton Racket Set ×20', categoryId: catSports.id, location: 'Sports Storeroom', condition: 'Good', purchaseDate: new Date('2023-09-01'), value: 480.0 },
    { assetTag: 'SPT-2021-0011', name: 'Basketball Hoop (portable)', categoryId: catSports.id, location: 'Gymnasium', condition: 'Fair', purchaseDate: new Date('2021-04-15'), value: 350.0 },
    { assetTag: 'SPT-2017-0012', name: 'High Jump Mat', categoryId: catSports.id, location: 'Sports Field', condition: 'Poor', purchaseDate: new Date('2017-01-10'), value: 600.0 },
  ]

  const createdAssets: { id: string }[] = []
  for (const a of assetsData) {
    const asset = await prisma.asset.create({ data: { ...a, schoolId: smhk.id } })
    createdAssets.push({ id: asset.id })
  }

  // 4 maintenance log entries
  await prisma.assetMaintenanceLog.createMany({
    data: [
      {
        assetId: createdAssets[3].id, // Principal Office Chair
        date: daysAgo(90),
        type: 'Repair',
        cost: 45.0,
        conductedBy: 'Awang Saiful (Driver)',
        notes: 'Replaced gas lift cylinder. Chair still showing wear on armrests.',
      },
      {
        assetId: createdAssets[4].id, // Dell Optiplex Desktop PC
        date: daysAgo(30),
        type: 'Service',
        cost: 0,
        conductedBy: 'ICT Department',
        notes: 'Annual OS update and disk cleanup. RAM upgraded from 8GB to 16GB.',
      },
      {
        assetId: createdAssets[6].id, // Epson Projector 10B
        date: daysAgo(14),
        type: 'Repair',
        cost: 120.0,
        conductedBy: 'Epson Service Centre',
        notes: 'Lamp replacement. Projector now operational. Previous lamp ran 3,200 hours.',
      },
      {
        assetId: createdAssets[11].id, // High Jump Mat
        date: daysAgo(7),
        type: 'Inspection',
        cost: 0,
        conductedBy: 'PE Department',
        notes: 'Annual safety inspection. Mat shows significant foam degradation. Recommend replacement in next budget cycle.',
      },
    ],
  })

  // ─── Brunei 2026 Public Holidays ──────────────────────────────────────────
  console.log('Seeding Brunei 2026 public holidays...')

  await prisma.publicHoliday.deleteMany({})
  await prisma.publicHoliday.createMany({
    data: [
      { date: new Date('2026-01-01'), name: "New Year's Day" },
      { date: new Date('2026-01-22'), name: 'Chinese New Year' },
      { date: new Date('2026-02-23'), name: 'National Day' },
      { date: new Date('2026-03-20'), name: 'Nuzul Al-Quran' },
      { date: new Date('2026-03-30'), name: 'Hari Raya Aidilfitri (Day 1)' },
      { date: new Date('2026-03-31'), name: 'Hari Raya Aidilfitri (Day 2)' },
      { date: new Date('2026-04-01'), name: 'Hari Raya Aidilfitri (Day 3)' },
      { date: new Date('2026-05-31'), name: 'Royal Brunei Armed Forces Day' },
      { date: new Date('2026-06-07'), name: 'Hari Raya Aidiladha' },
      { date: new Date('2026-06-15'), name: "Sultan's Birthday" },
      { date: new Date('2026-06-27'), name: 'Awal Muharram (Islamic New Year)' },
      { date: new Date('2026-09-05'), name: "Prophet Muhammad's Birthday (Maulidur Rasul)" },
      { date: new Date('2026-12-25'), name: 'Christmas Day' },
    ],
  })

  // ─── Module 5: Financial Aid, Hostel, Bus Records ────────────────────────
  console.log('Seeding Module 5 student support records...')

  const enrolledStudents = await prisma.student.findMany({
    where: { enrollmentStatus: 'enrolled' },
    orderBy: { studentId: 'asc' },
    take: 30,
    select: { id: true },
  })

  if (enrolledStudents.length > 0) {
    // Financial Aid — 8 students
    await prisma.financialAid.deleteMany({})
    const aidRecords = [
      { aidType: 'SCHOLARSHIP', amount: 1200.0, notes: 'MOE Academic Excellence Scholarship 2026' },
      { aidType: 'BURSARY', amount: 600.0, notes: 'Ministry Hardship Bursary' },
      { aidType: 'MEAL_SUBSIDY', amount: 240.0, notes: 'Subsidised canteen meals — Term 1 & 2' },
      { aidType: 'BOOK_ALLOWANCE', amount: 150.0, notes: 'Textbook allowance 2025/2026' },
      { aidType: 'SCHOLARSHIP', amount: 1200.0, notes: 'School Council Scholarship' },
      { aidType: 'BURSARY', amount: 800.0, notes: 'Single-parent household bursary' },
      { aidType: 'MEAL_SUBSIDY', amount: 240.0, notes: 'Subsidised canteen meals' },
      { aidType: 'BOOK_ALLOWANCE', amount: 150.0, notes: 'Textbook allowance' },
    ]
    for (let i = 0; i < Math.min(aidRecords.length, enrolledStudents.length); i++) {
      await prisma.financialAid.create({
        data: {
          studentId: enrolledStudents[i].id,
          ...aidRecords[i],
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          approvedDate: new Date('2025-12-15'),
          eligibilityStatus: 'active',
        },
      })
    }

    // Hostel Records — 5 students
    await prisma.hostelRecord.deleteMany({})
    const hostelData = [
      { hostelName: 'Asrama Negara A', roomNumber: 'A101', emergencyContact: '+673 811 0001' },
      { hostelName: 'Asrama Negara A', roomNumber: 'A102', emergencyContact: '+673 811 0002' },
      { hostelName: 'Asrama Negara B', roomNumber: 'B201', emergencyContact: '+673 822 0001' },
      { hostelName: 'Asrama Negara B', roomNumber: 'B202', emergencyContact: '+673 822 0002' },
      { hostelName: 'Asrama Utama',    roomNumber: 'U305', emergencyContact: '+673 855 0001' },
    ]
    const hostelStudents = enrolledStudents.slice(10, 15)
    for (let i = 0; i < Math.min(hostelData.length, hostelStudents.length); i++) {
      await prisma.hostelRecord.upsert({
        where: { studentId: hostelStudents[i].id },
        update: { ...hostelData[i], checkInDate: new Date('2026-01-06'), semester: '2026-S1', status: 'active' },
        create: { studentId: hostelStudents[i].id, ...hostelData[i], checkInDate: new Date('2026-01-06'), semester: '2026-S1' },
      })
    }

    // Bus Records — 8 students
    await prisma.busRecord.deleteMany({})
    const busData = [
      { busRoute: 'Route 1 — Bandar to Berakas', busNumber: 'BUS-001', provider: 'MOE Transport', pickupPoint: 'Jalan Gadong', dropoffPoint: 'School Main Gate' },
      { busRoute: 'Route 1 — Bandar to Berakas', busNumber: 'BUS-001', provider: 'MOE Transport', pickupPoint: 'Kiulap Roundabout', dropoffPoint: 'School Main Gate' },
      { busRoute: 'Route 2 — Tutong Highway', busNumber: 'BUS-002', provider: 'MOE Transport', pickupPoint: 'Mulaut Junction', dropoffPoint: 'School Side Gate' },
      { busRoute: 'Route 2 — Tutong Highway', busNumber: 'BUS-002', provider: 'MOE Transport', pickupPoint: 'Kg Lamunin', dropoffPoint: 'School Side Gate' },
      { busRoute: 'Route 3 — Seria / KB', busNumber: 'BUS-003', provider: 'JPBD Charter', pickupPoint: 'Seria Town', dropoffPoint: 'School Main Gate' },
      { busRoute: 'Route 3 — Seria / KB', busNumber: 'BUS-003', provider: 'JPBD Charter', pickupPoint: 'Kuala Belait', dropoffPoint: 'School Main Gate' },
      { busRoute: 'Route 4 — Kuala Belait', busNumber: 'BUS-004', provider: 'MOE Transport', pickupPoint: 'Jln Bunga Raya', dropoffPoint: 'School Main Gate' },
      { busRoute: 'Route 4 — Kuala Belait', busNumber: 'BUS-004', provider: 'MOE Transport', pickupPoint: 'Sg Liang', dropoffPoint: 'School Main Gate' },
    ]
    const busStudents = enrolledStudents.slice(15, 23)
    for (let i = 0; i < Math.min(busData.length, busStudents.length); i++) {
      await prisma.busRecord.upsert({
        where: { studentId: busStudents[i].id },
        update: { ...busData[i], semester: '2026-S1', status: 'active' },
        create: { studentId: busStudents[i].id, ...busData[i], semester: '2026-S1' },
      })
    }
  }

  // ─── Module 8: Parent-Teacher Communication — Consent Forms ──────────────
  console.log('Seeding Module 8 consent forms...')

  // Get school admin (not sysadmin — needs a schoolId to target the right students)
  const adminForComms = await prisma.user.findFirst({ where: { role: 'admin', schoolId: { not: null } }, select: { id: true, schoolId: true } })
    ?? await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true, schoolId: true } })
  if (adminForComms) {
    // Delete old consent forms
    await prisma.consentFormRecipient.deleteMany({})
    await prisma.consentForm.deleteMany({})

    const seedForms = [
      {
        title: 'Field Trip to Brunei Museum — Year 8 Permission Slip',
        description: 'We are pleased to invite Year 8 students to a guided educational visit to the Brunei Museum on 20 June 2026. The trip will run from 8:00 AM to 1:00 PM. Students will be accompanied by three teachers. A packed lunch will be required. Please acknowledge this form to confirm your child\'s participation and to grant permission for the visit. Medical supervision will be available on-site.',
        type: 'FIELD_TRIP',
        status: 'ACTIVE',
        dueDate: new Date('2026-06-15'),
        targetGradeLevel: 'Year 8',
        schoolId: adminForComms.schoolId,
        createdById: adminForComms.id,
      },
      {
        title: 'School Photography & Media Release 2026',
        description: 'Throughout the 2025/2026 academic year, the school may take photographs and videos of students during school activities, events, and daily school life. These images may be used in the school newsletter, official website, social media, and MOE publications. Please acknowledge this form to grant permission for your child\'s image to be used for these purposes. You may opt out at any time by contacting the school admin.',
        type: 'PHOTO_RELEASE',
        status: 'ACTIVE',
        dueDate: new Date('2026-06-30'),
        targetGradeLevel: null,
        schoolId: adminForComms.schoolId,
        createdById: adminForComms.id,
      },
      {
        title: 'Updated Student Code of Conduct 2026 — Parent Acknowledgment',
        description: 'The school has updated the Student Code of Conduct for the 2025/2026 academic year. Key updates include revised guidelines on mobile phone use, updated attendance policies, and new expectations for online learning conduct. Please read the attached document carefully and acknowledge this form to confirm that you have reviewed the updated Code of Conduct with your child.',
        type: 'POLICY_ACKNOWLEDGMENT',
        status: 'CLOSED',
        dueDate: new Date('2026-02-28'),
        targetGradeLevel: null,
        schoolId: adminForComms.schoolId,
        createdById: adminForComms.id,
      },
      {
        title: 'Inter-School Sports Day — Year 10 & 11 Participation Consent',
        description: 'Year 10 and Year 11 students are invited to participate in the annual Inter-School Sports Day on 5 July 2026. Events include track and field, team sports, and relays. Students who wish to participate must have this form acknowledged by their parent or guardian. Medical screening will be conducted prior to the event. Transport to and from the venue (Hassanal Bolkiah National Stadium) will be provided by the school.',
        type: 'FIELD_TRIP',
        status: 'DRAFT',
        dueDate: new Date('2026-06-28'),
        targetGradeLevel: 'Year 10',
        schoolId: adminForComms.schoolId,
        createdById: adminForComms.id,
      },
    ]

    const createdForms: Array<{ id: string; targetGradeLevel: string | null; status: string }> = []
    for (const f of seedForms) {
      const form = await prisma.consentForm.create({ data: f })
      createdForms.push(form)
    }

    // Assign active forms to parents of matching students
    const activeForms = createdForms.filter((f) => f.status === 'ACTIVE')
    for (const form of activeForms) {
      const whereClause: { enrollmentStatus: string; schoolId?: string; gradeLevel?: string } = {
        enrollmentStatus: 'enrolled',
      }
      if (adminForComms.schoolId) whereClause.schoolId = adminForComms.schoolId
      if (form.targetGradeLevel) whereClause.gradeLevel = form.targetGradeLevel

      const students = await prisma.student.findMany({ where: whereClause, select: { id: true }, take: 20 })
      const studentIds = students.map((s) => s.id)
      if (studentIds.length === 0) continue

      const parentLinks = await prisma.parentStudent.findMany({
        where: { studentId: { in: studentIds } },
        select: { parentId: true, studentId: true },
      })

      const parentIds = [...new Set(parentLinks.map((l) => l.parentId))]
      const parents = await prisma.parent.findMany({
        where: { id: { in: parentIds } },
        select: { id: true, userId: true },
      })
      const parentUserMap = new Map(parents.map((p) => [p.id, p.userId]))

      for (const link of parentLinks) {
        const parentUserId = parentUserMap.get(link.parentId)
        if (!parentUserId) continue
        await prisma.consentFormRecipient.upsert({
          where: {
            formId_parentUserId_studentId: {
              formId: form.id,
              parentUserId,
              studentId: link.studentId,
            },
          },
          create: {
            formId: form.id,
            parentUserId,
            studentId: link.studentId,
            // Simulate that some parents have already acknowledged
            acknowledgedAt: Math.random() > 0.5 ? new Date('2026-06-01') : null,
            acknowledgmentNote: Math.random() > 0.7 ? 'Confirmed, thank you.' : null,
          },
          update: {},
        })
      }
    }
  }

  // ─── Module 9: Stock Items (for NF-06 Low Stock Alert) ──────────────────────
  console.log('Seeding Module 9 stock items...')

  await prisma.stockItem.deleteMany({})
  const stockData = [
    // Below minimum (will trigger NF-06)
    { name: 'A4 White Paper (Ream)', category: 'STATIONERY', unit: 'reams', quantity: 3, minQuantity: 10 },
    { name: 'Blue Ballpoint Pens', category: 'STATIONERY', unit: 'boxes', quantity: 2, minQuantity: 5 },
    { name: 'Whiteboard Markers (Pack)', category: 'STATIONERY', unit: 'packs', quantity: 1, minQuantity: 8 },
    { name: 'Hand Sanitizer 500ml', category: 'MEDICAL', unit: 'bottles', quantity: 4, minQuantity: 10 },
    { name: 'First Aid Bandages (Box)', category: 'MEDICAL', unit: 'boxes', quantity: 1, minQuantity: 5 },
    // Above minimum (no alert)
    { name: 'Stapler Staples (Box)', category: 'STATIONERY', unit: 'boxes', quantity: 20, minQuantity: 5 },
    { name: 'Toner Cartridge (Black)', category: 'STATIONERY', unit: 'pcs', quantity: 8, minQuantity: 3 },
    { name: 'Multipurpose Cleaning Spray', category: 'CLEANING', unit: 'bottles', quantity: 15, minQuantity: 8 },
    { name: 'Rubbish Bags (Large, Roll)', category: 'CLEANING', unit: 'rolls', quantity: 12, minQuantity: 5 },
    { name: 'Football (Size 5)', category: 'SPORTS', unit: 'pcs', quantity: 6, minQuantity: 4 },
    { name: 'Badminton Shuttlecocks (Tube)', category: 'SPORTS', unit: 'tubes', quantity: 3, minQuantity: 2 },
    { name: 'Chalk (White, Box)', category: 'STATIONERY', unit: 'boxes', quantity: 25, minQuantity: 10 },
  ]

  const adminUserForStock = await prisma.user.findFirst({ where: { role: 'admin' }, select: { schoolId: true } })
  for (const item of stockData) {
    await prisma.stockItem.create({
      data: { ...item, schoolId: adminUserForStock?.schoolId ?? null },
    })
  }

  // ─── DATA ENRICHMENT: Diverse Scenarios ──────────────────────────────────
  console.log('\nSeeding enrichment data — diverse scenarios...')

  // Helper functions for staff attendance
  function staffDay(daysBack: number): Date {
    const d = new Date()
    d.setDate(d.getDate() - daysBack)
    d.setHours(0, 0, 0, 0)
    return d
  }
  function staffTime(daysBack: number, hhmm: string): Date {
    const parts = hhmm.split(':')
    const h = parseInt(parts[0]!, 10)
    const m = parseInt(parts[1]!, 10)
    const d = new Date()
    d.setDate(d.getDate() - daysBack)
    d.setHours(h, m, 0, 0)
    return d
  }

  // ── 1. Teacher dateOfBirth (required for retirement planning) ────────────
  await prisma.teacher.update({ where: { id: drsiti.id },   data: { dateOfBirth: new Date('1975-04-12') } }) // age 51 — near early retirement
  await prisma.teacher.update({ where: { id: faizal.id },   data: { dateOfBirth: new Date('1989-06-01') } }) // age 37
  await prisma.teacher.update({ where: { id: teacher01.id },data: { dateOfBirth: new Date('1988-08-01') } }) // age 38
  await prisma.teacher.update({ where: { id: ridwan.id },   data: { dateOfBirth: new Date('1992-01-10') } }) // age 34
  await prisma.teacher.update({ where: { id: hassan.id },   data: { dateOfBirth: new Date('1978-09-01') } }) // age 47 — watching
  await prisma.teacher.update({ where: { id: zuraidah.id }, data: { dateOfBirth: new Date('1985-03-10') } }) // age 41

  // ── 2. Leave Applications — 6 diverse scenarios ────────────────────────
  // A: Dr. Siti — PRINCIPAL_APPROVED annual leave (completed 13-15 days ago)
  await prisma.leaveApplication.create({
    data: {
      teacherId: drsiti.id,
      leaveType: 'ANNUAL',
      startDate: daysAgo(15),
      endDate: daysAgo(13),
      daysRequested: 3,
      reason: 'Family holiday — Hari Raya Aidilfitri extension',
      status: 'PRINCIPAL_APPROVED',
      hodApproverId: hodUser.id,
      hodApprovedAt: daysAgo(20),
      hodRemarks: 'Approved. Substitute arranged for classes.',
      principalApproverId: principalUser.id,
      principalApprovedAt: daysAgo(19),
      principalRemarks: 'Approved.',
    },
  })

  // B: Faizal — PRINCIPAL_APPROVED medical leave (currently on leave)
  await prisma.leaveApplication.create({
    data: {
      teacherId: faizal.id,
      leaveType: 'MEDICAL',
      startDate: daysAgo(2),
      endDate: new Date(Date.now() + 3 * 86400000),
      daysRequested: 5,
      reason: 'Hospitalisation — respiratory infection',
      documentUrl: '/uploads/leave/faizal_mc_2026.pdf',
      status: 'PRINCIPAL_APPROVED',
      hodApproverId: hodUser.id,
      hodApprovedAt: daysAgo(3),
      hodRemarks: 'Approved. Wishing a speedy recovery. Ridwan to cover Year 7 English.',
      principalApproverId: principalUser.id,
      principalApprovedAt: daysAgo(2),
      principalRemarks: 'Approved. Medical certificate attached.',
    },
  })

  // C: Ms. Aminah — PENDING annual leave (submitted today)
  await prisma.leaveApplication.create({
    data: {
      teacherId: teacher01.id,
      leaveType: 'ANNUAL',
      startDate: new Date(Date.now() + 7 * 86400000),
      endDate: new Date(Date.now() + 9 * 86400000),
      daysRequested: 3,
      reason: 'Personal trip — family commitments in Kuala Lumpur',
      status: 'PENDING',
    },
  })

  // D: Mr. Hassan — REJECTED compassionate leave
  await prisma.leaveApplication.create({
    data: {
      teacherId: hassan.id,
      leaveType: 'COMPASSIONATE',
      startDate: daysAgo(5),
      endDate: daysAgo(3),
      daysRequested: 3,
      reason: 'Extended bereavement — cousin\'s passing',
      status: 'REJECTED',
      hodApproverId: hodUser.id,
      hodApprovedAt: daysAgo(8),
      hodRemarks: 'Policy allows 3 days for immediate family only.',
      principalApproverId: principalUser.id,
      principalApprovedAt: daysAgo(7),
      principalRemarks: 'Rejected per MOE leave policy. Annual leave may be used as an alternative.',
    },
  })

  // E: Mr. Ridwan — CANCELLED annual leave (HOD approved, then teacher cancelled)
  await prisma.leaveApplication.create({
    data: {
      teacherId: ridwan.id,
      leaveType: 'ANNUAL',
      startDate: new Date(Date.now() + 14 * 86400000),
      endDate: new Date(Date.now() + 16 * 86400000),
      daysRequested: 3,
      reason: 'Personal travel',
      status: 'CANCELLED',
      hodApproverId: hodUser.id,
      hodApprovedAt: daysAgo(2),
      cancellationReason: 'Travel plans changed — cancelling leave request',
      cancelledAt: daysAgo(1),
      cancelledBy: ridwanUser.id,
    },
  })

  // F: Ms. Zuraidah — HOD_APPROVED, awaiting Principal sign-off
  await prisma.leaveApplication.create({
    data: {
      teacherId: zuraidah.id,
      leaveType: 'ANNUAL',
      startDate: new Date(Date.now() + 21 * 86400000),
      endDate: new Date(Date.now() + 24 * 86400000),
      daysRequested: 4,
      reason: 'Family holiday to Sabah — pre-booked trip',
      status: 'HOD_APPROVED',
      hodApproverId: hodUser.id,
      hodApprovedAt: daysAgo(1),
      hodRemarks: 'Approved. Year 11 O-Level revision may need rescheduling.',
    },
  })

  // ── 3. Staff Attendance Config (SMHK) ─────────────────────────────────────
  await prisma.staffAttendanceConfig.upsert({
    where: { schoolId: smhk.id },
    create: { schoolId: smhk.id, startTime: '07:30', cutoffTime: '09:00', absenceAlertDays: 3, frequentAbsenceDays: 3, frequentLatenessCount: 5 },
    update: {},
  })

  // ── 4. Staff Attendance Records (past 28 days, varied scenarios) ──────────

  type StaffRec = { day: number; status: string; inTime: string | null; outTime: string | null; late: number; notes?: string; auto?: boolean }

  // Dr. Siti — solid, 2 days on approved leave, 1 late
  const drsitiRecs: StaffRec[] = [
    { day: 28, status: 'PRESENT', inTime: '07:28', outTime: '16:30', late: 0 },
    { day: 27, status: 'PRESENT', inTime: '07:30', outTime: '16:15', late: 0 },
    { day: 26, status: 'LATE',    inTime: '08:15', outTime: '16:30', late: 45 },
    { day: 25, status: 'PRESENT', inTime: '07:25', outTime: '17:00', late: 0 },
    { day: 22, status: 'PRESENT', inTime: '07:30', outTime: '16:45', late: 0 },
    { day: 21, status: 'PRESENT', inTime: '07:28', outTime: '16:30', late: 0 },
    { day: 20, status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 15, status: 'ABSENT',  inTime: null,    outTime: null,    late: 0 }, // on approved leave
    { day: 14, status: 'ABSENT',  inTime: null,    outTime: null,    late: 0 }, // on approved leave
    { day: 13, status: 'PRESENT', inTime: '07:35', outTime: '16:30', late: 5 },
    { day: 7,  status: 'PRESENT', inTime: '07:30', outTime: '16:30', late: 0 },
    { day: 1,  status: 'PRESENT', inTime: '07:29', outTime: '16:30', late: 0 },
  ]
  for (const r of drsitiRecs) {
    try {
      await prisma.staffAttendanceRecord.create({ data: { teacherId: drsiti.id, date: staffDay(r.day), checkInAt: r.inTime ? staffTime(r.day, r.inTime) : null, checkOutAt: r.outTime ? staffTime(r.day, r.outTime) : null, status: r.status, lateMinutes: r.late, locationLabel: r.inTime ? 'School Gate' : null, locationLat: r.inTime ? 4.9406 : null, locationLng: r.inTime ? 114.9480 : null, notes: r.notes ?? null } })
    } catch (_) { /* skip duplicate */ }
  }

  // Ms. Aminah (teacher01) — good, 2 late incidents
  const aminahRecs: StaffRec[] = [
    { day: 28, status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 27, status: 'LATE',    inTime: '08:05', outTime: '16:00', late: 35 },
    { day: 22, status: 'PRESENT', inTime: '07:28', outTime: '16:00', late: 0 },
    { day: 21, status: 'PRESENT', inTime: '07:30', outTime: '15:45', late: 0 },
    { day: 20, status: 'PRESENT', inTime: '07:32', outTime: '16:00', late: 2 },
    { day: 19, status: 'PRESENT', inTime: '07:30', outTime: '16:15', late: 0 },
    { day: 15, status: 'LATE',    inTime: '08:20', outTime: '16:00', late: 50, notes: 'Car breakdown — notified school at 07:45' },
    { day: 14, status: 'PRESENT', inTime: '07:28', outTime: '16:00', late: 0 },
    { day: 7,  status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 1,  status: 'PRESENT', inTime: '07:29', outTime: '16:00', late: 0 },
  ]
  for (const r of aminahRecs) {
    try {
      await prisma.staffAttendanceRecord.create({ data: { teacherId: teacher01.id, date: staffDay(r.day), checkInAt: r.inTime ? staffTime(r.day, r.inTime) : null, checkOutAt: r.outTime ? staffTime(r.day, r.outTime) : null, status: r.status, lateMinutes: r.late, notes: r.notes ?? null } })
    } catch (_) { /* skip */ }
  }

  // Mr. Ridwan — frequent lateness (≥6 in 30d → anomaly flag)
  const ridwanRecs: StaffRec[] = [
    { day: 28, status: 'LATE',    inTime: '08:10', outTime: '16:00', late: 40, notes: 'No reason given' },
    { day: 27, status: 'LATE',    inTime: '08:25', outTime: '16:00', late: 55, notes: 'No reason given' },
    { day: 22, status: 'LATE',    inTime: '08:05', outTime: '16:00', late: 35 },
    { day: 21, status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 20, status: 'LATE',    inTime: '08:30', outTime: '16:00', late: 60, notes: 'No reason given' },
    { day: 19, status: 'LATE',    inTime: '08:15', outTime: '16:00', late: 45 },
    { day: 15, status: 'LATE',    inTime: '08:20', outTime: '16:00', late: 50, notes: 'No reason given' },
    { day: 14, status: 'PRESENT', inTime: '07:32', outTime: '16:00', late: 2 },
    { day: 7,  status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 1,  status: 'LATE',    inTime: '08:45', outTime: '16:00', late: 75, notes: 'No reason given' },
  ]
  for (const r of ridwanRecs) {
    try {
      await prisma.staffAttendanceRecord.create({ data: { teacherId: ridwan.id, date: staffDay(r.day), checkInAt: r.inTime ? staffTime(r.day, r.inTime) : null, checkOutAt: r.outTime ? staffTime(r.day, r.outTime) : null, status: r.status, lateMinutes: r.late, notes: r.notes ?? null } })
    } catch (_) { /* skip */ }
  }

  // Mr. Hassan — 3 consecutive absences (days 22-20, no leave → anomaly flag)
  const hassanRecs: StaffRec[] = [
    { day: 28, status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 27, status: 'PRESENT', inTime: '07:28', outTime: '16:15', late: 0 },
    { day: 22, status: 'ABSENT',  inTime: null,    outTime: null,    late: 0, notes: 'No check-in. No leave applied.', auto: false },
    { day: 21, status: 'ABSENT',  inTime: null,    outTime: null,    late: 0, notes: 'Consecutive absence — day 2', auto: true },
    { day: 20, status: 'ABSENT',  inTime: null,    outTime: null,    late: 0, notes: 'Consecutive absence — day 3. Auto-flagged to HOD.', auto: true },
    { day: 19, status: 'PRESENT', inTime: '07:35', outTime: '16:00', late: 5 },
    { day: 15, status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 14, status: 'PRESENT', inTime: '07:28', outTime: '16:00', late: 0 },
    { day: 7,  status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 1,  status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
  ]
  for (const r of hassanRecs) {
    try {
      await prisma.staffAttendanceRecord.create({ data: { teacherId: hassan.id, date: staffDay(r.day), checkInAt: r.inTime ? staffTime(r.day, r.inTime) : null, checkOutAt: r.outTime ? staffTime(r.day, r.outTime) : null, status: r.status, lateMinutes: r.late, notes: r.notes ?? null, autoMarked: r.auto ?? false } })
    } catch (_) { /* skip */ }
  }

  // Ms. Zuraidah — exemplary attendance
  const zuraidahDays = [28, 27, 22, 21, 20, 19, 15, 14, 7, 1]
  for (const day of zuraidahDays) {
    try {
      await prisma.staffAttendanceRecord.create({ data: { teacherId: zuraidah.id, date: staffDay(day), checkInAt: staffTime(day, '07:25'), checkOutAt: staffTime(day, '16:30'), status: 'PRESENT', lateMinutes: 0 } })
    } catch (_) { /* skip */ }
  }

  // Faizal — present until medical leave started (days 2-1 = absent on leave)
  const faizalStaffRecs: StaffRec[] = [
    { day: 28, status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 22, status: 'PRESENT', inTime: '07:32', outTime: '16:00', late: 2 },
    { day: 21, status: 'LATE',    inTime: '08:05', outTime: '16:00', late: 35 },
    { day: 20, status: 'PRESENT', inTime: '07:30', outTime: '16:00', late: 0 },
    { day: 2,  status: 'ABSENT',  inTime: null,    outTime: null,    late: 0, notes: 'Approved medical leave' },
    { day: 1,  status: 'ABSENT',  inTime: null,    outTime: null,    late: 0, notes: 'Approved medical leave' },
  ]
  for (const r of faizalStaffRecs) {
    try {
      await prisma.staffAttendanceRecord.create({ data: { teacherId: faizal.id, date: staffDay(r.day), checkInAt: r.inTime ? staffTime(r.day, r.inTime) : null, checkOutAt: r.outTime ? staffTime(r.day, r.outTime) : null, status: r.status, lateMinutes: r.late, notes: r.notes ?? null } })
    } catch (_) { /* skip */ }
  }

  // ── 4b. Today's staff check-ins (day 0) ──────────────────────────────────────
  // Dr. Siti, Aminah, Ridwan, Hassan, Zuraidah are present today
  // Faizal is absent (on approved medical leave)
  for (const [teacherId, inTime, outTime, status, lateMin, notes] of [
    [drsiti.id,   '07:28', '16:30', 'PRESENT', 0,  null],
    [teacher01.id,'07:30', '16:00', 'PRESENT', 0,  null],
    [ridwan.id,   '08:10', '16:00', 'LATE',    40, 'No reason given'],
    [hassan.id,   '07:30', '16:00', 'PRESENT', 0,  null],
    [zuraidah.id, '07:25', '16:30', 'PRESENT', 0,  null],
    [faizal.id,   null,    null,    'ABSENT',  0,  'Approved medical leave'],
  ] as [string, string|null, string|null, string, number, string|null][]) {
    try {
      await prisma.staffAttendanceRecord.create({
        data: {
          teacherId,
          date: staffDay(0),
          checkInAt:  inTime  ? staffTime(0, inTime)  : null,
          checkOutAt: outTime ? staffTime(0, outTime) : null,
          status,
          lateMinutes: lateMin,
          notes,
        },
      })
    } catch (_) { /* skip duplicate */ }
  }

  // ── 5. Retirement Application (Dr. Siti — voluntary early at 51) ──────────
  try {
    await prisma.retirementApplication.create({
      data: {
        teacherId: drsiti.id,
        retirementType: 'VOLUNTARY_EARLY',
        requestedDate: new Date('2027-04-12'),
        reason: 'Planning to transition to academic research and part-time consulting after 12 years of service. Eligible under voluntary early retirement scheme (age 50+).',
        status: 'UNDER_REVIEW',
        submittedAt: daysAgo(14),
        reviewedById: principalUser.id,
        reviewedAt: daysAgo(7),
        reviewRemarks: 'Application acknowledged. Forwarded to MOE HR for assessment. Estimated processing: 30 working days.',
      },
    })
  } catch (_) { /* skip if exists */ }

  console.log('  ✓ Teachers, leave, attendance config, attendance records, retirement — done')

  // ── 6. CPD Enrollments ────────────────────────────────────────────────────
  const allWorkshops = await prisma.cpdWorkshop.findMany({ orderBy: { startDate: 'asc' } })
  // Indices by startDate ASC: 0=Classroom Mgmt(+10), 1=Digital Pedagogy(+14), 2=ICT(+18),
  //   3=Inquiry Science(+21), 4=Assessment(+28), 5=Inclusive Ed(+35)
  const cpdEnrData = [
    { teacherId: drsiti.id,    wIdx: 0 }, { teacherId: drsiti.id,    wIdx: 1 },
    { teacherId: teacher01.id, wIdx: 2 }, { teacherId: teacher01.id, wIdx: 3 },
    { teacherId: hassan.id,    wIdx: 1 }, { teacherId: hassan.id,    wIdx: 4 },
    { teacherId: ridwan.id,    wIdx: 5 },
    { teacherId: zuraidah.id,  wIdx: 3 }, { teacherId: zuraidah.id,  wIdx: 2 },
  ]
  for (const e of cpdEnrData) {
    const w = allWorkshops[e.wIdx]
    if (!w) continue
    try {
      await prisma.cpdEnrollment.create({ data: { workshopId: w.id, teacherId: e.teacherId, status: 'ENROLLED' } })
    } catch (_) { /* skip duplicate */ }
  }

  // ── 7. Surveys ────────────────────────────────────────────────────────────

  // Survey 1: ACTIVE — Well-Being, anonymous, 7 responses
  const sv1 = await prisma.survey.create({
    data: { title: 'Staff Well-Being Check-In — Semester 1, 2026', description: 'An anonymous survey on staff well-being and workload. Your responses shape our support structures.', category: 'WELL_BEING', isAnonymous: true, status: 'ACTIVE', createdById: adminUser.id, startDate: daysAgo(21), endDate: new Date(Date.now() + 7 * 86400000) },
  })
  const sv1q1 = await prisma.surveyQuestion.create({ data: { surveyId: sv1.id, order: 1, text: 'How would you rate your overall workload this semester?', type: 'RATING', required: true } })
  const sv1q2 = await prisma.surveyQuestion.create({ data: { surveyId: sv1.id, order: 2, text: 'How satisfied are you with school management support?', type: 'RATING', required: true } })
  const sv1q3 = await prisma.surveyQuestion.create({ data: { surveyId: sv1.id, order: 3, text: 'Is your work-life balance manageable?', type: 'YES_NO', required: true } })
  const sv1q4 = await prisma.surveyQuestion.create({ data: { surveyId: sv1.id, order: 4, text: 'What one area do you need more support in?', type: 'TEXT', required: false } })

  const sv1Resps = [
    { q1: '4', q2: '3', q3: 'yes', q4: 'More CPD opportunities in digital teaching tools' },
    { q1: '2', q2: '3', q3: 'no',  q4: 'Admin tasks are taking too much teaching time' },
    { q1: '5', q2: '5', q3: 'yes', q4: 'Everything is great, thank you for asking' },
    { q1: '3', q2: '4', q3: 'yes', q4: 'Better substitute coordination during leave periods' },
    { q1: '4', q2: '4', q3: 'yes', q4: 'Reduced meeting frequency to allow more lesson prep time' },
    { q1: '3', q2: '3', q3: 'no',  q4: 'Student behavioural challenges increasing — need counselor support' },
    { q1: '5', q2: '4', q3: 'yes', q4: '' },
  ]
  for (const resp of sv1Resps) {
    const sr = await prisma.surveyResponse.create({ data: { surveyId: sv1.id, responderId: null } })
    const answers = [
      { responseId: sr.id, questionId: sv1q1.id, value: resp.q1 },
      { responseId: sr.id, questionId: sv1q2.id, value: resp.q2 },
      { responseId: sr.id, questionId: sv1q3.id, value: resp.q3 },
    ]
    if (resp.q4) answers.push({ responseId: sr.id, questionId: sv1q4.id, value: resp.q4 })
    await prisma.surveyAnswer.createMany({ data: answers })
  }

  // Survey 2: CLOSED — Professional Development, named responses
  const sv2 = await prisma.survey.create({
    data: { title: 'CPD Training Effectiveness — 2025 Annual Review', description: 'Evaluate CPD workshops attended in 2025 to shape the 2026 training calendar.', category: 'PROFESSIONAL_DEVELOPMENT', isAnonymous: false, status: 'CLOSED', createdById: adminUser.id, startDate: daysAgo(60), endDate: daysAgo(30) },
  })
  const sv2q1 = await prisma.surveyQuestion.create({ data: { surveyId: sv2.id, order: 1, text: 'Rate the overall quality of CPD workshops attended in 2025.', type: 'RATING', required: true } })
  const sv2q2 = await prisma.surveyQuestion.create({ data: { surveyId: sv2.id, order: 2, text: 'Which type of CPD was most valuable?', type: 'MULTIPLE_CHOICE', options: JSON.stringify(['Classroom pedagogy', 'Subject content deepening', 'Digital tools', 'Leadership & management', 'Student well-being']), required: true } })
  const sv2q3 = await prisma.surveyQuestion.create({ data: { surveyId: sv2.id, order: 3, text: 'Were CPD sessions relevant to your classroom needs?', type: 'YES_NO', required: true } })

  const sv2Resps = [
    { uid: drsitiUser.id,    q1: '5', q2: 'Digital tools',            q3: 'yes' },
    { uid: teacher01User.id, q1: '4', q2: 'Classroom pedagogy',        q3: 'yes' },
    { uid: hassanUser.id,    q1: '4', q2: 'Subject content deepening', q3: 'yes' },
    { uid: zuraidahUser.id,  q1: '3', q2: 'Student well-being',        q3: 'no'  },
    { uid: ridwanUser.id,    q1: '4', q2: 'Classroom pedagogy',        q3: 'yes' },
  ]
  for (const resp of sv2Resps) {
    try {
      const sr = await prisma.surveyResponse.create({ data: { surveyId: sv2.id, responderId: resp.uid } })
      await prisma.surveyAnswer.createMany({ data: [
        { responseId: sr.id, questionId: sv2q1.id, value: resp.q1 },
        { responseId: sr.id, questionId: sv2q2.id, value: resp.q2 },
        { responseId: sr.id, questionId: sv2q3.id, value: resp.q3 },
      ]})
    } catch (_) { /* skip */ }
  }

  // Survey 3: DRAFT — School Management, no responses yet
  await prisma.survey.create({
    data: { title: 'Term 2 Staff Feedback — School Improvement', description: 'Gathering input on facilities, administration, and learning support for Term 2 2026.', category: 'SCHOOL_MANAGEMENT', isAnonymous: true, status: 'DRAFT', createdById: principalUser.id },
  })

  console.log('  ✓ CPD enrollments, surveys with responses — done')

  // ── 8. Self-Service Requests ───────────────────────────────────────────────

  // Faizal: Transfer request (under review)
  await prisma.selfServiceRequest.create({
    data: { teacherId: faizal.id, type: 'TRANSFER', preferredSchools: JSON.stringify(['Sekolah Menengah Sayyidina Ali', 'Maktab Duli PB']), transferReason: 'Requesting transfer closer to residence in Gadong to reduce daily commute.', transferEffectiveDate: new Date('2026-08-01'), status: 'under_review', reviewedById: adminUser.id, reviewedAt: daysAgo(2), reviewerRemarks: 'Forwarded to District Education Office for placement review.' },
  })
  // Ridwan: Training request (approved)
  await prisma.selfServiceRequest.create({
    data: { teacherId: ridwan.id, type: 'TRAINING', courseName: 'Advanced Data Analytics for Educators', courseProvider: 'Universiti Teknologi Brunei', courseDates: '2026-07-15 to 2026-07-17', courseCost: 250.0, courseJustification: 'Will improve ability to identify at-risk students earlier using data patterns.', status: 'approved', reviewedById: adminUser.id, reviewedAt: daysAgo(5), reviewerRemarks: 'Approved. School covers course fee. Submit invoice after completion.' },
  })
  // Aminah: Document request (submitted)
  await prisma.selfServiceRequest.create({
    data: { teacherId: teacher01.id, type: 'DOCUMENT', documentType: 'EMPLOYMENT_CERTIFICATE', notes: 'Required for bank home loan application. Needs current designation, department, and length of service.', status: 'submitted' },
  })
  // Zuraidah: Promotion application (submitted)
  await prisma.selfServiceRequest.create({
    data: { teacherId: zuraidah.id, type: 'PROMOTION', currentPosition: 'Senior Teacher', desiredPosition: 'Head of Department — Languages & Humanities', promotionJustification: 'I have served as Senior Teacher for 4 years, led two cross-department curriculum reviews, and exceeded CPD targets for 3 consecutive years.', status: 'submitted' },
  })
  // Hassan: Profile update (approved)
  await prisma.selfServiceRequest.create({
    data: { teacherId: hassan.id, type: 'PROFILE_UPDATE', profileChanges: JSON.stringify([{ field: 'phone', oldValue: '+673 8112233', newValue: '+673 8998877', requiresApproval: false }, { field: 'emergencyContact', oldValue: 'Rashid (+673 8223344)', newValue: 'Fatimah (+673 8445566)', requiresApproval: false }]), isSensitive: false, status: 'approved', reviewedById: adminUser.id, reviewedAt: daysAgo(3), reviewerRemarks: 'Profile updated. Changes applied immediately.' },
  })

  console.log('  ✓ Self-service requests — done')

  // ── 9. Parent-Teacher Meetings ────────────────────────────────────────────
  await prisma.parentTeacherMeeting.create({
    data: { teacherId: ridwan.id, parentUserId: parent01User.id, studentId: ahmad.id, meetingDate: daysAgo(10), startTime: '14:00', endTime: '14:30', purpose: 'Academic progress review — Ahmad\'s declining Mathematics grades and attendance', status: 'COMPLETED', notes: 'Parent acknowledged concern. Agreed on daily homework check and weekly call. Parent to consult GP regarding academic stress.' },
  })
  await prisma.parentTeacherMeeting.create({
    data: { teacherId: teacher01.id, parentUserId: sitiUser.id, studentId: ahmad.id, meetingDate: new Date(Date.now() + 86400000), startTime: '15:00', endTime: '15:30', purpose: 'Follow-up on IEP goals — review Ahmad\'s dyslexia reading progress', status: 'SCHEDULED' },
  })
  await prisma.parentTeacherMeeting.create({
    data: { teacherId: zuraidah.id, parentUserId: fatimahUser.id, studentId: nurul.id, meetingDate: daysAgo(21), startTime: '14:30', endTime: '15:00', purpose: 'Mid-semester English performance review', status: 'COMPLETED', notes: 'Nurul performing well (midterm 92%). Parent requested reading enrichment list. Provided 3 recommended titles.' },
  })
  await prisma.parentTeacherMeeting.create({
    data: { teacherId: drsiti.id, parentUserId: nadiaParentUser.id, studentId: nadia.id, meetingDate: daysAgo(14), startTime: '14:00', endTime: '14:45', purpose: 'Year 10 Physics enrichment and O-Level pathway planning', status: 'COMPLETED', notes: 'Nadia is top Year 10 student. Discussed Physics Olympiad entry and scholarship planning. Recommended A-Level Further Maths pathway.' },
  })

  // ── 10. Message Threads & Direct Messages ─────────────────────────────────

  const thread1 = await prisma.messageThread.create({ data: { subject: 'Ahmad\'s Mathematics attendance and grades', parentUserId: parent01User.id, teacherUserId: ridwanUser.id, studentId: ahmad.id } })
  await prisma.directMessage.create({ data: { threadId: thread1.id, senderId: parent01User.id, content: 'Assalamualaikum Mr. Ridwan. I am concerned about Ahmad\'s Week 4 Math score dropping to 65. Can we discuss how to help him improve?', createdAt: daysAgo(12), readAt: daysAgo(11) } })
  await prisma.directMessage.create({ data: { threadId: thread1.id, senderId: ridwanUser.id, content: 'Wa\'alaikumsalam. Ahmad is struggling with the algebra unit. I suggest daily 20-minute revision. I can provide additional worksheets. Can we schedule a call?', createdAt: daysAgo(11), readAt: daysAgo(11) } })
  await prisma.directMessage.create({ data: { threadId: thread1.id, senderId: parent01User.id, content: 'Yes please. Tomorrow after 5 PM would work. I will ensure Ahmad does his daily revision.', createdAt: daysAgo(10), readAt: daysAgo(10) } })
  await prisma.directMessage.create({ data: { threadId: thread1.id, senderId: ridwanUser.id, content: 'Perfect. I will call at 5:30 PM and bring some practice questions to work through together.', createdAt: daysAgo(10), readAt: daysAgo(10) } })

  const thread2 = await prisma.messageThread.create({ data: { subject: 'Ahmad\'s IEP progress — dyslexia support', parentUserId: sitiUser.id, teacherUserId: teacher01User.id, studentId: ahmad.id } })
  await prisma.directMessage.create({ data: { threadId: thread2.id, senderId: sitiUser.id, content: 'Good afternoon Ms. Aminah. We wanted to check on Ahmad\'s reading progress since the IEP session last week. He seems more confident at home.', createdAt: daysAgo(5), readAt: daysAgo(5) } })
  await prisma.directMessage.create({ data: { threadId: thread2.id, senderId: teacher01User.id, content: 'Good afternoon Mrs. Siti. Ahmad used the text-to-speech tool independently during last Friday\'s assessment — a big milestone. His confidence is definitely growing!', createdAt: daysAgo(4), readAt: daysAgo(4) } })
  await prisma.directMessage.create({ data: { threadId: thread2.id, senderId: sitiUser.id, content: 'That is wonderful news! Thank you for the continued support. We look forward to the meeting tomorrow.', createdAt: daysAgo(3) } })

  const thread3 = await prisma.messageThread.create({ data: { subject: 'Nurul\'s English enrichment reading list', parentUserId: fatimahUser.id, teacherUserId: zuraidahUser.id, studentId: nurul.id } })
  await prisma.directMessage.create({ data: { threadId: thread3.id, senderId: zuraidahUser.id, content: 'Dear Mrs. Fatimah, following our meeting, I recommend: 1) "To Kill a Mockingbird", 2) "Animal Farm", 3) "The Kite Runner". These will prepare Nurul well for Year 8 Literature.', createdAt: daysAgo(20), readAt: daysAgo(20) } })
  await prisma.directMessage.create({ data: { threadId: thread3.id, senderId: fatimahUser.id, content: 'Thank you Ms. Zuraidah! We will borrow them from the library. Nurul is very excited to start reading.', createdAt: daysAgo(19), readAt: daysAgo(19) } })

  // Additional threads for parent01 (Ahmad's father)
  const thread4 = await prisma.messageThread.create({ data: { subject: "Ahmad's upcoming exams — revision support", parentUserId: parent01User.id, teacherUserId: teacher01User.id, studentId: ahmad.id } })
  await prisma.directMessage.create({ data: { threadId: thread4.id, senderId: parent01User.id, content: "Assalamualaikum Ms. Aminah. The mock exams are next week. Ahmad is feeling anxious. What topics should we focus on at home?", createdAt: daysAgo(5), readAt: daysAgo(5) } })
  await prisma.directMessage.create({ data: { threadId: thread4.id, senderId: teacher01User.id, content: "Wa'alaikumsalam. Focus on Chapter 3 for English and the algebra revision sheet from last Friday. Ahmad is well-prepared — he just needs confidence. I am available Thursday after school if you would like to speak.", createdAt: daysAgo(4), readAt: daysAgo(4) } })
  await prisma.directMessage.create({ data: { threadId: thread4.id, senderId: parent01User.id, content: "Thank you Ms. Aminah. We will revise those tonight. Really appreciate your continued support.", createdAt: daysAgo(3), readAt: daysAgo(3) } })

  const thread5 = await prisma.messageThread.create({ data: { subject: 'Attendance concern — 2 unexplained absences', parentUserId: parent01User.id, teacherUserId: teacher01User.id, studentId: ahmad.id } })
  await prisma.directMessage.create({ data: { threadId: thread5.id, senderId: teacher01User.id, content: "Dear Hj Abdullah, I am writing regarding Ahmad's two unexplained absences on 28 and 29 May. Please submit a written note or medical certificate to the school office to regularise these absences. Thank you.", createdAt: daysAgo(8), readAt: daysAgo(7) } })
  await prisma.directMessage.create({ data: { threadId: thread5.id, senderId: parent01User.id, content: "Apologise for the delay, Ms. Aminah. Ahmad was ill with a fever. I will bring the medical certificate tomorrow.", createdAt: daysAgo(7), readAt: daysAgo(7) } })
  await prisma.directMessage.create({ data: { threadId: thread5.id, senderId: teacher01User.id, content: "Thank you. Please submit the certificate to the office so Ahmad's attendance record can be updated. I hope he is fully recovered now.", createdAt: daysAgo(6), readAt: daysAgo(6) } })

  console.log('  ✓ Meetings, messages — done')

  // ── 11. Announcements ─────────────────────────────────────────────────────
  await prisma.announcement.createMany({
    data: [
      { title: 'Final Examination Schedule 2026 — Year 7 to Year 12', content: 'Final examinations run from 6–17 July 2026. Revised class schedules will be distributed by class teachers this Friday. All students must refer to the timetable on the school notice board.', authorId: principalUser.id, targetAudience: 'all', priority: 'high', isPinned: true, publishedAt: daysAgo(5), expiresAt: new Date('2026-07-18') },
      { title: 'Sports Day 2026 — Thank You to All Participants', content: 'Thank you to all students, teachers and parents who made Sports Day 2026 a tremendous success! A special congratulations to Year 10 for winning the overall house trophy. Results will be posted on the school notice board this week.', authorId: adminUser.id, targetAudience: 'all', priority: 'normal', publishedAt: daysAgo(7) },
      { title: 'CPD Hours Submission Deadline — 30 June 2026', content: 'All teaching staff must submit CPD completion records via the Self-Service Portal by 30 June 2026. Annual target: 20 hours. Staff who have not met their target should register for upcoming workshops immediately.', authorId: adminUser.id, targetAudience: 'teachers', priority: 'high', publishedAt: daysAgo(3), expiresAt: new Date('2026-06-30') },
      { title: 'Year 7 Online Registration Open for 2026/2027 Intake', content: 'Parents may now submit applications for Year 7 entry via the online registration portal at /register. Closing date: 31 July 2026. Priority placement for siblings of current students.', authorId: adminUser.id, targetAudience: 'parents', priority: 'normal', publishedAt: daysAgo(10), expiresAt: new Date('2026-07-31') },
      { title: 'Semester 1 Report Cards Now Available on Parent Portal', content: 'Mid-year report cards are available on the Parent Portal. Log in to view your child\'s academic progress, attendance, and teacher comments. Contact your child\'s class teacher with any questions.', authorId: adminUser.id, targetAudience: 'parents', priority: 'normal', publishedAt: daysAgo(7) },
    ],
  })

  // ── 12. Awards & Posting History ──────────────────────────────────────────
  await prisma.award.createMany({
    data: [
      { teacherId: drsiti.id,    title: 'Best Science Teacher Award 2025',          category: 'EXCELLENCE',  description: 'Awarded by MOE for outstanding Year 12 Physics results. 92% of students achieved A or A*.', awardedDate: new Date('2025-08-20'), awardedBy: 'Ministry of Education Brunei', badgeColor: 'gold' },
      { teacherId: zuraidah.id,  title: 'Excellence in English Language Teaching',   category: 'EXCELLENCE',  description: 'Recognised by British Council for innovative use of literature in O-Level preparation.', awardedDate: new Date('2025-06-15'), awardedBy: 'British Council Brunei', badgeColor: 'gold' },
      { teacherId: teacher01.id, title: 'SEN Champion Award 2026',                  category: 'COMMUNITY',   description: 'Outstanding dedication to students with special educational needs.', awardedDate: new Date('2026-02-14'), awardedBy: 'SMHK School Leadership', badgeColor: 'blue' },
      { teacherId: hassan.id,    title: 'Innovation in Science Education',           category: 'INNOVATION',  description: 'Introduced hands-on chemistry experiments for Year 10 that improved class average by 12%.', awardedDate: new Date('2025-11-01'), awardedBy: 'SMHK School Leadership', badgeColor: 'silver' },
    ],
  })

  await prisma.postingRecord.createMany({
    data: [
      { teacherId: drsiti.id,   schoolName: 'Sekolah Menengah Rimba B',                      position: 'Teacher',        department: 'Science',               startDate: new Date('2015-08-01'), endDate: new Date('2019-12-31'), isCurrent: false, notes: 'Initial posting after PhD completion.' },
      { teacherId: drsiti.id,   schoolName: 'Sekolah Menengah Hj Kamaruddin (SMHK)',          position: 'Senior Teacher', department: 'Science & Mathematics',  startDate: new Date('2020-01-15'), isCurrent: true },
      { teacherId: zuraidah.id, schoolName: 'Sekolah Menengah Dato Seri Laila Jasa',          position: 'Teacher',        department: 'English & Languages',   startDate: new Date('2013-08-01'), endDate: new Date('2017-07-31'), isCurrent: false },
      { teacherId: zuraidah.id, schoolName: 'Sekolah Menengah Hj Kamaruddin (SMHK)',          position: 'Senior Teacher', department: 'Languages & Humanities', startDate: new Date('2017-08-10'), isCurrent: true },
      { teacherId: hassan.id,   schoolName: 'Sekolah Menengah Belait',                        position: 'Teacher',        department: 'Science',               startDate: new Date('2016-01-01'), endDate: new Date('2018-12-31'), isCurrent: false },
      { teacherId: hassan.id,   schoolName: 'Sekolah Menengah Hj Kamaruddin (SMHK)',          position: 'Teacher',        department: 'Science & Mathematics', startDate: new Date('2019-03-01'), isCurrent: true },
      { teacherId: ridwan.id,   schoolName: 'Sekolah Menengah Hj Kamaruddin (SMHK)',          position: 'Teacher',        department: 'Science & Mathematics', startDate: new Date('2022-01-10'), isCurrent: true },
      { teacherId: teacher01.id, schoolName: 'Sekolah Rendah Berakas B',                      position: 'Relief Teacher',  department: 'Mathematics',           startDate: new Date('2014-01-15'), endDate: new Date('2015-07-31'), isCurrent: false, notes: 'Short-term relief posting while awaiting permanent placement.' },
      { teacherId: teacher01.id, schoolName: 'Sekolah Menengah Rimba A',                       position: 'Teacher',         department: 'Mathematics',           startDate: new Date('2015-08-01'), endDate: new Date('2018-07-31'), isCurrent: false, notes: 'Permanent placement. Initiated the school\'s first Math Olympiad preparation programme.' },
      { teacherId: teacher01.id, schoolName: 'Sekolah Menengah Hj Kamaruddin (SMHK)',          position: 'Teacher',         department: 'Science & Mathematics', startDate: new Date('2018-08-01'), isCurrent: true },
    ],
  })

  console.log('  ✓ Announcements, awards, posting records — done')

  // ── 13. Notification Trigger Logs ─────────────────────────────────────────
  const triggerTypes = ['STUDENT_ABSENCE', 'GRADE_DROP', 'FEE_OVERDUE', 'CPD_DEADLINE', 'EXAM_REGISTRATION', 'LOW_STOCK', 'MAINTENANCE_DUE'] as const
  const triggerSummaries: Record<string, string> = {
    STUDENT_ABSENCE:   '3 students flagged for consecutive absences; parents and class teachers notified',
    GRADE_DROP:        '2 students with ≥20% grade drop vs previous period; counselor follow-up triggered',
    FEE_OVERDUE:       '5 invoices at 30-day threshold; 2 at 60-day warning; 1 at 90-day admin flag',
    CPD_DEADLINE:      '4 teachers notified of upcoming CPD workshop starting within 3 days',
    EXAM_REGISTRATION: '3 Year 11 students not yet registered for O-Level; admin notified',
    LOW_STOCK:         '5 stock items below minimum threshold; requisition reminder sent to admin',
    MAINTENANCE_DUE:   '2 assets with no maintenance in 6+ months; maintenance team notified',
  }
  let trigOffset = 1
  for (const tType of triggerTypes) {
    await prisma.notificationTriggerLog.create({ data: { triggerType: tType, ranAt: daysAgo(trigOffset), notificationsSent: 3 + (trigOffset % 5), affectedCount: 1 + (trigOffset % 4), status: 'success', summary: triggerSummaries[tType] } })
    await prisma.notificationTriggerLog.create({ data: { triggerType: tType, ranAt: daysAgo(trigOffset + 7), notificationsSent: 2 + (trigOffset % 4), affectedCount: 1 + (trigOffset % 3), status: trigOffset === 4 ? 'partial' : 'success', summary: `Previous run — ${triggerSummaries[tType] ?? ''}` } })
    trigOffset++
  }

  // ── 14. MONITOR-band Risk Scores (5 students without existing scores) ──────
  const existingRiskIds = (await prisma.riskScore.findMany({ select: { studentId: true } })).map(r => r.studentId)
  const monitorCandidates = await prisma.student.findMany({
    where: { schoolId: smhk.id, enrollmentStatus: 'enrolled', id: { notIn: existingRiskIds } },
    select: { id: true },
    take: 5,
  })
  const monitorScores  = [0.55, 0.48, 0.62, 0.45, 0.58]
  const monitorAbs     = [8, 6, 10, 5, 9]
  const monitorAvgs    = [65.2, 68.4, 62.8, 70.1, 63.5]
  for (let i = 0; i < monitorCandidates.length; i++) {
    const mc = monitorCandidates[i]
    if (!mc) continue
    await prisma.riskScore.create({ data: { studentId: mc.id, score: monitorScores[i]!, band: 'MONITOR', absences14d: monitorAbs[i]!, gradeAvg: monitorAvgs[i]!, gradeTrend: -2.0, computedAt: daysAgo(1) } })
  }

  // ── 15. Behavior Records ──────────────────────────────────────────────────
  await prisma.behaviorRecord.createMany({
    data: [
      { studentId: ahmad.id,  recordedById: teacher01User.id, type: 'demerit', category: 'attendance',   points: -2, description: 'Unexplained absence on 2026-05-28. No parent note received.', severity: 'minor',    parentNotified: true,  date: daysAgo(6) },
      { studentId: ahmad.id,  recordedById: teacher01User.id, type: 'merit',   category: 'academic',     points: 3,  description: 'Submitted extra Mathematics practice problems independently. Shows effort to improve despite challenges.', date: daysAgo(3) },
      { studentId: hafiz.id,  recordedById: ridwanUser.id,    type: 'demerit', category: 'conduct',      points: -3, description: 'Disrupted Geography class by refusing to participate in group activity. Counselor informed.', actionTaken: 'Spoken to individually after class. Counselor follow-up scheduled.', severity: 'moderate', parentNotified: true,  date: daysAgo(9) },
      { studentId: nadia.id,  recordedById: drsitiUser.id,    type: 'merit',   category: 'achievement',  points: 5,  description: 'Highest score in Year 10 Physics practical exam — 98/100. Exceptional lab technique and data analysis.', date: daysAgo(12) },
      { studentId: danial.id, recordedById: zuraidahUser.id,  type: 'merit',   category: 'achievement',  points: 5,  description: 'Led Year 12 English debate team to Inter-School Regional Finals. Excellent leadership and academic preparation.', date: daysAgo(18) },
      { studentId: fatin.id,  recordedById: drsitiUser.id,    type: 'merit',   category: 'academic',     points: 4,  description: 'Volunteered to present Year 9 Science project to visiting MOE inspectors. Articulate and well-prepared.', date: daysAgo(25) },
    ],
  })

  // ── 16. CCA Activities & Enrollments ─────────────────────────────────────
  const sciClub    = await prisma.ccaActivity.create({ data: { name: 'Science & Robotics Club',    category: 'academic', description: 'Hands-on experiments, robotics programming and inter-school competitions.', schedule: 'Every Thursday 14:30–16:30', venue: 'Science Lab 1', teacherInChargeId: hassanUser.id, capacity: 25, status: 'active' } })
  const debateSoc  = await prisma.ccaActivity.create({ data: { name: 'English Debate Society',     category: 'academic', description: 'Public speaking, argumentation and inter-school debate competitions.',        schedule: 'Every Wednesday 14:30–16:00', venue: 'Library',       teacherInChargeId: zuraidahUser.id, capacity: 20, status: 'active' } })
  const football   = await prisma.ccaActivity.create({ data: { name: 'School Football Team',       category: 'sports',   description: 'Competitive school football — MSSD league.',                               schedule: 'Mon & Fri 15:30–17:00',       venue: 'Sports Field',  capacity: 22, status: 'active' } })
  const mathOlymp  = await prisma.ccaActivity.create({ data: { name: 'Mathematics Olympiad Group', category: 'academic', description: 'Competition problem-solving — SEAMEO Math Olympiad preparation.',           schedule: 'Every Tuesday 14:30–16:00',   venue: 'Classroom 9A', teacherInChargeId: drsitiUser.id, capacity: 15, status: 'active' } })

  const ccaEnrolments = [
    { ccaId: sciClub.id,   studentId: hafiz.id  },
    { ccaId: sciClub.id,   studentId: nadia.id  },
    { ccaId: debateSoc.id, studentId: nurul.id  },
    { ccaId: debateSoc.id, studentId: danial.id },
    { ccaId: football.id,  studentId: ahmad.id  },
    { ccaId: football.id,  studentId: adam.id   },
    { ccaId: mathOlymp.id, studentId: nadia.id  },
    { ccaId: mathOlymp.id, studentId: hana.id   },
    { ccaId: mathOlymp.id, studentId: danial.id },
    { ccaId: debateSoc.id, studentId: fatin.id  },
  ]
  for (const e of ccaEnrolments) {
    try { await prisma.ccaEnrollment.create({ data: { ccaId: e.ccaId, studentId: e.studentId, status: 'active' } }) } catch (_) { /* skip */ }
  }

  // ── 17. Timetable Conflict Slots (intentional conflicts for demo) ──────────
  // Conflict A: Teacher conflict — Dr. Siti double-booked Mon 08:00 (Year 9A Math + Year 10B Physics same time)
  try {
    await prisma.timetableSlot.create({ data: { courseId: phy10.id, teacherId: drsiti.id, dayOfWeek: 0, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1', gradeLevel: 'Year 10', className: '10B', semester: '2026-S1' } })
  } catch (_) { /* skip */ }

  // Conflict B: Room conflict — Science Lab 1 booked twice Tue 08:00 (Dr. Siti 10A + Hassan 9B)
  try {
    await prisma.timetableSlot.create({ data: { courseId: sci9.id, teacherId: hassan.id, dayOfWeek: 1, startTime: '08:00', endTime: '09:30', room: 'Science Lab 1', gradeLevel: 'Year 9', className: '9B', semester: '2026-S1' } })
  } catch (_) { /* skip */ }

  // Conflict C: Class conflict — 11A has two teachers scheduled Mon 08:00 (teacher01 Math + Hassan Bio)
  try {
    await prisma.timetableSlot.create({ data: { courseId: bio11.id, teacherId: hassan.id, dayOfWeek: 0, startTime: '08:00', endTime: '09:30', room: 'Classroom 11B', gradeLevel: 'Year 11', className: '11A', semester: '2026-S1' } })
  } catch (_) { /* skip */ }

  console.log('  ✓ Trigger logs, risk scores, behavior records, CCA, timetable conflicts — done')
  console.log('\n=== ENRICHMENT SUMMARY ===')
  console.log('  Teacher dateOfBirth:     6 teachers updated')
  console.log('  Leave Applications:      6 scenarios (approved/HOD-approved/pending/rejected/cancelled/awaiting-principal)')
  console.log('  Staff Attendance Config: SMHK school config')
  console.log('  Staff Attendance Records: 6 teachers × varied days (anomaly scenarios included)')
  console.log('  Retirement Application:  1 voluntary early (Dr. Siti, UNDER_REVIEW)')
  console.log('  CPD Enrollments:         9 teacher–workshop links')
  console.log('  Surveys:                 3 (ACTIVE+7 responses, CLOSED+5 responses, DRAFT)')
  console.log('  Self-Service Requests:   5 (transfer/training/document/promotion/profile)')
  console.log('  Parent-Teacher Meetings: 4 (2 completed, 1 scheduled, 1 tomorrow)')
  console.log('  Message Threads:         3 threads, 9 messages')
  console.log('  Announcements:           5 (all/teachers/parents targeted)')
  console.log('  Awards:                  4 teacher recognition records')
  console.log('  Posting Records:         8 career history entries')
  console.log('  Trigger Logs:            14 (7 types × 2 runs)')
  console.log('  MONITOR Risk Scores:     up to 5 new students')
  console.log('  Behavior Records:        6 (merit/demerit mix)')
  console.log('  CCA Activities:          4 clubs, 10 enrollments')
  console.log('  Timetable Conflicts:     3 intentional conflict slots')

  console.log('All new modules seeded successfully.')

  // ─── Private Education Oversight (DPE) ─────────────────────────────────
  console.log('\nSeeding Private Education oversight (DPE)...')

  // DPE officer account
  const dpeOfficer = await prisma.user.create({
    data: {
      username: 'dpeofficer',
      password: hash('Demo@2026'),
      displayName: 'Pg Hjh Salmah Binti Pg Tahir',
      email: 'salmah.tahir@moe.gov.bn',
      role: 'priv_ed_officer',
      systemAdmin: false,
    },
  })

  // 4 private schools telling a varied story
  const privSchools = [
    {
      code: 'SPB',
      name: 'Sekolah Pintar Brunei',
      principal: 'Dr. Hartini Binti Yusof',
      address: 'Jalan Berakas BC2115, Brunei-Muara',
      phone: '+673-2331122',
      gradeLevels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9'],
      schoolType: 'combined',
      establishedYear: 2008,
      profile: {
        registrationNo: 'DPE/2024/0142',
        ownerOrganisation: 'Brunei Smart Education Sdn Bhd',
        ownerContactName: 'Hj Mahmud Bin Ahmad',
        ownerContactPhone: '+673-8801122',
        ownerContactEmail: 'admin@spb.edu.bn',
        district: 'Brunei-Muara',
        curriculumModel: 'National',
        studentCapacity: 720,
        feeRangeBnd: 'BND 3,200–5,800/yr',
        notes: 'Strong national curriculum delivery. Clean compliance history.',
      },
      // ACTIVE license, recent EXCELLENT inspection
      license: {
        licenseNumber: 'DPE-LIC-2024-0142',
        issuedDate: new Date('2024-01-15'),
        expiryDate: new Date('2028-01-14'),
        status: 'ACTIVE' as const,
        authorisedLevels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9'],
        conditions: 'Subject to annual financial audit submission.',
      },
      inspection: {
        inspectionDate: new Date('2026-02-18'),
        inspectionType: 'ROUTINE',
        rating: 'EXCELLENT',
        findings: [],
        resolved: true,
        notes: 'No deficiencies noted. Exemplary teacher CPD record.',
      },
    },
    {
      code: 'PPAH',
      name: 'Pusat Pendidikan Al-Hidayah',
      principal: 'Ustaz Hj Ramli Bin Abdullah',
      address: 'Kampong Kilanas, Brunei-Muara',
      phone: '+673-2655788',
      gradeLevels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'],
      schoolType: 'religious_primary',
      establishedYear: 1996,
      profile: {
        registrationNo: 'DPE/2020/0058',
        ownerOrganisation: 'Yayasan Al-Hidayah',
        ownerContactName: 'Hj Razali Bin Salleh',
        ownerContactPhone: '+673-8812345',
        ownerContactEmail: 'office@alhidayah.edu.bn',
        district: 'Brunei-Muara',
        curriculumModel: 'Mixed',
        studentCapacity: 380,
        feeRangeBnd: 'BND 1,800–2,400/yr',
        notes: 'License renewal pending. Awaiting follow-up inspection report.',
      },
      // EXPIRING_SOON license (45 days out) + open follow-up
      license: {
        licenseNumber: 'DPE-LIC-2020-0058-R2',
        issuedDate: new Date('2021-08-01'),
        expiryDate: (() => { const d = new Date(); d.setDate(d.getDate() + 45); return d })(),
        status: 'ACTIVE' as const,
        authorisedLevels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'],
        conditions: 'Two of six teaching staff are pending MOE approval (Reg. clause 4.2).',
      },
      inspection: {
        inspectionDate: new Date('2026-04-10'),
        inspectionType: 'RENEWAL',
        rating: 'NEEDS_IMPROVEMENT',
        findings: [
          { category: 'Staffing', severity: 'major', observation: '2 unapproved teachers remain in classroom posts.', recommendation: 'Submit MOE approval applications by license renewal date.' },
          { category: 'Facilities', severity: 'minor', observation: 'Library acquisition log incomplete for Q4 2025.', recommendation: 'Complete and submit acquisition records.' },
        ],
        followUpDueDate: (() => { const d = new Date(); d.setDate(d.getDate() - 10); return d })(), // overdue by 10 days
        resolved: false,
        notes: 'Follow-up overdue. Escalate to Director if not resolved within 14 days.',
      },
    },
    {
      code: 'ILA',
      name: 'International Learning Academy',
      principal: 'Ms. Eleanor Whitfield',
      address: 'Jalan Tungku Link, Gadong, Brunei-Muara',
      phone: '+673-2421999',
      gradeLevels: ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'],
      schoolType: 'secondary',
      establishedYear: 2012,
      profile: {
        registrationNo: 'DPE/2022/0091',
        ownerOrganisation: 'International Learning Sdn Bhd',
        ownerContactName: 'Mr. James Tan',
        ownerContactPhone: '+673-8898888',
        ownerContactEmail: 'principal@ila.edu.bn',
        district: 'Brunei-Muara',
        curriculumModel: 'Cambridge',
        studentCapacity: 540,
        feeRangeBnd: 'BND 9,500–14,000/yr',
        notes: 'Cambridge IGCSE provider. SATISFACTORY rating with 2 open findings.',
      },
      // ACTIVE license, SATISFACTORY recent inspection with open findings
      license: {
        licenseNumber: 'DPE-LIC-2022-0091',
        issuedDate: new Date('2022-09-01'),
        expiryDate: new Date('2027-08-31'),
        status: 'ACTIVE' as const,
        authorisedLevels: ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'],
        conditions: null,
      },
      inspection: {
        inspectionDate: new Date('2026-05-05'),
        inspectionType: 'ROUTINE',
        rating: 'SATISFACTORY',
        findings: [
          { category: 'Health & Safety', severity: 'moderate', observation: 'Fire evacuation drill records missing for Term 2 2025/26.', recommendation: 'Conduct drill and submit records within 30 days.' },
          { category: 'Curriculum', severity: 'minor', observation: 'Bahasa Melayu instructional hours below minimum for non-IGCSE students.', recommendation: 'Adjust timetable for next academic year.' },
        ],
        followUpDueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 25); return d })(),
        resolved: false,
        notes: 'Two open findings. School has acknowledged.',
      },
    },
    {
      code: 'TCA',
      name: 'Tutorial Centre Anggerek',
      principal: 'En. Hairul Bin Tarmizi',
      address: 'Lambak Kanan, Berakas, Brunei-Muara',
      phone: '+673-2778899',
      gradeLevels: ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'],
      schoolType: 'secondary',
      establishedYear: 2015,
      profile: {
        registrationNo: 'DPE/2019/0033',
        ownerOrganisation: 'Anggerek Education Centre',
        ownerContactName: 'En. Hairul Bin Tarmizi',
        ownerContactPhone: '+673-8845566',
        ownerContactEmail: 'hairul@tca.edu.bn',
        district: 'Brunei-Muara',
        curriculumModel: 'National',
        studentCapacity: 180,
        feeRangeBnd: 'BND 2,800–3,600/yr',
        notes: 'License SUSPENDED 30 days ago — multiple compliance failures. Urgent action required.',
      },
      // EXPIRED & SUSPENDED — drives the red KPI
      license: {
        licenseNumber: 'DPE-LIC-2019-0033',
        issuedDate: new Date('2020-01-10'),
        expiryDate: (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d })(),
        status: 'SUSPENDED' as const,
        authorisedLevels: ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'],
        conditions: 'SUSPENDED — failure to meet teacher qualification requirements; financial audit not submitted.',
      },
      inspection: {
        inspectionDate: new Date('2026-03-20'),
        inspectionType: 'COMPLAINT',
        rating: 'UNSATISFACTORY',
        findings: [
          { category: 'Staffing', severity: 'major', observation: '4 of 9 teaching staff lack MOE-recognised qualifications.', recommendation: 'Cease teaching deployment until qualifications regularised.' },
          { category: 'Compliance', severity: 'major', observation: 'No annual financial audit submitted for 2024/25.', recommendation: 'Submit audited financials within 30 days.' },
          { category: 'Health & Safety', severity: 'major', observation: 'Fire safety equipment inspection certificate expired.', recommendation: 'Recertify within 14 days.' },
        ],
        followUpDueDate: (() => { const d = new Date(); d.setDate(d.getDate() - 20); return d })(),
        resolved: false,
        notes: 'Multiple critical findings led to license suspension on a later date.',
      },
    },
  ]

  const createdPrivSchools: { id: string; code: string; name: string }[] = []

  for (const ps of privSchools) {
    const school = await prisma.school.create({
      data: {
        name: ps.name,
        code: ps.code,
        authority: 'PRIVATE',
        schoolType: ps.schoolType,
        address: ps.address,
        phone: ps.phone,
        principal: ps.principal,
        gradeLevels: JSON.stringify(ps.gradeLevels),
        programmes: JSON.stringify(['Standard']),
        classLetters: JSON.stringify(['A', 'B', 'C', 'D']),
        establishedYear: ps.establishedYear,
      },
    })
    createdPrivSchools.push({ id: school.id, code: school.code, name: school.name })

    await prisma.privateSchoolProfile.create({
      data: {
        schoolId: school.id,
        registrationNo: ps.profile.registrationNo,
        ownerOrganisation: ps.profile.ownerOrganisation,
        ownerContactName: ps.profile.ownerContactName ?? null,
        ownerContactPhone: ps.profile.ownerContactPhone ?? null,
        ownerContactEmail: ps.profile.ownerContactEmail ?? null,
        district: ps.profile.district,
        curriculumModel: ps.profile.curriculumModel,
        studentCapacity: ps.profile.studentCapacity,
        feeRangeBnd: ps.profile.feeRangeBnd ?? null,
        notes: ps.profile.notes ?? null,
      },
    })

    const license = await prisma.schoolLicense.create({
      data: {
        schoolId: school.id,
        licenseNumber: ps.license.licenseNumber,
        issuedDate: ps.license.issuedDate,
        expiryDate: ps.license.expiryDate,
        status: ps.license.status,
        authorisedLevels: JSON.stringify(ps.license.authorisedLevels),
        conditions: ps.license.conditions ?? null,
        issuedByUserId: dpeOfficer.id,
      },
    })

    // Renewal history for PPAH
    if (ps.code === 'PPAH') {
      await prisma.licenseRenewal.create({
        data: {
          licenseId: license.id,
          previousExpiry: new Date('2020-08-01'),
          newExpiry: new Date('2021-08-01'),
          renewedByUserId: dpeOfficer.id,
          notes: 'First renewal, all conditions met.',
        },
      })
      await prisma.licenseRenewal.create({
        data: {
          licenseId: license.id,
          previousExpiry: new Date('2021-08-01'),
          newExpiry: ps.license.expiryDate,
          renewedByUserId: dpeOfficer.id,
          notes: 'Second renewal — staff qualification conditions attached.',
        },
      })
    }

    const inspection = await prisma.schoolInspection.create({
      data: {
        schoolId: school.id,
        inspectionDate: ps.inspection.inspectionDate,
        inspectorUserId: dpeOfficer.id,
        inspectionType: ps.inspection.inspectionType,
        rating: ps.inspection.rating,
        findings: JSON.stringify(ps.inspection.findings),
        followUpDueDate: ('followUpDueDate' in ps.inspection ? ps.inspection.followUpDueDate : null) ?? null,
        resolved: ps.inspection.resolved,
        resolvedAt: ps.inspection.resolved ? ps.inspection.inspectionDate : null,
        resolutionStatus: ps.inspection.resolved ? 'RESOLVED' : 'OPEN',
        resolutionNotes: ps.inspection.resolved
          ? 'Inspection verified. All compliance requirements confirmed met. No deficiencies noted on follow-up review.'
          : null,
        notes: ps.inspection.notes,
      },
    })

    // Seed action items and evidence per school
    if (ps.code === 'SPB') {
      // Resolved school — add evidence docs showing what was uploaded for resolution
      await prisma.inspectionEvidenceDocument.createMany({
        data: [
          { inspectionId: inspection.id, fileName: 'DPE-Inspection-Report-SPB-2026-02.pdf', filePath: `/evidence/inspections/${inspection.id}/DPE-Inspection-Report-SPB-2026-02.pdf`, fileType: 'PDF', description: 'Signed DPE inspection report confirming EXCELLENT rating', uploadedByUserId: dpeOfficer.id },
          { inspectionId: inspection.id, fileName: 'Principal-Attestation-SPB-Feb2026.pdf', filePath: `/evidence/inspections/${inspection.id}/Principal-Attestation-SPB-Feb2026.pdf`, fileType: 'PDF', description: 'Principal attestation letter confirming teacher CPD records', uploadedByUserId: dpeOfficer.id },
        ],
      })
    }

    if (ps.code === 'PPAH') {
      // Open inspection, overdue — action items in progress
      await prisma.inspectionActionItem.createMany({
        data: [
          { inspectionId: inspection.id, findingCategory: 'Staffing', title: 'Submit MOE approval forms for 2 unapproved teachers', description: 'Complete and submit Form DPE-TA-02 for each unapproved teacher to MOE Teacher Approval Unit.', assignedTo: 'Yayasan Al-Hidayah Administration', dueDate: (() => { const d = new Date(); d.setDate(d.getDate() - 5); return d })(), status: 'IN_PROGRESS', createdByUserId: dpeOfficer.id },
          { inspectionId: inspection.id, findingCategory: 'Facilities', title: 'Complete and submit library acquisition log Q4 2025', description: 'Retrieve purchase records and update the library acquisition register for Oct–Dec 2025, then submit to DPE.', assignedTo: 'School Admin Office', dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d })(), status: 'OPEN', createdByUserId: dpeOfficer.id },
        ],
      })
    }

    if (ps.code === 'ILA') {
      // Open inspection, 25 days remaining — action items assigned
      await prisma.inspectionActionItem.createMany({
        data: [
          { inspectionId: inspection.id, findingCategory: 'Health & Safety', title: 'Conduct fire evacuation drill and submit records', description: 'Schedule and conduct a full fire evacuation drill for Term 2. Submit signed drill record form to DPE within 30 days of inspection.', assignedTo: 'Health & Safety Coordinator', dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 20); return d })(), status: 'OPEN', createdByUserId: dpeOfficer.id },
          { inspectionId: inspection.id, findingCategory: 'Curriculum', title: 'Adjust Bahasa Melayu timetable for non-IGCSE students', description: 'Revise the timetable for non-IGCSE students to meet minimum BM instructional hours per MOE Curriculum Circular 2024/01.', assignedTo: 'Deputy Principal (Academic)', dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 25); return d })(), status: 'OPEN', createdByUserId: dpeOfficer.id },
        ],
      })
    }

    if (ps.code === 'TCA') {
      // Open inspection, suspended school — multiple critical action items
      await prisma.inspectionActionItem.createMany({
        data: [
          { inspectionId: inspection.id, findingCategory: 'Staffing', title: 'Cease classroom deployment of 4 unqualified teaching staff', description: 'Issue written notice to stop classroom assignment for the 4 identified staff until MOE qualifications are regularised or substitutes are appointed.', assignedTo: 'Principal En. Hairul Bin Tarmizi', dueDate: (() => { const d = new Date(); d.setDate(d.getDate() - 15); return d })(), status: 'IN_PROGRESS', createdByUserId: dpeOfficer.id },
          { inspectionId: inspection.id, findingCategory: 'Compliance', title: 'Submit audited financial statements for 2024/25', description: 'Engage an approved independent auditor and submit audited income statement and balance sheet for academic year 2024/25 to DPE.', assignedTo: 'Anggerek Education Centre Finance Department', dueDate: (() => { const d = new Date(); d.setDate(d.getDate() - 10); return d })(), status: 'OPEN', createdByUserId: dpeOfficer.id },
          { inspectionId: inspection.id, findingCategory: 'Health & Safety', title: 'Recertify all fire safety equipment', description: 'Engage an approved fire safety service provider to inspect and recertify all fire extinguishers, alarms, and emergency systems. Submit new certificate to DPE.', assignedTo: 'Building Management / Facilities', dueDate: (() => { const d = new Date(); d.setDate(d.getDate() - 18); return d })(), status: 'OPEN', createdByUserId: dpeOfficer.id },
        ],
      })
    }

    // Audit trail for the seeded license issuance
    await prisma.auditEvent.create({
      data: {
        actorUserId: dpeOfficer.id,
        action: 'PRIV_ED_LICENSE_ISSUED',
        entityType: 'SchoolLicense',
        entityId: license.id,
        details: JSON.stringify({ schoolId: school.id, licenseNumber: ps.license.licenseNumber, seeded: true }),
      },
    })
  }

  // One compliance circular targeting all private schools
  const circular = await prisma.complianceCircular.create({
    data: {
      circularNumber: 'DPE/CIR/2026/03',
      title: 'Annual Financial Audit Submission — 2025/26',
      bodyMarkdown:
        '## Annual Financial Audit Submission\n\n' +
        'All private education institutions are required to submit their audited financial statements for the academic year 2025/26 no later than **30 November 2026**.\n\n' +
        'Submissions must include:\n' +
        '- Independently audited income statement\n' +
        '- Balance sheet as at 31 August 2026\n' +
        '- Statement of compliance with fee structures lodged with DPE\n\n' +
        'Late submissions may trigger a compliance inspection under Regulation 8.4.',
      effectiveDate: new Date(),
      acknowledgementDueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d })(),
      targetScope: 'ALL_PRIVATE',
      issuedByUserId: dpeOfficer.id,
      targets: {
        create: createdPrivSchools.map((s) => ({ schoolId: s.id })),
      },
    },
  })

  // SPB has acknowledged; others have not
  const spb = createdPrivSchools.find((s) => s.code === 'SPB')
  if (spb) {
    await prisma.circularTarget.updateMany({
      where: { circularId: circular.id, schoolId: spb.id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedByUserId: dpeOfficer.id,
        acknowledgedNotes: 'Acknowledged via DPE portal. Audit firm engaged.',
      },
    })
  }

  await prisma.auditEvent.create({
    data: {
      actorUserId: dpeOfficer.id,
      action: 'PRIV_ED_CIRCULAR_ISSUED',
      entityType: 'ComplianceCircular',
      entityId: circular.id,
      details: JSON.stringify({ circularNumber: 'DPE/CIR/2026/03', targetCount: createdPrivSchools.length, seeded: true }),
    },
  })

  console.log(`  ✓ ${createdPrivSchools.length} private schools seeded with licenses, inspections, 1 circular`)
  console.log(`  ✓ DPE officer account: dpeofficer / Demo@2026`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
