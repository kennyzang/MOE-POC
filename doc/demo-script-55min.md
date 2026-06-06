# MOE SERPS POC — 55-Minute Demo Script

**Date:** 10 June 2026 (School Open Day)  
**Audience:** MOE Brunei stakeholders, school principals, IT department  
**System URL:** http://localhost:3000  
**Accounts needed:** admin / teacher (drsiti) / hod01 / student (student001 for Ahmad) / parent (fatimah)  
**Start fresh:** `cd backend && npx prisma migrate reset` → Ahmad data must show HIGH RISK

---

## Pre-Demo Setup (T-15 min)

```bash
./start.sh                    # backend:4000 / pc:3000 / mobile:5173
# Verify backend is up:
curl http://localhost:4000/api/v1/health
# Open two browser windows:
#   Window A: PC (http://localhost:3000)
#   Window B: Mobile H5 (http://localhost:5173)
# Pre-login admin in Window A
```

---

## [00:00–08:00] Command Center Dashboard (8 min)

**Narrative:** "MOE SERPS gives school leadership a real-time pulse of every key metric."

**Steps:**
1. Login as **admin / admin123** → lands on Command Center Dashboard
2. Point to stat cards: 25 students, 5 teachers, high attendance rate
3. Hover enrollment bar chart: "Year 7 has the most students — baseline for resource planning"
4. Point to Staff Status panel: active / on-leave / in-training counts from DB
5. Point to Timetable Conflicts panel: "Zero conflicts — our scheduler validated every slot"
6. Click **At-Risk Dashboard** in sidebar → show risk distribution pie
7. Point to Ahmad Bin Abdullah at HIGH RISK 82% — "We'll come back to him"

**Transition:** "Let's start from the very beginning — how a student enters this school."

---

## [08:00–10:00] Ahmad's Story (2 min)

**Narrative:** "Today we follow Ahmad Bin Abdullah — Year 9, Form 2B. He applied, enrolled, slipped, and our system caught him."

**Steps:**
1. Stay on At-Risk page — point to Ahmad's row (HIGH RISK, 82%)
2. "60% attendance over 8 weeks, declining grades — AI flagged this automatically"
3. "Let's rewind to when he first joined."

**Transition:** "Back to admissions."

---

## [10:00–18:00] SIS — 4-Step Admission Wizard (8 min)

**Narrative:** "No paperwork, no Excel — a guided 4-step admission workflow."

**Steps:**
1. Click **Student Information → Admissions** in sidebar
2. Click **New Application** → 4-step wizard opens
3. **Step 1 — Personal Info:** Fill name "Test Applicant", IC number, age 14 → year auto-calculates to "Year 9"
4. **Step 2 — Academic Background:** Previous school, grade history
5. **Step 3 — Parent/Guardian:** "+673" phone prefix auto-added, email validation shown
6. **Step 4 — Review & Submit:** Summary screen → click Submit
7. New application appears in table with **Pending** status
8. Click the row → change status to **Under Review** → notification fires (bell icon shows 1)
9. Click bell → show notification dropdown: "Application for Test Applicant changed to Under Review"

**Transition:** "Now let's see what happens in the classroom."

---

## [18:00–23:00] Teacher Mobile — Attendance (5 min)

**Narrative:** "Teachers use their phones. No PC, no paper register."

**Steps (Window B — Mobile H5, pre-login as drsiti / Demo@2026):**
1. Show mobile home screen — teacher view with tabs
2. Tap **Attendance** tab
3. Select class → show student list with Present/Absent/Late toggles
4. Mark 2 students absent → Save
5. Switch to Window A (PC) → **At-Risk Dashboard** — "Watch Ahmad's attendance drop"
6. Back to bell icon — 2 new notifications for absent students

**Transition:** "Grades work the same way — let's record today's scores."

---

## [23:00–27:00] Grades — Record & Student View (4 min)

**Narrative:** "Teachers record grades on PC. Students see them instantly in their portal."

