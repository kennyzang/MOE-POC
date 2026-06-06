# Stage Coverage Design — Fixing Education Level Gaps

**Document type:** High-level design  
**Status:** Ready for implementation  
**Context:** The ITT (§1.2.4.2) explicitly requires coverage of **primary and secondary schools** under MOE, MORA, and Private authorities. The current system covers lower and upper secondary well, but has meaningful gaps in primary and MORA grade-level support across the UI.

---

## 1. What the ITT Requires vs. What We Must Deliver

| Education Stage | Year Levels | ITT Scope | Required Authority Coverage |
|---|---|---|---|
| Primary | Year 1–6 | ✅ **Explicitly required** | MOE primary + MORA religious primary + Private primary |
| Lower Secondary | Year 7–9 | ✅ **Explicitly required** | MOE + MORA (Tingkatan 1–3) + Private |
| Upper Secondary | Year 10–11 | ✅ **Explicitly required** | MOE + MORA (Tingkatan 4–5) + Private |
| Year 12 | Year 12 | ✅ **In scope** (data is seeded; exam module covers it) | MOE + Private international |
| Pre-University / 6th Form (Year 13+) | Year 13 | ❌ **Not in ITT scope** | Out of scope for this tender |

The system must treat a Year 1 student at SRPB (MOE primary) and a Tingkatan 3 student at SMAB (MORA religious secondary) with the same fluency it currently shows for Year 7–11 students at SMHK. That is the gap.

---

## 2. Root Cause — Why the Gap Exists

The system was developed primarily around one demo school (SMHK, a MOE secondary school with Year 7–11). As a result, many screens have grade-level choices **hardcoded to the secondary range** — they don't look up what the logged-in user's school actually offers.

The infrastructure to fix this is already in the system: a `useSchoolConfig` hook returns the current school's grade levels dynamically at login. The fix is to connect every affected screen to that hook, rather than each screen maintaining its own static list.

This is not a bug in logic — it is a **configuration consistency gap**. The design principle is: **a screen should never know its own grade levels; it should always ask the school what it offers.**

---

## 3. The Design Principle: School-Aware Grade Levels

### Current state (problematic)

```
Each screen maintains its own hardcoded list:
  Screen A → ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11']
  Screen B → ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12']
  Screen C → ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11']
```

When a primary school admin (SRPB) logs in, they see secondary-only dropdowns. When a MORA school admin (SMAB) logs in, they see Year 7–12 instead of Tingkatan 1–5.

### Target state (correct)

```
One source of truth — the school's own configuration:
  School config → ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11']  (SMHK)
  School config → ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6']  (SRPB)
  School config → ['Tingkatan 1', 'Tingkatan 2', 'Tingkatan 3', 'Tingkatan 4', 'Tingkatan 5']  (SMAB)

Every screen reads from this single source.
```

When the school changes (multi-school admin switches context), every screen updates automatically.

---

## 4. Affected Screens and Required Changes

### 4.1 Screens That Need Dynamic Grade Levels (from School Config)

These screens currently hardcode a secondary-range list. Each should instead read from the school's configured grade levels.

| Screen | Current Range | Why It Matters |
|---|---|---|
| **Student Directory** | Year 1–11 (missing Year 12) | Cannot filter to Year 12 students; MORA Tingkatan levels missing |
| **Attendance Tracking** | No grade filter present | Primary and MORA teachers cannot select their class level |
| **Grade Management** | Secondary-only | Primary teachers cannot enter grades by year level |
| **Behavior & Discipline** | Year 7–12 only | Primary students' behavioral records inaccessible by grade filter |
| **Announcements** | Year 7–12 only | Cannot target Year 1–6 or Tingkatan announcements |
| **Timetable** | Year 7–11 only | Primary and Year 12 classes cannot be timetabled |
| **Course Management** | Year 7–12 only | Primary courses cannot be created |
| **At-Risk Dashboard** | Year 7–11 only | Primary at-risk students are invisible to the filter |

### 4.2 Screens That Already Handle It Correctly

