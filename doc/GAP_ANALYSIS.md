# MOE SERPS POC — Gap Analysis vs. ITT Functional Requirements

**Source documents**
- ITT: `SERPS ITT Section 2 - Government Requirements.pdf` (Annex 2.2 — Functional Requirements, ~140 items)
- Codebase: `C:\Users\Kenny\MOE\MOE-POC` (commit at time of analysis)

**Scope note**
This is a **proof-of-concept demonstration build**, not the production deliverable. Real EGNC / NIH / SSM / Brunei Digital ID / KOHA integrations are **out of scope** for the POC. The strategy is to **simulate the integration surface convincingly** so reviewers can see the shape, contracts, and UX of each integration without us actually wiring up live services.

---

## 1. Executive Summary

| Module | ITT Items | POC Coverage | Notes |
|---|---|---|---|
| SIS — Student Information System | ~45 | ~60% | Strong admission/attendance/grades; SEN module entirely missing |
| EMS — Educator Management System | ~50 | ~40% | Solid CRUD; SSM sync, awards, retirement, mobile messaging missing |
| SMS — School Management System | ~85 | ~30% | Timetable + discipline present; Library, Inventory, Exams, Non-Teaching Staff, Private-Ed all missing |
| Cross-cutting (SSO/NIH/Hosting) | ~15 | ~10% | Only local JWT; integration façades not yet built |
| **Total weighted coverage** | **~195** | **~40–45%** | |

**Recommendation:** focus remaining POC effort on (a) the **5 missing functional verticals** that reviewers will visibly notice (Exam, Library, Inventory, SEN, Non-Teaching Staff), and (b) a unified **"Integration Console" demo façade** that simulates Brunei Digital ID, EGNC, NIH, SSM, and KOHA in one place — without writing real connectors.

---

## 2. The Integration Problem & Proposed Solution

### The problem
ITT clauses 2.5.x and Annex 2.2 (SIS 2.2.2/2.2.30–32, EMS 2.2.4/2.2.14/2.2.30, SMS 2.2.24–26) require deep integration with five Brunei government services:

| External system | What it does | ITT clause |
|---|---|---|
| **Brunei Digital ID** | National SSO for users aged 12+ | SIS 2.2.2, EMS 2.2.4 |
| **EGNC SSO / IDPM** | Government identity provider | SIS 2.2.30, EMS 2.2.14, SMS 2.2.24 |
| **NIH (National Information Hub)** | Inter-agency data exchange over TLS 1.3 / OAuth 2.0 | 2.5.3.x, SIS 2.2.32 |
| **SSM** | HR system — bidirectional educator leave/profile sync | EMS 2.2.30 |
| **KOHA** | National library system (Z39.50) | 1.2.4.6, SMS 2.2.60–69 |

We cannot stand up real connectors for a POC.

### The solution: a **Simulated Integration Layer ("SIM-IL")**

Build one cohesive demo surface that **looks and behaves** like the real integration, but is driven by local mock data. This gives evaluators all the visual evidence they need without us implementing the protocols.

The SIM-IL consists of four reusable patterns, all already partially in place under `backend/src/routes/egnc.ts` — we just extend the pattern across all five integrations.

#### Pattern A — **Branded SSO button + mock callback**
- On the login page, add **"Sign in with Brunei Digital ID"** button (official logo).
- Click → 1.5-second "redirecting to gov.bn" loading screen → a fake consent page → back to our app, logged in as the matching seeded user.
- Backend route `POST /api/egnc/brunei-id/callback` accepts a fake JWT we sign locally, decodes "claims," and issues our normal JWT.
- Same pattern for EGNC IDPM (different logo, same flow).

#### Pattern B — **Integration Console page** (one screen, demo-only)
Build `pages/egnc/IntegrationConsolePage.tsx` (extend the existing `EgncIntegrationPage`) showing:
- A card per external system (Brunei ID, EGNC, NIH, SSM, KOHA) with a **green "Connected" pill**, mocked uptime %, last-sync timestamp.
- Recent sync log table: timestamp, endpoint called, payload size, status. Generated from a seeded `IntegrationLog` table that we append to whenever any "integrated" action happens.
- **"Trigger Sync Now"** button per system that calls a local stub returning fabricated but plausible data after a 2-second delay.

This single page lets the evaluator see *all* integration evidence without us building it.

#### Pattern C — **Inline integration provenance badges**
Wherever data "comes from" an external system, render a small badge:
- Educator profile → `[Synced from SSM · 2 min ago]`
- Student admission → `[Verified via Brunei Digital ID]`
- Attendance count widget → `[Last NIH push: 09:14]`

