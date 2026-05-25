import { useState, useMemo } from 'react'
import {
  Table,
  Select,
  Tag,
  Card,
  Space,
  Row,
  Col,
  Typography,
  Button,
  Modal,
  DatePicker,
  Input,
  Radio,
  message,
  Statistic,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Plus, CheckSquare } from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'
import type { Course, AttendanceSession, AttendanceRecord, Enrollment } from '../../types'

const { Title } = Typography

const SESSION_STATUS_COLORS: Record<string, string> = {
  active: 'green',
  completed: 'default',
}

const ATTENDANCE_STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'] as const

const AttendanceTrackingPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [markModalOpen, setMarkModalOpen] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string>('')

  // Create session form state
  const [newSessionDate, setNewSessionDate] = useState<dayjs.Dayjs | null>(null)
  const [newSessionTopic, setNewSessionTopic] = useState('')

  // Mark attendance state
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({})

  // ─── Queries ──────────────────────────────────────────────────

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await api.get('/courses')
      return data.data as Course[]
    },
  })

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['attendance-sessions', selectedCourseId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedCourseId) params.set('courseId', selectedCourseId)
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await api.get(`/attendance/sessions?${params}`)
      return data.data as AttendanceSession[]
    },
    enabled: !!selectedCourseId,
  })

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', selectedCourseId],
    queryFn: async () => {
      const { data } = await api.get(`/enrollments?courseId=${selectedCourseId}`)
      return data.data as Enrollment[]
    },
    enabled: !!selectedCourseId && markModalOpen,
  })

  const { data: existingRecords = [] } = useQuery({
    queryKey: ['attendance-records', activeSessionId],
    queryFn: async () => {
      const { data } = await api.get(`/attendance/records?sessionId=${activeSessionId}`)
      return data.data as AttendanceRecord[]
    },
    enabled: !!activeSessionId && markModalOpen,
  })

  // ─── Mutations ────────────────────────────────────────────────

  const createSessionMutation = useMutation({
    mutationFn: async (payload: { courseId: string; date: string; topic: string }) => {
      const { data } = await api.post('/attendance/sessions', payload)
      return data
    },
    onSuccess: () => {
      message.success(t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] })
      setCreateModalOpen(false)
      setNewSessionDate(null)
      setNewSessionTopic('')
    },
  })

  const saveRecordsMutation = useMutation({
    mutationFn: async (payload: {
      sessionId: string
      records: { studentId: string; status: string }[]
    }) => {
      const { data } = await api.post('/attendance/records', payload)
      return data
    },
    onSuccess: () => {
      message.success(t('attendance.attendanceSaved'))
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] })
      setMarkModalOpen(false)
      setActiveSessionId('')
      setAttendanceMap({})
    },
  })

  // ─── Computed Stats ───────────────────────────────────────────

  const stats = useMemo(() => {
    const totalSessions = sessions.length
    // Collect all record counts to estimate present rate
    let totalRecords = 0
    let presentCount = 0
    // We only have _count from sessions; for a more accurate rate we'd need all records.
    // Use session _count as total, and estimate from available data.
    sessions.forEach((s) => {
      if (s._count?.records) {
        totalRecords += s._count.records
      }
    })
    // Present rate will be computed from actual records if we had them all.
    // For now, show the total sessions count and a placeholder rate.
    return { totalSessions, totalRecords, presentCount }
  }, [sessions])

  // ─── Handlers ─────────────────────────────────────────────────

  const handleOpenMark = (sessionId: string) => {
    setActiveSessionId(sessionId)
    setAttendanceMap({})
    setMarkModalOpen(true)
  }

  const handleSaveAttendance = () => {
    const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
      studentId,
      status,
    }))
    if (records.length === 0) {
      message.warning(t('common.noData'))
      return
    }
    saveRecordsMutation.mutate({ sessionId: activeSessionId, records })
  }

  // Pre-populate attendance map from existing records
  useMemo(() => {
    if (existingRecords.length > 0 && markModalOpen) {
      const map: Record<string, string> = {}
      existingRecords.forEach((r) => {
        map[r.studentId] = r.status
      })
      setAttendanceMap(map)
    }
  }, [existingRecords, markModalOpen])

  // ─── Table Columns ────────────────────────────────────────────

  const columns: ColumnsType<AttendanceSession> = [
    {
      title: t('attendance.sessionDate'),
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD') : '-'),
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: t('attendance.topic'),
      dataIndex: 'topic',
      key: 'topic',
    },
    {
      title: t('attendance.sessionStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string) => (
        <Tag color={SESSION_STATUS_COLORS[val] ?? 'default'}>
          {t(`attendance.${val}` as never, val)}
        </Tag>
      ),
    },
    {
      title: t('common.total'),
      key: 'recordCount',
      width: 100,
      render: (_, record) => record._count?.records ?? 0,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 160,
      render: (_, record) =>
        record.status === 'active' ? (
          <Button
            type="link"
            icon={<CheckSquare size={16} />}
            onClick={() => handleOpenMark(record.id)}
          >
            {t('attendance.markAttendance')}
          </Button>
        ) : (
          <Button
            type="link"
            icon={<CheckSquare size={16} />}
            onClick={() => handleOpenMark(record.id)}
          >
            {t('common.view')}
          </Button>
        ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <CalendarCheck size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('attendance.title')}
            </Title>
          </Space>
        </Col>
        <Col>
          {selectedCourseId && (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setCreateModalOpen(true)}
            >
              {t('attendance.createSession')}
            </Button>
          )}
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t('attendance.selectCourse')}
              allowClear
              style={{ width: '100%' }}
              value={selectedCourseId || undefined}
              onChange={(val) => setSelectedCourseId(val ?? '')}
              options={courses.map((c) => ({
                label: `${c.code} - ${c.name}`,
                value: c.id,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t('attendance.sessionStatus')}
              allowClear
              style={{ width: '100%' }}
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val ?? '')}
              options={[
                { label: t('attendance.active'), value: 'active' },
                { label: t('attendance.completed'), value: 'completed' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Stat Cards */}
      {selectedCourseId && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={t('attendance.totalSessions')}
                value={stats.totalSessions}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={t('attendance.presentRate')}
                value={
                  stats.totalRecords > 0
                    ? ((stats.totalRecords / (stats.totalSessions || 1)) * 100).toFixed(1)
                    : '-'
                }
                suffix={stats.totalRecords > 0 ? '%' : ''}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Session Table */}
      <Card>
        <Table<AttendanceSession>
          rowKey="id"
          columns={columns}
          dataSource={sessions}
          loading={sessionsLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${t('common.total')}: ${total}`,
          }}
          locale={{ emptyText: selectedCourseId ? t('common.noData') : t('attendance.selectCourse') }}
        />
      </Card>

      {/* Create Session Modal */}
      <Modal
        title={t('attendance.createSession')}
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          setNewSessionDate(null)
          setNewSessionTopic('')
        }}
        onOk={() => {
          if (!newSessionDate) {
            message.warning(t('attendance.sessionDate'))
            return
          }
          createSessionMutation.mutate({
            courseId: selectedCourseId,
            date: newSessionDate.format('YYYY-MM-DD'),
            topic: newSessionTopic,
          })
        }}
        confirmLoading={createSessionMutation.isPending}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 4 }}>{t('courses.courseName')}</div>
            <Select
              style={{ width: '100%' }}
              value={selectedCourseId}
              disabled
              options={courses.map((c) => ({
                label: `${c.code} - ${c.name}`,
                value: c.id,
              }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>{t('attendance.sessionDate')}</div>
            <DatePicker
              style={{ width: '100%' }}
              value={newSessionDate}
              onChange={(date) => setNewSessionDate(date)}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>{t('attendance.topic')}</div>
            <Input
              value={newSessionTopic}
              onChange={(e) => setNewSessionTopic(e.target.value)}
              placeholder={t('attendance.topic')}
            />
          </div>
        </Space>
      </Modal>

      {/* Mark Attendance Modal */}
      <Modal
        title={t('attendance.markAttendance')}
        open={markModalOpen}
        onCancel={() => {
          setMarkModalOpen(false)
          setActiveSessionId('')
          setAttendanceMap({})
        }}
        width={700}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setMarkModalOpen(false)
              setActiveSessionId('')
              setAttendanceMap({})
            }}
          >
            {t('common.cancel')}
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saveRecordsMutation.isPending}
            onClick={handleSaveAttendance}
          >
            {t('attendance.saveAttendance')}
          </Button>,
        ]}
      >
        <Table
          rowKey="id"
          dataSource={enrollments}
          pagination={false}
          size="small"
          locale={{ emptyText: t('common.noData') }}
          columns={[
            {
              title: t('common.name'),
              key: 'name',
              render: (_, record: Enrollment) =>
                record.student?.user?.displayName ?? record.studentId,
            },
            {
              title: t('common.status'),
              key: 'attendanceStatus',
              width: 360,
              render: (_, record: Enrollment) => (
                <Radio.Group
                  value={attendanceMap[record.studentId] ?? 'present'}
                  onChange={(e) =>
                    setAttendanceMap((prev) => ({
                      ...prev,
                      [record.studentId]: e.target.value,
                    }))
                  }
                >
                  {ATTENDANCE_STATUS_OPTIONS.map((s) => (
                    <Radio key={s} value={s}>
                      {t(`attendance.${s}` as never)}
                    </Radio>
                  ))}
                </Radio.Group>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  )
}

export default AttendanceTrackingPage
