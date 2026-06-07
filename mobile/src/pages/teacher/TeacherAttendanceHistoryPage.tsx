import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag } from 'antd-mobile'
import { History, CheckCircle2, XCircle, Clock, CalendarCheck } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'

interface AttendanceRecord {
  id: string
  date: string
  checkInTime?: string | null
  checkOutTime?: string | null
  status: 'present' | 'absent' | 'late' | 'leave' | 'half_day'
  notes?: string | null
  hoursWorked?: number | null
}

interface AttendanceSummary {
  totalDays: number
  present: number
  absent: number
  late: number
  leave: number
  attendanceRate: number
}

const STATUS_CONFIG: Record<string, { color: string; labelKey: string; icon: React.ReactNode }> = {
  present: { color: '#00B42A', labelKey: 'attendance.present', icon: <CheckCircle2 size={12} /> },
  absent: { color: '#F53F3F', labelKey: 'attendance.absent', icon: <XCircle size={12} /> },
  late: { color: '#FAAD14', labelKey: 'teacher.late', icon: <Clock size={12} /> },
  leave: { color: '#165DFF', labelKey: 'teacher.onLeave', icon: <CalendarCheck size={12} /> },
  half_day: { color: '#FF7D00', labelKey: 'teacher.halfDay', icon: <Clock size={12} /> },
}

export default function TeacherAttendanceHistoryPage() {
  const { t } = useTranslation()
  const [monthOffset, setMonthOffset] = useState(0)

  const currentMonth = dayjs().subtract(monthOffset, 'month')
  const monthStr = currentMonth.format('YYYY-MM')
  const monthLabel = currentMonth.format('MMMM YYYY')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['teacher-att-summary', monthStr],
    queryFn: async () => {
      const { data } = await api.get(`/teachers/me/attendance-summary?month=${monthStr}`)
      return data.data as AttendanceSummary
    },
  })

  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['teacher-att-records', monthStr],
    queryFn: async () => {
      const { data } = await api.get(`/teachers/me/attendance-records?month=${monthStr}`)
      return data.data as AttendanceRecord[]
    },
  })

  const isLoading = summaryLoading || recordsLoading

  const handlePrevMonth = () => setMonthOffset((v) => v + 1)
  const handleNextMonth = () => setMonthOffset((v) => Math.max(0, v - 1))

  return (
    <AppLayout title={t('teacher.attendanceHistory', 'Attendance History')} showLogout>
      <PullToRefresh onRefresh={async () => { /* refetch handled by query */ }}>
        {/* Month Navigator */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12, padding: '8px 0',
        }}>
          <button
            onClick={handlePrevMonth}
            style={{
              background: 'white', border: '1px solid #e5e5e5', borderRadius: 8,
              padding: '6px 12px', fontSize: 13, cursor: 'pointer',
            }}
          >
            &lt;
          </button>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#1d1d1f' }}>
            {monthLabel}
          </span>
          <button
            onClick={handleNextMonth}
            disabled={monthOffset === 0}
            style={{
              background: monthOffset === 0 ? '#f5f5f5' : 'white',
              border: '1px solid #e5e5e5', borderRadius: 8,
              padding: '6px 12px', fontSize: 13, cursor: monthOffset === 0 ? 'not-allowed' : 'pointer',
              color: monthOffset === 0 ? '#ccc' : '#333',
            }}
          >
            &gt;
          </button>
        </div>

        {/* Summary Stats */}
        {!isLoading && summary && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
            marginBottom: 12,
          }}>
            {[
              { label: t('attendance.present'), value: summary.present, color: '#00B42A', bg: '#E8F5E9' },
              { label: t('attendance.absent'), value: summary.absent, color: '#F53F3F', bg: '#FFF1F0' },
              { label: t('teacher.late', 'Late'), value: summary.late, color: '#FAAD14', bg: '#FFF7E6' },
              { label: 'Rate', value: `${summary.attendanceRate.toFixed(0)}%`, color: '#165DFF', bg: '#E6F4FF' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: stat.bg, borderRadius: 10,
                padding: '10px 6px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 9, color: '#86909c', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Attendance Rate Bar */}
        {!isLoading && summary && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              height: 6, borderRadius: 3, background: '#f0f0f0',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${Math.min(summary.attendanceRate, 100)}%`,
                background: summary.attendanceRate >= 90 ? '#00B42A' :
                  summary.attendanceRate >= 70 ? '#FAAD14' : '#F53F3F',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: 11, color: '#86909c', textAlign: 'right', marginTop: 3 }}>
              {summary.totalDays} working days
            </div>
          </div>
        )}

        {/* Records List */}
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 10, padding: '12px',
                marginBottom: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}>
                <Skeleton animated style={{ height: 12, width: '30%', marginBottom: 6 }} />
                <Skeleton animated style={{ height: 10, width: '50%' }} />
              </div>
            ))}
          </>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <History size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>No attendance records for this month</div>
          </div>
        ) : (
          records.map(record => {
            const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.absent

            return (
              <div key={record.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'white', borderRadius: 10, padding: '12px',
                marginBottom: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: cfg.color + '15', color: cfg.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12,
                  }}>
                    {cfg.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1d1d1f' }}>
                      {dayjs(record.date).format('ddd, DD MMM')}
                    </div>
                    <div style={{ fontSize: 11, color: '#86909c' }}>
                      {record.checkInTime && `In: ${record.checkInTime}`}
                      {record.checkOutTime && ` · Out: ${record.checkOutTime}`}
                      {record.hoursWorked != null && ` · ${record.hoursWorked.toFixed(1)}h`}
                    </div>
                  </div>
                </div>
                <Tag
                  fill="outline"
                  color={cfg.color}
                  style={{ fontSize: 10, flexShrink: 0 }}
                >
                  {t(cfg.labelKey)}
                </Tag>
              </div>
            )
          })
        )}

        <div style={{ height: 24 }} />
      </PullToRefresh>
    </AppLayout>
  )
}
