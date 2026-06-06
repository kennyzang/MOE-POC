/**
 * patch-enrollments.ts
 *
 * Fixes the enrollment data gap:
 * - SMHK has 3,456 students but only 43 enrollment records
 * - Enrolls every student in all courses that match their gradeLevel
 * - Adds realistic submissions + grades for Year 7A students (teacher01's class)
 * - Also fixes SRPB, SMAB, ISB enrollments
 */
import prisma from '../src/lib/prisma'

function randomBetween(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a
}

function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

async function enrollStudentsInGradeCourses(schoolCode: string) {
  const school = await prisma.school.findFirst({ where: { code: schoolCode } })
  if (!school) { console.log(`  School ${schoolCode} not found, skipping`); return }

  const courses = await prisma.course.findMany({ where: { schoolId: school.id } })
  const students = await prisma.student.findMany({
    where: { schoolId: school.id },
    select: { id: true, gradeLevel: true },
  })

  console.log(`  ${schoolCode}: ${students.length} students, ${courses.length} courses`)

  // Build map: gradeLevel → courseIds
  const gradeCoursesMap = new Map<string, string[]>()
  for (const c of courses) {
    const key = c.gradeLevel ?? 'All'
    if (!gradeCoursesMap.has(key)) gradeCoursesMap.set(key, [])
    gradeCoursesMap.get(key)!.push(c.id)
  }
  const allCourseIds = gradeCoursesMap.get('All') ?? []

  // Get existing enrollments as a Set for fast lookup
  const existing = await prisma.enrollment.findMany({
    where: { student: { schoolId: school.id } },
    select: { studentId: true, courseId: true },
  })
  const existingSet = new Set(existing.map(e => `${e.studentId}:${e.courseId}`))

  const toCreate: { studentId: string; courseId: string; status: string; enrolledAt: Date }[] = []

  for (const student of students) {
    const gradeCourses = gradeCoursesMap.get(student.gradeLevel ?? '') ?? []
    const courseIds = [...gradeCourses, ...allCourseIds]
    for (const courseId of courseIds) {
      if (!existingSet.has(`${student.id}:${courseId}`)) {
        toCreate.push({ studentId: student.id, courseId, status: 'enrolled', enrolledAt: new Date('2026-01-13') })
      }
    }
  }

  if (toCreate.length === 0) {
    console.log(`  ${schoolCode}: all enrollments already exist`)
    return
  }

  // Batch insert in chunks of 500
  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await prisma.enrollment.createMany({ data: toCreate.slice(i, i + CHUNK) })
    inserted += Math.min(CHUNK, toCreate.length - i)
    process.stdout.write(`\r  ${schoolCode}: inserted ${inserted}/${toCreate.length} enrollments`)
  }
  console.log(`\n  ${schoolCode}: done`)
}

