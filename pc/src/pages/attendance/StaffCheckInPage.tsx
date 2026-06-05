import { useState, useEffect, useCallback } from 'react'
import { Card, Button, Alert, Typography, Space, Tag, Spin, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle, Clock, MapPin, LogIn, LogOut, CalendarDays,
} from 'lucide-react'
import api from '../../lib/api'
import styles from './StaffCheckInPage.module.css'

const { Title, Text } = Typography

interface AttendanceRecord {
  id: string
  date: string
  checkInAt: string | null
  checkOutAt: string | null
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  lateMinutes: number
  locationLabel: string | null
}

interface TodayResponse {
  record: AttendanceRecord | null
  config: { startTime: string; cutoffTime: string }
}

interface HistoryRecord extends AttendanceRecord {}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-BN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-BN', { weekday: 'short', month: 'short', day: 'numeric' })
}

function statusColor(s: string) {
  if (s === 'PRESENT') return 'success'
  if (s === 'LATE') return 'warning'
  return 'error'
}

export default function StaffCheckInPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [now, setNow] = useState(new Date())
  const [geo, setGeo] = useState<{ lat: number; lng: number; label: string } | null>(null)

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Try to get location (non-blocking)
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'School Campus' }),
      () => setGeo(null),
      { timeout: 5000 },
    )
  }, [])

  const { data, isLoading } = useQuery<TodayResponse>({
    queryKey: ['staffAttendanceToday'],
    queryFn: async () => {
      const r = await api.get('/staff-attendance/today')
      return r.data.data as TodayResponse
    },
  })

  const { data: historyData, isLoading: histLoading } = useQuery<{ records: HistoryRecord[] }>({
    queryKey: ['staffAttendanceHistory', 'week'],
    queryFn: async () => {
      const r = await api.get('/staff-attendance/history?period=week')
      return r.data.data as { records: HistoryRecord[] }
    },
  })

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {}
      if (geo) { body.locationLat = geo.lat; body.locationLng = geo.lng; body.locationLabel = geo.label }
      const r = await api.post('/staff-attendance/check-in', body)
      return r.data
    },
    onSuccess: () => {
      message.success(t('attendance.checkInSuccess', 'Checked in successfully'))
      qc.invalidateQueries({ queryKey: ['staffAttendanceToday'] })
      qc.invalidateQueries({ queryKey: ['staffAttendanceHistory'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? t('common.error', 'Something went wrong')
      message.error(msg)
    },
  })

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post('/staff-attendance/check-out', {})
      return r.data
    },
    onSuccess: () => {
      message.success(t('attendance.checkOutSuccess', 'Checked out successfully'))
      qc.invalidateQueries({ queryKey: ['staffAttendanceToday'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? t('common.error', 'Something went wrong')
      message.error(msg)
    },
  })

  const handleCheckIn = useCallback(() => checkInMutation.mutate(), [checkInMutation])
  const handleCheckOut = useCallback(() => checkOutMutation.mutate(), [checkOutMutation])

  const record = data?.record ?? null
  const hasCheckedIn = !!record?.checkInAt
  const hasCheckedOut = !!record?.checkOutAt
  const isLate = record?.status === 'LATE'

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>

        {/* Clock */}
        <Card className={styles.clockCard} bordered={false}>
          <div className={styles.clockTime}>
            {now.toLocaleTimeString('en-BN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className={styles.clockDate}>
            <Space>
              <CalendarDays size={14} />
              <Text type="secondary">
                {now.toLocaleDateString('en-BN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </Space>
          </div>
        </Card>

        {/* Late alert */}
        {isLate && (
          <Alert
            type="warning"
            showIcon
            message={t('attendance.lateAlert', `Late by ${record!.lateMinutes} minutes`)}
            className={styles.lateAlert}
          />
        )}

        {/* Check-in card */}
        <Card className={styles.checkInCard} bordered={false}>
          {isLoading ? (
            <div className={styles.spinCenter}><Spin /></div>
          ) : (
            <>
              {hasCheckedIn ? (
                <div className={styles.checkedInInfo}>
                  <CheckCircle size={48} className={styles.checkIcon} />
                  <Title level={4} style={{ margin: '8px 0 4px' }}>
                    {t('attendance.checkedInAt', 'Checked in at')} {formatTime(record!.checkInAt)}
                  </Title>
                  <Tag color={statusColor(record!.status)} style={{ fontSize: 13 }}>
                    {record!.status}
                  </Tag>
                  {record?.locationLabel && (
                    <div className={styles.locationLine}>
                      <MapPin size={13} />
                      <Text type="secondary" style={{ fontSize: 12 }}>{record.locationLabel}</Text>
                    </div>
                  )}
                  {hasCheckedOut ? (
                    <div className={styles.checkOutInfo}>
                      <Clock size={14} />
                      <Text type="secondary">
                        {t('attendance.checkedOutAt', 'Checked out at')} {formatTime(record!.checkOutAt)}
                      </Text>
                    </div>
                  ) : (
                    <Button
                      size="large"
                      icon={<LogOut size={16} />}
                      onClick={handleCheckOut}
                      loading={checkOutMutation.isPending}
                      className={styles.checkOutBtn}
                      block
                    >
                      {t('attendance.checkOut', 'Check Out')}
                    </Button>
                  )}
                </div>
              ) : (
                <div className={styles.checkInPrompt}>
                  <div className={styles.promptIcon}>
                    <LogIn size={40} />
                  </div>
                  <Title level={4}>{t('attendance.readyToCheckIn', 'Ready to Check In?')}</Title>
                  {data?.config && (
                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                      {t('attendance.schoolStartsAt', 'School starts at')} {data.config.startTime}
                    </Text>
                  )}
                  {geo ? (
                    <div className={styles.locationLine}>
                      <MapPin size={13} />
                      <Text type="secondary" style={{ fontSize: 12 }}>{geo.label}</Text>
                    </div>
                  ) : (
                    <div className={styles.locationLine}>
                      <MapPin size={13} />
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('attendance.locationNA', 'Location not available')}</Text>
                    </div>
                  )}
                  <Button
                    type="primary"
                    size="large"
                    icon={<LogIn size={16} />}
                    onClick={handleCheckIn}
                    loading={checkInMutation.isPending}
                    className={styles.checkInBtn}
                    block
                  >
                    {t('attendance.checkIn', 'Check In')}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        {/* 7-day history mini cards */}
        <Card
          title={
            <Space>
              <Clock size={16} />
              <span>{t('attendance.recentHistory', 'Last 7 Days')}</span>
            </Space>
          }
          className={styles.historyCard}
          bordered={false}
          size="small"
        >
          {histLoading ? (
            <div className={styles.spinCenter}><Spin size="small" /></div>
          ) : (
            <div className={styles.historyGrid}>
              {(historyData?.records ?? []).slice(0, 7).map(r => (
                <div key={r.id} className={`${styles.historyItem} ${styles[`status_${r.status}`]}`}>
                  <div className={styles.historyDate}>{formatDate(r.date)}</div>
                  <Tag color={statusColor(r.status)} style={{ fontSize: 11 }}>{r.status}</Tag>
                  <div className={styles.historyTime}>
                    {formatTime(r.checkInAt)}
                    {r.checkOutAt ? ` – ${formatTime(r.checkOutAt)}` : ''}
                  </div>
                </div>
              ))}
              {(historyData?.records ?? []).length === 0 && (
                <Text type="secondary">{t('attendance.noHistory', 'No records yet')}</Text>
              )}
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}
