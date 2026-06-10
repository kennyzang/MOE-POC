# MOE SERPS POC — Oral Demonstration Script (v2)

**Target Duration:** ~55–60 minutes (excluding Q&A)  
**Demo Date:** 2026-06-11 (Thursday)  
**Audience:** MOE Brunei leadership, school principals, IT stakeholders  
**System:** http://localhost:3000 (PC) / http://localhost:3001 (Mobile H5)

---

## Pre-Demo Checklist

- Run `cd backend && npm run db:reset` on demo morning (seeds 3,456 students + all modules)
- Start backend: `cd backend && npm run dev` (port 4000)
- Start PC frontend: `cd pc && npm run dev` (port 3000)
- Start mobile: `cd mobile && npm run dev` (port 3001)
- Open two browser windows: Window A (PC at localhost:3000), Window B (Mobile H5 at localhost:3001 in Chrome DevTools mobile emulation)
- Pre-login `admin / Demo@2026` in a separate PC tab (keep it ready for later)
- Have the login page open in Window A as the starting screen

---

## OPENING (2 min)

**> ⚠️ All demo passwords have been unified to `Demo@2026`**  

**[Screen shows: Login page with the Demo Accounts panel on the right]**

> "Good morning everyone. Today I'm going to walk you through SERPS — the School Enterprise Resource Planning System — a proof-of-concept we've built for the Ministry of Education, Brunei.
>
> SERPS covers the full lifecycle of school administration. Rather than telling you about it, I'd like to show you — by following a real scenario from start to finish.
>
> Imagine a parent, Mrs. Siti, who wants to enrol her child in this school. Let's begin right there — the admissions process."

---

## ACT 1: A PARENT APPLIES — PUBLIC REGISTRATION PORTAL (5 min)

**[Open a new tab → navigate to /register — no login required]**

> "This is our public-facing student registration portal. It requires no login at all — any parent can access this from home, on their phone or computer. No paperwork, no queuing at the school office.
>
> It guides the parent through a structured 5-step wizard."

**[Walk through each step]**

> "**Step 1 — Student Personal Information.** Name, IC number, date of birth, gender, nationality. Notice that when the parent enters the date of birth, the year level is auto-calculated — the parent doesn't need to figure out which year their child belongs to.
>
> **Step 2 — Academic Background.** Previous school, last academic results, any special educational needs to declare. This information helps the school prepare support in advance.
>
> **Step 3 — Guardian Details.** Here's a practical detail — the phone number field has a country code selector. Brunei +673 is default, but Malaysia, Singapore, Indonesia, Philippines, UK and other codes are available — useful for international school applicants. Email validation is inline.
>
> **Step 4 — Supporting Documents.** Birth certificate, student IC, parent IC, and a passport photo. Each required document is clearly marked. The parent uploads files directly — no need to bring physical copies to the school.
>
> **Step 5 — Review & Submit.** The parent sees everything they've entered in a clear summary. Once they click Submit, the application enters the school's pipeline and they receive a tracking number to check status anytime."

> "Now let's see what happens on the school's end."

---

## ACT 2: ADMISSIONS OFFICER PROCESSES THE APPLICATION (5 min)

**[⟳ Switch account: `admissions / Demo@2026`]**

> "I'm now logging in as the Admissions Officer. This is her dedicated workspace."

**[Lands on SIS → Admissions page]**

> "Here she sees all incoming applications in a pipeline view — filterable by status: Submitted, Under Review, Offer Issued, Accepted, Rejected, Waitlisted. We currently have 12 applications in the pipeline.
>
> Let me open one."

**[Click on a Submitted application → view detail]**

> "The full application is here — personal information, academic background, guardian details, supporting documents. The officer can preview the uploaded documents directly in the browser.
>
> She can also attach additional documents from the school's side, or request additional documents from the parent if something is missing.
>
> Now let me change this status to Under Review."

**[Change status to Under Review]**

