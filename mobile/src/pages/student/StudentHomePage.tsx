import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import { BookOpen, CalendarCheck, Award } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, StudentDashboardStats } from '@/types'

const typeColor: Record<string, string> = {
  exam: 'danger',
  quiz: 'warning',
  assignment: 'primary',
  project: 'success',
}

export default function StudentHomePage() {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<StudentDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  return (
    <AppLayout title={t('student.title')} showLogout>
      <div className="welcome-card">
        <div className="welcome-name">
          {t('student.welcome')}, {user?.displayName?.split(' ')[0]}
        </div>
        <div className="welcome-sub">{user?.displayName}</div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : (
        <>
          <div className="stats-row" style={{ marginBottom: 12 }}>
            <div className="stat-card">
              <BookOpen size={18} color="#165DFF" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22 }}>{data?.enrolledCourses ?? 0}</div>
              <div className="stat-label">{t('student.enrolledCourses')}</div>
            </div>
            <div className="stat-card">
              <CalendarCheck size={18} color="#00B42A" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22, color: '#00B42A' }}>
                {(data?.attendanceRate ?? 0).toFixed(1)}%
              </div>
              <div className="stat-label">{t('student.attendanceRate')}</div>
            </div>
            <div className="stat-card">
              <Award size={18} color="#FF7D00" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22, color: '#FF7D00' }}>
                {(data?.gpa ?? 0).toFixed(2)}
              </div>
              <div className="stat-label">{t('student.gpa')}</div>
            </div>
          </div>

          <div className="section-title">{t('student.upcomingAssessments')}</div>

          {!data?.upcomingItems?.length ? (
            <div style={{
              textAlign: 'center', color: '#86909c', padding: 20,
              background: 'white', borderRadius: 12,
            }}>
              {t('student.noUpcoming')}
            </div>
          ) : (
            <List style={{ borderRadius: 12, overflow: 'hidden' }}>
              {data.upcomingItems.map(item => (
                <List.Item
                  key={item.id}
                  prefix={
                    <Tag color={typeColor[item.type] ?? 'default'} style={{ fontSize: 11 }}>
                      {item.type}
                    </Tag>
                  }
                  description={item.course?.name ?? ''}
                  extra={
                    <span style={{ fontSize: 12, color: '#86909c' }}>
                      {item.dueDate ? dayjs(item.dueDate).format('DD/MM') : ''}
                    </span>
                  }
                >
                  {item.name}
                </List.Item>
              ))}
            </List>
          )}
        </>
      )}
    </AppLayout>
  )
}
