# 📝 Development Log Rules

## 🎯 Purpose
Track every coding session to maintain project history, aid AI context, and provide human-readable progress summaries.

---

## 📍 Log File Locations

| File | Path | Format |
|------|------|--------|
| **Session Logs** | `doc/dev-logs/YYMMDD-HHmm.md` | Markdown |
| **Index** | `doc/dev-logs/README.md` | Table of contents |

### Naming Convention
```
✅ 260606-0900.md   (June 6, 2026 at 09:00)
✅ 260607-1430.md   (June 7, 2026 at 14:30)
❌ dev-log-2026.md (wrong format)
❌ session1.md      (no timestamp)
```

---

## ⏰ When to Update

**MANDATORY**: After **every** development session ends.

A "session" is:
- A continuous block of coding work
- Typically 30 minutes to several hours
- Ends when you take a break > 30 min or switch tasks completely

---

## 📋 Required Content per Session

### 1. Session Header
```markdown
# Dev Log - YYYY-MM-DD HH:MM

**Duration**: X minutes (or X hours Y minutes)
**Tokens**: ~X,XXX (estimate from Trae/Claude interface)
```

### 2. Summary Section (Human-Readable)
```markdown
## Summary
Brief paragraph describing what was accomplished in this session.
Focus on outcomes, not activities.

Example:
> Implemented mobile login page with demo accounts popup and SSO integration.
> Fixed 3 TypeScript errors in dashboard component. Added i18n support for new features.
```

### 3. Changes Section (Detailed)
```markdown
## Changes

### New Files
- `mobile/src/pages/auth/LoginPage.tsx` - Complete rewrite with demo popup + SSO
- `mobile/src/components/NotificationBell.tsx` - New notification icon component

### Modified Files
- `pc/src/pages/DashboardPage.tsx` - Fixed chart tooltip type error (#123)
- `backend/src/routes/students.ts` - Added pagination endpoint
- `mobile/src/locales/en.ts` - Added 15 new translation keys

### Deleted Files
- `old-component.tsx` - Replaced by new implementation
```

### 4. Technical Notes (Optional but Recommended)
```markdown
## Technical Notes

### Decisions Made
- Chose antd-mobile Popup over Modal for demo accounts (better mobile UX)
- Used SSE streaming for AI chat (vs polling) for real-time feel

### Issues Encountered
- Prisma client singleton issue in Docker - fixed with global instance
- Lucide React v0.460+ changed Icon API - updated import paths

### Next Steps
- [ ] Test SSO flow on actual device
- [ ] Add loading skeleton states
- [ ] Implement error boundary for chat feature
```

---

## 🔧 Updating the Index File

After creating a session log, **always update** `doc/dev-logs/README.md`:

### Index Entry Format
```markdown
<!-- Add to top of table -->
| Date | Time | Duration | Tokens | Summary | Key Files |
|------|------|----------|--------|---------|----------|
| 2026-06-06 | 09:00 | 90m | ~120k | Mobile login rewrite + bug fixes | LoginPage.tsx, NotificationBell.tsx |
```

### Example README.md Structure
```markdown
# Development Logs

## Quick Stats
- **Total Sessions**: 42
- **Total Hours**: ~67h
- **Total Tokens**: ~2.5M

## Recent Sessions

| Date | Time | Duration | Tokens | Summary | Key Files |
|------|------|----------|--------|---------|----------|
| 2026-06-06 | 09:00 | 90m | ~120k | Mobile login + fixes | LoginPage.tsx |
| 2026-06-06 | 08:28 | 60m | ~25k | Mobile features expansion | ChatDrawer.tsx |
| 2026-06-06 | 08:12 | 30m | ~25k | CodeBuddy rules sync | rules/*.md |

---

*Last updated: 2026-06-06 10:30*
```

---

## 🚀 Commit & Push Workflow

After updating logs:

```bash
# 1. Stage log files
git add doc/dev-logs/

# 2. Commit with descriptive message
git commit -m "dev-log: 2026-06-06 09:00 - Mobile login rewrite + SSO"

# 3. Push to both remotes (if available)
git push github master      # Always push here first
# git push origin master    # When VPN available
```

### Commit Message Format
```
dev-log: <date> <time> - <one-line summary>

Examples:
✅ dev-log: 260606-0900 - Login page redesign with popup
✅ dev-log: 260606-0828 - AI chat + notification features
✅ dev-log: 260605-1700 - Dashboard performance optimization

❌ dev-log: update logs
❌ dev-log: did some stuff
```

