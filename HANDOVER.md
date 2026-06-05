# MOE SERPS POC — AI Developer Handover

This document is the single entry point for an AI agent continuing development on this project. Read it fully before writing any code.

---

## 1. Project Overview

**MOE SERPS** (School Enterprise Resource Planning System) is a proof-of-concept for the Ministry of Education, Brunei. It covers four types of schools (MOE secondary, MOE primary, MORA religious, private international) and ten administrative modules built in two development phases.

The live demonstration is on **2026-06-11 (Thursday morning)**. All sample data is calibrated to that date — reseed on that morning and everything will be date-appropriate.

---

## 2. Directory Structure

```
MOE-POC/
├── backend/               Express + Prisma + SQLite API server
│   ├── prisma/
│   │   ├── schema.prisma  Authoritative data model — read before any schema change
│   │   └── seed.ts        Full demo database seed (3,456 students + all modules)
│   ├── src/
│   │   ├── index.ts       Entry point — all route registrations here
│   │   ├── routes/        One file per feature domain (54 route files)
│   │   ├── middleware/
│   │   │   └── auth.ts    authenticate, requireRole, schoolFilter
│   │   ├── services/
│   │   │   ├── notificationService.ts   sendMany(userIds, {title, message, type})
│   │   │   └── emailService.ts
│   │   ├── lib/
│   │   │   ├── prisma.ts       Prisma client singleton
│   │   │   ├── config.ts       getConfigInt/Float(key, default) — reads SystemConfig table
│   │   │   ├── sse.ts          broadcast(channel, event, data) — Server-Sent Events
│   │   │   └── leaveCalendar.ts calculateWorkingDays — Fri/Sat weekend + Brunei holidays
│   │   └── .env               DATABASE_URL, JWT_SECRET, PORT=4000 (not committed)
│   └── package.json
├── pc/                    React 19 + Vite + TypeScript + Ant Design frontend
│   ├── src/
│   │   ├── router/routes.tsx   All page routes — add lazy imports here
│   │   ├── layouts/
│   │   │   ├── Sidebar.tsx     Navigation items per role — add new items here
│   │   │   └── AppLayout.tsx
│   │   ├── pages/
│   │   │   ├── ems/            EMS pages (teachers, leave, CPD, retirement, surveys…)
│   │   │   ├── sis/            SIS pages (students, admissions, grades, attendance…)
│   │   │   ├── sms/            SMS pages (reports, auto-triggers, timetable…)
│   │   │   ├── attendance/     Staff attendance check-in pages
│   │   │   ├── parent/         Parent portal pages
│   │   │   ├── registration/   Public registration wizard (no auth required)
│   │   │   ├── dashboard/      Role dashboards
│   │   │   └── auth/           Login
│   │   ├── stores/
│   │   │   └── authStore.ts    useAuthStore() → { user, token, setAuth, clearAuth }
│   │   ├── lib/api.ts          Axios instance with base URL /api/v1 + JWT interceptor
│   │   └── types/index.ts      Shared TypeScript interfaces
│   └── package.json
├── doc/                   Dev logs, acceptance checklist, demo scripts
├── CLAUDE.md              Hard rules — read before writing any code
└── HANDOVER.md            This file
```

---

## 3. Running the System

### Prerequisites
- Node.js 20+
- Both `backend/` and `pc/` have their own `node_modules` (run `npm install` in each if missing)