> "Done. Now if the parent checks their tracking number on the public registration status page, they'll see 'Under Review.'
>
> When the application is ready, the officer can issue an offer, and once accepted, she clicks 'Enrol in SIS' — that creates the student record, assigns a class, and generates login credentials for both the student and the parent. The entire journey — from online form to enrolled student with login access — is handled within this single system."

> "Now that we have students enrolled, let's look at the daily life of this school — starting with what a teacher sees every morning."

---

## ACT 3: A TEACHER'S MORNING — FORM CLASS & DAILY ROLL CALL (6 min)

**[⟳ Switch account: `teacher01 / Demo@2026` — Ms. Aminah Binti Hassan, Form Teacher of Year 7A]**

> "I'm now Ms. Aminah — she's a Mathematics and Science teacher, and the form teacher for Year 7A."

**[Navigate to Teacher Portal → My Form Class]**

> "This is her form class dashboard. She sees her 32 students at a glance — summary cards showing total count, average GPA, and net behavior points. Each student row shows their academic standing, attendance rate, grade average, and conduct score.
>
> She can quickly spot students in trouble — anyone on ACADEMIC_WATCH or PROBATION is colour-coded."

**[Click "Daily Roll Call" button]**

> "Every morning, Ms. Aminah takes attendance right here. She selects the date, and the full class roster appears with toggles — Present, Absent, Late, Excused. She can add a reason for absences.
>
> Let me mark two students absent and one late."

**[Mark attendance → Submit]**

> "Submitted. Now watch — this data immediately flows into the student's profile, the attendance tracking module, and ultimately the risk calculations. If a student reaches 3 consecutive unexplained absences, the system automatically alerts the class teacher and the parent.
>
> Let me also show you the recent attendance sessions — she can click any past session to review who was present, absent, or late on that day."

**[Click a recent session to show the records]**

> "Everything is traceable. Now let me show you what the same teacher does in the classroom."

---

## ACT 4: TEACHING — ASSIGNMENTS & GRADE MANAGEMENT (5 min)

**[Still logged in as `teacher01 / Demo@2026` — Ms. Aminah]**

**[Navigate to Teacher Portal → Assignments]**

> "Ms. Aminah manages assignments from here. She can create different types — Homework, Quiz, Lab Report, Essay, Project — and each type has a tailored form. For example, a Lab Report assignment asks for specific fields like experiment objectives and safety guidelines, while a simple Homework assignment is more straightforward.
>
> Let me show the existing assignments — she can see submission counts out of her 32-student class, and whether grading is complete."

**[Navigate to SIS → Grade Management (via EMS or SIS sidebar)]**

> "For grade management, she can select any course she teaches — Mathematics or Science — and see all grade items: quizzes, assignments, midterms, finals. Each has a weight, and the system computes weighted averages automatically.
>
> She can enter grades, and any amendment is tracked with a full audit trail — who changed what, when, and why."

**[Navigate to SIS → Attendance Tracking]**

> "Here she can also see a broader attendance overview — but notice she can only see classes she's responsible for. She can't see Year 12 data — that belongs to other teachers. The system enforces this scoping automatically."

> "Now, Ms. Aminah just marked students absent. Let's see what a parent sees on their end."

---

## ACT 5: A PARENT'S VIEW — MY CHILDREN & SCHOOL COMMUNICATION (6 min)

**[⟳ Switch account: `parent.siti / Demo@2026` — Mrs. Siti Binti Mohamed, mother of Ahmad and Hafiz]**

> "I'm now Mrs. Siti, a parent with two children enrolled — Ahmad in Year 9 and Hafiz in Year 9C."

**[Lands on Parent → My Children]**

> "This is her home page — an overview of both children side by side. For each child she can see attendance rate, grade average, academic standing, and conduct points. She can click 'View Grades' and it takes her directly to that child's grades — already filtered, no need to search.
>
> Let me click on Ahmad's attendance — she can see his daily records, with statuses like Present, Absent, Late, and Excused. The reasons are shown where applicable. She can immediately see patterns — if Ahmad was late three times this week, that's visible here."

