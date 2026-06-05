import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Tabs, Badge } from 'antd'
import { MessageSquare, Megaphone, FileCheck, Calendar } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// Embed the content of existing pages as tab panels
import ParentMessagesPanel from './panels/ParentMessagesPanel'
import ParentAnnouncementsPage from './ParentAnnouncementsPage'
import ParentConsentFormsPage from './ParentConsentFormsPage'
import ParentMeetingsPage from './ParentMeetingsPage'

type TabKey = 'messages' | 'announcements' | 'consent' | 'meetings'

export default function ParentCommunicationsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const initialTab = (params.get('tab') as TabKey | null) ?? 'messages'
  const openThread = params.get('openThread') ?? undefined

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)

  // Unread message count for badge
  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/messages/unread-count')
      return (data.data?.count ?? 0) as number
    },
    refetchInterval: 30000,
  })

  const unreadCount = unreadData ?? 0

  // When URL param changes (e.g., from contacts page), switch tab
  useEffect(() => {
    const p = new URLSearchParams(location.search)
    const tab = p.get('tab') as TabKey | null
    if (tab) setActiveTab(tab)
  }, [location.search])

  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey)
    navigate(`/parent/communications?tab=${key}`, { replace: true })
  }

  const tabIcon = (icon: React.ReactNode, count?: number) =>
    count ? <Badge count={count} size="small">{icon}</Badge> : icon

  const items = [
    {
      key: 'messages',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{tabIcon(<MessageSquare size={14} />, unreadCount)} Messages</span>,
      children: <ParentMessagesPanel openThreadForTeacherUserId={activeTab === 'messages' ? openThread : undefined} />,
    },
    {
      key: 'announcements',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Megaphone size={14} /> Announcements</span>,
      children: <ParentAnnouncementsPage />,
    },
    {
      key: 'consent',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileCheck size={14} /> Consent Forms</span>,
      children: <ParentConsentFormsPage />,
    },
    {
      key: 'meetings',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} /> Book Meeting</span>,
      children: <ParentMeetingsPage />,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={items}
        type="card"
        size="middle"
        style={{ background: '#fff', borderRadius: 8, padding: '12px 16px 0' }}
        tabBarStyle={{ marginBottom: 16 }}
      />
    </div>
  )
}
