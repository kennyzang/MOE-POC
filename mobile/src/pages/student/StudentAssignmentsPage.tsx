import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag } from 'antd-mobile'
import { FileText, Clock, BookOpen, ArrowRight } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface StudentAssignment {
  id: string
  courseId: string
  courseName?: string
  courseCode?: string
  title: string
  description?: string
  dueDate: string
  status: 'pending' | 'submitted' | 'overdue' | 'graded'
  score?: number
  maxScore?: number
  submittedAt?: string
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending: { color: '#FAAD14', bg: '#FFF7E6' },
  submitted: { color: '#165DFF', bg: '#E6F4FF' },
  overdue: { color: '#F53F3F', bg: '#FFF1F0' },
  graded: { color: '#00B42A', bg: '#E8F5E9' },
}

export default function StudentAssignmentsPage() {
  const { t } = useTranslation()

  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['student-assignments'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<StudentAssignment[]>>('/student/assignments')
      return data.data ?? []
    },
  })

  // Sort: overdue first, then by due date ascending
  const sorted = [...assignments].sort((a, b) => {
    const order = { overdue: 0, pending: 1, submitted: 2, graded: 3 }
    const aOrder = order[a.status] ?? 99
    const bOrder = order[b.status] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf()
  })

  return (
    <AppLayout title={t('student.assignments')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Status summary pills */}
        {sorted.length > 0 && (
          <div style={{
            display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap',
          }}>
            {(['overdue', 'pending', 'submitted'] as const).map(status => {
              const count = sorted.filter(a => a.status === status).length
              if (count === 0) return null
              const cfg = STATUS_CONFIG[status]
              return (
                <span key={status} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: cfg.bg, color: cfg.color,
                  padding: '4px 10px', borderRadius: 12,
                  fontSize: 11, fontWeight: 600,
                }}>
                  {count} {t(`student.${status}`)}
                </span>
              )
            })}
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
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <FileText size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>{t('student.noStudentAssignments')}</div>
          </div>
        ) : (
          sorted.map(assignment => {
            const cfg = STATUS_CONFIG[assignment.status] ?? STATUS_CONFIG.pending

            return (
              <div key={assignment.id} className="assignment-card" style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                borderLeft: `3px solid ${cfg.color}`,
              }}>
                {/* Title + Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 14, color: '#1d1d1f',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {assignment.title}
                    </div>
                    {assignment.courseName && (
                      <div style={{ fontSize: 12, color: '#86909c', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <BookOpen size={11} />
                        {assignment.courseCode} {assignment.courseName}
                      </div>
                    )}
                  </div>
                  <Tag
                    fill="solid"
                    color={
                      assignment.status === 'overdue' ? 'danger' :
                      assignment.status === 'submitted' ? 'primary' :
                      assignment.status === 'graded' ? 'success' : 'warning'
                    }
                    style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}
                  >
                    {t(`student.${assignment.status === 'submitted' ? 'assignmentSubmitted' : assignment.status}`)}
                  </Tag>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#86909c' }}>
                    <Clock size={11} />
                    {t('student.dueDate')}: {dayjs(assignment.dueDate).format('DD MMM YYYY')}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {assignment.status === 'graded' && assignment.score != null && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#00B42A' }}>
                        {assignment.score}/{assignment.maxScore ?? '?'}
                      </span>
                    )}
                    {(assignment.status === 'pending' || assignment.status === 'overdue') && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 2,
                        fontSize: 11, fontWeight: 600, color: '#165DFF', cursor: 'pointer',
                      }}>
                        {t('student.submitAssignment')} <ArrowRight size={12} />
                      </span>
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
