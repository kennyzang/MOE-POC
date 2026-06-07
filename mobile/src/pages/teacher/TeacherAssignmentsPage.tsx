import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag, Dialog } from 'antd-mobile'
import { FileText, Clock, Users, Plus, ClipboardList } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface Assignment {
  id: string
  courseId: string
  courseName?: string
  courseCode?: string
  title: string
  description?: string
  dueDate: string
  totalSubmissions: number
  maxScore: number
  createdAt: string
}

export default function TeacherAssignmentsPage() {
  const { t } = useTranslation()

  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Assignment[]>>('/assignments')
      return data.data ?? []
    },
  })

  const isOverdue = (date: string) => dayjs(date).isBefore(dayjs(), 'day')

  return (
    <AppLayout title={t('teacher.assignments')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Summary bar */}
        {assignments.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#f0f5ff', borderRadius: 10, padding: '10px 14px',
            marginBottom: 10,
          }}>
            <ClipboardList size={16} color="#165DFF" />
            <span style={{ fontSize: 13, color: '#4c4f54' }}>
              {t('teacher.assignments')}: {assignments.length}
            </span>
            <span style={{ fontSize: 13, color: '#86909c' }}>·</span>
            <span style={{ fontSize: 13, color: '#86909c' }}>
              {assignments.filter(a => isOverdue(a.dueDate)).length} {t('student.overdue').toLowerCase()}
            </span>
          </div>
        )}

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
        ) : assignments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <FileText size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>{t('teacher.noAssignments')}</div>
            <div style={{ fontSize: 12, color: '#c9cdd4', marginTop: 4 }}>
              Tap the + button to create your first assignment
            </div>
          </div>
        ) : (
          assignments.map(assignment => {
            const overdue = isOverdue(assignment.dueDate)

            return (
              <div key={assignment.id} className="assignment-card" style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                borderLeft: overdue ? '3px solid #F53F3F' : '3px solid transparent',
              }}>
                {/* Title row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 14, color: '#1d1d1f',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {assignment.title}
                    </div>
                    {assignment.courseName && (
                      <div style={{ fontSize: 12, color: '#86909c', marginTop: 3 }}>
                        {assignment.courseCode} {assignment.courseName}
                      </div>
                    )}
                  </div>
                  {overdue && (
                    <Tag fill="solid" color="danger" style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
                      {t('student.overdue')}
                    </Tag>
                  )}
                </div>

                {/* Description */}
                {assignment.description && (
                  <div style={{
                    fontSize: 12, color: '#86909c', marginTop: 6,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {assignment.description}
                  </div>
                )}

                {/* Meta row */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 10, paddingTop: 8, borderTop: '1px solid #f5f5f5',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#86909c' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} />
                      {dayjs(assignment.dueDate).format('DD/MM/YYYY')}
                    </span>
                    {assignment.maxScore > 0 && (
                      <span>Max: {assignment.maxScore}</span>
                    )}
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#86909c' }}>
                    <Users size={11} />
                    {assignment.totalSubmissions} {t('teacher.submissions').toLowerCase()}
                  </span>
                </div>
              </div>
            )
          })
        )}

        <div style={{ height: 24 }} />

        {/* FAB */}
        <button
          onClick={() => {
            Dialog.alert({
              content: t('teacher.createAssignment'),
              confirmText: 'OK',
            })
          }}
          style={{
            position: 'fixed', right: 16, bottom: 80,
            width: 48, height: 48, borderRadius: 24,
            background: '#165DFF', color: 'white', border: 'none',
            boxShadow: '0 4px 12px rgba(22,93,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 90,
          }}
          aria-label={t('teacher.newAssignment')}
        >
          <Plus size={22} />
        </button>
      </PullToRefresh>
    </AppLayout>
  )
}