**[Navigate to Parent → Fee Invoices]**

> "Fees are also managed here. She sees all outstanding invoices for her children. Ahmad has an overdue fee.
>
> And here's something important — she can pay directly online."

**[Click "Pay" on an invoice → Payment Modal opens]**

> "The system supports multiple payment methods — Credit Card, Online Banking (FPX), and Bank Transfer. Let me select Credit Card.
>
> Notice the payment interface is fully realistic — card number formatting with auto-spacing, card type auto-detection (Visa, Mastercard, Amex), expiry date, CVV, cardholder name. It mirrors what you'd see on any real online payment gateway.
>
> After payment, the parent can preview and download a PDF receipt."

**[Navigate to Parent → Communications]**

> "This is the communication hub — everything in one page with four tabs:
>
> **Messages** — direct messaging with teachers. She can see conversation threads with unread counts. Let me open a thread — you see the chat bubbles, timestamps, and she can reply instantly.
>
> **Announcements** — school-wide and parent-targeted announcements. Urgent ones have a red priority badge and are pinned to the top.
>
> **Consent Forms** — digital e-signature for field trips, medical authorizations, photo releases. She can sign right here.
>
> **Book Meeting** — she can schedule parent-teacher conferences. Available slots are shown, and unavailable ones are clearly marked."

**[Navigate to Parent → School Contacts]**

> "And she has a full school contact directory. If she wants to message a specific teacher, she clicks the 'Message' button here — it opens the chat directly with that teacher, no searching needed."

> "Now let's see what happens when Mrs. Siti sends a message — does the teacher actually receive it?"

---

## ACT 6: TEACHER RECEIVES MESSAGES & MOBILE EXPERIENCE (4 min)

**[⟳ Switch account: `drsiti / Demo@2026` — Dr. Siti Nurhaliza, Physics teacher]**

> "I'm now Dr. Siti — a Physics teacher. Let me check her Teacher Portal."

**[Navigate to Teacher Portal → Messages]**

> "She can see all parent-teacher conversation threads. Any new message triggers a notification — let me check the bell icon — yes, there's a notification for the new message. She can reply right here."

**[Switch to Window B — Mobile H5, logged in as `drsiti / Demo@2026`]**

> "Now let me show the mobile experience. Teachers don't need to sit at a desktop — everything works on their phone.
>
> Here's Dr. Siti's mobile home screen:
>
> - A **real-time clock** with a one-tap **Check In** button for staff attendance. If it's past the cutoff time, she's automatically marked late. On Fridays and Saturdays — Brunei's weekend — this shows 'No attendance required today.'
> - Her **class timetable** in a calendar view — today is highlighted, and a red time indicator line shows the current period.
> - **Grade entry** — she can select a course, view assessment items, and batch-enter scores from her phone.
> - **Announcements** from the school.
>
> The mobile app also supports **three languages** — English, Chinese, and Bahasa Melayu — switchable from the menu. Let me quickly show the language switch."

**[Demonstrate language switch on mobile]**

> "Same content, different language — instantly. All text goes through our internationalization framework."

---

## ACT 7: STAFF ATTENDANCE & ANOMALY DETECTION (3 min)

**[⟳ Switch to PC, login as `admin / Demo@2026`]**

**[Navigate to Attendance → Staff Dashboard]**

> "From the admin's perspective, here's today's staff attendance overview — who's checked in, who's late, who hasn't arrived yet.
>
> More importantly, the system detects anomalies automatically. Look at Mr. Ridwan — 6 late check-ins in the past 30 days. And Mr. Hassan — 3 consecutive unexplained absences. These patterns are flagged, and the principal receives automated alerts.
>
> This replaces the manual process of tracking lateness on paper and only discovering problems at the end of the month."

