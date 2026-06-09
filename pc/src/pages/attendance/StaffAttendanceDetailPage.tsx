import { useState } from 'react'
import {
  Card, Row, Col, Typography, Space, Tag, Table, Segmented, Statistic, Spin, Button,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { CalendarDays, Clock, TrendingUp, XCircle, ArrowLeft, User } from 'lucide-react'
import api from '../../lib/api'

const { Title, Text } = Typography

type Period = 'week' | 'month' | 'term'

interface AttendanceRecord {
  id: string
  date: string
  checkInAt: string | null
  checkOutAt: string | null
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  lateMinutes: number
  locationLabel: string | null
}

interface DetailData {
  teacher: { id: string; name: string; department: string | null }
  records: AttendanceRecord[]
  stats: { present: number; late: number; absent: number; total: number; attendancePct: number }
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-BN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-BN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

function statusTag(s: string) {
  const color = s === 'PRESENT' ? 'success' : s === 'LATE' ? 'warning' : 'error'
  return <Tag color={color}>{s}</Tag>
}

function CalendarHeatmap({ records }: { records: AttendanceRecord[] }) {
  const statusMap: Record<string, string> = {}
  for (const r of records) {
    statusMap[r.date.slice(0, 10)] = r.status
  }

  const today = new Date()
  const cells: { date: Date; key: string }[] = []
  for (let i = 41; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    cells.push({ date: d, key: d.toISOString().slice(0, 10) })
  }

  const cellColor = (status: string | undefined, isWeekend: boolean) => {
    if (isWeekend) return '#f0f0f0'
    if (!status) return '#e8e8e8'
    if (status === 'PRESENT') return '#52c41a'
    if (status === 'LATE') return '#faad14'
    return '#ff4d4f'
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {cells.map(({ date, key }) => {
        const isWeekend = date.getDay() === 5 || date.getDay() === 6
        const status = statusMap[key]
        return (
          <div
            key={key}
            title={`${key}: ${status ?? (isWeekend ? 'Weekend' : 'No record')}`}
            style={{
              width: 20, height: 20, borderRadius: 3,
              backgroundColor: cellColor(status, isWeekend),
              flexShrink: 0,
              cursor: 'default',
            }}
          />
        )
      })}
      <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 8, alignItems: 'center' }}>
        {[
          { color: '#52c41a', label: 'Present' },
          { color: '#faad14', label: 'Late' },
          { color: '#ff4d4f', label: 'Absent' },
          { color: '#e8e8e8', label: 'No record' },
          { color: '#f0f0f0', label: 'Weekend' },
        ].map(({ color, label }) => (
          <Space key={label} size={4}>
            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: color }} />
            <Text style={{ fontSize: 11 }} type="secondary">{label}</Text>
          </Space>
        ))}
      </div>
    </div>
  )
}

const columns: ColumnsType<AttendanceRecord> = [
  { title: 'Date', dataIndex: 'date', key: 'date', render: v => fmtDate(v), width: 180 },
  { title: 'Check In', dataIndex: 'checkInAt', key: 'checkInAt', render: v => fmt(v) },
  { title: 'Check Out', dataIndex: 'checkOutAt', key: 'checkOutAt', render: v => fmt(v) },
  {
    title: 'Status', dataIndex: 'status', key: 'status', render: statusTag,
    filters: [
      { text: 'PRESENT', value: 'PRESENT' },
      { text: 'LATE', value: 'LATE' },
      { text: 'ABSENT', value: 'ABSENT' },
    ],
    onFilter: (value, r) => r.status === value,
  },
  {
    title: 'Late (min)', dataIndex: 'lateMinutes', key: 'lateMinutes',
    render: v => v > 0 ? <Text type="warning">{v}</Text> : '—',
  },
  {
    title: 'Location', dataIndex: 'locationLabel', key: 'locationLabel',
    render: v => v ?? <Text type="secondary">—</Text>,
  },
]

export default function StaffAttendanceDetailPage() {
  const { t } = useTranslation()
  const { teacherId } = useParams<{ teacherId: string }>()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('month')

  const { data, isLoading } = useQuery<DetailData>({
    queryKey: ['staffAttendanceDetail', teacherId, period],
    queryFn: async () => {
      const r = await api.get(`/staff-attendance/teacher-history/${teacherId}?period=${period}`)
      return r.data.data as DetailData
    },
    enabled: !!teacherId,
  })

  const stats = data?.stats
  const records = data?.records ?? []

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Space style={{ marginBottom: 24 }} align="center">
        <Button
          type="text"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate(-1)}
        />
        <User size={20} />
        <Title level={4} style={{ margin: 0 }}>
          {data?.teacher.name ?? t('attendance.staffAttendance', 'Staff Attendance')}
        </Title>
        {data?.teacher.department && (
          <Tag>{data.teacher.department}</Tag>
        )}
      </Space>

      {/* Period filter */}
      <Segmented
        value={period}
        onChange={v => setPeriod(v as Period)}
        options={[
          { label: t('attendance.thisWeek', 'This Week'), value: 'week' },
          { label: t('attendance.thisMonth', 'This Month'), value: 'month' },
          { label: t('attendance.thisTerm', 'This Term'), value: 'term' },
        ]}
        style={{ marginBottom: 24 }}
      />

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : (
        <>
          {/* Stats row */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card size="small" bordered={false} style={{ background: '#f6ffed', borderRadius: 12 }}>
                <Statistic
                  title={<Space><TrendingUp size={14} />{t('attendance.attendancePct', 'Attendance %')}</Space>}
                  value={stats?.attendancePct ?? 0}
                  suffix="%"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" bordered={false} style={{ background: '#f6ffed', borderRadius: 12 }}>
                <Statistic
                  title={<Space><CalendarDays size={14} />{t('attendance.present', 'Present')}</Space>}
                  value={stats?.present ?? 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" bordered={false} style={{ background: '#fffbe6', borderRadius: 12 }}>
                <Statistic
                  title={<Space><Clock size={14} />{t('attendance.late', 'Late')}</Space>}
                  value={stats?.late ?? 0}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" bordered={false} style={{ background: '#fff2f0', borderRadius: 12 }}>
                <Statistic
                  title={<Space><XCircle size={14} />{t('attendance.absent', 'Absent')}</Space>}
                  value={stats?.absent ?? 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Heatmap */}
          <Card
            title={t('attendance.calendarHeatmap', 'Last 42 Days Calendar')}
            bordered={false}
            style={{ borderRadius: 12, marginBottom: 24 }}
          >
            <CalendarHeatmap records={records} />
          </Card>

          {/* Detailed table */}
          <Card
            title={t('attendance.detailTable', 'Detailed Records')}
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={columns}
              dataSource={records}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 640 }}
            />
          </Card>
        </>
      )}
    </div>
  )
}
