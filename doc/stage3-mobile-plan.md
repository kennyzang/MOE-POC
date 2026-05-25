# Stage 3: Mobile H5 Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile H5 application (Vite + React 18 + antd-mobile 5.x) for three roles — parent, student, teacher — connecting to the existing backend at port 4000.

**Architecture:** Separate Vite project at `mobile/`. Shares backend API. Core patterns (i18n, Zustand auth, axios) copied from `pc/`. antd-mobile TabBar bottom navigation + NavBar header. Two small backend endpoints added (`GET /students/me`, `GET /teachers/me`).

**Tech Stack:** React 18, Vite 5, TypeScript strict, antd-mobile 5.x, Zustand 4, react-router-dom v6, i18next, @tanstack/react-query 5, axios, lucide-react, dayjs.

---

## File Map

**Backend (modified):**
- `backend/src/routes/students.ts` — add `GET /me`
- `backend/src/routes/teachers.ts` — add `GET /me`

**Mobile (all new):**
- `mobile/package.json`
- `mobile/vite.config.ts`
- `mobile/tsconfig.json`
- `mobile/tsconfig.node.json`
- `mobile/index.html`
- `mobile/src/main.tsx`
- `mobile/src/App.tsx`
- `mobile/src/styles/global.css`
- `mobile/src/types/index.ts`
- `mobile/src/lib/api.ts`
- `mobile/src/lib/i18n.ts`
- `mobile/src/stores/authStore.ts`
- `mobile/src/stores/languageStore.ts`
- `mobile/src/locales/en.ts`
- `mobile/src/locales/zh.ts`
- `mobile/src/locales/ms.ts`
- `mobile/src/components/NavHeader.tsx`
- `mobile/src/components/RoleTabBar.tsx`
- `mobile/src/components/AppLayout.tsx`
- `mobile/src/pages/auth/LoginPage.tsx`
- `mobile/src/pages/parent/ParentHomePage.tsx`
- `mobile/src/pages/parent/ParentGradesPage.tsx`
- `mobile/src/pages/parent/ParentAttendancePage.tsx`
- `mobile/src/pages/student/StudentHomePage.tsx`
- `mobile/src/pages/student/StudentProfilePage.tsx`
- `mobile/src/pages/student/StudentCoursesPage.tsx`
- `mobile/src/pages/student/StudentGradesPage.tsx`
- `mobile/src/pages/teacher/TeacherHomePage.tsx`
- `mobile/src/pages/teacher/TeacherClassesPage.tsx`
- `mobile/src/pages/teacher/TeacherAttendancePage.tsx`

---

## Task 0: Backend — Add /me endpoints

**Files:**
- Modify: `backend/src/routes/students.ts`
- Modify: `backend/src/routes/teachers.ts`

- [ ] **Step 1: Add `GET /students/me` — insert before `GET /students/:id`**

In `backend/src/routes/students.ts`, insert this block **before** the `router.get('/:id', ...)` route:

```typescript
// GET /students/me — return the current student's own record
router.get('/me', authenticate, requireRole('student'), async (req: AuthRequest, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.userId },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, email: true, role: true, avatar: true, status: true },
        },
        enrollments: { include: { course: true } },
        grades: { include: { gradeItem: true } },
      },
    })
    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found' })
      return
    }
    res.json({ success: true, data: student })
  } catch (error) {
    console.error('GET /students/me error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})
```

- [ ] **Step 2: Add `GET /teachers/me` — insert before `GET /teachers/:id`**

In `backend/src/routes/teachers.ts`, insert before the `router.get('/:id', ...)` route:

```typescript
// GET /teachers/me — return the current teacher's own record
router.get('/me', authenticate, requireRole('teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user!.userId },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, email: true, role: true, avatar: true, status: true },
        },
        courseAssignments: {
          include: {
            course: { select: { id: true, code: true, name: true, gradeLevel: true, creditHours: true, status: true } },
          },
        },
      },
    })
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher record not found' })
      return
    }
    res.json({ success: true, data: teacher })
  } catch (error) {
    console.error('GET /teachers/me error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})
```

- [ ] **Step 3: Restart backend and verify**