---

## ACT 8: EDUCATOR MANAGEMENT — PERFORMANCE, CPD & LEAVE (7 min)

**[⟳ Switch account: `hod01 / Demo@2026` — Dr. Azman Bin Ishak, Head of Department for Science & Mathematics]**

> "I'm now Dr. Azman, the HOD. The EMS — Educator Management System — gives him full visibility into his team."

### Performance Evaluations

**[Navigate to HOD Portal → Performance Evaluations]**

> "Performance evaluations follow a structured workflow. Let me show you how it works.
>
> The system separates active evaluations from completed history — so Dr. Azman always knows what needs his attention right now.
>
> Let me open an evaluation. The workflow has clear stages:
>
> 1. **HOD initiates** the evaluation — selects a teacher, kicks off the cycle.
> 2. **The teacher performs self-assessment** — they can score themselves across dimensions like Teaching Quality, Professional Development, and Conduct — and upload evidence documents to support their self-evaluation.
> 3. **The HOD reviews and scores** — compares their assessment with the teacher's self-assessment, enters final scores and comments.
> 4. **Principal approval** — the evaluation goes to the principal for final sign-off.
>
> At every stage, the current handler is visible — so everyone knows who the ball is with. All uploaded evidence documents can be previewed directly in the browser."

**[Show the workflow steps and self-assessment tab]**

> "And notice the performance history chart — it shows trend lines across academic years, indicating whether a teacher is improving, stable, or declining. This is data-driven staff development."

### CPD Workshops

**[Navigate to EMS → CPD Workshops]**

> "Continuing Professional Development is tracked per teacher against a 20-hour annual target."

**[Show the workshop list and teacher CPD progress]**

> "Each teacher's progress is visible — a bar chart showing target versus actual hours, broken down by category: Pedagogy, Subject Knowledge, Educational Technology, Leadership, Special Education.
>
> Dr. Azman can see which teachers in his department have met their target and who hasn't. He can also see which teachers are already enrolled in any workshop — no double-booking.
>
> When creating a new workshop, providers, subject areas, and locations are selectable from existing data. The workshop detail page shows sessions, enrolled teachers, and a resources tab where materials and attachments can be uploaded."

**[Click into a workshop detail page to show sessions and resources]**

### Leave Hub

**[Navigate to EMS → Leave Hub]**

> "Leave management is consolidated into a single page with three tabs:
>
> **Leave Applications** — all applications with their workflow status. Active requests are separated from completed history, and the current approver is always shown. The workflow goes: Teacher applies → HOD reviews → Principal gives final approval.
>
> The system calculates working days correctly — it knows Brunei's Friday-Saturday weekend and public holidays. Right now, Mohd Faizal is on an approved 5-day medical leave.
>
> When a teacher is on leave and a substitute is assigned, all concerned parties receive notifications — the substitute, the original teacher, and the admin.
>
> **Leave Calendar** — a visual calendar showing all approved leave across the department, essential for workforce planning.
>
> **Reports** — analytics on leave utilization rates, patterns, and balances."

### Retirement Planning

**[Navigate to EMS → Retirement Management]**

> "The system also tracks retirement eligibility. Dr. Siti has a voluntary early retirement application under review. The system calculates eligibility based on age and years of service, and flags upcoming retirements for succession planning."

---

## ACT 9: HEAD OF DEPARTMENT — OVERSIGHT & APPROVALS (3 min)

**[Still logged in as `hod01 / Demo@2026`]**

**[Navigate to HOD Dashboard]**

> "Dr. Azman's dashboard gives him a department-level view — teacher workload in a timetable format showing who teaches what and when. He can see leave status, CPD compliance, upcoming exams, and at-risk students — but only within his department. He doesn't see data from English or History — that's another HOD's domain."

**[Navigate to Approvals Inbox]**

