# 🎨 Code Style Guide

## 📝 Naming Conventions

### Components (PascalCase)
```
✅ StudentHomePage.tsx
✅ TeacherDashboardPage.tsx
✅ NotificationBell.tsx
✅ ChatDrawer.tsx

❌ studentHomePage.tsx      (camelCase)
❌ teacher-dashboard.jsx   (kebab-case, wrong ext)
❌ notification_bell.tsx    (snake_case)
```

### Utilities/Helpers (camelCase)
```
✅ formatDate.ts
✅ calculateGPA.ts
✅ apiClient.ts

❌ FormatDate.ts           (PascalCase for non-components)
❌ format-date.ts          (kebab-case)
```

### Files & Directories
```
Pages:     pages/auth/LoginPage.tsx
Components: components/shared/Header.tsx
Stores:    stores/useAuthStore.ts
Hooks:     hooks/usePermissions.ts
Types:     types/index.ts
Locales:   locales/en.ts, zh.ts, ms.ts
```

---

## 📁 Directory Structure

### PC Frontend (`pc/src/`)
```
src/
├── main.tsx              # Entry point
├── App.tsx               # Root component + Router
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── sis/              # Student Information System
│   │   ├── AdmissionsPage.tsx
│   │   ├── StudentsPage.tsx
│   │   └── AttendancePage.tsx
│   ├── ems/              # Educator Management
│   │   ├── TeachersPage.tsx
│   │   └── CertificationsPage.tsx
│   ├── sms/              # School Management
│   │   └── FinancePage.tsx
│   ├── privateEd/         # Private Education
│   │   └── PrivateEdDashboardPage.tsx
│   └── common/
│       └── DashboardPage.tsx
├── components/
│   ├── layouts/
│   │   ├── AppLayout.tsx
│   │   ├── Navbar.tsx
│   │   └── Sidebar.tsx
│   └── shared/
│       └── StatusBadge.tsx
├── stores/
│   ├── authStore.ts
│   └── languageStore.ts
├── hooks/
│   └── usePermissions.ts
├── lib/
│   ├── api.ts             # Axios instance
│   ├── i18n.ts            # i18next config
│   └── queryClient.ts     # React Query config
├── types/
│   └── index.ts           # All type definitions
├── locales/
│   ├── en.ts
│   ├── zh.ts
│   └── ms.ts
└── router/
    └── routes.tsx         # Route configuration
```

### Mobile Frontend (`mobile/src/`)
```
src/
├── main.tsx
├── App.tsx
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── parent/
│   │   └── ParentHomePage.tsx
│   ├── student/
│   │   └── StudentHomePage.tsx
│   ├── teacher/
│   │   └── TeacherHomePage.tsx
│   └── common/
│       └── AnnouncementDetailPage.tsx
├── components/
│   ├── AppLayout.tsx
│   ├── NavHeader.tsx
│   ├── RoleTabBar.tsx
│   ├── ChatDrawer.tsx        # AI chat assistant
│   └── NotificationBell.tsx  # Notification icon
├── stores/
│   ├── authStore.ts
│   ├── languageStore.ts
│   └── notificationStore.ts  # Mobile-specific
├── lib/
│   ├── api.ts
│   └── i18n.ts
├── types/
│   └── index.ts
├── locales/
│   ├── en.ts
│   ├── zh.ts
│   └── ms.ts
└── styles/
    └── global.css
```

---

## 🧩 Component Patterns

### Functional Components with Hooks
```tsx
// ✅ CORRECT - Modern pattern
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  userId: string
  onSuccess?: () => void
}

export function UserProfile({ userId, onSuccess }: Props) {
  const { t } = useTranslation()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUser(userId).then(setUser)
  }, [userId])

  return (
    <div className={styles.container}>
      <h1>{t('profile.title')}</h1>
      {/* ... */}
    </div>
  )
}
```

### Type Definitions
```typescript
// ✅ Centralized in types/index.ts
export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  school?: string
  authority?: Authority
}

export type UserRole =
  | 'admin' | 'manager' | 'teacher'
  | 'student' | 'parent' | 'finance' | 'admissions'

export type Authority = 'MOE' | 'MORA' | 'PRIVATE'
```

---

## 🔧 State Management

### Zustand Stores
```typescript
// stores/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'auth-storage' }
  )
)
```

### React Query for Server State
```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,  // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

---

## 📦 Import Order

```tsx
// 1. React & core libraries
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// 2. Third-party libraries
import { Button, Form, Input } from 'antd'
import { User, Settings } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

// 3. Internal imports (relative paths)
import { useAuthStore } from '@/stores/authStore'
import type { User, LoginResponse } from '@/types'
import api from '@/lib/api'

// 4. Styles (CSS Modules)
import styles from './UserProfile.module.css'
```

---

## 🎯 Code Quality Checklist

Before submitting code, verify:

- [ ] **Naming**: PascalCase for components, camelCase for utils
- [ ] **Types**: All props and returns typed explicitly
- [ ] **i18n**: No hardcoded strings visible to users
- [ ] **Imports**: Correct order (React → third-party → internal → styles)
- [ ] **Components**: Pure functional components (no classes)
- [ ] **Files**: Each page in its own directory under `pages/`
- [ ] **Styles**: CSS Modules used, no inline styles for complex layouts
- [ ] **Icons**: Lucide React only, no emoji
- [ ] **Build**: `npm run build` passes without errors

---

**For Trae AI**: Generate code following these patterns exactly. Maintain consistency across all files.
