import { useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Typography, Modal, Form, Input, Select,
  DatePicker, Drawer, Descriptions, InputNumber, message, Badge, Row, Col,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Eye, CheckCircle } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import api from '@/lib/api'

const { Title, Text } = Typography

interface Assignment {
  id: string
  title: string
  type: string
  dueDate: string | null
  status: string
  maxScore: number
  course: { name: string; code: string }
  _count: { submissions: number }
}

interface Submission {
  id: string
  studentId: string
  content: string | null
  fileUrl: string | null
  submittedAt: string
  isLate: boolean
  score: number | null
  feedback: string | null
  status: string
  student: { user: { displayName: string } }
}

const TYPE_COLOR: Record<string, string> = {
  homework: 'blue', project: 'purple', quiz: 'orange', reading: 'cyan',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'default', published: 'green', closed: 'default',
}

const TeacherAssignmentsPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [submissionsOpen, setSubmissionsOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [gradingId, setGradingId] = useState<string | null>(null)
  const [gradeScore, setGradeScore] = useState<number>(0)
  const [gradeFeedback, setGradeFeedback] = useState('')
  const [form] = Form.useForm()

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: async () => {
      const { data } = await api.get('/assignments')
      return data.data as Assignment[]
    },
  })

  const { data: courses = [] } = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => {
      const { data } = await api.get('/courses')
      return data.data as Array<{ id: string; name: string; code: string }>
    },
  })

  const { data: submissions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['assignment-submissions', selectedAssignment?.id],
    queryFn: async () => {
      if (!selectedAssignment) return []
      const { data } = await api.get(`/assignments/${selectedAssignment.id}/submissions`)
      return data.data as Submission[]
    },
    enabled: !!selectedAssignment && submissionsOpen,
  })

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = {
        ...values,
        dueDate: values.dueDate ? (values.dueDate as dayjs.Dayjs).toISOString() : undefined,
      }
      const { data } = await api.post('/assignments', payload)
      return data
    },
    onSuccess: () => {
      message.success('Assignment created')
      setCreateOpen(false)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] })
    },
  })

  const gradeMutation = useMutation({
    mutationFn: async ({ assignmentId, submissionId, score, feedback }: { assignmentId: string; submissionId: string; score: number; feedback: string }) => {
      await api.patch(`/assignments/${assignmentId}/submissions/${submissionId}/grade`, { score, feedback })
    },
    onSuccess: () => {
      message.success('Graded successfully')
      setGradingId(null)
      void queryClient.invalidateQueries({ queryKey: ['assignment-submissions', selectedAssignment?.id] })
    },
  })

  const columns: ColumnsType<Assignment> = [
    {
      title: 'Assignment',
      key: 'title',
      render: (_, r) => (
        <div>
          <Text strong>{r.title}</Text>
          <div style={{ fontSize: 12, color: '#888' }}>{r.course.code} — {r.course.name}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => <Tag color={TYPE_COLOR[t] ?? 'default'}>{t}</Tag>,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'due',
      render: (d: string | null) => {
        if (!d) return '—'
        const isOverdue = new Date(d) < new Date()
        return <span style={{ color: isOverdue ? '#f5222d' : undefined }}>{dayjs(d).format('DD/MM/YYYY')}</span>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: 'Submissions',
      key: 'subs',
      render: (_, r) => <Badge count={r._count.submissions} showZero color="#165DFF" />,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Button
          type="link"
          size="small"
          icon={<Eye size={14} />}
          onClick={() => { setSelectedAssignment(r); setSubmissionsOpen(true) }}
        >
          Submissions
        </Button>
      ),
    },
  ]

  const subColumns: ColumnsType<Submission> = [
    {
      title: 'Student',
      key: 'student',
      render: (_, s) => (
        <Space>
          <Text>{s.student.user.displayName}</Text>
          {s.isLate && <Tag color="orange">LATE</Tag>}
        </Space>
      ),
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'time',
      render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Response',
      dataIndex: 'content',
      key: 'content',
      render: (c: string | null) => c ? <Text ellipsis style={{ maxWidth: 200 }}>{c}</Text> : <Text type="secondary">No text response</Text>,
    },
    {
      title: 'Score',
      key: 'score',
      render: (_, s) => s.score !== null ? `${s.score}/${selectedAssignment?.maxScore ?? 100}` : <Tag>Ungraded</Tag>,
    },
    {
      title: 'Grade',
      key: 'grade',
      render: (_, s) => (
        gradingId === s.id ? (
          <Space>
            <InputNumber
              size="small"
              min={0}
              max={selectedAssignment?.maxScore ?? 100}
              value={gradeScore}
              onChange={(v) => setGradeScore(v ?? 0)}
              style={{ width: 70 }}
            />
            <Input.TextArea
              size="small"
              rows={1}
              placeholder="Feedback"
              value={gradeFeedback}
              onChange={(e) => setGradeFeedback(e.target.value)}
              style={{ width: 150 }}
            />
            <Button
              size="small"
              type="primary"
              icon={<CheckCircle size={12} />}
              loading={gradeMutation.isPending}
              onClick={() => gradeMutation.mutate({
                assignmentId: selectedAssignment!.id,
                submissionId: s.id,
                score: gradeScore,
                feedback: gradeFeedback,
              })}
            >
              Save
            </Button>
            <Button size="small" onClick={() => setGradingId(null)}>Cancel</Button>
          </Space>
        ) : (
          <Button
            size="small"
            onClick={() => {
              setGradingId(s.id)
              setGradeScore(s.score ?? 0)
              setGradeFeedback(s.feedback ?? '')
            }}
          >
            {s.score !== null ? 'Re-grade' : 'Grade'}
          </Button>
        )
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <BookOpen size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Assignments</Title>
          </Space>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            Create Assignment
          </Button>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={assignments}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          locale={{ emptyText: 'No assignments yet. Create one to get started.' }}
        />
      </Card>

      {/* Create Assignment Modal */}
      <Modal
        title={<Space><BookOpen size={16} /> Create Assignment</Space>}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.validateFields().then((v) => createMutation.mutate(v))}
        confirmLoading={createMutation.isPending}
        okText="Create"
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Chapter 5 Questions" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="courseId" label="Course" rules={[{ required: true }]}>
                <Select
                  options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                  placeholder="Select course"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="Type" initialValue="homework">
                <Select options={[
                  { value: 'homework', label: 'Homework' },
                  { value: 'project', label: 'Project' },
                  { value: 'quiz', label: 'Quiz / Test' },
                  { value: 'reading', label: 'Reading' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="dueDate" label="Due Date">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxScore" label="Max Score" initialValue={100}>
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Instructions">
            <Input.TextArea rows={4} placeholder="Describe the assignment and what is expected..." />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="published">
            <Select options={[
              { value: 'published', label: 'Published (students can see)' },
              { value: 'draft', label: 'Draft (not visible yet)' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Submissions Drawer */}
      <Drawer
        title={selectedAssignment ? `Submissions — ${selectedAssignment.title}` : 'Submissions'}
        open={submissionsOpen}
        onClose={() => { setSubmissionsOpen(false); setSelectedAssignment(null) }}
        width={800}
      >
        {selectedAssignment && (
          <div>
            <Descriptions size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Course">{selectedAssignment.course.name}</Descriptions.Item>
              <Descriptions.Item label="Due">{selectedAssignment.dueDate ? dayjs(selectedAssignment.dueDate).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Max Score">{selectedAssignment.maxScore}</Descriptions.Item>
              <Descriptions.Item label="Total Submitted">{submissions.length}</Descriptions.Item>
            </Descriptions>
            <Table
              columns={subColumns}
              dataSource={submissions}
              rowKey="id"
              loading={subsLoading}
              size="small"
              pagination={false}
              locale={{ emptyText: 'No submissions yet.' }}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default TeacherAssignmentsPage
