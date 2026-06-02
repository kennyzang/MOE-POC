import { useState } from 'react'
import {
  Card, Table, Tag, Space, Typography, Button, Modal, Form, Input, Select,
  DatePicker, Statistic, Row, Col, message, Alert, Steps, Tabs,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Users, CheckCircle, Clock, School } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import api from '@/lib/api'
import { useSchoolConfig } from '@/hooks/useSchoolConfig'

const { Title, Text } = Typography

interface Transition {
  id: string
  studentId: string
  transitionType: string
  fromGradeLevel: string | null
  toGradeLevel: string | null
  fromClassName: string | null
  academicYear: string
  effectiveDate: string
  status: string
  notes: string | null
  student: { user: { displayName: string } }
  fromSchool: { name: string; code: string; authority: string } | null
  toSchool: { name: string; code: string; authority: string }
}

interface EligibleStudent {
  studentId: string
  studentName: string
  currentGradeLevel: string | null
  currentClassName: string | null
  schoolId: string
  schoolName: string
  schoolType: string
  authority: string
  hasExistingPlan: boolean
}

interface AllSchool {
  id: string
  name: string
  code: string
  authority: string
  schoolType: string
  gradeLevels: string[]
}

const STATUS_COLOR: Record<string, string> = {
  planned: 'orange', approved: 'blue', completed: 'green', cancelled: 'default',
}

const TYPE_LABEL: Record<string, string> = {
  GRADE_PROMOTION: 'Grade Promotion',
  PRIMARY_TO_SECONDARY: 'Primary → Secondary',
  SCHOOL_TRANSFER: 'School Transfer',
  GRADUATION: 'Graduation',
}

