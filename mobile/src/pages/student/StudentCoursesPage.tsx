import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SpinLoading, Card, Tag } from 'antd-mobile'
import { BookOpen, ChevronRight } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Student } from '@/types'

export default function StudentCoursesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Student>>('/students/me')
      return data.data
    },
  })

  const enrollments = student?.enrollments?.filter(e => e.status === 'enrolled') ?? []

  return (
    <AppLayout title={t('student.courses')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : enrollments.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('student.noCourses')}</div>
      ) : (
        enrollments.map(enrollment => (
          <Card
            key={enrollment.id}
            style={{ marginBottom: 12, borderRadius: 16 }}
            onClick={() => navigate(`/course/detail?courseId=${enrollment.courseId}`)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  {enrollment.course?.name}
                </div>
                <Tag color="primary" fill="outline">{enrollment.course?.code}</Tag>
              </div>
              <ChevronRight size={16} color="#c0c4cc" style={{ flexShrink: 0 }} />
            </div>
            {enrollment.course?.gradeLevel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: '#86909c' }}>
                <BookOpen size={13} />
                <span>{t('student.gradeLevel')}: {enrollment.course.gradeLevel}</span>
              </div>
            )}
          </Card>
        ))
      )}
    </AppLayout>
  )
}