> "The Approvals Inbox consolidates everything that needs his action — leave requests, self-service requests, performance evaluations. Each item shows its workflow type, who requested it, and the current status. He can approve or reject with remarks, and the next approver in the chain is automatically notified.
>
> This replaces paper forms circulating between offices."

---

## ACT 10: SCHOOL MANAGEMENT — TIMETABLE, CALENDAR & RESOURCES (5 min)

**[⟳ Switch account: `admin / Demo@2026`]**

**[Navigate to SMS → Timetable]**

> "The timetable module displays the weekly schedule — viewable by class, by teacher, or by room. The system validates every slot at creation time to prevent conflicts."

**[Navigate to SMS → Conflict Prevention]**

> "Here's the conflict prevention engine. If a teacher is somehow double-booked in two rooms at the same time, the system catches it instantly. It also suggests substitute teachers ranked by availability.
>
> This saves hours of manual cross-checking that administrators currently do with spreadsheets."

**[Navigate to SMS → School Calendar]**

> "The shared school calendar shows all events. Yesterday was School Open Day, today we have a Staff Briefing in Hall A. Upcoming: Sultan's Birthday holiday on June 15, ICT Examination on June 16, Year 9-10 Mock Exams on June 22, and Finals beginning July 6.
>
> Events are categorised, filterable, and linked to facility bookings."

**[Navigate to SMS → School Resources]**

> "Facility booking prevents double-booking and sends confirmation notifications. Staff can reserve halls, labs, sports fields."

**[Navigate to SMS → Exam Management]**

> "Exams are managed here — candidate lists, scheduling, venue assignment. Teachers can see exams relevant to their subjects."

**[Navigate to SMS → Library]**

> "We have a library management system — book catalogue with loan tracking, hold reservations, overdue alerts. Administrators can import new books in batch via Excel file."

**[Navigate to SMS → Inventory]**

> "Inventory tracking for school assets — when stock drops below a minimum quantity, the system fires an automatic notification. Right now, 5 items are below threshold."

---

## ACT 11: THE STUDENT EXPERIENCE (3 min)

**[⟳ Switch account: `student001 / Demo@2026` — Ahmad Bin Abdullah]**

> "Now let's see what Ahmad — our Year 9 student — sees when he logs in."

**[Student Dashboard]**

> "His portal is clean and focused:
>
> - **Courses** he's enrolled in with teacher names
> - **Grades** — every quiz, assignment, and exam score his teachers have recorded
> - **Assignments** — upcoming homework and projects with due dates
> - **Attendance** — his daily record
> - **Merit & Conduct** — behaviour points, both merits and demerits
> - **Report Card** — a printable academic transcript
> - **Announcements** — school news relevant to him
> - **CCA Activities** — co-curricular clubs he's a member of
>
> Everything is read-only — Ahmad can see his data but cannot modify anything. This promotes transparency and accountability."

> "Now let's see what happens when students like Ahmad start struggling — how does the school know, and who gets involved?"

---

## ACT 12: COUNSELOR — CASE MANAGEMENT & SPECIAL NEEDS (4 min)

**[⟳ Switch account: `farah / Demo@2026` — Ms. Farah, School Counselor]**

> "Ms. Farah is the school counselor. Here's her dedicated portal."

**[Counselor Dashboard]**

> "Her dashboard shows open cases with a status breakdown — a pie chart of Open, In Progress, and Resolved. She sees her active caseload with quick access to each student.
>
> Here's something powerful — one case was auto-created by the system. When Ahmad's academic standing declined to ACADEMIC_WATCH based on his grade calculations, the system automatically opened a counselor case tagged 'AUTO_STANDING_DECLINE.' No teacher had to file a referral.
>
> She can track case progress, log session notes, upload documents, and assign interventions to specific teachers or colleagues. The assignee receives a notification and can update the intervention progress, which flows back to the counselor. Every interaction is documented."

**[Navigate to Counselor → Case Management → open a case]**

