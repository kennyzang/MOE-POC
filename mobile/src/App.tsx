import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import OfflineBanner from '@/components/OfflineBanner'
import LoginPage from '@/pages/auth/LoginPage'
import ParentHomePage from '@/pages/parent/ParentHomePage'
import ParentGradesPage from '@/pages/parent/ParentGradesPage'
import ParentAttendancePage from '@/pages/parent/ParentAttendancePage'
import ParentMessagesPage from '@/pages/parent/ParentMessagesPage'
import ParentMessageDetailPage from '@/pages/parent/ParentMessageDetailPage'
import StudentHomePage from '@/pages/student/StudentHomePage'
import StudentProfilePage from '@/pages/student/StudentProfilePage'
import StudentCoursesPage from '@/pages/student/StudentCoursesPage'
import StudentGradesPage from '@/pages/student/StudentGradesPage'
import TeacherHomePage from '@/pages/teacher/TeacherHomePage'
import TeacherClassesPage from '@/pages/teacher/TeacherClassesPage'
import TeacherAttendancePage from '@/pages/teacher/TeacherAttendancePage'
import TeacherGradesPage from '@/pages/teacher/TeacherGradesPage'
import TeacherMessagesPage from '@/pages/teacher/TeacherMessagesPage'
import TeacherProfilePage from '@/pages/teacher/TeacherProfilePage'
import TeacherAssignmentsPage from '@/pages/teacher/TeacherAssignmentsPage'
import TeacherAttendanceHistoryPage from '@/pages/teacher/TeacherAttendanceHistoryPage'
import ParentFeesPage from '@/pages/parent/ParentFeesPage'
import ParentHomeworkPage from '@/pages/parent/ParentHomeworkPage'
import ParentBehaviorPage from '@/pages/parent/ParentBehaviorPage'
import ParentMeetingsPage from '@/pages/parent/ParentMeetingsPage'
import StudentAssignmentsPage from '@/pages/student/StudentAssignmentsPage'
import StudentBehaviorPage from '@/pages/student/StudentBehaviorPage'
import StudentReportCardPage from '@/pages/student/StudentReportCardPage'
import AnnouncementDetailPage from '@/pages/common/AnnouncementDetailPage'
import AnnouncementsPage from '@/pages/common/AnnouncementsPage'
import CourseDetailPage from '@/pages/common/CourseDetailPage'

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
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><RoleRedirect /></RequireAuth>} />

        {/* Parent portal */}
        <Route path="/parent/home" element={<RequireAuth><ParentHomePage /></RequireAuth>} />
        <Route path="/parent/grades" element={<RequireAuth><ParentGradesPage /></RequireAuth>} />
        <Route path="/parent/attendance" element={<RequireAuth><ParentAttendancePage /></RequireAuth>} />
        <Route path="/parent/messages" element={<RequireAuth><ParentMessagesPage /></RequireAuth>} />
        <Route path="/parent/messages/detail" element={<RequireAuth><ParentMessageDetailPage /></RequireAuth>} />
        <Route path="/parent/fees" element={<RequireAuth><ParentFeesPage /></RequireAuth>} />
        <Route path="/parent/homework" element={<RequireAuth><ParentHomeworkPage /></RequireAuth>} />
        <Route path="/parent/behavior" element={<RequireAuth><ParentBehaviorPage /></RequireAuth>} />
        <Route path="/parent/meetings" element={<RequireAuth><ParentMeetingsPage /></RequireAuth>} />

        {/* Student portal */}
        <Route path="/student/home" element={<RequireAuth><StudentHomePage /></RequireAuth>} />
        <Route path="/student/profile" element={<RequireAuth><StudentProfilePage /></RequireAuth>} />
        <Route path="/student/courses" element={<RequireAuth><StudentCoursesPage /></RequireAuth>} />
        <Route path="/student/grades" element={<RequireAuth><StudentGradesPage /></RequireAuth>} />
        <Route path="/student/announcements" element={<RequireAuth><AnnouncementsPage /></RequireAuth>} />
        <Route path="/student/assignments" element={<RequireAuth><StudentAssignmentsPage /></RequireAuth>} />
        <Route path="/student/behavior" element={<RequireAuth><StudentBehaviorPage /></RequireAuth>} />
        <Route path="/student/report-card" element={<RequireAuth><StudentReportCardPage /></RequireAuth>} />

        {/* Teacher portal */}
        <Route path="/teacher/home" element={<RequireAuth><TeacherHomePage /></RequireAuth>} />
        <Route path="/teacher/courses" element={<RequireAuth><TeacherClassesPage /></RequireAuth>} />
        <Route path="/teacher/classes" element={<Navigate to="/teacher/courses" replace />} />
        <Route path="/teacher/timetable" element={<Navigate to="/teacher/courses" replace />} />
        <Route path="/teacher/attendance" element={<RequireAuth><TeacherAttendancePage /></RequireAuth>} />
        <Route path="/teacher/grades" element={<RequireAuth><TeacherGradesPage /></RequireAuth>} />
        <Route path="/teacher/announcements" element={<RequireAuth><AnnouncementsPage /></RequireAuth>} />
        <Route path="/teacher/messages" element={<RequireAuth><TeacherMessagesPage /></RequireAuth>} />
        <Route path="/teacher/profile" element={<RequireAuth><TeacherProfilePage /></RequireAuth>} />
        <Route path="/teacher/assignments" element={<RequireAuth><TeacherAssignmentsPage /></RequireAuth>} />
        <Route path="/teacher/attendance/history" element={<RequireAuth><TeacherAttendanceHistoryPage /></RequireAuth>} />

        {/* Common */}
        <Route path="/announcements" element={<RequireAuth><AnnouncementsPage /></RequireAuth>} />
        <Route path="/announcement/detail" element={<RequireAuth><AnnouncementDetailPage /></RequireAuth>} />
        <Route path="/course/detail" element={<RequireAuth><CourseDetailPage /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