### Start development servers (two terminals)

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev          # tsx watch src/index.ts — hot reload on :4000
```

**Terminal 2 — Frontend:**
```bash
cd pc
npm run dev          # Vite dev server on :3000, proxies /api/v1 to :4000
```

Open **http://localhost:3000** in the browser.

### Health check
```
GET http://localhost:4000/health
→ { "status": "ok", "version": "1.0", "ts": "..." }
```

---

## 4. Database — Reset & Seed

**Full reset (destroys all data, rebuilds from seed):**
```bash
cd backend
npx prisma db push --force-reset && npx prisma db seed
```

Or use the npm script shorthand:
```bash
cd backend
npm run db:reset
```

The seed takes ~2–3 minutes (3,456 students × attendance + 17 enrichment categories).

**Prisma Studio (visual DB browser):**
```bash
cd backend
npm run db:studio    # opens http://localhost:5555
```

**Apply schema changes without data loss:**
```bash
cd backend
npx prisma db push   # safe if backend process is stopped first
```
> If the backend is running during `db push`, a harmless EPERM on the DLL rename may appear — the schema is still applied correctly.

**Generate Prisma client after schema changes:**
```bash
cd backend
npx prisma generate
```

---

## 5. TypeScript Checks

Always run before considering a task complete:
```bash
cd backend && npx tsc --noEmit    # must produce zero output
cd pc      && npx tsc --noEmit    # must produce zero output
```

---

## 6. Demo Accounts

All accounts belong to **SMHK** (the main demo school) unless noted.

| Role | Username | Password | Notes |
|------|----------|----------|-------|
| admin | `admin` | `admin123` | Full access, SMHK |
| principal | `principal` | `principal123` | Hjh Rashidah |
| hod | `hod01` | `hod123` | Dr. Azman — head of Science & Maths |
| manager | `manager` | `Demo@2026` | Hj Kamaruddin |
| finance | `finance` | `finance123` | Finance Officer |
| admissions | `admissions` | `Demo@2026` | Admissions Officer |
| teacher | `drsiti` | `Demo@2026` | Dr. Siti — Year 12 Physics, retirement application |
| teacher | `teacher.ridwan` | `Demo@2026` | Mr. Ridwan — frequent lateness anomaly |
| teacher | `teacher01` | `teacher123` | Ms. Aminah — SEN champion, 18/20 CPD hours |
| teacher | `faizal` | `Demo@2026` | Mohd Faizal — currently on medical leave |
| counselor | `farah` | `Demo@2026` | Ms. Farah — 4 open counselor cases |
| student | `student001` | `student123` | Ahmad — HIGH_RISK, dyslexia IEP |
| student | `adam` | `Demo@2026` | Adam — overdue fee, fee hold active |
| student | `nurul` | `Demo@2026` | Nurul — good standing |
| parent | `parent.siti` | `Demo@2026` | Mrs. Siti — parent of Ahmad + Hafiz |
| parent | `parent01` | `parent123` | Hj Abdullah — parent of Ahmad |
| sysadmin | `sysadmin` | `sysadmin123` | Cross-school system admin |
| SRPB admin | `admin.srpb` | `Demo@2026` | MOE Primary school |
| SMAB admin | `admin.smab` | `Demo@2026` | MORA Religious school |
| ISB admin | `admin.isb` | `Demo@2026` | Private International school |

Additional named students (Year 9–12):
- `hafiz_y9c` / `Demo@2026` — PROBATION, autism IEP, Year 9C
- `fatin` / `Demo@2026` — B-student, Year 9A
- `nadia_y10` / `Demo@2026` — top student, Year 10A
- `hana_y11` / `Demo@2026` — O-Level year, Year 11A
- `danial_y12` / `Demo@2026` — A-Level, conditional university offer

---

## 7. Architecture

### Backend

- **Framework:** Express 4 + TypeScript
- **Database:** SQLite via Prisma 5 (file `backend/prisma/dev.db`)
- **Auth:** JWT (HS256), stored in Prisma `SystemConfig` table as `JWT_SECRET`
- **Base URL:** All API routes under `/api/v1/`
- **Real-time:** Server-Sent Events at `GET /api/v1/events/stream?topics=...&token=<jwt>`

**Registered route prefixes (54 routes):**

| Prefix | File | Purpose |
|--------|------|---------|
| `/auth` | auth.ts | Login, me, refresh |
| `/students` | students.ts | Student CRUD, risk scores, SEN |
| `/teachers` | teachers.ts | Teacher CRUD, CPD, workload |
| `/leave` | leaveEnhanced.ts | Leave applications, balances, calendar, reports |
| `/staff-attendance` | staffAttendance.ts | Staff check-in/out, anomalies, dashboard |
| `/retirement` | retirement.ts | Retirement eligibility, applications |
| `/surveys` | surveys.ts | Staff feedback surveys |
| `/self-service` | selfService.ts | Transfer, promotion, training, document requests |
| `/communications` | communications.ts | Contact directory, consent forms, comm history |
| `/triggers` | autoTriggers.ts | NF-01–07 notification auto-triggers + stock |
| `/conflicts` | conflicts.ts | Timetable conflict detection, substitute finder |
| `/reports` | reports.ts | Management dashboard reports (RP-01–12) |
| `/registration` | registration.ts | Public student registration portal (no auth) |
| `/grades` | grades.ts | Grade items, grade CRUD, amendments |
| `/attendance` | attendance.ts | Student attendance sessions + records |
| `/admissions` | admissions.ts | Admission pipeline |
| `/ems` | ems.ts | EMS aggregate routes |
| `/dashboard` | dashboard.ts | Widget counts |
| `/parent` | parent.ts | Parent portal |
| `/counselor` | counselor.ts | Counselor cases, IEP |
| `/hod` | hod.ts | HOD department views |
| `/messages` | messages.ts | Parent-teacher direct messages |
| `/announcements` | announcements.ts | School announcements |
| `/behavior` | behavior.ts | Merit/demerit records |
| `/cca` | cca.ts | Co-curricular activities |
| `/library` | library.ts | Books, loans, holds |
| `/inventory` | inventory.ts | Assets, maintenance logs |
| `/exams` | exams.ts | Exam candidates |
| `/sen` | sen.ts | SEN students, IEP goals/sessions |
| `/schools` | schools.ts | Multi-school data |
| `/transitions` | transitions.ts | School/grade transitions |
| `/awards` | awards.ts | Staff awards |
| `/postings` | postings.ts | Staff posting history |
| `/notifications` | notifications.ts | In-app notifications |
| `/config` | config.ts | System configuration |
| `/events` | events.ts | SSE stream |
| `/files` | files.ts | File upload/download |
| `/ai` | ai.ts | AI assistant |
| `/finance` | finance.ts | Fee invoices, expenses |
| `/facilities` | facilities.ts | Facility bookings |
| `/certifications` | certifications.ts | Teacher certifications |
| `/courses` | courses.ts | Course management |
| `/enrollments` | enrollments.ts | Student course enrollments |
| `/assignments` | assignments.ts | Assignments/homework |
| `/egnc` | egnc.ts | EGNC integration |
| `/sms` | sms.ts | SMS aggregate routes |
| `/admin` | admin.ts | Admin operations |
| `/approvals` | approvals.ts | Multi-level approval workflow |
| `/push` | push.ts | Web push notifications |

### Frontend

- **Framework:** React 19 + Vite + TypeScript
- **UI Library:** Ant Design 6 (use ONLY Ant Design components — no native HTML form elements)
- **Icons:** Lucide React (import from `lucide-react` — NO other icon libraries, NO emoji)
- **Charts:** Recharts
- **State:** Zustand (`useAuthStore`, `useUIStore`)
- **API calls:** `import api from '@/lib/api'` — pre-configured Axios with JWT header
- **i18n:** `const { t } = useTranslation()` — all user-visible strings via `t('key', { defaultValue: 'English' })`
- **Styling:** CSS Modules (`.module.css` files next to component) + CSS variables for theming

---

## 8. Adding a New Feature — Exact Steps

### Backend route

1. Create `backend/src/routes/<feature>.ts`
2. Import and mount in `backend/src/index.ts`:
   ```typescript
   import featureRoutes from './routes/feature'
   app.use('/api/v1/feature', featureRoutes)
   ```
3. Use `authenticate` for protected routes, `requireRole(...)` for role-gated routes:
   ```typescript
   router.get('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
     const filter = schoolFilter(req)   // scopes to user's school automatically
     const data = await prisma.someModel.findMany({ where: filter })
     res.json({ success: true, data })
   })
   ```
4. For public (no-auth) routes, omit `authenticate` middleware entirely.
5. Use `sendMany(userIds, { title, message, type })` to create notifications.
6. Use `broadcast(channel, event, data)` for real-time SSE pushes.
7. Read thresholds from DB: `await getConfigInt('threshold_key', defaultValue)`

**TypeScript pattern for params:**
```typescript
const id = req.params['id'] as string    // NOT req.params.id
```

**Prisma _count with findUnique** — use a separate `.count()` call instead of `_count` in `findUnique`.

### Frontend page

1. Create `pc/src/pages/<domain>/<PageName>.tsx` (+ optional `.module.css`)
2. Add lazy import in `pc/src/router/routes.tsx`:
   ```typescript
   const PageName = lazy(() => import('@/pages/<domain>/<PageName>'))
   ```
3. Add route entry in `routes.tsx` (inside `ProtectedRoute` unless public):
   ```typescript
   { path: '/domain/page', element: r(['admin', 'manager'], <PageName />) }
   ```
4. Add sidebar nav item in `pc/src/layouts/Sidebar.tsx` (import Lucide icon at top of file):
   ```typescript
   { key: '/domain/page', label: t('nav.pageLabel', { defaultValue: 'Page Label' }), icon: icon(SomeLucideIcon), roles: ['admin', 'manager'] }
   ```
5. For public routes (no auth), add **outside** the `ProtectedRoute` wrapper in `routes.tsx`.

### Schema change

1. Edit `backend/prisma/schema.prisma`
2. Run `cd backend && npx prisma db push` (stop the backend process first)
3. Update `backend/prisma/seed.ts` with sample data for the new model
4. Add new types/interfaces to `pc/src/types/index.ts`

---

## 9. Key Patterns & Gotchas

| Pattern | Correct | Wrong |
|---------|---------|-------|
| Route params | `req.params['id'] as string` | `req.params.id` |
| Prisma count on findUnique | Separate `.count()` call | `_count` inside `findUnique` |
| Frontend icons | `import { X } from 'lucide-react'` | Any other icon library or emoji |
| i18n | `t('key', { defaultValue: 'English' })` | Hardcoded English strings |
| API call | `import api from '@/lib/api'` | Direct `fetch()` or plain axios |
| Config values | `getConfigInt('key', default)` | Hardcoded thresholds |
| Notification | `sendMany([userId], { title, message })` | Direct `prisma.notification.create` |
| SSE push | `broadcast('channel', 'event', data)` | Polling |
| Styling | CSS Modules + Ant Design | Tailwind, inline styles, global CSS |
| Form elements | Ant Design `<Form>`, `<Select>`, `<DatePicker>` | Native `<select>`, `<input type="date">` |
| School scoping | `schoolFilter(req)` in Prisma where clause | Manual `schoolId` checks |
| Brunei working days | `calculateWorkingDays(start, end)` | DIY date arithmetic |

---

## 10. Data Model — Key Models

The full schema is at `backend/prisma/schema.prisma`. Summary of primary models:

| Model | Key fields | Notes |
|-------|-----------|-------|
| `User` | id, username, role, schoolId, systemAdmin | Roles: student/teacher/parent/admin/manager/finance/admissions/hod/principal/counselor |
| `Student` | userId, studentId, gradeLevel, className, enrollmentStatus, academicStanding | academicStanding: GOOD_STANDING/ACADEMIC_WATCH/PROBATION |
| `Teacher` | userId, staffId, department, subjects, cpdHours, cpdTarget, dateOfBirth, annualLeaveBalance | staffType: TEACHING/ADMINISTRATIVE/SUPPORT/SECURITY |
| `LeaveApplication` | teacherId, leaveType, startDate, endDate, status | Status: PENDING/HOD_APPROVED/PRINCIPAL_APPROVED/REJECTED/CANCELLED |
| `StaffAttendanceRecord` | teacherId, date, checkInAt, status, lateMinutes | @@unique([teacherId, date]) |
| `StaffAttendanceConfig` | schoolId @unique, startTime, cutoffTime | Per-school configuration |
| `RetirementApplication` | teacherId @unique, retirementType, status | Types: NORMAL/VOLUNTARY_EARLY/MEDICAL |
| `Survey` + `SurveyQuestion` + `SurveyResponse` + `SurveyAnswer` | Full survey lifecycle | isAnonymous — no responderId stored when true |
| `SelfServiceRequest` | teacherId, type, status | Types: TRANSFER/PROMOTION/TRAINING/DOCUMENT/PROFILE_UPDATE |
| `ConsentForm` + `ConsentFormRecipient` | Parent e-signature workflow | |
| `StockItem` | name, category, quantity, minQuantity | Triggers NF-06 when quantity ≤ minQuantity |
| `NotificationTriggerLog` | triggerType, ranAt, status | Audit trail for auto-trigger runs |
| `TimetableSlot` | teacherId, courseId, dayOfWeek, startTime, endTime, room, className | No unique constraint — duplicates intentionally seeded for conflict demo |
| `RiskScore` | studentId @unique, score, band | Bands: LOW_RISK/MONITOR/HIGH_RISK |
| `CounselorCase` | studentId, counselorUserId, status | Statuses: OPEN/IN_PROGRESS/CLOSED |

---

## 11. Completed Modules — Do Not Re-implement

All 85 functional requirements from `Functional_Requirements_Gap_Modules.md` are implemented:

| Module | Requirements | Status |
|--------|-------------|--------|
| 1. Leave Management | LV-01–14 | ✅ Complete |
| 2. Staff Attendance Check-In | AT-01–13 | ✅ Complete |
| 3. Teacher Retirement Planning | RT-01–08 | ✅ Complete |
| 4. Student Online Registration Portal | SR-01–13 | ✅ Complete |
| 5. Management Dashboard Reports | RP-01–12 | ✅ Complete |
| 6. Feedback & Surveys | FB-01–05 | ✅ Complete |
| 7. Self-Service Educator Portal | SS-01–05 | ✅ Complete |
| 8. Parent-Teacher Communication | CM-01–04 | ✅ Complete |
| 9. Notification Auto-Triggers | NF-01–07 | ✅ Complete |
| 10. Timetable Conflict Detection | TT-01–04 | ✅ Complete |

**Extra EMS features** (not from gap requirements but implemented):
- Staff Awards & Recognition (`/api/v1/awards`, `StaffAwardsPage`)
- Posting History (`/api/v1/postings`)

---

## 12. Seeded Sample Data — What Exists

The seed creates realistic data across all modules for demo purposes:

### Students & Schools
- **3,456 enrolled students** across SMHK (Years 7–12, 15 classes per year)
- **4 schools:** SMHK (main), SRPB (primary), SMAB (MORA religious), ISB (private international)
- **6 SMHK teachers:** drsiti, faizal, teacher01 (Aminah), ridwan, hassan, zuraidah
- Today's bulk attendance: 3,201 present / 156 absent / 99 late

### Demo-ready scenarios
- **Ahmad** (student001): HIGH_RISK 82%, dyslexia IEP (Level 2), academic watch, 2 absences in 14 days
- **Hafiz** (Year 9C): PROBATION, autism IEP (Level 3), poor attendance, failing grades
- **Nadia** (Year 10): top student, 94.3% average
- **Hana** (Year 11): O-Level year, mock results 89.6%
- **Danial** (Year 12): A-Level student, conditional university offer
- **Dr. Siti**: voluntary early retirement application (UNDER_REVIEW), CPD 25h
- **Faizal**: currently on approved 5-day medical leave
- **Ridwan**: 6 late check-ins in 30 days (anomaly flag triggers)
- **Hassan**: 3 consecutive unexplained absences (anomaly flag triggers)
- **Aminah**: CPD 18/20 hours, pending annual leave request, SEN champion award

### Module-specific data
- 6 leave applications across all statuses (approved/HOD-approved/pending/rejected/cancelled/awaiting-principal)
- 58 staff attendance records (6 teachers, ~10 days each)
- 3 surveys: ACTIVE (7 responses), CLOSED (5 named responses), DRAFT
- 5 self-service requests: TRANSFER/TRAINING/DOCUMENT/PROMOTION/PROFILE_UPDATE
- 4 parent-teacher meetings (2 completed, 1 scheduled tomorrow)
- 3 message threads with 9 messages
- 5 school announcements (2 for teachers, 2 for parents, 1 all-school)
- 14 notification trigger logs (7 types × 2 runs each)
- 5 MONITOR-band risk scores
- 6 behavior records (merits and demerits)
- 4 CCA clubs with 10 student enrollments
- 3 intentional timetable conflict slots for conflict detection demo
- 12 stock items (5 below minimum threshold)
- 12 admission applications (11 submitted + 1 draft)
- 20 library books, 5 loans, 3 holds
- 15 assets with maintenance logs

---

## 13. Calendar Context (Demo Day: 2026-06-11)

Brunei working week: **Sunday–Thursday** (Friday and Saturday = weekend).

| Date | Event | Relationship to demo |
|------|-------|---------------------|
| 2026-05-28 | Science Fair | ~2 weeks ago |
| 2026-06-04 | Sports Day | Last Thu (past) |
| 2026-06-07–08 | Hari Raya Aidiladha | Sun–Mon (4 days ago) |
| **2026-06-10** | **School Open Day** | **Yesterday** |
| **2026-06-11** | **DEMO DAY** | **Today — Hall A booked for Staff Briefing** |
| 2026-06-15 | Sultan's Birthday (holiday) | 4 days out |
| 2026-06-16 | ICT Examination — Year 11 | Upcoming Tue |
| 2026-06-18 | Science Fair Preparation (pending) | Upcoming Thu |
| 2026-06-22 | Year 9-10 Mock Exams | 11 days out |
| 2026-06-29 | Parent-Teacher Meeting | 18 days out |
| 2026-07-06 | Final Examinations Begin | 3.5 weeks out |

**On demo morning:** Run `npm run db:reset` in `backend/` — all relative dates auto-shift to June 11.

---

## 14. Hard Rules (Non-Negotiable)

Taken from `CLAUDE.md` — violating these breaks the demo:

1. **All UI uses Ant Design** — no native `<select>`, `<input type="date">`, `<button>` for primary actions
2. **Icons = Lucide React only** — no emoji, no Font Awesome, no Material icons
3. **All user-visible text through `t()`** — no hardcoded English strings in JSX
4. **TypeScript strict** — zero `@ts-ignore`; minimize `any`; `req.params['id'] as string` pattern
5. **Stats from DB** — no hardcoded numbers on dashboards; always query Prisma
6. **School scoping** — every multi-tenant query must use `schoolFilter(req)` or explicit `schoolId`
7. **No secrets in code** — API keys, passwords, SMTP credentials go in `.env` only
8. **Never commit:** `.env`, `*.db`, `screenshots/`, `node_modules/`

---

## 15. Workflow for Each Feature

1. Read `backend/prisma/schema.prisma` to understand existing models — do not duplicate
2. Check `backend/src/index.ts` to see if a route prefix already exists for the domain
3. Check `pc/src/router/routes.tsx` for existing page routes in the domain
4. Run TypeScript checks after every significant change — zero errors before moving on
5. After schema changes: stop backend → `npx prisma db push` → restart backend
6. To test a new API endpoint manually: use the `admin` account (full access) first, then verify role restrictions

---

## 16. Environment Files

**`backend/.env`** (not in git):
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="moe-poc-dev-secret-key-2025"
PORT=4000
```

**`pc/` Vite proxy** (in `vite.config.ts`): `/api/v1` proxied to `http://localhost:4000` — no CORS issues in dev.

No environment setup is needed beyond what is already committed. The `.env` file shown above is the complete configuration for local development.

---

## 17. Git Remotes

```bash
git push origin master    # primary remote
git push github master    # secondary backup
```

After each session:
1. Commit with a meaningful message
2. Push to both remotes
3. Create/update dev log in `doc/dev-logs/YYMMDD-HHmm.md`
