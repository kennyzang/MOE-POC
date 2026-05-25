import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from '@/layouts/AppLayout'
import ProtectedRoute from '@/layouts/ProtectedRoute'
import PageLoader from '@/components/PageLoader'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useAuthStore } from '@/stores/authStore'
import { ROLE_HOME } from '@/layouts/Sidebar'
import type { UserRole } from '@/types'

const RoleRedirect = () => {
  const { user } = useAuthStore()
  const to = (user && ROLE_HOME[user.role]) ?? '/dashboard'
  return <Navigate to={to} replace />
}

interface RoleRouteProps {
  roles: UserRole[]
  children: React.ReactNode
}
const RoleRoute: React.FC<RoleRouteProps> = ({ roles, children }) => {
  const { user } = useAuthStore()
  if (!user || !roles.includes(user.role)) {
    const to = (user && ROLE_HOME[user.role]) ?? '/login'
    return <Navigate to={to} replace />
  }
  return <>{children}</>
}

const wrap = (el: React.ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>{el}</Suspense>
  </ErrorBoundary>
)
const r = (roles: UserRole[], el: React.ReactNode) =>
  wrap(<RoleRoute roles={roles}>{el}</RoleRoute>)

// Lazy pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))

// SIS
const StudentDirectoryPage = lazy(() => import('@/pages/sis/StudentDirectoryPage'))
const AdmissionsPage = lazy(() => import('@/pages/sis/AdmissionsPage'))
const GradeManagementPage = lazy(() => import('@/pages/sis/GradeManagementPage'))
const AttendanceTrackingPage = lazy(() => import('@/pages/sis/AttendanceTrackingPage'))

// EMS
const TeacherDirectoryPage = lazy(() => import('@/pages/ems/TeacherDirectoryPage'))
const CertificationsPage = lazy(() => import('@/pages/ems/CertificationsPage'))
const TeachingWorkloadPage = lazy(() => import('@/pages/ems/TeachingWorkloadPage'))
const PerformanceEvaluationPage = lazy(() => import('@/pages/ems/PerformanceEvaluationPage'))

// SMS
const CourseManagementPage = lazy(() => import('@/pages/sms/CourseManagementPage'))
const SchoolResourcesPage = lazy(() => import('@/pages/sms/SchoolResourcesPage'))
const FinancialReportsPage = lazy(() => import('@/pages/sms/FinancialReportsPage'))
const TimetablePage = lazy(() => import('@/pages/sms/TimetablePage'))

// EGNC
const EgncIntegrationPage = lazy(() => import('@/pages/egnc/EgncIntegrationPage'))

// Student Portal
const StudentDashboardPage = lazy(() => import('@/pages/dashboard/StudentDashboardPage'))
const StudentProfilePage = lazy(() => import('@/pages/sis/StudentProfilePage'))
const StudentCoursesPage = lazy(() => import('@/pages/sis/StudentCoursesPage'))
const StudentGradesPage = lazy(() => import('@/pages/sis/StudentGradesPage'))

// Parent Portal
const ParentChildrenPage = lazy(() => import('@/pages/dashboard/ParentChildrenPage'))
const ParentGradesPage = lazy(() => import('@/pages/dashboard/ParentGradesPage'))
const ParentAttendancePage = lazy(() => import('@/pages/dashboard/ParentAttendancePage'))

export const router = createBrowserRouter([
  {
    path: '/login',
    element: wrap(<LoginPage />),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <RoleRedirect /> },

      // Command Center
      {
        path: 'dashboard',
        element: r(['admin', 'manager', 'finance'], <DashboardPage />),
      },

      // SIS
      { path: 'sis/students', element: r(['admin', 'manager', 'teacher'], <StudentDirectoryPage />) },
      { path: 'sis/admissions', element: r(['admin', 'manager', 'admissions'], <AdmissionsPage />) },
      { path: 'sis/grades', element: r(['admin', 'manager', 'teacher'], <GradeManagementPage />) },
      { path: 'sis/attendance', element: r(['admin', 'manager', 'teacher'], <AttendanceTrackingPage />) },

      // EMS
      { path: 'ems/teachers', element: r(['admin', 'manager'], <TeacherDirectoryPage />) },
      { path: 'ems/certifications', element: r(['admin', 'manager', 'teacher'], <CertificationsPage />) },
      { path: 'ems/workload', element: r(['admin', 'manager', 'teacher'], <TeachingWorkloadPage />) },
      { path: 'ems/performance-evaluations', element: r(['admin', 'manager', 'hod', 'principal', 'teacher'], <PerformanceEvaluationPage />) },

      // SMS
      { path: 'sms/courses', element: r(['admin', 'manager'], <CourseManagementPage />) },
      { path: 'sms/resources', element: r(['admin', 'manager'], <SchoolResourcesPage />) },
      { path: 'sms/timetable', element: r(['admin', 'manager', 'principal'], <TimetablePage />) },
      { path: 'sms/finance', element: r(['admin', 'manager', 'finance'], <FinancialReportsPage />) },

      // EGNC
      { path: 'egnc/integration', element: r(['admin', 'manager'], <EgncIntegrationPage />) },

      // Student Portal
      { path: 'student/dashboard', element: r(['student'], <StudentDashboardPage />) },
      { path: 'student/profile', element: r(['student'], <StudentProfilePage />) },
      { path: 'student/courses', element: r(['student'], <StudentCoursesPage />) },
      { path: 'student/grades', element: r(['student'], <StudentGradesPage />) },

      // Parent Portal
      { path: 'parent/children', element: r(['parent'], <ParentChildrenPage />) },
      { path: 'parent/grades', element: r(['parent'], <ParentGradesPage />) },
      { path: 'parent/attendance', element: r(['parent'], <ParentAttendancePage />) },

      // Settings
      { path: 'settings', element: r(['admin'], <DashboardPage />) },
    ],
  },
  { path: '*', element: <RoleRedirect /> },
])