> "Inside a case, she can manage resolution steps, assign interventions to specific people, and track the full history."

**[Navigate to Counselor → SEN / IEP]**

> "The Special Educational Needs module tracks students with Individual Education Plans. Ahmad has a Level 2 dyslexia IEP — with specific goals, accommodations, and intervention sessions. Hafiz has a Level 3 autism IEP. Session documents can be uploaded and previewed.
>
> This ensures no student with special needs falls through the cracks."

---

## ACT 13: RISK DETECTION — THE EARLY WARNING SYSTEM (4 min)

**[⟳ Switch account: `admin / Demo@2026`]**

**[Navigate to At-Risk Students page]**

> "Now let me show you how the school identifies students in trouble before it's too late.
>
> This is the At-Risk Dashboard. The system runs an algorithm that considers multiple factors: attendance rate, grade trends over 8 weeks, behavior records, and overdue fees. Each student gets a composite risk score from 0 to 100.
>
> Look at Ahmad Bin Abdullah — risk score 82%, categorised as HIGH RISK. The 8-week trend chart shows his attendance declining from around 80% down to about 60%. His grades show a declining trajectory.
>
> The system has automatically:
> 1. Flagged him as HIGH RISK
> 2. Updated his academic standing to ACADEMIC_WATCH based on his worst-course weighted average
> 3. Created a counselor case — which we just saw in Ms. Farah's portal
>
> The data is consistent across views — let me click into Ahmad's student detail."

**[Click on Ahmad → Student Detail page → Attendance tab]**

> "His attendance rate here matches exactly what the risk dashboard shows. Every number in this system comes from the same database — no duplication, no inconsistency.
>
> This is proactive intervention. Instead of discovering a problem at the end of term, leadership and counselors are alerted as patterns emerge."

---

## ACT 14: THE PRINCIPAL'S COMMAND CENTER — LIVE KPI DASHBOARD (5 min)

**[⟳ Switch account: `principal / Demo@2026` — Hjh Rashidah Binti Mohamad]**

> "Finally, let's see where it all comes together — the Principal's Command Center."

**[Navigate to Live KPI Center]**

> "This is what the principal sees every morning — a real-time dashboard where every number is live from the database. The system uses Server-Sent Events, so these figures update automatically without refreshing the page — see the green 'Live Updates' indicator.
>
> Let me walk through each KPI card:
>
> - **Total Enrolment: 3,456 students** — across all year levels.
> - **Pending Applications** — admissions waiting for review. This number went up when we submitted that application earlier.
> - **Attendance Rate** — today's figure with a breakdown: present, late, absent. If it drops below 85%, this card turns red as a critical alert.
> - **Active Staff** — teachers on duty today. Faizal isn't counted — he's on medical leave, and the system knows.
> - **CPD Compliance** — percentage of teachers who've met their 20-hour target.
> - **Students At Risk** — the flagged students we just looked at.
> - **Timetable Health** — 100% means no unresolved scheduling conflicts.
> - **Facility Utilization** — how well physical resources are being used.
> - **Outstanding Fee Invoices** — unpaid invoices. This number went down when Mrs. Siti made that online payment.
>
> Every card is clickable — it navigates directly to the relevant module. And the trend arrows show improvement or decline versus the previous period.
>
> Now let me show you one more thing."

**[Navigate to SMS → Auto Triggers]**

> "The system has 7 automatic notification triggers that run on schedule — student absenteeism alerts, grade drop alerts, fee overdue reminders, CPD deadline warnings, low stock alerts, certification expiry, and exam registration reminders. Each trigger is configurable, auditable, and fires real notifications to the right people. You can see the trigger log showing when each one last ran and how many notifications it generated.
>
> And for ad-hoc questions —"

**[Show the chatbot icon / floating button]**

> "— there's a built-in chatbot. Staff can ask questions about any data in the system — 'How many students are absent today?', 'What's Ahmad's attendance rate?', 'Which teachers haven't met their CPD target?' — and get instant answers drawn from the live database."