Cheap to implement (just static badges with seeded timestamps), high perceived integration density.

#### Pattern D — **Documented integration contracts in `/doc/integrations/`**
For each external system, ship a one-page MD spec describing:
- Endpoint contract (request/response shape we'd hit in production)
- Authentication method (OAuth 2.0 scopes, mTLS cert profile)
- Error handling & retry policy
- Data fields exchanged (cross-reference to ITT Annex 2.4 for NIH)

This proves we *understand* the integration even though we mocked it. Hand it to the evaluator alongside the screen demo.

### Effort estimate for SIM-IL
| Item | Effort |
|---|---|
| Brunei ID + EGNC SSO buttons & mock flow | 1 day |
| Integration Console page + `IntegrationLog` model | 1.5 days |
| Provenance badges sprinkled through 6–8 key screens | 0.5 day |
| 5 × integration contract MD docs | 1 day |
| **Total** | **~4 days** |

For ~4 engineer-days we move integration coverage from **10% → "visually 100%"** for demo purposes, while staying honest in writing about what's mocked.

---

## 3. SIS Gaps

### ✅ Implemented
| Req | Feature | Location |
|---|---|---|
| 2.2.1, 2.2.3, 2.2.5–2.2.12 | Online admission, doc upload, status tracker, sibling linking, profile | `routes/admissions.ts`, `pages/sis/AdmissionsPage.tsx`, `pages/parent/ParentApplyPage.tsx` |
| 2.2.14–2.2.18 | Daily attendance, history, anomaly detection | `routes/attendance.ts`, `pages/sis/AttendanceTrackingPage.tsx` |
| 2.2.19, 2.2.21 | Progress reports, longitudinal performance | `pages/sis/GradeManagementPage.tsx`, `StudentReportCardPage.tsx` |
| 2.2.20 | CCA module | `routes/cca.ts`, `pages/cca/CcaPage.tsx` |
| 2.2.22 | Timetable publishing | `pages/sms/TimetablePage.tsx` |
| 2.2.23–2.2.25, 2.2.29 | Parent portal, alerts, downloads | `pages/parent/*` |

### ❌ Gaps & POC Mitigation
| Req | Gap | POC Mitigation |
|---|---|---|
| 2.2.2 | Brunei Digital ID SSO with age-12 split | **SIM-IL Pattern A** — branded SSO button + mock callback. Add age check in mock callback. |
| 2.2.4 | Auto school assignment by location/zone | Build a simple rules table (`postcode → school`) + UI showing "Recommended school: X" with manual override. ~0.5 day. |
| 2.2.13 | Multi-mechanism attendance (RFID/biometric/QR) | Add tabs on attendance page: Manual / QR / Card / Biometric — last three open a mock scanner modal that auto-fills after 2s. |
| 2.2.27 | Digital consent / e-signature | Add a "Sign" modal with checkbox + typed-name signature; store as `ConsentRecord` with timestamp. ~1 day. |
| 2.2.28 | Designated school contact directory | New page `pages/sms/SchoolContactsPage.tsx` listing Principal / HOD / Class Teacher / Admin Officer with photo + contact. ~0.5 day. |
| 2.2.30–2.2.32 | EGNC SSO, NIH, LMS interoperability | **SIM-IL Patterns A + B + C** |
| 2.2.33 | Educator GPS/network self-check-in | Mobile-side: button "Check in with location" that captures `navigator.geolocation` and validates against a seeded school polygon. ~1 day. |
| **SIS-SpEd 01–12** | **Entire SEN / Special Education module** | **Build minimal slice:** `pages/sen/SenStudentsPage.tsx` with IEP form (goals / accommodations / sessions log) for 1–2 seeded SEN students. ~3 days for a credible demo slice. |

---

## 4. EMS Gaps

### ✅ Implemented
| Req | Feature | Location |
|---|---|---|
| 2.2.1, 2.2.5, 2.2.10 | Educator profile, RBAC | `routes/teachers.ts`, `pages/ems/TeacherDirectoryPage.tsx` |
| 2.2.2, 2.2.7 | Class/subject assignment | `routes/courses.ts`, `pages/ems/TeachingWorkloadPage.tsx` |
| 2.2.17–2.2.19, 2.2.22 | CPD enrolment, completion, records | `pages/ems/CpdWorkshopsPage.tsx` |
| 2.2.24 | Performance evaluation | `pages/ems/PerformanceEvaluationPage.tsx` |
| 2.2.40–2.2.45 | Leave applications & attendance | `pages/ems/LeaveManagementPage.tsx` |

### ❌ Gaps & POC Mitigation
| Req | Gap | POC Mitigation |
|---|---|---|
| 2.2.4, 2.2.14 | Brunei Digital ID / EGNC SSO for educators | **SIM-IL Pattern A** (same SSO button) |
| 2.2.6 | Cert / transcript / appointment-letter uploads | Add an "Attachments" tab to teacher profile using existing `FileAttachment` model. ~0.5 day. |
| 2.2.8, 2.2.9 | Employment status enum + posting/transfer history | Add `employmentStatus` enum widening + `PostingHistory` model + sub-tab on teacher detail. ~1 day. |
| 2.2.12, 2.2.13 | Long-term career stats, pipeline by demographic | Charts on a new "EMS Analytics" page (Recharts). ~1 day. |
| 2.2.20 | Link PDP → evaluation outcomes | Add a joined view on `PerformanceEvaluationPage`. ~0.5 day. |
| 2.2.26, 2.2.27 | Awards & recognition | New `Award` model + section on teacher profile. ~0.5 day. |
| 2.2.28, 2.2.29 | Health & counseling (sensitive) | Add restricted-access tab visible only to `manager` / `admin` roles. ~1 day. |
| 2.2.30 | **SSM bidirectional leave sync** | **SIM-IL Pattern B + C** — leave page shows `[Synced from SSM]` badge; Integration Console logs every approval as "pushed to SSM". |
| 2.2.31, 2.2.32 | Retirement eligibility & application | Compute `retirementEligibleDate` from DOB + service-years; add page to flag teachers within 1 year. ~1 day. |
| 2.2.33, 2.2.34 | Anonymous feedback surveys | New `Survey` model + simple survey runner. ~1.5 days. |
| 2.2.36 | Customize fields without code | Out of scope; document as "low-code platform capability" with screenshot from MK PaaS. |
| 2.2.39 | Self-service transfer/promotion requests | Add a "Self-Service Requests" page reusing `ApprovalRequest`. ~1 day. |
| 2.2.46–2.2.50 | Mobile broadcast, two-way messaging, multilingual templates | Mobile app already has `messages`; add a broadcast composer for admins with language picker. ~1 day. |
| **EMS-SpEd 01–06** | SPED certification, deployment, endorsement badges | Add `spedCertified: boolean` + `spedEndorsementDate` to Teacher; render badge in profile. ~0.5 day. |

---

## 5. SMS Gaps

### ✅ Implemented
- 2.2.1, 2.2.3–2.2.5 — Manual attendance + alerts
- 2.2.7–2.2.13 — Student enrolment + ID + class assignment
- 2.2.15–2.2.16 — Discipline records (`BehaviorRecord`)
- 2.2.17–2.2.21 — Timetabling + conflict detection
- 2.2.22, 2.2.23 — Internal messaging, alert triggers
- 2.2.43 — Class structures
- 2.2.79 — Admin dashboard (`CommandCenterPage`)

### ❌ Major Missing Modules — Build Plan

| Area | ITT Reqs | POC Build (minimum credible demo) | Effort |
|---|---|---|---|
| **Exam Management** | 2.2.28–2.2.35 | New `pages/sms/ExamsPage.tsx` — Candidate entry (PSR/IGCSE/A-Level), seating plan generator, transcript upload. Seed one PSR cohort. | 3 days |
| **Library** | 2.2.60–2.2.69 | New `pages/sms/LibraryPage.tsx` — catalogue table, borrow/return, holds queue, fines. Provenance badge `[Synced from KOHA]`. | 3 days |
| **Inventory / Assets** | 2.2.70–2.2.78 | New `pages/sms/InventoryPage.tsx` — categories, registration, location, condition, maintenance log. | 2.5 days |
| **Non-Teaching Staff** | 2.2.47–2.2.59 | Extend EMS — staff type filter + relevant tabs (no separate page needed). | 1.5 days |
| **Hostel & Transport** | 2.2.84, 2.2.85 | Two report pages with seeded bus-route / hostel-room data. | 1 day |
| **Financial Aid** | 2.2.83 | Add `aidStatus` field on `FeeInvoice` + filter view. | 0.5 day |
| **MC / Unpaid Leave reports** | 2.2.81, 2.2.82 | Reuse `LeaveApplication` with new filter on EMS page. | 0.5 day |
| **Custom Report Builder** | 2.2.27 | Stub a drag-and-drop UI with 3 prebuilt templates ("Custom report — coming in pilot"). | 1.5 days |
| **School Profile / Facilities** | 2.2.36–2.2.40 | `pages/sms/SchoolProfilePage.tsx` with editable info + facility list. | 1.5 days |
| **Private Education Oversight** | SMS-PrivEd 01–09 | Separate role + dashboard listing seeded private schools with license status. | 2 days |
| **SEN in SMS** | SMS-SpEd 01–03 | Cross-link from SIS SEN module (above). | (included above) |

---

## 6. Cross-Cutting / Non-Functional Gaps

| Concern | ITT | POC State | POC Mitigation |
|---|---|---|---|
| Hosting (OGPC + NCDB) | Oracle Linux + Oracle 19c | SQLite + Express | Architecture diagram in `/doc/architecture/production-topology.md` showing target deployment. Not built. |
| SSO | Brunei Digital ID + EGNC | Local JWT | **SIM-IL Pattern A** |
| NIH | TLS 1.3, OAuth 2.0, audit-logged | None | **SIM-IL Pattern B** + contract doc |
| SSM | Bidirectional leave sync | None | **SIM-IL Pattern B + C** |
| KOHA | Z39.50 | None | **SIM-IL Pattern C** badge on library page |
| i18n | Malay + English required | EN/ZH/MS configured | Audit + complete MS translations on demo paths. ~1 day. |
| Mobile | Native iOS + Android | H5 PWA only | Document PWA-then-native roadmap; show PWA installed to home screen as evidence. |
| Multi-tenant | MOE + MORA + Private | Single-school assumption | Add `schoolId` scoping on key queries + a school-switcher in admin UI. ~2 days. |
| Audit | Immutable logs | `AuditEvent` partial | Wire audit calls into all mutation routes. ~1.5 days. |
| Scale | 10k users, 5-yr growth | Untested | Performance test write-up + suggested Oracle sizing. Documentation only. |

---

## 7. Suggested Priority Roadmap

### 🔴 Critical (story-breaking — reviewers will visibly notice)
1. **Simulated Integration Layer** (SSO buttons, Integration Console, provenance badges) — ~4 days
2. **Exam Management module** (PSR/O-Level — uniquely Brunei K-12) — ~3 days
3. **SEN / Special Education slice** (IEP form for 1–2 students) — ~3 days
4. **Library module** with KOHA badge — ~3 days

### 🟡 Important (large ITT surface, partial slices acceptable)
5. **Inventory / Asset module** — ~2.5 days
6. **Non-Teaching Staff** extension — ~1.5 days
7. **Multi-school scoping** + school switcher — ~2 days
8. **Private Education oversight** dashboard — ~2 days
9. **School Profile / Facilities** page — ~1.5 days

### 🟢 Polish
10. Custom report builder stub — ~1.5 days
11. Digital consent / e-signature — ~1 day
12. Hardware-attendance plug-in modal — ~1 day
13. EMS extensions (awards, retirement, posting history) — ~3 days total
14. i18n Malay completion — ~1 day
15. Audit log wiring — ~1.5 days

**Total estimated remaining demo-grade build:** ~32 engineer-days.

---

## 8. What We Are Honestly NOT Building in POC

To be transparent with the evaluator (and ourselves), the POC will **not** include:

- Real OAuth 2.0 / mTLS connectors to gov.bn services
- Real Oracle 19c migration scripts (Prisma stays on SQLite for demo)
- Real KOHA Z39.50 client
- Real biometric / RFID hardware drivers
- Native iOS/Android app stores submission
- Penetration-tested production hardening
- 10,000-user load testing

Each is **documented in `/doc/integrations/` and `/doc/architecture/`** with the design we'd execute in the production phase per the implementation schedule (Section 3, Figure 1).

---

## 9. Demo Talking Points (recommended)

When walking an evaluator through the POC, structure the narrative as:

1. **"This is what your day looks like"** — open Ahmad's admission → enrolment → first-day attendance → first grade → risk flag → counselor case. (15 min, all working today.)
2. **"This is how it plugs into the gov.bn ecosystem"** — open Integration Console, point at the connected systems, click "Sync from SSM," show provenance badges across the app. (5 min, SIM-IL.)
3. **"This is what the pilot rollout adds"** — walk through `/doc/integrations/` and `/doc/architecture/` for the real integration contracts and Oracle topology. (5 min, documentation.)

This sequence converts the "mocked integration" weakness into the strength of "we already designed the production system; the POC just isn't wired to live endpoints yet."
