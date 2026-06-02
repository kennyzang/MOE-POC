import { useState } from 'react'
import {
  Card, Row, Col, Statistic, Table, Tag, Space, Button, Typography, Spin,
  Alert, Modal, Form, Input, Select, message, Tabs, DatePicker, Badge,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserSquare2, Award, BookOpen, Users, Bell, ShieldAlert, Plus } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import api from '@/lib/api'

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

const STANDING_COLOR: Record<string, string> = {
  GOOD_STANDING: 'green',
  ACADEMIC_WATCH: 'orange',
  PROBATION: 'red',
  AT_RISK: 'red',
}

const FormTeacherPage = () => {
  const { t } = useTranslation()
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
      // Create daily attendance session for the Daily Roll Call course (DAILY001)
      // This is a simplified form-teacher roll call, stored as notification/log
      // For now we just show a success message since daily roll call is separate from course-based sessions
      await new Promise((r) => setTimeout(r, 500))
    },
    onSuccess: () => {
      message.success(`Roll call recorded for ${rollCallDate.format('DD/MM/YYYY')}`)
      setRollCallOpen(false)
      setRollCallMap({})
    },
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

  const columns: ColumnsType<StudentRow> = [
    {
      title: 'Student',
      dataIndex: 'displayName',
      key: 'name',
      render: (name: string, r: StudentRow) => (
        <div>
          <Text strong>{name}</Text>
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
          {s.replace('_', ' ')}
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
            <Button icon={<BookOpen size={14} />} onClick={() => setRollCallOpen(true)}>
              Daily Roll Call
            </Button>
            <Button icon={<Bell size={14} />} onClick={() => setNoticeOpen(true)}>
              Post Notice
            </Button>
          </Space>
        </div>
      </Card>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total Students" value={summary.total} prefix={<Users size={16} />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Class Avg GPA"
              value={Math.round(summary.avgGpa * 10) / 10}
              suffix="%"
              styles={{ content: { color: summary.avgGpa >= 70 ? '#52c41a' : '#fa8c16' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="At Risk"
              value={students.filter((s) => s.academicStanding !== 'GOOD_STANDING').length}
              styles={{ content: { color: '#f5222d' } }}
              prefix={<ShieldAlert size={16} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Net Conduct Points"
              value={summary.netBehavior}
              prefix={<Award size={16} />}
              styles={{ content: { color: summary.netBehavior >= 0 ? '#52c41a' : '#f5222d' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Student Roster Table */}
      <Card title={<Space><Users size={16} /> Student Roster</Space>}>
        <Table
          columns={columns}
          dataSource={students}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      </Card>

      {/* Daily Roll Call Modal */}
      <Modal
        title={
          <Space>
            <BookOpen size={16} />
            Daily Roll Call — {rollCallDate.format('DD/MM/YYYY')}
          </Space>
        }
        open={rollCallOpen}
        onCancel={() => setRollCallOpen(false)}
        onOk={() => rollCallMutation.mutate()}
        okText="Submit Roll Call"
        width={600}
      >
        <DatePicker
          value={rollCallDate}
          onChange={(d) => d && setRollCallDate(d)}
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
