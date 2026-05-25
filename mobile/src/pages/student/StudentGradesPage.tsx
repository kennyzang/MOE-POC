import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag, Card } from 'antd-mobile'
import { Award } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Grade, Student, StudentDashboardStats } from '@/types'

function gradeColor(letter?: string): string {
  if (!letter) return 'default'
  if (letter.startsWith('A')) return 'success'
  if (letter.startsWith('B')) return 'primary'
  if (letter.startsWith('C')) return 'warning'
  return 'danger'
}

const typeColor: Record<string, string> = {
  exam: 'danger',
  quiz: 'warning',
  assignment: 'primary',
  project: 'success',
}

export default function StudentGradesPage() {
  const { t } = useTranslation()

  const { data: stats } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<StudentDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Student>>('/students/me')
      return data.data
    },
  })

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ['student-grades', student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Grade[]>>(`/grades?studentId=${student!.id}`)
      return data.data
    },
  })

  const loading = isLoading || gradesLoading

  return (
    <AppLayout title={t('student.grades')} showLogout>
      {/* GPA summary */}
      <Card style={{ borderRadius: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Award size={32} color="#FF7D00" />
          <div>
            <div style={{ fontSize: 12, color: '#86909c' }}>{t('student.overallGpa')}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#FF7D00', lineHeight: 1.1 }}>
              {(stats?.gpa ?? 0).toFixed(2)}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#86909c' }}>{t('student.attendanceRate')}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#00B42A' }}>
              {(stats?.attendanceRate ?? 0).toFixed(1)}%
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : !grades || grades.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('student.noGrades')}</div>
      ) : (
        <List style={{ borderRadius: 12, overflow: 'hidden' }}>
          {grades.map(grade => (
            <List.Item
              key={grade.id}
              prefix={
                <Tag color={gradeColor(grade.letterGrade ?? undefined)}>
                  {grade.letterGrade ?? '—'}
                </Tag>
              }
              description={
                <span>
                  {grade.gradeItem?.type && (
                    <Tag
                      color={typeColor[grade.gradeItem.type] ?? 'default'}
                      fill="outline"
                      style={{ fontSize: 11, marginRight: 4 }}
                    >
                      {grade.gradeItem.type}
                    </Tag>
                  )}
                  {grade.gradeItem?.course?.name}
                </span>
              }
              extra={
                <span style={{ color: '#165DFF', fontWeight: 600 }}>
                  {grade.score ?? '—'}/{grade.gradeItem?.maxScore}
                </span>
              }
            >
              {grade.gradeItem?.name}
            </List.Item>
          ))}
        </List>
      )}
    </AppLayout>
  )
}
