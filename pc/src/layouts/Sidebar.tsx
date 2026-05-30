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
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
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
  principal: '/dashboard',
  counselor: '/counselor/dashboard',
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
        label: t('nav.commandCenterKpi', { defaultValue: 'Command Center' }),
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
      {
        key: '/sis',
        label: t('nav.sis'),
        icon: icon(Users),
        roles: ['admin', 'manager', 'admissions', 'teacher'],
        children: [
          { key: '/sis/students', label: t('nav.sisStudents'), roles: ['admin', 'manager', 'teacher'] },
          { key: '/sis/admissions', label: t('nav.sisAdmissions'), roles: ['admin', 'manager', 'admissions'] },
          { key: '/sis/grades', label: t('nav.sisGrades'), roles: ['admin', 'manager', 'teacher'] },
          { key: '/sis/attendance', label: t('nav.sisAttendance'), roles: ['admin', 'manager', 'teacher'] },
          { key: '/sis/fees', label: t('nav.sisFees', { defaultValue: 'Fee Invoices' }), icon: icon(Receipt), roles: ['admin', 'manager', 'finance', 'principal'] },
        ],
      },
      // EMS - Educator Management System
      {
        key: '/ems',
        label: t('nav.ems'),
        icon: icon(GraduationCap),
        roles: ['admin', 'manager', 'teacher', 'hod', 'principal'],
        children: [
          { key: '/ems/teachers', label: t('nav.emsTeachers'), roles: ['admin', 'manager', 'principal', 'hod'] },
          { key: '/ems/certifications', label: t('nav.emsCertifications'), roles: ['admin', 'manager', 'teacher'] },
          { key: '/ems/workload', label: t('nav.emsWorkload'), roles: ['admin', 'manager', 'teacher'] },
          { key: '/ems/performance-evaluations', label: t('nav.emsPerformance'), roles: ['admin', 'manager', 'hod', 'principal', 'teacher'] },
          { key: '/ems/leave', label: 'Leave & Substitutes', roles: ['admin', 'manager', 'hod', 'principal', 'teacher'] },
          { key: '/ems/cpd-workshops', label: 'CPD Workshops', roles: ['admin', 'manager', 'hod', 'principal', 'teacher'] },
        ],
      },
      // SMS - School Management System
      {
        key: '/sms',
        label: t('nav.sms'),
        icon: icon(School),
        roles: ['admin', 'manager', 'finance', 'principal', 'teacher', 'hod'],
        children: [
          { key: '/sms/courses', label: t('nav.smsCourses'), roles: ['admin', 'manager', 'teacher', 'hod', 'principal'] },
          { key: '/sms/resources', label: t('nav.smsResources'), roles: ['admin', 'manager', 'teacher', 'hod', 'principal'] },
          { key: '/sms/timetable', label: t('nav.smsTimetable'), icon: icon(Calendar), roles: ['admin', 'manager', 'principal', 'teacher', 'hod'] },
          { key: '/sms/calendar', label: t('nav.smsCalendar'), roles: ['admin', 'manager', 'principal', 'teacher', 'hod'] },
          { key: '/sms/finance', label: t('nav.smsFinance'), roles: ['admin', 'manager', 'finance'] },
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
          { key: '/ems/performance-evaluations', label: t('nav.emsPerformance'), roles: ['hod'] },
          { key: '/ems/leave', label: 'Leave & Substitutes', roles: ['hod'] },
          { key: '/ems/cpd-workshops', label: 'CPD Workshops', roles: ['hod'] },
          { key: '/approvals', label: t('nav.approvals', { defaultValue: 'Approvals Inbox' }), roles: ['hod'] },
          { key: '/sms/timetable', label: t('nav.smsTimetable'), roles: ['hod'] },
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
          { key: '/parent/grades', label: t('nav.parentGrades'), roles: ['parent'] },
          { key: '/parent/attendance', label: t('nav.parentAttendance'), roles: ['parent'] },
          { key: '/parent/fees', label: t('nav.parentFees', { defaultValue: 'Fee Invoices' }), roles: ['parent'] },
          { key: '/parent/apply', label: t('nav.parentApply', { defaultValue: 'Apply for Admission' }), roles: ['parent'] },
          { key: '/parent/meetings', label: t('nav.parentMeetings', { defaultValue: 'Book Meeting' }), roles: ['parent'] },
        ],
      },
      // Approvals
      {
        key: '/approvals',
        label: t('nav.approvals', { defaultValue: 'Approvals Inbox' }),
        icon: icon(CheckSquare),
        roles: ['admin', 'manager', 'principal'],
      },
      // Settings
      {
        key: '/settings',
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
      .filter(item => item.children && path.startsWith(item.key))
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
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 0.3,
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
              }}
            >
              MOE SERPS
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 11,
                marginTop: 1,
                whiteSpace: 'nowrap',
              }}
            >
              School ERP System
            </div>
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