const TransitionsPage = () => {
  const queryClient = useQueryClient()
  const schoolConfig = useSchoolConfig()
  const [createOpen, setCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [form] = Form.useForm()

  const { data: transitions = [], isLoading } = useQuery({
    queryKey: ['transitions', statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      const { data } = await api.get(`/transitions?${params}`)
      return data.data as Transition[]
    },
  })

  const { data: eligible = [] } = useQuery({
    queryKey: ['transitions-eligible'],
    queryFn: async () => {
      const { data } = await api.get('/transitions/eligible')
      return data.data as EligibleStudent[]
    },
  })

  const { data: allSchools = [] } = useQuery({
    queryKey: ['all-schools'],
    queryFn: async () => {
      const { data } = await api.get('/schools')
      return data.data as AllSchool[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = {
        ...values,
        effectiveDate: values.effectiveDate ? (values.effectiveDate as dayjs.Dayjs).toISOString() : undefined,
      }
      await api.post('/transitions', payload)
    },
    onSuccess: () => {
      message.success('Transition plan created')
      setCreateOpen(false)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['transitions'] })
      void queryClient.invalidateQueries({ queryKey: ['transitions-eligible'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/transitions/${id}`, { status })
    },
    onSuccess: () => {
      message.success('Status updated')
      void queryClient.invalidateQueries({ queryKey: ['transitions'] })
    },
  })

  const stats = {
    planned: transitions.filter((t) => t.status === 'planned').length,
    approved: transitions.filter((t) => t.status === 'approved').length,
    completed: transitions.filter((t) => t.status === 'completed').length,
    eligibleCount: eligible.filter((e) => !e.hasExistingPlan).length,
  }

  const columns: ColumnsType<Transition> = [
    {
      title: 'Student',
      key: 'student',
      render: (_, r) => <Text strong>{r.student.user.displayName}</Text>,
    },
    {
      title: 'Transition',
      key: 'type',
      render: (_, r) => (
        <div>
          <Tag color="blue">{TYPE_LABEL[r.transitionType] ?? r.transitionType}</Tag>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {r.fromSchool && r.fromSchool.code !== r.toSchool.code
              ? `${r.fromSchool.code} → ${r.toSchool.code}`
              : `${r.fromGradeLevel ?? '?'} → ${r.toGradeLevel ?? '?'}`}
          </div>
        </div>
      ),
    },
    {
      title: 'Route',
      key: 'route',
      render: (_, r) => (
        <Space size={4}>
          <span style={{ fontSize: 12 }}>{r.fromGradeLevel ?? '—'} {r.fromClassName ? `(${r.fromClassName})` : ''}</span>
          <ArrowRight size={12} />
          <span style={{ fontSize: 12 }}>{r.toGradeLevel ?? '—'}</span>
        </Space>
      ),
    },
    {
      title: 'Effective',
      dataIndex: 'effectiveDate',
      key: 'date',
      render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
    },
    {
      title: 'Academic Year',
      dataIndex: 'academicYear',
      key: 'year',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'planned' && (
            <Button size="small" type="primary" onClick={() => updateMutation.mutate({ id: r.id, status: 'approved' })}>
              Approve
            </Button>
          )}
          {r.status === 'approved' && (
            <Button size="small" style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
              onClick={() => {
                Modal.confirm({
                  title: 'Complete Transition?',
                  content: 'This will update the student\'s school and grade level records.',
                  onOk: () => updateMutation.mutate({ id: r.id, status: 'completed' }),
                })
              }}>
              Complete
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ArrowRight size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Education Transitions</Title>
          </Space>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Plan New Transition
          </Button>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Eligible (no plan)" value={stats.eligibleCount}
              prefix={<Users size={14} />}
              styles={{ content: { color: stats.eligibleCount > 0 ? '#fa8c16' : undefined } }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Planned" value={stats.planned} prefix={<Clock size={14} />}
              styles={{ content: { color: '#fa8c16' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Approved" value={stats.approved}
              styles={{ content: { color: '#165DFF' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Completed" value={stats.completed} prefix={<CheckCircle size={14} />}
              styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          items={[
            {
              key: 'transitions',
              label: `All Transitions (${transitions.length})`,
              children: (
                <div>
                  <Space style={{ marginBottom: 12 }}>
                    <Select placeholder="All statuses" allowClear style={{ width: 140 }} value={statusFilter || undefined}
                      onChange={(v) => setStatusFilter(v ?? '')}
                      options={[
                        { value: 'planned', label: 'Planned' },
                        { value: 'approved', label: 'Approved' },
                        { value: 'completed', label: 'Completed' },
                        { value: 'cancelled', label: 'Cancelled' },
                      ]} />
                    <Select placeholder="All types" allowClear style={{ width: 200 }} value={typeFilter || undefined}
                      onChange={(v) => setTypeFilter(v ?? '')}
                      options={Object.entries(TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
                  </Space>
                  <Table columns={columns} dataSource={transitions} rowKey="id" loading={isLoading}
                    pagination={{ pageSize: 15 }} size="middle"
                    locale={{ emptyText: 'No transitions found.' }} />
                </div>
              ),
            },
            {
              key: 'eligible',
              label: (
                <span>
                  Eligible Students
                  {stats.eligibleCount > 0 && <Tag color="orange" style={{ marginLeft: 6 }}>{stats.eligibleCount}</Tag>}
                </span>
              ),
              children: (
                <div>
                  {eligible.length === 0 ? (
                    <Alert type="success" showIcon message="No students are currently in their final grade without a transition plan." />
                  ) : (
                    <Table
                      dataSource={eligible}
                      rowKey="studentId"
                      size="middle"
                      pagination={{ pageSize: 20 }}
                      columns={[
                        { title: 'Student', dataIndex: 'studentName', key: 'name', render: (n: string) => <Text strong>{n}</Text> },
                        {
                          title: 'Current', key: 'current',
                          render: (_, r: EligibleStudent) => <span>{r.currentGradeLevel} {r.currentClassName && `(${r.currentClassName})`}</span>,
                        },
                        { title: 'School', dataIndex: 'schoolName', key: 'school', render: (n: string, r: EligibleStudent) => <Space><School size={12} /><span>{n}</span><Tag>{r.authority}</Tag></Space> },
                        {
                          title: 'Plan Status', key: 'plan',
                          render: (_, r: EligibleStudent) => r.hasExistingPlan
                            ? <Tag color="green">Plan exists</Tag>
                            : <Tag color="orange">Needs planning</Tag>,
                        },
                        {
                          title: 'Action', key: 'action',
                          render: (_, r: EligibleStudent) => !r.hasExistingPlan && (
                            <Button size="small" type="primary" onClick={() => {
                              form.setFieldValue('studentId', r.studentId)
                              form.setFieldValue('fromSchoolId', r.schoolId)
                              form.setFieldValue('fromGradeLevel', r.currentGradeLevel)
                              form.setFieldValue('fromClassName', r.currentClassName)
                              setCreateOpen(true)
                            }}>
                              Plan Transition
                            </Button>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create Transition Modal */}
      <Modal
        title="Plan New Transition"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.validateFields().then((v) => createMutation.mutate(v))}
        confirmLoading={createMutation.isPending}
        okText="Create Plan"
        width={560}
      >
        <Alert
          type="info"
          showIcon
          message="Transition planning stages: Plan → Approve → Complete"
          description="'Complete' moves the student to the target school and grade level."
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item name="transitionType" label="Transition Type" rules={[{ required: true }]} initialValue="PRIMARY_TO_SECONDARY">
            <Select options={Object.entries(TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="studentId" label="Student ID" rules={[{ required: true }]}>
            <Input placeholder="Student ID (from Eligible list above)" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="fromSchoolId" label="From School">
                <Select options={allSchools.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))} placeholder="Current school" allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="toSchoolId" label="To School" rules={[{ required: true }]}>
                <Select options={allSchools.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))} placeholder="Target school" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="fromGradeLevel" label="From Grade">
                <Input placeholder="e.g. Year 6" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="toGradeLevel" label="To Grade">
                <Input placeholder="e.g. Year 7" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="academicYear" label="Academic Year" rules={[{ required: true }]} initialValue="2026/2027">
                <Input placeholder="2026/2027" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="effectiveDate" label="Effective Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Additional notes..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TransitionsPage
