# ⛔ Hard Rules - MUST OBEY

These rules are **non-negotiable**. Violations will cause build failures, security issues, or inconsistent UX.

---

## 1️⃣ UI Components: Ant Design Only

### ✅ DO:
```tsx
// PC: Use antd components
import { DatePicker, Select, Table } from 'antd'

// Mobile: Use antd-mobile components
import { DatePicker, Picker } from 'antd-mobile'
```

### ❌ DON'T:
```tsx
// NEVER use native HTML form elements
<input type="date" />          // ❌
<select>...</select>            // ❌
<input type="number" />        // ❌
```

---

## 2️⃣ Icons: Lucide React ONLY

### ✅ DO:
```tsx
import { User, Settings, Bell } from 'lucide-react'

// Color via wrapper (Lucide doesn't accept color prop)
<span style={{ color: '#165DFF' }}>
  <User size={20} />
</span>
```

### ❌ DON'T:
```tsx
// NO emoji icons
👤 📧 🔔                              // ❌

// NO other icon libraries
import { Icon } from '@ant-design/icons' // ❌ (use Lucide instead)

// NO direct style/color props on Lucide
<User size={20} style={{ color: 'red' }} /> // ❌ (won't work)
<User size={20} color="red" />             // ❌ (not supported)
```

---

## 3️⃣ Internationalization: All Text Must Use i18n

### ✅ DO:
```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <Button>{t('common.save')}</Button>
    </div>
  )
}
```

### ❌ DON'T:
```tsx
// NO hardcoded strings in JSX
<h1>Welcome to Dashboard</h1>           // ❌
<Button>Save</Button>                   // ❌
<Alert message="Error occurred" />      // ❌

// NO hardcoded strings in logic
const msg = 'Operation successful'       // ❌
```

### Supported Languages:
- `en` - English (default)
- `zh` - Chinese Simplified
- `ms` - Bahasa Melayu (Malay)

---

## 4️⃣ TypeScript: Strict Mode

### ✅ DO:
```tsx
// Proper typing
interface User {
  id: string
  name: string
  role: 'admin' | 'teacher' | 'student' | 'parent'
}

const user: User = await api.get('/user')

// Type guards for API responses
if ('success' in response && response.success) {
  // Safe to access data
}
```

### ❌ DON'T:
```tsx
// NO @ts-ignore
// @ts-ignore                          // ❌
const data = unsafeFunction()

// Minimize any usage
const data: any = fetchData()         // ❌ (use proper types)

// NO implicit any
function processData(data) { ... }    // ❌ (add parameter types)
```

---

## 5️⃣ Data: Dashboard Stats from DB Queries

### ✅ DO:
```tsx
// Fetch real data from backend
const { data } = useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: () => api.get('/api/v1/dashboard/stats')
})

return <Statistic title="Students" value={data?.totalStudents} />
```

### ❌ DON'T:
```tsx
// NO hardcoded fake numbers
<Statistic title="Students" value={1234} />     // ❌

// NO separate mock data for dashboards
const stats = { students: 500, teachers: 50 }   // ❌
```

---

## 6️⃣ Project Separation: PC & Mobile are Independent

### ✅ DO:
```
# Separate projects with own package.json
pc/package.json          # React + antd
mobile/package.json        # Vite + antd-mobile
backend/package.json       # Express + Prisma
```

### ❌ DON'T:
```tsx
// NO responsive design mixing PC and mobile
const isMobile = window.innerWidth < 768  // ❌
return isMobile ? <MobileView /> : <PCView />

// NO shared components between pc/ and mobile/
import { SharedComponent } from '../../pc/src/components'  // ❌
```

---

## 7️⃣ Styling: CSS Modules + Variables

### ✅ DO:
```css
/* styles.module.css */
.container {
  padding: var(--spacing-md);
  background-color: var(--color-background);
  border-radius: var(--radius-lg);
}
```

### ❌ DON'T:
```css
/* NO deep SCSS nesting */
.container {
  .header {
    .title {
      .subtitle { /* Too deep! */ }
    }
  }
}

/* NO inline styles for complex layouts */
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}> {/* ❌ */}
```

---

## 8️⃣ Build Verification: Must Pass Before Commit

### ✅ DO:
```bash
# Always run full build before committing
cd pc && npm run build
cd mobile && npm run build
```

### ❌ DON'T:
```bash
# Don't rely on dev server for type checking
npm run dev  # Dev server skips strict checks!

# Don't skip pre-push hooks
git commit --no-verify  // ❌ Bypasses build check
```

---

## 🐛 Common Anti-Patterns to Avoid

### Recharts Tooltip Formatter
```tsx
// ❌ WRONG - assumes number type
formatter={(value) => value.toFixed(1)}  // Error: value may be undefined

// ✅ CORRECT - handle undefined
formatter={(value) => [(value as number)?.toFixed(1), 'label']}
```

### Axios Headers Access
```typescript
// ❌ WRONG - loose typing
const contentType = response.headers['content-type']  // string | string[] | undefined

// ✅ CORRECT - explicit cast
const contentType = response.headers['content-type'] as string
```

### Prisma Client Usage
```typescript
// ❌ WRONG - creating new client on every request
export async function handler(req, res) {
  const prisma = new PrismaClient()  // Creates connection each time!
}

// ✅ CORRECT - singleton pattern
const globalPrisma = new PrismaClient()
export async function handler(req, res) {
  // Reuse existing client
}
```

---

## 📋 Quick Reference Card

| Rule | Key Point | Penalty |
|------|-----------|----------|
| UI Components | Use **antd** / **antd-mobile** only | Build breaks |
| Icons | **Lucide React** only, no emoji | Inconsistent UX |
| i18n | All text → `t()` function | Missing translations |
| TypeScript | Strict mode, no `@ts-ignore` | Runtime errors |
| Dashboard Data | From DB queries only | Misleading info |
| Project Split | PC ≠ Mobile (separate repos) | Architecture mess |
| Styling | CSS Modules + variables | Maintenance hell |
| Pre-commit | `npm run build` must pass | CI failures |

---

**For Trae AI**: Enforce these rules strictly. Reject any code suggestions that violate them. Ask user for clarification if unsure.
