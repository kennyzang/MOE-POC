import { useEffect, useState } from 'react'
import {
  Card, Select, Table, Tag, Space, Typography, Spin, Progress,
  Row, Col, Statistic, message, Badge,
} from 'antd'
import { Calendar } from 'antd'
import type { Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface ChildInfo {
  id: string
  studentId: string
  gradeLevel: string
  className: string
  user: { displayName: string }
  attendanceRate: number
}

interface DashboardStats { children: ChildInfo[] }

interface AttendanceRecord {
  id: string
  status: 'present' | 'absent' | 'late' | 'excused'
  checkedInAt: string | null
  absenceReason: string | null
  session: {
    date: string
    topic: string | null
    course: { name: string; code: string }
  }
}

const STATUS_COLOR: Record<string, string> = {
  present: 'green',
  absent: 'red',
  late: 'orange',
  excused: 'blue',
}

const CALENDAR_STATUS_COLOR: Record<string, string> = {
  present: '#52c41a',
  absent: '#f5222d',
  late: '#fa8c16',
  excused: '#1677ff',
}

const ParentAttendancePage = () => {
  const { t } = useTranslation()
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>(undefined)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['parent-dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      const result = data.data as DashboardStats
      if (result.children?.length > 0 && !selectedChildId) {
        setSelectedChildId(result.children[0].id)
      }
      return result
    },
  })

  const children = stats?.children ?? []
  const selectedChild = children.find((c) => c.id === selectedChildId) ?? children[0]

  const { data: attendanceRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ['parent-attendance-records', selectedChild?.studentId],
    queryFn: async () => {
      const { data } = await api.get('/attendance/records', {
        params: { studentId: selectedChild!.studentId },
      })
      return data.data as AttendanceRecord[]
    },
    enabled: !!selectedChild?.studentId,
    retry: false,
  })

  // SSE: refresh when attendance is marked
  useEffect(() => {
    if (!token) return
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1'
    const es = new EventSource(`${base}/events/stream?topics=dashboard&token=${token}`)
    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: ['parent-attendance-records'] })
      void queryClient.invalidateQueries({ queryKey: ['parent-dashboard-stats'] })
      void message.info(t('parentPortal.attendanceUpdated', { defaultValue: 'Attendance record updated.' }), 3)
    }
    es.addEventListener('dashboard.attendance.changed', handler)
    return () => { es.removeEventListener('dashboard.attendance.changed', handler); es.close() }
  }, [token, queryClient, t])

  // Build a map of date → status for calendar coloring
  const dateStatusMap = (attendanceRecords ?? []).reduce<Record<string, string>>((acc, r) => {
    const dateKey = new Date(r.session.date).toISOString().slice(0, 10)
    // Priority: absent > late > excused > present
    const priority = { absent: 4, late: 3, excused: 2, present: 1 }
    if (!acc[dateKey] || (priority[r.status] ?? 0) > (priority[acc[dateKey] as keyof typeof priority] ?? 0)) {
      acc[dateKey] = r.status
    }
    return acc
  }, {})

  // Attendance breakdown
  const breakdown = (attendanceRecords ?? []).reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc },
    { present: 0, absent: 0, late: 0, excused: 0 } as Record<string, number>,
  )
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)

  const dateCellRender = (date: Dayjs) => {
    const dateKey = date.format('YYYY-MM-DD')
    const status = dateStatusMap[dateKey]
    if (!status) return null
    return (
      <Badge
        color={CALENDAR_STATUS_COLOR[status] ?? '#999'}
        style={{ width: 6, height: 6, borderRadius: '50%', display: 'block', margin: '0 auto' }}
      />
    )
  }

  const columns: ColumnsType<AttendanceRecord> = [
    {
      title: t('common.date'),
      key: 'date',
      render: (_: unknown, r: AttendanceRecord) => new Date(r.session.date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.session.date).getTime() - new Date(b.session.date).getTime(),
      defaultSortOrder: 'descend',
      width: 110,
    },
    {
      title: t('courses.courseName'),
      key: 'course',
      render: (_: unknown, r: AttendanceRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.session.course.name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.session.course.code}</Text>
        </Space>
      ),
    },
    {
      title: t('attendance.topic'),
      key: 'topic',
      render: (_: unknown, r: AttendanceRecord) => r.session.topic ?? '—',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => (
        <Tag color={STATUS_COLOR[s] ?? 'default'}>
          {t(`attendance.${s}` as never, s)}
        </Tag>
      ),
      filters: ['present', 'absent', 'late', 'excused'].map((s) => ({
        text: t(`attendance.${s}` as never),
        value: s,
      })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: t('parentPortal.absenceReason', { defaultValue: 'Reason' }),
      key: 'reason',
      render: (_: unknown, r: AttendanceRecord) => r.absenceReason ?? '—',
    },
  ]

  if (statsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <Card>
        <Space align="center">
          <CalendarCheck size={24} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>
            {t('parentPortal.childAttendance')}
          </Title>
        </Space>
      </Card>

      {/* Child Selector */}
      {children.length > 1 && (
        <Card>
          <Space align="center">
            <Text>{t('parentPortal.selectChild')}:</Text>
            <Select
              value={selectedChildId}
              onChange={setSelectedChildId}
              style={{ minWidth: 200 }}
              options={children.map((c) => ({ value: c.id, label: c.user.displayName }))}
            />
          </Space>
        </Card>
      )}

      {selectedChild && (
        <>
          {/* Summary Stats */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={6}>
              <Card>
                <Statistic
                  title={t('parentPortal.attendanceRate')}
                  value={selectedChild.attendanceRate}
                  suffix="%"
                  precision={1}
                  styles={{
                    content: {
                      fontSize: 24,
                      color:
                        selectedChild.attendanceRate >= 80
                          ? '#52c41a'
                          : selectedChild.attendanceRate >= 60
                            ? '#faad14'
                            : '#f5222d',
                    },
                  }}
                />
              </Card>
            </Col>
            {(['present', 'absent', 'late', 'excused'] as const).map((s) => (
              <Col xs={12} sm={4} key={s}>
                <Card>
                  <Statistic
                    title={t(`attendance.${s}`)}
                    value={breakdown[s] ?? 0}
                    styles={{ content: { color: CALENDAR_STATUS_COLOR[s], fontSize: 22 } }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Breakdown Progress */}
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(['present', 'absent', 'late', 'excused'] as const).map((s) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 64, fontSize: 12, color: '#4e5969' }}>{t(`attendance.${s}`)}</div>
                  <Progress
                    percent={total === 0 ? 0 : Math.round(((breakdown[s] ?? 0) / total) * 100)}
                    size="small"
                    showInfo={false}
                    strokeColor={CALENDAR_STATUS_COLOR[s]}
                    style={{ flex: 1, margin: 0 }}
                  />
                  <div style={{ width: 36, textAlign: 'right', fontSize: 12, fontWeight: 600, color: CALENDAR_STATUS_COLOR[s] }}>
                    {breakdown[s] ?? 0}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#86909c', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                {t('attendance.totalSessions')}: {total}
              </div>
            </div>
          </Card>

          {/* Attendance Calendar */}
          <Card
            title={
              <Space>
                <CalendarCheck size={15} />
                {t('parentPortal.attendanceCalendar', { defaultValue: 'Attendance Calendar' })}
              </Space>
            }
            extra={
              <Space wrap>
                {(['present', 'absent', 'late', 'excused'] as const).map((s) => (
                  <Space key={s} size={4}>
                    <Badge color={CALENDAR_STATUS_COLOR[s]} />
                    <Text style={{ fontSize: 11 }}>{t(`attendance.${s}`)}</Text>
                  </Space>
                ))}
              </Space>
            }
          >
            {recordsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : (
              <Calendar
                fullscreen={false}
                cellRender={dateCellRender}
              />
            )}
          </Card>

          {/* Attendance Table */}
          <Card title={t('attendance.session')}>
            <Table
              columns={columns}
              dataSource={attendanceRecords ?? []}
              rowKey="id"
              loading={recordsLoading}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              locale={{ emptyText: t('common.noData') }}
              size="middle"
            />
          </Card>
        </>
      )}

      {children.length === 0 && (
        <Card><Text type="secondary">{t('common.noData')}</Text></Card>
      )}
    </div>
  )
}

export default ParentAttendancePage
