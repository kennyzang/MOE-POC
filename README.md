# MOE SERPS POC

Ministry of Education (Brunei) School Enterprise Resource Planning System — Proof of Concept.

## Tech Stack

| Layer | Stack |
|-------|-------|
| PC Frontend | React 18 + Vite + TypeScript + Ant Design 5.x |
| Mobile | H5 (Vite + Ant Design Mobile) |
| Backend | Express + Prisma + SQLite + JWT |
| State | Zustand |
| i18n | English / Chinese / Bahasa Melayu |

## Quick Start

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev          # http://localhost:4000

# PC Frontend
cd pc
npm install
npm run dev          # http://localhost:3000
```

## Demo Accounts

All passwords: `Demo@2026`

| Role | Username | Display Name |
|------|----------|-------------|
| admin | admin | System Admin |
| manager | manager | Hj Kamaruddin |
| finance | finance | Finance Officer |
| admissions | admissions | Admissions Officer |
| teacher | drsiti | Dr. Siti Nurhaliza |
| teacher | faizal | Mohd Faizal Bin Aziz |
| student | adam | Adam Bin Haris |
| student | nurul | Nurul Binti Rahman |
| parent | fatimah | Fatimah Binti Yusof |

## Project Structure

```
moe-poc-claude/
├── pc/              # PC frontend (Vite + React)
├── mobile/          # Mobile H5 (planned)
├── backend/         # Express + Prisma API
├── doc/dev-logs/    # AI development logs
└── prompt/          # AI prompts & project docs
```

## Git Repositories

This project syncs to two remotes:

| Remote | URL |
|--------|-----|
| origin | `https://git.landray.com.cn/project-group/OVERSEABU_MK-PaaS20241906/publish/moe-poc.git` |
| github | `https://github.com/kennyzang/MOE-POC.git` |

### Push to both remotes

```bash
git push origin master
git push github master
```

### Setup (first time only)

```bash
git remote add github https://github.com/kennyzang/MOE-POC.git
```