```bash
cd backend && npm run dev
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"adam","password":"Demo@2026"}' | jq '.token' > /tmp/tok.txt

curl -s http://localhost:4000/api/v1/students/me \
  -H "Authorization: Bearer $(cat /tmp/tok.txt | tr -d '"')" | jq '.data.studentId'
# Expected: "S001" or similar
```

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/routes/students.ts src/routes/teachers.ts
git commit -m "feat(backend): add GET /students/me and /teachers/me for mobile app"
```

---

## Task 1: Mobile Project Scaffold

**Files:** `mobile/package.json`, `mobile/vite.config.ts`, `mobile/tsconfig.json`, `mobile/tsconfig.node.json`, `mobile/index.html`

- [ ] **Step 1: Create `mobile/package.json`**

```json
{
  "name": "moe-serps-mobile",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint src --ext ts,tsx",
    "preview": "vite preview"
  },
  "dependencies": {
    "antd-mobile": "^5.39.0",
    "axios": "^1.7.9",
    "@tanstack/react-query": "^5.40.0",
    "i18next": "^23.11.0",
    "react-i18next": "^14.1.0",
    "lucide-react": "^0.400.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0",
    "zustand": "^4.5.2",
    "dayjs": "^1.11.10"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.4.5",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 2: Create `mobile/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
```

- [ ] **Step 3: Create `mobile/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `mobile/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `mobile/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#165DFF" />
    <title>MOE SERPS Mobile</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Install dependencies**

```bash
cd mobile && npm install
```

Expected: `node_modules/` created, no peer dependency errors.

---

## Task 2: Core Infrastructure

**Files:** `mobile/src/types/index.ts`, `mobile/src/lib/api.ts`, `mobile/src/lib/i18n.ts`, `mobile/src/stores/authStore.ts`, `mobile/src/stores/languageStore.ts`, `mobile/src/styles/global.css`

- [ ] **Step 1: Create `mobile/src/types/index.ts`**

```typescript
export type UserRole = 'student' | 'teacher' | 'parent' | 'admin' | 'manager' | 'finance' | 'admissions'

export interface User {
  id: string
  username: string
  displayName: string
  email?: string
  role: UserRole
  avatar?: string
}

export interface LoginResponse {
  success: boolean
  token: string
  user: User
}

export interface Course {
  id: string
  code: string
  name: string
  gradeLevel?: string
  creditHours: number
  status: string
  description?: string
}

export interface CourseAssignment {
  id: string
  courseId: string
  teacherId: string
  semester?: string
  schedule?: string
  course?: Course
}

export interface Enrollment {
  id: string
  studentId: string
  courseId: string
  status: string
  enrolledAt?: string
  course?: Course
}

export interface GradeItem {
  id: string
  courseId: string
  name: string
  type: string
  maxScore: number
  weight: number
  dueDate?: string
}

export interface Grade {
  id: string
  studentId: string
  gradeItemId: string
  score: number | null
  letterGrade?: string
  gradedAt?: string
  gradeItem?: GradeItem & { course?: { name: string; code: string } }
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  status: 'present' | 'absent' | 'late' | 'excused'
  session?: {
    id: string
    date: string
    topic?: string
    course?: { id: string; code: string; name: string }
  }
  student?: { user: { displayName: string } }
}

export interface AttendanceSession {
  id: string
  courseId: string
  date: string
  topic?: string
  status: string
  course?: { id: string; code: string; name: string }
  _count?: { records: number }
}

export interface Teacher {
  id: string
  userId: string
  staffId: string
  designation?: string
  department?: string
  qualification?: string
  subjects?: string
  joinDate?: string
  status: string
  user: User
  courseAssignments?: CourseAssignment[]
}

export interface Student {
  id: string
  userId: string
  studentId: string
  dateOfBirth?: string
  gender?: string
  nationality?: string
  gradeLevel?: string
  className?: string
  enrollmentStatus: string
  user: User
  enrollments?: Enrollment[]
  grades?: Grade[]
}

// Dashboard stat shapes
export interface ParentDashboardStats {
  children: Array<{
    studentId: string
    displayName: string
    gradeLevel?: string
    gpa: number
    attendanceRate: number
  }>
}

export interface StudentDashboardStats {
  enrolledCourses: number
  attendanceRate: number
  gpa: number
  upcomingItems: Array<{
    id: string
    name: string
    type: string
    dueDate?: string
    course?: { name: string; code: string }
  }>
}

export interface TeacherDashboardStats {
  myCourses: number
  myStudents: number
  upcomingSessions: AttendanceSession[]
  recentGrades: Grade[]
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}
```

- [ ] **Step 2: Create `mobile/src/lib/api.ts`**

```typescript
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
})

api.interceptors.request.use(config => {
  const { token } = useAuthStore.getState()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

- [ ] **Step 3: Create `mobile/src/stores/authStore.ts`**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '@/types'

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  hasRole: (...roles: UserRole[]) => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      clearAuth: () => {
        set({ user: null, token: null, isAuthenticated: false })
        localStorage.clear()
        sessionStorage.clear()
      },
      hasRole: (...roles) => {
        const { user } = get()
        return user ? roles.includes(user.role) : false
      },
    }),
    {
      name: 'moe-auth',
      partialize: state => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
```

- [ ] **Step 4: Create `mobile/src/stores/languageStore.ts`**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '@/lib/i18n'

type Language = 'en' | 'zh' | 'ms'

interface LanguageStore {
  language: Language
  setLanguage: (lang: Language) => void
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    set => ({
      language: 'en',
      setLanguage: (language) => {
        set({ language })
        void i18n.changeLanguage(language)
      },
    }),
    { name: 'moe-lang' }
  )
)
```

- [ ] **Step 5: Create `mobile/src/styles/global.css`**

```css
:root {
  --color-primary: #165DFF;
  --color-success: #00B42A;
  --color-warning: #FF7D00;
  --color-error: #F53F3F;
  --color-text: #1d1d1f;
  --color-text-secondary: #86909c;
  --color-bg: #f5f5f5;
  --color-white: #ffffff;
  --adm-color-primary: #165DFF;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
}

/* Mobile safe areas */
.page-content {
  padding: 12px;
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
  min-height: calc(100vh - 45px);
  overflow-y: auto;
}