These screens already cover the full range and serve as the model:

| Screen | Coverage | Why It Works |
|---|---|---|
| **Exam Management** | Year 1–13 | Explicitly lists all levels; correct for PSR (Year 6), IGCSE (Year 10–11), A-Level (Year 12–13) |
| **Registration Portal** | Year 1–12 | Covers full admission range |
| **School Profile** | Dynamic (reads school config) | Correctly school-aware |

---

## 5. Special Case: MORA Schools (Tingkatan System)

MORA schools use **Tingkatan** (Form) instead of Year as their grade nomenclature. The system already stores this correctly in the database (SMAB students have `gradeLevel = "Tingkatan 3"` etc.), but most UI filters don't display Tingkatan as valid options because they are hardcoded to "Year X" formats.

### Design decision

Rather than maintaining two separate label systems, the system should treat Tingkatan labels as **native grade level values** — they are simply what SMAB's school configuration returns when asked "what are your grade levels?" There is no translation needed; Tingkatan 1 is not "Year 7" in the UI — it is displayed as "Tingkatan 1" because that is what the school calls it.

This means a MORA school principal logging in will see "Tingkatan 1" through "Tingkatan 5" in every dropdown, exactly as they would expect, without any special-case code.

---

## 6. Special Case: Year 12 in MOE/Private Schools

Year 12 exists in the database (576 students seeded at SMHK, ISB covers Grade 12) and is in scope per the ITT. It is missing from several filter dropdowns for an inconsistency reason: the SMHK school configuration currently lists only Year 7–11. 

### Design decision

Update the SMHK school configuration to include Year 12, and ensure any ISB equivalent uses Grade 12. Since all dropdowns read from school config (once the fix above is applied), this single data change propagates everywhere automatically — no further UI changes needed for Year 12.

---

## 7. Primary School Functional Considerations

When a primary school admin (e.g., SRPB) logs in, they should experience the same functional richness as a secondary school admin, just with their own grade levels. The following areas need verification to ensure they work correctly for primary levels:

### 7.1 Admission Age-to-Grade Calculation

The current rule maps: `age 6 = Year 1, age 7 = Year 2, ..., age 11 = Year 6`. This correctly covers primary. A parent applying for a Year 3 student (age 8) should see "Year 3" auto-populated — the calculation supports this.

**No change needed** — the age-to-grade formula already covers Year 1–6.

### 7.2 Attendance Tracking for Primary Classes

Primary classes (e.g., Year 3A at SRPB) should appear in the teacher's attendance interface. Because attendance is class-based and classes are linked to the school configuration, once grade levels are dynamic (Section 4), primary classes appear automatically.

**No additional logic needed** — the fix flows naturally from the grade-level change.

### 7.3 Grade Entry for Primary Students

Primary subjects differ from secondary (Malay Language, English, Mathematics, Science, Islamic Studies for primary vs. subject-streaming in secondary). The system's subject management module (SMS 2.2.41) already supports school-level subject configuration per academic year — so SRPB can define "Bahasa Melayu Year 3" as a subject independently of SMHK's subject list.

**No change needed** — subject management is already school-scoped.

### 7.4 PSR Examination (Year 6)

The Exam Management module already lists Year 1–13 in its grade levels. PSR, which applies to Year 6 students, can already be configured. A Year 6 SRPB student can be registered as a PSR candidate in the current system.

**No change needed** — Exam Management is already complete.

### 7.5 SEN / IEP for Primary Students

Special Educational Needs documentation is student-record based, not grade-level filtered. SEN profiles, IEPs, and therapy tracking work identically for a Year 2 student at SRPB as for a Year 9 student at SMHK.

**No change needed** — SEN is grade-level agnostic.

---

## 8. Multi-School Context Switching (System Admin View)

The system administrator (`sysadmin`) can see all schools. When a sysadmin views the Student Directory, they need to filter by school first, then see that school's grade levels dynamically.

### Design decision

The Student Directory and similar multi-school views should present a **two-step filter**:
1. Select school (shows all 8 schools)
2. Grade level filter updates to reflect that school's configured levels

