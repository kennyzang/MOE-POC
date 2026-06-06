import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { SpinLoading, Card, Tag, List } from 'antd-mobile'
import { Users, Clock } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Course } from '@/types'

interface EnrollmentWithStudent {
  id: string
  studentId: string
  courseId: string
  status: string
  enrolledAt?: string
  student: {
    id: string
    userId: string
    studentId: string
    user: {
      displayName: string
    }
  }
}

export default function CourseDetailPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const courseId = searchParams.get('courseId')

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Course>>('/courses/' + courseId)
      return data.data
    },
    enabled: !!courseId,
  })

  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['enrollments', courseId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<EnrollmentWithStudent[]>>('/enrollments', {
        params: { courseId, status: 'active' },
      })
      return data.data
    },
    enabled: !!courseId,
  })

  const isLoading = courseLoading || enrollmentsLoading

  if (isLoading) {
    return (
      <AppLayout title={t('course.detail')} showBack>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <SpinLoading style={{ '--size': '32px' } as React.CSSProperties} color="primary" />
        </div>
      </AppLayout>
    )
  }

  if (!course) {
    return (
      <AppLayout title={t('course.detail')} showBack>
        <div style={{
          textAlign: 'center', color: '#86909c', padding: 60,
          background: 'white', borderRadius: 12,
        }}>
          {t('common.noData')}
        </div>
      </AppLayout>
    )
  }

  const students = enrollments ?? []

  return (
    <AppLayout title={course.name} showBack>
      {/* Course Header Card */}
      <Card style={{ borderRadius: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              {course.name}
            </div>
            <Tag color="primary" fill="outline">{course.code}</Tag>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#86909c', fontSize: 13 }}>
            <Clock size={14} />
            <span>{course.creditHours} {t('course.creditHours')}</span>
          </div>
        </div>

        {course.description && (
          <div style={{ fontSize: 13, color: '#4c4f54', marginTop: 8, lineHeight: 1.6 }}>
            {course.description}
          </div>
        )}
      </Card>

      {/* Enrolled Students Section */}
      <Card style={{ borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#1d1d1f' }}>
          <Users size={16} />
          <span>{t('course.enrolledStudents')}</span>
          <Tag color="primary" fill="outline" style={{ fontSize: 11, marginLeft: 4 }}>
            {students.length}
          </Tag>
        </div>
        {students.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#86909c', padding: 20, fontSize: 14 }}>
            {t('course.noStudents')}
          </div>
        ) : (
          <List>
            {students.map(enrollment => (
              <List.Item key={enrollment.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#f0f5ff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#165dff',
                  }}>
                    {enrollment.student?.user?.displayName?.charAt(0) ?? '?'}
                  </div>
                  <span style={{ fontSize: 14, color: '#1d1d1f' }}>
                    {enrollment.student?.user?.displayName ?? t('common.unknown')}
                  </span>
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </Card>
    </AppLayout>
  )
}
