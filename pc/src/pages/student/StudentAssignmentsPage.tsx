import { useState } from 'react'
import {
  Card, Tabs, Table, Tag, Typography, Space, Button, Modal, Input, Alert,
  Statistic, Row, Col, Tooltip,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Send, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import FileUploader from '@/components/FileUploader'

dayjs.extend(relativeTime)

const { Title, Text, Paragraph } = Typography

interface AssignmentRow {
  id: string
  title: string
  type: string
  description: string | null
  dueDate: string | null
  maxScore: number
  course: { name: string; code: string }
  submission: {
    id: string
    content: string | null
    submittedAt: string
    isLate: boolean
    score: number | null
    feedback: string | null
    status: string
  } | null
  submissionStatus: string // 'pending' | 'submitted' | 'late' | 'graded' | 'overdue'
}

const TYPE_COLOR: Record<string, string> = { homework: 'blue', project: 'purple', quiz: 'orange', reading: 'cyan' }

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: 'Pending' },
  overdue: { color: 'red', label: 'Overdue' },
  submitted: { color: 'blue', label: 'Submitted' },
  late: { color: 'orange', label: 'Submitted (Late)' },
  graded: { color: 'green', label: 'Graded' },
}

// Students in Year 9 and above can submit online
const CAN_SUBMIT_ONLINE = ['Year 9', 'Year 10', 'Year 11', 'Year 12']

const StudentAssignmentsPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState<AssignmentRow | null>(null)
  const [submitContent, setSubmitContent] = useState('')
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)

  // Get student's grade level for determining submission capability
  const { data: studentData } = useQuery({
    queryKey: ['student-me'],
    queryFn: async () => {
      const { data } = await api.get('/students/me')
      return data.data as { gradeLevel: string | null; className: string | null }
    },
  })

  const gradeLevel = studentData?.gradeLevel ?? ''
  const canSubmitOnline = CAN_SUBMIT_ONLINE.includes(gradeLevel)

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['student-assignments'],
    queryFn: async () => {
      const { data } = await api.get('/students/me/assignments')
      return data.data as AssignmentRow[]
    },
  })

  const submitMutation = useMutation({
    mutationFn: async ({ assignmentId, content }: { assignmentId: string; content: string }) => {
      await api.post(`/assignments/${assignmentId}/submit`, { content, fileUrl: uploadedFileUrl })
    },
    onSuccess: () => {
      setSubmitting(null)
      setSubmitContent('')
      setUploadedFileUrl(null)
      void queryClient.invalidateQueries({ queryKey: ['student-assignments'] })
    },
  })

  const pending = assignments.filter((a) => a.submissionStatus === 'pending' || a.submissionStatus === 'overdue')
  const submitted = assignments.filter((a) => a.submissionStatus === 'submitted' || a.submissionStatus === 'late')
  const graded = assignments.filter((a) => a.submissionStatus === 'graded')

  const stats = {
    pending: pending.length,
    overdue: assignments.filter((a) => a.submissionStatus === 'overdue').length,
    submitted: submitted.length + graded.length,
  }

  const pendingColumns: ColumnsType<AssignmentRow> = [
    {
      title: 'Assignment',
      key: 'title',
      render: (_, r) => (
        <div>
          <Text strong>{r.title}</Text>
          <div style={{ fontSize: 12, color: '#888' }}>{r.course.code} — {r.course.name}</div>
          {r.description && <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }} ellipsis={{ rows: 2 }}>{r.description}</Paragraph>}
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
      title: 'Due',
      dataIndex: 'dueDate',
      key: 'due',
      render: (d: string | null, r) => {
        if (!d) return '—'
        const isOver = new Date(d) < new Date()
        return (
          <div>
            <span style={{ color: isOver ? '#f5222d' : undefined }}>{dayjs(d).format('DD/MM/YYYY')}</span>
            <div style={{ fontSize: 11, color: isOver ? '#f5222d' : '#888' }}>
              {isOver ? <><AlertTriangle size={10} /> {dayjs(d).fromNow()}</> : <><Clock size={10} /> {dayjs(d).fromNow()}</>}
            </div>
          </div>
        )
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        const s = STATUS_MAP[r.submissionStatus] ?? { color: 'default', label: r.submissionStatus }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'Submit',
      key: 'submit',
      render: (_, r) => (
        canSubmitOnline ? (
          <Button
            size="small"
            type="primary"
            icon={<Send size={12} />}
            onClick={() => { setSubmitting(r); setSubmitContent('') }}
          >
            Submit
          </Button>
        ) : (
          <Tooltip title="Please submit to your teacher in class. Online submission is for Year 9 and above.">
            <Tag color="default">In-Class Only</Tag>
          </Tooltip>
        )
      ),
    },
  ]

  const gradedColumns: ColumnsType<AssignmentRow> = [
    {
      title: 'Assignment',
      key: 'title',
      render: (_, r) => (
        <div>
          <Text strong>{r.title}</Text>
          <div style={{ fontSize: 12, color: '#888' }}>{r.course.name}</div>
        </div>
      ),
    },
    {
      title: 'Score',
      key: 'score',
      render: (_, r) => r.submission?.score !== null && r.submission?.score !== undefined ? (
        <Tag color={r.submission.score / r.maxScore >= 0.7 ? 'green' : 'orange'}>
          {r.submission.score} / {r.maxScore}
        </Tag>
      ) : '—',
    },
    {
      title: 'Feedback',
      key: 'feedback',
      render: (_, r) => r.submission?.feedback
        ? <Text italic style={{ fontSize: 12 }}>"{r.submission.feedback}"</Text>
        : <Text type="secondary">No feedback</Text>,
    },
    {
      title: 'Submitted',
      key: 'submitted',
      render: (_, r) => r.submission ? dayjs(r.submission.submittedAt).format('DD/MM/YYYY') : '—',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <Space>
          <BookOpen size={22} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>Assignments</Title>
          {gradeLevel && <Tag>{gradeLevel}</Tag>}
        </Space>
      </Card>

      {!canSubmitOnline && (
        <Alert
          type="info"
          showIcon
          message="Online submission is available for Year 9 and above."
          description="You can view your assignments here. Please submit completed work directly to your teacher in class."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Pending" value={stats.pending} styles={{ content: { color: stats.pending > 0 ? '#fa8c16' : undefined } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Overdue" value={stats.overdue} styles={{ content: { color: stats.overdue > 0 ? '#f5222d' : '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Submitted / Graded" value={stats.submitted} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          items={[
            {
              key: 'pending',
              label: (
                <span>
                  Pending
                  {stats.pending > 0 && <Tag color={stats.overdue > 0 ? 'red' : 'orange'} style={{ marginLeft: 6 }}>{stats.pending}</Tag>}
                </span>
              ),
              children: (
                <Table
                  columns={pendingColumns}
                  dataSource={pending}
                  rowKey="id"
                  loading={isLoading}
                  size="middle"
                  locale={{ emptyText: <Space><CheckCircle size={16} color="#52c41a" /> All caught up!</Space> }}
                  pagination={false}
                />
              ),
            },
            {
              key: 'submitted',
              label: `Submitted (${submitted.length})`,
              children: (
                <Table
                  columns={pendingColumns.slice(0, 4)}
                  dataSource={submitted}
                  rowKey="id"
                  size="middle"
                  pagination={false}
                />
              ),
            },
            {
              key: 'graded',
              label: `Graded (${graded.length})`,
              children: (
                <Table
                  columns={gradedColumns}
                  dataSource={graded}
                  rowKey="id"
                  size="middle"
                  pagination={false}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Submit Modal */}
      <Modal
        title={<Space><Send size={16} /> Submit Assignment — {submitting?.title}</Space>}
        open={!!submitting}
        onCancel={() => { setSubmitting(null); setSubmitContent('') }}
        onOk={() => submitting && submitMutation.mutate({ assignmentId: submitting.id, content: submitContent })}
        confirmLoading={submitMutation.isPending}
        okText="Submit"
        width={560}
      >
        {submitting && (
          <div>
            <div style={{ background: '#f6f8ff', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text strong>{submitting.title}</Text>
              <div style={{ color: '#888', fontSize: 12 }}>{submitting.course.name}</div>
              {submitting.description && <Paragraph style={{ marginBottom: 0, marginTop: 8, fontSize: 13 }}>{submitting.description}</Paragraph>}
            </div>
            {submitting.dueDate && new Date(submitting.dueDate) < new Date() && (
              <Alert type="warning" showIcon message="This assignment is past due. Your submission will be marked as late." style={{ marginBottom: 12 }} />
            )}
            <Input.TextArea
              rows={5}
              placeholder="Type your answer or response here..."
              value={submitContent}
              onChange={(e) => setSubmitContent(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Optional: attach a file (image, PDF, document)</div>
            <FileUploader
              entityType="assignment_submission"
              entityId={submitting.id}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              label="Attach File"
              onUploaded={(file) => setUploadedFileUrl(file.downloadUrl)}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default StudentAssignmentsPage
