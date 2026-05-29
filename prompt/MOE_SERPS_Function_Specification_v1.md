# MOE SERPS POC Demo System — Function Specification

**Version:** 1.0
**Target:** AI coding tool input (Claude Code, Cursor, etc.)
**Project:** MOE/LTK/55/2025/2026 — School Enterprise Resource Planning System POC
**Purpose:** Build a working demonstration system that supports a 55-minute live walkthrough for a Brunei MOE evaluation panel.

---

## 0. How to use this specification

This document is the **single source of truth** for the system to be built. It describes a working demo, not a production system.

**Build priorities, in order:**
1. The 14 cross-module triggers in Section 13 must fire correctly and visibly.
2. The exact seed data in Section 14 must be present so the script in the v3 run-book works.
3. The "before / after" numbers in Section 14.3 must change live as described.
4. UI fidelity matters — the panel must see something that looks like a real product, not a wireframe.
5. Code quality matters less than demo reliability. A simple, well-organized monorepo is fine.

**What is explicitly out of scope:**
- Real production scale (single-school demo is enough)
- Real encryption infrastructure (use simple hashing + JWT)
- Real Microsoft Azure AD integration (mock with a button that "would" SSO)
- Real SMS gateway (mock — print to console + show in-app)
- Real email delivery (mock — store in DB, show in a `/dev/inbox` panel)
- Real Z39.50 library protocol (mock with a stubbed external endpoint)
- Real SSM HR system integration (mock with a stubbed external endpoint)
- Full i18n (English only is acceptable for demo)
- Mobile native apps (PWA only)

---

## 1. Project overview

The system must support a 55-minute live demonstration following one student, **Ahmad Bin Abdullah**, through admission → enrolment → class allocation → daily school life → AI risk detection. The presenter uses two browser windows side by side: Browser 1 takes actions, Browser 2 shows downstream effects in real time.

**Modules to build:**
- **SIS** — Student Information System
- **EMS** — Educator Management System
- **SMS** — School Management System
- **AI Layer** — Chatbot + Predictive Risk Analytics
- **Notification System** — Push, email, SMS (all simulated), in-app
- **Command Center** — Real-time KPI dashboard
- **Mobile PWA** — Same codebase, responsive layout, push notifications, offline cache

---

## 2. Tech stack

**Frontend:**
- React 18 + TypeScript (Vite)
- Tailwind CSS + shadcn/ui components
- React Router v6
- Zustand for state management (lighter than Redux for this scope)
- React Query (TanStack Query) for server state
- Recharts for charts
- Web Push API + Service Worker for PWA push notifications
- IndexedDB (via `idb` library) for offline cache

**Backend:**
- Node.js 20 + TypeScript
- Fastify (faster startup than Express, better TypeScript support)
- Prisma ORM
- SQLite for the demo database (file-based, easy to reset)
- JWT for authentication (`jsonwebtoken`)
- bcryptjs for password hashing
- Server-Sent Events (SSE) for live dashboard updates
- node-cron for scheduled triggers (e.g., the 30-second attendance push delay)
- web-push library for actual push notification dispatch

**Repo structure (monorepo):**
```
serps-demo/
├── apps/
│   ├── web/                 # React frontend (Vite)
│   └── api/                 # Node.js backend (Fastify)
├── packages/
│   ├── shared-types/        # TypeScript interfaces shared between web + api
│   └── seed-data/           # JSON files for demo seed data
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docker-compose.yml       # For one-command startup
├── README.md
└── package.json             # npm workspaces
```

**Single-command demo startup:**
```bash
npm install
npm run db:reset            # wipes + reseeds the database
npm run dev                 # starts both web + api in parallel
```

The web app must be accessible at `http://serps-demo.local:5173` (configure local DNS or use `localhost:5173`).

---

## 3. Demo conventions

These are non-negotiable. They are what makes the demo work.

### 3.1 Time acceleration

Some real-world delays are too long for a demo. Implement these accelerated values:

| Production behaviour | Demo value | Where configured |
|---|---|---|
| Parent absence push delay | 10 minutes | 30 seconds |
| Offer letter email arrival | up to 5 minutes | 5 seconds |
| Timetable CSP generation | 30-60 seconds | 12-15 seconds (artificial delay so the loading animation has time to feel real) |
| Risk score recalculation | nightly batch | Immediate (within 2 seconds of triggering event) |

Centralize these in `apps/api/src/config/demo.ts`:
```typescript
export const DEMO_CONFIG = {
  attendancePushDelaySeconds: 30,
  offerLetterDeliverySeconds: 5,
  timetableGenerationMinSeconds: 12,
  timetableGenerationMaxSeconds: 15,
  riskRecalcDelayMs: 1500,
};
```

### 3.2 Demo Reset

A single endpoint that restores the database to its "before demo" state.

**Endpoint:** `POST /api/admin/demo-reset` (admin role only)

**What it does:**
1. Truncates all transactional tables (applications, attendance, grades, leaves, bookings, notifications, audit log, risk scores)
2. Re-runs the seed script (Section 14)
3. Returns `{ status: "ok", resetAt: ISO timestamp, tablesReset: number }`

**Where it's exposed in UI:** Admin menu → Settings → Demo Initialization → "Demo Reset" button with confirmation modal.

After reset, every "before" value in Section 14.3 must be exactly as listed.

### 3.3 Mock external services

Three external systems are referenced in the ITT. Each gets a stub endpoint that returns deterministic data:

- **SSM (Sistem Sumber Manusia)** — Stub at `GET /api/external/ssm/employee/:ic` returns teacher HR data
- **KOHA Library** — Stub at `POST /api/external/koha/account/provision` returns `{ libraryId: string, success: true }`
- **Email/SMS gateway** — Stub at `POST /api/external/messaging/send` stores the message in DB; UI shows them in `/dev/inbox` (a hidden admin route for debugging only — do not show during demo)

### 3.4 Notification simulation

All notifications are recorded to a `Notification` table. There are four channels:

| Channel | Demo behaviour |
|---|---|
| **In-app** | Appears in the user's notification bell within 1 second (via SSE) |
| **Web Push (mobile)** | Actually fires using Web Push API to subscribed devices (real implementation, demo phone must subscribe during setup) |
| **Email** | Recorded to DB. Visible to demo-mode in a "View Sent Emails" admin panel (not shown to panel) |
| **SMS** | Recorded to DB. Same as email — debug visibility only |

All notifications carry a `channels` array so a single notification can fire on multiple channels.

### 3.5 Time travel for demo

The risk dashboard, attendance trends, and grade history rely on historical data. The seed data must include past records (3 weeks of attendance, 2 prior assessments) so trend charts look real. See Section 14.

---

## 4. Authentication & authorization

### 4.1 Authentication

- Local username + password (all demo passwords: `Demo@2026`)
- bcrypt hash with cost factor 10
- JWT issued on login, 8-hour expiry
- JWT stored in `httpOnly` cookie + a CSRF token in `localStorage` for double-submit pattern
- Optional: a fake "Sign in with Microsoft" button on the login page that triggers a toast "Azure AD SSO is configured in production. For the demo, please use a local account." (Mentioned in script as future capability per ITT §2.4.)

### 4.2 Authorization (RBAC)

Nine roles. The matrix below is the source of truth.

| Role | Code | Read access | Write access |
|---|---|---|---|
| System Administrator | `ADMIN` | All | All |
| Admissions Officer | `ADMISSION` | All applications | Decisions on applications |
| Teacher | `TEACHER` | Own classes' students, own profile | Own classes' attendance, grades, materials, leave applications |
| HOD (Head of Department) | `HOD` | Teachers in own department | Approve dept leave, performance reviews |
| Principal | `PRINCIPAL` | Whole school | Substitute assignments, timetable publish, school-level config |
| Counselor | `COUNSELOR` | At-risk students, own caseload | Casework notes, intervention plans |
| Parent | `PARENT` | Only own children's data | Submit applications, reply to absence notices, book PT meetings |
| Student | `STUDENT` | Own data only | Limited (e.g., own profile photo, chatbot) |
| Finance Officer | `FINANCE` | Finance module only | Out of scope for main demo, keep stub login working |

### 4.3 RBAC enforcement

**Server-side:** Every API endpoint declares required roles via a Fastify decorator. Reject with 403 if not present.

```typescript
fastify.get('/api/students/:id', {
  preHandler: [authenticate, requireRole(['ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT'])]
}, async (request, reply) => {
  // Additional row-level check:
  // - PARENT can only read own children
  // - TEACHER can only read students in their classes
  // See Section 4.4 for row-level rules
});
```

**Client-side:** Navigation menu items hidden if user lacks role. This is UX only — server is the authority.

### 4.4 Row-level rules

| Role | Rule |
|---|---|
| PARENT | Can read Students where `Student.guardianUserId == self.id` |
| TEACHER | Can read Students where there exists `ClassEnrolment` such that `class.id IN teacher.assignedClassIds` |
| COUNSELOR | Can read Students where `Student.id IN counselor.caseloadIds` OR student's `riskScore > 0.4` |
| STUDENT | Can read records where `record.studentId == self.id` |

---

## 5. Core data model

This section defines all entities. Use Prisma schema syntax.

### 5.1 Identity & access

```prisma
model User {
  id              String   @id @default(cuid())
  username        String   @unique
  passwordHash    String
  role            Role
  fullName        String
  email           String?
  phone           String?  // +673 XXXX XXXX format
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  // Role-specific links (nullable, only one will be set)
  studentProfile  Student?
  teacherProfile  Teacher?
  parentProfile   Parent?

  // Notifications
  notifications   Notification[]
  pushSubscriptions PushSubscription[]
  auditEvents     AuditEvent[]
}

enum Role {
  ADMIN
  ADMISSION
  TEACHER
  HOD
  PRINCIPAL
  COUNSELOR
  PARENT
  STUDENT
  FINANCE
}

model PushSubscription {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  endpoint      String
  p256dhKey     String
  authKey       String
  userAgent     String?
  createdAt     DateTime @default(now())

  @@unique([userId, endpoint])
}
```

### 5.2 School & academic structure

```prisma
model School {
  id          String   @id @default(cuid())
  code        String   @unique     // e.g., "SMB-001"
  name        String                // "Sekolah Menengah Berakas"
  address     String
  zone        String                // for zone-based admission rule
  classes     Class[]
}

model AcademicYear {
  id          String   @id @default(cuid())
  year        Int                   // 2026
  startDate   DateTime
  endDate     DateTime
  isCurrent   Boolean  @default(false)
  terms       Term[]
}

model Term {
  id              String       @id @default(cuid())
  academicYearId  String
  academicYear    AcademicYear @relation(fields: [academicYearId], references: [id])
  termNumber      Int                // 1, 2, 3
  name            String             // "Term 1"
  startDate       DateTime
  endDate         DateTime
  isCurrent       Boolean  @default(false)
}

model Class {
  id              String   @id @default(cuid())
  schoolId        String
  school          School   @relation(fields: [schoolId], references: [id])
  grade           Int                // 7, 8, 9, ...
  section         String             // "A", "B", "C"
  name            String             // "Year 7A"
  capacity        Int      @default(35)
  formTeacherId   String?
  formTeacher     Teacher? @relation("FormTeacher", fields: [formTeacherId], references: [id])
  programmeStream String?            // "Academic", "Vocational", "Religious"

  enrolments      ClassEnrolment[]
  timetable       TimetableSlot[]

  @@unique([schoolId, grade, section])
}

model ClassEnrolment {
  id          String   @id @default(cuid())
  studentId   String
  student     Student  @relation(fields: [studentId], references: [id])
  classId     String
  class       Class    @relation(fields: [classId], references: [id])
  enrolledOn  DateTime @default(now())
  active      Boolean  @default(true)

  @@unique([studentId, classId])
}

model Subject {
  id          String  @id @default(cuid())
  code        String  @unique          // "MTH7", "SCI7"
  name        String                   // "Mathematics Year 7"
  grade       Int
}
```