.stat-card {
  background: var(--color-white);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.welcome-card {
  background: linear-gradient(135deg, #165DFF 0%, #0E42D2 100%);
  border-radius: 16px;
  padding: 20px;
  color: white;
  margin-bottom: 12px;
}

.welcome-name {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
}

.welcome-sub {
  font-size: 13px;
  opacity: 0.85;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
  padding: 0 4px;
}
```

---

## Task 3: Locales + i18n

**Files:** `mobile/src/locales/en.ts`, `mobile/src/locales/zh.ts`, `mobile/src/locales/ms.ts`, `mobile/src/lib/i18n.ts`

- [ ] **Step 1: Create `mobile/src/locales/en.ts`**

```typescript
const en = {
  common: {
    appName: 'MOE SERPS',
    logout: 'Logout',
    loading: 'Loading...',
    noData: 'No data available',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    error: 'Error',
    success: 'Success',
    total: 'Total',
  },
  auth: {
    username: 'Username',
    password: 'Password',
    loginTitle: 'MOE SERPS',
    loginSubtitle: 'School Enterprise Resource Planning System',
    loginButton: 'Sign In',
    loginError: 'Invalid username or password',
  },
  parent: {
    title: 'Parent Portal',
    myChildren: 'My Children',
    grades: 'Grades',
    attendance: 'Attendance',
    gradeLevel: 'Grade Level',
    gpa: 'GPA',
    attendanceRate: 'Attendance',
    viewGrades: 'View Grades',
    viewAttendance: 'View Attendance',
    childGrades: "Child's Grades",
    childAttendance: "Child's Attendance",
    selectChild: 'Select Child',
    noChildren: 'No children linked to your account',
    subject: 'Subject',
    score: 'Score',
    grade: 'Grade',
    date: 'Date',
    status: 'Status',
    sessionTopic: 'Topic',
  },
  student: {
    title: 'Student Portal',
    home: 'Home',
    profile: 'Profile',
    courses: 'Courses',
    grades: 'Grades',
    welcome: 'Welcome back',
    enrolledCourses: 'Courses',
    attendanceRate: 'Attendance',
    gpa: 'GPA',
    upcomingAssessments: 'Upcoming Assessments',
    noUpcoming: 'No upcoming assessments',
    studentId: 'Student ID',
    gradeLevel: 'Grade Level',
    className: 'Class',
    dob: 'Date of Birth',
    gender: 'Gender',
    nationality: 'Nationality',
    enrollmentStatus: 'Status',
    noCourses: 'No enrolled courses',
    courseCode: 'Code',
    creditHours: 'Credit Hours',
    schedule: 'Schedule',
    semester: 'Semester',
    teacher: 'Teacher',
    noGrades: 'No grades available',
    overallGpa: 'Overall GPA',
    assessmentName: 'Assessment',
    type: 'Type',
    maxScore: 'Max Score',
    letterGrade: 'Grade',
    dueDate: 'Due Date',
  },
  teacher: {
    title: 'Teacher Portal',
    home: 'Home',
    classes: 'Classes',
    attendance: 'Attendance',
    welcome: 'Welcome back',
    myCourses: 'My Courses',
    myStudents: 'Students',
    staffId: 'Staff ID',
    department: 'Department',
    designation: 'Designation',
    qualification: 'Qualification',
    noClasses: 'No courses assigned',
    courseCode: 'Code',
    creditHours: 'Credit Hours',
    gradeLevel: 'Grade Level',
    sessions: 'Sessions',
    noSessions: 'No attendance sessions',
    sessionDate: 'Date',
    sessionStatus: 'Status',
    topic: 'Topic',
    recordCount: 'Records',
    active: 'Active',
    completed: 'Completed',
  },
  attendance: {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
  },
}

export default en
```

- [ ] **Step 2: Create `mobile/src/locales/zh.ts`**

```typescript
const zh = {
  common: {
    appName: 'MOE SERPS',
    logout: '退出登录',
    loading: '加载中...',
    noData: '暂无数据',
    back: '返回',
    save: '保存',
    cancel: '取消',
    error: '错误',
    success: '成功',
    total: '合计',
  },
  auth: {
    username: '用户名',
    password: '密码',
    loginTitle: 'MOE SERPS',
    loginSubtitle: '学校企业资源规划系统',
    loginButton: '登录',
    loginError: '用户名或密码错误',
  },
  parent: {
    title: '家长门户',
    myChildren: '我的孩子',
    grades: '成绩',
    attendance: '考勤',
    gradeLevel: '年级',
    gpa: 'GPA',
    attendanceRate: '出勤率',
    viewGrades: '查看成绩',
    viewAttendance: '查看考勤',
    childGrades: '孩子成绩',
    childAttendance: '孩子考勤',
    selectChild: '选择孩子',
    noChildren: '您的账户未关联任何孩子',
    subject: '科目',
    score: '分数',
    grade: '等级',
    date: '日期',
    status: '状态',
    sessionTopic: '主题',
  },
  student: {
    title: '学生门户',
    home: '首页',
    profile: '个人信息',
    courses: '课程',
    grades: '成绩',
    welcome: '欢迎回来',
    enrolledCourses: '课程数',
    attendanceRate: '出勤率',
    gpa: 'GPA',
    upcomingAssessments: '即将到来的考核',
    noUpcoming: '暂无即将到来的考核',
    studentId: '学号',
    gradeLevel: '年级',
    className: '班级',
    dob: '出生日期',
    gender: '性别',
    nationality: '国籍',
    enrollmentStatus: '状态',
    noCourses: '未选修任何课程',
    courseCode: '课程代码',
    creditHours: '学分',
    schedule: '时间安排',
    semester: '学期',
    teacher: '教师',
    noGrades: '暂无成绩',
    overallGpa: '综合GPA',
    assessmentName: '考核名称',
    type: '类型',
    maxScore: '满分',
    letterGrade: '等级',
    dueDate: '截止日期',
  },
  teacher: {
    title: '教师门户',
    home: '首页',
    classes: '课程',
    attendance: '考勤',
    welcome: '欢迎回来',
    myCourses: '我的课程',
    myStudents: '学生数',
    staffId: '工号',
    department: '部门',
    designation: '职称',
    qualification: '学历',
    noClasses: '暂无分配课程',
    courseCode: '课程代码',
    creditHours: '学分',
    gradeLevel: '年级',
    sessions: '课次',
    noSessions: '暂无考勤课次',
    sessionDate: '日期',
    sessionStatus: '状态',
    topic: '主题',
    recordCount: '记录数',
    active: '进行中',
    completed: '已完成',
  },
  attendance: {
    present: '出席',
    absent: '缺席',
    late: '迟到',
    excused: '请假',
  },
}

export default zh
```

- [ ] **Step 3: Create `mobile/src/locales/ms.ts`**

```typescript
const ms = {
  common: {
    appName: 'MOE SERPS',
    logout: 'Log Keluar',
    loading: 'Memuatkan...',
    noData: 'Tiada data',
    back: 'Kembali',
    save: 'Simpan',
    cancel: 'Batal',
    error: 'Ralat',
    success: 'Berjaya',
    total: 'Jumlah',
  },
  auth: {
    username: 'Nama Pengguna',
    password: 'Kata Laluan',
    loginTitle: 'MOE SERPS',
    loginSubtitle: 'Sistem Perancangan Sumber Perusahaan Sekolah',
    loginButton: 'Log Masuk',
    loginError: 'Nama pengguna atau kata laluan tidak sah',
  },
  parent: {
    title: 'Portal Ibu Bapa',
    myChildren: 'Anak-Anak Saya',
    grades: 'Markah',
    attendance: 'Kehadiran',
    gradeLevel: 'Tahun',
    gpa: 'GPA',
    attendanceRate: 'Kehadiran',
    viewGrades: 'Lihat Markah',
    viewAttendance: 'Lihat Kehadiran',
    childGrades: 'Markah Anak',
    childAttendance: 'Kehadiran Anak',
    selectChild: 'Pilih Anak',
    noChildren: 'Tiada anak dikaitkan dengan akaun anda',
    subject: 'Subjek',
    score: 'Skor',
    grade: 'Gred',
    date: 'Tarikh',
    status: 'Status',
    sessionTopic: 'Topik',
  },
  student: {
    title: 'Portal Pelajar',
    home: 'Utama',
    profile: 'Profil',
    courses: 'Kursus',
    grades: 'Markah',
    welcome: 'Selamat kembali',
    enrolledCourses: 'Kursus',
    attendanceRate: 'Kehadiran',
    gpa: 'GPA',
    upcomingAssessments: 'Penilaian Akan Datang',
    noUpcoming: 'Tiada penilaian akan datang',
    studentId: 'No. Pelajar',
    gradeLevel: 'Tahun',
    className: 'Kelas',
    dob: 'Tarikh Lahir',
    gender: 'Jantina',
    nationality: 'Warganegara',
    enrollmentStatus: 'Status',
    noCourses: 'Tiada kursus didaftar',
    courseCode: 'Kod',
    creditHours: 'Kredit',
    schedule: 'Jadual',
    semester: 'Semester',
    teacher: 'Guru',
    noGrades: 'Tiada markah',
    overallGpa: 'GPA Keseluruhan',
    assessmentName: 'Penilaian',
    type: 'Jenis',
    maxScore: 'Markah Penuh',
    letterGrade: 'Gred',
    dueDate: 'Tarikh Akhir',
  },
  teacher: {
    title: 'Portal Guru',
    home: 'Utama',
    classes: 'Kelas',
    attendance: 'Kehadiran',
    welcome: 'Selamat kembali',
    myCourses: 'Kursus Saya',
    myStudents: 'Pelajar',
    staffId: 'No. Staf',
    department: 'Jabatan',
    designation: 'Jawatan',
    qualification: 'Kelayakan',
    noClasses: 'Tiada kursus ditugaskan',
    courseCode: 'Kod',
    creditHours: 'Kredit',
    gradeLevel: 'Tahun',
    sessions: 'Sesi',
    noSessions: 'Tiada sesi kehadiran',
    sessionDate: 'Tarikh',
    sessionStatus: 'Status',
    topic: 'Topik',
    recordCount: 'Rekod',
    active: 'Aktif',
    completed: 'Selesai',
  },
  attendance: {
    present: 'Hadir',
    absent: 'Tidak Hadir',
    late: 'Lewat',
    excused: 'Dimaafkan',
  },
}

export default ms
```

- [ ] **Step 4: Create `mobile/src/lib/i18n.ts`**

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en'
import zh from '@/locales/zh'
import ms from '@/locales/ms'

function getStoredLanguage(): 'en' | 'zh' | 'ms' {
  try {
    const raw = localStorage.getItem('moe-lang')
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { language?: string } }
      const lang = parsed?.state?.language
      if (lang === 'en' || lang === 'zh' || lang === 'ms') return lang
    }
  } catch { /* ignore */ }
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    ms: { translation: ms },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
```

---

## Task 4: App Shell — Routing + Layout Components

**Files:** `mobile/src/main.tsx`, `mobile/src/App.tsx`, `mobile/src/components/NavHeader.tsx`, `mobile/src/components/RoleTabBar.tsx`, `mobile/src/components/AppLayout.tsx`

- [ ] **Step 1: Create `mobile/src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/lib/i18n'
import '@/styles/global.css'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
```

- [ ] **Step 2: Create `mobile/src/components/NavHeader.tsx`**

```typescript
import { NavBar } from 'antd-mobile'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from 'react-i18next'

interface NavHeaderProps {
  title: string
  showBack?: boolean
  showLogout?: boolean
}

export default function NavHeader({ title, showBack = false, showLogout = false }: NavHeaderProps) {
  const navigate = useNavigate()
  const clearAuth = useAuthStore(s => s.clearAuth)
  const { t } = useTranslation()

  const handleLogout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <NavBar
      onBack={showBack ? () => navigate(-1) : undefined}
      back={showBack ? t('common.back') : null}
      right={
        showLogout ? (
          <span
            onClick={handleLogout}
            style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.9)' }}
            title={t('common.logout')}
          >
            <LogOut size={18} />
          </span>
        ) : null
      }
      style={{
        '--height': '45px',
        '--border-bottom': '1px solid rgba(255,255,255,0.2)',
        background: 'linear-gradient(135deg, #165DFF 0%, #0E42D2 100%)',
        color: 'white',
      } as React.CSSProperties}
    >
      {title}
    </NavBar>
  )
}
```

- [ ] **Step 3: Create `mobile/src/components/RoleTabBar.tsx`**

```typescript
import { TabBar } from 'antd-mobile'
import { Home, BookOpen, BarChart2, User, CalendarCheck } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from 'react-i18next'

export default function RoleTabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore(s => s.user)
  const { t } = useTranslation()

  if (!user) return null

  const tabs = {
    parent: [
      { key: '/parent/home', title: t('parent.myChildren'), icon: <Home size={20} /> },
      { key: '/parent/grades', title: t('parent.grades'), icon: <BarChart2 size={20} /> },
      { key: '/parent/attendance', title: t('parent.attendance'), icon: <CalendarCheck size={20} /> },
    ],
    student: [
      { key: '/student/home', title: t('student.home'), icon: <Home size={20} /> },
      { key: '/student/courses', title: t('student.courses'), icon: <BookOpen size={20} /> },
      { key: '/student/grades', title: t('student.grades'), icon: <BarChart2 size={20} /> },
      { key: '/student/profile', title: t('student.profile'), icon: <User size={20} /> },
    ],
    teacher: [
      { key: '/teacher/home', title: t('teacher.home'), icon: <Home size={20} /> },
      { key: '/teacher/classes', title: t('teacher.classes'), icon: <BookOpen size={20} /> },
      { key: '/teacher/attendance', title: t('teacher.attendance'), icon: <CalendarCheck size={20} /> },
    ],
  }

  const roleTabs = tabs[user.role as keyof typeof tabs] ?? []
  if (roleTabs.length === 0) return null

  const activeKey = roleTabs.find(tab => pathname.startsWith(tab.key))?.key ?? roleTabs[0].key

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'white',
      borderTop: '1px solid #e5e5e5',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100,
    }}>
      <TabBar activeKey={activeKey} onChange={key => navigate(key)}>
        {roleTabs.map(tab => (
          <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
        ))}
      </TabBar>
    </div>
  )
}
```

- [ ] **Step 4: Create `mobile/src/components/AppLayout.tsx`**

```typescript
import NavHeader from './NavHeader'
import RoleTabBar from './RoleTabBar'

interface AppLayoutProps {
  title: string
  showBack?: boolean
  showLogout?: boolean
  children: React.ReactNode
}

export default function AppLayout({ title, showBack, showLogout, children }: AppLayoutProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavHeader title={title} showBack={showBack} showLogout={showLogout} />
      <div className="page-content">{children}</div>
      <RoleTabBar />
    </div>
  )
}
```

- [ ] **Step 5: Create `mobile/src/App.tsx`**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import LoginPage from '@/pages/auth/LoginPage'
import ParentHomePage from '@/pages/parent/ParentHomePage'
import ParentGradesPage from '@/pages/parent/ParentGradesPage'
import ParentAttendancePage from '@/pages/parent/ParentAttendancePage'
import StudentHomePage from '@/pages/student/StudentHomePage'
import StudentProfilePage from '@/pages/student/StudentProfilePage'
import StudentCoursesPage from '@/pages/student/StudentCoursesPage'
import StudentGradesPage from '@/pages/student/StudentGradesPage'
import TeacherHomePage from '@/pages/teacher/TeacherHomePage'
import TeacherClassesPage from '@/pages/teacher/TeacherClassesPage'
import TeacherAttendancePage from '@/pages/teacher/TeacherAttendancePage'

function RoleRedirect() {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  const roleHome: Record<string, string> = {
    parent: '/parent/home',
    student: '/student/home',
    teacher: '/teacher/home',
  }
  return <Navigate to={roleHome[user.role] ?? '/login'} replace />
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><RoleRedirect /></RequireAuth>} />

        {/* Parent */}
        <Route path="/parent/home" element={<RequireAuth><ParentHomePage /></RequireAuth>} />
        <Route path="/parent/grades" element={<RequireAuth><ParentGradesPage /></RequireAuth>} />
        <Route path="/parent/attendance" element={<RequireAuth><ParentAttendancePage /></RequireAuth>} />

        {/* Student */}
        <Route path="/student/home" element={<RequireAuth><StudentHomePage /></RequireAuth>} />
        <Route path="/student/profile" element={<RequireAuth><StudentProfilePage /></RequireAuth>} />
        <Route path="/student/courses" element={<RequireAuth><StudentCoursesPage /></RequireAuth>} />
        <Route path="/student/grades" element={<RequireAuth><StudentGradesPage /></RequireAuth>} />

        {/* Teacher */}
        <Route path="/teacher/home" element={<RequireAuth><TeacherHomePage /></RequireAuth>} />
        <Route path="/teacher/classes" element={<RequireAuth><TeacherClassesPage /></RequireAuth>} />
        <Route path="/teacher/attendance" element={<RequireAuth><TeacherAttendancePage /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

---

## Task 5: Login Page

**File:** `mobile/src/pages/auth/LoginPage.tsx`

- [ ] **Step 1: Create `mobile/src/pages/auth/LoginPage.tsx`**

```typescript
import { useState } from 'react'
import { Form, Input, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'
import api from '@/lib/api'
import type { LoginResponse } from '@/types'

type Language = 'en' | 'zh' | 'ms'

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const { language, setLanguage } = useLanguageStore()
  const [loading, setLoading] = useState(false)

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', values)
      if (data.success) {
        setAuth(data.user, data.token)
        const roleHome: Record<string, string> = {
          parent: '/parent/home',
          student: '/student/home',
          teacher: '/teacher/home',
        }
        navigate(roleHome[data.user.role] ?? '/', { replace: true })
      }
    } catch {
      Toast.show({ content: t('auth.loginError'), icon: 'fail', duration: 2000 })
    } finally {
      setLoading(false)
    }
  }

  const langs: { code: Language; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'zh', label: '中' },
    { code: 'ms', label: 'MS' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #165DFF 0%, #0E42D2 40%, #f5f5f5 40%)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Language switcher */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', gap: 8 }}>
        {langs.map(l => (
          <button
            key={l.code}
            onClick={() => { setLanguage(l.code); void i18n.changeLanguage(l.code) }}
            style={{
              padding: '4px 10px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: language === l.code ? 700 : 400,
              background: language === l.code ? 'white' : 'rgba(255,255,255,0.3)',
              color: language === l.code ? '#165DFF' : 'white',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '24px 20px 40px', color: 'white' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 36,
        }}>
          🎓
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>{t('auth.loginTitle')}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>{t('auth.loginSubtitle')}</div>
      </div>

      {/* Form card */}
      <div style={{
        flex: 1, background: '#f5f5f5',
        borderRadius: '24px 24px 0 0',
        padding: 24,
      }}>
        <Form
          onFinish={values => void handleLogin(values as { username: string; password: string })}
          footer={
            <Button
              block
              type="submit"
              color="primary"
              size="large"
              loading={loading}
              style={{ borderRadius: 12, height: 48, fontSize: 16, fontWeight: 600 }}
            >
              {t('auth.loginButton')}
            </Button>
          }
          style={{ '--border-inner': 'none' } as React.CSSProperties}
        >
          <div style={{
            background: 'white', borderRadius: 16,
            overflow: 'hidden', marginBottom: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <Form.Item
              name="username"
              rules={[{ required: true, message: t('auth.username') + ' required' }]}
              style={{ '--border-bottom': '1px solid #f0f0f0' } as React.CSSProperties}
            >
              <Input placeholder={t('auth.username')} clearable />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: t('auth.password') + ' required' }]}
            >
              <Input type="password" placeholder={t('auth.password')} />
            </Form.Item>
          </div>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 32, color: '#86909c', fontSize: 12 }}>
          MOE SERPS v0.1 · Ministry of Education, Brunei
        </div>
      </div>
    </div>
  )
}
```

---

## Task 6: Parent Portal (3 screens)

**Files:** `mobile/src/pages/parent/ParentHomePage.tsx`, `ParentGradesPage.tsx`, `ParentAttendancePage.tsx`

- [ ] **Step 1: Create `mobile/src/pages/parent/ParentHomePage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, Card, Button, Tag } from 'antd-mobile'
import { Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, ParentDashboardStats } from '@/types'

export default function ParentHomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ParentDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  const children = data?.children ?? []

  return (
    <AppLayout title={t('parent.title')} showLogout>
      {/* Welcome */}
      <div className="welcome-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 24,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={24} color="white" />
          </div>
          <div>
            <div className="welcome-name">{user?.displayName}</div>
            <div className="welcome-sub">{t('parent.myChildren')}</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : children.length === 0 ? (
        <Card><div style={{ textAlign: 'center', color: '#86909c', padding: 20 }}>{t('parent.noChildren')}</div></Card>
      ) : (
        children.map(child => (
          <Card
            key={child.studentId}
            style={{ marginBottom: 12, borderRadius: 16 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="#165DFF" />
                <span style={{ fontWeight: 600 }}>{child.displayName}</span>
                {child.gradeLevel && <Tag color="primary" fill="outline">{child.gradeLevel}</Tag>}
              </div>
            }
          >
            <div className="stats-row" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 12 }}>
              <div className="stat-card">
                <div className="stat-value" style={{
                  color: child.attendanceRate >= 80 ? '#00B42A' : child.attendanceRate >= 60 ? '#FF7D00' : '#F53F3F'
                }}>
                  {child.attendanceRate.toFixed(1)}%
                </div>
                <div className="stat-label">{t('parent.attendanceRate')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{child.gpa.toFixed(2)}</div>
                <div className="stat-label">{t('parent.gpa')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                color="primary"
                fill="solid"
                style={{ flex: 1, borderRadius: 8 }}
                onClick={() => navigate('/parent/grades')}
              >
                {t('parent.viewGrades')}
              </Button>
              <Button
                color="primary"
                fill="outline"
                style={{ flex: 1, borderRadius: 8 }}
                onClick={() => navigate('/parent/attendance')}
              >
                {t('parent.viewAttendance')}
              </Button>
            </div>
          </Card>
        ))
      )}
    </AppLayout>
  )
}
```

- [ ] **Step 2: Create `mobile/src/pages/parent/ParentGradesPage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, ParentDashboardStats, Grade } from '@/types'

function gradeColor(letter?: string) {
  if (!letter) return 'default'
  if (letter.startsWith('A')) return 'success'
  if (letter.startsWith('B')) return 'primary'
  if (letter.startsWith('C')) return 'warning'
  return 'danger'
}

export default function ParentGradesPage() {
  const { t } = useTranslation()

  const { data: dashboard } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ParentDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  const firstChildId = dashboard?.children?.[0]?.studentId

  const { data: grades, isLoading } = useQuery({
    queryKey: ['parent-grades', firstChildId],
    enabled: !!firstChildId,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Grade[]>>(`/grades?studentId=${firstChildId}`)
      return data.data
    },
  })

  return (
    <AppLayout title={t('parent.childGrades')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : !grades || grades.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('common.noData')}</div>
      ) : (
        <List header={dashboard?.children?.[0]?.displayName} style={{ borderRadius: 12, overflow: 'hidden' }}>
          {grades.map(grade => (
            <List.Item
              key={grade.id}
              prefix={
                <Tag color={gradeColor(grade.letterGrade ?? undefined)}>
                  {grade.letterGrade ?? 'N/A'}
                </Tag>
              }
              description={grade.gradeItem?.course?.name ?? ''}
              extra={
                <span style={{ color: '#165DFF', fontWeight: 600 }}>
                  {grade.score ?? '-'}/{grade.gradeItem?.maxScore}
                </span>
              }
            >
              {grade.gradeItem?.name ?? '—'}
            </List.Item>
          ))}
        </List>
      )}
    </AppLayout>
  )
}
```

- [ ] **Step 3: Create `mobile/src/pages/parent/ParentAttendancePage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, AttendanceRecord } from '@/types'

const statusColor: Record<string, string> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'default',
}

export default function ParentAttendancePage() {
  const { t } = useTranslation()

  const { data: records, isLoading } = useQuery({
    queryKey: ['parent-attendance'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttendanceRecord[]>>('/attendance/records')
      return data.data
    },
  })

  const totalSessions = records?.length ?? 0
  const presentCount = records?.filter(r => r.status === 'present' || r.status === 'late').length ?? 0
  const rate = totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(1) : '0.0'

  return (
    <AppLayout title={t('parent.childAttendance')} showLogout>
      {/* Summary stats */}
      <div className="stats-row" style={{ marginBottom: 12 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22 }}>{totalSessions}</div>
          <div className="stat-label">{t('common.total')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22, color: '#00B42A' }}>{presentCount}</div>
          <div className="stat-label">{t('attendance.present')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22, color: '#165DFF' }}>{rate}%</div>
          <div className="stat-label">{t('parent.attendanceRate')}</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : !records || records.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('common.noData')}</div>
      ) : (
        <List style={{ borderRadius: 12, overflow: 'hidden' }}>
          {records.map(record => (
            <List.Item
              key={record.id}
              prefix={
                <Tag color={statusColor[record.status] ?? 'default'}>
                  {t(`attendance.${record.status}`)}
                </Tag>
              }
              description={record.session?.course?.name ?? ''}
              extra={
                <span style={{ fontSize: 12, color: '#86909c' }}>
                  {record.session?.date ? dayjs(record.session.date).format('DD/MM/YY') : ''}
                </span>
              }
            >
              {record.session?.topic ?? record.session?.course?.code ?? '—'}
            </List.Item>
          ))}
        </List>
      )}
    </AppLayout>
  )
}
```

---

## Task 7: Student Portal (4 screens)

**Files:** `mobile/src/pages/student/StudentHomePage.tsx`, `StudentProfilePage.tsx`, `StudentCoursesPage.tsx`, `StudentGradesPage.tsx`

- [ ] **Step 1: Create `mobile/src/pages/student/StudentHomePage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import { BookOpen, CalendarCheck, Award } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, StudentDashboardStats } from '@/types'

const typeColor: Record<string, string> = {
  exam: 'danger', quiz: 'warning', assignment: 'primary', project: 'success',
}

export default function StudentHomePage() {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<StudentDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  return (
    <AppLayout title={t('student.title')} showLogout>
      <div className="welcome-card">
        <div className="welcome-name">{t('student.welcome')}, {user?.displayName?.split(' ')[0]}</div>
        <div className="welcome-sub">{user?.displayName}</div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : (
        <>
          <div className="stats-row" style={{ marginBottom: 12 }}>
            <div className="stat-card">
              <BookOpen size={20} color="#165DFF" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22 }}>{data?.enrolledCourses ?? 0}</div>
              <div className="stat-label">{t('student.enrolledCourses')}</div>
            </div>
            <div className="stat-card">
              <CalendarCheck size={20} color="#00B42A" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22, color: '#00B42A' }}>
                {(data?.attendanceRate ?? 0).toFixed(1)}%
              </div>
              <div className="stat-label">{t('student.attendanceRate')}</div>
            </div>
            <div className="stat-card">
              <Award size={20} color="#FF7D00" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22, color: '#FF7D00' }}>
                {(data?.gpa ?? 0).toFixed(2)}
              </div>
              <div className="stat-label">{t('student.gpa')}</div>
            </div>
          </div>

          <div className="section-title">{t('student.upcomingAssessments')}</div>
          {!data?.upcomingItems?.length ? (
            <div style={{ textAlign: 'center', color: '#86909c', padding: 20, background: 'white', borderRadius: 12 }}>
              {t('student.noUpcoming')}
            </div>
          ) : (
            <List style={{ borderRadius: 12, overflow: 'hidden' }}>
              {data.upcomingItems.map(item => (
                <List.Item
                  key={item.id}
                  prefix={<Tag color={typeColor[item.type] ?? 'default'}>{item.type}</Tag>}
                  description={item.course?.name ?? ''}
                  extra={
                    <span style={{ fontSize: 12, color: '#86909c' }}>
                      {item.dueDate ? dayjs(item.dueDate).format('DD/MM') : ''}
                    </span>
                  }
                >
                  {item.name}
                </List.Item>
              ))}
            </List>
          )}
        </>
      )}
    </AppLayout>
  )
}
```

- [ ] **Step 2: Create `mobile/src/pages/student/StudentProfilePage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import { User } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Student } from '@/types'

export default function StudentProfilePage() {
  const { t } = useTranslation()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Student>>('/students/me')
      return data.data
    },
  })

  return (
    <AppLayout title={t('student.profile')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : (
        <>
          {/* Avatar card */}
          <div style={{
            background: 'white', borderRadius: 16, padding: 24,
            textAlign: 'center', marginBottom: 12,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 40,
              background: 'linear-gradient(135deg, #165DFF, #0E42D2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <User size={36} color="white" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{student?.user?.displayName}</div>
            <div style={{ fontSize: 13, color: '#86909c', marginTop: 4 }}>
              {student?.studentId}
            </div>
            <Tag color="primary" fill="outline" style={{ marginTop: 8 }}>
              {student?.enrollmentStatus}
            </Tag>
          </div>

          <List style={{ borderRadius: 12, overflow: 'hidden' }}>
            <List.Item extra={student?.gradeLevel ?? '—'}>{t('student.gradeLevel')}</List.Item>
            <List.Item extra={student?.className ?? '—'}>{t('student.className')}</List.Item>
            <List.Item extra={student?.gender ?? '—'}>{t('student.gender')}</List.Item>
            <List.Item extra={student?.nationality ?? '—'}>{t('student.nationality')}</List.Item>
            <List.Item extra={
              student?.dateOfBirth ? dayjs(student.dateOfBirth).format('DD/MM/YYYY') : '—'
            }>
              {t('student.dob')}
            </List.Item>
            <List.Item extra={student?.user?.email ?? '—'}>{t('common.email', { defaultValue: 'Email' })}</List.Item>
          </List>
        </>
      )}
    </AppLayout>
  )
}
```

- [ ] **Step 3: Create `mobile/src/pages/student/StudentCoursesPage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, Card, Tag } from 'antd-mobile'
import { BookOpen, Clock } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Student } from '@/types'

export default function StudentCoursesPage() {
  const { t } = useTranslation()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Student>>('/students/me')
      return data.data
    },
  })

  const enrollments = student?.enrollments?.filter(e => e.status === 'enrolled') ?? []

  return (
    <AppLayout title={t('student.courses')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : enrollments.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('student.noCourses')}</div>
      ) : (
        enrollments.map(enrollment => (
          <Card
            key={enrollment.id}
            style={{ marginBottom: 12, borderRadius: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {enrollment.course?.name}
                </div>
                <Tag color="primary" fill="outline">{enrollment.course?.code}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#86909c', fontSize: 12 }}>
                <Clock size={12} />
                <span>{enrollment.course?.creditHours} {t('student.creditHours')}</span>
              </div>
            </div>
            {enrollment.course?.gradeLevel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: '#86909c' }}>
                <BookOpen size={13} />
                <span>{t('student.gradeLevel')}: {enrollment.course.gradeLevel}</span>
              </div>
            )}
          </Card>
        ))
      )}
    </AppLayout>
  )
}
```

- [ ] **Step 4: Create `mobile/src/pages/student/StudentGradesPage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag, Card } from 'antd-mobile'
import { Award } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, Grade, StudentDashboardStats } from '@/types'

const gradeColor = (letter?: string) => {
  if (!letter) return 'default'
  if (letter.startsWith('A')) return 'success'
  if (letter.startsWith('B')) return 'primary'
  if (letter.startsWith('C')) return 'warning'
  return 'danger'
}

const typeColor: Record<string, string> = {
  exam: 'danger', quiz: 'warning', assignment: 'primary', project: 'success',
}

export default function StudentGradesPage() {
  const { t } = useTranslation()
  const _user = useAuthStore(s => s.user)

  const { data: stats } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<StudentDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  const { data: grades, isLoading } = useQuery({
    queryKey: ['student-grades'],
    queryFn: async () => {
      // Get student record first to get studentId
      const { data: studentData } = await api.get<ApiResponse<{ id: string }>>('/students/me')
      const studentId = studentData.data.id
      const { data } = await api.get<ApiResponse<Grade[]>>(`/grades?studentId=${studentId}`)
      return data.data
    },
  })

  return (
    <AppLayout title={t('student.grades')} showLogout>
      {/* GPA summary */}
      <Card style={{ borderRadius: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Award size={32} color="#FF7D00" />
          <div>
            <div style={{ fontSize: 12, color: '#86909c' }}>{t('student.overallGpa')}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#FF7D00', lineHeight: 1.1 }}>
              {(stats?.gpa ?? 0).toFixed(2)}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#86909c' }}>{t('student.attendanceRate')}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#00B42A' }}>
              {(stats?.attendanceRate ?? 0).toFixed(1)}%
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : !grades || grades.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('student.noGrades')}</div>
      ) : (
        <List style={{ borderRadius: 12, overflow: 'hidden' }}>
          {grades.map(grade => (
            <List.Item
              key={grade.id}
              prefix={<Tag color={gradeColor(grade.letterGrade ?? undefined)}>{grade.letterGrade ?? '—'}</Tag>}
              description={
                <span>
                  <Tag color={typeColor[grade.gradeItem?.type ?? ''] ?? 'default'} fill="outline" style={{ fontSize: 11 }}>
                    {grade.gradeItem?.type}
                  </Tag>
                  {' '}{grade.gradeItem?.course?.name}
                </span>
              }
              extra={
                <span style={{ color: '#165DFF', fontWeight: 600 }}>
                  {grade.score ?? '—'}/{grade.gradeItem?.maxScore}
                </span>
              }
            >
              {grade.gradeItem?.name}
            </List.Item>
          ))}
        </List>
      )}
    </AppLayout>
  )
}
```

---

## Task 8: Teacher Portal (3 screens)

**Files:** `mobile/src/pages/teacher/TeacherHomePage.tsx`, `TeacherClassesPage.tsx`, `TeacherAttendancePage.tsx`

- [ ] **Step 1: Create `mobile/src/pages/teacher/TeacherHomePage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import { BookOpen, Users } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, TeacherDashboardStats } from '@/types'

export default function TeacherHomePage() {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TeacherDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  return (
    <AppLayout title={t('teacher.title')} showLogout>
      <div className="welcome-card">
        <div className="welcome-name">{t('teacher.welcome')}, {user?.displayName?.split(' ')[0]}</div>
        <div className="welcome-sub">{user?.displayName}</div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : (
        <>
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 12 }}>
            <div className="stat-card">
              <BookOpen size={20} color="#165DFF" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 26 }}>{data?.myCourses ?? 0}</div>
              <div className="stat-label">{t('teacher.myCourses')}</div>
            </div>
            <div className="stat-card">
              <Users size={20} color="#00B42A" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 26, color: '#00B42A' }}>{data?.myStudents ?? 0}</div>
              <div className="stat-label">{t('teacher.myStudents')}</div>
            </div>
          </div>

          {(data?.upcomingSessions ?? []).length > 0 && (
            <>
              <div className="section-title">{t('teacher.sessions')}</div>
              <List style={{ borderRadius: 12, overflow: 'hidden' }}>
                {data!.upcomingSessions.slice(0, 5).map(session => (
                  <List.Item
                    key={session.id}
                    prefix={<Tag color="primary">{session.course?.code}</Tag>}
                    description={session.course?.name}
                    extra={
                      <span style={{ fontSize: 12, color: '#86909c' }}>
                        {dayjs(session.date).format('DD/MM')}
                      </span>
                    }
                  >
                    {session.topic ?? t('teacher.active')}
                  </List.Item>
                ))}
              </List>
            </>
          )}
        </>
      )}
    </AppLayout>
  )
}
```

- [ ] **Step 2: Create `mobile/src/pages/teacher/TeacherClassesPage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, Card, Tag } from 'antd-mobile'
import { BookOpen, Clock } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Teacher } from '@/types'

export default function TeacherClassesPage() {
  const { t } = useTranslation()

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Teacher>>('/teachers/me')
      return data.data
    },
  })

  const assignments = teacher?.courseAssignments ?? []

  return (
    <AppLayout title={t('teacher.classes')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : assignments.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('teacher.noClasses')}</div>
      ) : (
        assignments.map(assignment => (
          <Card
            key={assignment.id}
            style={{ marginBottom: 12, borderRadius: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{assignment.course?.name}</div>
                <Tag color="primary" fill="outline">{assignment.course?.code}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#86909c', fontSize: 12 }}>
                <Clock size={12} />
                <span>{assignment.course?.creditHours} {t('teacher.creditHours')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {assignment.course?.gradeLevel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#86909c' }}>
                  <BookOpen size={12} />
                  <span>{t('teacher.gradeLevel')}: {assignment.course.gradeLevel}</span>
                </div>
              )}
              {assignment.semester && (
                <Tag color="default" fill="outline" style={{ fontSize: 11 }}>
                  {assignment.semester}
                </Tag>
              )}
            </div>
            {assignment.schedule && (
              <div style={{ fontSize: 12, color: '#86909c', marginTop: 6 }}>
                {assignment.schedule}
              </div>
            )}
          </Card>
        ))
      )}
    </AppLayout>
  )
}
```

- [ ] **Step 3: Create `mobile/src/pages/teacher/TeacherAttendancePage.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, AttendanceSession } from '@/types'

export default function TeacherAttendancePage() {
  const { t } = useTranslation()

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['teacher-sessions'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttendanceSession[]>>('/attendance/sessions')
      return data.data
    },
  })

  return (
    <AppLayout title={t('teacher.attendance')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' }} color="primary" />
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('teacher.noSessions')}</div>
      ) : (
        <List style={{ borderRadius: 12, overflow: 'hidden' }}>
          {sessions.map(session => (
            <List.Item
              key={session.id}
              prefix={
                <Tag color={session.status === 'active' ? 'primary' : 'default'}>
                  {session.status === 'active' ? t('teacher.active') : t('teacher.completed')}
                </Tag>
              }
              description={
                <span>
                  {session.course?.name}
                  {session._count?.records !== undefined && (
                    <> · {session._count.records} {t('teacher.recordCount')}</>
                  )}
                </span>
              }
              extra={
                <span style={{ fontSize: 12, color: '#86909c' }}>
                  {dayjs(session.date).format('DD/MM/YY')}
                </span>
              }
            >
              {session.topic ?? session.course?.code ?? '—'}
            </List.Item>
          ))}
        </List>
      )}
    </AppLayout>
  )
}
```

---

## Task 9: TypeScript Verification + Build Check

- [ ] **Step 1: Run TS check**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors. If errors appear, fix them before continuing.

- [ ] **Step 2: Start dev server and verify login**

```bash
cd mobile && npm run dev
# Open http://localhost:3001
```

Verify:
1. Login page renders with language switcher
2. Login as `fatimah` / `Demo@2026` → redirects to `/parent/home`
3. TabBar shows 3 tabs: Children | Grades | Attendance
4. Children list loads with stats
5. Login as `adam` / `Demo@2026` → redirects to `/student/home`
6. Student stats (courses, attendance, GPA) load correctly
7. Login as `drsiti` / `Demo@2026` → redirects to `/teacher/home`
8. Teacher stats load correctly
9. Language switcher changes UI text (EN/中/MS)

- [ ] **Step 3: Check for hardcoded strings**

```bash
cd mobile && grep -r '"[A-Z][a-z]' src/pages/ --include='*.tsx' | grep -v '//' | grep -v 't(' | grep -v 'color' | grep -v 'style'
```

Fix any hardcoded user-visible text found.

- [ ] **Step 4: Commit**

```bash
cd mobile && git add .
cd .. && git add mobile/ backend/src/routes/students.ts backend/src/routes/teachers.ts
git commit -m "feat: Stage 3 complete — mobile H5 app for parent/student/teacher portals"
```

- [ ] **Step 5: Push to both remotes**

```bash
git push origin master
git push github master
```

---

## Demo Verification Steps

| Role | Login | Path | Check |
|------|-------|------|-------|
| Parent | fatimah / Demo@2026 | /parent/home | See child cards with attendance % and GPA |
| Parent | fatimah / Demo@2026 | /parent/grades | See child's grade list |
| Parent | fatimah / Demo@2026 | /parent/attendance | See attendance records with status tags |
| Student | adam / Demo@2026 | /student/home | Stats cards + upcoming assessments |
| Student | adam / Demo@2026 | /student/profile | Personal info list |
| Student | adam / Demo@2026 | /student/courses | Enrolled course cards |
| Student | adam / Demo@2026 | /student/grades | GPA card + grade list |
| Teacher | drsiti / Demo@2026 | /teacher/home | Course count + student count |
| Teacher | drsiti / Demo@2026 | /teacher/classes | Course cards |
| Teacher | drsiti / Demo@2026 | /teacher/attendance | Session list with status |
