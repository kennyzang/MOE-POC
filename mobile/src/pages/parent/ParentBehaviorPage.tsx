import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag, Tabs } from 'antd-mobile'
import { Award, AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, Bell } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'

interface BehaviorRecord {
  id: string
  type: string
  category: string
  points: number
  description: string
  actionTaken: string | null
  severity: string | null
  parentNotified: boolean
  date: string
  student: { user: { displayName: string } }
  recordedBy: { displayName: string; role: string }
}

const CATEGORY_LABELS: Record<string, string> = {
  academic: 'Academic',
  conduct: 'Conduct',
  attendance: 'Attendance',
  achievement: 'Achievement',
  other: 'Other',
}

export default function ParentBehaviorPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'all' | 'merit' | 'demerit'>('all')

  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ['parent-behavior'],
    queryFn: async () => {
      const { data } = await api.get('/parent/behavior')
      return data.data as BehaviorRecord[]
    },
  })

  const filtered = activeTab === 'all' ? records : records.filter((r) => r.type === activeTab)

  const totalMerits = records.filter((r) => r.type === 'merit').reduce((s, r) => s + r.points, 0)
  const totalDemerits = records.filter((r) => r.type === 'demerit').reduce((s, r) => s + Math.abs(r.points), 0)
  const netPoints = totalMerits - totalDemerits

  const getIcon = (type: string) => {
    if (type === 'merit') return <Award size={13} color="#00B42A" />
    if (type === 'demerit') return <AlertTriangle size={13} color="#F53F3F" />
    return <ShieldAlert size={13} color="#86909c" />
  }

  return (
    <AppLayout title={t('parent.behavior')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Summary Cards */}
        {!isLoading && records.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              {
                label: t('student.netPoints'),
                value: netPoints >= 0 ? `+${netPoints}` : `${netPoints}`,
                icon: netPoints >= 0 ? <TrendingUp size={15} color="#00B42A" /> : <TrendingDown size={15} color="#F53F3F" />,
                color: netPoints >= 0 ? '#00B42A' : '#F53F3F',
                bg: netPoints >= 0 ? '#E8F5E9' : '#FFF1F0',
              },
              {
                label: t('student.merits'),
                value: `+${totalMerits}`,
                icon: <Award size={15} color="#00B42A" />,
                color: '#00B42A', bg: '#E8F5E9',
              },
              {
                label: t('student.demerits'),
                value: `-${totalDemerits}`,
                icon: <AlertTriangle size={15} color="#F53F3F" />,
                color: '#F53F3F', bg: '#FFF1F0',
              },
          ].map(item => (
              <div key={item.label} style={{
                background: item.bg, borderRadius: 12,
                padding: '12px 6px', textAlign: 'center',
              }}>
                <div style={{ color: item.color, marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 9, color: '#86909c', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as typeof activeTab)}
          style={{ '--title-font-size': '13px' } as React.CSSProperties}
        >
          <Tabs.Tab key="all" title={`All (${records.length})`} />
          <Tabs.Tab key="merit" title={`${t('student.merits')} (${records.filter(r => r.type === 'merit').length})`} />
          <Tabs.Tab key="demerit" title={`${t('student.demerits')} (${records.filter(r => r.type === 'demerit').length})`} />
        </Tabs>

        {/* Record List */}
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <Skeleton animated style={{ height: 14, width: '50%', marginBottom: 6 }} />
                <Skeleton animated style={{ height: 12, width: '70%', marginBottom: 8 }} />
                <Skeleton animated style={{ height: 20, width: '90%' }} />
              </div>
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <ShieldAlert size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>{t('student.noBehaviorRecords')}</div>
          </div>
        ) : (
          filtered.map(record => {
            const isMerit = record.type === 'merit'

            return (
              <div key={record.id} className="behavior-card" style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                borderLeft: `3px solid ${isMerit ? '#00B42A' : '#F53F3F'}`,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 13, color: '#1d1d1f',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {record.description}
                    </div>
                    <div style={{ fontSize: 11, color: '#86909c', marginTop: 2 }}>
                      {record.student.user.displayName} · {CATEGORY_LABELS[record.category] ?? record.category}
                    </div>
                  </div>
                  <Tag
                    fill={isMerit ? 'solid' : 'outline'}
                    color={isMerit ? 'success' : 'danger'}
                    style={{ fontSize: 10, flexShrink: 0, marginLeft: 6 }}
                  >
                    {isMerit ? `+${record.points}` : `-${Math.abs(record.points)}`}
                  </Tag>
                </div>

                {/* Meta info */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 3,
                  marginTop: 8, fontSize: 11, color: '#86909c',
                }}>
                  <span>{dayjs(record.date).format('DD MMM YYYY')}</span>
                  {record.actionTaken && (
                    <span>{t('student.behaviorAction')}: {record.actionTaken}</span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {getIcon(record.type)} {t('student.behaviorRecord')}: {record.recordedBy.displayName}
                    {record.parentNotified && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 6, color: '#165DFF' }}>
                        <Bell size={9} /> {t('parent.parentNotified')}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )
          })
        )}

        <div style={{ height: 24 }} />
      </PullToRefresh>
    </AppLayout>
  )
}
