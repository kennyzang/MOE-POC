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

const ROLE_HOME: Record<string, string> = {
  parent: '/parent/home',
  student: '/student/home',
  teacher: '/teacher/home',
}

function RoleRedirect() {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />
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

        {/* Parent portal */}
        <Route path="/parent/home" element={<RequireAuth><ParentHomePage /></RequireAuth>} />
        <Route path="/parent/grades" element={<RequireAuth><ParentGradesPage /></RequireAuth>} />
        <Route path="/parent/attendance" element={<RequireAuth><ParentAttendancePage /></RequireAuth>} />

        {/* Student portal */}
        <Route path="/student/home" element={<RequireAuth><StudentHomePage /></RequireAuth>} />
        <Route path="/student/profile" element={<RequireAuth><StudentProfilePage /></RequireAuth>} />
        <Route path="/student/courses" element={<RequireAuth><StudentCoursesPage /></RequireAuth>} />
        <Route path="/student/grades" element={<RequireAuth><StudentGradesPage /></RequireAuth>} />

        {/* Teacher portal */}
        <Route path="/teacher/home" element={<RequireAuth><TeacherHomePage /></RequireAuth>} />
        <Route path="/teacher/classes" element={<RequireAuth><TeacherClassesPage /></RequireAuth>} />
        <Route path="/teacher/attendance" element={<RequireAuth><TeacherAttendancePage /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
