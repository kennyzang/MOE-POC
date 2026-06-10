import { useState } from 'react'
import {
  Card, Row, Col, Statistic, Table, Tag, Space, Button, Typography, Spin,
  Alert, Modal, Form, Input, Select, message, DatePicker, List, Avatar,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  UserSquare2, Award, BookOpen, Users, Bell, ShieldAlert,
  TrendingDown, CalendarCheck, ClipboardList, CheckCircle2, AlertCircle,
} from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import api from '@/lib/api'

dayjs.extend(relativeTime)

const { Title, Text } = Typography

interface StudentRow {
  id: string
  studentId: string
  displayName: string
  academicStanding: string
  attendanceRate: number | null
  gradeAverage: number | null
  netBehaviorPoints: number
}

interface FormClassData {
  roster: { className: string; gradeLevel: string; capacity: number; programme: string } | null
  students: StudentRow[]
  summary: { total: number; avgGpa: number; netBehavior: number }
}

interface AttendanceSession {
  id: string
  date: string
  status: string
  course: { id: string; code: string; name: string }
  presentCount?: number
  absentCount?: number
}

interface TodayRollCall {
  id: string
  date: string
  createdAt: string
  status: string
  totalCount: number
  presentCount: number
  absentCount: number
  lateCount: number
  records?: { studentId: string; status: string }[]
}

const STANDING_COLOR: Record<string, string> = {
  GOOD_STANDING: 'green',
  ACADEMIC_WATCH: 'orange',
  PROBATION: 'red',
  AT_RISK: 'red',
}

const FormTeacherPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [behaviorOpen, setBehaviorOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null)
  const [rollCallDate, setRollCallDate] = useState(dayjs())
  const [rollCallMap, setRollCallMap] = useState<Record<string, string>>({})
  const [rollCallOpen, setRollCallOpen] = useState(false)
  const [noticeForm] = Form.useForm()
  const [behaviorForm] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['form-class'],
    queryFn: async () => {
      const { data } = await api.get('/teachers/me/form-class')
      return data.data as FormClassData | null
    },
  })

  const { data: recentSessions = [] } = useQuery({
    queryKey: ['teacher-recent-sessions'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/sessions')
      return ((data.data as AttendanceSession[]) ?? []).slice(0, 8)
    },
  })

  const { data: todayRollCall, isLoading: todayLoading } = useQuery({
    queryKey: ['today-roll-call'],
    queryFn: async () => {
      const { data } = await api.get('/attendance/roll-call/today')
      return (data.data as TodayRollCall | null) ?? null
    },
  })

  const handleOpenRollCall = () => {
    if (todayRollCall?.records) {
      // Pre-fill from existing roll call records for editing
      const existingMap: Record<string, string> = {}
      todayRollCall.records.forEach((r) => {
        existingMap[r.studentId] = r.status
      })
      setRollCallMap(existingMap)
    } else {
      setRollCallMap({})
    }
    setRollCallDate(dayjs())
    setRollCallOpen(true)
  }

  const handleRollCallDateChange = (d: dayjs.Dayjs | null) => {
    if (!d) return
    setRollCallDate(d)
    // If user changed to a different date, clear the map (start fresh)
    if (!d.isSame(dayjs(), 'day')) {
      setRollCallMap({})
    } else if (todayRollCall?.records) {
      // Back to today — re-load existing records if any
      const existingMap: Record<string, string> = {}
      todayRollCall.records.forEach((r) => {
        existingMap[r.studentId] = r.status
      })
      setRollCallMap(existingMap)
    }
  }



  const postNoticeMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const gradeLevel = data?.roster?.gradeLevel
      await api.post('/announcements', {
        ...values,
        targetAudience: gradeLevel ? `grade:${gradeLevel}` : 'students',
        gradeLevel: gradeLevel ?? null,
      })
    },
    onSuccess: () => {
      message.success('Notice posted to class')
      setNoticeOpen(false)
      noticeForm.resetFields()
    },
  })

  const behaviorMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data: res } = await api.post('/behavior', { ...values, studentId: selectedStudent?.id })
      return res
    },
    onSuccess: () => {
      message.success('Behavior record logged')
      setBehaviorOpen(false)
      behaviorForm.resetFields()
      setSelectedStudent(null)
      void queryClient.invalidateQueries({ queryKey: ['form-class'] })
    },
  })

  const rollCallMutation = useMutation({
    mutationFn: async () => {
      const formRoster = data?.roster
      const formStudents = data?.students ?? []
      const records = formStudents.map((s) => ({
        studentId: s.id,
        status: rollCallMap[s.id] ?? 'present',
      }))
      await api.post('/attendance/roll-call', {
        date: rollCallDate.format('YYYY-MM-DD'),
        className: formRoster?.className ?? 'Form Class',
        records,
      })
    },
    onSuccess: () => {
      message.success(`Roll call submitted for ${rollCallDate.format('DD/MM/YYYY')}`)
      setRollCallOpen(false)
      setRollCallMap({})
      void queryClient.invalidateQueries({ queryKey: ['teacher-recent-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['today-roll-call'] })
    },
    onError: () => message.error('Failed to submit roll call. Please try again.'),
  })

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  if (!data || !data.roster) {
    return (
      <div style={{ padding: 32 }}>
        <Alert
          type="info"
          showIcon
          message="No Form Class Assigned"
          description="You are not currently assigned as a form teacher for any class. Please contact the administrator."
        />
      </div>
    )
  }

  const { roster, students, summary } = data
  const atRiskCount = students.filter((s) => s.academicStanding !== 'GOOD_STANDING').length

  const classParam = `className=${encodeURIComponent(roster.className)}&gradeLevel=${encodeURIComponent(roster.gradeLevel)}`

  const KPI_CARDS = [
    {
      title: 'Total Students',
      value: summary.total,
      icon: <Users size={18} />,
      color: '#1677ff',
      bg: '#e6f4ff',
      navTo: `/sis/students?${classParam}`,
      suffix: undefined as string | undefined,
    },
    {
      title: 'Class Avg GPA',
      value: Math.round(summary.avgGpa * 10) / 10,
      icon: <BookOpen size={18} />,
      color: summary.avgGpa >= 70 ? '#52c41a' : '#fa8c16',
      bg: summary.avgGpa >= 70 ? '#f6ffed' : '#fff7e6',
      navTo: '/sis/grades',
      suffix: '%',
    },
    {
      title: 'At Risk',
      value: atRiskCount,
      icon: <TrendingDown size={18} />,
      color: atRiskCount > 0 ? '#f5222d' : '#52c41a',
      bg: atRiskCount > 0 ? '#fff1f0' : '#f6ffed',
      navTo: `/sis/students?${classParam}`,
      suffix: undefined,
    },
    {
      title: 'Net Conduct Points',
      value: summary.netBehavior,
      icon: <Award size={18} />,
      color: summary.netBehavior >= 0 ? '#52c41a' : '#f5222d',
      bg: summary.netBehavior >= 0 ? '#f6ffed' : '#fff1f0',
      navTo: `/sis/students?${classParam}`,
      suffix: undefined,
    },
  ]

  const columns: ColumnsType<StudentRow> = [
    {
      title: 'Student',
      dataIndex: 'displayName',
      key: 'name',
      render: (name: string, r: StudentRow) => (
        <div
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/sis/students/${r.id}`)}
        >
          <Text strong style={{ color: '#1677ff' }}>{name}</Text>
          <div style={{ fontSize: 12, color: '#888' }}>{r.studentId}</div>
        </div>
      ),
    },
    {
      title: 'Standing',
      dataIndex: 'academicStanding',
      key: 'standing',
      render: (s: string) => (
        <Tag color={STANDING_COLOR[s] ?? 'default'} style={{ fontSize: 11 }}>
          {s.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Attendance (30d)',
      dataIndex: 'attendanceRate',
      key: 'att',
      render: (r: number | null) =>
        r !== null ? (
          <Tag color={r >= 80 ? 'green' : r >= 60 ? 'orange' : 'red'}>{r}%</Tag>
        ) : '—',
    },
    {
      title: 'GPA',
      dataIndex: 'gradeAverage',
      key: 'gpa',
      render: (g: number | null) =>
        g !== null ? <Tag color={g >= 70 ? 'green' : g >= 50 ? 'orange' : 'red'}>{g}%</Tag> : '—',
    },
    {
      title: 'Conduct',
      dataIndex: 'netBehaviorPoints',
      key: 'behavior',
      render: (p: number) => (
        <Tag color={p > 0 ? 'green' : p < 0 ? 'red' : 'default'}>
          {p > 0 ? `+${p}` : p}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, r: StudentRow) => (
        <Button
          size="small"
          icon={<ShieldAlert size={12} />}
          onClick={() => { setSelectedStudent(r); setBehaviorOpen(true) }}
        >
          Log
        </Button>
      ),
    },
  ]

  const rollCallStudents = students.map((s) => ({
    ...s,
    status: rollCallMap[s.id] ?? 'present',
  }))

  const sessionStatusColor: Record<string, string> = { active: 'green', closed: 'default', draft: 'orange' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <UserSquare2 size={22} style={{ color: '#165DFF' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {roster.className} — {roster.gradeLevel}
              </Title>
              <Text type="secondary">{roster.programme} · Capacity: {roster.capacity}</Text>
            </div>
          </Space>
          <Space>
            <Button icon={<BookOpen size={14} />} onClick={handleOpenRollCall}>
              Daily Roll Call
            </Button>
            <Button icon={<Bell size={14} />} onClick={() => setNoticeOpen(true)}>
              Post Notice
            </Button>
          </Space>
        </div>
      </Card>

      {/* Today's Roll Call Status Banner */}
      {!todayLoading && (
        todayRollCall ? (
          <Card size="small" style={{ borderLeft: '4px solid #52c41a', background: '#f6ffed' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <span style={{ color: '#52c41a' }}><CheckCircle2 size={18} /></span>
                <div>
                  <span style={{ fontWeight: 600, color: '#237804' }}>Today's Roll Call Submitted</span>
                  <span style={{ color: '#52c41a', marginLeft: 8, fontSize: 13 }}>
                    at {dayjs(todayRollCall.createdAt).format('HH:mm')}
                  </span>
                  <span style={{ color: '#8c8c8c', marginLeft: 16, fontSize: 12 }}>
                    Present {todayRollCall.presentCount} · Absent {todayRollCall.absentCount} · Late {todayRollCall.lateCount}
                  </span>
                </div>
              </Space>
              <Space>
                <Button
                  size="small"
                  type="link"
                  onClick={() => navigate(`/sis/attendance?sessionId=${todayRollCall.id}`)}
                >
                  View Details
                </Button>
                <Button size="small" onClick={handleOpenRollCall}>
                  Edit
                </Button>
              </Space>
            </div>
          </Card>
        ) : (
          <Card size="small" style={{ borderLeft: '4px solid #faad14', background: '#fffbe6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <span style={{ color: '#faad14' }}><AlertCircle size={18} /></span>
                <span style={{ fontWeight: 600, color: '#ad6800' }}>Today's Roll Call Not Yet Submitted</span>
              </Space>
              <Button type="primary" size="small" icon={<BookOpen size={13} />} onClick={handleOpenRollCall}>
                Take Roll Call
              </Button>
            </div>
          </Card>
        )
      )}

      {/* KPI Cards — clickable */}
      <Row gutter={[16, 16]}>
        {KPI_CARDS.map((kpi) => (
          <Col xs={12} sm={6} key={kpi.title}>
            <Card
              size="small"
              hoverable
              style={{ cursor: 'pointer', borderTop: `3px solid ${kpi.color}` }}
              onClick={() => navigate(kpi.navTo)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ background: kpi.bg, borderRadius: 8, padding: 6, display: 'flex', color: kpi.color }}>
                  {kpi.icon}
                </div>
              </div>
              <Statistic
                title={kpi.title}
                value={kpi.value}
                suffix={kpi.suffix}
                valueStyle={{ fontSize: 24, fontWeight: 700, color: kpi.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main content: roster + recent sessions */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={17}>
          {/* Student Roster Table */}
          <Card title={<Space><Users size={16} /> Student Roster</Space>}>
            <Table
              columns={columns}
              dataSource={students}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 15, showSizeChanger: false }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={7}>
          {/* Recent Attendance Sessions */}
          <Card
            title={<Space><ClipboardList size={16} />Recent Sessions</Space>}
            extra={
              <Button type="link" size="small" onClick={() => navigate('/sis/attendance')}>
                View All
              </Button>
            }
            style={{ height: '100%' }}
          >
            {recentSessions.length === 0 ? (
              <Alert type="info" showIcon message="No recent sessions found." />
            ) : (
              <List
                size="small"
                dataSource={recentSessions}
                renderItem={(session: AttendanceSession) => (
                  <List.Item
                    style={{ cursor: 'pointer', padding: '8px 0' }}
                    onClick={() => navigate(`/sis/attendance?courseId=${session.course?.id ?? ''}`)}

                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          size="small"
                          style={{ background: session.status === 'active' ? '#52c41a' : '#d9d9d9' }}
                          icon={<CalendarCheck size={12} />}
                        />
                      }
                      title={
                        <Space size={4}>
                          <Text style={{ fontSize: 13 }}>{session.course?.name ?? 'Unknown'}</Text>
                          <Tag color={sessionStatusColor[session.status] ?? 'default'} style={{ fontSize: 10, margin: 0 }}>
                            {session.status}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(session.date).format('DD MMM YYYY')} · {session.course?.code}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Daily Roll Call Modal */}
      <Modal
        title={
          <Space>
            <BookOpen size={16} />
            {todayRollCall?.records && todayRollCall.records.length > 0
              ? `Edit Roll Call — ${rollCallDate.format('DD/MM/YYYY')}`
              : `Daily Roll Call — ${rollCallDate.format('DD/MM/YYYY')}`}
          </Space>
        }
        open={rollCallOpen}
        onCancel={() => setRollCallOpen(false)}
        onOk={() => rollCallMutation.mutate()}
        okText={todayRollCall?.records && todayRollCall.records.length > 0 ? 'Update Roll Call' : 'Submit Roll Call'}
        width={600}
      >
        <DatePicker
          value={rollCallDate}
          onChange={handleRollCallDateChange}
          style={{ marginBottom: 16 }}
          format="DD/MM/YYYY"
        />
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {rollCallStudents.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Text>{s.displayName}</Text>
              <Select
                value={rollCallMap[s.id] ?? 'present'}
                size="small"
                style={{ width: 120 }}
                onChange={(v) => setRollCallMap((m) => ({ ...m, [s.id]: v }))}
                options={[
                  { value: 'present', label: '✅ Present' },
                  { value: 'absent', label: '❌ Absent' },
                  { value: 'late', label: '🕐 Late' },
                  { value: 'excused', label: '📋 Excused' },
                ]}
              />
            </div>
          ))}
        </div>
      </Modal>

      {/* Post Notice Modal */}
      <Modal
        title={<Space><Bell size={16} /> Post Notice to {roster.className}</Space>}
        open={noticeOpen}
        onCancel={() => setNoticeOpen(false)}
        onOk={() => noticeForm.validateFields().then((v) => postNoticeMutation.mutate(v))}
        confirmLoading={postNoticeMutation.isPending}
        okText="Post"
      >
        <Form form={noticeForm} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Reminder: Sports Day next Friday" />
          </Form.Item>
          <Form.Item name="content" label="Content" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="Details..." />
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue="normal">
            <Select options={[
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Log Behavior Modal */}
      <Modal
        title={<Space><ShieldAlert size={16} /> Log Behavior — {selectedStudent?.displayName}</Space>}
        open={behaviorOpen}
        onCancel={() => { setBehaviorOpen(false); behaviorForm.resetFields(); setSelectedStudent(null) }}
        onOk={() => behaviorForm.validateFields().then((v) => behaviorMutation.mutate(v))}
        confirmLoading={behaviorMutation.isPending}
        okText="Submit"
      >
        <Form form={behaviorForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true }]} initialValue="demerit">
                <Select options={[
                  { value: 'merit', label: '🏅 Merit' },
                  { value: 'demerit', label: '⚠️ Demerit' },
                  { value: 'incident', label: '📋 Incident' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]} initialValue="conduct">
                <Select options={[
                  { value: 'academic', label: 'Academic' },
                  { value: 'conduct', label: 'Conduct' },
                  { value: 'attendance', label: 'Attendance' },
                  { value: 'achievement', label: 'Achievement' },
                  { value: 'other', label: 'Other' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="points" label="Points" initialValue={1}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="Severity">
                <Select allowClear options={[
                  { value: 'minor', label: 'Minor' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'major', label: 'Major' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Describe the behavior or achievement..." />
          </Form.Item>
          <Form.Item name="actionTaken" label="Action Taken">
            <Input placeholder="Verbal warning, sent to counselor..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FormTeacherPage
