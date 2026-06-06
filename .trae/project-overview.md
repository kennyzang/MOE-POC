# 🎯 Project Overview - MOE SERPS

## Identity
- **Name**: MOE SERPS (School Enterprise Resource Planning System)
- **Client**: Ministry of Education, Brunei Darussalam
- **Type**: POC Demo / MVP for K-12 school management
- **Base**: Adapted from UNISSA-POC (university system → K-12 schools)

## 🛠️ Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|--------|
| **PC Frontend** | React + Vite | 19.x | Desktop web app |
| | TypeScript | 5.x | Type safety |
| | Ant Design (antd) | 5.x | UI component library |
| | Zustand | 5.x | State management |
| | React Router | 7.x | Client-side routing |
| | Recharts | 3.x | Data visualization |
| | i18next | 26.x | Internationalization |
| **Mobile Frontend** | Vite + antd-mobile | - | H5 PWA (separate project) |
| **Backend** | Express.js | 4.x | REST API server |
| | Prisma ORM | 5.x | Database toolkit |
| | SQLite | - | Database (file-based) |
| | JWT | 9.x | Authentication |
| | Zod | 3/4.x | Validation |

## 📁 Project Structure

```
moe-poc-claude/
├── pc/                    # PC Frontend (React + Ant Design)
│   ├── src/
│   │   ├── pages/         # Page components (by module)
│   │   ├── components/    # Shared components
│   │   ├── layouts/       # AppLayout, Navbar, Sidebar
│   │   ├── stores/        # Zustand state stores
│   │   ├── lib/           # Utilities (api, i18n, queryClient)
│   │   ├── types/         # TypeScript interfaces
│   │   ├── locales/       # i18n translations (en/zh/ms)
│   │   └── router/        # Route configuration
│   └── vite.config.ts     # Vite config (port 3000)
├── mobile/               # Mobile H5 PWA (antd-mobile)
│   └── src/
│       ├── pages/        # Pages by role (auth/parent/student/teacher)
│       ├── components/    # Mobile-specific components
│       └── ...            # Similar structure to PC
├── backend/              # Express API Server
│   ├── src/
│   │   ├── routes/       # API route handlers (13+ endpoints)
│   │   ├── services/      # Business logic (AI, email, notifications)
│   │   ├── middleware/    # Auth, error handling
│   │   ├── lib/           # Prisma client, JWT utils
│   │   └── index.ts       # Server entry point
│   ├── prisma/           # Schema, migrations, seed data
│   └── .env              # Environment variables (gitignored)
├── doc/dev-logs/         # Development session logs
├── docs/                 # Specs, plans, documentation
└── prompt/               # AI development prompts
```

## 🔐 Demo Accounts

### Quick Reference Table

| Role | Username | Password | Display Name | School | Authority |
|------|----------|----------|-------------|--------|----------|
| **System Admin** | sysadmin | sysadmin123 | System Admin | - | - |
| **Admin** | admin | admin123 | Admin | SMHK | MOE |
| **Principal** | principal | principal123 | Hjh Rashidah | SMHK | MOE |
| **HOD** | hod01 | hod123 | Dr. Azman | SMHK | MOE |
| **Counselor** | farah | Demo@2026 | Counselor | SMHK | MOE |
| **Teacher** | drsiti | Demo@2026 | Dr. Siti Nurhaliza | SMHK | MOE |
| **Teacher** | faizal | Demo@2026 | Mohd Faizal Bin Aziz | SMHK | MOE |
| **Student** | student001 | student123 | Ahmad Bin Abdullah | SMHK | MOE |
| **Student** | adam | Demo@2026 | Adam Bin Haris | SMHK | MOE |
| **Parent** | fatimah | Demo@2026 | Fatimah Binti Yusof | SMHK | MOE |
| **Primary Admin** | admin.srpb | Demo@2026 | Primary Admin | SRPB | MOE |
| **Private Admin** | admin.isb | Demo@2026 | Private Admin | ISB | PRIVATE |

### Authority Types
- **MOE**: Ministry of Education (government schools)
- **MORA**: Ministry of Religious Affairs (religious schools)
- **PRIVATE**: Private/international schools

## 🌐 Supported Languages
1. **English** (en) - Default
2. **中文** (zh) - Chinese Simplified
3. **Bahasa Melayu** (ms) - Malay

## 🚀 Quick Start Commands

```bash
# Install dependencies
cd pc && npm install
cd backend && npm install
cd mobile && npm install

# Initialize database
cd backend && npx prisma migrate dev && npm run seed

# Start development servers
cd backend && npm run dev    # Port 4000
cd pc && npm run dev          # Port 3000
cd mobile && npm run dev      # Port 5173
```

## 📊 Key Features Implemented

### Core Modules
- **SIS** (Student Information System): Admissions, grades, attendance, profiles
- **EMS** (Educator Management): Teacher directory, certifications, workload, CPD
- **SMS** (School Management): Courses, resources, finance, timetable
- **EGNC Integration**: Government services portal
- **AI Assistant**: Chat with SSE streaming (DeepSeek API)
- **Notification System**: Real-time alerts + push notifications
- **Multi-Authority Support**: MOE/M/Private schools
- **Role-Based Access Control**: 8+ roles with different permissions

### Advanced Features
- AI-powered risk prediction for at-risk students
- Email notifications (SMTP Office365)
- Push notifications (Web Push API)
- Mobile PWA with offline support
- SSO simulation (Brunei ID, EGNC/IDPM)
- Dashboard with real-time statistics

---

**For Trae AI**: Use this context to understand project scope when generating code, suggesting features, or debugging issues.
