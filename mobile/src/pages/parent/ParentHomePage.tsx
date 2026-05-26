import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, Card, Button, Tag } from 'antd-mobile'
import { Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import PushNotificationBanner from '@/components/PushNotificationBanner'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, ParentDashboardStats } from '@/types'

export default function ParentHomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ParentDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  const children = data?.children ?? []

  return (
    <AppLayout title={t('parent.title')} showLogout>
      <PushNotificationBanner showTest />
      <div className="welcome-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 24,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={24} color="white" />
          </div>
          <div>
            <div className="welcome-name">{user?.displayName}</div>
            <div className="welcome-sub">{t('parent.myChildren')}</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : children.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', color: '#86909c', padding: 20 }}>
            {t('parent.noChildren')}
          </div>
        </Card>
      ) : (
        children.map(child => (
          <Card
            key={child.studentId}
            style={{ marginBottom: 12, borderRadius: 16 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="#165DFF" />
                <span style={{ fontWeight: 600 }}>{child.displayName}</span>
                {child.gradeLevel && (
                  <Tag color="primary" fill="outline" style={{ fontSize: 11 }}>
                    {child.gradeLevel}
                  </Tag>
                )}
              </div>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div className="stat-card">
                <div className="stat-value" style={{
                  fontSize: 22,
                  color: child.attendanceRate >= 80 ? '#00B42A' : child.attendanceRate >= 60 ? '#FF7D00' : '#F53F3F',
                }}>
                  {child.attendanceRate.toFixed(1)}%
                </div>
                <div className="stat-label">{t('parent.attendanceRate')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ fontSize: 22 }}>{child.gpa.toFixed(2)}</div>
                <div className="stat-label">{t('parent.gpa')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                color="primary"
                fill="solid"
                style={{ flex: 1, borderRadius: 8 }}
                onClick={() => navigate('/parent/grades')}
              >
                {t('parent.viewGrades')}
              </Button>
              <Button
                color="primary"
                fill="outline"
                style={{ flex: 1, borderRadius: 8 }}
                onClick={() => navigate('/parent/attendance')}
              >
                {t('parent.viewAttendance')}
              </Button>
            </div>
          </Card>
        ))
      )}
    </AppLayout>
  )
}
