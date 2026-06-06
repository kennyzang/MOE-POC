# Trae Editor Rules - MOE SERPS Project

## 📋 Overview
This directory contains **AI coding rules** optimized for **Trae Editor** (ByteDance's AI-powered IDE).

## 🎯 Purpose
Provide Trae AI assistant with project-specific context, coding standards, and best practices to ensure consistent, high-quality code generation.

## 📁 File Structure
```
.trae/
├── README.md              # This file - rules overview & sync guide
├── project-overview.md    # Project info, tech stack, demo accounts
├── hard-rules.md          # Mandatory rules (UI, i18n, TS, data)
├── code-style.md          # Naming conventions, directory structure
├── git-and-build.md       # Git workflow, build checks, security
├── quality-checklist.md   # Pre-completion verification steps
└── dev-log.md             # Session logging requirements
```

## 🔗 Rule Sources
These rules are synchronized from:
- **Primary**: `CLAUDE.md` (project root) - Single source of truth
- **Secondary**: `.codebuddy/rules/` - CodeBuddy format
- **Tertiary**: `.trae/` - This Trae-optimized version

## ⚙️ How Trae Uses These Rules
1. **Auto-loading**: Trae reads `.trae/*.md` files at session start
2. **Context injection**: Rules are injected into AI conversation context
3. **Real-time validation**: AI checks code against rules before suggesting changes
4. **Error prevention**: Common mistakes are caught before they happen

## 🎨 Trae-Specific Optimizations
vs. CodeBuddy/Claude Code versions:
- ✅ **Concise format**: Shorter paragraphs for faster context loading
- ✅ **Action-oriented**: Focus on "do/don't" patterns
- ✅ **Code examples**: More inline examples for immediate reference
- ✅ **Error patterns**: Explicit anti-patterns to avoid
- ✅ **Quick-reference tables**: For fast lookup during coding

## 🛠️ Maintenance
### Update Rules
```bash
# Manual sync from CLAUDE.md
# Edit files in .trae/ to match CLAUDE.md updates
```

### When to Update
- After modifying `CLAUDE.md`
- After adding new tech stack components
- After changing project structure
- Before major feature development sprints

## 📊 Coverage Matrix
| Category | Files | Priority |
|----------|-------|----------|
| Project Context | project-overview.md | P0 - Must have |
| Hard Constraints | hard-rules.md | P0 - Must have |
| Code Standards | code-style.md | P1 - Should have |
| Workflow | git-and-build.md | P1 - Should have |
| Quality Gates | quality-checklist.md | P2 - Nice to have |
| Documentation | dev-log.md | P2 - Nice to have |

---

**Generated for**: Trae Editor v1.x+
**Project**: MOE SERPS (Ministry of Education Brunei)
**Last Sync**: 2026-06-06
