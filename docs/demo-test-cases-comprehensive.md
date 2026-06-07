# MOE SERPS POC — Comprehensive Demo Test Cases

**Purpose:** Verify all demonstration scenarios, cascading effects, cross-module data synchronization, and inter-account consistency.  
**Pre-condition:** Fresh database seed (`cd backend && npm run db:reset`), all three servers running.  
**Date calibration:** All tests assume demo date = 2026-06-11 (seed auto-calibrates relative dates).

---

## TABLE OF CONTENTS

1. [TC-AUTH: Authentication & Role-Based Access](#tc-auth)
2. [TC-CMD: Command Center KPI Dashboard](#tc-cmd)
3. [TC-RISK: AI-Driven Risk Detection](#tc-risk)
4. [TC-REG: Public Registration Portal](#tc-reg)
5. [TC-ADM: Admissions Pipeline](#tc-adm)
6. [TC-SIS: Student Information System](#tc-sis)
7. [TC-ATT: Student Attendance & Cascading Effects](#tc-att)
8. [TC-GRD: Grades & Academic Standing Cascade](#tc-grd)
9. [TC-SATT: Staff Attendance & Anomaly Detection](#tc-satt)
10. [TC-LV: Leave Management Multi-Level Workflow](#tc-lv)
11. [TC-CPD: CPD Workshops & Compliance](#tc-cpd)
12. [TC-PERF: Performance Evaluations Workflow](#tc-perf)
13. [TC-RET: Retirement Planning](#tc-ret)
14. [TC-TT: Timetable & Conflict Detection](#tc-tt)
15. [TC-CAL: School Calendar & Facilities](#tc-cal)
16. [TC-PAR: Parent Portal & Cross-Account Visibility](#tc-par)
17. [TC-COUN: Counselor Portal & Auto-Case Creation](#tc-coun)
18. [TC-HOD: HOD Portal & Approvals Workflow](#tc-hod)
19. [TC-STU: Student Portal Read-Only Verification](#tc-stu)
20. [TC-FIN: Finance & Fees Cascade](#tc-fin)
21. [TC-NOTIF: Notifications & Auto-Triggers](#tc-notif)
22. [TC-SSE: Real-Time Updates (Server-Sent Events)](#tc-sse)
23. [TC-MULTI: Multi-School Data Isolation](#tc-multi)
24. [TC-PRIV: Private Education Oversight](#tc-priv)
25. [TC-SELF: Self-Service Portal](#tc-self)
26. [TC-SURV: Surveys](#tc-surv)
27. [TC-SEN: SEN / IEP Tracking](#tc-sen)
28. [TC-LIB: Library & Inventory](#tc-lib)
29. [TC-MOB: Mobile H5 Cross-Platform Consistency (15 cases)](#tc-mob)
30. [TC-I18N: Internationalization](#tc-i18n)
31. [TC-CASCADE: End-to-End Cascading Scenarios](#tc-cascade)

---

<a id="tc-auth"></a>
## 1. TC-AUTH: Authentication & Role-Based Access

### TC-AUTH-001: Valid Login — All Roles
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `admin / admin123` | Redirects to `/dashboard`, sidebar shows full admin navigation |
| 2 | Login as `principal / principal123` | Redirects to `/admin/command-center` |
| 3 | Login as `hod01 / hod123` | Redirects to `/hod/dashboard`, sidebar shows HOD Portal only |
| 4 | Login as `drsiti / Demo@2026` | Redirects to `/dashboard`, sidebar shows Teacher Portal + EMS + Attendance |
| 5 | Login as `student001 / student123` | Redirects to `/student/dashboard`, sidebar shows Student Portal only |
| 6 | Login as `parent.siti / Demo@2026` | Redirects to `/parent/children`, sidebar shows Parent Portal only |
| 7 | Login as `farah / Demo@2026` | Redirects to `/counselor/dashboard`, sidebar shows Counselor Portal |
| 8 | Login as `finance / finance123` | Redirects to `/finance/dashboard`, sidebar shows Finance Portal |
| 9 | Login as `sysadmin / sysadmin123` | Full admin access + All Schools page visible |

### TC-AUTH-002: Invalid Login
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login with `admin / wrongpassword` | Error toast displays "Login failed" |
| 2 | Login with `nonexistent / test` | Error toast displays "Login failed" |
| 3 | Leave fields blank, submit | Form validation errors shown inline |

### TC-AUTH-003: Role-Based Route Protection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As `student001`, navigate to `/ems/teachers` | Access denied or redirect to student dashboard |
| 2 | As `teacher`, navigate to `/admin/command-center` | Access denied — admin/principal only |
| 3 | As `parent`, navigate to `/sis/grades` | Access denied — not in parent role permissions |
| 4 | As unauthenticated user, navigate to `/register` | Page loads (public route, no auth) |
| 5 | As unauthenticated user, navigate to `/sis/students` | Redirect to login page |

### TC-AUTH-004: Demo Accounts Panel (Login Page)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open login page | Demo Accounts Panel visible on the right with all 17+ accounts |
| 2 | Click any row (e.g., Dr. Siti) | Username and password fields auto-fill (does NOT auto-login) |
| 3 | Click collapse button | Panel collapses; "Show Demo Accounts" button appears |
| 4 | Click "Show Demo Accounts" | Panel re-expands |

---

<a id="tc-cmd"></a>
## 2. TC-CMD: Command Center KPI Dashboard

### TC-CMD-001: Data Accuracy — All KPI Cards
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → Command Center | Page loads with 9 KPI cards, no loading spinners persisting |
| 2 | Verify Total Enrolment | Matches `SELECT COUNT(*) FROM Student WHERE enrollmentStatus='ENROLLED'` = 3456 |
| 3 | Verify Pending Applications | Matches count of AdmissionApplication WHERE status='SUBMITTED' |
| 4 | Verify Attendance Rate | Matches today's (present+late)/total from AttendanceRecord |
| 5 | Verify Active Staff | Matches teachers not on leave today |
| 6 | Verify CPD Above Target | Percentage of teachers with cpdHours >= cpdTarget |
| 7 | Verify Students At Risk | Matches RiskScore WHERE band IN ('HIGH_RISK', 'MONITOR') |
| 8 | Verify Timetable Health | 100% if no unresolved conflicts, <100% proportionally |
| 9 | Verify Facility Utilization | Percentage of slots booked vs total available |
| 10 | Verify Outstanding Fees | Count of FeeInvoice WHERE status != 'PAID' |

### TC-CMD-002: SSE Live Updates
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Center as admin | Green "● Live Updates" tag appears (SSE connected) |
| 2 | In another tab, mark a student absent (as teacher) | Attendance Rate card updates WITHOUT page refresh |
| 3 | In another tab, submit a new admission application | Pending Applications card increments |
| 4 | In another tab, record a new grade that triggers risk recalc | Students At Risk may update |

### TC-CMD-003: KPI Card Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Total Enrolment" card | Navigates to `/sis/students` |
| 2 | Click "Pending Applications" card | Navigates to `/sis/admissions` |
| 3 | Click "Students At Risk" card | Navigates to `/dashboard/at-risk` |
| 4 | Click "Active Staff" card | Navigates to `/ems/teachers` |
| 5 | Click "Outstanding Fees" card | Navigates to `/sis/fees` |

### TC-CMD-004: Threshold Alerts
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | If Attendance Rate < 85% | Card shows red/critical styling |
| 2 | If Attendance Rate 85-90% | Card shows amber/warning styling |
| 3 | If CPD Above Target < 60% | Card shows critical styling |

---

<a id="tc-risk"></a>
## 3. TC-RISK: AI-Driven Risk Detection

### TC-RISK-001: Risk Dashboard Data
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → At-Risk Dashboard | Table of flagged students loads |
| 2 | Verify Ahmad (student001) | Risk score = 82%, band = HIGH_RISK |
| 3 | Verify Ahmad's risk factors | Low attendance (~60%), declining grades, possibly overdue fees |
| 4 | Verify 8-week trend chart | Shows weekly attendance and score data points |
| 5 | Verify risk level badges | HIGH = red, MONITOR = amber, OK = green |

### TC-RISK-002: Risk Score Recalculation Cascade
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As teacher, record 3 consecutive absences for a MONITOR student | — |
| 2 | Trigger risk recalculation (auto or manual) | Student's risk score increases |
| 3 | Check At-Risk Dashboard | Student may move from MONITOR to HIGH_RISK |
| 4 | Check Command Center | "Students At Risk" count may increment |
| 5 | Check Counselor Portal (as farah) | If threshold breached, auto counselor case created |
| 6 | Check Parent Portal (as student's parent) | Risk warning visible on child's profile |

### TC-RISK-003: Cross-Role Visibility
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As admin → At-Risk page | All school's at-risk students visible |
| 2 | As hod01 → At-Risk page | Only students in HOD's department classes |
| 3 | As counselor (farah) → At-Risk page | All at-risk students visible (for case assignment) |
| 4 | As teacher (drsiti) → Dashboard | May see at-risk students from their form class |

---

<a id="tc-reg"></a>
## 4. TC-REG: Public Registration Portal

### TC-REG-001: Complete Registration Flow (No Auth)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/register` without login | Page loads — 5-step wizard visible |
| 2 | Step 1: Enter student name "Test Student", IC "01-123456", DOB = 2012-03-15 | Year level auto-calculates to ~Year 9 based on age |
| 3 | Step 2: Enter previous school, grades | Form accepts input |
| 4 | Step 3: Enter guardian info, phone "+673 8123456", email "test@email.com" | Phone auto-prefix +673, email validates format |
| 5 | Step 4: Upload birth certificate, IC, photo placeholders | Required docs listed, upload UI functional |
| 6 | Step 5: Review all info → Submit | Success result page with tracking number |
| 7 | Note the tracking number | Format like "REG-XXXXXX" |

### TC-REG-002: Registration → Admissions Pipeline Cascade
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | After TC-REG-001 submission | Application exists in database |
| 2 | Login as `admissions / Demo@2026` → Admissions page | New application appears in table with status "SUBMITTED" |
| 3 | Login as admin → Command Center | "Pending Applications" KPI incremented by 1 |
| 4 | Navigate to Registration Status page (public) with tracking number | Shows current status "Submitted" |

### TC-REG-003: Form Validation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Try to advance Step 1 with empty required fields | Inline validation errors appear |
| 2 | Enter invalid email in Step 3 | "Please enter a valid email" error |
| 3 | Try to submit without required documents in Step 4 | Blocked with validation message |

---

<a id="tc-adm"></a>
## 5. TC-ADM: Admissions Pipeline

### TC-ADM-001: Status Transition & Notifications
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admissions → open a SUBMITTED application | Application details modal/page opens |
| 2 | Change status to UNDER_REVIEW | Status updates, timestamp recorded |
| 3 | Check notification bell (admissions user) | Activity logged |
| 4 | Check public registration status page | Status shows "Under Review" |
| 5 | Change status to ACCEPTED | Status updates |
| 6 | Verify Command Center | "Pending Applications" decrements (no longer pending) |

### TC-ADM-002: Admission → Student Enrollment Cascade
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Accept an application and complete enrollment | New Student record created in database |
| 2 | Check SIS → Student Directory | New student appears in the list |
| 3 | Check Command Center | "Total Enrolment" KPI increments by 1 |
| 4 | Check class roster for assigned year level | New student appears in the class |

### TC-ADM-003: Role-Based Access to Admissions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As admissions officer | Full CRUD on applications |
| 2 | As admin | Full access |
| 3 | As teacher | No access to admissions page (not in sidebar) |
| 4 | As principal | Read access, can approve |

---

<a id="tc-sis"></a>
## 6. TC-SIS: Student Information System

### TC-SIS-001: Student Directory Filtering & Search
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → SIS → Students | Table with 3456 students (paginated) |
| 2 | Search "Ahmad" | Filters to show Ahmad Bin Abdullah |
| 3 | Filter by Year Level "Year 9" | Shows only Year 9 students |
| 4 | Filter by Academic Standing "ACADEMIC_WATCH" | Shows students on watch |

### TC-SIS-002: Student Detail — Cross-Module Aggregation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Ahmad's record | Detail page opens |
| 2 | Verify enrollment status | ENROLLED |
| 3 | Verify academic standing | ACADEMIC_WATCH |
| 4 | Verify risk score | 82% HIGH_RISK (from RiskScore table) |
| 5 | Verify attendance data | Matches AttendanceRecord for Ahmad |
| 6 | Verify courses & grades | Matches Grade records for Ahmad |
| 7 | Verify SEN/IEP info | Level 2 dyslexia IEP visible |
| 8 | Verify behavior records | Merits/demerits from Behavior table |

### TC-SIS-003: Announcements — Multi-Role Visibility
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As admin → SIS → Announcements | See all 5 announcements |
| 2 | Verify audience targeting | 2 for teachers, 2 for parents, 1 all-school |
| 3 | As teacher → check announcements | Only teacher-targeted + all-school visible |
| 4 | As student → Student Portal → Announcements | Only student/all-school announcements |
| 5 | As parent → Parent Portal → Communications → Announcements tab | Only parent-targeted + all-school |

### TC-SIS-004: Behavior & Discipline — Visibility Chain
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As admin → SIS → Behavior | All 6 behavior records visible |
| 2 | Record a new demerit for Ahmad (e.g., "Disrupted class") | Record created |
| 3 | As student (student001) → Student Portal → Merit & Conduct | New demerit appears |
| 4 | As parent (parent.siti) → Parent Portal → Conduct Record | New demerit visible under Ahmad |
| 5 | As counselor (farah) → Counselor Portal → Behavior Records | New record visible |

---

<a id="tc-att"></a>
## 7. TC-ATT: Student Attendance & Cascading Effects

### TC-ATT-001: Mark Attendance & Immediate Effects
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as teacher (drsiti) → SIS → Attendance | Class list with present/absent/late options |
| 2 | Mark student "Nadia" as ABSENT | Record saved |
| 3 | Verify AttendanceRecord table | New record: Nadia, today's date, status=ABSENT |
| 4 | Check Nadia's student profile → Attendance section | Absence reflected in stats |

### TC-ATT-002: Attendance → Risk Score Cascade
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mark Ahmad absent for 3rd consecutive day | Attendance record saved |
| 2 | Check At-Risk Dashboard (as admin) | Ahmad's attendance rate decreases in trend |
| 3 | If risk recalc triggers | Risk score may increase |
| 4 | Check Command Center → Attendance Rate | Slightly decreased |

### TC-ATT-003: Attendance → Auto-Trigger Cascade (NF-01: Student Absenteeism)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure a student has 3+ consecutive absences | Pre-condition met |
| 2 | Run auto-trigger (manually or wait for scheduled) | NF-01 STUDENT_ABSENCE fires |
| 3 | Check class teacher's notifications | Alert: "[Student] absent 3+ consecutive days" |
| 4 | Check parent's notifications | Alert sent to parent |
| 5 | Check Auto Triggers page → trigger log | New log entry: type=STUDENT_ABSENCE, status=SUCCESS |

### TC-ATT-004: Attendance → Command Center SSE
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Center in one tab (admin) | SSE connected |
| 2 | In another tab (teacher), mark several students absent | Records saved |
| 3 | Watch Command Center tab | Attendance Rate card updates in real-time without refresh |
| 4 | Attendance breakdown (present/late/absent) | Numbers shift accordingly |

### TC-ATT-005: Attendance → Parent Visibility
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mark Ahmad absent (as teacher) | Record saved |
| 2 | Login as parent.siti → Children | Ahmad's attendance % updated |
| 3 | Check attendance detail for Ahmad | Today's absence recorded |

---

<a id="tc-grd"></a>
## 8. TC-GRD: Grades & Academic Standing Cascade

### TC-GRD-001: Record Grade → Student Visibility
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as teacher (drsiti) → SIS → Grades | Select a course (e.g., PHYS701) |
| 2 | Create new grade item: "Pop Quiz", weight=0.1 | Grade item created |
| 3 | Enter score 45/100 for Ahmad | Grade saved |
| 4 | Login as student001 → Student Grades | "Pop Quiz" with score 45 appears |
| 5 | Verify weighted average recalculated | GPA/average reflects new score |

### TC-GRD-002: Grades → Academic Standing Cascade
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Record a very low score (e.g., 30/100, high weight) for a student currently GOOD_STANDING | Grade saved |
| 2 | System recalculates per-course weighted average | If worst course avg < threshold → standing changes |
| 3 | Check student profile → Academic Standing | May change to ACADEMIC_WATCH or PROBATION |
| 4 | Check At-Risk Dashboard | Student's risk factors update |
| 5 | Check Counselor Portal | If standing declined, auto CounselorCase created |

### TC-GRD-003: Grade Amendment Audit Trail
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit an existing grade (change Ahmad's score from 45 to 55) | Amendment saved |
| 2 | Check grade history/audit | Previous value logged with timestamp and editor identity |
| 3 | Verify student sees updated score | student001 → My Grades shows 55 |

### TC-GRD-004: Grades → Parent Visibility
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Record a new grade for Ahmad | Saved |
| 2 | Login as parent.siti → Children → Ahmad | Latest grades section updated |
| 3 | Grade details (course, item, score) | Match what teacher entered |

### TC-GRD-005: Grades → Auto-Trigger Cascade (NF-02: Grade Drop)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Record grades such that a student's average drops ≥20% vs previous period | Condition met |
| 2 | Run NF-02 GRADE_DROP trigger | Trigger fires |
| 3 | Check teacher notifications | "Grade drop alert for [Student]" |
| 4 | Check parent notifications | Alert sent |
| 5 | Check Auto Triggers log | Entry: type=GRADE_DROP, status=SUCCESS |

---

<a id="tc-satt"></a>
## 9. TC-SATT: Staff Attendance & Anomaly Detection

### TC-SATT-001: Teacher Check-In Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as drsiti → Attendance → Check In/Out | Check-in page loads with current time |
| 2 | Click "Check In" | Confirmation dialog appears |
| 3 | Confirm check-in | Success toast, check-in time displayed, button changes to "Check Out" |
| 4 | Check Staff Attendance Dashboard (as admin) | Dr. Siti shows as PRESENT today |

### TC-SATT-002: Late Detection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify StaffAttendanceConfig for the school (cutoff time, e.g., 07:30) | Config exists |
| 2 | If check-in time > cutoff | Status = LATE, lateMinutes calculated |
| 3 | Teacher's history page | LATE badge displayed with minutes |
| 4 | Staff Dashboard (admin) | Teacher appears in "Late Today" section |

### TC-SATT-003: Anomaly Detection → Notification Cascade
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify Mr. Ridwan has 6 late check-ins in 30 days | Pre-seeded |
| 2 | Verify Hassan has 3 consecutive unexplained absences | Pre-seeded |
| 3 | Run attendance anomaly trigger | Anomaly flags generated |
| 4 | Check principal's notifications | Anomaly alert: "Ridwan: frequent lateness", "Hassan: consecutive absences" |
| 5 | Check Staff Dashboard anomaly panel | Ridwan and Hassan flagged |

### TC-SATT-004: Staff Attendance → Command Center
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Center | "Active Staff" KPI shows count |
| 2 | Teacher checks in | Active Staff count may increment (if not already counted) |
| 3 | Verify leave status integration | Teachers on approved leave NOT counted as absent anomaly |

### TC-SATT-005: Weekend Detection (Brunei Calendar)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On Friday/Saturday (if testable) | Check-in page shows "No attendance required today" |
| 2 | Mobile H5 teacher portal on weekend | Check-in card shows weekend message |
| 3 | Staff Dashboard | No attendance expected for weekend days |

---

<a id="tc-lv"></a>
## 10. TC-LV: Leave Management Multi-Level Workflow

### TC-LV-001: Full Leave Application Lifecycle
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as teacher (drsiti) → EMS → Leave | Leave page loads |
| 2 | Click "New Application" → Annual Leave, next Mon-Tue | Modal/form opens |
| 3 | Fill reason, submit | Status = PENDING, notification sent to HOD |
| 4 | Login as hod01 → EMS → Leave (or Approvals Inbox) | See pending application from Dr. Siti |
| 5 | Approve with remarks: "Approved" | Status = HOD_APPROVED, notification to principal |
| 6 | Login as principal → Approvals or Leave page | See HOD-approved application |
| 7 | Final approve | Status = PRINCIPAL_APPROVED |
| 8 | Check Dr. Siti's leave balance | Deducted by working days |
| 9 | Check Leave Calendar (admin) | Dr. Siti's leave dates highlighted |

### TC-LV-002: Leave Rejection Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Teacher submits leave | Status = PENDING |
| 2 | HOD rejects with remarks | Status = REJECTED |
| 3 | Teacher receives notification | "Your leave application was rejected" |
| 4 | Leave balance | NOT deducted |

### TC-LV-003: Leave → Staff Availability Cascade
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify Faizal is on approved 5-day medical leave | Pre-seeded |
| 2 | Check Command Center → Active Staff | Faizal NOT counted as active |
| 3 | Check Staff Attendance Dashboard | Faizal shown as "On Leave" |
| 4 | Check Timetable → Faizal's slots | May show "Substitute needed" |
| 5 | Check Leave Calendar | Faizal's dates marked |

### TC-LV-004: Leave Cancellation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Teacher cancels a PENDING application | Status = CANCELLED with reason |
| 2 | Leave balance | Remains unchanged |
| 3 | HOD's pending list | Application removed |

### TC-LV-005: Working Days Calculation (Brunei)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Apply for leave spanning Fri-Sat (weekend) | Days requested excludes weekend days |
| 2 | Apply for leave including June 15 (Sultan's Birthday) | Days requested excludes public holiday |
| 3 | 1-week leave (Sun-Thu) | Days = 5 (not 7) |

### TC-LV-006: Leave → Substitute Suggestions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open leave application detail | Substitute suggestion section visible |
| 2 | System suggests teachers with free slots | Ranked by availability |
| 3 | Select a substitute | Substitute recorded on application |

---

<a id="tc-cpd"></a>
## 11. TC-CPD: CPD Workshops & Compliance

### TC-CPD-001: CPD Hours Tracking & KPI
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → EMS → CPD Workshops | Workshop list with teacher enrollment |
| 2 | Verify Dr. Siti: 25h (target 20h) | Above target — green indicator |
| 3 | Verify Ms. Aminah: 18h (target 20h) | Below target — amber indicator |
| 4 | Check Command Center → "CPD Above Target" | Percentage matches actual compliant teachers |

### TC-CPD-002: Workshop Completion → Hours Update
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enroll Aminah in a 3-hour workshop | Enrollment recorded |
| 2 | Mark workshop as completed for Aminah | CPD hours: 18 → 21 |
| 3 | Check Aminah's teacher profile | CPD hours updated |
| 4 | Check Command Center → CPD KPI | Percentage may increase |

### TC-CPD-003: CPD → Auto-Trigger (NF-04)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure a teacher is below CPD target near deadline | Condition met |
| 2 | Run NF-04 CPD_DEADLINE trigger | Notification sent to teacher |
| 3 | Check teacher's notifications | "CPD target reminder" alert |

---

<a id="tc-perf"></a>
## 12. TC-PERF: Performance Evaluations Workflow

### TC-PERF-001: Create & Submit Evaluation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as hod01 → EMS → Performance Evaluations | Existing evaluations listed |
| 2 | Click "New Evaluation" → select Dr. Siti | Form opens |
| 3 | Enter scores: Teaching=85, Professional=90, Conduct=88 | Form accepts |
| 4 | Save as Draft | Status = draft, appears in list |
| 5 | Open draft → Submit for Review | Status = submitted |
| 6 | Notification sent to Dr. Siti | "You have a new performance evaluation" |
| 7 | Notification sent to principal/managers | "Evaluation submitted for Dr. Siti" |

### TC-PERF-002: Evaluation Approval Chain
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as principal → EMS → Performance Evaluations | See submitted evaluation |
| 2 | Open → Review scores → Approve with comments | Status = approved |
| 3 | Check Dr. Siti's evaluation history | New approved evaluation visible with trend |
| 4 | Check evaluation trend indicator | "improving/declining/stable" based on scores over time |

### TC-PERF-003: Evaluation → Teacher Profile Integration
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as drsiti → EMS → My Profile | Can see own evaluations |
| 2 | Latest evaluation visible | Scores and rating shown |
| 3 | Performance history chart | Line chart of scores over academic years |

### TC-PERF-004: File Attachments
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | During evaluation, upload supporting document | File attached |
| 2 | View evaluation details | File downloadable |

---

<a id="tc-ret"></a>
## 13. TC-RET: Retirement Planning

### TC-RET-001: Retirement Eligibility Display
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → EMS → Retirement Management | Dashboard with eligible teachers |
| 2 | Verify Dr. Siti's application | Type: VOLUNTARY_EARLY, Status: UNDER_REVIEW |
| 3 | Eligibility based on age + years of service | Correctly calculated |

### TC-RET-002: Retirement Application → Workforce Planning
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Dr. Siti's retirement status = UNDER_REVIEW | Visible in retirement dashboard |
| 2 | Check principal's view | Can see upcoming retirement for succession planning |
| 3 | If approved | Status changes, teacher flagged for succession |

---

<a id="tc-tt"></a>
## 14. TC-TT: Timetable & Conflict Detection

### TC-TT-001: Timetable Display
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → SMS → Timetable | Weekly grid view loads |
| 2 | Filter by class (e.g., Year 7A) | Shows class-specific schedule |
| 3 | Filter by teacher (e.g., Dr. Siti) | Shows Dr. Siti's teaching slots |
| 4 | Filter by room | Shows room occupancy |

### TC-TT-002: Conflict Detection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to SMS → Conflict Detection | Conflicts page loads |
| 2 | Verify intentionally-seeded conflicts | 3 conflicts visible |
| 3 | Conflict shows: teacher double-booked, time, rooms | Details accurate |
| 4 | Substitute finder suggests available teachers | Rankings by free slots |

### TC-TT-003: Timetable → Command Center
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With 3 conflicts active | Timetable Health < 100% |
| 2 | If conflicts resolved | Timetable Health moves toward 100% |

---

<a id="tc-cal"></a>
## 15. TC-CAL: School Calendar & Facilities

### TC-CAL-001: Calendar Events
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → SMS → School Calendar | Calendar view with events |
| 2 | Verify June 10 = School Open Day | Event visible |
| 3 | Verify June 11 = Staff Briefing (Hall A) | Today's event highlighted |
| 4 | Verify June 15 = Sultan's Birthday | Holiday marked |
| 5 | Add new event: "Prize Giving", June 12 | Event appears on calendar |

### TC-CAL-002: Facility Booking & Conflict Prevention
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to SMS → School Resources | Facilities listed |
| 2 | Book Hall A for today 2pm-4pm | If not conflicting, booking confirmed |
| 3 | Try to book Hall A for same time | Conflict error — double-booking prevented |
| 4 | Notification sent on successful booking | Confirmation notification |
| 5 | Check Command Center → Facility Utilization | Percentage updates |

---

<a id="tc-par"></a>
## 16. TC-PAR: Parent Portal & Cross-Account Visibility

### TC-PAR-001: Children Overview — Data from Multiple Modules
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as parent.siti → Children | Two children: Ahmad + Hafiz visible |
| 2 | Ahmad's card shows | Attendance rate, latest grades, academic standing, risk status |
| 3 | Hafiz's card shows | PROBATION standing, autism IEP flag |
| 4 | Data matches admin view | Same numbers as SIS student profiles |

### TC-PAR-002: Fee Visibility & Consistency
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parent → Fee Invoices | Outstanding invoices for children visible |
| 2 | Ahmad has overdue fee | Same fee as shown in admin's SIS → Fees |
| 3 | Fee hold indicator | Active if fee overdue beyond threshold |

### TC-PAR-003: Parent-Teacher Messaging
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parent → Communications → Messages tab | Thread list with teachers |
| 2 | Open a thread | Message bubbles (left=received, right=sent) |
| 3 | Send a new message: "Hi, how is Ahmad doing?" | Message saved |
| 4 | Login as teacher (drsiti) → Teacher Portal → Messages | New message appears in thread |
| 5 | Teacher replies: "He needs more support" | Reply saved |
| 6 | Switch back to parent | Teacher's reply visible in real-time (or on refresh) |
| 7 | Unread count badge | Updates when new messages arrive |

### TC-PAR-004: Consent Forms — E-Signature Workflow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin creates a consent form (e.g., field trip) targeting parents | Form created |
| 2 | Parent → Communications → Consent tab | New consent form visible |
| 3 | Parent signs/acknowledges | Status changes to SIGNED |
| 4 | Admin → SMS → Consent Forms | Parent's signature recorded |

### TC-PAR-005: Parent → Homework Visibility
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Teacher assigns homework | Assignment created |
| 2 | Parent → Homework | Child's pending homework visible |
| 3 | Student → Assignments | Same homework visible |

### TC-PAR-006: Contact Directory → Message Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parent → School Contacts | Teachers and staff listed |
| 2 | Click "Message" on a teacher | Navigates to Communications → Messages with thread open |

---

<a id="tc-coun"></a>
## 17. TC-COUN: Counselor Portal & Auto-Case Creation

### TC-COUN-001: Dashboard Stats from Live Data
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as farah → Counselor Dashboard | Stats cards + pie chart load |
| 2 | Verify open cases count | Matches CounselorCase WHERE status='OPEN' |
| 3 | Verify in-progress count | Matches CounselorCase WHERE status='IN_PROGRESS' |
| 4 | Verify risk band distribution | Pie chart matches RiskScore bands for case students |
| 5 | Active cases list | Shows student name, reason, status, date |

### TC-COUN-002: Auto-Case Creation from Academic Standing Decline
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify Ahmad has auto-created case | Reason = "AUTO_STANDING_DECLINE" |
| 2 | Case linked to Ahmad's standing change | GOOD → ACADEMIC_WATCH triggers case |
| 3 | No duplicate case if standing already declined | Only one open case per student per reason |
| 4 | If another student's standing declines | New case auto-created for them |

### TC-COUN-003: Case Lifecycle → Cross-Module Updates
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Counselor opens Ahmad's case → status IN_PROGRESS | Updated |
| 2 | Log a session note | Session recorded with date/notes |
| 3 | Close/Resolve case | Status = CLOSED/RESOLVED |
| 4 | Dashboard counts update | Open count decreases, resolved increases |
| 5 | Student profile (admin view) | Case history visible |

### TC-COUN-004: Counselor Access to SEN / IEP
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Counselor → SEN / IEP | List of SEN students visible |
| 2 | Ahmad: Level 2 dyslexia | Goals, accommodations, sessions |
| 3 | Hafiz: Level 3 autism | IEP details visible |
| 4 | Data matches admin's SEN view | Same records |

---

<a id="tc-hod"></a>
## 18. TC-HOD: HOD Portal & Approvals Workflow

### TC-HOD-001: HOD Dashboard — Department Scope
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as hod01 → HOD Dashboard | Department-level metrics |
| 2 | Only Science & Maths teachers shown | Data scoped to HOD's department |
| 3 | Teacher workload, leave status, CPD | All within department |
| 4 | At-risk students | Only from department's classes |

### TC-HOD-002: Approvals Inbox — Multi-Type Workflow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Approvals Inbox | Pending items from multiple types |
| 2 | Leave application pending | Can approve/reject |
| 3 | Self-service request pending | Can approve/reject |
| 4 | Approve a leave application | Status = HOD_APPROVED, routes to principal |
| 5 | Check teacher's notification | "Leave approved by HOD" |
| 6 | Check principal's approvals | Item now in principal's queue |

### TC-HOD-003: HOD → EMS Integration
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | HOD → Teachers (from sidebar) | Same data as admin's EMS → Teachers, but scoped |
| 2 | HOD → Performance Evaluations | Can create/submit for department teachers |
| 3 | HOD → CPD Workshops | Department teachers' progress visible |
| 4 | HOD → Leave Calendar | Department leave overview |

---

<a id="tc-stu"></a>
## 19. TC-STU: Student Portal Read-Only Verification

### TC-STU-001: Student Dashboard Data Consistency
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as student001 (Ahmad) → Dashboard | Overview loads |
| 2 | Courses listed | Match enrollments in admin's SIS |
| 3 | Grades shown | Match what teachers recorded |
| 4 | Attendance percentage | Matches attendance records |
| 5 | Upcoming assignments | Match teacher-created assignments |

### TC-STU-002: Read-Only — No Modification Allowed
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Student → Grades page | View only, no edit buttons |
| 2 | Student → Attendance | View only |
| 3 | Student → Behavior | View only (cannot add merits/demerits) |
| 4 | No admin/EMS/SMS routes accessible | Sidebar only shows Student Portal |

### TC-STU-003: Student Sees Real-Time Updates
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Teacher records a new grade for Ahmad | — |
| 2 | Ahmad refreshes Student → Grades | New grade appears |
| 3 | Teacher posts an announcement | — |
| 4 | Ahmad → Announcements | New announcement visible |
| 5 | Teacher assigns homework | — |
| 6 | Ahmad → Assignments | New assignment visible |

### TC-STU-004: Report Card
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Student → Report Card | Formatted report card view |
| 2 | Grades per course | Derived from Grade records |
| 3 | Attendance summary | From AttendanceRecord |
| 4 | Behavior summary | From Behavior records |

---

<a id="tc-fin"></a>
## 20. TC-FIN: Finance & Fees Cascade

### TC-FIN-001: Fee Invoices — Admin View vs Parent View
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as finance → SIS → Fee Invoices | All invoices for school |
| 2 | Filter by status: OVERDUE | Shows overdue invoices including Adam's |
| 3 | Login as parent.siti → Fees | Only sees invoices for own children |
| 4 | Amount and status match between views | Same data |

### TC-FIN-002: Fee → Student Hold Cascade
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify Adam has overdue fee | Pre-seeded |
| 2 | Verify fee hold is active for Adam | FeeHold record exists |
| 3 | Check Command Center → Outstanding Fees | Includes Adam's invoice |
| 4 | Check student profile (admin) | Fee hold indicator visible |
| 5 | Check student portal (adam) | May see "fee hold" warning |

### TC-FIN-003: Fee → Auto-Trigger (NF-05: Fee Overdue)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure overdue fee exists at 30+ days | Pre-seeded |
| 2 | Run NF-05 FEE_OVERDUE trigger | Notification sent |
| 3 | Check parent's notifications | "Fee payment overdue" reminder |
| 4 | If 90+ days, admin also notified | Escalation |

### TC-FIN-004: Finance Dashboard
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as finance → Finance Dashboard | Summary metrics |
| 2 | Total revenue, outstanding, overdue amounts | Calculated from FeeInvoice |
| 3 | Matches what admin sees in Command Center fees card | Consistent |

---

<a id="tc-notif"></a>
## 21. TC-NOTIF: Notifications & Auto-Triggers

### TC-NOTIF-001: Notification Bell — Cross-Action Verification
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as any user → check bell icon | Shows unread count |
| 2 | Click bell | Dropdown with recent notifications |
| 3 | Notifications match actions taken against this user | Titles and messages appropriate |
| 4 | Click a notification | Marks as read, navigates to relevant page |

### TC-NOTIF-002: All 7 Auto-Triggers — Execution & Logging
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → SMS → Auto Triggers | 7 trigger cards displayed |
| 2 | NF-01 STUDENT_ABSENCE | Last run time, sent count, affected count visible |
| 3 | NF-02 GRADE_DROP | Same structure |
| 4 | NF-03 FEE_OVERDUE | Same |
| 5 | NF-04 CPD_DEADLINE | Same |
| 6 | NF-05 EXAM_REGISTRATION | Same |
| 7 | NF-06 LOW_STOCK | Same — 5 items below threshold |
| 8 | NF-07 MAINTENANCE_DUE | Same |
| 9 | Click "Run Now" on any trigger | Trigger executes, log updates |
| 10 | Verify trigger log table | Shows all historical runs with timestamps |

### TC-NOTIF-003: Notification Recipients — Role-Appropriate
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | When leave is approved | Teacher gets notification (not admin) |
| 2 | When student absent 3+ days | Class teacher + parent get notification |
| 3 | When fee overdue | Parent gets notification, not student |
| 4 | When low stock | Admin/manager gets notification |
| 5 | When evaluation submitted | Teacher + principal get notification |

---

<a id="tc-sse"></a>
## 22. TC-SSE: Real-Time Updates (Server-Sent Events)

### TC-SSE-001: Connection Establishment
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Center | "● Live Updates" green tag appears |
| 2 | Check Network tab | EventSource connection to `/api/v1/events/stream` active |
| 3 | Token passed as query param | JWT token in URL |

### TC-SSE-002: Real-Time Widget Updates (No Refresh)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Command Center in Tab A | Baseline KPIs noted |
| 2 | Tab B: Submit a new admission application | — |
| 3 | Tab A: Watch "Pending Applications" | Increments without page refresh |
| 4 | Tab B: Mark students absent | — |
| 5 | Tab A: Watch "Attendance Rate" | Decreases without refresh |
| 6 | Tab B: Record grade that triggers risk recalc | — |
| 7 | Tab A: Watch "Students At Risk" | May update |
| 8 | Tab B: Complete a fee payment | — |
| 9 | Tab A: Watch "Outstanding Fees" | Decrements |

### TC-SSE-003: SSE Topics Coverage
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger enrolment change | `dashboard.enrolment.changed` event |
| 2 | Trigger application status change | `dashboard.applications.changed` event |
| 3 | Trigger attendance record | `dashboard.attendance.changed` event |
| 4 | Trigger staff status change | `dashboard.staff.changed` event |
| 5 | Trigger CPD hours change | `dashboard.cpd.changed` event |
| 6 | Trigger risk recalc | `dashboard.risk.changed` event |
| 7 | Trigger timetable change | `dashboard.timetable.changed` event |
| 8 | Trigger facility booking | `dashboard.facility.changed` event |
| 9 | Trigger fee status change | `dashboard.fees.changed` event |

---

<a id="tc-multi"></a>
## 23. TC-MULTI: Multi-School Data Isolation

### TC-MULTI-001: School Scoping — No Cross-School Data Leakage
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `admin` (SMHK school) → Students | Only SMHK students visible |
| 2 | Login as `admin.srpb` (Primary school) → Students | Only SRPB students visible |
| 3 | Login as `admin.smab` (MORA school) → Students | Only SMAB students visible |
| 4 | Login as `admin.isb` (International school) → Students | Only ISB students visible |
| 5 | API call: `GET /students` with SMHK token | Response contains only SMHK student data |
| 6 | API call: `GET /teachers` with SRPB token | Response contains only SRPB teachers |

### TC-MULTI-002: System Admin — Cross-School View
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `sysadmin / sysadmin123` | Full admin access |
| 2 | Navigate to All Schools | 4 schools listed: SMHK, SRPB, SMAB, ISB |
| 3 | Can view data across schools | School picker or aggregated view |

### TC-MULTI-003: School-Specific Configuration
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Each school has its own StaffAttendanceConfig | Different start/cutoff times possible |
| 2 | Working day calculations per school context | Brunei calendar applied uniformly |

---

<a id="tc-priv"></a>
## 24. TC-PRIV: Private Education Oversight

### TC-PRIV-001: DPE Dashboard
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → Private Education → Oversight Dashboard | Dashboard loads |
| 2 | Private school metrics visible | Enrolment, compliance status |
| 3 | "Send Circular" button available | Click opens modal |

### TC-PRIV-002: Send Circular → School Notification
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Send Circular" | Modal with fields: number, title, body, date, scope |
| 2 | Set scope: ALL_PRIVATE | Targets all private schools |
| 3 | Submit circular | Created, targeting calculated (e.g., 5 schools) |
| 4 | Private school admin receives notification | Circular notification in their inbox |

---

<a id="tc-self"></a>
## 25. TC-SELF: Self-Service Portal

### TC-SELF-001: Request Types & Workflow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as teacher → EMS → Self-Service Portal | 5 request types available |
| 2 | Submit TRANSFER request | Status = PENDING |
| 3 | Submit TRAINING request | Status = PENDING |
| 4 | Submit DOCUMENT request (employment letter) | Status = PENDING |
| 5 | Check Approvals Inbox (admin/manager) | Requests appear |
| 6 | Approve document request | Status = APPROVED, teacher notified |

### TC-SELF-002: Self-Service → Notifications Chain
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Teacher submits request | Admin/manager notified |
| 2 | Request approved | Teacher notified |
| 3 | Request rejected | Teacher notified with remarks |

---

<a id="tc-surv"></a>
## 26. TC-SURV: Surveys

### TC-SURV-001: Survey Lifecycle
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → EMS → Staff Surveys | 3 surveys: ACTIVE, CLOSED, DRAFT |
| 2 | Verify ACTIVE survey has 7 responses | Count accurate |
| 3 | Login as teacher → Surveys | Can respond to ACTIVE survey |
| 4 | Submit response | Response count increments |
| 5 | Anonymous survey | No responderId stored |

### TC-SURV-002: Survey Results — Admin vs Teacher
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin views survey results | Aggregated analytics visible |
| 2 | Teacher views survey results (if published) | Only sees published results, not individual responses |
| 3 | Anonymous responses | Cannot identify who submitted what |

---

<a id="tc-sen"></a>
## 27. TC-SEN: SEN / IEP Tracking

### TC-SEN-001: SEN Student List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → SIS → SEN / IEP | List of SEN students |
| 2 | Ahmad: Level 2 dyslexia | IEP details visible |
| 3 | Hafiz: Level 3 autism | IEP details visible |
| 4 | IEP goals listed | Specific, measurable goals |
| 5 | Intervention sessions logged | Dates, providers, progress |

### TC-SEN-002: SEN → Counselor Integration
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Counselor (farah) → SEN / IEP | Same students visible |
| 2 | Can link SEN data to counselor cases | Cross-reference works |
| 3 | Admin SEN view = Counselor SEN view | Data consistent |

### TC-SEN-003: SEN → Student Profile Integration
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View Ahmad's student profile (admin) | SEN/IEP section shows Level 2 dyslexia |
| 2 | View Hafiz's student profile | SEN/IEP section shows Level 3 autism |
| 3 | Parent viewing child's profile | SEN status visible if applicable |

---

<a id="tc-lib"></a>
## 28. TC-LIB: Library & Inventory

### TC-LIB-001: Library Management
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as admin → SMS → Library | 20 books listed |
| 2 | Verify loans | 5 active loans |
| 3 | Verify holds | 3 hold reservations |
| 4 | Overdue loans flagged | Visual indicator |

### TC-LIB-002: Inventory & Low Stock Trigger
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to SMS → Inventory | 12 stock items listed |
| 2 | Filter: below minimum quantity | 5 items shown |
| 3 | Run NF-06 LOW_STOCK trigger | Notification to admin/manager |
| 4 | Check notifications | "Low stock alert: [item name]" |

---

<a id="tc-mob"></a>
## 29. [TC-MOB: Mobile H5 Cross-Platform Consistency](#tc-mob)

### TC-MOB-001: Teacher Mobile — Data Matches PC
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as drsiti on PC → view timetable | Note classes |
| 2 | Login as drsiti on Mobile → Classes tab | Same timetable data |
| 3 | PC: Record a grade | Grade saved |
| 4 | Mobile: View grades | Same grade appears |
| 5 | Mobile: Check in | Check-in recorded |
| 6 | PC: Staff Attendance Dashboard | Dr. Siti shows checked in |

### TC-MOB-002: Parent Mobile — Messages Sync
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parent sends message on Mobile | Message saved |
| 2 | Teacher views on PC → Messages | Same message appears |
| 3 | Teacher replies on PC | Reply saved |
| 4 | Parent refreshes Mobile → Messages | Reply visible |

### TC-MOB-003: Mobile Announcements = PC Announcements
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin creates announcement on PC | Saved |
| 2 | Student Mobile → Announcements | New announcement appears |
| 3 | Teacher Mobile → Announcements | Same announcement if targeted |
| 4 | Pinned and URGENT styling | Consistent on both platforms |

### TC-MOB-004: Teacher Attendance History (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `teacher01` on Mobile | Redirects to `/teacher/home` |
| 2 | Navigate to `/teacher/attendance/history` | Page loads with "Attendance History" title |
| 3 | Verify month navigator | Shows current month (e.g. "June 2026") with `<` / `>` buttons |
| 4 | Click `<` to go to previous month | Month label updates, records refresh |
| 5 | Click `>` to go to next month | Month label updates; disabled if current month is last available |
| 6 | Verify stats summary cards | Present Days, Absent Days, Late Days, Leave Days — match PC Staff Attendance data |
| 7 | Pull down to refresh | Skeleton loading shown briefly, then data refreshes |
| 8 | Empty state (no records for month) | Shows "No attendance records for this month" message |
| 9 | Cross-check with PC | Same teacher's attendance history on PC matches Mobile data |

### TC-MOB-005: Student Behavior Records (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `student001` on Mobile | Redirects to `/student/home` |
| 2 | Navigate to `/student/behavior` | Page loads with "Behavior" title |
| 3 | Verify filter tabs | "All", "Merits", "Demerits" tabs visible with counts in parentheses |
| 4 | Tap "Merits" tab | Filters to show only merit (+) records |
| 5 | Tap "Demerits" tab | Filters to show only demerit (-) records |
| 6 | Tap "All" tab | Shows all behavior records mixed |
| 7 | Verify stat summary cards | Total Points, Merits count, Demerits count displayed at top |
| 8 | Each record shows | Date, category/reason, points change (+N or -N), teacher name |
| 9 | Pull-to-refresh | Works correctly with skeleton loading state |
| 10 | Empty state | "No behavior records" with icon when no data exists |
| 11 | i18n check | Switch to 中文/Malay — all labels translated correctly |

### TC-MOB-006: Student Report Card (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `student001` on Mobile | Redirects to `/student/home` |
| 2 | Navigate to `/student/report-card` | Page loads with "Report Card" title |
| 3 | Verify semester selector | Dropdown shows terms (e.g. "2026-S1", "2026-S2", "2025-S1", "2025-S2") |
| 4 | Select different semester | Course list and grades update for selected term |
| 5 | Verify GPA card | Overall GPA displayed prominently; changes per term selection |
| 6 | Each course row shows | Subject name, grade letter (A/B/C/D/F), numeric score, credits |
| 7 | Print button | "Print Report Card" button visible and tappable |
| 8 | Empty state | "No report card data available" when no grades for term |
| 9 | Pull-to-refresh | Works correctly |
| 10 | Cross-check PC | Same student's report card on PC matches Mobile data exactly |

### TC-MOB-007: Parent Homework View (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `parent01` on Mobile | Redirects to `/parent/home` |
| 2 | Navigate to `/parent/homework` | Page loads with "Homework" title |
| 3 | Verify filter tabs | "All", "Pending", "Overdue" tabs with counts |
| 4 | "Pending" tab | Shows homework not yet due/completed |
| 5 | "Overdue" tab | Shows past-due items with overdue badge/styling |
| 6 | Each homework card shows | Subject, assignment title, due date, status tag (Pending/Submitted/Overdue) |
| 7 | Overdue items highlighted | Red/orange accent for overdue status |
| 8 | Empty state | "No homework assigned" when no assignments exist |
| 9 | Pull-to-refresh | Works correctly |
| 10 | Cross-check PC | Parent portal homework on PC shows same assignments |

### TC-MOB-008: Parent Behavior Records (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `parent01` on Mobile | Navigate to `/parent/behavior` |
| 2 | Page loads | Title "Behavior" visible |
| 3 | Filter tabs | "All", "Merits", "Demerits" with counts |
| 4 | Stat summary | Total Points, Merits, Demerits cards at top |
| 5 | Each record | Child's name, date, reason, points, teacher who recorded it |
| 6 | Data scope | Only shows records for parent's linked children (not all students) |
| 7 | Empty state | Friendly message when no records |
| 8 | i18n | All text switches correctly on language change |

### TC-MOB-009: Parent Meetings Management (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `parent01` on Mobile | Navigate to `/parent/meetings` |
| 2 | Page loads | "Meetings" title visible |
| 3 | Upcoming meetings tab/list | Shows scheduled future meetings with date, time, teacher, purpose |
| 4 | Past meetings | Historical meetings visible (completed/cancelled status) |
| 5 | Status indicators | Confirmed/Pending/Cancelled/Completed badges on each meeting |
| 6 | Book new meeting | "Schedule Meeting" or "+" button opens booking dialog/form |
| 7 | Booking form fields | Teacher select, preferred date/time slot, purpose textarea |
| 8 | Submit booking | Toast success message, meeting appears in upcoming list |
| 9 | Cancel meeting | Option to cancel a pending meeting with confirmation dialog |
| 10 | Empty states | Separate messages for "no upcoming" vs "no past meetings" |

### TC-MOB-010: Parent Consent Forms (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `parent01` on Mobile | Navigate to `/parent/consent-forms` |
| 2 | Page loads | "Consent Forms" title visible |
| 3 | Filter tabs | "Pending Acknowledgment" and "All" tabs with counts |
| 4 | Pending tab default | Opens showing forms requiring action first |
| 5 | Each consent card | Form type (e.g. Field Trip, Photo Consent), description, due date, status |
| 6 | Overdue indicator | Forms past due date show red "Overdue" badge |
| 7 | Expand/collapse tap | Tapping a card expands to show full details + acknowledge button |
| 8 | Acknowledge action | Tap confirm → confirmation dialog → success toast → form moves to acknowledged |
| 9 | All tab | Shows both pending and acknowledged forms together |
| 10 | Acknowledged forms | Show green checkmark, cannot be acknowledged again |
| 11 | Empty state | "No consent forms" when none exist |

### TC-MOB-011: Parent Contact Directory (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `parent01` on Mobile | Navigate to `/parent/contact-directory` |
| 2 | Page loads | "Contact Directory" title visible |
| 3 | Collapsible sections | Grouped by role: Principals, Administrators, Counselors, Teachers, Class Teachers |
| 4 | Expand a section | Tapping section header expands to show contact list |
| 5 | Collapse a section | Tapping again collapses the list |
| 6 | Each contact entry | Name, role/title, email address |
| 7 | Email link | Tapping email opens mailto: link in device email app |
| 8 | Class Teacher entry | Shows which child the class teacher is assigned to (e.g. "Ms. Aminah (Class 7A)") |
| 9 | Empty state | "No contacts available" when directory is empty |
| 10 | Pull-to-refresh | Refreshes directory data |

### TC-MOB-012: Parent Communication History (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `parent01` on Mobile | Navigate to `/parent/comm-history` |
| 2 | Page loads | "Communication History" title visible |
| 3 | Event type filter tabs | "All Events", "Messages", "Announcements", "Consents", "Meetings" with counts |
| 4 | Tab switching works | Each tab filters to its event type correctly |
| 5 | Timeline view | Events grouped by date with date headers (e.g. "07 Jun 2026") |
| 6 | Relative timestamps | Events show relative time ("2h ago", "3d ago", "Just now") |
| 7 | Event card content | Type icon/color, event title, summary text, timestamp |
| 8 | Different icons per type | Message=blue, Announcement=purple, Consent=green, Meeting=amber |
| 9 | Chronological order | Most recent events appear first within each date group |
| 10 | Empty state | "No communication events" message |
| 11 | i18n verification | Tab labels must be translated (NOT raw keys like `parent.messages`) |

### TC-MOB-013: Parent Application / Registration (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as `parent01` on Mobile | Navigate to `/parent/apply` |
| 2 | Page loads | "Application" title, "New Application" FAB/button visible |
| 3 | Application list | Shows previously submitted applications with status badges |
| 4 | Status types | Submitted (blue), Under Review (orange), Approved (green), Rejected (red) |
| 5 | Each application card | Application ID/reference, child name, submission date, status, type |
| 6 | Tap "New Application" | Dialog/modal opens with application form |
| 7 | Form fields | Child information (name, DOB), guardian info, contact details, document upload area |
| 8 | Form validation | Required field validation on submit; inline error messages |
| 9 | Submit application | Success toast → application appears in list with "Submitted" status |
| 10 | Cancel form | Closes dialog without saving |
| 11 | Empty state | "No applications found" + prompt to create new one |

### TC-MOB-014: Mobile UI/UX Cross-Cutting Checks
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Bottom tab bar navigation | Role-specific tabs visible (Teacher: Home/Classes/Grades/Announcements/Attendance; Student: Home/Courses/Grades/Announcements/Profile; Parent: My Children/Grades/Attendance/Announcements/Messages) |
| 2 | Pull-to-refresh | All list pages support pull-down refresh with loading skeleton |
| 3 | AppLayout consistency | All pages share same header (back arrow + title + logout), bottom padding for tab bar |
| 4 | Loading states | Skeleton placeholders shown during API fetch, no blank screens |
| 5 | Empty states | Every list page has friendly empty-state message with icon |
| 6 | No horizontal scroll | Content fits mobile viewport (390px); no x-axis overflow |
| 7 | Touch targets | Buttons and interactive elements ≥ 44px touch area |
| 8 | AI Assistant FAB | Floating button visible on all pages; opens chat panel |
| 9 | Back navigation | Header back button navigates to role home page |
| 10 | Dark mode / theme | CSS variables respect theme settings if configured |

### TC-MOB-015: Mobile Authentication & Session
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Mobile login page | Username + password fields, Sign In button, language switcher (EN/中/MS) |
| 2 | SSO buttons | Brunei Digital ID and EGNC/IDPM buttons visible |
| 3 | Demo Accounts panel | Expandable panel showing quick-fill accounts |
| 4 | Valid login (any role) | Redirects to correct role home page; token stored |
| 5 | Invalid credentials | Error toast "Login failed" |
| 6 | Token expiry / session loss | Redirected to login page; no data leaked |
| 7 | Logout | Clears session, redirects to login page |
| 8 | Route protection | Accessing authenticated route without token → redirect to login |
| 9 | Auto-redirect post-login | Each role lands on correct home page (teacher→/teacher/home, student→/student/home, parent→/parent/home) |

---

<a id="tc-i18n"></a>
## 30. TC-I18N: Internationalization

### TC-I18N-001: Language Switching
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open any page in English (default) | All text in English |
| 2 | Switch to Chinese (中文) via navbar selector | All labels, buttons, messages switch to Chinese |
| 3 | Switch to Bahasa Melayu | All text switches to Malay |
| 4 | Navigate between pages | Language persists |
| 5 | Refresh browser | Language setting preserved |

### TC-I18N-002: No Hardcoded Strings
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Switch to Chinese | Check all pages — no English text remains (except proper nouns/names) |
| 2 | Switch to Malay | Same check — no English labels |
| 3 | Error messages | Translated correctly |
| 4 | Form validation messages | Translated |

---

<a id="tc-cascade"></a>
## 31. TC-CASCADE: End-to-End Cascading Scenarios

These are the highest-value test cases — they trace a single action through the entire system to verify all downstream effects.

### TC-CASCADE-001: "Ahmad's Spiral" — Absence → Grade Drop → Risk → Counselor → Parent Alert

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | Teacher (drsiti) | Mark Ahmad absent (3rd consecutive day) | AttendanceRecord created |
| 2 | System | Attendance rate recalculated | Ahmad's weekly attendance % drops |
| 3 | System | Risk score recalculates | Score increases (e.g., 82 → 85) |
| 4 | System | NF-01 trigger fires (3 consecutive absences) | Notification to drsiti + parent.siti |
| 5 | Admin | Check Command Center → Attendance Rate | Slightly decreased |
| 6 | Admin | Check At-Risk Dashboard | Ahmad's updated data shown |
| 7 | Counselor (farah) | Check Counselor Dashboard | Ahmad's case shows updated info |
| 8 | Parent (parent.siti) | Check Children → Ahmad | Attendance drop visible |
| 9 | Parent (parent.siti) | Check Notifications | "Ahmad absent 3+ consecutive days" |
| 10 | Student (student001) | Check Dashboard | Attendance percentage updated |

### TC-CASCADE-002: "Grade Collapse" — New Low Score → Standing Change → Case Creation → Multi-Account Visibility

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | Teacher (drsiti) | Record very low grade (30/100, weight 0.4) for student with GOOD_STANDING | Grade saved |
| 2 | System | Per-course weighted average recalculated | Worst course avg drops below threshold |
| 3 | System | Academic standing updated | GOOD_STANDING → ACADEMIC_WATCH (or PROBATION) |
| 4 | System | Auto CounselorCase created | Reason: AUTO_STANDING_DECLINE, Status: OPEN |
| 5 | System | Risk score recalculated | Risk band may change (e.g., OK → MONITOR) |
| 6 | System | NF-02 Grade Drop trigger | If ≥20% drop → notification fires |
| 7 | Admin | Command Center → Students At Risk | Count may increment |
| 8 | Admin | SIS → Student Profile | Standing shows ACADEMIC_WATCH |
| 9 | Counselor (farah) | Dashboard → Active Cases | New case appears |
| 10 | Parent | Children → child's profile | Standing change visible, grade shown |
| 11 | Student | Student Portal → Grades | New low grade visible |
| 12 | HOD (hod01) | At-Risk page | Student now flagged if in department |

### TC-CASCADE-003: "Leave Ripple" — Teacher Leave → Multi-Level Approval → Availability → Timetable → Sub Finder

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | Teacher (drsiti) | Submit 3-day annual leave application | Status = PENDING |
| 2 | System | Notification to HOD | hod01 notified |
| 3 | HOD (hod01) | Approve in Approvals Inbox | Status = HOD_APPROVED |
| 4 | System | Notification to principal | principal notified |
| 5 | Principal | Approve | Status = PRINCIPAL_APPROVED |
| 6 | System | Leave balance deducted | Dr. Siti's balance decreases |
| 7 | System | Working days calculation | Fri/Sat excluded, holidays excluded |
| 8 | Admin | Leave Calendar | Dr. Siti's dates highlighted |
| 9 | Admin | Command Center → Active Staff | Count decreases during leave period |
| 10 | Admin | Staff Attendance Dashboard | Dr. Siti marked "On Leave" for those days |
| 11 | System | Substitute suggestion | For Dr. Siti's timetable slots during leave |
| 12 | Admin | Leave Reports | Leave recorded in analytics |

### TC-CASCADE-004: "New Student Journey" — Registration → Admission → Enrollment → Class → Full System Presence

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | Public (no auth) | Complete registration form → submit | Application created |
| 2 | System | Tracking number generated | Queryable on status page |
| 3 | Admissions | Open application in Admissions page | Visible in table |
| 4 | Admin | Command Center → Pending Applications | Incremented |
| 5 | Admissions | Change status: SUBMITTED → UNDER_REVIEW → ACCEPTED | Status transitions logged |
| 6 | Admissions | Complete enrollment process | Student record created |
| 7 | Admin | Command Center → Total Enrolment | Incremented |
| 8 | Admin | SIS → Students | New student in directory |
| 9 | Admin | SIS → Attendance | New student in class roster |
| 10 | Teacher | Attendance page | New student appears in class list |
| 11 | New student login | Student Portal | Profile, courses, empty grades |
| 12 | System | Risk score initialized | Default LOW_RISK |

### TC-CASCADE-005: "Fee Payment Lifecycle" — Invoice → Overdue → Parent Alert → Fee Hold → Payment → Hold Release

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | Finance | Create fee invoice for a student | Invoice status = PENDING |
| 2 | Parent | Parent → Fees | New invoice visible |
| 3 | System | After 30 days (simulated) | Status = OVERDUE |
| 4 | System | NF-05 trigger fires | Parent notification: "Fee overdue" |
| 5 | Admin | Command Center → Outstanding Fees | Includes this invoice |
| 6 | System | After threshold | Fee hold activated |
| 7 | Student | Student Portal | Fee hold warning visible |
| 8 | Admin | Student Profile | Fee hold indicator |
| 9 | Finance | Record payment | Invoice status = PAID |
| 10 | System | Fee hold released | Hold removed |
| 11 | Admin | Command Center → Outstanding Fees | Decremented |
| 12 | Student | Fee hold warning removed | Portal returns to normal |
| 13 | Parent | Fees page | Invoice shows PAID |

### TC-CASCADE-006: "Performance Review Chain" — Evaluation → History → CPD Link → Teacher Profile

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | HOD (hod01) | Create new performance evaluation for Aminah: Teaching=75, Professional=80, Conduct=85 | Draft saved |
| 2 | HOD | Submit evaluation | Status = submitted, notification to Aminah + managers |
| 3 | Principal | Open evaluation → Approve with comment "Good progress" | Status = approved |
| 4 | System | Notification to Aminah | "Your evaluation has been approved" |
| 5 | Teacher (Aminah) | EMS → My Profile → Evaluations | Latest approved evaluation visible |
| 6 | Admin | EMS → Performance Evaluations list | All evaluations across school |
| 7 | Admin | Aminah's Teacher Detail Page | Overall rating derived from scores |
| 8 | System | Trend calculation | Compares with previous years → improving/declining/stable |
| 9 | HOD | EMS → Teaching Workload | Aminah's performance context visible |

### TC-CASCADE-007: "Stock Alert Chain" — Low Inventory → Trigger → Notification → Dashboard

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | Admin | SMS → Inventory → reduce item quantity below minQuantity | Stock updated |
| 2 | System | NF-06 LOW_STOCK trigger fires | Notification generated |
| 3 | Admin/Manager | Check notifications | "Low stock: [item name]" |
| 4 | Admin | Auto Triggers page → trigger log | New entry: LOW_STOCK, SUCCESS |
| 5 | Admin | Inventory page | Item highlighted as below minimum |

### TC-CASCADE-008: "Parent Communication Round-Trip" — Message → Notification → Reply → Consent → Meeting

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | Parent (parent.siti) | Communications → Messages → Send to Dr. Siti: "Can we discuss Ahmad?" | Message saved |
| 2 | Teacher (drsiti) | Teacher Portal → Messages | New unread message visible |
| 3 | Teacher (drsiti) | Reply: "Yes, let's schedule a meeting" | Reply saved |
| 4 | Parent | Communications → Messages | Reply visible, unread badge cleared |
| 5 | Admin | Create consent form: "Parent-Teacher Meeting Consent" | Form created |
| 6 | Parent | Communications → Consent | New form visible |
| 7 | Parent | Sign consent form | Status = SIGNED |
| 8 | Admin | SMS → Consent Forms | Signature recorded |
| 9 | System | Meeting scheduled | Appears in Parent → Meetings tab |

### TC-CASCADE-009: "Anomaly → Intervention" — Staff Lateness → Anomaly Flag → Principal Alert → Formal Review

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | Pre-condition | Ridwan has 6 late check-ins in 30 days | Seeded |
| 2 | System | Anomaly detection runs | Ridwan flagged |
| 3 | Principal | Gets notification | "Attendance anomaly: Ridwan — frequent lateness" |
| 4 | Admin | Staff Attendance Dashboard → Anomalies | Ridwan in anomaly list |
| 5 | HOD (hod01) | Can see in department view | Ridwan's lateness pattern visible |
| 6 | HOD | Creates performance evaluation noting concern | Evaluation references attendance |
| 7 | Admin | Teacher Detail → Ridwan | Attendance record + evaluation both visible |

### TC-CASCADE-010: "Multi-School Isolation Stress Test"

| Step | Actor | Action | Cascading Verification |
|------|-------|--------|----------------------|
| 1 | Admin (SMHK) | Create announcement: "SMHK Sports Day" | Created for SMHK |
| 2 | Admin (SRPB) | Login → check announcements | SMHK announcement NOT visible |
| 3 | Admin (SMHK) | Record grade for SMHK student | Grade saved |
| 4 | Admin (ISB) | Check grades | SMHK grades NOT visible |
| 5 | Teacher at SMHK | Check students | Only SMHK students |
| 6 | Teacher at SMHK | Cannot access SRPB student data via API | schoolFilter blocks |
| 7 | Sysadmin | Can see all schools aggregated | Cross-school view works |

---

## APPENDIX A: Data Consistency Verification Queries

These SQL queries can be run against `backend/prisma/dev.db` to verify data integrity after test execution:

```sql
-- Verify risk scores match student standings
SELECT s.studentId, s.academicStanding, r.band, r.score
FROM Student s LEFT JOIN RiskScore r ON s.id = r.studentId
WHERE s.enrollmentStatus = 'ENROLLED';

-- Verify leave balance = initial - approved days
SELECT t.staffId, t.annualLeaveBalance,
  (SELECT SUM(daysRequested) FROM LeaveApplication la WHERE la.teacherId = t.id AND la.status = 'PRINCIPAL_APPROVED' AND la.leaveType = 'ANNUAL')
FROM Teacher t;

-- Verify counselor cases exist for standing declines
SELECT cc.id, u.displayName, cc.openedReason, s.academicStanding
FROM CounselorCase cc
JOIN Student st ON cc.studentId = st.id
JOIN User u ON st.userId = u.id
JOIN Student s ON s.id = st.id
WHERE cc.openedReason = 'AUTO_STANDING_DECLINE';

-- Verify school isolation
SELECT schoolId, COUNT(*) as studentCount FROM User WHERE role = 'student' GROUP BY schoolId;

-- Verify notification trigger logs
SELECT triggerType, COUNT(*) as runs, MAX(ranAt) as lastRun FROM NotificationTriggerLog GROUP BY triggerType;
```

---

## APPENDIX B: Cross-Reference Matrix

This matrix shows which test case groups verify connections between modules:

| Source Module | Affected Module(s) | Test Case(s) |
|---------------|--------------------|-----------:|
| Attendance (Student) | Risk Score, Command Center, Parent Portal, Auto-Triggers, Counselor | TC-ATT-002, TC-ATT-003, TC-CASCADE-001 |
| Grades | Academic Standing, Risk Score, Counselor Cases, Parent Portal, Student Portal | TC-GRD-002, TC-CASCADE-002 |
| Leave Management | Staff Availability, Command Center, Timetable, Leave Calendar, Approvals | TC-LV-003, TC-CASCADE-003 |
| Admissions/Registration | Student Enrollment, Command Center, Class Rosters | TC-ADM-002, TC-CASCADE-004 |
| Fee Invoices | Parent Portal, Fee Holds, Command Center, Auto-Triggers, Student Portal | TC-FIN-002, TC-CASCADE-005 |
| Performance Evaluations | Teacher Profile, Notifications, Approval Chain | TC-PERF-002, TC-CASCADE-006 |
| Inventory | Auto-Triggers, Notifications, Dashboard | TC-LIB-002, TC-CASCADE-007 |
| Parent Messages | Teacher Portal, Notifications, Unread Counts | TC-PAR-003, TC-CASCADE-008 |
| Staff Attendance | Anomaly Detection, Notifications, Command Center, HOD Portal | TC-SATT-003, TC-CASCADE-009 |
| School Scoping | All modules — data isolation | TC-MULTI-001, TC-CASCADE-010 |
| CPD Hours | Command Center KPI, Auto-Triggers, Teacher Profile | TC-CPD-002, TC-CPD-003 |
| Academic Standing | Counselor Auto-Case, Risk Score, Parent Visibility | TC-GRD-002, TC-COUN-002 |
| Announcements | Student Portal, Parent Portal, Teacher Portal, Mobile | TC-SIS-003, TC-MOB-003 |
| SSE Events | Command Center real-time updates | TC-SSE-002, TC-CMD-002 |

---

## APPENDIX C: Test Execution Order (Recommended)

For demo day rehearsal, execute in this order to build upon cascading data:

1. **TC-AUTH** — Verify all accounts work
2. **TC-CMD** — Baseline KPIs noted
3. **TC-REG → TC-ADM** — Create new application, process through pipeline
4. **TC-SIS** — Verify student data
5. **TC-ATT** — Mark attendance, verify cascades
6. **TC-GRD** — Record grades, verify standing cascade
7. **TC-CASCADE-001** — Full Ahmad spiral
8. **TC-CASCADE-002** — Grade collapse scenario
9. **TC-SATT** — Staff check-in
10. **TC-LV** — Leave workflow
11. **TC-CASCADE-003** — Leave ripple
12. **TC-PERF** — Performance evaluation
13. **TC-CPD** — CPD compliance
14. **TC-PAR** — Parent portal checks (data should now be rich)
15. **TC-COUN** — Counselor cases (auto-created by now)
16. **TC-STU** — Student sees all accumulated data
17. **TC-NOTIF** — Verify all notifications generated through prior tests
18. **TC-SSE** — Real-time verification
19. **TC-MULTI** — School isolation
20. **TC-I18N** — Language switching
21. **TC-MOB** — Mobile consistency with PC

---

*Total test cases: 31 groups, 180+ individual verification steps*  
*Estimated manual execution time: 3–4 hours (full suite)*  
*Recommended pre-demo check: TC-CASCADE-001 through TC-CASCADE-005 (45 min)*
