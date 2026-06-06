# ✅ Quality Checklist - Pre-Completion Verification

**Purpose**: Ensure every feature meets production standards before marking as "done".

Execute these checks **in order**. Do not skip any step.

---

## 1️⃣ Demo Verification (Manual Testing)

### What to Do
Write a **Demo Verification Steps** section and walk through it:

```markdown
### Demo Verification Steps
1. Open browser to http://localhost:3000
2. Login with admin / admin123
3. Navigate to Dashboard → verify stats display
4. Click Students tab → verify list loads
5. Create new student → verify form validation
6. Edit student → verify data persists
7. Delete student → confirm removal
8. Logout and re-login → verify session cleared
```

### Success Criteria
- [ ] All user interactions work as expected
- [ ] No JavaScript errors in console
- [ ] All navigation paths are accessible
- [ ] Edge cases handled gracefully

---

## 2️⃣ Role Isolation Verification

### What to Do
Test with **at least 2 different role accounts**:

| Role A | Role B | What to Verify |
|--------|--------|----------------|
| Admin | Teacher | Admin sees all data; Teacher sees only their classes |
| Student | Parent | Student sees own grades; Parent sees children's grades |
| MOE Admin | Private Admin | MOE sees only MOE schools; Private sees only private |

### Test Scenarios
```bash
# Test 1: Admin login
goto /login
fill username = "admin"
fill password = "admin123"
click Login
verify dashboard shows ALL schools/students/teachers

# Test 2: Teacher login
goto /login
fill username = "drsiti"
fill password = "Demo@2026"
click Login
verify dashboard shows ONLY assigned classes
verify CANNOT access admin settings
```

### Success Criteria
- [ ] Each role sees correct data subset
- [ ] No cross-role data leakage
- [ ] Permission errors shown appropriately (not raw errors)
- [ ] Menu items filtered by role correctly

---

## 3️⃣ Form Validation Check

### What to Verify
All forms show **inline error messages**, not alerts or console logs:

```tsx
// ✅ CORRECT - Inline validation
<Form.Item
  name="email"
  rules={[
    { required: true, message: 'Email is required' },
    { type: 'email', message: 'Invalid email format' }
  ]}
>
  <Input placeholder="Email" />
</Form.Item>

// ❌ WRONG - Alert-based validation
if (!email) {
  alert('Email is required')  // Bad UX!
}
```

### Boundary Value Tests
| Field | Empty Value | Too Long | Special Chars | Valid Input |
|-------|------------|---------|---------------|------------|
| Username | `""` ✗ | `"a"*100` ✗ | `<script>` ✗ | `"admin123"` ✓ |
| Password | `""` ✗ | `"p"*200` ✗ | `"pass word"` ✓ | `"Demo@2026"` ✓ |
| Email | `""` ✗ | N/A | `"test@test"` ✗ | `"admin@school.edu"` ✓ |
| Phone | `""` ✗ | `"1"*20` ✗ | `"abc"` ✗ | `"+673-123-4567"` ✓ |

---

## 4️⃣ Internationalization (i18n) Audit

### Scan for Hardcoded Strings
```bash
# Find hardcoded English strings in JSX
grep -rn "\b[A-Z][a-z]+\s+[a-z]+" src/ --include="*.tsx" \
  | grep -v "import\|from\|interface\|type\|const\|function\|class"

# Alternative: Search for common patterns
grep -rn '"[A-Z][a-z]\{3,\}"' src/pages/ --include="*.tsx"
```

### Manual Check List
For each new component/page:
- [ ] All visible text uses `{t('key')}` pattern
- [ ] Translation keys exist in all 3 locale files:
  - `locales/en.ts`
  - `locales/zh.ts`
  - `locales/ms.ts`
- [ ] Switch language toggle works without page reload
- [ ] No fallback to English when viewing Chinese/Malay
- [ ] Date/currency formats localized (en: MM/DD/YYYY, zh: YYYY-MM-DD)

---

## 5️⃣ Build Verification (Automated + Manual)

### Required Commands
```bash
# PC Frontend Build
cd pc
npm run build
# Expected: dist/ created, 0 TypeScript errors

# Mobile Frontend Build
cd mobile
npm run build
# Expected: dist/ created, 0 errors

# Backend Type Check (optional but recommended)
cd backend
npx tsc --noEmit
# Expected: 0 errors
```

### What Gets Caught
- Missing type definitions
- Import path typos (`./copmonent` vs `./component`)
- Unused variables (strict mode)
- Implicit `any` types
- CSS module resolution failures

---

## 6️⃣ State Machine Validation (Workflow Features Only)

**Applicable to**: Admissions, Applications, CounselorCases, etc.

### Example: Admissions Application Workflow
```
PENDING_REVIEW → APPROVED → ENROLLED
PENDING_REVIEW → REJECTED
PENDING_REVIEW → WAITLIST
WAITLIST → APPROVED → ENROLLED
WAITLIST → REJECTED
```

### Verification Steps
1. **Map all valid transitions** (draw state diagram if complex)
2. **Test each transition** with appropriate role permissions
3. **Test invalid transitions** (should be blocked):
   ```bash
   # Try to approve already-approved application
   # Expected: Error message "Application already approved"
   ```
4. **Check history/audit trail**: Every state change logged?
5. **Verify notifications**: Stakeholders notified on key transitions?

---

## 7️⃣ Data Consistency (Dashboard Features Only)

**Applicable to**: Statistics, charts, summary numbers.

### Test Procedure
1. **Record baseline**:
   ```bash
   # Note current dashboard numbers:
   # Total Students: 150
   # Total Teachers: 25
   # Attendance Today: 142/150 (94.7%)
   ```

2. **Modify source data** in another module:
   ```bash
   # Add 5 new students via Admissions page
   # Mark 3 students absent via Attendance page
   # Add 2 new teachers via EMS page
   ```

3. **Return to Dashboard** and verify:
   ```bash
   # Expected updates:
   # Total Students: 155 (+5) ✅
   # Total Teachers: 27 (+2) ✅
   # Attendance Today: 139/155 (89.7%) ✅ (-3 absent, +5 total)
   ```

4. **Edge case**: Delete a student → number should decrement immediately

---

## 📊 Dependency Upgrade Checklist (When Applicable)

If you added/upgraded npm packages:

- [ ] Ran `npm install <package>@<version>` with exact version
- [ ] Verified `package-lock.json` updated correctly
- [ ] Tested locally: `npm run dev` works without errors
- [ ] Ran full build: `npm run build` passes
- [ ] Checked for breaking changes in changelog
- [ ] Updated documentation if API changed
- [ ] No new vulnerabilities: `npm audit` (fix critical/high)

---

## 🎯 Final Sign-Off

Before marking feature as **COMPLETE**, confirm:

```
✅ Demo walkthrough successful (all steps pass)
✅ Role isolation verified (≥2 roles tested)
✅ Form validations inline & working
✅ i18n complete (3 languages, no hardcoded strings)
✅ Build passes (0 errors, 0 warnings)
✅ State machine validated (if applicable)
✅ Dashboard data consistent (if applicable)
✅ No secrets leaked (git diff scan clean)
✅ Dev log updated with changes
✅ Code committed and pushed to GitHub
```

---

**For Trae AI**: Before suggesting "feature is complete", run through this checklist mentally. Ask user to verify each item.
