import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag, Tabs } from 'antd-mobile'
import { BookOpen, Clock, AlertTriangle } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'

interface HomeworkRow {
  assignmentId: string
  title: string
  type: string
  dueDate: string | null
  course: { name: string; code: string }
  studentId: string
  studentName: string
  submitted: boolean
  isLate: boolean
  score: number | null
  status: string
}

const STATUS_CONFIG: Record<string, { color: string; labelKey: string }> = {
  pending: { color: '#FAAD14', labelKey: 'student.pending' },
  overdue: { color: '#F53F3F', labelKey: 'student.overdue' },
  submitted: { color: '#165DFF', labelKey: 'student.assignmentSubmitted' },
  late: { color: '#FF7D00', labelKey: 'parent.lateSubmission' },
  graded: { color: '#00B42A', labelKey: 'parent.graded' },
}

export default function ParentHomeworkPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'overdue'>('all')

  const { data: homework = [], isLoading, refetch } = useQuery({
    queryKey: ['parent-homework'],
    queryFn: async () => {
      const { data } = await api.get('/parent/homework')
      return data.data as HomeworkRow[]
    },
  })

  let filtered = homework
  if (activeTab === 'pending') filtered = filtered.filter((h) => h.status === 'pending')
  if (activeTab === 'overdue') filtered = filtered.filter((h) => h.status === 'overdue')

  // Group by child for display context
  const overdueCount = homework.filter((h) => h.status === 'overdue').length
  const pendingCount = homework.filter((h) => h.status === 'pending').length

  return (
    <AppLayout title={t('parent.homework')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Summary bar */}
        {homework.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#fff7e6', borderRadius: 10, padding: '10px 14px',
            marginBottom: 10,
          }}>
            <AlertTriangle size={16} color="#FAAD14" />
            <span style={{ fontSize: 13, color: '#4c4f54' }}>
              {t('student.overdue')}: {overdueCount} · {t('student.pending')}: {pendingCount}
            </span>
          </div>
        )}

        {/* Filter Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as typeof activeTab)}
          style={{ '--title-font-size': '13px' } as React.CSSProperties}
        >
          <Tabs.Tab key="all" title={`All (${homework.length})`} />
          <Tabs.Tab key="pending" title={`${t('student.pending')} (${pendingCount})`} />
          <Tabs.Tab key="overdue" title={`${t('student.overdue')} (${overdueCount})`} />
        </Tabs>

        {/* Homework List */}
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <Skeleton animated style={{ height: 14, width: '55%', marginBottom: 8 }} />
                <Skeleton animated style={{ height: 12, width: '35%', marginBottom: 10 }} />
                <Skeleton animated style={{ height: 20, width: '70%' }} />
              </div>
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <BookOpen size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>{t('parent.noHomework')}</div>
          </div>
        ) : (
          filtered.map(hw => {
            const cfg = STATUS_CONFIG[hw.status] ?? STATUS_CONFIG.pending
            const isOverdue = hw.status === 'overdue'

            return (
              <div key={hw.assignmentId} className="homework-card" style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                borderLeft: isOverdue ? '3px solid #F53F3F' : hw.submitted ? '3px solid #00B42A' : '3px solid transparent',
              }}>
                {/* Title + Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 14, color: '#1d1d1f',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {hw.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#86909c', marginTop: 3 }}>
                      {hw.studentName} · {hw.course.code} {hw.course.name}
                    </div>
                  </div>
                  <Tag
                    fill="solid"
                    color={
                      hw.status === 'graded' ? 'success' :
                      hw.status === 'submitted' || hw.status === 'late' ? 'primary' :
                      hw.status === 'overdue' ? 'danger' : 'warning'
                    }
                    style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}
                  >
                    {t(cfg.labelKey)}
                  </Tag>
                </div>

                {/* Meta row */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 10, paddingTop: 8, borderTop: '1px solid #f5f5f5',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#86909c' }}>
                    <Clock size={11} />
                    {dayjs(hw.dueDate).format('DD MMM YYYY')}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {hw.score != null && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#00B42A' }}>
                        {hw.score}/100
                      </span>
                    )}
                    {hw.type && (
                      <Tag fill="outline" color="default" style={{ fontSize: 9 }}>{hw.type}</Tag>
                    )}
                  </div>
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