---

## ACT 15: MULTI-SCHOOL & SYSTEM ADMINISTRATION (3 min)

**[⟳ Switch account: `sysadmin / Demo@2026`]**

> "Before I close, let me show you that SERPS isn't limited to a single school."

**[Navigate to All Schools]**

> "The System Administrator can see all four schools: SMHK Secondary, SRPB Primary, SMAB Religious, and ISB International. Each school is completely data-isolated — a teacher at one school cannot see students from another."

**[⟳ Switch account: `admin / Demo@2026` → Navigate to Private Education → Oversight Dashboard]**

> "We also have a Private Education oversight module. The Department of Private Education can monitor all private schools from a centralised dashboard — send compliance circulars, track acknowledgement deadlines, and monitor performance metrics. Circulars can target all private schools, a specific district, or individual institutions."

**[Navigate to SMS → Management Reports]**

> "And for data-driven decision-making, 12 management report types cover enrolment trends, attendance analytics, grade distributions, staff utilisation, financial summaries, and more — all pulling live data, replacing the manual Excel compilation that currently takes weeks."

---

## CLOSING (2 min)

> "Let me summarise what you've seen today. We followed a complete journey — from a parent applying for admission, through the school's daily operations, all the way to the principal's real-time dashboard.
>
> SERPS covers:
>
> - **9 distinct user roles** with tailored portals — System Admin, Principal, HOD, Teacher, Counselor, Admissions Officer, Finance Officer, Student, and Parent
> - **All major school modules** — Admissions, Student Information, Grades, Attendance, Behaviour, Leave Management, CPD, Performance Evaluations, Timetabling, Facilities, Library, Inventory, Fees, Counseling, SEN/IEP, and more
> - **4 school types** — MOE Secondary, MOE Primary, MORA Religious, Private International — with complete data isolation
> - **Structured multi-level approval workflows** for leave, evaluations, self-service requests — with full audit trails
> - **Automated risk detection** that flags struggling students based on attendance and grade patterns
> - **Real-time notifications** via Server-Sent Events — no page refresh needed
> - **Online fee payment** with credit card, online banking, and bank transfer
> - **Trilingual support** — English, Chinese, and Bahasa Melayu — switchable instantly
> - **Mobile-optimised experience** for teachers — check-in, grade entry, messaging, all from their phone
> - **Public registration portal** — no login required
>
> The technology stack is production-ready: React, TypeScript, Node.js, Prisma ORM. Moving to production means swapping SQLite for PostgreSQL — a single configuration change.
>
> This POC demonstrates that a unified school management system is not only feasible for Brunei's education landscape — it's ready. Thank you."

---

## QUICK REFERENCE — Demo Accounts & Login Order

| Order | Role | Username | Password | Character | When to Login |
|-------|------|----------|----------|-----------|---------------|
| — | (Public) | *(no login)* | — | Any visitor | ACT 1: Registration portal |
| 1 | Admissions | `admissions` | `Demo@2026` | Admissions Officer | ACT 2: Process application |
| 2 | Teacher | `teacher01` | `Demo@2026` | Ms. Aminah (Form 7A, Math & Science) | ACT 3–4: Roll call, grades |
| 3 | Parent | `parent.siti` | `Demo@2026` | Mrs. Siti (mother of Ahmad + Hafiz) | ACT 5: Children, fees, comms |
| 4 | Teacher | `drsiti` | `Demo@2026` | Dr. Siti Nurhaliza (Physics) | ACT 6: Messages, mobile demo |
| 5 | Admin | `admin` | `Demo@2026` | School Administrator | ACT 7: Staff attendance |
| 6 | HOD | `hod01` | `Demo@2026` | Dr. Azman (Science & Maths HOD) | ACT 8–9: EMS, approvals |
| 7 | Student | `student001` | `Demo@2026` | Ahmad Bin Abdullah (Year 9) | ACT 11: Student portal |
| 8 | Counselor | `farah` | `Demo@2026` | Ms. Farah (School Counselor) | ACT 12: Cases, SEN |
| 9 | Admin | `admin` | `Demo@2026` | School Administrator | ACT 13: Risk dashboard |
| 10 | Principal | `principal` | `Demo@2026` | Hjh Rashidah (Principal) | ACT 14: Command center |
| 11 | Sysadmin | `sysadmin` | `Demo@2026` | System Administrator | ACT 15: Multi-school |

