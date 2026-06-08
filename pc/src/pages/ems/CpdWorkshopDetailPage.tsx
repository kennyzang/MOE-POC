import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Typography, Space, Button, Tag, Progress, Tabs, Table,
  Form, Input, Select, DatePicker, TimePicker, Modal, Descriptions, Badge,
  message, Spin, Empty, Popconfirm, Upload, Segmented,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  ArrowLeft, Award, BookOpen, Calendar, Clock, ExternalLink, FileText,
  Link2, Loader2, MapPin, Plus, Trash2, User, Users, Video, UserCheck,
  Paperclip, Send,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text, Paragraph } = Typography

const CATEGORY_COLORS: Record<string, string> = {
  Pedagogy: '#165DFF',
  'Subject Knowledge': '#36CFC9',
  'Educational Technology': '#722ED1',
  Leadership: '#FA8C16',
  'Special Education': '#52C41A',
  General: '#8C8C8C',
}

const RESOURCE_TYPE_OPTIONS = [
  { label: 'Document', value: 'document' },
  { label: 'Slides', value: 'slides' },
  { label: 'Link', value: 'link' },
  { label: 'Video', value: 'video' },
  { label: 'PDF', value: 'pdf' },
]

function resourceIcon(type: string) {
  if (type === 'video') return <Video size={14} />
  if (type === 'link') return <Link2 size={14} />
  return <FileText size={14} />
}

interface CpdSession {
  id: string
  title: string
  sessionDate: string
  startTime: string
  endTime: string
  room: string | null
  status: string
}

interface CpdResource {
  id: string
  title: string
  type: string
  url: string
  createdAt: string
}

interface Enrollee {
  teacherId: string
  displayName: string
  department: string | null
  enrolledAt: string
  status: string
  hoursAwarded: number | null
}

interface WorkshopDetail {
  id: string
  title: string
  provider: string | null
  subject: string | null
  description: string | null
  objectives: string | null
  targetAudience: string | null
  prerequisites: string | null
  facilitatorId: string | null
  facilitatorName: string | null
  facilitatorDepartment: string | null
  imageUrl: string | null
  hours: number
  startDate: string
  endDate: string
  location: string | null
  maxParticipants: number
  category: string
  status: string
  enrolledCount: number
  alreadyEnrolled: boolean
  sessions: CpdSession[]
  resources: CpdResource[]
  enrollees: Enrollee[]
}

const STATUS_BADGE: Record<string, 'success' | 'error' | 'processing' | 'default' | 'warning'> = {
  ENROLLED: 'processing',
  COMPLETED: 'success',
  WITHDRAWN: 'default',
}

