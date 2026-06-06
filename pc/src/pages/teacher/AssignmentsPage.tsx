import { useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Typography, Modal, Form, Input, Select,
  DatePicker, Drawer, Descriptions, InputNumber, message, Badge, Row, Col,
  Alert, Divider, Tooltip,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, Plus, Eye, CheckCircle, FileText, Target, Clock, Layers,
  HelpCircle, Edit3, BookMarked,
} from 'lucide-react'
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
  description: string | null
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
  homework: 'blue', project: 'purple', quiz: 'orange', reading: 'cyan', essay: 'geekblue', lab: 'green',
}
const TYPE_ICON: Record<string, React.ReactNode> = {
  homework: <BookOpen size={13} />,
  project: <Layers size={13} />,
  quiz: <HelpCircle size={13} />,
  reading: <BookMarked size={13} />,
  essay: <FileText size={13} />,
  lab: <Target size={13} />,
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'default', published: 'green', closed: 'default',
}

// Per-type field configurations
const TYPE_FIELDS: Record<string, React.ReactNode> = {
  homework: (
    <Alert
      type="info" showIcon style={{ marginBottom: 12 }}
      message="Homework: Clear instructions and due date are most important. Students submit text or file."
    />
  ),
  quiz: (
    <>
      <Alert type="warning" showIcon style={{ marginBottom: 12 }}
        message="Quiz / Test: Set a time limit and specify the number of questions so students can prepare." />
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="timeLimitMinutes" label="Time Limit (minutes)">
            <InputNumber min={5} max={300} style={{ width: '100%' }} placeholder="e.g. 45" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="questionCount" label="Number of Questions">
            <InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="e.g. 20" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="allowedResources" label="Allowed Resources">
        <Select
          mode="multiple"
          placeholder="Select what students may use"
          options={[
            { value: 'notes', label: 'Written notes' },
            { value: 'calculator', label: 'Calculator' },
            { value: 'textbook', label: 'Textbook' },
            { value: 'dictionary', label: 'Dictionary' },
          ]}
        />
      </Form.Item>
    </>
  ),
  project: (
    <>
      <Alert type="success" showIcon style={{ marginBottom: 12 }}
        message="Project: Describe milestones and whether this is individual or group work." />
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="groupSize" label="Group Size">
            <Select
              placeholder="Select"
              options={[
                { value: 1, label: 'Individual' },
                { value: 2, label: 'Pairs (2)' },
                { value: 3, label: 'Small group (3–4)' },
                { value: 5, label: 'Large group (5+)' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="presentationRequired" label="Presentation Required">
            <Select options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="milestones" label="Milestones / Key Deliverables">
        <Input.TextArea rows={3} placeholder="1. Draft outline by Week 2&#10;2. Progress check Week 4&#10;3. Final submission Week 6" />
      </Form.Item>
      <Form.Item name="rubric" label="Assessment Rubric">
        <Input.TextArea rows={3} placeholder="Content (40%), Presentation (30%), Teamwork (20%), Creativity (10%)" />
      </Form.Item>
    </>
  ),
  reading: (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="Reading: Specify chapters / pages and any follow-up discussion questions." />
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="readingSource" label="Book / Chapter / Pages">
            <Input placeholder="e.g. Textbook Chapter 5, pp. 78–95" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="estimatedReadingTime" label="Estimated Reading Time (min)">
            <InputNumber min={5} max={360} style={{ width: '100%' }} placeholder="e.g. 30" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="discussionQuestions" label="Discussion Questions">
        <Input.TextArea rows={3} placeholder="1. What is the main argument?&#10;2. Compare with previous chapter..." />
      </Form.Item>
    </>
  ),
  essay: (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="Essay: Set word count limits and specify the essay format required." />
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="minWords" label="Minimum Words">
            <InputNumber min={50} max={5000} style={{ width: '100%' }} placeholder="e.g. 500" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxWords" label="Maximum Words">
            <InputNumber min={50} max={5000} style={{ width: '100%' }} placeholder="e.g. 800" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="essayFormat" label="Format / Style">
        <Select
          placeholder="Select citation style"
          options={[
            { value: 'APA', label: 'APA 7th Edition' },
            { value: 'MLA', label: 'MLA' },
            { value: 'Chicago', label: 'Chicago' },
            { value: 'free', label: 'No specific format' },
          ]}
        />
      </Form.Item>
      <Form.Item name="essayPrompt" label="Essay Prompt">
        <Input.TextArea rows={3} placeholder="Discuss the impact of..." />
      </Form.Item>
    </>
  ),
  lab: (
    <>
      <Alert type="success" showIcon style={{ marginBottom: 12 }}
        message="Lab Work: Specify the experiment and required safety precautions." />
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="labVenue" label="Lab Venue / Room">
            <Input placeholder="e.g. Science Lab 1" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="labDuration" label="Duration (minutes)">
            <InputNumber min={30} max={360} style={{ width: '100%' }} placeholder="e.g. 90" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="equipmentList" label="Equipment / Materials Needed">
        <Input.TextArea rows={2} placeholder="Bunsen burner, beakers (250ml), thermometer..." />
      </Form.Item>
      <Form.Item name="safetyNotes" label="Safety Notes">
        <Input.TextArea rows={2} placeholder="Wear protective goggles, handle chemicals with care..." />
      </Form.Item>
    </>
  ),
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
  const [selectedType, setSelectedType] = useState<string>('homework')
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
      setSelectedType('homework')
      void queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] })
    },
    onError: () => message.error('Failed to create assignment'),
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

  const overdueCount = assignments.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status === 'published').length

  const columns: ColumnsType<Assignment> = [
    {
      title: 'Assignment',
      key: 'title',
      render: (_, r) => (
        <div>
          <Space>
            <span style={{ color: TYPE_COLOR[r.type] ?? '#888' }}>{TYPE_ICON[r.type]}</span>
            <Text strong>{r.title}</Text>
          </Space>
          <div style={{ fontSize: 12, color: '#888' }}>{r.course.code} — {r.course.name}</div>
          {r.description && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }} >{r.description.slice(0, 80)}{r.description.length > 80 ? '…' : ''}</div>}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (t: string) => <Tag color={TYPE_COLOR[t] ?? 'default'}>{t}</Tag>,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'due',
      width: 120,
      render: (d: string | null) => {
        if (!d) return <Text type="secondary">—</Text>
        const isOverdue = new Date(d) < new Date()
        return <span style={{ color: isOverdue ? '#f5222d' : undefined, fontWeight: isOverdue ? 600 : undefined }}>{dayjs(d).format('DD/MM/YYYY')}</span>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 95,
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: 'Submissions',
      key: 'subs',
      width: 110,
      render: (_, r) => <Badge count={r._count.submissions} showZero color="#165DFF" />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
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
            onClick={() => { setGradingId(s.id); setGradeScore(s.score ?? 0); setGradeFeedback(s.feedback ?? '') }}
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
            <div>
              <Title level={4} style={{ margin: 0 }}>Assignments</Title>
              {overdueCount > 0 && (
                <Text type="secondary" style={{ fontSize: 12, color: '#fa8c16' }}>
                  {overdueCount} assignment{overdueCount > 1 ? 's' : ''} past due date
                </Text>
              )}
            </div>
          </Space>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { form.resetFields(); setSelectedType('homework'); setCreateOpen(true) }}>
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

      {/* Create Assignment Modal — wide, type-specific */}
      <Modal
        title={<Space><BookOpen size={16} /> Create Assignment</Space>}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.validateFields().then((v) => createMutation.mutate(v))}
        confirmLoading={createMutation.isPending}
        okText="Create"
        width={780}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          {/* Basic fields */}
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter a title' }]}>
            <Input placeholder="e.g. Chapter 5 Review Questions" size="large" />
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
              <Form.Item name="type" label="Assignment Type" initialValue="homework">
                <Select
                  options={[
                    { value: 'homework', label: '📚 Homework' },
                    { value: 'quiz', label: '❓ Quiz / Test' },
                    { value: 'project', label: '🗂️ Project' },
                    { value: 'reading', label: '📖 Reading' },
                    { value: 'essay', label: '✍️ Essay' },
                    { value: 'lab', label: '🔬 Lab Work' },
                  ]}
                  onChange={(v) => setSelectedType(v)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="dueDate" label="Due Date">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" showTime={{ format: 'HH:mm' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxScore" label="Max Score" initialValue={100}>
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Instructions / Overview">
            <Input.TextArea rows={3} placeholder="Describe what students need to do, what to submit, and how it will be graded..." />
          </Form.Item>

          {/* Type-specific fields */}
          {selectedType && TYPE_FIELDS[selectedType] && (
            <>
              <Divider style={{ margin: '12px 0' }}>
                <Space size={6} style={{ color: TYPE_COLOR[selectedType] ?? '#888' }}>
                  {TYPE_ICON[selectedType]}
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{selectedType} settings</span>
                </Space>
              </Divider>
              {TYPE_FIELDS[selectedType]}
            </>
          )}

          <Form.Item name="status" label="Visibility" initialValue="published">
            <Select options={[
              { value: 'published', label: '🟢 Published — students can see this now' },
              { value: 'draft', label: '🔒 Draft — only visible to you' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Submissions Drawer */}
      <Drawer
        title={selectedAssignment ? `Submissions — ${selectedAssignment.title}` : 'Submissions'}
        open={submissionsOpen}
        onClose={() => { setSubmissionsOpen(false); setSelectedAssignment(null) }}
        width={860}
      >
        {selectedAssignment && (
          <div>
            <Descriptions size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Course">{selectedAssignment.course.name}</Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color={TYPE_COLOR[selectedAssignment.type] ?? 'default'}>{selectedAssignment.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Due">{selectedAssignment.dueDate ? dayjs(selectedAssignment.dueDate).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Max Score">{selectedAssignment.maxScore}</Descriptions.Item>
              <Descriptions.Item label="Submitted">{submissions.length}</Descriptions.Item>
              <Descriptions.Item label="Ungraded">{submissions.filter(s => s.score === null).length}</Descriptions.Item>
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
