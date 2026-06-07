import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tabs } from 'antd-mobile'
import { History, MessageSquare, Megaphone, FileCheck, Calendar } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'

interface CommEvent {
  id: string
  eventType: 'message' | 'announcement' | 'consent' | 'meeting'
  title: string
  summary: string
  timestamp: string
  studentId: string | null
  studentName?: string
  meta?: Record<string, unknown>
}

const TYPE_CONFIG: Record<string, { labelKey: string; icon: React.ElementType; color: string; bg: string }> = {
  message: { labelKey: 'parent.messages', icon: MessageSquare, color: '#3b82f6', bg: '#eff6ff' },
  announcement: { labelKey: 'parent.announcements', icon: Megaphone, color: '#8b5cf6', bg: '#f5f3ff' },
  consent: { labelKey: 'parent.consents', icon: FileCheck, color: '#10b981', bg: '#f0fdf4' },
  meeting: { labelKey: 'parent.meetings', icon: Calendar, color: '#f59e0b', bg: '#fffbeb' },
}

function formatRelative(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'Just now'
}

export default function ParentCommHistoryPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'all' | CommEvent['eventType']>('all')

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['parent-comm-history'],
    queryFn: async () => {
      const { data } = await api.get('/parent/comm-history')
      return data.data as CommEvent[]
    },
  })

  let filtered = events
  if (activeTab !== 'all') {
    filtered = filtered.filter((e) => e.eventType === activeTab)
  }

  // Group by date for timeline feel
  const grouped = filtered.reduce<Record<string, CommEvent[]>>((acc, event) => {
    const dateKey = dayjs(event.timestamp).format('DD MMM YYYY')
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(event)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort(
    (a, b) => dayjs(b).valueOf() - dayjs(a).valueOf()
  )

  const typeCounts = {
    message: events.filter(e => e.eventType === 'message').length,
    announcement: events.filter(e => e.eventType === 'announcement').length,
    consent: events.filter(e => e.eventType === 'consent').length,
    meeting: events.filter(e => e.eventType === 'meeting').length,
  }

  return (
    <AppLayout title={t('parent.commHistory')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Filter Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as typeof activeTab)}
          style={{ '--title-font-size': '12px' } as React.CSSProperties}
        >
          <Tabs.Tab key="all" title={`${t('parent.allEvents')} (${events.length})`} />
          <Tabs.Tab key="message" title={`${t(TYPE_CONFIG.message.labelKey)} (${typeCounts.message})`} />
          <Tabs.Tab key="announcement" title={`${t(TYPE_CONFIG.announcement.labelKey)} (${typeCounts.announcement})`} />
          <Tabs.Tab key="consent" title={`${t(TYPE_CONFIG.consent.labelKey)} (${typeCounts.consent})`} />
          <Tabs.Tab key="meeting" title={`${t(TYPE_CONFIG.meeting.labelKey)} (${typeCounts.meeting})`} />
        </Tabs>

        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <Skeleton animated style={{ height: 12, width: '30%', marginBottom: 8 }} />
                <Skeleton animated style={{ height: 14, width: '55%', marginBottom: 6 }} />
                <Skeleton animated style={{ height: 12, width: '80%' }} />
              </div>
            ))}
          </>
        ) : sortedDates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <History size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>{t('parent.noEvents')}</div>
          </div>
        ) : (
          sortedDates.map(dateKey => (
            <div key={dateKey} style={{ marginBottom: 12 }}>
              {/* Date header */}
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#86909c',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: 6, paddingLeft: 2,
              }}>
                {dateKey}
              </div>

              {/* Events under this date */}
              {grouped[dateKey].map(event => {
                const cfg = TYPE_CONFIG[event.eventType] ?? TYPE_CONFIG.message
                const IconComp = cfg.icon

                return (
                  <div key={event.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: 'white', borderRadius: 10, padding: '12px',
                    marginBottom: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}>
                    {/* Timeline dot */}
                    <div style={{
                      width: 30, height: 30, borderRadius: 15,
                      background: cfg.bg, color: cfg.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 2,
                    }}>
                      <IconComp size={13} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13, color: '#1d1d1f',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {event.title}
                      </div>
                      <div style={{
                        fontSize: 11, color: '#86909c', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {event.summary}
                      </div>
                      <div style={{ fontSize: 10, color: '#c9cdd4', marginTop: 4 }}>
                        {formatRelative(event.timestamp)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

        <div style={{ height: 24 }} />
      </PullToRefresh>
    </AppLayout>
  )
}
