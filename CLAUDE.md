# MOE SERPS POC Development Guidelines

## Project Overview
Ministry of Education (Brunei) School Enterprise Resource Planning System POC.
Based on UNISSA-POC (`/Users/xiex/Documents/GIT/OVERSEABU/unissa-poc`), adapted for K-12 schools.

## Tech Stack
- **PC Frontend**: React 18 + Vite + TypeScript + Ant Design 5.x
- **Mobile**: H5 (Vite + Ant Design Mobile), separate project
- **Backend**: Express + Prisma + SQLite + JWT
- **State**: Zustand
- **Icons**: Lucide React (NO emoji icons)
- **Charts**: Recharts
- **i18n**: i18next + react-i18next (English, Chinese, Malay)
- **Styling**: CSS Modules + CSS variables for theming

## Project Structure
```
moe-poc-claude/
├── pc/           # PC frontend (Vite + React)
├── mobile/       # Mobile H5 (Vite + Ant Design Mobile)
├── backend/      # Express + Prisma API server
└── prompt/       # AI development prompts & docs
```

## User Roles & Demo Accounts
| Role | Username | Display Name | Password |
|------|----------|-------------|----------|
| student | adam | Adam Bin Haris | Demo@2026 |
| student | nurul | Nurul Binti Rahman | Demo@2026 |
| parent | fatimah | Fatimah Binti Yusof | Demo@2026 |
| teacher | drsiti | Dr. Siti Nurhaliza | Demo@2026 |
| teacher | faizal | Mohd Faizal Bin Aziz | Demo@2026 |
| admissions | admissions | Admissions Officer | Demo@2026 |
| manager | manager | Hj Kamaruddin | Demo@2026 |
| finance | finance | Finance Officer | Demo@2026 |
| admin | admin | System Admin | Demo@2026 |

## Hard Rules
1. **All UI components MUST use Ant Design** — no native HTML date pickers, selects, etc.
2. **Icons MUST use Lucide React** — no emoji, no other icon libraries
3. **All user-visible text MUST go through i18n** (`useTranslation` / `t()`) — no hardcoded strings
4. **TypeScript strict mode** — no `@ts-ignore`, minimize `any`
5. **Dashboard/statistics numbers MUST come from DB queries** — no hardcoded fake data
6. **PC and mobile are separate projects** — no responsive design mixing
7. **Styles must be easy to modify** — use CSS Modules + CSS variables, not deep SCSS nesting

## Code Style
- Follow `.prettierrc` and `.eslintrc.cjs`
- Components: functional + hooks, PascalCase filenames
- Utils/helpers: camelCase filenames
- Each page component in its own directory under `pages/`

## Mock Data Rules
- Centralized in `src/mock/` directory
- Data must be realistic (Brunei school names, Malay names, BND currency)
- All dashboard/stats numbers derive from mock data, not separate hardcoded values
- API responses via mock functions or MSW

## Quality Checklist (per feature)
Before marking any feature as complete:
1. Write "Demo Verification Steps" and walk through them
2. Switch between at least 2 different role accounts to verify data isolation
3. Verify form validations show inline error messages
4. Check all text goes through i18n (grep for hardcoded strings)
5. Run `npx tsc --noEmit` to catch TypeScript errors
6. For workflow features: verify the full state machine (every status transition)
7. For dashboards: add/remove data in another module, verify numbers update

## Git Rules
- Never commit: `.env`, `*.key`, `*.pem`, `*.mp4`, `node_modules/`
- GitHub remote: https://github.com/kennyzang/MOE-POC.git