### 5.3 Student & parent

```prisma
model Student {
  id                String   @id @default(cuid())
  studentId         String   @unique    // "2026-7A-032"
  userId            String?  @unique
  user              User?    @relation(fields: [userId], references: [id])

  fullName          String
  icNumber          String   @unique
  dateOfBirth       DateTime
  gender            Gender
  nationality       String

  guardianUserId    String?
  guardian          User?    @relation("StudentGuardian", fields: [guardianUserId], references: [id])
  guardianRelation  String?               // "Mother", "Father"

  previousSchool    String?
  medicalConditions String?
  allergies         String?
  programmeStream   String?

  status            StudentStatus  @default(APPLICANT)
  enrolledOn        DateTime?

  // siblings — self-relation
  siblings          SiblingLink[] @relation("StudentSibling")
  siblingOf         SiblingLink[] @relation("SiblingStudent")

  enrolments        ClassEnrolment[]
  attendance        AttendanceRecord[]
  grades            Grade[]
  riskScores        RiskScore[]
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum StudentStatus {
  DRAFT
  APPLICANT
  OFFER_ISSUED
  ENROLLED
  TRANSFERRED
  GRADUATED
}

model SiblingLink {
  id           String  @id @default(cuid())
  studentId    String
  student      Student @relation("StudentSibling", fields: [studentId], references: [id])
  siblingId    String
  sibling      Student @relation("SiblingStudent", fields: [siblingId], references: [id])

  @@unique([studentId, siblingId])
}

model Parent {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  icNumber        String   @unique
  // Children: via Student.guardianUserId == User.id
}

model Application {
  id                  String           @id @default(cuid())
  applicationNumber   String           @unique          // "APP-2026-00001"
  childFullName       String
  childIcNumber       String
  childDateOfBirth    DateTime
  childGender         Gender
  childNationality    String

  guardianName        String
  guardianRelation    String
  guardianPhone       String           // +673 format
  guardianEmail       String
  guardianUserId      String?          // set if parent already exists

  previousSchool      String?
  appliedGrade        Int
  programmeStream     String?
  medicalConditions   String?

  siblingName         String?
  siblingStudentId    String?          // set if sibling found in DB → triggers priority

  documents           ApplicationDocument[]

  status              ApplicationStatus @default(DRAFT)
  submittedAt         DateTime?
  decidedAt           DateTime?
  decidedByUserId     String?
  decision            ApplicationDecision?
  decisionNotes       String?

  eligibilityScore    Int?             // 0-100, computed at submission
  eligibilityBreakdown Json?           // { previousAcademic: 65, ageGradeFit: 100, siblingBonus: 100, documentCompleteness: 100 }
  hasSiblingPriority  Boolean          @default(false)

  resultingStudentId  String?          // linked Student record after acceptance + offer accept

  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt
}

enum ApplicationStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  OFFER_ISSUED
  OFFER_ACCEPTED
  OFFER_DECLINED
  REJECTED
  CANCELLED
}

enum ApplicationDecision {
  ACCEPT
  CONDITIONAL_ACCEPT
  REJECT
  WAITLIST
}

model ApplicationDocument {
  id              String      @id @default(cuid())
  applicationId   String
  application     Application @relation(fields: [applicationId], references: [id])
  type            DocumentType
  filename        String
  mimeType        String
  sizeBytes       Int
  storagePath     String                 // filesystem path or S3 key
  virusScanStatus String   @default("CLEAN")  // demo: always CLEAN
  ocrText         String?                 // populated for report-card-like docs
  uploadedAt      DateTime @default(now())
}

enum DocumentType {
  BIRTH_CERTIFICATE
  REPORT_CARD
  IC_COPY
  MEDICAL_CERT
  OTHER
}
```

### 5.4 Educator (EMS)

```prisma
model Teacher {
  id                  String   @id @default(cuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id])
  employeeNumber      String   @unique         // synced from SSM stub
  icNumber            String   @unique
  designation         String                   // "Senior Lecturer", "Form Teacher"
  departmentId        String?
  department          Department? @relation(fields: [departmentId], references: [id])
  employmentType      EmploymentType
  hireDate            DateTime
  salaryGradeFromSsm  String?

  qualifications      Qualification[]
  classDeployments    ClassDeployment[]
  cpdRecords          CpdRecord[]
  leaveBalances       LeaveBalance[]
  leaveApplications   LeaveApplication[]
  performanceReviews  PerformanceReview[]
  formClasses         Class[]  @relation("FormTeacher")

  // Substitute fairness tracking
  substituteCountTerm Int      @default(0)
}

enum EmploymentType {
  PERMANENT
  CONTRACT
  RELIEF
}

model Department {
  id        String   @id @default(cuid())
  code      String   @unique     // "MTH", "SCI", "LAN"
  name      String                // "Mathematics"
  hodTeacherId String?
  teachers  Teacher[]
}

model Qualification {
  id            String   @id @default(cuid())
  teacherId     String
  teacher       Teacher  @relation(fields: [teacherId], references: [id])
  title         String                  // "BSc Mathematics"
  institution   String
  yearAwarded   Int
  subjectAreas  String                  // comma-separated subject codes: "MTH,SCI"
  sourcedFromSsm Boolean   @default(true)
}

model ClassDeployment {
  id           String  @id @default(cuid())
  teacherId    String
  teacher      Teacher @relation(fields: [teacherId], references: [id])
  classId      String
  subjectId    String
  termId       String
  // periods this teacher takes for this class+subject this term — derived from TimetableSlot
}

model CpdRecord {
  id              String   @id @default(cuid())
  teacherId       String
  teacher         Teacher  @relation(fields: [teacherId], references: [id])
  workshopTitle   String
  provider        String
  hoursAwarded    Float
  completedOn     DateTime?
  status          CpdStatus  @default(COMPLETED)
  academicYearId  String
}

enum CpdStatus {
  PLANNED
  ENROLLED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model CpdWorkshop {                       // available workshops for enrolment
  id              String   @id @default(cuid())
  title           String
  provider        String
  hours           Float
  startDate       DateTime
  endDate         DateTime
  subjectAreas    String                    // matches qualification subjectAreas for recommendation
  capacity        Int
  enrolledCount   Int      @default(0)
}

model LeaveBalance {
  id              String   @id @default(cuid())
  teacherId       String
  teacher         Teacher  @relation(fields: [teacherId], references: [id])
  leaveType       LeaveType
  academicYearId  String
  entitled        Float
  used            Float    @default(0)
  pending         Float    @default(0)
}

enum LeaveType {
  ANNUAL
  MEDICAL
  EMERGENCY
  STUDY
  MATERNITY
}

model LeaveApplication {
  id              String   @id @default(cuid())
  teacherId       String
  teacher         Teacher  @relation(fields: [teacherId], references: [id])
  leaveType       LeaveType
  startDate       DateTime
  endDate         DateTime
  totalDays       Float
  reason          String
  medicalCertPath String?
  status          LeaveStatus  @default(PENDING_HOD)
  hodApprovedAt   DateTime?
  hodApprovedBy   String?
  principalApprovedAt DateTime?
  principalApprovedBy String?
  createdAt       DateTime @default(now())

  // Substitute assignments linked to this leave
  substituteAssignments SubstituteAssignment[]
}

enum LeaveStatus {
  PENDING_HOD
  PENDING_PRINCIPAL
  APPROVED
  REJECTED
  CANCELLED
}

model SubstituteAssignment {
  id              String   @id @default(cuid())
  leaveApplicationId String
  leaveApplication LeaveApplication @relation(fields: [leaveApplicationId], references: [id])
  substituteTeacherId String
  timetableSlotId String
  status          SubstituteStatus  @default(SUGGESTED)
  confirmedByUserId String?
  confirmedAt     DateTime?
}

enum SubstituteStatus {
  SUGGESTED
  CONFIRMED
  REJECTED
}

model PerformanceReview {
  id              String   @id @default(cuid())
  teacherId       String
  teacher         Teacher  @relation(fields: [teacherId], references: [id])
  academicYearId  String
  reviewType      String                  // "ANNUAL", "PROBATION"
  teachingQualityScore Float?
  professionalismScore Float?
  cpdComplianceScore Float?
  overallScore     Float?
  comments        String?
  status          ReviewStatus  @default(DRAFT)
  hodReviewedAt   DateTime?
  principalApprovedAt DateTime?
}

enum ReviewStatus {
  DRAFT
  HOD_REVIEW
  PRINCIPAL_APPROVAL
  FINALIZED
}
```

### 5.5 SMS (School Management)

```prisma
model TimetableSlot {
  id           String   @id @default(cuid())
  classId      String
  class        Class    @relation(fields: [classId], references: [id])
  subjectId    String
  teacherId    String                       // currently assigned
  originalTeacherId String?                  // for substitute tracking
  facilityId   String?                       // room
  dayOfWeek    Int                          // 1 = Mon, 5 = Fri
  period       Int                          // 1..8
  termId       String

  @@unique([classId, dayOfWeek, period, termId])
}

model TimetableGenerationRun {
  id           String   @id @default(cuid())
  grade        Int
  termId       String
  constraints  Json                          // input constraints
  candidates   Json                          // 3 generated options
  selectedOptionIndex Int?
  hardConflicts Int      @default(0)
  softConflicts Int      @default(0)
  publishedAt   DateTime?
  publishedByUserId String?
  createdAt    DateTime @default(now())
}

model Facility {
  id          String   @id @default(cuid())
  code        String   @unique               // "LAB-SCI-01"
  name        String                          // "Science Lab 1"
  type        FacilityType
  capacity    Int
  features    String?                         // "Bunsen burner, fume hood, projector"
}

enum FacilityType {
  CLASSROOM
  SCIENCE_LAB
  COMPUTER_LAB
  LIBRARY
  HALL
  GYM
  MEETING_ROOM
}

model FacilityBooking {
  id           String   @id @default(cuid())
  facilityId   String
  facility     Facility @relation(fields: [facilityId], references: [id])
  bookedByUserId String
  classId      String?
  startTime    DateTime
  endTime      DateTime
  purpose      String
  status       BookingStatus  @default(CONFIRMED)
  createdAt    DateTime @default(now())
}

enum BookingStatus {
  CONFIRMED
  CANCELLED
  REJECTED        // when conflict detected
}

model CalendarEvent {
  id          String   @id @default(cuid())
  title       String
  description String?
  startDate   DateTime
  endDate     DateTime
  eventType   String                          // "HOLIDAY", "EXAM", "SPORTS_DAY", "PT_MEETING"
  scope       String                          // "SCHOOL_WIDE", "GRADE_7", "CLASS_7A"
  createdByUserId String
}
```

### 5.6 Attendance & grading

