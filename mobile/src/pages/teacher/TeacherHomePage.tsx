import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag, Dialog, Toast } from 'antd-mobile'
import { BookOpen, Users, Megaphone, Pin, LogIn, LogOut, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import PushNotificationBanner from '@/components/PushNotificationBanner'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, TeacherDashboardStats, Announcement, StaffAttendanceRecord, StaffAttendanceConfig } from '@/types'

/* ──────────────── Check-In Card ──────────────── */

interface AttendanceTodayData {
  record: StaffAttendanceRecord | null
  config: StaffAttendanceConfig
}

function TeacherCheckInCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [now, setNow] = useState(dayjs())

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isWeekend = now.day() === 0 || now.day() === 6

  const { data } = useQuery({
    queryKey: ['staff-attendance-today'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttendanceTodayData>>('/staff-attendance/today')
      return data.data
    },
    enabled: !isWeekend,
  })

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/staff-attendance/check-in'),
    onSuccess: () => {
      Toast.show({ icon: 'success', content: t('checkIn.checkInSuccess') })
      qc.invalidateQueries({ queryKey: ['staff-attendance-today'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? t('checkIn.failed')
      Toast.show({ icon: 'fail', content: msg })
    },
  })

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/staff-attendance/check-out'),
    onSuccess: () => {
      Toast.show({ icon: 'success', content: t('checkIn.checkOutSuccess') })
      qc.invalidateQueries({ queryKey: ['staff-attendance-today'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? t('checkIn.failed')
      Toast.show({ icon: 'fail', content: msg })
    },
  })

  const handleCheckIn = async () => {
    const confirmed = await Dialog.confirm({
      title: t('checkIn.checkIn'),
      content: `${t('checkIn.confirmCheckIn')} (${now.format('HH:mm')})`,
      confirmText: t('common.save'),
      cancelText: t('common.cancel'),
    })
    if (confirmed) checkInMutation.mutate()
  }

  const handleCheckOut = async () => {
    const confirmed = await Dialog.confirm({
      title: t('checkIn.checkOut'),
      content: t('checkIn.confirmCheckOut'),
      confirmText: t('common.save'),
      cancelText: t('common.cancel'),
    })
    if (confirmed) checkOutMutation.mutate()
  }

  const record = data?.record
  const checkedIn = !!record?.checkInAt
  const checkedOut = !!record?.checkOutAt
  const allDone = checkedIn && checkedOut
  const isBusy = checkInMutation.isPending || checkOutMutation.isPending

  if (isWeekend) {
    return (
      <div style={{
        background: 'white', borderRadius: 14, padding: '14px 16px',
        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Clock size={18} color="#c9cdd4" />
        <span style={{ fontSize: 13, color: '#86909c' }}>{t('checkIn.weekend')}</span>
      </div>
    )
  }

  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 12,
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Clock size={16} color="#165DFF" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>
            {t('checkIn.title')}
          </span>
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#165DFF', fontVariantNumeric: 'tabular-nums' }}>
          {now.format('HH:mm')}
        </span>
      </div>

      {/* Status row */}
      <div style={{
        fontSize: 12, color: '#86909c', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        {checkedIn ? (
          <span style={{ color: '#00B42A' }}>
            ✓ {t('checkIn.checkedIn')} {dayjs(record!.checkInAt!).format('HH:mm')}
            {record!.status === 'LATE' && (
              <span style={{
                marginLeft: 6, background: '#FFF3E6', color: '#FF7D00',
                padding: '1px 5px', borderRadius: 4, fontSize: 11,
              }}>
                {t('checkIn.late')}
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: '#86909c' }}>{t('checkIn.notCheckedIn')}</span>
        )}
        {checkedOut && (
          <span style={{ color: '#00B42A' }}>
            ✓ {t('checkIn.checkedOut')} {dayjs(record!.checkOutAt!).format('HH:mm')}
          </span>
        )}
      </div>

      {/* Buttons */}
      {allDone ? (
        <div style={{
          textAlign: 'center', fontSize: 13, color: '#00B42A',
          background: '#F0FFF4', borderRadius: 8, padding: '8px 0',
          fontWeight: 600,
        }}>
          ✓ {t('checkIn.allDone')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={handleCheckIn}
            disabled={checkedIn || isBusy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 0', borderRadius: 10, border: 'none', cursor: checkedIn ? 'default' : 'pointer',
              background: checkedIn ? '#f5f5f5' : '#165DFF',
              color: checkedIn ? '#c9cdd4' : 'white',
              fontSize: 13, fontWeight: 600, transition: 'background 0.2s',
            }}
          >
            <LogIn size={15} />
            {t('checkIn.checkIn')}
          </button>
          <button
            onClick={handleCheckOut}
            disabled={!checkedIn || checkedOut || isBusy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 0', borderRadius: 10, border: 'none',
              cursor: (!checkedIn || checkedOut) ? 'default' : 'pointer',
              background: (!checkedIn || checkedOut) ? '#f5f5f5' : '#00B42A',
              color: (!checkedIn || checkedOut) ? '#c9cdd4' : 'white',
              fontSize: 13, fontWeight: 600, transition: 'background 0.2s',
            }}
          >
            <LogOut size={15} />
            {t('checkIn.checkOut')}
          </button>
        </div>
      )}
    </div>
  )
}

/* ──────────────── Main Page ──────────────── */

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

      {/* Check-In Card — always visible for teachers */}
      <TeacherCheckInCard />

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
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Megaphone size={16} color="#165DFF" />
                  {t('announcements.title')}
                </span>
                <span
                  onClick={() => navigate('/teacher/announcements')}
                  style={{ fontSize: 12, color: '#165DFF', cursor: 'pointer', fontWeight: 500 }}
                >
                  {t('announcements.viewAll')}
                </span>
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
