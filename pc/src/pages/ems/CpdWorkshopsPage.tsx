import { useState } from 'react'
import {
  Card, Row, Col, Typography, Space, Button, Tag, Progress, Alert,
  Modal, Descriptions, Form, Input, InputNumber, Select, DatePicker,
  message, Spin, Badge, Tabs,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, Award, CheckCircle2, Clock, Users, Loader2, Plus, LogOut,
  PieChart,
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

  const [enrollModal, setEnrollModal] = useState<{ open: boolean; workshop: CpdWorkshop | null }>({ open: false, workshop: null })
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | undefined>()
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [createForm] = Form.useForm()

  const canEnrollOthers = ['admin', 'manager', 'hod', 'principal'].includes(user?.role ?? '')
  const canCreate = ['admin', 'manager', 'hod'].includes(user?.role ?? '')
  const isTeacher = user?.role === 'teacher'

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
    enabled: canEnrollOthers,
  })

  const teacherOptions = cpdSummary.map(t => ({
    label: `${t.displayName} (${t.cpdHours}/${t.cpdTarget}h)`,
    value: t.id,
  }))

  // Derive CPD hours by category from enrolled/open workshops data
  const categoryHours = Object.entries(
    workshops
      .filter(w => w.alreadyEnrolled)
      .reduce<Record<string, number>>((acc, w) => {
        const cat = w.category ?? 'General'
        acc[cat] = (acc[cat] ?? 0) + w.hours * 0.2 // pre-credited hours
        return acc
      }, {}),
  ).map(([category, hours]) => ({ category, hours: Math.round(hours * 10) / 10 }))

  // Filtered workshops for display
  const filteredWorkshops = categoryFilter
    ? workshops.filter(w => w.category === categoryFilter)
    : workshops

  // ─── Mutations ────────────────────────────────────────────────────

  const enrollMutation = useMutation({
    mutationFn: async ({ workshopId, teacherId }: { workshopId: string; teacherId?: string }) => {
      const body = teacherId ? { teacherId } : {}
      const { data } = await api.post(`/ems/cpd-workshops/${workshopId}/enroll`, body)
      return data
    },
    onSuccess: (res) => {
      message.success(res.message ?? 'Enrolled successfully!', 5)
      setEnrollModal({ open: false, workshop: null })
      setSelectedTeacherId(undefined)
      queryClient.invalidateQueries({ queryKey: ['cpd-workshops'] })
      queryClient.invalidateQueries({ queryKey: ['cpd-summary'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? 'Enrollment failed.')
    },
  })

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

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleEnroll = () => {
    if (!enrollModal.workshop) return
    enrollMutation.mutate({
      workshopId: enrollModal.workshop.id,
      teacherId: canEnrollOthers ? selectedTeacherId : undefined,
    })
  }

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
        </Row>
      )}

      {/* Per-teacher CPD by category (teacher's own enrolled hours) */}
      {isTeacher && categoryHours.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={<Space><PieChart size={14} /><span>My CPD Hours by Category</span></Space>}
        >
          <Row gutter={[16, 8]} align="middle">
            <Col xs={24} md={14}>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={categoryHours} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={110} />
                  <RechartTooltip formatter={(v) => [`${v}h`, 'Pre-credited hours']} />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                    {categoryHours.map(entry => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#8C8C8C'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Col>
            <Col xs={24} md={10}>
              <Space direction="vertical" size={4}>
                {categoryHours.map(e => (
                  <Space key={e.category} size={4}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: CATEGORY_COLORS[e.category] ?? '#8C8C8C', flexShrink: 0 }} />
                    <Text style={{ fontSize: 12 }}>{e.category}: <b>{e.hours}h</b></Text>
                  </Space>
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
                  border: w.alreadyEnrolled ? '2px solid #52c41a' : '1px solid #f0f0f0',
                  height: '100%',
                }}
                actions={[
                  w.alreadyEnrolled ? (
                    <Space key="enrolled-actions" size={4}>
                      <Button type="text" icon={<CheckCircle2 size={16} color="#52c41a" />} disabled>
                        Enrolled
                      </Button>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<LogOut size={14} />}
                        loading={withdrawMutation.isPending}
                        onClick={() => withdrawMutation.mutate(w.id)}
                      >
                        Withdraw
                      </Button>
                    </Space>
                  ) : (
                    <Button
                      key="enroll"
                      type="primary"
                      disabled={w.status === 'full' && !canEnrollOthers}
                      onClick={() => { setEnrollModal({ open: true, workshop: w }); setSelectedTeacherId(undefined) }}
                    >
                      {canEnrollOthers ? 'Enrol Teacher' : 'Enrol'}
                    </Button>
                  ),
                ]}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{w.title}</Text>
                    {w.subject && <Tag style={{ marginLeft: 8 }}>{w.subject}</Tag>}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {w.provider ?? 'MOE Professional Development Centre'}
                  </Text>
                  <Space wrap>
                    <Tag icon={<Clock size={12} />} color="blue">{w.hours}h CPD</Tag>
                    <Tag icon={<Users size={12} />}>
                      {w.enrolledCount}/{w.maxParticipants} enrolled
                    </Tag>
                    {w.category && (
                      <Tag color={CATEGORY_COLORS[w.category] ? undefined : undefined} style={{ background: `${CATEGORY_COLORS[w.category] ?? '#8C8C8C'}20`, color: CATEGORY_COLORS[w.category] ?? '#8C8C8C', borderColor: `${CATEGORY_COLORS[w.category] ?? '#8C8C8C'}40` }}>
                        {w.category}
                      </Tag>
                    )}
                  </Space>
                  <div style={{ fontSize: 13, color: '#595959' }}>
                    📅 {new Date(w.startDate).toLocaleDateString()} – {new Date(w.endDate).toLocaleDateString()}
                  </div>
                  {w.location && (
                    <Text type="secondary" style={{ fontSize: 12 }}>📍 {w.location}</Text>
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

      {/* ─── Enrol Modal ─────────────────────────────────────────── */}
      <Modal
        open={enrollModal.open}
        title={<Space><BookOpen size={18} /><span>Enrol in Workshop</span></Space>}
        onCancel={() => { setEnrollModal({ open: false, workshop: null }); setSelectedTeacherId(undefined) }}
        onOk={handleEnroll}
        okText="Confirm Enrolment"
        confirmLoading={enrollMutation.isPending}
        okButtonProps={{ disabled: canEnrollOthers && !selectedTeacherId && !isTeacher }}
      >
        {enrollModal.workshop && (
          <>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Workshop">{enrollModal.workshop.title}</Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag>{enrollModal.workshop.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="CPD Hours">
                <Tag color="blue">{enrollModal.workshop.hours}h</Tag>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({(enrollModal.workshop.hours * 0.2).toFixed(1)}h pre-credited on enrolment)
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Date">
                {new Date(enrollModal.workshop.startDate).toLocaleDateString()} – {new Date(enrollModal.workshop.endDate).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label="Location">{enrollModal.workshop.location ?? 'TBC'}</Descriptions.Item>
            </Descriptions>

            {canEnrollOthers && (
              <>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Select Teacher to Enrol</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Select teacher..."
                  options={teacherOptions}
                  value={selectedTeacherId}
                  onChange={v => setSelectedTeacherId(v)}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  loading={loadingCpd}
                />
              </>
            )}

            <Alert
              type="info"
              showIcon
              style={{ marginTop: 16 }}
              message="On confirmation: CPD hours are pre-credited and workshop dates are blocked in the teacher's schedule."
            />
          </>
        )}
      </Modal>

      {/* ─── Create Workshop Modal ────────────────────────────────── */}
      <Modal
        open={createModalOpen}
        title={<Space><Plus size={18} /><span>Create Workshop</span></Space>}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        footer={null}
        width={560}
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
                <Input placeholder="e.g. MOE PDC" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subject" label="Subject Area">
                <Input placeholder="e.g. Mathematics" />
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
            <Input placeholder="e.g. PDC Training Room A" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setCreateModalOpen(false); createForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>Create Workshop</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default CpdWorkshopsPage
