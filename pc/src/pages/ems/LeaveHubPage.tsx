import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, Space, Typography } from 'antd'
import { CalendarDays, FileBarChart, Calendar } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import LeaveManagementPage from './LeaveManagementPage'
import LeaveCalendarPage from './LeaveCalendarPage'
import LeaveReportsPage from './LeaveReportsPage'

const { Title } = Typography

const LeaveHubPage = () => {
  const { user } = useAuthStore()
  const [params, setParams] = useSearchParams()
  const role = user?.role ?? ''

  const canSeeCalendarReports = ['admin', 'manager', 'hod', 'principal'].includes(role)

  const activeTab = params.get('tab') ?? 'applications'
  const handleTabChange = (key: string) => {
    setParams(prev => { prev.set('tab', key); return prev })
  }

  const items = useMemo(() => [
    {
      key: 'applications',
      label: <Space size={6}><CalendarDays size={14} /><span>Leave Applications</span></Space>,
      children: <LeaveManagementPage />,
    },
    ...(canSeeCalendarReports ? [
      {
        key: 'calendar',
        label: <Space size={6}><Calendar size={14} /><span>Leave Calendar</span></Space>,
        children: <LeaveCalendarPage />,
      },
      {
        key: 'reports',
        label: <Space size={6}><FileBarChart size={14} /><span>Reports</span></Space>,
        children: <LeaveReportsPage />,
      },
    ] : []),
  ], [canSeeCalendarReports])

  return (
    <div>
      <Space align="center" size={8} style={{ marginBottom: 16 }}>
        <CalendarDays size={22} />
        <Title level={4} style={{ margin: 0 }}>Leave Hub</Title>
      </Space>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={items}
        destroyInactiveTabPane={false}
      />
    </div>
  )
}

export default LeaveHubPage
