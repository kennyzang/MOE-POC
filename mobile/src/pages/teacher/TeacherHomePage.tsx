import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import { BookOpen, Users } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import PushNotificationBanner from '@/components/PushNotificationBanner'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, TeacherDashboardStats } from '@/types'

export default function TeacherHomePage() {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TeacherDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  return (
    <AppLayout title={t('teacher.title')} showLogout>
      <PushNotificationBanner showTest />
      <div className="welcome-card">
        <div className="welcome-name">
          {t('teacher.welcome')}, {user?.displayName?.split(' ')[0]}
        </div>
        <div className="welcome-sub">{user?.displayName}</div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div className="stat-card">
              <BookOpen size={20} color="#165DFF" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 26 }}>{data?.myCourses ?? 0}</div>
              <div className="stat-label">{t('teacher.myCourses')}</div>
            </div>
            <div className="stat-card">
              <Users size={20} color="#00B42A" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 26, color: '#00B42A' }}>
                {data?.myStudents ?? 0}
              </div>
              <div className="stat-label">{t('teacher.myStudents')}</div>
            </div>
          </div>

          {(data?.upcomingSessions?.length ?? 0) > 0 && (
            <>
              <div className="section-title">{t('teacher.sessions')}</div>
              <List style={{ borderRadius: 12, overflow: 'hidden' }}>
                {data!.upcomingSessions.slice(0, 5).map(session => (
                  <List.Item
                    key={session.id}
                    prefix={
                      <Tag color="primary" style={{ fontSize: 11 }}>{session.course?.code}</Tag>
                    }
                    description={session.course?.name}
                    extra={
                      <span style={{ fontSize: 12, color: '#86909c' }}>
                        {dayjs(session.date).format('DD/MM')}
                      </span>
                    }
                  >
                    {session.topic ?? t('teacher.active')}
                  </List.Item>
                ))}
              </List>
            </>
          )}
        </>
      )}
    </AppLayout>
  )
}
