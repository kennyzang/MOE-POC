import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

function daysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(8, 0, 0, 0); return d
}
function daysFromNow(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(23, 59, 0, 0); return d
}

async function main() {
  // ── Get key entities ───────────────────────────────────────────────
  const ahmad = await p.student.findFirst({
    where: { user: { username: 'student001' } },
    include: {
      user: true,
      parentLinks: { include: { parent: { include: { user: true } } } },
      enrollments: { where: { status: 'enrolled' }, include: { course: true } },
    },
  })
  if (!ahmad) { console.log('Ahmad not found'); return }

  const parent01 = ahmad.parentLinks.find(pl => pl.parent.user.username === 'parent01')?.parent
  const parentSiti = ahmad.parentLinks.find(pl => pl.parent.user.username === 'parent.siti')?.parent
  if (!parent01) { console.log('parent01 not found'); return }

  console.log('Ahmad:', ahmad.user.displayName, 'gr:', ahmad.gradeLevel)
  console.log('parent01:', parent01.user.username, 'userId:', parent01.userId.slice(0, 8))
  console.log('Enrollments:', ahmad.enrollments.length)

  // Get a teacher to assign to assignments
  const teacher01 = await p.teacher.findFirst({ where: { user: { username: 'teacher01' } }, include: { user: true } })
  const mathTeacher = await p.teacher.findFirst({ where: { timetableSlots: { some: { semester: '2026-S1' } } } })
  const assignTeacher = teacher01 ?? mathTeacher
  if (!assignTeacher) { console.log('No teacher found'); return }
  console.log('Using teacher:', assignTeacher.staffId)

  // ── 1. Assignments ─────────────────────────────────────────────────
  const existingCount = await p.assignment.count()
  if (existingCount > 0) {
    console.log('\nAssignments already exist:', existingCount)
  } else {
    const courseIds = ahmad.enrollments.map(e => e.courseId)
    const courses = await p.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, name: true, code: true } })

    const templates = [
      { suffix: 'Chapter 1 Exercise', type: 'homework', daysBack: 28, desc: 'Complete all exercises from Chapter 1. Show your working clearly.' },
      { suffix: 'Week 3 Quiz', type: 'quiz', daysBack: 21, desc: 'Short quiz covering topics from weeks 1-3. Open notes allowed.' },
      { suffix: 'Mid-Term Assignment', type: 'project', daysBack: 14, desc: 'Submit a 2-page report on the unit 2 topic. Include diagrams where relevant.' },
      { suffix: 'Chapter 3 Review', type: 'homework', daysBack: 7, desc: 'Answer all review questions at the end of Chapter 3.' },
      { suffix: 'Term 2 Project', type: 'project', daysBack: -7, desc: 'Individual project — submit digitally or as a printed copy by the due date.' },
      { suffix: 'Chapter 4 Worksheet', type: 'homework', daysBack: -14, desc: 'Complete the worksheet distributed in class. Show all workings for full marks.' },
    ]

    const toCreate = courses.flatMap(c =>
      templates.map(t => ({
        courseId: c.id,
        teacherId: assignTeacher.id,
        title: `${t.suffix} — ${c.name}`,
        description: t.desc,
        type: t.type,
        dueDate: daysAgo(t.daysBack),
        maxScore: t.type === 'quiz' ? 20 : 100,
        status: 'published',
      }))
    )
    const created = await p.assignment.createMany({ data: toCreate })
    console.log('\nCreated', created.count, 'assignments')

    // Submissions for past assignments
    const pastAsgns = await p.assignment.findMany({
      where: { courseId: { in: courseIds }, dueDate: { lte: new Date() } },
    })
    const grades = [85, 72, 91, 68, 78, 88, 95, 73, 82, 77, 90, 65, 83, 79, 94, 87, 71, 93, 76, 88]
    const submissions = pastAsgns.slice(0, grades.length).map((a, i) => ({
      assignmentId: a.id,
      studentId: ahmad.id,
      submittedAt: daysAgo(Math.max(1, (a.dueDate ? Math.floor((Date.now() - a.dueDate.getTime()) / 86400000) : 3) - 1)),
      isLate: i % 7 === 3,
      score: grades[i],
      status: 'graded' as const,
      feedback: grades[i] >= 80 ? 'Good work! Keep it up.' : grades[i] >= 65 ? 'Needs improvement in a few areas — see comments.' : 'Please review this topic and see me for help.',
    }))
    const subs = await p.assignmentSubmission.createMany({ data: submissions, skipDuplicates: true })
    console.log('Created', subs.count, 'submissions for Ahmad')
  }

  // ── 2. Consent Form Recipients ─────────────────────────────────────
  const allForms = await p.consentForm.findMany({ select: { id: true, title: true, targetGradeLevel: true, status: true } })
  console.log('\nConsent forms in DB:', allForms.length)

  for (const form of allForms) {
    if (form.targetGradeLevel && form.targetGradeLevel !== ahmad.gradeLevel) continue

    const parentsToProcess = [parent01, parentSiti].filter((x): x is NonNullable<typeof parent01> => !!x)
    for (const par of parentsToProcess) {
      const existing = await p.consentFormRecipient.findFirst({
        where: { formId: form.id, parentUserId: par.userId, studentId: ahmad.id },
      })
      if (!existing) {
        await p.consentFormRecipient.create({
          data: {
            formId: form.id,
            parentUserId: par.userId,
            studentId: ahmad.id,
            acknowledgedAt: form.status === 'CLOSED' ? new Date('2026-02-20') : (Math.random() > 0.5 ? new Date('2026-06-01') : null),
            acknowledgmentNote: form.status === 'CLOSED' ? 'Acknowledged — reviewed with my child.' : null,
          },
        })
        console.log('  Created recipient:', form.title.slice(0, 40), '→', par.user.username)
      }
    }
  }

  // Create recipients for fatimah's children too
  const fatimah = await p.parent.findFirst({
    where: { user: { username: 'fatimah' } },
    include: { user: true, childLinks: { include: { student: true } } },
  })
  if (fatimah) {
    for (const form of allForms.filter(f => f.status !== 'DRAFT')) {
      for (const link of fatimah.childLinks) {
        if (form.targetGradeLevel && form.targetGradeLevel !== link.student.gradeLevel) continue
        const existing = await p.consentFormRecipient.findFirst({
          where: { formId: form.id, parentUserId: fatimah.userId, studentId: link.student.id },
        })
        if (!existing) {
          await p.consentFormRecipient.create({
            data: {
              formId: form.id, parentUserId: fatimah.userId, studentId: link.student.id,
              acknowledgedAt: new Date('2026-06-02'), acknowledgmentNote: 'We consent. Thank you.',
            },
          })
          console.log('  Created recipient for fatimah:', form.title.slice(0, 30))
        }
      }
    }
  }

  // ── 3. More fee invoices for Ahmad ─────────────────────────────────
  const existingFees = await p.feeInvoice.count({ where: { studentId: ahmad.id } })
  if (existingFees <= 2) {
    await p.feeInvoice.createMany({
      data: [
        {
          studentId: ahmad.id, invoiceNumber: 'INV-2026-S1-ACT', semester: '2026-S1',
          amount: 50, status: 'unpaid', dueDate: daysFromNow(14),
          description: 'Year 7 Activity & Co-curricular Fee — Term 2 2026',
          lineItems: JSON.stringify([{ code: 'ACTIVITY', name: 'Activity Fee', amount: 50 }]),
        },
        {
          studentId: ahmad.id, invoiceNumber: 'INV-2025-S2-OD', semester: '2025-S2',
          amount: 300, status: 'overdue', dueDate: daysAgo(45),
          description: 'Year 7 Semester 2 2025 Fees (OVERDUE — 45 days)',
          lineItems: JSON.stringify([
            { code: 'TUITION', name: 'Tuition Fee', amount: 200 },
            { code: 'LIBRARY', name: 'Library Fee', amount: 30 },
            { code: 'EXAMINATION', name: 'Examination Fee', amount: 70 },
          ]),
        },
      ],
    })
    console.log('\nCreated 2 more fee invoices for Ahmad')
  } else {
    console.log('\nFee invoices already adequate:', existingFees)
  }

  // ── 4. More message threads for parent01 ───────────────────────────
  const existingThreads = await p.messageThread.count({ where: { parentUserId: parent01.userId } })
  if (existingThreads < 3 && teacher01) {
    const t2 = await p.messageThread.create({
      data: { subject: "Ahmad's upcoming exams — revision support", parentUserId: parent01.userId, teacherUserId: teacher01.user.id, studentId: ahmad.id },
    })
    await p.directMessage.createMany({ data: [
      { threadId: t2.id, senderId: parent01.userId, content: "Assalamualaikum Ms. Aminah. The mock exams are next week. Ahmad is feeling anxious. What topics should we focus on at home?", createdAt: daysAgo(5), readAt: daysAgo(5) },
      { threadId: t2.id, senderId: teacher01.user.id, content: "Wa'alaikumsalam. Focus on Chapter 3 (subject-verb agreement) for English and the algebra revision sheet from last Friday. Ahmad is well-prepared — he just needs confidence. I will be available Thursday after school if you'd like to speak.", createdAt: daysAgo(4), readAt: daysAgo(4) },
      { threadId: t2.id, senderId: parent01.userId, content: "Thank you Ms. Aminah. We will revise those tonight. Really appreciate all your support.", createdAt: daysAgo(3), readAt: daysAgo(3) },
    ] })

    const t3 = await p.messageThread.create({
      data: { subject: 'Attendance concern — 2 unexplained absences', parentUserId: parent01.userId, teacherUserId: teacher01.user.id, studentId: ahmad.id },
    })
    await p.directMessage.createMany({ data: [
      { threadId: t3.id, senderId: teacher01.user.id, content: "Dear Hj Abdullah, I am writing regarding Ahmad's two unexplained absences on 28 and 29 May. Please submit a written note or medical certificate to the school office to regularise these absences. Thank you.", createdAt: daysAgo(8), readAt: daysAgo(7) },
      { threadId: t3.id, senderId: parent01.userId, content: "Apologise for the delay, Ms. Aminah. Ahmad was ill with a fever. I will bring the medical certificate tomorrow.", createdAt: daysAgo(7), readAt: daysAgo(7) },
      { threadId: t3.id, senderId: teacher01.user.id, content: "Thank you for letting us know. Please submit the certificate to the office so Ahmad's record can be updated. I hope he is feeling better now.", createdAt: daysAgo(6), readAt: daysAgo(6) },
    ] })

    console.log('\nCreated 2 more message threads for parent01')
  } else {
    console.log('\nMessage threads already adequate:', existingThreads)
  }

  // ── 5. Upcoming meeting for parent01 ───────────────────────────────
  const existingMtgs = await p.parentTeacherMeeting.count({ where: { parentUserId: parent01.userId } })
  if (existingMtgs < 2 && teacher01) {
    await p.parentTeacherMeeting.create({
      data: {
        teacherId: teacher01.id, parentUserId: parent01.userId, studentId: ahmad.id,
        meetingDate: daysFromNow(5), startTime: '14:00', endTime: '14:30',
        purpose: 'Semester 1 progress review and IEP update discussion',
        status: 'SCHEDULED',
      },
    })
    console.log('Created upcoming meeting for parent01')
  }

  // ── Summary ────────────────────────────────────────────────────────
  const totals = {
    assignments: await p.assignment.count(),
    submissions: await p.assignmentSubmission.count(),
    consentRecipients: await p.consentFormRecipient.count(),
    feeInvoicesAhmad: await p.feeInvoice.count({ where: { studentId: ahmad.id } }),
    threadsParent01: await p.messageThread.count({ where: { parentUserId: parent01.userId } }),
    meetingsParent01: await p.parentTeacherMeeting.count({ where: { parentUserId: parent01.userId } }),
  }
  console.log('\n=== Final counts ===')
  Object.entries(totals).forEach(([k, v]) => console.log(' ', k + ':', v))
}

main().finally(() => p.$disconnect())
