import { TabBar } from 'antd-mobile'
import { Home, BookOpen, BarChart2, User, CalendarCheck, CalendarDays, FileText } from 'lucide-react'
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
      { key: '/teacher/courses', title: t('teacher.classes'), icon: <CalendarDays size={20} /> },
      { key: '/teacher/grades', title: t('teacher.gradesTab', 'Grades'), icon: <FileText size={20} /> },
      { key: '/teacher/attendance', title: t('teacher.attendance'), icon: <CalendarCheck size={20} /> },
    ],
  }

  const roleTabs = tabs[user.role as keyof typeof tabs] ?? []
  if (roleTabs.length === 0) return null

  const activeKey = roleTabs.find(tab => pathname.startsWith(tab.key))?.key ?? roleTabs[0].key

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
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