async function addSubmissionsAndGradesForYear7A() {
  console.log('\nAdding submissions + grades for Year 7A...')

  const year7aStudents = await prisma.student.findMany({
    where: { school: { code: 'SMHK' }, gradeLevel: 'Year 7', className: '7A' },
    select: { id: true, userId: true },
    orderBy: { id: 'asc' },
  })
  console.log(`  Year 7A students: ${year7aStudents.length}`)

  // Math and Science Year 7 assignments
  const math701Assigns = await prisma.assignment.findMany({
    where: { course: { code: 'MATH701' } },
    orderBy: { createdAt: 'asc' },
  })
  const sci701Assigns = await prisma.assignment.findMany({
    where: { course: { code: 'SCI701' } },
    orderBy: { createdAt: 'asc' },
  })

  const allAssigns = [...math701Assigns, ...sci701Assigns]
  console.log(`  Assignments to populate: ${allAssigns.length}`)

  const sampleResponses: Record<string, string[]> = {
    homework: [
      'I completed all the exercises. The quadratic formula problems were challenging but I managed to solve them with the given steps.',
      'Done! I found question 5 the hardest. I got help from the textbook for the last part.',
      'Completed all problems. I double-checked my work and corrected two arithmetic mistakes.',
      'Finished the homework. Some of the word problems were tricky but I used diagrams to help.',
      'All questions answered. I spent extra time on the fractions section and I think I got them right.',
    ],
    quiz: [
      'I answered all 10 questions. Not sure about Q7 but I did my best.',
      'Completed the quiz in 30 minutes. Q3 and Q9 were the hardest for me.',
      'Done. I reviewed my notes before attempting this.',
      'Submitted. I think I made an error on the last question but tried my best.',
    ],
    project: [
      'I have completed my project report on the water cycle. It includes diagrams and data from our experiment.',
      'Project submitted. I worked on this over the past two weeks and included all required sections.',
      'Here is my project. I focused on the real-world application and included photos from the lab.',
    ],
    reading: [
      'I read chapters 3 and 4. My main takeaway was the relationship between variables in linear equations.',
      'Read the assigned sections. The part about velocity and acceleration was very interesting.',
      'Finished reading. I took notes on the key concepts and highlighted the important formulas.',
    ],
  }

  for (const assign of allAssigns) {
    const isEarly = ['Chapter 1 Review', 'Week 3 Quiz', 'Mid-Term', 'Chapter 3'].some(k => assign.title.includes(k))
    const isOpen = ['Term 2 Project', 'Chapter 4'].some(k => assign.title.includes(k))

    // How many students submitted: early/graded = 26-29/31, open = 12-18/31
    const submitterCount = isEarly ? randomBetween(26, 29) : isOpen ? randomBetween(12, 18) : randomBetween(20, 28)
    const submitters = [...year7aStudents].sort(() => 0.5 - Math.random()).slice(0, submitterCount)

    const lateStudents = new Set(submitters.slice(-randomBetween(1, 3)).map(s => s.id))

    const typeKey = assign.type as keyof typeof sampleResponses
    const responses = sampleResponses[typeKey] ?? sampleResponses.homework

    for (const student of submitters) {
      const existing = await prisma.assignmentSubmission.findFirst({
        where: { assignmentId: assign.id, studentId: student.id },
      })
      if (existing) continue

      const submitted = new Date('2026-06-04')
      submitted.setHours(randomBetween(7, 22), randomBetween(0, 59))
      const isLate = lateStudents.has(student.id)
      if (isLate) submitted.setDate(submitted.getDate() + randomBetween(1, 3))

      const content = responses[Math.floor(seededRandom(student.id.charCodeAt(0) + assign.id.charCodeAt(0)) * responses.length)]

      // Only grade early assignments (not open ones)
      let score: number | null = null
      let feedback: string | null = null
      if (isEarly) {
        const base = Math.floor(seededRandom(student.id.charCodeAt(3) + assign.id.charCodeAt(2)) * 40) + 60
        score = Math.min(assign.maxScore, Math.floor((base / 100) * assign.maxScore))
        feedback = score >= 85
          ? 'Excellent work! All key concepts demonstrated correctly.'
          : score >= 70
          ? 'Good effort. Review the highlighted sections for improvement.'
          : 'Satisfactory. Please see me after class for guidance on the weaker areas.'
      }

      await prisma.assignmentSubmission.create({
        data: {
          assignmentId: assign.id,
          studentId: student.id,
          content,
          submittedAt: submitted,
          isLate,
          score,
          feedback,
          status: score !== null ? 'graded' : 'submitted',
        },
      })
    }

    const submissionCount = await prisma.assignmentSubmission.count({ where: { assignmentId: assign.id } })
    console.log(`  ${assign.course?.id?.slice(0, 4) ?? '?'} "${assign.title.slice(0, 40)}" → ${submissionCount} submissions`)
  }
}

async function addGradeItemsForYear7Courses() {
  console.log('\nEnsuring grade items exist for Year 7 courses...')

  const year7Courses = await prisma.course.findMany({
    where: { school: { code: 'SMHK' }, gradeLevel: 'Year 7' },
    include: { gradeItems: true },
  })

  for (const course of year7Courses) {
    if (course.gradeItems.length > 0) {
      console.log(`  ${course.code}: ${course.gradeItems.length} grade items exist`)
      continue
    }

    const items = [
      { courseId: course.id, name: 'Quiz 1',        type: 'quiz',       maxScore: 20,  weight: 0.10, dueDate: new Date('2026-02-28') },
      { courseId: course.id, name: 'Assignment 1',  type: 'assignment', maxScore: 50,  weight: 0.15, dueDate: new Date('2026-03-14') },
      { courseId: course.id, name: 'Midterm Exam',  type: 'exam',       maxScore: 100, weight: 0.30, dueDate: new Date('2026-04-04') },
      { courseId: course.id, name: 'Assignment 2',  type: 'assignment', maxScore: 50,  weight: 0.15, dueDate: new Date('2026-05-09') },
      { courseId: course.id, name: 'Final Exam',    type: 'exam',       maxScore: 100, weight: 0.30, dueDate: new Date('2026-07-10') },
    ]

    for (const item of items) {
      await prisma.gradeItem.create({ data: item })
    }
    console.log(`  ${course.code}: created 5 grade items`)
  }
}