---

## 📊 Token Estimation Guide

Estimate based on your AI tool's output:

| Tool | Where to Find Token Count |
|------|---------------------------|
| **Trae Editor** | Bottom status bar or session summary |
| **Claude Code** | End of conversation summary |
| **Cursor** | Chat window footer |
| **ChatGPT** | API usage dashboard |

**Rough estimates if not shown**:
- Small fix (1-2 files): ~5-15k tokens
- Medium feature (3-5 files): ~20-50k tokens
- Large refactor (5+ files): ~50-150k tokens
- Full module: ~100-300k tokens

---

## ✅ Pre-Session Checklist (Start New Log)

Before starting a new coding session:

1. **Check current time** → Use for filename: `YYMMDD-HHmm`
2. **Review previous log** → Understand where you left off
3. **Set goal for this session** → Write it down first
4. **Open log file** → Keep it updated as you work (not just at end)

---

## 🎯 Quality Standards

### Good Log Example ✅
```markdown
# Dev Log - 2026-06-06 09:00

**Duration**: 90 minutes
**Tokens**: ~120,000

## Summary
Completed mobile login page overhaul to match PC (UNISSA) design.
Added bottom-sheet popup for 18 demo accounts with authority tags.
Implemented SSO simulation for Brunei ID and EGNC/IDPM providers.
Fixed 3 TypeScript errors discovered during build verification.

## Changes

### New Files (4)
- `mobile/src/pages/auth/LoginPage.tsx` - Complete rewrite (280 lines)
  - Demo accounts popup (Popup component from antd-mobile)
  - SSO consent dialog (Dialog component)
  - Authority tags (MOE/MORA/PRIVATE color-coded)
  - Password masking display
- `mobile/src/locales/en.ts` - Added 11 SSO-related keys
- `mobile/src/locales/zh.ts` - Chinese translations
- `mobile/src/locales/ms.ts` - Malay translations

### Modified Files (3)
- `pc/src/pages/LoginPage.tsx` - Referenced for pattern matching
- `mobile/src/types/index.ts` - Added Authority type
- `doc/dev-logs/README.md` - Updated index

### Bug Fixes (3)
1. **Login error not displaying** - Fixed doLogin() error throwing
2. **Missing Authority type** - Added to types/index.ts
3. **i18n keys missing** - Added en/zh/ms translations

## Technical Notes
- Used antd-mobile Popup over Modal (better mobile UX)
- SSO mock endpoints already exist in backend (/auth/brunei-id/callback)
- Password masking: show first 6 chars + ellipsis

## Next Steps
- [ ] Test on physical device (iOS Safari)
- [ ] Add loading animation during SSO redirect
- [ ] Implement biometric auth option (future)
```

### Bad Log Example ❌
```markdown
# Dev Log

Did some work on login page.
Changed some files.
Fixed bugs.
```

---

## 🔄 Automation Opportunities

If you want to automate log creation:

### Template Generator Script
```bash
#!/bin/bash
# create-dev-log.sh
DATE=$(date +%y%m%d)
TIME=$(date +%H%M)
FILE="doc/dev-logs/${DATE}-${TIME}.md"

cat > "$FILE" << EOF
# Dev Log - $(date +%Y-%m-%d %H:%M)

**Duration**: _pending_
**Tokens**: _pending_

## Summary
_(To be filled)_

## Changes

### New Files
-

### Modified Files
-

### Deleted Files
-

## Technical Notes
EOF

echo "Created: $FILE"
```

Usage: `./create-dev-log.sh` before starting session.

---

## 📈 Analytics & Metrics (Optional Advanced)

Track these metrics over time for process improvement:

| Metric | How to Calculate | Target |
|--------|------------------|--------|
| **Avg tokens/hour** | Total tokens ÷ duration | 50-80k |
| **Files changed/session** | Count in Changes section | 3-8 |
| **Bug fix ratio** | Fixes ÷ total changes | < 30% |
| **Build success rate** | Successful builds ÷ attempts | > 95% |
| **i18n coverage** | Translated strings ÷ total strings | 100% |

---

**For Trae AI**: At end of every conversation, remind user to update dev log. Offer to generate template automatically.