const CpdWorkshopDetailPage = () => {
  const { workshopId } = useParams<{ workshopId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [sessionForm] = Form.useForm()
  const [resourceForm] = Form.useForm()
  const [editSessionId, setEditSessionId] = useState<string | null>(null)
  const [addSessionOpen, setAddSessionOpen] = useState(false)
  const [addResourceOpen, setAddResourceOpen] = useState(false)
  const [resourceMode, setResourceMode] = useState<'url' | 'file'>('url')
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([])

  const canManage = ['admin', 'manager', 'hod'].includes(user?.role ?? '')
  const canSeeEnrollees = ['admin', 'manager', 'hod', 'principal'].includes(user?.role ?? '')
  const isTeacher = user?.role === 'teacher'

  const { data: workshop, isLoading } = useQuery<WorkshopDetail>({
    queryKey: ['cpd-workshop', workshopId],
    queryFn: async () => {
      const { data } = await api.get(`/ems/cpd-workshops/${workshopId}`)
      return data.data as WorkshopDetail
    },
    enabled: !!workshopId,
  })

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/ems/cpd-workshops/${workshopId}/enroll`, {})
      return data
    },
    onSuccess: (res) => {
      message.success(res.message ?? 'Enrolled successfully!')
      queryClient.invalidateQueries({ queryKey: ['cpd-workshop', workshopId] })
      queryClient.invalidateQueries({ queryKey: ['cpd-workshops'] })
      queryClient.invalidateQueries({ queryKey: ['cpd-summary'] })
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Enrollment failed.'),
  })

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/ems/cpd-workshops/${workshopId}/withdraw`)
      return data
    },
    onSuccess: (res) => {
      message.success(res.message ?? 'Withdrawn successfully.')
      queryClient.invalidateQueries({ queryKey: ['cpd-workshop', workshopId] })
      queryClient.invalidateQueries({ queryKey: ['cpd-workshops'] })
      queryClient.invalidateQueries({ queryKey: ['cpd-summary'] })
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Withdrawal failed.'),
  })

  const completeMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      const { data } = await api.post(`/ems/cpd-workshops/${workshopId}/complete`, { teacherId })
      return data
    },
    onSuccess: () => {
      message.success('Marked as completed. Full CPD hours awarded.')
      queryClient.invalidateQueries({ queryKey: ['cpd-workshop', workshopId] })
      queryClient.invalidateQueries({ queryKey: ['cpd-summary'] })
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Completion failed.'),
  })

  const addSessionMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const payload = {
        title: values.title,
        sessionDate: (values.sessionDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        startTime: (values.startTime as dayjs.Dayjs).format('HH:mm'),
        endTime: (values.endTime as dayjs.Dayjs).format('HH:mm'),
        room: values.room || null,
      }
      if (editSessionId) {
        const { data } = await api.patch(`/ems/cpd-workshops/${workshopId}/sessions/${editSessionId}`, payload)
        return data
      }
      const { data } = await api.post(`/ems/cpd-workshops/${workshopId}/sessions`, payload)
      return data
    },
    onSuccess: () => {
      message.success(editSessionId ? 'Session updated.' : 'Session added.')
      setAddSessionOpen(false)
      setEditSessionId(null)
      sessionForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['cpd-workshop', workshopId] })
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Failed to save session.'),
  })

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/ems/cpd-workshops/${workshopId}/sessions/${sessionId}`)
    },
    onSuccess: () => {
      message.success('Session deleted.')
      queryClient.invalidateQueries({ queryKey: ['cpd-workshop', workshopId] })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/ems/cpd-workshops/${workshopId}`, { status: 'open' })
      return data
    },
    onSuccess: () => {
      message.success('Workshop published — teachers can now see and enroll.')
      queryClient.invalidateQueries({ queryKey: ['cpd-workshop', workshopId] })
      queryClient.invalidateQueries({ queryKey: ['cpd-workshops'] })
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Publish failed.'),
  })

  const addResourceMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (resourceMode === 'file') {
        const file = uploadFileList[0]?.originFileObj
        if (!file) throw new Error('No file selected')
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', values.title || file.name)
        formData.append('type', values.type ?? 'document')
        const { data } = await api.post(`/ems/cpd-workshops/${workshopId}/resources/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return data
      }
      const { data } = await api.post(`/ems/cpd-workshops/${workshopId}/resources`, values)
      return data
    },
    onSuccess: () => {
      message.success('Resource added.')
      setAddResourceOpen(false)
      resourceForm.resetFields()
      setUploadFileList([])
      setResourceMode('url')
      queryClient.invalidateQueries({ queryKey: ['cpd-workshop', workshopId] })
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Failed to add resource.'),
  })

  const deleteResourceMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      await api.delete(`/ems/cpd-workshops/${workshopId}/resources/${resourceId}`)
    },
    onSuccess: () => {
      message.success('Resource deleted.')
      queryClient.invalidateQueries({ queryKey: ['cpd-workshop', workshopId] })
    },
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin indicator={<Loader2 size={32} className="spin-icon" />} />
      </div>
    )
  }

  if (!workshop) {
    return (
      <Card>
        <Empty description="Workshop not found." />
      </Card>
    )
  }

  const isSameDay = dayjs(workshop.startDate).isSame(dayjs(workshop.endDate), 'day')
  const dateDisplay = isSameDay
    ? dayjs(workshop.startDate).format('D MMM YYYY')
    : `${dayjs(workshop.startDate).format('D MMM')} – ${dayjs(workshop.endDate).format('D MMM YYYY')}`

  const enrollPercent = Math.round((workshop.enrolledCount / workshop.maxParticipants) * 100)
  const isFull = workshop.enrolledCount >= workshop.maxParticipants

  const categoryColor = CATEGORY_COLORS[workshop.category] ?? '#8C8C8C'

  // ─── Overview Tab ────────────────────────────────────────────────
  const overviewTab = (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      {workshop.imageUrl && (
        <img
          src={workshop.imageUrl}
          alt={workshop.title}
          style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 8 }}
        />
      )}
      {workshop.description ? (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>About this Workshop</Text>
          <Paragraph style={{ color: '#3d3d3d', marginBottom: 0 }}>{workshop.description}</Paragraph>
        </div>
      ) : (
        <Text type="secondary">No description provided.</Text>
      )}

      {workshop.objectives && (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>Learning Objectives</Text>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {workshop.objectives.split('\n').filter(Boolean).map((obj, i) => (
              <li key={i} style={{ color: '#3d3d3d', marginBottom: 4 }}>{obj}</li>
            ))}
          </ul>
        </div>
      )}

      {(workshop.targetAudience || workshop.prerequisites) && (
        <Row gutter={24}>
          {workshop.targetAudience && (
            <Col xs={24} md={12}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Target Audience</Text>
              <Paragraph style={{ color: '#3d3d3d', marginBottom: 0 }}>{workshop.targetAudience}</Paragraph>
            </Col>
          )}
          {workshop.prerequisites && (
            <Col xs={24} md={12}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Prerequisites</Text>
              <Paragraph style={{ color: '#3d3d3d', marginBottom: 0 }}>{workshop.prerequisites}</Paragraph>
            </Col>
          )}
        </Row>
      )}
    </Space>
  )

  // ─── Sessions Tab ────────────────────────────────────────────────
  const sessionsTab = (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            size="small"
            onClick={() => { setEditSessionId(null); sessionForm.resetFields(); setAddSessionOpen(true) }}
          >
            Add Session
          </Button>
        </div>
      )}

      {workshop.sessions.length === 0 ? (
        <Empty description="No sessions scheduled yet." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        workshop.sessions.map((s, idx) => (
          <Card
            key={s.id}
            size="small"
            style={{ borderLeft: '4px solid #165DFF' }}
            extra={canManage && (
              <Space size={4}>
                <Button
                  type="text"
                  size="small"
                  onClick={() => {
                    setEditSessionId(s.id)
                    sessionForm.setFieldsValue({
                      title: s.title,
                      sessionDate: dayjs(s.sessionDate),
                      startTime: dayjs(`2000-01-01 ${s.startTime}`),
                      endTime: dayjs(`2000-01-01 ${s.endTime}`),
                      room: s.room,
                    })
                    setAddSessionOpen(true)
                  }}
                >
                  Edit
                </Button>
                <Popconfirm
                  title="Delete this session?"
                  onConfirm={() => deleteSessionMutation.mutate(s.id)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="text" size="small" danger icon={<Trash2 size={12} />} />
                </Popconfirm>
              </Space>
            )}
          >
            <Space>
              <div
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#165DFF', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}
              >
                {idx + 1}
              </div>
              <div>
                <Text strong>{s.title}</Text>
                <div style={{ color: '#595959', fontSize: 13 }}>
                  <Space size={12}>
                    <span><Calendar size={12} style={{ marginRight: 4 }} />{dayjs(s.sessionDate).format('ddd, D MMM YYYY')}</span>
                    <span><Clock size={12} style={{ marginRight: 4 }} />{s.startTime} – {s.endTime}</span>
                    {s.room && <span><MapPin size={12} style={{ marginRight: 4 }} />{s.room}</span>}
                  </Space>
                </div>
              </div>
            </Space>
          </Card>
        ))
      )}
    </Space>
  )

  // ─── Resources Tab ───────────────────────────────────────────────
  const resourcesTab = (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            size="small"
            onClick={() => { resourceForm.resetFields(); setAddResourceOpen(true) }}
          >
            Add Resource
          </Button>
        </div>
      )}

      {workshop.resources.length === 0 ? (
        <Empty description="No resources uploaded yet." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        workshop.resources.map(r => (
          <Card key={r.id} size="small">
            <Row align="middle" justify="space-between">
              <Col>
                <Space>
                  {resourceIcon(r.type)}
                  <div>
                    <Text strong style={{ fontSize: 14 }}>{r.title}</Text>
                    <div>
                      <Tag style={{ fontSize: 11 }}>{r.type}</Tag>
                    </div>
                  </div>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button
                    type="link"
                    size="small"
                    icon={<ExternalLink size={12} />}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open
                  </Button>
                  {canManage && (
                    <Popconfirm
                      title="Remove this resource?"
                      onConfirm={() => deleteResourceMutation.mutate(r.id)}
                      okText="Remove"
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="text" size="small" danger icon={<Trash2 size={12} />} />
                    </Popconfirm>
                  )}
                </Space>
              </Col>
            </Row>
          </Card>
        ))
      )}
    </Space>
  )

  // ─── Enrollees Tab ───────────────────────────────────────────────
  const enrolleesTab = (
    <Table
      dataSource={workshop.enrollees}
      rowKey="teacherId"
      size="small"
      pagination={false}
      columns={[
        {
          title: 'Teacher',
          dataIndex: 'displayName',
          render: (name: string) => (
            <Space size={6}>
              <UserCheck size={14} />
              <Text>{name}</Text>
            </Space>
          ),
        },
        { title: 'Department', dataIndex: 'department', render: (d: string | null) => d ?? '—' },
        {
          title: 'Enrolled',
          dataIndex: 'enrolledAt',
          render: (d: string) => dayjs(d).format('D MMM YYYY'),
        },
        {
          title: 'Status',
          dataIndex: 'status',
          render: (s: string) => (
            <Badge status={STATUS_BADGE[s] ?? 'default'} text={s.charAt(0) + s.slice(1).toLowerCase()} />
          ),
        },
        {
          title: 'Hours',
          dataIndex: 'hoursAwarded',
          render: (h: number | null, row: Enrollee) =>
            row.status === 'COMPLETED' ? <Tag color="success">{h}h</Tag> : <Text type="secondary">—</Text>,
        },
        ...(canManage
          ? [{
              title: 'Actions',
              key: 'actions',
              render: (_: any, row: Enrollee) =>
                row.status === 'ENROLLED' ? (
                  <Popconfirm
                    title={`Mark ${row.displayName} as completed?`}
                    description={`This awards ${workshop.hours}h CPD and cannot be undone.`}
                    onConfirm={() => completeMutation.mutate(row.teacherId)}
                    okText="Confirm"
                  >
                    <Button size="small" type="primary" loading={completeMutation.isPending}>
                      Mark Complete
                    </Button>
                  </Popconfirm>
                ) : null,
            }]
          : []),
      ]}
    />
  )

  const tabItems = [
    { key: 'overview', label: 'Overview', children: overviewTab },
    {
      key: 'sessions',
      label: (
        <Space size={4}>
          <span>Sessions</span>
          {workshop.sessions.length > 0 && (
            <Tag style={{ marginLeft: 2, fontSize: 11 }}>{workshop.sessions.length}</Tag>
          )}
        </Space>
      ),
      children: sessionsTab,
    },
    {
      key: 'resources',
      label: (
        <Space size={4}>
          <span>Resources</span>
          {workshop.resources.length > 0 && (
            <Tag style={{ marginLeft: 2, fontSize: 11 }}>{workshop.resources.length}</Tag>
          )}
        </Space>
      ),
      children: resourcesTab,
    },
    ...(canSeeEnrollees
      ? [{
          key: 'enrollees',
          label: (
            <Space size={4}>
              <span>Enrollees</span>
              <Tag style={{ marginLeft: 2, fontSize: 11 }}>{workshop.enrolledCount}</Tag>
            </Space>
          ),
          children: enrolleesTab,
        }]
      : []),
  ]

  return (
    <div>
      {/* Back nav */}
      <Button
        type="text"
        icon={<ArrowLeft size={16} />}
        onClick={() => navigate('/ems/cpd-workshops')}
        style={{ marginBottom: 12, paddingLeft: 0 }}
      >
        CPD Workshops
      </Button>

      {/* Header card */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="top" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <Tag
                  style={{
                    background: `${categoryColor}20`,
                    color: categoryColor,
                    borderColor: `${categoryColor}40`,
                    fontWeight: 600,
                  }}
                >
                  {workshop.category}
                </Tag>
                <Tag color={workshop.status === 'open' ? 'success' : workshop.status === 'full' ? 'error' : 'default'}>
                  {workshop.status.toUpperCase()}
                </Tag>
              </Space>

              <Title level={3} style={{ margin: 0 }}>{workshop.title}</Title>

              {workshop.facilitatorName && (
                <Space size={6}>
                  <User size={14} style={{ color: '#8c8c8c' }} />
                  <Text type="secondary">
                    Facilitated by <Text strong>{workshop.facilitatorName}</Text>
                    {workshop.facilitatorDepartment && ` · ${workshop.facilitatorDepartment}`}
                  </Text>
                </Space>
              )}

              <Space wrap size={16} style={{ marginTop: 4 }}>
                <Space size={4}>
                  <Calendar size={14} />
                  <Text>{dateDisplay}</Text>
                </Space>
                <Space size={4}>
                  <Clock size={14} />
                  <Text>{workshop.hours}h CPD</Text>
                </Space>
                {workshop.location && (
                  <Space size={4}>
                    <MapPin size={14} />
                    <Text>{workshop.location}</Text>
                  </Space>
                )}
                {workshop.provider && (
                  <Space size={4}>
                    <BookOpen size={14} />
                    <Text type="secondary">{workshop.provider}</Text>
                  </Space>
                )}
              </Space>

              <div>
                <Row align="middle" gutter={8}>
                  <Col flex="auto">
                    <Progress
                      percent={enrollPercent}
                      size="small"
                      status={isFull ? 'exception' : 'active'}
                      showInfo={false}
                    />
                  </Col>
                  <Col>
                    <Text style={{ fontSize: 13 }}>
                      <Users size={12} style={{ marginRight: 4 }} />
                      {workshop.enrolledCount}/{workshop.maxParticipants} enrolled
                    </Text>
                  </Col>
                </Row>
              </div>
            </Space>
          </Col>

          {/* Admin publish action for draft workshops */}
          {canManage && workshop.status === 'draft' && (
            <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
              <Popconfirm
                title="Publish this workshop?"
                description="Teachers will be able to see and enroll in it."
                onConfirm={() => publishMutation.mutate()}
                okText="Publish"
              >
                <Button type="primary" icon={<Send size={14} />} loading={publishMutation.isPending}>
                  Publish Workshop
                </Button>
              </Popconfirm>
            </Col>
          )}

          {/* Enrol/Withdraw action */}
          {isTeacher && (
            <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
              {workshop.alreadyEnrolled ? (
                <Popconfirm
                  title="Withdraw from this workshop?"
                  description={`${(workshop.hours * 0.2).toFixed(1)}h pre-credit will be reversed.`}
                  onConfirm={() => withdrawMutation.mutate()}
                  okText="Withdraw"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger loading={withdrawMutation.isPending}>
                    Withdraw Enrolment
                  </Button>
                </Popconfirm>
              ) : (
                <Popconfirm
                  title={`Enrol in "${workshop.title}"?`}
                  description={`${(workshop.hours * 0.2).toFixed(1)}h CPD will be pre-credited immediately.`}
                  onConfirm={() => enrollMutation.mutate()}
                  okText="Enrol"
                  disabled={isFull}
                >
                  <Button type="primary" disabled={isFull} loading={enrollMutation.isPending}>
                    {isFull ? 'Workshop Full' : 'Enrol Now'}
                  </Button>
                </Popconfirm>
              )}
            </Col>
          )}
        </Row>
      </Card>

      {/* Tab content */}
      <Card>
        <Tabs items={tabItems} defaultActiveKey="overview" />
      </Card>

      {/* ─── Add/Edit Session Modal ─────────────────────────────── */}
      <Modal
        open={addSessionOpen}
        title={<Space><Calendar size={16} /><span>{editSessionId ? 'Edit Session' : 'Add Session'}</span></Space>}
        onCancel={() => { setAddSessionOpen(false); setEditSessionId(null); sessionForm.resetFields() }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={sessionForm}
          layout="vertical"
          onFinish={values => addSessionMutation.mutate(values)}
        >
          <Form.Item name="title" label="Session Title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Day 1: Foundations & Lab Work" />
          </Form.Item>
          <Form.Item name="sessionDate" label="Date" rules={[{ required: true, message: 'Required' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="startTime" label="Start Time" rules={[{ required: true, message: 'Required' }]}>
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="End Time" rules={[{ required: true, message: 'Required' }]}>
                <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="room" label="Room / Venue">
            <Input placeholder="e.g. Training Room A" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setAddSessionOpen(false); setEditSessionId(null); sessionForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={addSessionMutation.isPending}>
              {editSessionId ? 'Save Changes' : 'Add Session'}
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* ─── Add Resource Modal ──────────────────────────────────── */}
      <Modal
        open={addResourceOpen}
        title={<Space><FileText size={16} /><span>Add Resource</span></Space>}
        onCancel={() => { setAddResourceOpen(false); resourceForm.resetFields(); setUploadFileList([]); setResourceMode('url') }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={resourceForm}
          layout="vertical"
          onFinish={values => addResourceMutation.mutate(values)}
          initialValues={{ type: 'document' }}
        >
          <Form.Item name="title" label="Title">
            <Input placeholder="e.g. Workshop Slides — Day 1" />
          </Form.Item>
          <Form.Item name="type" label="Type">
            <Select options={RESOURCE_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="Source">
            <Segmented
              value={resourceMode}
              onChange={v => setResourceMode(v as 'url' | 'file')}
              options={[
                { label: <Space size={4}><Link2 size={13} />Link URL</Space>, value: 'url' },
                { label: <Space size={4}><Paperclip size={13} />Upload File</Space>, value: 'file' },
              ]}
              style={{ marginBottom: 8 }}
            />
            {resourceMode === 'url' ? (
              <Form.Item name="url" noStyle rules={[{ required: true, message: 'Required' }, { type: 'url', message: 'Must be a valid URL' }]}>
                <Input placeholder="https://..." />
              </Form.Item>
            ) : (
              <Upload
                fileList={uploadFileList}
                beforeUpload={() => false}
                onChange={({ fileList }) => setUploadFileList(fileList.slice(-1))}
                maxCount={1}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg"
              >
                <Button icon={<Paperclip size={14} />}>Select File</Button>
              </Upload>
            )}
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setAddResourceOpen(false); resourceForm.resetFields(); setUploadFileList([]); setResourceMode('url') }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={addResourceMutation.isPending}>
              Add Resource
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default CpdWorkshopDetailPage