This ensures that when viewing SMAB students, the filter shows Tingkatan 1–5. When viewing SRPB students, it shows Year 1–6. When viewing SMHK students, it shows Year 7–11 (or 12).

---

## 9. Summary of Changes Required

| Priority | Change | Reason | Complexity |
|---|---|---|---|
| **High** | Connect all grade-level dropdowns to school config (7 screens) | Fixes primary + MORA + Year 12 in one pass | Low — swap static list for hook value |
| **High** | Add Year 12 to SMHK school configuration | 576 students currently invisible in filters | Trivial — seed/config data change |
| **Medium** | At-Risk Dashboard: include primary grade levels in filter | Primary at-risk students should be visible to primary school principals | Low — same fix as above |
| **Low** | Student Directory sysadmin view: school-then-grade filter | Correct UX when switching between schools with different grade systems | Medium — adds a school-picker step |
| **None needed** | Exam, Admission, SEN, Subjects, Attendance logic | Already grade-range agnostic | — |

### What does NOT need to change

- The database schema — it already stores any string as `gradeLevel`
- The backend APIs — they already filter by `gradeLevel` as a string parameter
- The age-to-grade calculation — already covers Year 1–12
- Any business logic — the gap is purely in what choices the UI presents

The entire fix is a **UI configuration consistency correction**. The system's capability already spans all stages; the screens just need to ask the school what those stages are rather than assuming them.

---

## 10. Demo Impact

Once fixed, the following demo scenarios become available that are not currently possible:

| Scenario | What becomes demonstrable |
|---|---|
| Login as `principal.srpb` (SRPB Primary) | See Year 1–6 in all dropdowns; attend to Year 1 class; view Year 6 PSR candidates |
| Login as `principal.smab` (SMAB MORA) | See Tingkatan 1–5 everywhere; manage Tingkatan 3 class timetable |
| Sysadmin views Student Directory | Switch between schools and see grade levels change automatically |
| At-Risk dashboard for primary principal | See primary students' attendance/academic risk scores |

This directly strengthens the multi-authority demo segment (the breadth sweep at minute 50–55) by showing that the same screen genuinely serves three different school systems without any adaptation.

---

## 11. Demonstration Adjustments

### Guiding principle

**The Ahmad storyline at SMHK stays exactly as it is.** That is 43 of the 60 minutes — the cascade, RBAC, EMS workflows, and Private Education Oversight are completely unaffected by the stage-coverage fix. The system continues to behave identically for the SMHK secondary-school context, which is where the persuasive narrative lives.

The fix only changes what happens when we **switch into a different school's context**. That is the Breadth Sweep (5 minutes) and the Multi-Authority chips. So the demo modifications are confined to that segment.

### 11.1 What Stays the Same

| Demo segment | Duration | Affected by fix? |
|---|---|---|
| Opening — Command Center | 4 min | No |
| Act 1 — Parent admission → Cascade → RBAC | 24 min | No |
| Act 2 — Teacher's journey (EMS workflows) | 15 min | No |
| Act 3 — Private Education Oversight | 7 min | No |
| Closing + Q&A | 5 min | No |
| **Total unchanged demo content** | **55 min of 60** | — |

The story, the data, the cascade, the workflows — all unchanged. The presenter does not need to re-rehearse Acts 0–3.

### 11.2 What Gets Strengthened — Breadth Sweep (5 minutes)

This is the only segment that changes. Currently the breadth sweep is a fast click-through of modules ("here's library, here's exams, here's inventory…"). With the stage-coverage fix, **the multi-authority moment becomes a genuine "wow" beat** instead of a token gesture.

#### Old multi-authority moment (current)

> *"And here's a sysadmin view showing we support multiple schools…"* — clicks through Primary Principal, MORA Principal, Private Admin. Each lands on a dashboard. The dashboards look basically the same. Audience nods politely.

#### New multi-authority moment (after fix)

