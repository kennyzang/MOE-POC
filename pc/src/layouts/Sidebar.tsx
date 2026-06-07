import { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardCheck,
  BookOpen,
  Award,
  ClipboardList,
  Briefcase,
  School,
  DollarSign,
  Landmark,
  UserCircle,
  FileText,
  Bell,
  Settings,
  Calendar,
  AlertTriangle,
  CheckSquare,
  SlidersHorizontal,
  Receipt,
  HeartHandshake,
  Brain,
  TrendingUp,
  MessageSquare,
  BookMarked,
  Library,
  Package,
  ShieldAlert,
  UserSquare2,
  ClockCheck,
  ExternalLink,
  UserCog2,
  BarChart3,
  BookUser,
  FileCheck,
  History,
  BellDot,
  Shuffle,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { AUTHORITY_META } from '@/hooks/useSchoolConfig'
import type { UserRole } from '@/types'

const { Sider } = Layout

const icon = (Icon: LucideIcon) => <Icon size={16} />

interface NavItem {
  key: string
  label: string
  icon?: React.ReactNode
  children?: NavItem[]
  roles: UserRole[]
}

const ROLE_HOME: Record<UserRole, string> = {
  admin: '/dashboard',
  manager: '/dashboard',
  finance: '/finance/dashboard',
  admissions: '/sis/admissions',
  teacher: '/dashboard',
  student: '/student/dashboard',
  parent: '/parent/children',
  hod: '/hod/dashboard',
  principal: '/admin/command-center',
  counselor: '/counselor/dashboard',
  priv_ed_officer: '/private-ed/dashboard',
}

const Sidebar = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore(s => s.user)
  const collapsed = useUIStore(s => s.sidebarCollapsed)
  const toggleSidebar = useUIStore(s => s.toggleSidebar)

  const role = user?.role ?? 'student'

  const navItems: NavItem[] = useMemo(
    () => [
      {
        key: '/dashboard',
        label: t('nav.commandCenter'),
        icon: icon(LayoutDashboard),
        roles: ['admin', 'manager', 'finance', 'teacher', 'hod', 'principal'],
      },
      {
        key: '/admin/command-center',
        label: t('nav.commandCenterKpi', { defaultValue: 'Live KPI Center' }),
        icon: icon(LayoutDashboard),
        roles: ['admin', 'principal'],
      },
      {
        key: '/dashboard/at-risk',
        label: t('nav.atRisk'),
        icon: icon(AlertTriangle),
        roles: ['admin', 'manager', 'principal'],
      },
      // SIS - Student Information System
      // counselor navigates SIS exclusively via their portal to avoid duplicates
      {
        key: '/sis',
        label: t('nav.sis'),
        icon: icon(Users),
        roles: ['admin', 'manager', 'admissions', 'teacher', 'principal', 'hod'],
        children: [
          { key: '/sis/students', label: t('nav.sisStudents'), roles: ['admin', 'manager', 'teacher', 'principal', 'hod', 'admissions'] },
          { key: '/sis/admissions', label: t('nav.sisAdmissions'), roles: ['admin', 'manager', 'admissions', 'principal'] },
          { key: '/register', label: 'Public Registration Portal', icon: icon(ExternalLink), roles: ['admin', 'manager', 'admissions', 'principal'] },
          { key: '/sis/grades', label: t('nav.sisGrades'), roles: ['admin', 'manager', 'teacher', 'principal'] },
          { key: '/sis/attendance', label: t('nav.sisAttendance'), roles: ['admin', 'manager', 'teacher', 'principal'] },
          { key: '/sis/fees', label: t('nav.sisFees', { defaultValue: 'Fee Invoices' }), icon: icon(Receipt), roles: ['admin', 'manager', 'finance', 'principal'] },
          { key: '/sis/announcements', label: 'Announcements', icon: icon(Bell), roles: ['admin', 'manager', 'principal', 'hod', 'teacher'] },
          { key: '/sis/behavior', label: 'Behavior & Discipline', icon: icon(ShieldAlert), roles: ['admin', 'manager', 'principal', 'hod'] },
          { key: '/admin/transitions', label: 'Transitions', icon: icon(TrendingUp), roles: ['admin', 'manager', 'principal', 'hod', 'admissions'] },
          { key: '/sen/students', label: t('nav.sen', { defaultValue: 'SEN / IEP' }), icon: icon(Brain), roles: ['admin', 'manager', 'principal', 'hod'] },
        ],
      },
      // EMS - Educator Management System
      // hod navigates EMS exclusively via their portal to avoid duplicates
      {
        key: '/ems',
        label: t('nav.ems'),
        icon: icon(GraduationCap),
        roles: ['admin', 'manager', 'teacher', 'principal'],
        children: [
          { key: '/ems/teachers', label: t('nav.emsTeachers'), roles: ['admin', 'manager', 'principal'] },
          { key: '/ems/my-profile', label: 'My Profile', roles: ['teacher'] },
          { key: '/ems/certifications', label: t('nav.emsCertifications'), roles: ['admin', 'manager'] },
          { key: '/ems/workload', label: t('nav.emsWorkload'), roles: ['admin', 'manager', 'teacher'] },
          { key: '/ems/performance-evaluations', label: t('nav.emsPerformance'), roles: ['admin', 'manager', 'principal', 'teacher'] },
          { key: '/ems/leave', label: 'Leave & Substitutes', roles: ['admin', 'manager', 'principal', 'teacher'] },
          { key: '/ems/leave/balance', label: 'My Leave Balance', roles: ['teacher'] },
          { key: '/ems/leave/calendar', label: 'Leave Calendar', roles: ['admin', 'manager', 'principal'] },
          { key: '/ems/leave/reports', label: 'Leave Reports', roles: ['admin', 'manager', 'principal'] },
          { key: '/ems/cpd-workshops', label: 'CPD Workshops', roles: ['admin', 'manager', 'principal', 'teacher'] },
          { key: '/ems/retirement/dashboard', label: t('nav.retirementMgmt', 'Retirement Mgmt'), roles: ['admin', 'manager', 'principal', 'hod'] },
          { key: '/ems/awards', label: t('nav.awardsRecognition', 'Awards & Recognition'), roles: ['admin', 'manager', 'principal', 'hod'] },
          { key: '/ems/surveys', label: t('nav.surveys', 'Staff Surveys'), roles: ['admin', 'manager', 'principal', 'hod', 'teacher'] },
          { key: '/ems/self-service', label: 'Self-Service Portal', icon: icon(UserCog2), roles: ['admin', 'manager', 'principal', 'hod', 'teacher'] },
          { key: '/ems/postings', label: 'Postings History', roles: ['admin', 'manager', 'principal', 'hod'] },
        ],
      },
      // Attendance
      {
        key: '/attendance',
        label: t('nav.attendance', 'Attendance'),
        icon: icon(ClockCheck),
        roles: ['admin', 'manager', 'principal', 'hod', 'teacher'],
        children: [
          { key: '/attendance/staff-check-in', label: t('nav.staffCheckIn', 'Check In / Out'), roles: ['teacher', 'hod'] },
          { key: '/attendance/staff-history', label: t('nav.staffHistory', 'My Attendance'), roles: ['teacher', 'hod'] },
          { key: '/attendance/staff-dashboard', label: t('nav.staffDashboard', 'Staff Dashboard'), roles: ['admin', 'manager', 'principal', 'hod'] },
        ],
      },
      // SMS - School Management System
      // finance navigates SMS exclusively via their portal; hod via HOD portal
      {
        key: '/sms',
        label: t('nav.sms'),
        icon: icon(School),
        roles: ['admin', 'manager', 'principal', 'teacher'],
        children: [
          { key: '/sms/courses', label: t('nav.smsCourses'), roles: ['admin', 'manager', 'teacher', 'principal'] },
          { key: '/sms/resources', label: t('nav.smsResources'), roles: ['admin', 'manager', 'teacher', 'principal'] },
          { key: '/sms/timetable', label: t('nav.smsTimetable'), icon: icon(Calendar), roles: ['admin', 'manager', 'principal', 'teacher'] },
          { key: '/sms/calendar', label: t('nav.smsCalendar'), roles: ['admin', 'manager', 'principal', 'teacher'] },
          { key: '/sms/finance', label: t('nav.smsFinance'), roles: ['admin', 'manager', 'principal'] },
          { key: '/sms/reports', label: 'Management Reports', icon: icon(BarChart3), roles: ['admin', 'manager', 'principal', 'hod'] },
          { key: '/sms/cca', label: 'CCA', icon: icon(Award), roles: ['admin', 'manager', 'teacher', 'principal'] },
          { key: '/sms/library', label: t('nav.smsLibrary', { defaultValue: 'Library' }), icon: icon(Library), roles: ['admin', 'manager', 'principal', 'teacher'] },
          { key: '/sms/inventory', label: t('nav.smsInventory', { defaultValue: 'Inventory' }), icon: icon(Package), roles: ['admin', 'manager'] },
          { key: '/sms/school-profile', label: t('nav.smsSchoolProfile', { defaultValue: 'School Profile' }), icon: icon(School), roles: ['admin', 'manager', 'principal'] },
          { key: '/sms/exams', label: t('nav.smsExams', { defaultValue: 'Exam Management' }), icon: icon(ClipboardList), roles: ['admin', 'manager', 'principal', 'teacher'] },
          { key: '/sms/consent-forms', label: 'Consent Forms', icon: icon(FileCheck), roles: ['admin', 'manager', 'principal'] },
          { key: '/sms/auto-triggers', label: 'Auto Triggers', icon: icon(BellDot), roles: ['admin', 'manager', 'principal'] },
          { key: '/sms/timetable-conflicts', label: 'Conflict Detection', icon: icon(Shuffle), roles: ['admin', 'manager', 'principal', 'hod'] },
        ],
      },
      // EGNC
      {
        key: '/egnc',
        label: t('nav.egnc'),
        icon: icon(Landmark),
        roles: ['admin', 'manager'],
        children: [
          { key: '/egnc/integration', label: t('nav.egncIntegration'), roles: ['admin', 'manager'] },
        ],
      },
      // Teacher Portal
      {
        key: '/teacher',
        label: 'Teacher Portal',
        icon: icon(UserSquare2),
        roles: ['teacher'],
        children: [
          { key: '/teacher/form-class', label: 'My Form Class', icon: icon(Users), roles: ['teacher'] },
          { key: '/teacher/assignments', label: 'Assignments', icon: icon(BookOpen), roles: ['teacher'] },
          { key: '/teacher/messages', label: 'Messages', icon: icon(MessageSquare), roles: ['teacher'] },
        ],
      },
      // Counselor Portal
      {
        key: '/counselor',
        label: t('nav.counselorPortal', { defaultValue: 'Counselor Portal' }),
        icon: icon(HeartHandshake),
        roles: ['counselor'],
        children: [
          { key: '/counselor/dashboard', label: t('common.dashboard'), roles: ['counselor'] },
          { key: '/counselor/cases', label: t('nav.counselorCases', { defaultValue: 'Case Management' }), roles: ['counselor'] },
          { key: '/dashboard/at-risk', label: t('nav.atRisk'), roles: ['counselor'] },
          { key: '/sis/students', label: t('nav.sisStudents'), roles: ['counselor'] },
          { key: '/sis/behavior', label: 'Behavior Records', icon: icon(ShieldAlert), roles: ['counselor'] },
          { key: '/sen/students', label: t('nav.sen', { defaultValue: 'SEN / IEP' }), icon: icon(Brain), roles: ['counselor'] },
        ],
      },
      // HOD Portal
      {
        key: '/hod',
        label: t('nav.hodPortal', { defaultValue: 'HOD Portal' }),
        icon: icon(TrendingUp),
        roles: ['hod'],
        children: [
          { key: '/hod/dashboard', label: t('common.dashboard'), roles: ['hod'] },
          { key: '/ems/teachers', label: t('nav.emsTeachers'), roles: ['hod'] },
          { key: '/ems/certifications', label: t('nav.emsCertifications'), roles: ['hod'] },
          { key: '/ems/workload', label: t('nav.emsWorkload'), roles: ['hod'] },
          { key: '/ems/performance-evaluations', label: t('nav.emsPerformance'), roles: ['hod'] },
          { key: '/ems/leave', label: 'Leave & Substitutes', roles: ['hod'] },
          { key: '/ems/leave/calendar', label: 'Leave Calendar', roles: ['hod'] },
          { key: '/ems/leave/reports', label: 'Leave Reports', roles: ['hod'] },
          { key: '/ems/cpd-workshops', label: 'CPD Workshops', roles: ['hod'] },
          { key: '/approvals', label: t('nav.approvals', { defaultValue: 'Approvals Inbox' }), roles: ['hod'] },
          { key: '/sms/timetable', label: t('nav.smsTimetable'), roles: ['hod'] },
          { key: '/sms/exams', label: t('nav.smsExams', { defaultValue: 'Exam Management' }), roles: ['hod'] },
          { key: '/dashboard/at-risk', label: t('nav.atRisk'), roles: ['hod'] },
        ],
      },
      // Finance Portal
      {
        key: '/finance',
        label: t('nav.financePortal', { defaultValue: 'Finance Portal' }),
        icon: icon(DollarSign),
        roles: ['finance'],
        children: [
          { key: '/finance/dashboard', label: t('common.dashboard'), roles: ['finance'] },
          { key: '/sms/finance', label: t('nav.smsFinance'), roles: ['finance'] },
          { key: '/sis/fees', label: t('nav.sisFees', { defaultValue: 'Fee Invoices' }), roles: ['finance'] },
          { key: '/sms/library', label: t('nav.smsLibrary', { defaultValue: 'Library' }), icon: icon(Library), roles: ['finance'] },
        ],
      },
      // Student Portal
      {
        key: '/student',
        label: t('nav.studentPortal'),
        icon: icon(UserCircle),
        roles: ['student'],
        children: [
          { key: '/student/dashboard', label: t('common.dashboard'), roles: ['student'] },
          { key: '/student/profile', label: t('nav.studentProfile'), roles: ['student'] },
          { key: '/student/courses', label: t('nav.studentCourses'), roles: ['student'] },
          { key: '/student/grades', label: t('nav.studentGrades'), roles: ['student'] },
          { key: '/student/assignments', label: 'Assignments', icon: icon(BookOpen), roles: ['student'] },
          { key: '/student/announcements', label: 'Announcements', icon: icon(Bell), roles: ['student'] },
          { key: '/student/behavior', label: 'Merit & Conduct', icon: icon(Award), roles: ['student'] },
          { key: '/student/report-card', label: 'Report Card', icon: icon(FileText), roles: ['student'] },
          { key: '/sms/cca', label: 'CCA Activities', icon: icon(BookMarked), roles: ['student'] },
        ],
      },
      // Parent Portal
      {
        key: '/parent',
        label: t('nav.parentPortal'),
        icon: icon(Users),
        roles: ['parent'],
        children: [
          { key: '/parent/children', label: t('nav.parentChildren'), roles: ['parent'] },
          { key: '/parent/fees', label: t('nav.parentFees', { defaultValue: 'Fee Invoices' }), roles: ['parent'] },
          { key: '/parent/homework', label: 'Homework', icon: icon(BookOpen), roles: ['parent'] },
          { key: '/parent/behavior', label: 'Conduct Record', icon: icon(ShieldAlert), roles: ['parent'] },
          { key: '/parent/contact-directory', label: 'School Contacts', icon: icon(BookUser), roles: ['parent'] },
          { key: '/parent/communications', label: 'Communications', icon: icon(MessageSquare), roles: ['parent'] },
          { key: '/parent/apply', label: t('nav.parentApply', { defaultValue: 'Apply for Admission' }), roles: ['parent'] },
        ],
      },
      // Approvals
      {
        key: '/approvals',
        label: t('nav.approvals', { defaultValue: 'Approvals Inbox' }),
        icon: icon(CheckSquare),
        roles: ['admin', 'manager', 'principal'],
      },
      // Multi-School Management (system admin only)
      {
        key: '/admin/schools',
        label: 'All Schools',
        icon: icon(Landmark),
        roles: ['admin'],
      },
      // Private Education Oversight (DPE officer + admin)
      {
        key: '/private-ed',
        label: t('nav.privateEd', { defaultValue: 'Private Education' }),
        icon: icon(ShieldAlert),
        roles: ['priv_ed_officer', 'admin'],
        children: [
          { key: '/private-ed/dashboard', label: t('nav.privateEdDashboard', { defaultValue: 'Oversight Dashboard' }), roles: ['priv_ed_officer', 'admin'] },
        ],
      },
      // Settings
      {
        key: '/settings-group',
        label: t('nav.settings'),
        icon: icon(Settings),
        roles: ['admin'],
        children: [
          { key: '/settings', label: t('nav.settingsGeneral', { defaultValue: 'General' }), roles: ['admin'] },
          { key: '/admin/settings/thresholds', label: t('nav.settingsThresholds', { defaultValue: 'System Thresholds' }), icon: icon(SlidersHorizontal), roles: ['admin'] },
        ],
      },
    ],
    [t]
  )

  const filteredItems = useMemo(() => {
    const filterByRole = (items: NavItem[]): NavItem[] =>
      items
        .filter(item => item.roles.includes(role as UserRole))
        .map(item => ({
          ...item,
          children: item.children ? filterByRole(item.children) : undefined,
        }))
        .filter(item => !item.children || item.children.length > 0)
    return filterByRole(navItems)
  }, [navItems, role])

  const menuItems = filteredItems.map(item => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    children: item.children?.map(child => ({
      key: child.key,
      label: child.label,
    })),
  }))

  const selectedKey = useMemo(() => {
    const path = location.pathname
    const allKeys = filteredItems.flatMap(item =>
      item.children ? item.children.map(c => c.key) : [item.key]
    )
    // Sort longest first so more-specific paths match before shorter prefixes
    const sorted = [...allKeys].sort((a, b) => b.length - a.length)
    return sorted.find(key => path === key || path.startsWith(key + '/')) ?? path
  }, [location.pathname, filteredItems])

  const openKeys = useMemo(() => {
    const path = location.pathname
    return filteredItems
      .filter(item => item.children && item.children.some(c => path === c.key || path.startsWith(c.key + '/')))
      .map(item => item.key)
  }, [location.pathname, filteredItems])

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={240}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 14px' : '0 16px',
          gap: 10,
          cursor: 'pointer',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(180deg, #002a5c 0%, #001d42 100%)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
        onClick={toggleSidebar}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #165DFF 0%, #0040cc 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(22, 93, 255, 0.45)',
          }}
        >
          <School size={18} color="#fff" />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              MOE SERPS
            </div>
            {user?.school ? (
              <div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>
                  {user.school.code}
                </div>
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: 9,
                    fontWeight: 600,
                    background: AUTHORITY_META[user.school.authority]?.color ?? '#888',
                    color: '#fff',
                    borderRadius: 3,
                    padding: '0 4px',
                    marginTop: 2,
                    letterSpacing: 0.3,
                  }}
                >
                  {user.school.authority}
                </div>
              </div>
            ) : user?.systemAdmin ? (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 }}>System Administrator</div>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 }}>School ERP System</div>
            )}
          </div>
        )}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={openKeys}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  )
}

export { ROLE_HOME }
export default Sidebar
