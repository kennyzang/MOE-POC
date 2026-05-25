import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, AttendanceRecord } from '@/types'

const statusColor: Record<string, string> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'default',
}

export default function ParentAttendancePage() {
  const { t } = useTranslation()

  const { data: records, isLoading } = useQuery({
    queryKey: ['parent-attendance'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttendanceRecord[]>>('/attendance/records')
      return data.data
    },
  })

  const totalSessions = records?.length ?? 0
  const presentCount = records?.filter(r => r.status === 'present' || r.status === 'late').length ?? 0
  const rate = totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(1) : '0.0'

  return (
    <AppLayout title={t('parent.childAttendance')} showLogout>
      {/* Summary */}
      <div className="stats-row" style={{ marginBottom: 12 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22 }}>{totalSessions}</div>
          <div className="stat-label">{t('common.total')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22, color: '#00B42A' }}>{presentCount}</div>
          <div className="stat-label">{t('attendance.present')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22, color: '#165DFF' }}>{rate}%</div>
          <div className="stat-label">{t('parent.attendanceRate')}</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : !records || records.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('common.noData')}</div>
      ) : (
        <List style={{ borderRadius: 12, overflow: 'hidden' }}>
          {records.map(record => (
            <List.Item
              key={record.id}
              prefix={
                <Tag color={statusColor[record.status] ?? 'default'}>
                  {t(`attendance.${record.status}`)}
                </Tag>
              }
              description={record.session?.course?.name ?? ''}
              extra={
                <span style={{ fontSize: 12, color: '#86909c' }}>
                  {record.session?.date ? dayjs(record.session.date).format('DD/MM/YY') : ''}
                </span>
              }
            >
              {record.session?.topic ?? record.session?.course?.code ?? '—'}
            </List.Item>
          ))}
        </List>
      )}
    </AppLayout>
  )
}