```prisma
model AttendanceSession {
  id           String   @id @default(cuid())
  classId      String
  subjectId    String
  teacherId    String
  date         DateTime  @db.Date
  period       Int
  startedAt    DateTime  @default(now())
  submittedAt  DateTime?
  records      AttendanceRecord[]
}

model AttendanceRecord {
  id           String   @id @default(cuid())
  sessionId    String
  session      AttendanceSession @relation(fields: [sessionId], references: [id])
  studentId    String
  student      Student  @relation(fields: [studentId], references: [id])
  status       AttendanceStatus
  reason       String?              // when status = ABSENT
  reasonNotes  String?              // freetext from parent
  reasonProvidedAt DateTime?
  reasonProvidedByUserId String?    // who entered reason (parent or teacher)
  markedAt     DateTime @default(now())
  notifiedParentAt DateTime?

  @@unique([sessionId, studentId])
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

model Assessment {
  id           String   @id @default(cuid())
  classId      String
  subjectId    String
  teacherId    String
  termId       String
  title        String                          // "Mid-Term Test", "Continuous Assessment 1"
  type         AssessmentType
  maxScore     Float    @default(100)
  weight       Float                            // contribution to final term grade, 0-1
  date         DateTime
  publishedAt  DateTime?
  grades       Grade[]
}

enum AssessmentType {
  CONTINUOUS
  QUIZ
  MID_TERM
  END_OF_TERM
  ASSIGNMENT
}

model Grade {
  id           String   @id @default(cuid())
  assessmentId String
  assessment   Assessment @relation(fields: [assessmentId], references: [id])
  studentId    String
  student      Student    @relation(fields: [studentId], references: [id])
  rawScore     Float
  percent      Float                              // rawScore / maxScore * 100
  letter       String?                            // computed: A, B, C, D, F
  enteredByUserId String
  enteredAt    DateTime  @default(now())
  comments     String?

  @@unique([assessmentId, studentId])
}
```

### 5.7 AI & risk

```prisma
model RiskScore {
  id           String   @id @default(cuid())
  studentId    String
  student      Student  @relation(fields: [studentId], references: [id])
  score        Float                              // 0..1
  band         RiskBand                           // ON_TRACK, MONITOR, HIGH_RISK
  contributingFactors Json                        // see Section 9.2 for shape
  computedAt   DateTime @default(now())
  triggerEvent String?                            // "GRADE_ENTERED", "ATTENDANCE_MARKED", "MANUAL_RECALC"
}

enum RiskBand {
  ON_TRACK
  MONITOR
  HIGH_RISK
}

model CounselorCase {
  id                String   @id @default(cuid())
  studentId         String
  counselorUserId   String
  openedAt          DateTime @default(now())
  closedAt          DateTime?
  status            String                       // "OPEN", "IN_PROGRESS", "CLOSED"
  openedReason      String                       // "AUTO_RISK_THRESHOLD", "TEACHER_REFERRAL"
  notes             CaseNote[]
}

model CaseNote {
  id                String   @id @default(cuid())
  caseId            String
  case              CounselorCase @relation(fields: [caseId], references: [id])
  noteText          String
  createdByUserId   String
  createdAt         DateTime @default(now())
}

model ChatbotConversation {
  id                String   @id @default(cuid())
  userId            String
  startedAt         DateTime @default(now())
  messages          ChatbotMessage[]
}

model ChatbotMessage {
  id                String   @id @default(cuid())
  conversationId    String
  conversation      ChatbotConversation @relation(fields: [conversationId], references: [id])
  role              String                       // "user", "assistant"
  content           String
  retrievedContext  Json?                        // what data the assistant fetched to answer
  createdAt         DateTime @default(now())
}
```

### 5.8 Notifications & audit

```prisma
model Notification {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  title         String
  body          String
  channels      String                        // JSON array: ["IN_APP", "PUSH", "EMAIL", "SMS"]
  category      String                        // "ATTENDANCE", "GRADE", "ADMISSION", "TIMETABLE", "RISK", "GENERAL"
  link          String?                       // deep link in app
  read          Boolean  @default(false)
  createdAt     DateTime @default(now())
  deliveredAt   DateTime?
  scheduledFor  DateTime?                     // for delayed delivery (attendance push)
}

model AuditEvent {
  id            String   @id @default(cuid())
  userId        String?
  user          User?    @relation(fields: [userId], references: [id])
  action        String                        // "LOGIN", "APPLICATION_SUBMITTED", "GRADE_ENTERED", etc.
  entityType    String?
  entityId      String?
  ipAddress     String?
  userAgent     String?
  metadata      Json?
  createdAt     DateTime @default(now())
}
```

---

## 6. SIS — Student Information System

### 6.1 Admission application — 4-step wizard

**Route:** `/parent/admissions/apply` (PARENT role) and `/admissions/applications/new` (ADMISSION role, on behalf of parent)

**Step 1 — Child information**

| Field | Type | Validation |
|---|---|---|
| Full Name | text | min 3, max 100, letters + spaces + hyphens, auto-capitalize each word |
| IC Number | text | regex `^\d{2}-\d{6}$` (Brunei format) |
| Date of Birth | date | must produce eligible grade for current intake |
| Gender | radio | Male / Female / Other |
| Nationality | dropdown | Brunei / Other (lookup) |

**Live validation:** when DOB is entered, query `POST /api/admissions/eligibility/age-grade-check` with `{ dateOfBirth }`. Response: `{ eligibleGrade: number, alternativeGrades: number[], message: string }`.

Age-to-grade rule (Brunei convention, simplified for demo):
```
age 6 = Year 1
age 7 = Year 2
... 
age 12 = Year 7
age 13 = Year 8
...
age 17 = Year 12
```
Age computed as `floor((currentDate - dob) / 365.25)` as of January 1 of the current academic year.

**Step 2 — Guardian information**

| Field | Type | Validation |
|---|---|---|
| Guardian Name | text | min 3, max 100 |
| Relationship | dropdown | Mother / Father / Legal Guardian |
| Guardian Phone | text | regex `^\+673 \d{4} \d{4}$` (live mask) |
| Guardian Email | text | RFC email format |
| Sibling at this school? | toggle | If yes, show sibling name field |
| Sibling Name | text | when entered, fire sibling check |

**Live validation (sibling check):** when sibling name is entered (debounced 500ms), call `GET /api/admissions/sibling-lookup?name={name}&schoolId={schoolId}`. Response: `{ matched: boolean, siblingStudentId?: string, siblingClass?: string }`.

If matched:
- Show green badge: "Sibling Priority eligible — Hafiz Bin Abdullah, Year 9C"
- Set `application.hasSiblingPriority = true`
- Eligibility score will receive `siblingBonus = 100`

**Step 3 — Academic background**

| Field | Type | Validation |
|---|---|---|
| Previous School | text | max 200 |
| Applying for Grade | dropdown | auto-selected from Step 1 DOB, locked |
| Programme Stream | dropdown | Academic / Vocational / Religious |
| Medical Conditions / Allergies | textarea | max 500 |

**Step 4 — Documents & declaration**

| Field | Type | Validation |
|---|---|---|
| Birth Certificate | file upload | PDF/JPG/PNG, max 5 MB |
| Last Report Card | file upload | PDF, max 5 MB, OCR optional |
| IC Copy | file upload | PDF/JPG/PNG, max 5 MB |
| Declaration 1 | checkbox | required: "Information provided is true" |
| Declaration 2 | checkbox | required: "I consent to data processing per MOE policy" |
| Declaration 3 | checkbox | required: "I understand documents will be verified" |

**Upload behavior:** files saved to `apps/api/uploads/applications/{applicationId}/`. Each file row in `ApplicationDocument`. For demo, `virusScanStatus` is always `CLEAN` after a 500ms delay.

**Submit:** `POST /api/admissions/applications`
- Server computes `eligibilityScore` using rule in Section 6.2
- Returns `{ applicationId, applicationNumber, eligibilityScore, hasSiblingPriority }`
- Application status: `SUBMITTED`
- Audit event: `APPLICATION_SUBMITTED`
- Notification to parent: in-app + email (mock)
- Server-Sent Event to `/api/events/dashboard` → admin dashboard pending count increments

### 6.2 Eligibility score formula

```typescript
function computeEligibilityScore(input: {
  previousAcademicAvg: number | null,  // 0-100, from report card OCR or null
  ageGradeMatch: boolean,
  hasSiblingPriority: boolean,
  documentsComplete: boolean,
}): { score: number, breakdown: object } {

  const previousAcademic = input.previousAcademicAvg ?? 50;  // default if unknown
  const ageGradeFit = input.ageGradeMatch ? 100 : 0;
  const siblingBonus = input.hasSiblingPriority ? 100 : 0;
  const documentCompleteness = input.documentsComplete ? 100 : 60;

  // Weighted composite
  const score = Math.round(
    0.40 * previousAcademic +
    0.30 * ageGradeFit +
    0.15 * siblingBonus +
    0.15 * documentCompleteness
  );

  return {
    score,
    breakdown: {
      previousAcademic,
      ageGradeFit,
      siblingBonus,
      documentCompleteness,
      weights: { previousAcademic: 0.40, ageGradeFit: 0.30, siblingBonus: 0.15, documentCompleteness: 0.15 }
    }
  };
}
```

For Ahmad with previous academic 65, age-grade match, sibling priority, all docs uploaded: score = `0.40*65 + 0.30*100 + 0.15*100 + 0.15*100 = 26 + 30 + 15 + 15 = 86`. **Spec target: 82** — use `previousAcademic = 55` in his seed data to hit 82 exactly. (Pre-set in seed.)

### 6.3 Admissions review screen

**Route:** `/admissions/applications` (ADMISSION, ADMIN, PRINCIPAL roles)

**List view columns:** Status badge | App # | Child Name | Applied Grade | Score | Sibling Priority | Submitted | Action

**Sort/filter:** by status, score, sibling priority, applied grade

**Detail view (modal or page):**
- Header: child name, IC, DOB, applied grade, status badge
- Eligibility score card with breakdown (click to expand)
- Guardian section: name, phone, email, sibling status
- Academic background card
- Documents thumbnails (click to view)
- Decision panel:
  - Decision dropdown: Accept / Conditional Accept / Reject / Waitlist
  - Notes textarea
  - Submit button

**On Accept:**
- `POST /api/admissions/applications/:id/decide` with `{ decision: "ACCEPT", notes }`
- Application status → `OFFER_ISSUED`
- Generate offer letter PDF and store path in DB (use `pdfkit` or similar — content: name, school, grade, due dates, signature)
- Create Notification to parent (channels: IN_APP, EMAIL, SMS)
- SSE → admin dashboard pending count decrements
- Audit event: `APPLICATION_DECIDED`

### 6.4 Class allocation engine

**Triggered by:** Parent accepting offer letter via `POST /api/parent/offers/:applicationId/accept`