---

## TIMING SUMMARY

| Act | Topic | Login As | Duration | Cumulative |
|-----|-------|----------|----------|------------|
| Opening | Introduction | *(login page)* | 2 min | 2 min |
| Act 1 | Public Registration Portal | *(no login)* | 5 min | 7 min |
| Act 2 | Admissions Processing | `admissions` | 5 min | 12 min |
| Act 3 | Form Teacher — Roll Call | `teacher01` | 6 min | 18 min |
| Act 4 | Assignments & Grades | `teacher01` | 5 min | 23 min |
| Act 5 | Parent Portal | `parent.siti` | 6 min | 29 min |
| Act 6 | Teacher Messages & Mobile | `drsiti` + Mobile | 4 min | 33 min |
| Act 7 | Staff Attendance & Anomalies | `admin` | 3 min | 36 min |
| Act 8 | EMS — Performance, CPD, Leave | `hod01` | 7 min | 43 min |
| Act 9 | HOD Oversight & Approvals | `hod01` | 3 min | 46 min |
| Act 10 | School Management (SMS) | `admin` | 5 min | 51 min |
| Act 11 | Student Portal | `student001` | 3 min | 54 min |
| Act 12 | Counselor & SEN | `farah` | 4 min | 58 min |
| Act 13 | Risk Detection | `admin` | 4 min | 62 min |
| Act 14 | Principal's KPI Command Center | `principal` | 5 min | 67 min |
| Act 15 | Multi-School & Reports | `sysadmin` + `admin` | 3 min | 70 min |
| Closing | Summary | — | 2 min | 72 min |
| **Total** | | | | **~72 min** |

> **To fit in 55 minutes:** Trim Acts 7, 9, 10, and 15 to 1–2 min quick flashes each (saves ~10 min). Merge Act 4 into Act 3 (saves 3 min). That brings it to ~59 min.

---

## TIPS FOR THE PRESENTER

1. **Use two browser windows** — Window A for PC, Window B for Mobile (Chrome DevTools with iPhone 14 Pro emulation). Keep them side by side if screen space permits.
2. **Don't rush account switching.** Narrate it: *"Now I'm switching to the parent's perspective — Mrs. Siti."* The audience needs to follow who they're seeing.
3. **The storyline is the anchor.** Registration → Teacher daily life → Parent checks → Management oversight → Risk detection → KPI dashboard. Each act flows naturally into the next.
4. **The notification bell** is your best friend. Check it after any action that triggers one — leave approval, message sent, absence marked. It proves the system is alive.
5. **If a page loads slowly**, fill the silence: *"The system is querying live data from the database..."*
6. **Language switch** — demonstrate it once during the mobile demo (Act 6). It's quick and impressive.
7. **Ahmad is the narrative thread** — he appears in the teacher's class, in the parent's children view, in the student portal, in the counselor's caseload, and in the risk dashboard. Keep referring back to him.
8. **Payment demo** — the credit card payment in Act 5 is a crowd-pleaser. Take your time with it — show card number formatting, auto-detection, the processing animation, and the receipt.
9. **Evidence of fixes** — if anyone asks about edge cases (phone number validation, document upload, etc.), these have all been addressed. Demonstrate confidently.
10. **Close with the Command Center** — ending on the principal's KPI dashboard ties everything together. The numbers they see are the result of every action demonstrated throughout the session.
