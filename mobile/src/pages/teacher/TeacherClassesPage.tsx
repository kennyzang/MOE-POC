import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, Card, Tag } from 'antd-mobile'
import { BookOpen, Clock } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Teacher } from '@/types'

export default function TeacherClassesPage() {
  const { t } = useTranslation()

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Teacher>>('/teachers/me')
      return data.data
    },
  })

  const assignments = teacher?.courseAssignments ?? []

  return (
    <AppLayout title={t('teacher.classes')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : assignments.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('teacher.noClasses')}</div>
      ) : (
        assignments.map(assignment => (
          <Card key={assignment.id} style={{ marginBottom: 12, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  {assignment.course?.name}
                </div>
                <Tag color="primary" fill="outline">{assignment.course?.code}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#86909c', fontSize: 12 }}>
                <Clock size={12} />
                <span>{assignment.course?.creditHours} {t('teacher.creditHours')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {assignment.course?.gradeLevel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#86909c' }}>
                  <BookOpen size={12} />
                  <span>{t('teacher.gradeLevel')}: {assignment.course.gradeLevel}</span>
                </div>
              )}
              {assignment.semester && (
                <Tag color="default" fill="outline" style={{ fontSize: 11 }}>
                  {assignment.semester}
                </Tag>
              )}
            </div>
            {assignment.schedule && (
              <div style={{ fontSize: 12, color: '#86909c', marginTop: 6 }}>
                {assignment.schedule}
              </div>
            )}
          </Card>
        ))
      )}
    </AppLayout>
  )
}
