import { useState } from 'react'
import {
  Card, Table, Tag, Space, Typography, Statistic, Row, Col, Button, Modal, Form,
  Input, Select, message, Timeline, Tabs, Alert,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, ShieldAlert, AlertTriangle, Plus } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import api from '@/lib/api'
import { useSchoolConfig } from '@/hooks/useSchoolConfig'

const { Title, Text } = Typography

interface BehaviorRecord {
  id: string
  type: string
  category: string
  points: number
  description: string
  actionTaken: string | null
  severity: string | null
  parentNotified: boolean
  date: string
  student: { id: string; user: { displayName: string }; gradeLevel: string | null; className: string | null }
  recordedBy: { displayName: string; role: string }
}

interface Summary {
  totalMerits: number
  totalDemerits: number
  netPoints: number
  incidents: number
  thisMonthCount: number
}

const BehaviorPage = () => {
  const queryClient = useQueryClient()
  const { gradeLevels } = useSchoolConfig()
  const [logOpen, setLogOpen] = useState(false)
  const [form] = Form.useForm()
  const [gradeFilter, setGradeFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const { data: summary } = useQuery({
    queryKey: ['behavior-summary'],
    queryFn: async () => {
      const { data } = await api.get('/behavior/summary')
      return data.data as Summary
    },
  })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['behavior-records', gradeFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (gradeFilter) params.set('gradeLevel', gradeFilter)
      if (typeFilter) params.set('type', typeFilter)
      const { data } = await api.get(`/behavior?${params}`)
      return data.data as BehaviorRecord[]
    },
  })

  const { data: students = [] } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const { data } = await api.get('/students?limit=500')
      return data.data as Array<{ id: string; user: { displayName: string }; gradeLevel: string | null; className: string | null }>
    },
  })

  const logMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      await api.post('/behavior', values)
    },
    onSuccess: () => {
      message.success('Behavior record logged')
      setLogOpen(false)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['behavior-records'] })
      void queryClient.invalidateQueries({ queryKey: ['behavior-summary'] })
    },
  })

  const columns: ColumnsType<BehaviorRecord> = [
    {
      title: 'Student',
      key: 'student',
      render: (_, r) => (
        <div>
          <Text strong>{r.student?.user?.displayName ?? '—'}</Text>
          <div style={{ fontSize: 12, color: '#888' }}>{r.student?.gradeLevel} {r.student?.className}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => (
        <Tag color={t === 'merit' ? 'green' : t === 'demerit' ? 'red' : 'default'}>
          {t === 'merit' ? '🏅' : t === 'demerit' ? '⚠️' : '📋'} {t.charAt(0).toUpperCase() + t.slice(1)}
        </Tag>
      ),
    },
    { title: 'Category', dataIndex: 'category', key: 'cat', render: (c: string) => <Tag>{c}</Tag> },
    {
      title: 'Points',
      dataIndex: 'points',
      key: 'pts',
      render: (p: number) => (
        <Tag color={p > 0 ? 'green' : p < 0 ? 'red' : 'default'}>{p > 0 ? `+${p}` : p}</Tag>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'desc',
      render: (d: string) => <Text ellipsis style={{ maxWidth: 200 }}>{d}</Text>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (s: string | null) => s ? <Tag color={s === 'major' ? 'red' : s === 'moderate' ? 'orange' : 'default'}>{s}</Tag> : '—',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
    },
    {
      title: 'Recorded By',
      key: 'by',
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.recordedBy?.displayName}</Text>,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ShieldAlert size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Behavior & Discipline</Title>
          </Space>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setLogOpen(true)}>
            Log Behavior
          </Button>
        </div>
      </Card>

      {summary && (
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={5}>
            <Card size="small">
              <Statistic title="Total Merits" value={summary.totalMerits} styles={{ content: { color: '#52c41a' } }} prefix={<Award size={16} />} />
            </Card>
          </Col>
          <Col xs={12} sm={5}>
            <Card size="small">
              <Statistic title="Total Demerits" value={summary.totalDemerits} styles={{ content: { color: '#f5222d' } }} prefix={<AlertTriangle size={16} />} />
            </Card>
          </Col>
          <Col xs={12} sm={5}>
            <Card size="small">
              <Statistic
                title="Net Points"
                value={summary.netPoints}
                styles={{ content: { color: summary.netPoints >= 0 ? '#52c41a' : '#f5222d' } }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card size="small">
              <Statistic title="Incidents" value={summary.incidents} />
            </Card>
          </Col>
          <Col xs={12} sm={5}>
            <Card size="small">
              <Statistic title="This Month" value={summary.thisMonthCount} />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card size="small">
        <Space>
          <Select
            placeholder="All grades"
            allowClear
            value={gradeFilter || undefined}
            onChange={(v) => setGradeFilter(v ?? '')}
            options={gradeLevels.map((g) => ({ value: g, label: g }))}
            style={{ width: 140 }}
          />
          <Select
            placeholder="All types"
            allowClear
            value={typeFilter || undefined}
            onChange={(v) => setTypeFilter(v ?? '')}
            options={[
              { value: 'merit', label: '🏅 Merits' },
              { value: 'demerit', label: '⚠️ Demerits' },
              { value: 'incident', label: '📋 Incidents' },
            ]}
            style={{ width: 150 }}
          />
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: 'No behavior records found.' }}
          size="middle"
        />
      </Card>

      {/* Log Behavior Modal */}
      <Modal
        title={<Space><ShieldAlert size={16} /> Log Behavior Record</Space>}
        open={logOpen}
        onCancel={() => { setLogOpen(false); form.resetFields() }}
        onOk={() => form.validateFields().then((v) => logMutation.mutate(v))}
        confirmLoading={logMutation.isPending}
        okText="Submit"
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="studentId" label="Student" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Search student..."
              filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
              options={students.map((s) => ({
                value: s.id,
                label: `${s.user?.displayName ?? '?'} (${s.gradeLevel ?? ''} ${s.className ?? ''})`,
              }))}
            />
          </Form.Item>
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
                  { value: 'moderate', label: 'Moderate (parent notified)' },
                  { value: 'major', label: 'Major (parent notified)' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Describe the behavior or achievement..." />
          </Form.Item>
          <Form.Item name="actionTaken" label="Action Taken">
            <Input placeholder="Verbal warning, parent call, detention..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default BehaviorPage