> *"Watch what happens when I switch into a primary school principal's seat…"* — click **Primary Principal (SRPB)**. The student directory dropdown now shows **Year 1 through Year 6**. The class management list shows primary classes. The attendance interface offers Year 3 instead of Year 9.
> 
> *"Now into a MORA religious school…"* — click **MORA Principal (SMAB)**. The same dropdowns now show **Tingkatan 1 through Tingkatan 5** — the Malay-language grade nomenclature that MORA schools actually use.
> 
> *"And into an international private school…"* — click **Private Admin (ISB)**. The dropdowns now show **Grade 7 through Grade 12**.

This takes the same 60 seconds as the old version but tells a far stronger story: **same system, same screens, three completely different school nomenclatures, zero configuration switch — the system reads the school's own vocabulary and adapts itself.**

### 11.3 New Talking Points

Add these two lines to the presenter script for the Breadth Sweep:

1. *"The system doesn't have a hardcoded notion of what a year level is. It asks each school what they call their grade levels and uses that. Primary schools see Year 1–6. MORA schools see Tingkatan. International schools see Grade 7–12. One codebase, three vocabularies."*

2. *"This matters because Brunei's education estate is not uniform. MOE secondary schools, MORA religious schools, primary schools, and private international schools all coexist in this country. The system serves all of them natively — not by translation, but by configuration."*

### 11.4 New Demo Sub-Scene (Optional 90-Second Add)

If time permits in the breadth sweep, an even stronger optional moment:

**The "same screen, three schools" demonstration**

1. Login as **Primary Principal (SRPB)** → open **Student Directory** → show grade filter: Year 1, 2, 3, 4, 5, 6
2. Without changing the page, switch user to **MORA Principal (SMAB)** → refresh → same Student Directory now shows: Tingkatan 1, 2, 3, 4, 5
3. Switch again to **Private Admin (ISB)** → same page now shows: Grade 7, 8, 9, 10, 11, 12

This visual sequence — three rapid context switches on a single screen with three different grade vocabularies — is a 30-second "trust moment" that proves multi-authority support is real, not cosmetic.

### 11.5 Demo Account Reference

No new accounts are needed. The chips already on the login page suffice:

| Chip | Username | What changes after the fix |
|---|---|---|
| Primary Principal | `principal.srpb` | Dropdowns now show Year 1–6 instead of Year 7–11 |
| MORA Principal | `principal.smab` | Dropdowns now show Tingkatan 1–5 instead of Year 7–11 |
| Private Admin | `admin.isb` | Dropdowns now show Grade 7–12 instead of Year 7–11 |
| System Admin | `sysadmin` | Two-step filter: pick school first, then see that school's levels |

### 11.6 What to Update in Supporting Documents

| Document | Update needed |
|---|---|
| 60-minute demo script | Update the Breadth Sweep section (~30 lines) — add the new multi-authority moment and talking points |
| Knowledge base (Brunei education) | No change needed — already correctly describes all stages |
| Test cases Excel | Add 2–3 test rows for the multi-authority dropdown verification |
| Q&A preparation | Add one new likely question: *"Does the system support primary schools and MORA schools too, or just MOE secondary?"* — answer is now demonstrable on screen, not just claimable |

### 11.7 Effort vs. Impact Summary

| Effort | Impact |
|---|---|
| Code changes: small (UI-only consistency fix) | Code quality: higher (eliminates 7 duplicated grade-level constants) |
| Demo rehearsal: ~15 minutes additional | Demo persuasiveness: meaningfully stronger multi-authority story |
| New scripts to memorise: 2 talking points | Visual proof: 3 schools, 3 grade vocabularies, on screen in 90 seconds |
| Risk: low — change is additive, doesn't affect existing flows | Risk avoided: jury asking *"can it really handle primary?"* and having only a verbal answer |

### Bottom line

The fix is a small surgical change to the system. The demonstration adjustment is a small surgical change to one 5-minute segment of the script. Everything that already works well — the cascade, the RBAC moment, the Private Education oversight, the EMS workflows — continues to work identically. What changes is that the multi-authority claim becomes visible rather than merely stated.
