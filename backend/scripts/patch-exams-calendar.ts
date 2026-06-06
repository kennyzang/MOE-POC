import prisma from '../src/lib/prisma'

async function main() {
  console.log('Patching: adding SMHK exams + calendar events...')

  const smhk = await prisma.school.findFirst({ where: { code: 'SMHK' } })
  if (!smhk) throw new Error('SMHK school not found')

  // ─── Add SMHK Exams ──────────────────────────────────────────────────────────

  const examData = [
    { schoolId: smhk.id, examType: 'O_LEVEL',   year: 2026, examDate: new Date('2026-07-06T08:00:00Z'), venue: 'Main Examination Hall A',   status: 'upcoming' },
    { schoolId: smhk.id, examType: 'O_LEVEL',   year: 2026, examDate: new Date('2026-07-10T08:00:00Z'), venue: 'Main Examination Hall A',   status: 'upcoming' },
    { schoolId: smhk.id, examType: 'A_LEVEL',   year: 2026, examDate: new Date('2026-07-06T08:00:00Z'), venue: 'Examination Hall B',         status: 'upcoming' },
    { schoolId: smhk.id, examType: 'IGCSE',     year: 2026, examDate: new Date('2026-09-01T08:00:00Z'), venue: 'Science Block Room 3',       status: 'upcoming' },
    { schoolId: smhk.id, examType: 'O_LEVEL',   year: 2025, examDate: new Date('2025-07-10T08:00:00Z'), venue: 'Main Examination Hall A',   status: 'completed' },
    { schoolId: smhk.id, examType: 'A_LEVEL',   year: 2025, examDate: new Date('2025-07-08T08:00:00Z'), venue: 'Examination Hall B',         status: 'completed' },
  ]

  for (const exam of examData) {
    const existing = await prisma.exam.findFirst({ where: { schoolId: smhk.id, examType: exam.examType, year: exam.year, examDate: exam.examDate } })
    if (!existing) {
      await prisma.exam.create({ data: exam })
      console.log(`  Created: ${exam.examType} ${exam.year}`)
    } else {
      console.log(`  Already exists: ${exam.examType} ${exam.year}`)
    }
  }

  // ─── Add more Calendar Events ────────────────────────────────────────────────

  const daysFromNow = (n: number) => { const d = new Date('2026-06-06'); d.setDate(d.getDate() + n); return d }
  const daysAgo = (n: number) => daysFromNow(-n)

  const newEvents = [
    // Holidays
    { title: 'Hari Raya Aidiladha',             date: new Date('2026-06-17'), type: 'holiday', description: 'Public holiday — Hari Raya Aidiladha. School closed.' },
    { title: 'Brunei National Day',              date: new Date('2026-02-23'), type: 'holiday', description: 'National Day of Brunei Darussalam. School closed.' },
    { title: 'Sultan of Brunei Birthday',        date: new Date('2026-07-15'), type: 'holiday', description: 'HM The Sultan and Yang Di-Pertuan of Brunei\'s Birthday. Public holiday.' },
    { title: 'Mid-Year School Holiday',          date: new Date('2026-06-20'), endDate: new Date('2026-07-05'), type: 'holiday', description: 'Two-week mid-year school break.' },
    { title: 'Term 3 Begins',                    date: new Date('2026-07-06'), type: 'event',  description: 'School reopens for Term 3. Normal timetable resumes.' },
    { title: 'Israk Mikraj',                     date: new Date('2026-01-27'), type: 'holiday', description: 'Public holiday — Prophet Muhammad\'s Ascension Day.' },
    { title: 'First Day of Ramadan',             date: new Date('2026-02-18'), type: 'holiday', description: 'Start of Ramadan. School timetable adjusted.' },
    { title: 'Hari Raya Aidilfitri',             date: new Date('2026-03-21'), endDate: new Date('2026-03-22'), type: 'holiday', description: 'Hari Raya Aidilfitri holiday. School closed for 2 days.' },
    // Exams
    { title: 'Year 7 & 8 Term Assessment',       date: new Date('2026-06-08'), endDate: new Date('2026-06-12'), type: 'exam', description: 'End-of-term assessments for Year 7 and 8.' },
    { title: 'Year 9 Mid-Year Examinations',     date: new Date('2026-06-09'), endDate: new Date('2026-06-13'), type: 'exam', description: 'Mid-year examinations for Year 9 students.' },
    { title: 'Year 10 Mock Examinations',        date: new Date('2026-05-11'), endDate: new Date('2026-05-15'), type: 'exam', description: 'Practice examination for Year 10 ahead of O-Level.' },
    { title: 'O-Level Practical Examinations',   date: new Date('2026-07-01'), endDate: new Date('2026-07-03'), type: 'exam', description: 'Practical components for O-Level candidates (Science, ICT).' },
    // Activities
    { title: 'Inter-School Sports Day',          date: new Date('2026-06-14'), type: 'activity', description: 'Annual sports day. All students participate. Attire: sports kit.' },
    { title: 'Science & Technology Fair',        date: new Date('2026-05-28'), endDate: new Date('2026-05-29'), type: 'activity', description: 'Students showcase science and technology projects. Open to parents.' },
    { title: 'School Annual Dinner & Awards',    date: new Date('2026-05-16'), type: 'activity', description: 'Annual prize-giving and dinner ceremony for outstanding students and staff.' },
    { title: 'Prefects Installation Ceremony',  date: new Date('2026-07-10'), type: 'activity', description: 'Installation of school prefects for the 2026/27 academic year.' },
    { title: 'Year 7 Orientation Day',           date: new Date('2026-01-05'), type: 'activity', description: 'Welcome day for new Year 7 students. Parents invited for morning session.' },
    { title: 'Environmental Awareness Week',     date: daysFromNow(14), endDate: daysFromNow(18), type: 'activity', description: 'Week-long activities including tree planting, recycling drive, and eco-poster competition.' },
    { title: 'Career & University Fair',         date: daysFromNow(30), type: 'activity', description: 'Representatives from local and international universities and employers. Year 10–12 compulsory.' },
    { title: 'World Teachers Day Assembly',      date: new Date('2026-10-05'), type: 'activity', description: 'Special school assembly to honour teachers. Students prepare tributes.' },
    // School Events
    { title: 'Parent-Teacher Consultation Day',  date: daysFromNow(10), type: 'event', description: 'Full-day parent-teacher meetings. Online booking opens one week prior.' },
    { title: 'School Photo Day',                 date: daysFromNow(7), type: 'event', description: 'Individual and class photos. Students must wear full formal uniform.' },
    { title: 'School Play & Drama Night',        date: daysFromNow(45), type: 'event', description: 'Annual drama performance by Year 9 and 10 students. Tickets issued to parents.' },
    { title: 'Financial Aid Review',             date: daysFromNow(20), type: 'event', description: 'Review of student bursary and financial aid applications for Semester 2.' },
    { title: 'New Student Admissions Open Day',  date: daysFromNow(60), type: 'event', description: 'School open to prospective Year 7 applicants and families. Tours and presentations.' },
    { title: 'Staff Professional Development Day', date: daysFromNow(25), type: 'event', description: 'Full-day CPD for all teaching staff. Students do not attend school.' },
    { title: 'Board of Governors Meeting',       date: daysFromNow(18), type: 'event', description: 'Quarterly meeting of the School Board. Results and plans for Semester 2 presented.' },
    { title: 'End of Academic Year 2025/26',     date: new Date('2026-10-30'), type: 'event', description: 'Final day of the 2025/26 academic year. Report cards distributed.' },
  ]

  let added = 0
  for (const ev of newEvents) {
    const existing = await prisma.schoolEvent.findFirst({ where: { title: ev.title } })
    if (!existing) {
      await prisma.schoolEvent.create({ data: ev })
      added++
    }
  }

  console.log(`  Added ${added} new calendar events`)
  console.log('Patch complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