**Steps:**
1. PC — Click **Student Information → Grades**
2. Select a course → add/update a score for Ahmad
3. Notification fires — bell shows new item
4. Open new incognito tab → login as **student001 / student123** (Ahmad's student account)
5. Navigate to **My Grades** → show grade just recorded with score
6. Point to GPA calculation at top: "Weighted average, live from DB"

**Transition:** "Now let's look at teacher performance — EMS."

---

## [27:00–33:00] EMS — Teacher Profile + CPD + Performance Evaluation (6 min)

**Narrative:** "EMS tracks every teacher's professional journey — qualifications, training hours, and formal evaluations."

**Steps (login back as hod01 / hod123):**
1. Navigate to **Educator Management → Performance Evaluations**
2. Show existing evaluations list
3. Click **New Evaluation** → select Dr. Siti Nurhaliza
4. Fill scores: Teaching 85, Professional 90, Conduct 88 → Save
5. Open the new draft → click **Submit for Review** → status changes to "Submitted"
6. Notification sent to dr. Siti and all managers
7. Switch to principal / principal123 → open same evaluation → **Approve** with comments
8. Back to EMS sidebar — click **Teaching Workload** → show CPD hours bar
9. If any teacher < 20h CPD → amber alert badge visible

**Transition:** "Let's see how classes are scheduled and facilities managed."

---

## [33:00–38:00] SMS — Timetable + School Calendar + Facility Booking (5 min)

**Narrative:** "Auto-generated timetables, a shared school calendar, and conflict-free facility booking."

**Steps (login as admin):**
1. Click **School Management → Timetable** → show weekly grid for Year 7A
2. Click **Generate Timetable** → watch slots populate with courses + teachers
3. Back to sidebar → **School Calendar**
4. Show June events: Sports Day (5 Jun), Open Day (10 Jun — today!) in calendar view
5. Click **Add Event** → add "Prize Giving Ceremony" on 12 Jun → event appears on calendar
6. Click **School Resources** → click **Book Facility** for Hall A
7. Booking confirmed → notification fires

**Transition:** "Now let's step into the future — AI."

---

## [38:00–45:00] AI Chatbot + At-Risk Dashboard (7 min)

**Narrative:** "AI doesn't replace teachers — it gives them the information they need, faster."

**Steps (login as adam / Demo@2026 — student portal):**
1. Click the floating chat bubble (bottom right)
2. Type: "What is my attendance this semester?" → AI answers using real DB context
3. Type: "Which subjects am I weakest in?" → AI references grade data

**Switch to admin — At-Risk Dashboard:**
4. Click **At-Risk Students** in sidebar
5. Show Ahmad's card: risk score 82%, 3 risk flags (low attendance, declining grades, overdue fees)
6. Expand 8-week trend line → attendance dipping from 80% → 60%
7. "Any teacher or counsellor can see this and reach out immediately"

**Transition:** "Even when teachers are offline, the system works."

---

## [45:00–50:00] Mobile PWA — Offline + Push Notification (5 min)

> **Note:** This segment requires PWA-01 to be complete. If not done, describe the capability and show the mobile H5 interface instead, noting PWA is in the delivery roadmap.

**Steps (if PWA complete):**
1. Open mobile on phone/Chrome → show "Add to Home Screen" prompt
2. Toggle airplane mode → navigate to My Timetable → cached data still shows
3. Mark attendance while offline → "queued" indicator
4. Restore connection → data syncs, push notification arrives on device

**Steps (if PWA not complete — fallback):**
1. Show mobile H5 on tablet/browser
2. Navigate to attendance, grades, timetable pages
3. "Full PWA with offline caching and push notifications is in the next delivery phase"

---

## [50:00–55:00] Q&A + Wrap-Up (5 min)

**Key points to re-emphasise if asked:**
- All data is live from SQLite — no hardcoded numbers
- Role-based access control — teacher sees only their classes
- SMTP email notifications fire on all 6 business events
- i18n: English / Chinese / Bahasa Melayu switchable in Navbar
- Production path: PostgreSQL drop-in via Prisma, deploy on MOE server

**Demo accounts summary card (keep on screen):**

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Principal | principal | principal123 |
| HOD | hod01 | hod123 |
| Teacher | drsiti | Demo@2026 |
| Student (Ahmad) | student001 | student123 |
| Parent | fatimah | Demo@2026 |

---

## Timing Summary

| Segment | Start | End | Duration |
|---------|-------|-----|----------|
| Command Center Dashboard | 00:00 | 08:00 | 8 min |
| Ahmad's Story | 08:00 | 10:00 | 2 min |
| SIS Admission Wizard | 10:00 | 18:00 | 8 min |
| Teacher Mobile Attendance | 18:00 | 23:00 | 5 min |
| Grades — Record & View | 23:00 | 27:00 | 4 min |
| EMS — CPD + Evaluation | 27:00 | 33:00 | 6 min |
| SMS — Timetable + Calendar | 33:00 | 38:00 | 5 min |
| AI Chatbot + At-Risk | 38:00 | 45:00 | 7 min |
| Mobile PWA | 45:00 | 50:00 | 5 min |
| Q&A | 50:00 | 55:00 | 5 min |
| **Total** | | | **55 min** |
