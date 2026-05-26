import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Dropdown, Avatar, Space, Select, Button } from 'antd'
import { LogOut, User, Globe, Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'
import { useUIStore } from '@/stores/uiStore'
import { LANGUAGES, type Language } from '@/lib/i18n'
import NotificationBell from '@/components/NotificationBell'

const { Header } = Layout

const PAGE_TITLE_MAP: Record<string, string> = {
  '/dashboard': 'nav.commandCenter',
  '/dashboard/at-risk': 'nav.atRisk',
  '/sis/students': 'nav.sisStudents',
  '/sis/admissions': 'nav.sisAdmissions',
  '/sis/grades': 'nav.sisGrades',
  '/sis/attendance': 'nav.sisAttendance',
  '/ems/teachers': 'nav.emsTeachers',
  '/ems/certifications': 'nav.emsCertifications',
  '/ems/workload': 'nav.emsWorkload',
  '/ems/performance-evaluations': 'nav.emsPerformance',
  '/sms/courses': 'nav.smsCourses',
  '/sms/resources': 'nav.smsResources',
  '/sms/timetable': 'nav.smsTimetable',
  '/sms/calendar': 'nav.smsCalendar',
  '/sms/finance': 'nav.smsFinance',
  '/egnc/integration': 'nav.egncIntegration',
  '/settings': 'nav.settings',
  '/student/dashboard': 'common.dashboard',
  '/student/profile': 'nav.studentProfile',
  '/student/courses': 'nav.studentCourses',
  '/student/grades': 'nav.studentGrades',
  '/parent/children': 'nav.parentChildren',
  '/parent/grades': 'nav.parentGrades',
  '/parent/attendance': 'nav.parentAttendance',
}

const Navbar = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore(s => s.user)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const { language, setLanguage } = useLanguageStore()
  const toggleSidebar = useUIStore(s => s.toggleSidebar)

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const pageTitle = (() => {
    const path = location.pathname
    const key = Object.keys(PAGE_TITLE_MAP)
      .sort((a, b) => b.length - a.length)
      .find(k => path === k || path.startsWith(k + '/'))
    return key ? t(PAGE_TITLE_MAP[key]) : ''
  })()

  const dropdownItems = {
    items: [
      {
        key: 'role',
        label: t(`roles.${user?.role ?? 'student'}`),
        disabled: true,
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        label: t('common.logout'),
        icon: <LogOut size={14} />,
        danger: true,
        onClick: handleLogout,
      },
    ],
  }

  return (
    <Header
      style={{
        background: '#fff',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 99,
      }}
    >
      <Space size={12}>
        <Button
          type="text"
          icon={<Menu size={18} />}
          onClick={toggleSidebar}
          style={{ color: '#4e5969', marginLeft: -4 }}
        />
        {pageTitle && (
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#1d2129',
              borderLeft: '3px solid var(--color-primary)',
              paddingLeft: 10,
            }}
          >
            {pageTitle}
          </span>
        )}
      </Space>

      <Space size={16}>
        <Select
          value={language}
          onChange={(val: Language) => setLanguage(val)}
          style={{ width: 130 }}
          size="small"
          suffixIcon={<Globe size={14} />}
          options={LANGUAGES.map(l => ({
            value: l.code,
            label: l.nativeLabel,
          }))}
        />
        <NotificationBell />
        <Dropdown menu={dropdownItems} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar
              size={32}
              icon={<User size={16} />}
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
            <span style={{ fontWeight: 500 }}>{user?.displayName}</span>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  )
}

export default Navbar