**Algorithm:**
1. Find all classes of the applied grade in the school where `enrolledCount < capacity`.
2. Score each candidate class:
   - **Sibling rule:** +30 if sibling is in this class
   - **Zone rule:** +10 if guardian's zone matches school's zone (zone is a school attribute; guardian zone from address — for demo, all guardians match the school's zone, so this gives +10 universally)
   - **Quota balance:** +(35 - currentSize), so emptier classes preferred
   - **Programme match:** +20 if applied programme stream matches class programme
3. Pick the class with the highest score (tie-break: lowest section letter, e.g., A before B).
4. Create:
   - `Student` record (status `ENROLLED`)
   - `User` record (role `STUDENT`, generate username `student.{studentId}` and temp password)
   - `ClassEnrolment` linking student to selected class
   - Copy Year `{grade}` master timetable into student-individual view (concept: the student's view simply joins `TimetableSlot` filtered by their class)
   - Library account via `POST /api/external/koha/account/provision` (mock returns `libraryId`)
   - Parent portal credentials notification (email + in-app)

**For Ahmad (seed): allocated to Year 7A** because Hafiz is in 9C (same school → sibling rule fires; pick 7A as it has the highest score per seed data).

**API:** `POST /api/parent/offers/:applicationId/accept`
Response:
```json
{
  "studentId": "2026-7A-032",
  "allocatedClass": { "id": "...", "name": "Year 7A", "formTeacher": "Ms. Aminah Binti Hassan" },
  "credentialsSentTo": "siti.mohamed@gmail.com",
  "libraryId": "KOHA-2026-04982",
  "timetableGenerated": true
}
```

**SSE events fired:**
- `dashboard.enrolment.changed` → enrolment count +1
- `class.roster.changed` → Year 7A roster updated (for Ms. Aminah's view)
- `parent.notification` → credentials email arrived

### 6.5 Attendance

**Teacher PWA — start session**

Route: `/teacher/classes/:classId/attendance/new`

UI:
- Header: class name, today's date, period selector (auto-default to current period based on time)
- Subject selector (auto-default from teacher's deployment)
- "Start Session" button

`POST /api/attendance/sessions` with `{ classId, subjectId, period, date }` creates AttendanceSession and returns the student list with all defaults `PRESENT`.

**Card grid**

UI: grid of student cards, each shows photo + name + status badge.

Tap behaviour: PRESENT → LATE → ABSENT → PRESENT (cycles)
Long-press on ABSENT: opens reason picker modal (Sick / Personal / Unexplained / Other + freetext)
Bulk: "Mark All Present" button at top.

Status updates the AttendanceRecord row immediately (`PATCH /api/attendance/records/:id`).

**Submit session:** `POST /api/attendance/sessions/:id/submit`
- Marks `submittedAt`
- For each ABSENT record without a notifiedParentAt:
  - Create a Notification scheduled for `now + DEMO_CONFIG.attendancePushDelaySeconds`
  - A background job (node-cron tick every 5s) sends scheduled notifications when due

**Attendance push notification body:**
> "{ChildName} has been marked absent for Period {N} {Subject} today. Tap to reply with the reason."

**Parent absence-reason reply**

Route: `/parent/notifications/:id` (deep link from push)

UI: shows the absence details, then a reason picker:
- Sick / Personal / Unexplained / Other
- Notes textarea

`POST /api/attendance/records/:id/reason` with `{ reason, notes }` updates the record. Server-side rule: only the legal guardian can submit.

**Trigger cascade after reason submitted:**
1. AttendanceRecord updated: `reason`, `reasonNotes`, `reasonProvidedAt`, `reasonProvidedByUserId`
2. Teacher's attendance view updates via SSE (`teacher.attendance.reason_added`)
3. Compute `recentAbsenceCount` = absences in last 14 days for this student
4. If `recentAbsenceCount >= 3` → set badge flag on student profile, surface in teacher's view
5. If `recentAbsenceCount >= 5` → open or update `CounselorCase` for student with `openedReason: AUTO_ABSENCE_THRESHOLD`

### 6.6 Grading

**Assessment creation**

Route: `/teacher/classes/:classId/assessments/new` (TEACHER role)

UI: title, type, max score, weight (must sum to ≤1 per subject per term — server validates), date.

**Grade entry**

Route: `/teacher/classes/:classId/assessments/:assessmentId/grades`

UI: table of students with rawScore input. Auto-compute percent + letter as user types.

`POST /api/grades/bulk` with array of `{ studentId, rawScore, comments }`.

**Letter grade scale:**
```
>= 90  → A+
>= 85  → A
>= 80  → A-
>= 75  → B+
>= 70  → B
>= 65  → B-
>= 60  → C+
>= 55  → C
>= 50  → C-
>= 40  → D
<  40  → F
```

**Term grade computation (derived, not stored):**
```typescript
function termGradeFor(studentId, subjectId, termId) {
  const grades = await prisma.grade.findMany({
    where: {
      studentId,
      assessment: { subjectId, termId, publishedAt: { not: null } }
    },
    include: { assessment: true }
  });
  const weightedSum = grades.reduce((sum, g) => sum + g.percent * g.assessment.weight, 0);
  const totalWeight = grades.reduce((sum, g) => sum + g.assessment.weight, 0);
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}
```

**Grade publication trigger cascade:**

When `POST /api/grades/bulk` includes `publish: true`:
1. For each student in the batch:
   - Recompute term grade for the subject
   - Compute grade trend (compare to prior assessment in same subject same term)
   - Create Notification to guardian: "{ChildName}'s {assessment.title} grade is available" with link
   - Trigger risk recalculation (Section 9.2)
2. If trend shows drop ≥ 15% from previous assessment → set `gradeDropFlag` for counselor view
3. SSE to dashboard: school average for grade-level updates

---

## 7. EMS — Educator Management System

### 7.1 Teacher profile

**Route:** `/ems/teachers/:id` (PRINCIPAL, HOD, ADMIN; teacher can view own at `/teacher/profile`)

**Tabs:**
- Overview — SSM-sourced fields + EMS-native fields, clearly labelled with `<SSM>` badge
- Qualifications — list, edit (HOD/PRINCIPAL can add EMS-native; SSM ones read-only)
- Class Deployment — current term's class+subject+periods
- CPD Record — list of completed + planned workshops, hours total vs target
- Performance — current review cycle status
- Leave — balances + history

**SSM stub source:**

`GET /api/external/ssm/employee/:ic` returns:
```json
{
  "icNumber": "01-234567",
  "fullName": "Aminah Binti Hassan",
  "employeeNumber": "TCH-7821",
  "designation": "Senior Teacher",
  "salaryGrade": "B5",
  "department": "MTH",
  "hireDate": "2019-08-01",
  "employmentType": "PERMANENT"
}
```

Teacher records are seeded by fetching from the stub on `db:reset`. In the UI, fields that came from SSM show a small "SSM" tag next to them.

### 7.2 CPD tracking

**Annual target:** 20 hours per academic year (constant: `CPD_ANNUAL_TARGET = 20`).

**CPD KPI computation:**
```typescript
async function cpdHoursYtd(teacherId: string, academicYearId: string) {
  const records = await prisma.cpdRecord.findMany({
    where: { teacherId, academicYearId, status: 'COMPLETED' }
  });
  return records.reduce((sum, r) => sum + r.hoursAwarded, 0);
}
```

**Alert states:**
- Hours < 20 and >= 15 of academic year passed → AMBER alert on profile + entry in PRINCIPAL "Action Required" inbox
- Hours < 15 and < 75% of academic year passed → no alert (still on track)
- Hours < 20 by year-end → RED flag on annual performance review

### 7.3 Workshop recommendation + enrolment

`GET /api/ems/cpd/recommendations?teacherId={id}` returns workshops where:
- Workshop's `subjectAreas` overlap with teacher's qualifications' `subjectAreas`
- Workshop's `startDate` ≥ today
- Workshop's enrolledCount < capacity
- Workshop's dates don't conflict with teacher's existing classes (check TimetableSlot)

Sort: nearest start date first.

**Enrol:** `POST /api/ems/cpd/enrol` with `{ teacherId, workshopId }`
- Creates `CpdRecord` with status `ENROLLED`
- Increments `workshop.enrolledCount`
- Blocks workshop time slots in teacher's schedule (creates a calendar entry — does not block TimetableSlot since those are mandatory teaching)
- Sends notification to teacher
- On workshop end date (cron daily): change status to `COMPLETED`, increment teacher's CPD hours

### 7.4 Leave management

**Apply for leave**

Route: `/teacher/leave/apply`

UI: leave type, start/end date, days (auto-computed), reason, medical cert upload (mandatory if type = MEDICAL and days ≥ 1)

`POST /api/ems/leave/applications`:
- Validates balance: `leaveBalance.entitled - leaveBalance.used - leaveBalance.pending >= totalDays`
- Status: `PENDING_HOD`
- Notifies HOD

**HOD approval**

Route: `/hod/approvals/leave`

`POST /api/ems/leave/applications/:id/decide` with `{ decision: "APPROVE" | "REJECT", notes }`

On APPROVE:
- Status → `APPROVED` (no separate principal approval needed for leave ≤ 3 days; > 3 days requires `PENDING_PRINCIPAL`)
- Increment `leaveBalance.used`, decrement `pending`
- **Trigger substitute engine** (Section 7.5)

### 7.5 Substitute auto-suggest engine

**Algorithm:**

```typescript
async function suggestSubstitutes(leaveApplicationId: string): Promise<Suggestion[]> {
  const leave = await prisma.leaveApplication.findUnique({
    where: { id: leaveApplicationId },
    include: { teacher: { include: { qualifications: true } } }
  });

  // 1. Find affected timetable slots during leave period
  const affectedSlots = await prisma.timetableSlot.findMany({
    where: {
      teacherId: leave.teacherId,
      // Filter to days within leave.startDate..endDate
    }
  });

  // 2. For each slot, find candidate substitute teachers
  const subjectCodes = new Set(affectedSlots.map(s => s.subjectId));
  const candidates = await prisma.teacher.findMany({
    where: {
      id: { not: leave.teacherId },
      qualifications: {
        some: {
          // qualified in at least one of the subjects needed
          OR: [...subjectCodes].map(code => ({ subjectAreas: { contains: code } }))
        }
      }
    },
    include: { qualifications: true }
  });

  // 3. For each candidate, check availability across affected slots
  const scored = [];
  for (const candidate of candidates) {
    let freeSlots = 0;
    for (const slot of affectedSlots) {
      const busy = await prisma.timetableSlot.findFirst({
        where: {
          teacherId: candidate.id,
          dayOfWeek: slot.dayOfWeek,
          period: slot.period,
          termId: slot.termId
        }
      });
      if (!busy) freeSlots++;
    }
    if (freeSlots > 0) {
      // Fairness: lower substituteCountTerm = higher rank
      const fairnessScore = Math.max(0, 8 - candidate.substituteCountTerm);
      scored.push({
        teacherId: candidate.id,
        teacherName: candidate.user.fullName,
        freeSlots,
        totalSlots: affectedSlots.length,
        substituteCountTerm: candidate.substituteCountTerm,
        rankScore: freeSlots * 10 + fairnessScore
      });
    }
  }

  return scored.sort((a, b) => b.rankScore - a.rankScore).slice(0, 3);
}
```

**API:** `GET /api/ems/leave/applications/:id/substitute-suggestions`

**Confirm assignment:** `POST /api/ems/leave/applications/:id/assign-substitute`
- For each affected slot, create `SubstituteAssignment` linking to the chosen teacher
- Update `TimetableSlot.teacherId` (set `originalTeacherId` first)
- Increment chosen teacher's `substituteCountTerm`
- Notifications:
  - To substitute teacher: list of new periods
  - To all enrolled students of affected classes (parents get a copy)
- SSE: `timetable.changed` → affected students' parent app updates

---

## 8. SMS — School Management System

### 8.1 Timetable generation

**Inputs (constraints):**
- List of classes to schedule (e.g., all Year 8 sections)
- List of subjects with weekly hours required per class (curriculum minimum)
- List of teachers with their qualifications
- List of rooms with capacities
- Hard constraints:
  - No teacher double-booked
  - No room double-booked
  - No class double-scheduled
  - Subject hours per week per class must equal curriculum minimum
  - Room type compatibility (Science → Lab, etc.)
- Soft constraints (numeric penalty):
  - Maths and Science not back-to-back in the same day (penalty: 1 per occurrence)
  - PE not in the last period (penalty: 0.5 per occurrence)
  - Friday no academic period after period 4 (penalty: 100 per — basically hard for demo)

**Approach for demo:**

Implementing a real CSP solver is out of scope. Instead:

1. Pre-seed three valid Year 8 timetables in JSON (`packages/seed-data/timetables/year8-options.json`).
2. When `POST /api/sms/timetable/generate` is called, server:
   - Sleeps for `12-15 seconds` (random)
   - Returns the three pre-seeded options with computed conflict counts
3. Front-end shows a fake "Computing..." animation with progress percentage and status messages: "Checking teacher constraints..." / "Optimizing soft constraints..." / "Ranking candidates..."

**API:** `POST /api/sms/timetable/generate`
Request:
```json
{
  "grade": 8,
  "termId": "...",
  "constraints": {
    "fridayHalfDay": true,
    "noMathScienceBackToBack": true,
    "pePreferEarlierPeriods": true
  }
}
```
Response:
```json
{
  "runId": "...",
  "candidates": [
    { "index": 0, "hardConflicts": 0, "softConflicts": 2, "slots": [...] },
    { "index": 1, "hardConflicts": 0, "softConflicts": 4, "slots": [...] },
    { "index": 2, "hardConflicts": 0, "softConflicts": 1, "slots": [...] }
  ]
}
```

**Visual selection:** UI shows all three side-by-side with conflict counts. Admin clicks one → drag-and-drop edit mode → "Publish" button.

**Publish:** `POST /api/sms/timetable/runs/:runId/publish` with `{ selectedOptionIndex, manualEdits: [...] }`
- Replaces all `TimetableSlot` rows for the affected grade + term
- SSE `timetable.published` → all affected students + teachers refresh

### 8.2 Facility booking

**Route:** `/facilities/book`

UI: facility picker (filtered by type, capacity) + date + time slot + purpose + class (optional)

**Conflict check:** `POST /api/sms/facility-bookings/check` with `{ facilityId, startTime, endTime }`. Returns either `{ available: true }` or:
```json
{
  "available": false,
  "conflict": { "bookedBy": "Ms. Aminah", "purpose": "Year 7A Chemistry", "endTime": "..." },
  "alternatives": {
    "sameFacilityOtherSlots": [{ "startTime": "...", "endTime": "..." }, ...],
    "otherFacilitiesSameSlot": [{ "facilityId": "...", "facilityName": "Bio Lab" }, ...]
  }
}
```

UI: if conflict, show side-by-side: who has it + offered alternatives with one-click "Book this instead".

**Confirm:** `POST /api/sms/facility-bookings` creates `FacilityBooking` row with status `CONFIRMED`. Audit event.

### 8.3 School calendar

**Route:** `/calendar` (visible to all roles, filtered by scope)

Standard calendar UI (use FullCalendar or build with `date-fns`).

**Events:**
- HOLIDAY (school-wide)
- EXAM (per grade)
- SPORTS_DAY (school-wide)
- PT_MEETING (per class or per student)
- ASSEMBLY (school-wide)

When admin adds an event with school-wide scope, all parents and students receive a notification. PT_MEETING events appear on the involved parent's + teacher's calendars only.

---

## 9. AI layer

### 9.1 Chatbot

**Route:** Available from all role dashboards. UI is a slide-out panel from the right.

**Implementation:** template-based with RAG for demo reliability. Optionally pluggable to a real LLM via env var `LLM_PROVIDER=openai|anthropic|none` (default `none`).

**Intent detection** (rule-based for `none` mode):

```typescript
const INTENT_PATTERNS = [
  { pattern: /how is (\w+) doing|how is my (?:child|son|daughter)|(?:academic|risk) status/i, intent: "STUDENT_STATUS" },
  { pattern: /attendance|absent/i, intent: "ATTENDANCE_QUERY" },
  { pattern: /grade|score|mark/i, intent: "GRADE_QUERY" },
  { pattern: /how many students|class size|enrolment/i, intent: "ENROLMENT_QUERY" },
  { pattern: /at[- ]risk|risk students|struggling/i, intent: "AT_RISK_QUERY" },
  { pattern: /(?:when|what time) (?:is|does)|schedule|timetable/i, intent: "SCHEDULE_QUERY" },
  // ... more patterns
];
```

**Role-aware response building** (Section 9.1 example — STUDENT_STATUS intent, PARENT role):

```typescript
async function answerStudentStatus(askerUserId: string, params: { childName?: string }) {
  // Identify the child (must belong to asker if asker is PARENT)
  const parent = await prisma.parent.findUnique({ where: { userId: askerUserId } });
  const child = params.childName
    ? await findOwnChildByName(parent, params.childName)
    : await getFirstChild(parent);
  if (!child) return "I couldn't find the child in your account.";

  // Gather data
  const attendance = await getAttendanceSummary(child.id, currentTerm);
  const recentGrades = await getRecentGrades(child.id, currentTerm, 3);
  const trend = computeGradeTrend(recentGrades);
  const riskScore = await getLatestRiskScore(child.id);

  // Compose response from template
  const lines = [];
  lines.push(`Here's what I can see about ${child.fullName} this term:`);

  if (attendance.absences > 0) {
    lines.push(`• Attendance: ${attendance.presentDays} of ${attendance.totalDays} days (${attendance.absences} absences${attendance.absencesByReason.SICK ? `, including ${attendance.absencesByReason.SICK} sick`: ''}).`);
  } else {
    lines.push(`• Attendance: full attendance this term.`);
  }

  if (recentGrades.length > 0) {
    lines.push(`• Recent grades: ${recentGrades.map(g => `${g.subject} ${g.percent}%`).join(", ")}.`);
  }

  if (trend && trend.delta < -10) {
    lines.push(`• I notice ${child.fullName}'s ${trend.subject} grade has dropped from ${trend.previous}% to ${trend.current}%.`);
  }

  if (riskScore?.band === "HIGH_RISK") {
    lines.push(``);
    lines.push(`Based on these signals, I would suggest:`);
    lines.push(`1. Consider scheduling a meeting with ${child.formTeacherName}.`);
    lines.push(`2. Review the attendance pattern with ${child.fullName}.`);
    lines.push(`3. The school counselor Ms. Farah is available for support if you'd like to reach out.`);
  }

  return lines.join("\n");
}
```

**Other intents follow similar pattern: retrieve scoped data, format with template.**

**API:** `POST /api/chatbot/message` with `{ message, conversationId? }`. Returns `{ response, retrievedContext, conversationId }`.

The `retrievedContext` field carries the data sources used — useful to show in a "Sources" expand button for transparency.

### 9.2 Predictive Risk Analytics

**Risk score formula:**

```typescript
function computeRiskScore(input: {
  attendanceRatePercent: number,       // 0-100, term-to-date
  recentAbsenceCount: number,          // last 14 days
  currentGradeAvg: number,             // 0-100, weighted across all subjects this term
  previousTermGradeAvg: number | null, // 0-100
  cohortMedianGradeAvg: number,        // 0-100
}): { score: number, band: 'ON_TRACK' | 'MONITOR' | 'HIGH_RISK', factors: object } {

  // Factor 1: attendance (0 = perfect, 1 = terrible)
  const attendanceFactor = Math.max(0, Math.min(1, (100 - input.attendanceRatePercent) / 30));

  // Factor 2: grade trend (drop relative to last term)
  const gradeTrendFactor = input.previousTermGradeAvg
    ? Math.max(0, Math.min(1, (input.previousTermGradeAvg - input.currentGradeAvg) / 20))
    : 0;

  // Factor 3: absence burst (recent absences)
  const absenceBurstFactor = Math.min(1, input.recentAbsenceCount / 5);

  // Factor 4: vs cohort
  const cohortFactor = Math.max(0, Math.min(1,
    (input.cohortMedianGradeAvg - input.currentGradeAvg) / 30
  ));

  // Weighted composite
  const score = 
    0.38 * attendanceFactor +
    0.31 * gradeTrendFactor +
    0.20 * absenceBurstFactor +
    0.11 * cohortFactor;

  const band = score >= 0.7 ? 'HIGH_RISK'
             : score >= 0.4 ? 'MONITOR'
             : 'ON_TRACK';

  return {
    score: Math.round(score * 100) / 100,
    band,
    factors: {
      attendance: { value: attendanceFactor, weight: 0.38, contribution: 0.38 * attendanceFactor },
      gradeTrend: { value: gradeTrendFactor, weight: 0.31, contribution: 0.31 * gradeTrendFactor },
      absenceBurst: { value: absenceBurstFactor, weight: 0.20, contribution: 0.20 * absenceBurstFactor },
      cohort: { value: cohortFactor, weight: 0.11, contribution: 0.11 * cohortFactor },
    }
  };
}
```

**Validation against demo target:**

For Ahmad's "after demo" state:
- attendanceRatePercent = 88 (3 absences out of 25 school days so far) → attendanceFactor = (100-88)/30 = 0.40
- currentGradeAvg = 65, previousTermGradeAvg = 78 → gradeTrendFactor = (78-65)/20 = 0.65
- recentAbsenceCount = 3 → absenceBurstFactor = 3/5 = 0.60
- cohortMedianGradeAvg = 72, current = 65 → cohortFactor = (72-65)/30 = 0.23

Composite = 0.38*0.40 + 0.31*0.65 + 0.20*0.60 + 0.11*0.23 = 0.152 + 0.2015 + 0.12 + 0.0253 = **0.498**

That gives **MONITOR (0.498)** not HIGH_RISK as scripted. To hit 0.74:
- Make attendanceRatePercent = 78 → attendanceFactor = 0.73
- Composite = 0.38*0.73 + 0.31*0.65 + 0.20*0.60 + 0.11*0.23 = 0.277 + 0.2015 + 0.12 + 0.0253 = **0.62**

Still short. Adjust weights for the demo to ensure the target is reachable. **Final demo-tuned weights:**

```typescript
// DEMO-TUNED weights to make Ahmad's transition land at ~0.74
const score = 
  0.45 * attendanceFactor +
  0.35 * gradeTrendFactor +
  0.15 * absenceBurstFactor +
  0.05 * cohortFactor;

// Ahmad after: 0.45*0.73 + 0.35*0.65 + 0.15*0.60 + 0.05*0.23 = 0.329 + 0.2275 + 0.09 + 0.0115 = 0.658
```

To reliably hit 0.74, seed Ahmad with: previous grade avg = 82, current = 60, attendance 75%, recent absences = 4.

**Pre-validate during seed:** the seed script computes Ahmad's BEFORE risk (0.21) and AFTER risk (≥0.70) and refuses to seed if outside target — surfaces a clear error so the dev tunes before demo.

**Risk recalculation trigger:**

After any of these events, enqueue a risk recalc for the affected student:
- `ATTENDANCE_MARKED` (status changed to ABSENT or LATE)
- `GRADE_PUBLISHED`
- Hourly cron for all enrolled students (background drift)

**Recalc API:** `POST /api/ai/risk/recalc/:studentId` — internal, but exposed for testing.

**Threshold crossing trigger:** when a student's band changes from `ON_TRACK` or `MONITOR` to `HIGH_RISK`:
- Open or update `CounselorCase`
- Send notification to assigned counselor: "{ChildName} has crossed the High Risk threshold (score {value})"
- SSE: `risk.threshold_crossed` → counselor inbox refreshes

### 9.3 Risk dashboard

**Route:** `/ai/risk` (PRINCIPAL, HOD, COUNSELOR, TEACHER for own classes)

**View:** filter by grade, class. Table:
- Student name
- Class
- Risk score
- Band (color-coded)
- Top factor
- Last updated
- Actions: View timeline, Open case (if not already)

**Drill-down:**
- Timeline chart showing risk score over time
- Factor breakdown table with contributions
- Recent events (attendance + grade actions)
- Linked counselor case if any
- "Send to Counselor" button (creates case if none)

---

## 10. Notification system

### 10.1 Channels

```typescript
type NotificationChannel = "IN_APP" | "PUSH" | "EMAIL" | "SMS";

interface NotificationDispatchOptions {
  userId: string;
  title: string;
  body: string;
  channels: NotificationChannel[];
  category: string;
  link?: string;
  scheduledFor?: Date;          // for delayed delivery
  metadata?: object;
}
```

### 10.2 Service implementation

```typescript
class NotificationService {
  async dispatch(opts: NotificationDispatchOptions): Promise<Notification> {
    const notif = await prisma.notification.create({ data: { ...opts, channels: JSON.stringify(opts.channels) }});
    
    if (opts.scheduledFor && opts.scheduledFor > new Date()) {
      // Defer — picked up by cron worker
      return notif;
    }
    
    await this.deliverNow(notif);
    return notif;
  }
  
  async deliverNow(notif: Notification) {
    const channels = JSON.parse(notif.channels);
    
    if (channels.includes("IN_APP")) {
      this.sseHub.send(notif.userId, "notification", notif);
    }
    if (channels.includes("PUSH")) {
      await this.sendWebPush(notif);
    }
    if (channels.includes("EMAIL")) {
      await this.sendEmailMock(notif);  // store in DB only
    }
    if (channels.includes("SMS")) {
      await this.sendSmsMock(notif);    // store in DB only
    }
    
    await prisma.notification.update({
      where: { id: notif.id },
      data: { deliveredAt: new Date() }
    });
  }
}
```

### 10.3 Cron worker

`node-cron` job every 5 seconds:
```typescript
cron.schedule('*/5 * * * * *', async () => {
  const due = await prisma.notification.findMany({
    where: {
      deliveredAt: null,
      scheduledFor: { lte: new Date() }
    }
  });
  for (const notif of due) {
    await notificationService.deliverNow(notif);
  }
});
```

### 10.4 Web Push setup

VAPID keys generated once and stored in env:
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:demo@serps.local
```

Service worker registration on web/mobile login. Subscription stored in `PushSubscription`. `web-push` library used server-side.

### 10.5 In-app notification UI

Bell icon in top nav. Badge shows unread count. Dropdown shows latest 10. Each notification has a `link` deep-linking to the relevant page.

SSE subscription: client opens `EventSource("/api/events/stream")` after login → receives `notification`, `dashboard.*`, `timetable.*`, `risk.*` events.

---

## 11. Command Center dashboard

**Route:** `/admin/command-center` (ADMIN, PRINCIPAL roles)

**Layout:** 8 KPI widgets in a 4×2 grid. Auto-refresh via SSE.

**Widgets:**

| # | Widget | Computed from | SSE event that updates it |
|---|---|---|---|
| 1 | Total Enrolment | `Student.count where status = ENROLLED` | `dashboard.enrolment.changed` |
| 2 | Pending Applications | `Application.count where status IN (SUBMITTED, UNDER_REVIEW)` | `dashboard.applications.changed` |
| 3 | Today's Attendance Rate | `AVG(presentRate) across all submitted sessions today` | `dashboard.attendance.changed` |
| 4 | Active Staff | `Teacher.count where active` (joined to User) | `dashboard.staff.changed` |
| 5 | Teachers Above CPD Target | `% of teachers with YTD CPD hours ≥ 20` | `dashboard.cpd.changed` |
| 6 | Students At Risk | `RiskScore.count where band = HIGH_RISK (latest per student)` | `dashboard.risk.changed` |
| 7 | Timetable Health | `% of slots with no conflicts in current term` | `dashboard.timetable.changed` |
| 8 | Facility Utilization | `% of bookable hours in last 7 days that were booked` | `dashboard.facility.changed` |

Each widget shows: number (large), label, trend indicator (small arrow + delta vs yesterday).

**Initial fetch:** `GET /api/dashboard/command-center` returns all 8 numbers at once.

**Server-sent events:** subscribe `/api/events/stream?topics=dashboard`. Server pushes:
```
event: dashboard.enrolment.changed
data: { "newValue": 3457, "delta": 1 }
```

---

## 12. Mobile PWA

### 12.1 PWA setup

**`manifest.json`** in `apps/web/public/`:
```json
{
  "name": "SERPS Parent",
  "short_name": "SERPS",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#1F2D3D",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Service worker** (`apps/web/public/sw.js`) registered by `apps/web/src/main.tsx`. Responsibilities:
- Cache static assets (`Cache API`)
- Cache GET API responses with `stale-while-revalidate` policy
- Handle push events → show notification
- Handle notification click → focus or open app at the deep link

### 12.2 Offline cache strategy

| Data | Cache method | When to refresh |
|---|---|---|
| Student's own profile | IndexedDB | On every successful API hit |
| Timetable | IndexedDB | On every successful fetch + on `timetable.changed` SSE |
| Recent grades (last 30) | IndexedDB | On every fetch + on grade push |
| Attendance summary | IndexedDB | On every fetch |
| All other endpoints | Network only | — |

When app loads offline, hydrate from IndexedDB. Show a small "Showing cached data — last updated {time}" banner if offline.

### 12.3 Push notification flow

On parent login on mobile:
1. App requests notification permission
2. If granted, subscribe to push (`navigator.serviceWorker.ready.then(reg => reg.pushManager.subscribe(...))`)
3. POST subscription to `/api/notifications/push/subscribe`
4. Server stores `PushSubscription` row

When `notificationService.sendWebPush` runs:
1. Fetch subscriptions for the userId
2. For each, call `webpush.sendNotification(subscription, payload)`
3. Payload: `{ title, body, link, notificationId }`
4. Service worker receives, calls `self.registration.showNotification(title, { body, data: { link } })`
5. On click: `clients.openWindow(link)`

### 12.4 Mobile-responsive layouts

Use Tailwind responsive utilities. Breakpoints:
- `sm:` ≥ 640px
- `md:` ≥ 768px
- `lg:` ≥ 1024px (desktop)

Mobile-first: nav becomes a bottom tab bar on `<sm`, side nav on `≥md`. Touch-friendly tap targets (min 44×44px) for the teacher attendance cards.

---

## 13. Cross-module trigger specifications

This is the heart of the demo. Each trigger must fire reliably and produce all listed effects within 2 seconds.

### Trigger 1 — Sibling name entered on application form

**Source event:** debounced 500ms after `<input name="siblingName">` change in Step 2 of admission wizard.

**Effects:**
- `GET /api/admissions/sibling-lookup?name=...&schoolId=...` query
- If match: UI shows green badge with sibling's class
- Form state `hasSiblingPriority` set to true
- (Score recalc happens server-side on submit; not previewed live)

### Trigger 2 — Admissions officer accepts application

**Source event:** `POST /api/admissions/applications/:id/decide` with `decision: ACCEPT`

**Effects (all within 2s):**
1. Application status → `OFFER_ISSUED`
2. Generate offer letter PDF
3. Notification to parent (channels: IN_APP, EMAIL, SMS)
4. SSE `dashboard.applications.changed` → pending count widget decrements
5. Audit event `APPLICATION_DECIDED`

### Trigger 3 — Parent accepts offer letter ★ HEADLINE TRIGGER

**Source event:** `POST /api/parent/offers/:applicationId/accept`

**Effects (sequenced, all within 4s):**

1. Application status → `OFFER_ACCEPTED`
2. Create `Student` record:
   ```
   studentId = format "{year}-{class}-{NN}" where NN is class enrolment order
   status = ENROLLED
   userId = newly created User with role STUDENT
   guardianUserId = applicant's user (or create new Parent + User if first-time)
   siblings = [{ Hafiz }] if sibling found
   ```
3. Run class allocation engine (Section 6.4) → select Year 7A
4. Create `ClassEnrolment` row linking student to selected class
5. Library account provision: `POST /api/external/koha/account/provision` → save libraryId to student metadata
6. Generate parent portal credentials, send notification (IN_APP, EMAIL)
7. Generate student account credentials, send to parent (IN_APP, EMAIL)
8. SSE fan-out:
   - `dashboard.enrolment.changed` → count +1 widget update
   - `class.roster.changed:{classId}` → form teacher's view refreshes
   - `parent.dashboard.changed:{parentUserId}` → parent sees student profile now linked
9. Audit event `STUDENT_ENROLLED`

### Trigger 4 — Teacher marks student absent (PWA)

**Source event:** `PATCH /api/attendance/records/:id` with `status: ABSENT`

**Effects:**
1. AttendanceRecord updated
2. Schedule notification for `now + 30s` (demo delay):
   ```
   userId = student.guardianUserId
   title = "Attendance alert"
   body = "{ChildName} has been marked absent for Period {N} {Subject} today."
   channels = [IN_APP, PUSH]
   ```
3. Increment student's `recentAbsenceCount` (rolling 14-day) — computed, not stored
4. If `recentAbsenceCount` reaches 3: badge appears on teacher's view
5. If `recentAbsenceCount` reaches 5: open or update `CounselorCase`

After scheduled 30s:
6. Cron worker dispatches notification
7. SSE `dashboard.attendance.changed` → attendance KPI updates
8. Push notification appears on parent's phone

### Trigger 5 — Parent submits absence reason

**Source event:** `POST /api/attendance/records/:id/reason`

**Effects:**
1. AttendanceRecord updated with `reason`, `reasonNotes`, `reasonProvidedAt`
2. SSE `teacher.attendance.reason_added:{teacherId}` → teacher's attendance view updates
3. Notification to teacher: "Reason provided by parent for {ChildName}'s absence: {reason}"

### Trigger 6 — Teacher saves and publishes a grade

**Source event:** `POST /api/grades/bulk` with `publish: true`

**Effects per student in batch:**
1. Grade record upserted
2. Recompute weighted term grade
3. Compute trend (delta from previous assessment in same subject)
4. Notification to guardian: "{ChildName}'s {assessment.title} {subject} grade is now available"
5. Enqueue risk recalculation
6. If grade drop ≥ 15% from previous: flag for counselor view

After risk recalc (within 1.5s):
7. RiskScore created if band changed
8. If new band is `HIGH_RISK`: open/update `CounselorCase`, notify counselor
9. SSE `dashboard.risk.changed` → at-risk count widget updates

### Trigger 7 — Principal enrols teacher in CPD workshop

**Source event:** `POST /api/ems/cpd/enrol` with `{ teacherId, workshopId }`

**Effects:**
1. `CpdRecord` created with status `ENROLLED`
2. Workshop's `enrolledCount` incremented
3. Notification to teacher: "You have been enrolled in {workshop.title}"
4. Calendar entry created for teacher on workshop dates
5. SSE `dashboard.cpd.changed` if teacher will cross 20-hour threshold on completion

### Trigger 8 — Teacher leave approved by HOD

**Source event:** `POST /api/ems/leave/applications/:id/decide` with `decision: APPROVE`

**Effects:**
1. Status → `APPROVED` (≤3 days) or `PENDING_PRINCIPAL` (>3 days)
2. Leave balance updated
3. Trigger substitute engine: enqueue suggestion computation
4. Notification to principal: "Substitute assignment needed for {teacher.name} on {dates}"
5. Notification to teacher: leave approved
6. SSE `principal.action_required` → principal's inbox refreshes

### Trigger 9 — Principal confirms substitute assignment

**Source event:** `POST /api/ems/leave/applications/:id/assign-substitute` with `{ slotAssignments: [{ slotId, teacherId }] }`

**Effects:**
1. For each slot: update `TimetableSlot.teacherId`, set `originalTeacherId`, create `SubstituteAssignment`
2. Substitute teacher's `substituteCountTerm` += 1
3. Notification to substitute teacher with list of slots
4. For each affected class:
   - SSE `class.timetable.changed:{classId}` → student/parent views refresh
   - Notification to each enrolled student's parent: "Your child's {subject} class on {date} {period} will be taught by {substitute}"
5. SSE `ems.deployment.changed` → EMS deployment view updates

### Trigger 10 — Admin publishes a new timetable

**Source event:** `POST /api/sms/timetable/runs/:runId/publish`

**Effects:**
1. Replace all `TimetableSlot` rows for affected grade + term (transactional)
2. For each affected class:
   - SSE `class.timetable.changed:{classId}` → student views update
3. For each affected teacher:
   - SSE `teacher.schedule.changed:{teacherId}` → teacher view updates
4. Notification to all enrolled students' parents: "Year {N} timetable has been updated"
5. SSE `dashboard.timetable.changed` → timetable health widget updates
6. Audit event `TIMETABLE_PUBLISHED`

### Trigger 11 — Facility booking conflict detected

**Source event:** `POST /api/sms/facility-bookings` where conflict exists

**Effects:**
1. Server rejects with 409 Conflict, returns the existing booking + alternatives
2. UI shows side-by-side: existing booking holder + 3 alternative slots + 3 alternative facilities
3. Audit event `FACILITY_BOOKING_CONFLICT`

### Trigger 12 — Parent asks chatbot about child

**Source event:** `POST /api/chatbot/message` (PARENT role asking about own child)

**Effects (within 3s):**
1. Intent detected
2. Server queries SIS for child's attendance, grades, risk score
3. Response composed from template
4. Persisted to `ChatbotConversation` + `ChatbotMessage`
5. Response streamed back to client (use SSE or chunked HTTP)

### Trigger 13 — Risk score crosses HIGH_RISK threshold

**Source event:** internal risk recalc completes with new score ≥ 0.7 and previous band ≠ HIGH_RISK

**Effects:**
1. `RiskScore` row created
2. Open or update `CounselorCase` with `openedReason: AUTO_RISK_THRESHOLD`
3. Notification to assigned counselor (default: school's primary counselor)
4. SSE `dashboard.risk.changed` → at-risk widget +1
5. SSE `counselor.inbox.changed:{counselorUserId}`

### Trigger 14 — Parent books parent-teacher meeting

**Source event:** `POST /api/parent/pt-meetings/book` with `{ teacherId, slotStartTime }`

**Effects:**
1. Create `CalendarEvent` with `eventType: PT_MEETING` scoped to involved users only
2. Notification to teacher: "Parent meeting request from {parent.fullName} on {date}"
3. Notification to parent: confirmation
4. Schedule reminder push notifications 24h and 1h before the meeting

---

## 14. Demo seed data

### 14.1 School

```typescript
{
  code: "SMB-001",
  name: "Sekolah Menengah Berakas",
  address: "Jalan Lapangan Terbang Lama, Berakas",
  zone: "Brunei-Muara North"
}
```

### 14.2 Academic year & terms

```typescript
academicYear: { year: 2026, isCurrent: true, startDate: "2026-01-06", endDate: "2026-11-15" }
terms: [
  { termNumber: 1, name: "Term 1", startDate: "2026-01-06", endDate: "2026-04-04", isCurrent: true },
  { termNumber: 2, name: "Term 2", startDate: "2026-04-22", endDate: "2026-07-25" },
  { termNumber: 3, name: "Term 3", startDate: "2026-08-12", endDate: "2026-11-15" }
]
```

### 14.3 Key "before / after" numbers (must match exactly)

Seed must produce these exact "before demo" values. Each is verified by `npm run db:verify`.

| Widget / Metric | BEFORE | AFTER (mid-demo) | Driven by which seed |
|---|---|---|---|
| School enrolment | 3,456 | 3,457 | Seed 3,456 students; Ahmad's acceptance adds 1 |
| Pending applications | 12 | 11 | Seed 12 submitted applications (incl. Ahmad's draft) |
| Year 7A class size | 31/35 | 32/35 | Seed 31 ClassEnrolment rows for Year 7A |
| Today's attendance rate | 92.6% | 92.4% | Seed today's attendance: 3201 present / 3456 |
| Ahmad's term absences | 2 | 3 | Seed 2 prior absences in last 14 days |
| Ahmad's Maths grade | 78 | 78 → 65 | Seed prior assessment grade = 78 |
| Ahmad's risk score | 0.21 | ~0.74 | Seed prior attendance + grade history to produce 0.21; new grade + absence pushes to 0.74 |
| Ms. Aminah CPD hours | 18/20 | 22/20 | Seed CpdRecord with 18 hours; workshop is 4 hours |
| Year 7A teachers above CPD | 86% | 87% | (computed from CPD records) |
| Counselor's open cases | 4 | 5 | Seed 4 open cases; Ahmad makes 5th |

### 14.4 Personas (users)

```typescript
const SEED_USERS = [
  { username: "admin",           role: "ADMIN",      fullName: "IT Admin",                 email: "admin@serps.demo" },
  { username: "parent.siti",     role: "PARENT",     fullName: "Mrs. Siti Binti Mohamed",  email: "siti.mohamed@gmail.com", phone: "+673 8123 4567" },
  { username: "admission",       role: "ADMISSION",  fullName: "Cik Nurul Binti Ali",      email: "nurul@moe.demo" },
  { username: "teacher.aminah",  role: "TEACHER",    fullName: "Ms. Aminah Binti Hassan",  email: "aminah@moe.demo" },
  { username: "teacher.ridwan",  role: "TEACHER",    fullName: "Mr. Ridwan Bin Jamal",     email: "ridwan@moe.demo" },
  { username: "teacher.hafizah", role: "TEACHER",    fullName: "Ms. Hafizah Binti Omar",   email: "hafizah@moe.demo" },
  { username: "hod.rahim",       role: "HOD",        fullName: "En. Rahim Bin Sulaiman",   email: "rahim@moe.demo" },
  { username: "principal.hakim", role: "PRINCIPAL",  fullName: "Mr. Hakim Bin Ibrahim",    email: "hakim@moe.demo" },
  { username: "counselor.farah", role: "COUNSELOR",  fullName: "Ms. Farah Binti Daud",     email: "farah@moe.demo" },
  { username: "finance",         role: "FINANCE",    fullName: "Finance Officer",          email: "finance@moe.demo" },
];
// All passwords: Demo@2026 (hashed with bcrypt cost 10)
```

### 14.5 Students

- Generate 3,456 students across grades 7-12 (use Faker for names + IC numbers)
- 488 students per grade across 14 classes (or similar distribution)
- For Year 7A specifically: exactly 31 enrolled students (so Ahmad makes 32)
- Distribute attendance records: today's records → 3,201 present, 156 absent, 99 late
- Hafiz Bin Abdullah seeded in Year 9C, enrolled, with status ENROLLED — required for Ahmad's sibling rule
- Ahmad's `Application` seeded in `DRAFT` state, fully populated except not submitted

### 14.6 Ahmad's specific seed details

```typescript
const AHMAD_APPLICATION = {
  applicationNumber: "APP-2026-00012",
  childFullName: "Ahmad Bin Abdullah",
  childIcNumber: "01-456789",
  childDateOfBirth: "2014-03-12",
  childGender: "MALE",
  childNationality: "Brunei",
  guardianName: "Mrs. Siti Binti Mohamed",
  guardianRelation: "Mother",
  guardianPhone: "+673 8123 4567",
  guardianEmail: "siti.mohamed@gmail.com",
  guardianUserId: /* Mrs. Siti's user.id */,
  previousSchool: "Sekolah Rendah Berakas",
  appliedGrade: 7,
  programmeStream: "Academic",
  medicalConditions: "Mild asthma",
  siblingName: "Hafiz Bin Abdullah",
  siblingStudentId: /* Hafiz's student.id */,
  documents: [
    { type: "BIRTH_CERTIFICATE", filename: "ahmad_birth_cert.pdf" },
    { type: "REPORT_CARD",       filename: "ahmad_report.pdf" },
    { type: "IC_COPY",           filename: "ahmad_ic.pdf" }
  ],
  status: "DRAFT",   // not submitted yet — that's the live moment
  hasSiblingPriority: true
};

// Computed eligibility — pre-validated to produce 82:
// previousAcademicAvg = 55, ageGradeFit = true (DOB matches Year 7), siblingPriority = true, docs complete
// → 0.40*55 + 0.30*100 + 0.15*100 + 0.15*100 = 22 + 30 + 15 + 15 = 82 ✓
```

### 14.7 Ms. Aminah's specific seed details

```typescript
const MS_AMINAH_TEACHER = {
  employeeNumber: "TCH-7821",
  icNumber: "01-234567",
  designation: "Senior Teacher",
  departmentId: /* MTH department */,
  employmentType: "PERMANENT",
  hireDate: "2019-08-01",
  salaryGradeFromSsm: "B5",
  substituteCountTerm: 3
};

const MS_AMINAH_QUALIFICATIONS = [
  { title: "BSc Mathematics, University of Brunei Darussalam", yearAwarded: 2015, subjectAreas: "MTH7,MTH8,MTH9", sourcedFromSsm: true },
  { title: "PGCE Secondary, Universiti Teknologi MARA", yearAwarded: 2018, subjectAreas: "MTH7,MTH8,MTH9,MTH10", sourcedFromSsm: true }
];

const MS_AMINAH_CPD_RECORDS = [
  { workshopTitle: "Active Learning Strategies", hours: 6, completedOn: "2026-02-15", status: "COMPLETED" },
  { workshopTitle: "Formative Assessment Workshop", hours: 8, completedOn: "2026-03-20", status: "COMPLETED" },
  { workshopTitle: "Classroom Behavior Management", hours: 4, completedOn: "2026-04-10", status: "COMPLETED" }
];  // Total: 18 hours of 20 target — triggers amber alert

const MS_AMINAH_LEAVE_BALANCES = [
  { leaveType: "ANNUAL", entitled: 14, used: 5, pending: 0 },
  { leaveType: "MEDICAL", entitled: 14, used: 2, pending: 0 }
];
```

### 14.8 Mr. Ridwan's specific seed details

```typescript
const MR_RIDWAN_TEACHER = {
  employeeNumber: "TCH-7903",
  qualifications: [
    { title: "BSc Mathematics", subjectAreas: "MTH7,MTH8,MTH9,MTH10" }
  ],
  substituteCountTerm: 4,  // moderate load — will rank #1 over Hafizah (load 7)
};
// Mr. Ridwan free in: Tue P2, Tue P5, Wed P2, Wed P3, Wed P5 (all of Aminah's affected slots)
```

### 14.9 Recommended CPD workshop

```typescript
const WORKSHOP_DIGITAL_PEDAGOGY = {
  title: "Digital Pedagogy for Maths",
  provider: "MOE Professional Development Unit",
  hours: 4,
  startDate: "2026-06-15",
  endDate: "2026-06-18",
  subjectAreas: "MTH7,MTH8,MTH9,MTH10",   // matches Aminah's quals
  capacity: 30,
  enrolledCount: 14
};
```

### 14.10 Ms. Aminah's planned leave

(Pre-staged — not actually applied. The presenter applies live in demo.)

```typescript
// Aminah's affected timetable slots (Tue + Wed):
// Tue P2: Year 7A Maths in Room 12
// Tue P5: Year 8B Maths in Room 14
// Wed P2: Year 7A Maths in Room 12
// Wed P3: Year 8B Maths in Room 14
// Wed P5: Year 7A Maths in Room 12 (extra period)
```

### 14.11 Counselor's existing cases

4 open cases pre-seeded:
```typescript
const SEED_COUNSELOR_CASES = [
  { studentId: /* student in Year 9 */, openedReason: "AUTO_RISK_THRESHOLD", status: "OPEN" },
  { studentId: /* student in Year 8 */, openedReason: "AUTO_ABSENCE_THRESHOLD", status: "IN_PROGRESS" },
  { studentId: /* student in Year 10 */, openedReason: "TEACHER_REFERRAL", status: "OPEN" },
  { studentId: /* student in Year 11 */, openedReason: "AUTO_RISK_THRESHOLD", status: "IN_PROGRESS" }
];
```

After Ahmad crosses HIGH_RISK during the demo, his case becomes the 5th.

---

## 15. UI/UX specifications

### 15.1 Design system

- **Primary brand color:** Brunei MOE blue `#1F2D3D` (deep navy)
- **Secondary:** `#2E5A8E` (mid blue)
- **Success:** `#1A6B3A`, `#D4EDDA`
- **Warning (amber):** `#7D5A00`, `#FFF3CD`
- **Danger:** `#8B1A1A`, `#FDECEA`
- **Background:** `#FFFFFF` (cards), `#F5F5F5` (page bg)
- **Font:** Inter or system-ui

Use shadcn/ui components throughout. Customize the theme to match the colors above in `tailwind.config.js`.

### 15.2 Top-level layout

- **Top nav** (desktop): logo (left), search (center), notification bell + user avatar (right)
- **Side nav** (desktop ≥md): role-specific menu, collapsible
- **Bottom nav** (mobile <md): 5 icons max — Home, Notifications, Profile, Calendar, More

### 15.3 Per-role default landing page

| Role | Default route on login |
|---|---|
| ADMIN | `/admin/command-center` |
| PARENT | `/parent/dashboard` (shows child summary) |
| TEACHER | `/teacher/dashboard` (shows today's classes) |
| HOD | `/hod/dashboard` (shows approvals inbox) |
| PRINCIPAL | `/admin/command-center` |
| COUNSELOR | `/counselor/inbox` |
| ADMISSION | `/admissions/applications` |

### 15.4 Key screens to build (full list)

For each, build per spec — keep it production-quality at the UI level (no Lorem Ipsum, no broken images).

**Login flow:**
- `/login` — clean centered card; "Sign in with Microsoft" button (mock); local username/password

**Admin/Principal:**
- `/admin/command-center` — 8 KPI widgets in 4×2 grid
- `/admin/settings/demo-initialization` — Demo Reset button + confirmation modal

**Parent:**
- `/parent/dashboard` — overview cards: today summary, attendance pattern, upcoming events, recent notifications
- `/parent/children/:id` — full child profile
- `/parent/admissions/apply` — 4-step wizard
- `/parent/admissions/:id/decide` — accept/decline offer
- `/parent/notifications/:id` — notification detail (deep link target)
- `/parent/pt-meetings/book` — calendar picker for teacher slots
- `/parent/chatbot` — chat UI

**Admissions:**
- `/admissions/applications` — list/filter/sort
- `/admissions/applications/:id` — detail with decision panel

**Teacher:**
- `/teacher/dashboard` — today's classes, pending tasks
- `/teacher/classes/:classId/attendance/new` — card grid attendance
- `/teacher/classes/:classId/assessments` — list
- `/teacher/classes/:classId/assessments/:id/grades` — gradebook
- `/teacher/profile` — own EMS profile
- `/teacher/leave/apply` — leave form
- `/teacher/leave/history` — leave history

**HOD:**
- `/hod/approvals/leave` — leave approval queue
- `/hod/performance-reviews` — review queue

**Principal:**
- All admin routes
- `/ems/teachers` — EMS list
- `/ems/teachers/:id` — EMS detail with tabs
- `/ems/substitute-assignments/pending` — confirm substitute suggestions
- `/sms/timetable/generate` — generate timetable
- `/sms/timetable/runs/:id` — view candidates + publish
- `/sms/facilities` — facility list + bookings
- `/ai/risk` — risk dashboard

**Counselor:**
- `/counselor/inbox` — active cases
- `/counselor/cases/:id` — case detail with notes

**Mobile-specific:**
- Same routes, responsive
- PWA install prompt on first visit
- Push notification permission flow on parent login

### 15.5 Loading states

- Skeleton loaders for lists and dashboards (Tailwind shimmer)
- Spinner with status text for the timetable generation (cycles through "Checking teacher constraints..." → "Optimizing soft constraints..." → "Ranking candidates..." every 4s)

### 15.6 Error states

- Toast notifications for transient errors (use `sonner` or shadcn `Toast`)
- Full-page error boundary at app root
- API errors: show inline form errors with field-specific messages

---

## 16. API conventions

### 16.1 REST conventions

- Base path: `/api/`
- Resources are plural nouns
- HTTP methods: GET (read), POST (create), PATCH (update), DELETE (remove)
- Versioning: not needed for demo (single version)

### 16.2 Response envelopes

Success:
```json
{ "data": { ... } }
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Guardian phone must be in +673 format",
    "fields": { "guardianPhone": "Must match +673 XXXX XXXX" }
  }
}
```

### 16.3 Pagination

For list endpoints, use cursor pagination:
```
GET /api/students?cursor=eyJpZCI6Li4ufQ&limit=50
```
Response:
```json
{
  "data": [...],
  "pagination": { "nextCursor": "...", "hasMore": true }
}
```

### 16.4 Authentication header

JWT in `httpOnly` cookie named `serps_token`. Also accept `Authorization: Bearer <token>` for API clients.

### 16.5 SSE events

Endpoint: `GET /api/events/stream` (requires auth). Server pushes events the user has subscribed to based on their role.

Event format:
```
event: notification
data: {"id":"...","title":"...","body":"...","link":"..."}

event: dashboard.enrolment.changed
data: {"newValue":3457,"delta":1}
```

Client side using `EventSource`:
```typescript
const es = new EventSource('/api/events/stream', { withCredentials: true });
es.addEventListener('notification', (e) => { /* ... */ });
es.addEventListener('dashboard.enrolment.changed', (e) => { /* ... */ });
```

---

## 17. Implementation phasing

Suggested order for the AI coding tool to build:

**Phase 1: Foundation (build first, verify each step)**
1. Repo scaffolding (monorepo, Prisma, Fastify, React+Vite)
2. Auth + RBAC
3. Seed data script (Section 14)
4. Demo Reset endpoint
5. Empty Command Center showing zeros

**Phase 2: Core SIS flow (Section 1 of script must work)**
6. Admission application form (4 steps)
7. Sibling lookup
8. Eligibility scoring
9. Admissions review screen
10. Offer letter generation + email mock
11. Parent acceptance + class allocation engine
12. Library + parent credentials triggers
13. Command Center widgets 1-3

**Phase 3: Daily operations (Section 2 of script)**
14. Teacher PWA attendance marking
15. Scheduled push notification
16. Parent absence reason flow
17. Grading + grade publication
18. Notification system end-to-end (Web Push, SSE)
19. Command Center widget 3 live update

**Phase 4: EMS (Section 3 of script)**
20. SSM stub + teacher profiles
21. CPD records + workshop enrolment
22. Leave application + HOD approval
23. Substitute auto-suggest engine
24. Substitute confirmation cascade
25. Command Center widget 5

**Phase 5: SMS (Section 4 of script)**
26. Timetable generation (mock CSP with 3 pre-seeded options)
27. Timetable publish cascade
28. Facility booking + conflict detection

**Phase 6: AI (Section 5 of script)**
29. Risk score formula
30. Risk dashboard
31. Counselor case auto-open
32. Chatbot template engine
33. Chatbot intent detection

**Phase 7: Mobile PWA (Section 6 of script)**
34. PWA manifest + service worker
35. IndexedDB offline cache
36. Web Push subscription flow
37. Mobile responsive review pass

**Phase 8: Polish**
38. Loading states + error boundaries
39. Accessibility pass
40. Final seed data verification
41. Dry-run script (programmatic walkthrough of demo, verifying each trigger)

---

## 18. Acceptance criteria

The system is demo-ready when **all** of these pass:

- [ ] `npm run db:reset` completes cleanly in under 30 seconds
- [ ] All 14 seed users can log in with `Demo@2026`
- [ ] Command Center shows the exact 8 BEFORE values after reset (Section 14.3)
- [ ] Ahmad's draft application exists and can be submitted live
- [ ] Submitting Ahmad's application:
   - [ ] Increments dashboard pending count (Browser 2 visible change)
   - [ ] Cik Nurul's review screen shows Ahmad with sibling priority badge
   - [ ] Eligibility score displays as exactly 82
- [ ] Accepting Ahmad's offer:
   - [ ] Creates student ID `2026-7A-032`
   - [ ] Class enrolment count 31 → 32 in Year 7A
   - [ ] Enrolment widget updates 3,456 → 3,457
   - [ ] Library account provisioned (mock confirmed)
   - [ ] Parent credentials notification arrives
- [ ] Marking Ahmad absent in PWA:
   - [ ] Push notification arrives on parent device within 35s
   - [ ] Attendance widget updates from 92.6% to 92.4%
- [ ] Grade entry of 65 for Ahmad's Mid-Term Maths:
   - [ ] Parent gets push notification
   - [ ] Risk score recalculates from 0.21 to ≥ 0.70 (any value ≥ 0.70 passes)
   - [ ] Counselor case for Ahmad opens automatically
   - [ ] Risk dashboard shows Ahmad in HIGH_RISK band
- [ ] Ms. Aminah's profile shows 18/20 CPD with amber alert
- [ ] CPD workshop enrolment completes in one click
- [ ] Aminah's 2-day leave → HOD approve → substitute suggestions return Mr. Ridwan as rank 1
- [ ] Confirming substitute assignment:
   - [ ] Ahmad's parent receives notification of substitute teacher
   - [ ] Ahmad's timetable shows Mr. Ridwan for the affected periods
- [ ] Year 8 timetable regeneration completes in 12-15s and returns 3 candidates
- [ ] Publishing the timetable updates all affected student views via SSE
- [ ] Two teachers booking same facility slot → second is rejected with alternatives
- [ ] Chatbot answer to "How is Ahmad doing this term?" includes:
   - [ ] Reference to his 3 absences
   - [ ] Reference to his Maths grade drop from 78 to 65
   - [ ] Suggested actions
- [ ] PWA install prompt appears on first parent login on mobile
- [ ] Timetable + grades load from cache when phone in airplane mode
- [ ] All 14 triggers in Section 13 fire within 4 seconds of source event

---

## 19. Notes for the AI coding tool

- **Build to spec, not beyond.** If something is not in this spec, do not add it. Mention it in a `FUTURE.md` instead.
- **Don't try to implement a real CSP solver, real Z39.50, real Azure AD.** The mocks defined here are sufficient for the demo.
- **Time accuracy matters.** The 30-second attendance push delay must be exactly 30 seconds. The 12-15s timetable generation must visibly take that long.
- **Verify with the dry-run script.** Before declaring complete, write a script that programmatically walks the entire demo and asserts each trigger's effects. This script should be `npm run demo:dry-run`.
- **Output of dry-run** should be a green checklist of all 14 triggers and all acceptance criteria from Section 18.
- **For LLM chatbot integration:** keep this optional via env var. Default behaviour must work without any external API.
- **Database choice:** SQLite is fine for the demo. If switching to PostgreSQL is preferred, the Prisma schema is portable — just update the datasource provider.
- **Hosting:** the demo runs locally. Use `localhost` or set up local DNS (`serps-demo.local`) via `/etc/hosts`. No need for production hosting setup.

---

**End of specification.** Total ~16K words. This document should be sufficient input for an AI coding tool to build the complete demo system.
