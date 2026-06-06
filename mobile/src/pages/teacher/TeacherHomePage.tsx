import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import { BookOpen, Users, Megaphone, Pin } from 'lucide-react'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import PushNotificationBanner from '@/components/PushNotificationBanner'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, TeacherDashboardStats, Announcement } from '@/types'

export default function TeacherHomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TeacherDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  const { data: announcements } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Announcement[]>>('/announcements')
      return data.data ?? []
    },
  })

  const latestAnnos = (announcements ?? []).slice(0, 3)

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
              <div className="stat-value" style={{ fontSize: 22 }}>{data?.myCourses ?? 0}</div>
              <div className="stat-label">{t('teacher.myCourses')}</div>
            </div>
            <div className="stat-card">
              <Users size={20} color="#00B42A" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22, color: '#00B42A' }}>
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

          {/* Announcements Section */}
          {latestAnnos.length > 0 && (
            <>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <Megaphone size={16} color="#165DFF" />
                {t('announcements.title')}
              </div>
              {latestAnnos.map(anno => (
                <div
                  key={anno.id}
                  className={`anno-card ${anno.priority === 'urgent' ? 'anno-card-urgent' : anno.isPinned ? 'anno-card-pinned' : ''}`}
                  onClick={() => navigate(`/announcement/detail?id=${anno.id}`)}
                >
                  <div className="anno-card-title">
                    {anno.isPinned && <Pin size={12} color="#FF7D00" />}
                    {anno.priority === 'urgent' && (
                      <Tag color="danger" fill="outline" style={{ fontSize: 10, padding: '0 4px' }}>
                        {t('announcements.urgent')}
                      </Tag>
                    )}
                    {anno.title}
                  </div>
                  <div className="anno-card-content">{anno.content}</div>
                  <div className="anno-card-footer">
                    <span>{dayjs(anno.publishedAt).format('DD MMM')}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </AppLayout>
  )
}
