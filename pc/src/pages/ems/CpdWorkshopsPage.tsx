import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Typography, Space, Button, Tag, Progress, Alert,
  Modal, Form, Input, InputNumber, Select, DatePicker, AutoComplete,
  message, Spin, Badge, Tooltip,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Award, CheckCircle2, Clock, Users, Loader2, Plus, LogOut,
  PieChart, Send,
} from 'lucide-react'
import dayjs from 'dayjs'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Cell,
} from 'recharts'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography

const CATEGORY_OPTIONS = [
  { label: 'Pedagogy', value: 'Pedagogy' },
  { label: 'Subject Knowledge', value: 'Subject Knowledge' },
  { label: 'Educational Technology', value: 'Educational Technology' },
  { label: 'Leadership', value: 'Leadership' },
  { label: 'Special Education', value: 'Special Education' },
  { label: 'General', value: 'General' },
]

const CATEGORY_COLORS: Record<string, string> = {
  Pedagogy: '#165DFF',
  'Subject Knowledge': '#36CFC9',
  'Educational Technology': '#722ED1',
  Leadership: '#FA8C16',
  'Special Education': '#52C41A',
  General: '#8C8C8C',
}

interface CpdWorkshop {
  id: string
  title: string
  provider?: string
  subject?: string
  description?: string
  facilitatorName?: string
  hours: number
  startDate: string
  endDate: string
  location?: string
  maxParticipants: number
  status: string
  category: string
  enrolledCount: number
  alreadyEnrolled: boolean
}

interface EnrolledTeacher {
  teacherId: string
  displayName: string
  department: string
  enrolledAt: string
}

interface CpdTeacher {
  id: string
  staffId: string
  displayName: string
  department: string
  cpdHours: number
  cpdTarget: number
  cpdPercentage: number
  belowTarget: boolean
}

const CpdWorkshopsPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [createForm] = Form.useForm()

  const canEnrollOthers = ['admin', 'manager', 'hod', 'principal'].includes(user?.role ?? '')
  const canCreate = ['admin', 'manager', 'hod'].includes(user?.role ?? '')
  const isTeacher = user?.role === 'teacher'

  const { data: workshopOptions } = useQuery({
    queryKey: ['cpd-workshop-options'],
    queryFn: async () => {
      const { data } = await api.get('/ems/cpd-workshops/options')
      return data.data as { providers: string[]; subjects: string[]; locations: string[] }
    },
    enabled: canCreate,
    staleTime: 60000,
  })

  const { data: workshops = [], isLoading } = useQuery({
    queryKey: ['cpd-workshops'],
    queryFn: async () => {
      const { data } = await api.get('/ems/cpd-workshops')
      return data.data as CpdWorkshop[]
    },
    refetchInterval: 30000,
  })

  const { data: cpdSummary = [], isLoading: loadingCpd } = useQuery({
    queryKey: ['cpd-summary'],
    queryFn: async () => {
      const { data } = await api.get('/ems/cpd-summary')
      return data.data as CpdTeacher[]
    },
    // Load for admins/HODs AND for teacher (teacher sees own record only)
    enabled: canEnrollOthers || isTeacher,
  })

  // Own teacher record (for teacher's CPD overview)
  const ownTeacherRecord = isTeacher ? cpdSummary[0] : undefined

  // Per-category hours from enrolled workshops — use full workshop hours (not pre-credited fraction)
  const categoryHoursMap = workshops
    .filter(w => w.alreadyEnrolled)
    .reduce<Record<string, number>>((acc, w) => {
      const cat = w.category ?? 'General'
      acc[cat] = (acc[cat] ?? 0) + w.hours
      return acc
    }, {})

  // Build chart data: current hours vs proportional target per category
  const totalCurrentByCategory = Object.values(categoryHoursMap).reduce((s, h) => s + h, 0)
  const numCategories = Object.keys(categoryHoursMap).length
  const overallTarget = ownTeacherRecord?.cpdTarget ?? 40
  const categoryHours = Object.entries(categoryHoursMap).map(([category, current]) => ({
    category,
    current: Math.round(current * 10) / 10,
    // proportional target: scale the category's share of overall enrolled hours against total target
    target: totalCurrentByCategory > 0
      ? Math.round((current / totalCurrentByCategory) * overallTarget * 10) / 10
      : Math.round((overallTarget / Math.max(numCategories, 1)) * 10) / 10,
  }))

  const draftWorkshops = workshops.filter(w => w.status === 'draft')

  // Filtered workshops for display
  const filteredWorkshops = categoryFilter
    ? workshops.filter(w => w.category === categoryFilter)
    : workshops

  // ─── Mutations ────────────────────────────────────────────────────

  const withdrawMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      const { data } = await api.patch(`/ems/cpd-workshops/${workshopId}/withdraw`)
      return data
    },
    onSuccess: (res) => {
      message.success(res.message ?? 'Withdrawn successfully.')
      queryClient.invalidateQueries({ queryKey: ['cpd-workshops'] })
      queryClient.invalidateQueries({ queryKey: ['cpd-summary'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? 'Withdrawal failed.')
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      const { data } = await api.patch(`/ems/cpd-workshops/${workshopId}`, { status: 'open' })
      return data
    },
    onSuccess: () => {
      message.success('Workshop published — teachers can now see and enroll.')
      queryClient.invalidateQueries({ queryKey: ['cpd-workshops'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? 'Publish failed.')
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = {
        ...values,
        startDate: (values.startDate as dayjs.Dayjs).toISOString(),
        endDate: (values.endDate as dayjs.Dayjs).toISOString(),
      }
      const { data } = await api.post('/ems/cpd-workshops', payload)
      return data
    },
    onSuccess: () => {
      message.success('Workshop created')
      setCreateModalOpen(false)
      createForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['cpd-workshops'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? 'Creation failed.')
    },
  })

  const belowTarget = cpdSummary.filter(t => t.belowTarget)
  const atTarget = cpdSummary.filter(t => !t.belowTarget).length

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <Award size={22} />
            <Title level={4} style={{ margin: 0 }}>CPD Workshops & Compliance</Title>
          </Space>
        </Col>
        <Col>
          {canCreate && (
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateModalOpen(true)}>
              Create Workshop
            </Button>
          )}
        </Col>
      </Row>

      {/* CPD compliance summary */}
      {canEnrollOthers && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#52c41a' }}>{atTarget}</div>
                <div style={{ color: '#8c8c8c' }}>At CPD Target</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#ff4d4f' }}>{belowTarget.length}</div>
                <div style={{ color: '#8c8c8c' }}>Below Target</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#1677ff' }}>
                  {workshops.filter(w => w.status === 'open').length}
                </div>
                <div style={{ color: '#8c8c8c' }}>Open Workshops</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#8c8c8c' }}>
                  {draftWorkshops.length}
                </div>
                <div style={{ color: '#8c8c8c' }}>Drafts (not published)</div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {canCreate && draftWorkshops.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${draftWorkshops.length} draft workshop${draftWorkshops.length > 1 ? 's' : ''} not yet visible to teachers`}
          description="Click Publish on a workshop card to make it available for enrollment."
        />
      )}

      {/* Per-teacher CPD by category (teacher's own enrolled hours) */}
      {isTeacher && categoryHours.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={<Space><PieChart size={14} /><span>My CPD Hours by Category</span></Space>}
          extra={
            ownTeacherRecord && (
              <Space size={4}>
                <Tag color={ownTeacherRecord.cpdHours >= overallTarget ? 'success' : 'orange'}>
                  Total: {ownTeacherRecord.cpdHours}h / {overallTarget}h
                </Tag>
              </Space>
            )
          }
        >
          <Row gutter={[16, 8]} align="middle">
            <Col xs={24} md={16}>
              <ResponsiveContainer width="100%" height={Math.max(80, categoryHours.length * 36)}>
                <BarChart data={categoryHours} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={130} />
                  <RechartTooltip formatter={(v, name) => [`${v}h`, name === 'target' ? 'Target' : 'Current Hours']} />
                  <Bar dataKey="target" fill="#e6e6e6" radius={[0, 4, 4, 0]} name="target" />
                  <Bar dataKey="current" radius={[0, 4, 4, 0]} name="current">
                    {categoryHours.map(entry => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#8C8C8C'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, paddingLeft: 8 }}>
                Grey bar = proportional target · Coloured bar = current hours
              </Text>
            </Col>
            <Col xs={24} md={8}>
              <Space direction="vertical" size={6}>
                {categoryHours.map(e => (
                  <div key={e.category}>
                    <Space size={4}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, background: CATEGORY_COLORS[e.category] ?? '#8C8C8C', flexShrink: 0 }} />
                      <Text style={{ fontSize: 12 }}>{e.category}</Text>
                    </Space>
                    <div style={{ fontSize: 13, fontWeight: 600, paddingLeft: 16, color: '#1d2129' }}>
                      {e.current}h <Text type="secondary" style={{ fontSize: 11 }}>/ {e.target}h target</Text>
                    </div>
                  </div>
                ))}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Teachers below target */}
      {canEnrollOthers && belowTarget.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${belowTarget.length} teacher${belowTarget.length > 1 ? 's' : ''} below CPD target:`}
          description={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {belowTarget.map(t => (
                <Tag key={t.id} color="orange">
                  {t.displayName} — {t.cpdHours}/{t.cpdTarget}h
                </Tag>
              ))}
            </div>
          }
        />
      )}

      {/* Category filter */}
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col>
          <Select
            placeholder="All categories"
            allowClear
            style={{ width: 200 }}
            value={categoryFilter}
            onChange={v => setCategoryFilter(v)}
            options={CATEGORY_OPTIONS}
          />
        </Col>
      </Row>

      {/* Workshop cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin indicator={<Loader2 size={32} className="spin-icon" />} />
          <div style={{ marginTop: 12, color: '#8c8c8c' }}>Loading workshops…</div>
        </div>
      ) : filteredWorkshops.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>
            No open workshops available at this time.
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredWorkshops.map(w => (
            <Col key={w.id} xs={24} md={12} lg={8}>
              <Card
                style={{
                  border: w.status === 'draft' ? '1px dashed #d9d9d9'
                    : w.alreadyEnrolled ? '2px solid #52c41a' : '1px solid #f0f0f0',
                  height: '100%',
                  cursor: 'pointer',
                  opacity: w.status === 'draft' ? 0.85 : 1,
                }}
                onClick={() => navigate(`/ems/cpd-workshops/${w.id}`)}
                actions={[
                  w.status === 'draft' && canCreate ? (
                    <Space key="draft-actions" size={4} onClick={e => e.stopPropagation()}>
                      <Tooltip title="Make visible to teachers">
                        <Button
                          type="primary"
                          size="small"
                          icon={<Send size={14} />}
                          loading={publishMutation.isPending}
                          onClick={e => { e.stopPropagation(); publishMutation.mutate(w.id) }}
                        >
                          Publish
                        </Button>
                      </Tooltip>
                      <Button
                        size="small"
                        onClick={e => { e.stopPropagation(); navigate(`/ems/cpd-workshops/${w.id}`) }}
                      >
                        Edit
                      </Button>
                    </Space>
                  ) : w.alreadyEnrolled ? (
                    <Space key="enrolled-actions" size={4} onClick={e => e.stopPropagation()}>
                      <Button type="text" icon={<CheckCircle2 size={16} />} disabled style={{ color: '#52c41a' }}>
                        Enrolled
                      </Button>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<LogOut size={14} />}
                        loading={withdrawMutation.isPending}
                        onClick={e => { e.stopPropagation(); withdrawMutation.mutate(w.id) }}
                      >
                        Withdraw
                      </Button>
                    </Space>
                  ) : (
                    <Button
                      key="view"
                      type="default"
                      onClick={e => { e.stopPropagation(); navigate(`/ems/cpd-workshops/${w.id}`) }}
                    >
                      View Details
                    </Button>
                  ),
                ]}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{w.title}</Text>
                    {w.subject && <Tag style={{ marginLeft: 8 }}>{w.subject}</Tag>}
                    {w.status === 'draft' && <Tag color="default" style={{ marginLeft: 4 }}>Draft</Tag>}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {w.provider ?? 'MOE Professional Development Centre'}
                  </Text>
                  {w.description && (
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 12,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {w.description}
                    </Text>
                  )}
                  <Space wrap>
                    <Tag icon={<Clock size={12} />} color="blue">{w.hours}h CPD</Tag>
                    <Tag icon={<Users size={12} />}>
                      {w.enrolledCount}/{w.maxParticipants} enrolled
                    </Tag>
                    {w.category && (
                      <Tag style={{ background: `${CATEGORY_COLORS[w.category] ?? '#8C8C8C'}20`, color: CATEGORY_COLORS[w.category] ?? '#8C8C8C', borderColor: `${CATEGORY_COLORS[w.category] ?? '#8C8C8C'}40` }}>
                        {w.category}
                      </Tag>
                    )}
                  </Space>
                  <div style={{ fontSize: 13, color: '#595959' }}>
                    {dayjs(w.startDate).format('D MMM YYYY')}
                    {!dayjs(w.startDate).isSame(dayjs(w.endDate), 'day') && ` – ${dayjs(w.endDate).format('D MMM YYYY')}`}
                  </div>
                  {w.location && (
                    <Text type="secondary" style={{ fontSize: 12 }}>{w.location}</Text>
                  )}
                  <Progress
                    percent={Math.round((w.enrolledCount / w.maxParticipants) * 100)}
                    size="small"
                    status={w.enrolledCount >= w.maxParticipants ? 'exception' : 'active'}
                    showInfo={false}
                  />
                  {w.enrolledCount >= w.maxParticipants && (
                    <Badge status={w.alreadyEnrolled ? 'success' : 'error'} text={w.alreadyEnrolled ? 'Full — you are enrolled' : 'Full — contact admin'} />
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* ─── Create Workshop Modal ────────────────────────────────── */}
      <Modal
        open={createModalOpen}
        title={<Space><Plus size={18} /><span>Create Workshop</span></Space>}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={values => createMutation.mutate(values)}
          initialValues={{ maxParticipants: 30, category: 'General' }}
        >
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="provider" label="Provider">
                <AutoComplete
                  options={(workshopOptions?.providers ?? []).map(v => ({ value: v }))}
                  placeholder="e.g. MOE PDC"
                  filterOption={(input, opt) => (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subject" label="Subject Area">
                <AutoComplete
                  options={(workshopOptions?.subjects ?? []).map(v => ({ value: v }))}
                  placeholder="e.g. Mathematics"
                  filterOption={(input, opt) => (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="What does this workshop cover?" />
          </Form.Item>
          <Form.Item name="objectives" label="Learning Objectives">
            <Input.TextArea rows={3} placeholder="One objective per line" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="targetAudience" label="Target Audience">
                <Input placeholder="e.g. Secondary Science Teachers" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prerequisites" label="Prerequisites">
                <Input placeholder="e.g. None" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="hours" label="CPD Hours" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={0.5} max={200} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxParticipants" label="Max Participants">
                <InputNumber min={1} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="Category">
                <Select options={CATEGORY_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="startDate" label="Start Date" rules={[{ required: true, message: 'Required' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endDate" label="End Date" rules={[{ required: true, message: 'Required' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="location" label="Location">
            <AutoComplete
              options={(workshopOptions?.locations ?? []).map(v => ({ value: v }))}
              placeholder="e.g. PDC Training Room A"
              filterOption={(input, opt) => (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="imageUrl" label="Cover Image URL">
            <Input placeholder="https://... (optional)" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setCreateModalOpen(false); createForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>Create as Draft</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default CpdWorkshopsPage