async function addGradesForYear7A() {
  console.log('\nAdding grades for Year 7A students...')

  const year7aStudents = await prisma.student.findMany({
    where: { school: { code: 'SMHK' }, gradeLevel: 'Year 7', className: '7A' },
    select: { id: true },
    orderBy: { id: 'asc' },
  })

  const year7Courses = await prisma.course.findMany({
    where: { school: { code: 'SMHK' }, gradeLevel: 'Year 7' },
    include: { gradeItems: true },
  })

  let gradedCount = 0
  for (const course of year7Courses) {
    for (const gi of course.gradeItems) {
      // Only grade completed assessments (not Final Exam - still upcoming)
      if (gi.name === 'Final Exam') continue

      for (const student of year7aStudents) {
        const exists = await prisma.grade.findUnique({
          where: { studentId_gradeItemId: { studentId: student.id, gradeItemId: gi.id } },
        })
        if (exists) continue

        // Generate a realistic score distribution: mostly 60-95, a few outliers
        const seed = (student.id.charCodeAt(0) * 7 + gi.id.charCodeAt(0) * 13) % 100
        let score: number
        if (seed < 5) score = randomBetween(30, 49)          // ~5% failing
        else if (seed < 20) score = randomBetween(50, 64)     // ~15% marginal
        else if (seed < 55) score = randomBetween(65, 79)     // ~35% satisfactory
        else if (seed < 85) score = randomBetween(80, 90)     // ~30% good
        else score = randomBetween(91, gi.maxScore)            // ~15% excellent

        const pct = (score / gi.maxScore) * 100
        const letter = pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F'

        await prisma.grade.create({
          data: { studentId: student.id, gradeItemId: gi.id, score, letterGrade: letter, gradedAt: gi.dueDate ?? new Date() },
        })
        gradedCount++
      }
    }
  }
  console.log(`  Added ${gradedCount} grade records for Year 7A`)
}

async function addYear8Enrollments() {
  console.log('\nChecking Year 8 enrollment gap...')
  const y8courses = await prisma.course.findMany({ where: { school: { code: 'SMHK' }, gradeLevel: 'Year 8' } })
  const y8students = await prisma.student.findMany({ where: { school: { code: 'SMHK' }, gradeLevel: 'Year 8' }, select: { id: true } })

  // Already covered by enrollStudentsInGradeCourses but verify
  const enrolled = await prisma.enrollment.count({ where: { student: { school: { code: 'SMHK' }, gradeLevel: 'Year 8' } } })
  console.log(`  Year 8: ${y8students.length} students, ${y8courses.length} courses, ${enrolled} enrollment records`)
}

async function main() {
  console.log('=== Enrollment Patch Script ===\n')

  console.log('Step 1: Enrolling students in grade-level courses...')
  await enrollStudentsInGradeCourses('SMHK')
  await enrollStudentsInGradeCourses('SRPB')
  await enrollStudentsInGradeCourses('SMAB')
  await enrollStudentsInGradeCourses('ISB')

  console.log('\nStep 2: Ensuring grade items for Year 7 courses...')
  await addGradeItemsForYear7Courses()

  console.log('\nStep 3: Adding grades for Year 7A students...')
  await addGradesForYear7A()

  console.log('\nStep 4: Adding submissions for Year 7A students...')
  await addSubmissionsAndGradesForYear7A()

  await addYear8Enrollments()

  // Summary
  const totalEnrollments = await prisma.enrollment.count()
  const totalSubmissions = await prisma.assignmentSubmission.count()
  const totalGrades = await prisma.grade.count()
  console.log('\n=== Done ===')
  console.log(`Total enrollments: ${totalEnrollments}`)
  console.log(`Total submissions: ${totalSubmissions}`)
  console.log(`Total grades:      ${totalGrades}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
