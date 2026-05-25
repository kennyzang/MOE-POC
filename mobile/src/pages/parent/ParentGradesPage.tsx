import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, ParentDashboardStats, Grade } from '@/types'

function gradeColor(letter?: string): string {
  if (!letter) return 'default'
  if (letter.startsWith('A')) return 'success'
  if (letter.startsWith('B')) return 'primary'
  if (letter.startsWith('C')) return 'warning'
  return 'danger'
}

export default function ParentGradesPage() {
  const { t } = useTranslation()

  const { data: dashboard } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ParentDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  const firstChildId = dashboard?.children?.[0]?.studentId
  const firstChildName = dashboard?.children?.[0]?.displayName

  const { data: grades, isLoading } = useQuery({
    queryKey: ['parent-grades', firstChildId],
    enabled: !!firstChildId,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Grade[]>>(`/grades?studentId=${firstChildId}`)
      return data.data
    },
  })

  return (
    <AppLayout title={t('parent.childGrades')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : !grades || grades.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('common.noData')}</div>
      ) : (
        <List
          header={<span style={{ fontWeight: 600 }}>{firstChildName}</span>}
          style={{ borderRadius: 12, overflow: 'hidden' }}
        >
          {grades.map(grade => (
            <List.Item
              key={grade.id}
              prefix={
                <Tag color={gradeColor(grade.letterGrade ?? undefined)}>
                  {grade.letterGrade ?? 'N/A'}
                </Tag>
              }
              description={grade.gradeItem?.course?.name ?? ''}
              extra={
                <span style={{ color: '#165DFF', fontWeight: 600 }}>
                  {grade.score ?? '—'}/{grade.gradeItem?.maxScore}
                </span>
              }
            >
              {grade.gradeItem?.name ?? '—'}
            </List.Item>
          ))}
        </List>
      )}
    </AppLayout>
  )
}
