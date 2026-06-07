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
import SyncBadge from '../../components/SyncBadge'
import dayjs from 'dayjs'
import api from '../../lib/api'
import type { Course, AttendanceSession, AttendanceRecord, Enrollment } from '../../types'
import { useAuthStore } from '../../stores/authStore'

const { Title } = Typography

const SESSION_STATUS_COLORS: Record<string, string> = {
  active: 'green',
  completed: 'default',
}

const ATTENDANCE_STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'] as const

const AttendanceTrackingPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canEdit = ['admin', 'manager', 'teacher'].includes(user?.role ?? '')
  const canViewSchoolWide = ['admin', 'manager', 'principal'].includes(user?.role ?? '')
  const todayDateStr = dayjs().format('YYYY-MM-DD')

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

  // Today's school-wide overview (admin/principal/manager, no course selected)
  const { data: todaySessions = [], isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today-overview', todayDateStr],
    queryFn: async () => {
      const { data } = await api.get(`/attendance/sessions?date=${todayDateStr}`)
      return data.data as AttendanceSession[]
    },
    enabled: canViewSchoolWide && !selectedCourseId,
  })

  const todayOverviewStats = useMemo(() => {
    const present = todaySessions.reduce((sum, s) => sum + (s.presentCount ?? 0), 0)
    const late = todaySessions.reduce((sum, s) => sum + (s.lateCount ?? 0), 0)
    const total = todaySessions.reduce((sum, s) => sum + (s._count?.records ?? 0), 0)
    const absent = Math.max(0, total - present - late)
    const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0
    return { present, late, absent, total, rate }
  }, [todaySessions])

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
    let totalRecords = 0
    let presentCount = 0
    sessions.forEach((s) => {
      totalRecords += s._count?.records ?? 0
      presentCount += (s.presentCount ?? 0) + (s.lateCount ?? 0)
    })
    const presentRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 1000) / 10 : 0
    return { totalSessions, totalRecords, presentCount, presentRate }
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

  // Pre-populate attendance map: existing records take priority; new sessions default all to "present"
  useMemo(() => {
    if (!markModalOpen || enrollments.length === 0) return
    const map: Record<string, string> = {}
    // Default all enrolled students to "present"
    enrollments.forEach((e) => { map[e.studentId] = 'present' })
    // Override with saved records if any
    existingRecords.forEach((r) => { map[r.studentId] = r.status })
    setAttendanceMap(map)
  }, [existingRecords, enrollments, markModalOpen])

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
        record.status === 'active' && canEdit ? (
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
            <SyncBadge source="NIH" relativeTime="09:14" absoluteTime="Last pushed to National Information Hub at 09:14" />
          </Space>
        </Col>
        <Col>
          {selectedCourseId && canEdit && (
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

      {/* Today's School-wide Overview — visible when admin/principal lands here from KPI Center */}
      {canViewSchoolWide && !selectedCourseId && (
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <CalendarCheck size={16} />
              <span>
                {t('attendance.todayOverview', { defaultValue: "Today's School-wide Attendance" })} — {todayDateStr}
              </span>
            </Space>
          }
        >
          <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Statistic
                title={t('attendance.overallRate', { defaultValue: 'Overall Rate' })}
                value={todayOverviewStats.total > 0 ? todayOverviewStats.rate : '-'}
                suffix={todayOverviewStats.total > 0 ? '%' : ''}
                precision={todayOverviewStats.total > 0 ? 1 : undefined}
                valueStyle={{
                  color:
                    todayOverviewStats.total === 0
                      ? undefined
                      : todayOverviewStats.rate >= 90
                        ? '#52c41a'
                        : todayOverviewStats.rate >= 80
                          ? '#fa8c16'
                          : '#ff4d4f',
                  fontSize: 24,
                }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title={t('attendance.present', { defaultValue: 'Present' })}
                value={todayOverviewStats.present}
                valueStyle={{ color: '#52c41a', fontSize: 24 }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title={t('attendance.late', { defaultValue: 'Late' })}
                value={todayOverviewStats.late}
                valueStyle={{ color: '#fa8c16', fontSize: 24 }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title={t('attendance.absent', { defaultValue: 'Absent' })}
                value={todayOverviewStats.absent}
                valueStyle={{ color: '#ff4d4f', fontSize: 24 }}
              />
            </Col>
          </Row>
          <Table<AttendanceSession>
            rowKey="id"
            dataSource={todaySessions}
            loading={todayLoading}
            size="small"
            pagination={false}
            locale={{
              emptyText: t('attendance.noSessionsToday', {
                defaultValue: 'No attendance sessions recorded today.',
              }),
            }}
            columns={[
              {
                title: t('attendance.course', { defaultValue: 'Course' }),
                key: 'course',
                render: (_, record) =>
                  record.course ? `${record.course.code} — ${record.course.name}` : '-',
              },
              {
                title: t('attendance.topic'),
                dataIndex: 'topic',
                key: 'topic',
                render: (v: string) => v || '-',
              },
              {
                title: t('common.total'),
                key: 'total',
                width: 70,
                render: (_, record) => record._count?.records ?? 0,
              },
              {
                title: t('attendance.present', { defaultValue: 'Present' }),
                key: 'present',
                width: 80,
                render: (_, record) => (
                  <span style={{ color: '#52c41a' }}>{record.presentCount ?? 0}</span>
                ),
              },
              {
                title: t('attendance.late', { defaultValue: 'Late' }),
                key: 'late',
                width: 70,
                render: (_, record) => (
                  <span style={{ color: '#fa8c16' }}>{record.lateCount ?? 0}</span>
                ),
              },
              {
                title: t('attendance.absent', { defaultValue: 'Absent' }),
                key: 'absent',
                width: 80,
                render: (_, record) => {
                  const total = record._count?.records ?? 0
                  const present = record.presentCount ?? 0
                  const late = record.lateCount ?? 0
                  return <span style={{ color: '#ff4d4f' }}>{Math.max(0, total - present - late)}</span>
                },
              },
              {
                title: t('attendance.presentRate'),
                key: 'rate',
                width: 80,
                render: (_, record) => {
                  const total = record._count?.records ?? 0
                  const present = record.presentCount ?? 0
                  const late = record.lateCount ?? 0
                  if (total === 0) return '-'
                  const rate = Math.round((present / total) * 1000) / 10
                  return (
                    <span
                      style={{
                        color: rate >= 90 ? '#52c41a' : rate >= 80 ? '#fa8c16' : '#ff4d4f',
                      }}
                    >
                      {rate.toFixed(1)}%
                    </span>
                  )
                },
              },
            ]}
          />
        </Card>
      )}

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
                value={stats.totalRecords > 0 ? stats.presentRate.toFixed(1) : '-'}
                suffix={stats.totalRecords > 0 ? '%' : ''}
                valueStyle={{ color: stats.presentRate >= 80 ? '#52c41a' : stats.presentRate >= 60 ? '#fa8c16' : '#ff4d4f' }}
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
          canEdit && (
            <Button
              key="save"
              type="primary"
              loading={saveRecordsMutation.isPending}
              onClick={handleSaveAttendance}
            >
              {t('attendance.saveAttendance')}
            </Button>
          ),
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
