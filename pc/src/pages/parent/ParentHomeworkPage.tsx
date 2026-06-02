import { useState } from 'react'
import { Card, Table, Tag, Typography, Space, Alert, Statistic, Row, Col, Select, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, AlertTriangle, CheckCircle } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import api from '@/lib/api'

const { Title, Text } = Typography

interface HomeworkRow {
  assignmentId: string
  title: string
  type: string
  dueDate: string | null
  course: { name: string; code: string }
  studentId: string
  studentName: string
  submitted: boolean
  isLate: boolean
  score: number | null
  status: string // 'pending' | 'submitted' | 'late' | 'graded' | 'overdue'
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: 'Pending' },
  overdue: { color: 'red', label: 'Overdue' },
  submitted: { color: 'blue', label: 'Submitted' },
  late: { color: 'orange', label: 'Submitted (Late)' },
  graded: { color: 'green', label: 'Graded' },
}

const ParentHomeworkPage = () => {
  const { t } = useTranslation()
  const [childFilter, setChildFilter] = useState<string>('')

  const { data: homework = [], isLoading } = useQuery({
    queryKey: ['parent-homework'],
    queryFn: async () => {
      const { data } = await api.get('/parent/homework')
      return data.data as HomeworkRow[]
    },
  })

  const children = [...new Map(homework.map((h) => [h.studentId, h.studentName])).entries()]
    .map(([id, name]) => ({ id, name }))

  const filtered = childFilter ? homework.filter((h) => h.studentId === childFilter) : homework
  const overdue = filtered.filter((h) => h.status === 'overdue')
  const pending = filtered.filter((h) => h.status === 'pending')

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  const columns: ColumnsType<HomeworkRow> = [
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'student',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Assignment',
      key: 'title',
      render: (_, r) => (
        <div>
          <Text>{r.title}</Text>
          <div style={{ fontSize: 12, color: '#888' }}>{r.course.code} — {r.course.name}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'due',
      render: (d: string | null) => {
        if (!d) return '—'
        const isOver = new Date(d) < new Date()
        return <span style={{ color: isOver ? '#f5222d' : undefined }}>{dayjs(d).format('DD/MM/YYYY')}</span>
      },
      sorter: (a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        const s = STATUS_MAP[r.status] ?? { color: 'default', label: r.status }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'Score',
      key: 'score',
      render: (_, r) => r.score !== null ? <Tag color="green">{r.score}</Tag> : '—',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <BookOpen size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Homework Tracker</Title>
          </Space>
          {children.length > 1 && (
            <Select
              placeholder="All children"
              allowClear
              value={childFilter || undefined}
              onChange={(v) => setChildFilter(v ?? '')}
              options={children.map((c) => ({ value: c.id, label: c.name }))}
              style={{ width: 200 }}
            />
          )}
        </div>
      </Card>

      {overdue.length > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<AlertTriangle size={16} />}
          message={`${overdue.length} assignment(s) overdue`}
          description="Please remind your child to speak to their teacher about missed assignments."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Overdue"
              value={overdue.length}
              styles={{ content: { color: overdue.length > 0 ? '#f5222d' : undefined } }}
              prefix={overdue.length > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} color="#52c41a" />}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Pending" value={pending.length} styles={{ content: { color: pending.length > 0 ? '#fa8c16' : undefined } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Submitted / Graded"
              value={filtered.filter((h) => h.submitted).length}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey={(r) => `${r.assignmentId}-${r.studentId}`}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'No homework assignments found.' }}
        />
      </Card>
    </div>
  )
}

export default ParentHomeworkPage
