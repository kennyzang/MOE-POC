import { Card, Select, Statistic, Table, Tag, Space, Typography, Spin, Alert } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import api from '../../lib/api'

const { Title, Text } = Typography

interface ChildInfo {
  id: string
  studentId: string
  gradeLevel: string
  className: string
  user: { displayName: string }
  gpa: number
  gradeAverage: number
  attendanceRate: number
}

interface DashboardStats {
  children: ChildInfo[]
}

interface AttendanceRecord {
  id: string
  status: 'present' | 'absent' | 'late' | 'excused'
  checkedInAt: string | null
  session: {
    date: string
    topic: string
    course: { name: string; code: string }
  }
  student: { user: { displayName: string } }
}

const STATUS_COLOR: Record<string, string> = {
  present: 'green',
  absent: 'red',
  late: 'orange',
  excused: 'blue',
}

const ParentAttendancePage = () => {
  const { t } = useTranslation()
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

  const {
    data: attendanceRecords,
    isLoading: recordsLoading,
    isError: recordsError,
  } = useQuery({
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

  const columns: ColumnsType<AttendanceRecord> = [
    {
      title: t('common.date'),
      dataIndex: ['session', 'date'],
      key: 'date',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a, b) =>
        new Date(a.session.date).getTime() - new Date(b.session.date).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: t('courses.courseName'),
      key: 'course',
      render: (_: unknown, record: AttendanceRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.session.course.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.session.course.code}
          </Text>
        </Space>
      ),
    },
    {
      title: t('attendance.topic'),
      dataIndex: ['session', 'topic'],
      key: 'topic',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status] ?? 'default'}>
          {t(`attendance.${status}` as never, status)}
        </Tag>
      ),
      filters: ['present', 'absent', 'late', 'excused'].map((s) => ({
        text: t(`attendance.${s}` as never),
        value: s,
      })),
      onFilter: (value, record) => record.status === value,
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
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Space align="center">
          <CalendarCheck size={24} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>
            {t('parentPortal.childAttendance')}
          </Title>
        </Space>
      </Card>

      {children.length > 1 && (
        <Card style={{ marginBottom: 16 }}>
          <Space align="center">
            <Text>{t('parentPortal.selectChild')}:</Text>
            <Select
              value={selectedChildId}
              onChange={setSelectedChildId}
              style={{ minWidth: 200 }}
              options={children.map((c) => ({
                value: c.id,
                label: c.user.displayName,
              }))}
            />
          </Space>
        </Card>
      )}

      {selectedChild && (
        <>
          <Card
            title={
              <Space>
                <CalendarCheck size={16} style={{ color: '#165DFF' }} />
                <span>
                  {selectedChild.user.displayName} — {selectedChild.gradeLevel}{' '}
                  {selectedChild.className}
                </span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Statistic
              title={t('parentPortal.attendanceRate')}
              value={selectedChild.attendanceRate}
              suffix="%"
              precision={1}
              valueStyle={{
                fontSize: 36,
                color:
                  selectedChild.attendanceRate >= 80
                    ? '#52c41a'
                    : selectedChild.attendanceRate >= 60
                      ? '#faad14'
                      : '#ff4d4f',
              }}
              prefix={<CalendarCheck size={28} style={{ marginRight: 8 }} />}
            />
          </Card>

          {recordsError ? (
            <Alert
              type="warning"
              showIcon
              message={t('parentPortal.childAttendance')}
              description="Detailed attendance records are not available at this time. Please contact the school office for more information."
            />
          ) : (
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
          )}
        </>
      )}

      {children.length === 0 && (
        <Card>
          <Text type="secondary">{t('common.noData')}</Text>
        </Card>
      )}
    </div>
  )
}

export default ParentAttendancePage
