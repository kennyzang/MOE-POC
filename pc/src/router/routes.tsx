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
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/unauthorized" replace />
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
const AtRiskPage = lazy(() => import('@/pages/dashboard/AtRiskPage'))
const CommandCenterPage = lazy(() => import('@/pages/dashboard/CommandCenterPage'))

// SIS
const StudentDirectoryPage = lazy(() => import('@/pages/sis/StudentDirectoryPage'))
const StudentDetailPage = lazy(() => import('@/pages/sis/StudentDetailPage'))
const AdmissionsPage = lazy(() => import('@/pages/sis/AdmissionsPage'))
const GradeManagementPage = lazy(() => import('@/pages/sis/GradeManagementPage'))
const AttendanceTrackingPage = lazy(() => import('@/pages/sis/AttendanceTrackingPage'))

// EMS
const TeacherDirectoryPage = lazy(() => import('@/pages/ems/TeacherDirectoryPage'))
const TeacherDetailPage = lazy(() => import('@/pages/ems/TeacherDetailPage'))
const CertificationsPage = lazy(() => import('@/pages/ems/CertificationsPage'))
const TeachingWorkloadPage = lazy(() => import('@/pages/ems/TeachingWorkloadPage'))
const PerformanceEvaluationPage = lazy(() => import('@/pages/ems/PerformanceEvaluationPage'))
const LeaveManagementPage = lazy(() => import('@/pages/ems/LeaveManagementPage'))
const CpdWorkshopsPage = lazy(() => import('@/pages/ems/CpdWorkshopsPage'))

// SMS
const CourseManagementPage = lazy(() => import('@/pages/sms/CourseManagementPage'))
const CourseDetailPage = lazy(() => import('@/pages/sms/CourseDetailPage'))
const SchoolResourcesPage = lazy(() => import('@/pages/sms/SchoolResourcesPage'))
const FinancialReportsPage = lazy(() => import('@/pages/sms/FinancialReportsPage'))
const TimetablePage = lazy(() => import('@/pages/sms/TimetablePage'))
const SchoolCalendarPage = lazy(() => import('@/pages/sms/SchoolCalendarPage'))

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

// Settings
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const ThresholdsPage = lazy(() => import('@/pages/settings/ThresholdsPage'))

// SIS - Fees
const FeesPage = lazy(() => import('@/pages/sis/FeesPage'))

// Approvals
const ApprovalsInboxPage = lazy(() => import('@/pages/approvals/ApprovalsInboxPage'))

// Counselor Portal
const CounselorDashboardPage = lazy(() => import('@/pages/counselor/CounselorDashboardPage'))
const CounselorCasesPage = lazy(() => import('@/pages/counselor/CounselorCasesPage'))

// HOD Portal
const HodDashboardPage = lazy(() => import('@/pages/hod/HodDashboardPage'))

// Finance Portal
const FinanceDashboardPage = lazy(() => import('@/pages/finance/FinanceDashboardPage'))

// Parent Portal additions
const ParentFeesPage = lazy(() => import('@/pages/parent/ParentFeesPage'))
const ParentApplyPage = lazy(() => import('@/pages/parent/ParentApplyPage'))
const ParentMeetingsPage = lazy(() => import('@/pages/parent/ParentMeetingsPage'))

// Error pages
const NotFoundPage = lazy(() => import('@/pages/errors/NotFoundPage'))
const UnauthorizedPage = lazy(() => import('@/pages/errors/UnauthorizedPage'))

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
        element: r(['admin', 'manager', 'finance', 'teacher', 'hod', 'principal'], <DashboardPage />),
      },
      {
        path: 'dashboard/at-risk',
        element: r(['admin', 'manager', 'principal', 'counselor', 'hod'], <AtRiskPage />),
      },
      {
        path: 'admin/command-center',
        element: r(['admin', 'principal'], <CommandCenterPage />),
      },

      // SIS
      { path: 'sis/students', element: r(['admin', 'manager', 'teacher'], <StudentDirectoryPage />) },
      { path: 'sis/students/:id', element: r(['admin', 'manager', 'teacher', 'counselor', 'principal'], <StudentDetailPage />) },
      { path: 'sis/admissions', element: r(['admin', 'manager', 'admissions'], <AdmissionsPage />) },
      { path: 'sis/grades', element: r(['admin', 'manager', 'teacher'], <GradeManagementPage />) },
      { path: 'sis/attendance', element: r(['admin', 'manager', 'teacher'], <AttendanceTrackingPage />) },
      { path: 'sis/fees', element: r(['admin', 'manager', 'finance', 'principal'], <FeesPage />) },

      // EMS
      { path: 'ems/teachers', element: r(['admin', 'manager', 'principal', 'hod'], <TeacherDirectoryPage />) },
      { path: 'ems/teachers/:id', element: r(['admin', 'manager', 'hod', 'principal'], <TeacherDetailPage />) },
      { path: 'ems/certifications', element: r(['admin', 'manager', 'teacher'], <CertificationsPage />) },
      { path: 'ems/workload', element: r(['admin', 'manager', 'teacher'], <TeachingWorkloadPage />) },
      { path: 'ems/performance-evaluations', element: r(['admin', 'manager', 'hod', 'principal', 'teacher'], <PerformanceEvaluationPage />) },
      { path: 'ems/leave', element: r(['admin', 'manager', 'hod', 'principal', 'teacher'], <LeaveManagementPage />) },
      { path: 'ems/cpd-workshops', element: r(['admin', 'manager', 'hod', 'principal', 'teacher'], <CpdWorkshopsPage />) },

      // SMS
      { path: 'sms/courses', element: r(['admin', 'manager', 'teacher', 'hod', 'principal'], <CourseManagementPage />) },
      { path: 'sms/courses/:id', element: r(['admin', 'manager', 'teacher', 'hod', 'principal'], <CourseDetailPage />) },
      { path: 'sms/resources', element: r(['admin', 'manager', 'teacher', 'hod', 'principal'], <SchoolResourcesPage />) },
      { path: 'sms/timetable', element: r(['admin', 'manager', 'principal', 'teacher', 'hod'], <TimetablePage />) },
      { path: 'sms/calendar', element: r(['admin', 'manager', 'principal', 'teacher', 'hod'], <SchoolCalendarPage />) },
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

      // Approvals Inbox
      { path: 'approvals', element: r(['admin', 'manager', 'hod', 'principal'], <ApprovalsInboxPage />) },

      // Counselor Portal
      { path: 'counselor/dashboard', element: r(['counselor', 'admin', 'principal'], <CounselorDashboardPage />) },
      { path: 'counselor/cases', element: r(['counselor', 'admin', 'principal'], <CounselorCasesPage />) },

      // HOD Portal
      { path: 'hod/dashboard', element: r(['hod', 'admin', 'principal'], <HodDashboardPage />) },

      // Finance Portal
      { path: 'finance/dashboard', element: r(['finance', 'admin', 'manager', 'principal'], <FinanceDashboardPage />) },

      // Parent Portal additions
      { path: 'parent/fees', element: r(['parent'], <ParentFeesPage />) },
      { path: 'parent/apply', element: r(['parent'], <ParentApplyPage />) },
      { path: 'parent/meetings', element: r(['parent'], <ParentMeetingsPage />) },

      // Settings
      { path: 'settings', element: r(['admin'], <SettingsPage />) },
      { path: 'admin/settings/thresholds', element: r(['admin'], <ThresholdsPage />) },
    ],
  },
  { path: '/unauthorized', element: wrap(<UnauthorizedPage />) },
  { path: '*', element: wrap(<NotFoundPage />) },
])
