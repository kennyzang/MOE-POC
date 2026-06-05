import { useState } from 'react'
import {
  Tabs,
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Typography,
  Alert,
  Row,
  Col,
  Statistic,
  Badge,
  message,
  Descriptions,
  List,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  TrendingUp,
  BookOpen,
  FileText,
  UserCog,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

const STATUS_COLOR: Record<string, string> = {
  submitted: 'blue',
  under_review: 'orange',
  approved: 'green',
  rejected: 'red',
}

const TYPE_LABELS: Record<string, string> = {
  TRANSFER: 'Transfer Request',
  PROMOTION: 'Promotion Application',
  TRAINING: 'Training Request',
  DOCUMENT: 'Document Request',
  PROFILE_UPDATE: 'Profile Update',
}

const BRUNEI_SCHOOLS = [
  'Raja Isteri Pengiran Anak Saleha', 'Berakas Secondary', 'Maktab Sains',
  'Sultan Sharif Ali Secondary', 'Jerudong International', 'International School Brunei',
  'Lambak Kanan Secondary', 'Meragang Secondary', 'Serasa Secondary',
]

export default function SelfServicePortalPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const isAdmin = ['admin', 'manager', 'principal', 'hod'].includes(user?.role || '')

  const [activeTab, setActiveTab] = useState('my-requests')
  const [reviewModal, setReviewModal] = useState<{ open: boolean; request: any | null }>({ open: false, request: null })
  const [reviewStatus, setReviewStatus] = useState('')
  const [reviewRemarks, setReviewRemarks] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')

  // ── My Requests ───────────────────────────────────────────────
  const myRequestsQuery = useQuery({
    queryKey: ['self-service-mine'],
    queryFn: async () => { const { data } = await api.get('/self-service/my-requests'); return data.data },
    enabled: activeTab === 'my-requests',
  })

  // ── Pending (admin) ───────────────────────────────────────────
  const pendingQuery = useQuery({
    queryKey: ['self-service-pending'],
    queryFn: async () => { const { data } = await api.get('/self-service/pending'); return data.data },
    enabled: activeTab === 'pending' && isAdmin,
  })

  // ── Mutations ─────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async ({ endpoint, body }: { endpoint: string; body: Record<string, unknown> }) => {
      const { data } = await api.post(`/self-service/${endpoint}`, body)
      return data
    },
    onSuccess: () => {
      message.success('Request submitted successfully')
      queryClient.invalidateQueries({ queryKey: ['self-service-mine'] })
    },
    onError: (err: any) => message.error(err.response?.data?.message || 'Submission failed'),
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, reviewerRemarks, documentUrl }: any) => {
      const { data } = await api.patch(`/self-service/${id}`, { status, reviewerRemarks, documentUrl })
      return data
    },
    onSuccess: () => {
      message.success('Decision recorded')
      queryClient.invalidateQueries({ queryKey: ['self-service-pending'] })
      setReviewModal({ open: false, request: null })
    },
    onError: () => message.error('Failed to record decision'),
  })

  // ── Forms ─────────────────────────────────────────────────────
  const [transferForm] = Form.useForm()
  const [promotionForm] = Form.useForm()
  const [trainingForm] = Form.useForm()
  const [documentForm] = Form.useForm()
  const [profileForm] = Form.useForm()

  const handleTransfer = async () => {
    const v = await transferForm.validateFields()
    submitMutation.mutate({
      endpoint: 'transfer',
      body: {
        preferredSchools: v.preferredSchools,
        transferReason: v.transferReason,
        transferEffectiveDate: v.transferEffectiveDate?.toISOString(),
        notes: v.notes,
      },
    })
    transferForm.resetFields()
  }

  const handlePromotion = async () => {
    const v = await promotionForm.validateFields()
    submitMutation.mutate({ endpoint: 'promotion', body: v })
    promotionForm.resetFields()
  }

  const handleTraining = async () => {
    const v = await trainingForm.validateFields()
    submitMutation.mutate({ endpoint: 'training', body: { ...v, courseCost: v.courseCost ? Number(v.courseCost) : undefined } })
    trainingForm.resetFields()
  }

  const handleDocument = async () => {
    const v = await documentForm.validateFields()
    submitMutation.mutate({ endpoint: 'document-request', body: v })
    documentForm.resetFields()
  }

  const handleProfileUpdate = async () => {
    const v = await profileForm.validateFields()
    const changes = Object.entries(v)
      .filter(([, val]) => val !== undefined && val !== '')
      .map(([field, newValue]) => ({ field, newValue: String(newValue) }))
    if (changes.length === 0) { message.warning('No changes to submit'); return }
    const { data } = await api.patch('/self-service/profile', { changes })
    message.success(data.data?.message || 'Profile update submitted')
    profileForm.resetFields()
    queryClient.invalidateQueries({ queryKey: ['self-service-mine'] })
  }

  // ── My Requests table ─────────────────────────────────────────
  const myRequestCols: ColumnsType<any> = [
    { title: 'Type', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color="blue">{TYPE_LABELS[v] ?? v}</Tag> },
    {
      title: 'Details', key: 'details',
      render: (_: any, r: any) => {
        if (r.type === 'TRANSFER') return <Text style={{ fontSize: 12 }}>To: {r.preferredSchools ? JSON.parse(r.preferredSchools).join(', ') : '—'}</Text>
        if (r.type === 'PROMOTION') return <Text style={{ fontSize: 12 }}>→ {r.desiredPosition}</Text>
        if (r.type === 'TRAINING') return <Text style={{ fontSize: 12 }}>{r.courseName} ({r.courseProvider})</Text>
        if (r.type === 'DOCUMENT') return <Text style={{ fontSize: 12 }}>{r.documentType?.replace(/_/g, ' ')}</Text>
        if (r.type === 'PROFILE_UPDATE') return <Text style={{ fontSize: 12 }}>Sensitive field changes pending approval</Text>
        return '—'
      },
    },
    { title: 'Submitted', dataIndex: 'createdAt', key: 'createdAt', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? 'default'} icon={v === 'approved' ? <CheckCircle size={11} /> : v === 'rejected' ? <XCircle size={11} /> : <Clock size={11} />}>
          {v.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    { title: 'Remarks', dataIndex: 'reviewerRemarks', key: 'reviewerRemarks', render: (v: string) => v || '—' },
    {
      title: 'Document', dataIndex: 'documentUrl', key: 'documentUrl', width: 100,
      render: (v: string) => v ? <a href={v} target="_blank" rel="noopener">Download</a> : '—',
    },
  ]

  // ── Pending requests table (admin) ────────────────────────────
  const pendingCols: ColumnsType<any> = [
    { title: 'Teacher', dataIndex: 'teacherName', key: 'teacherName' },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color="blue">{TYPE_LABELS[v] ?? v}</Tag> },
    { title: 'Submitted', dataIndex: 'createdAt', key: 'createdAt', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_: any, r: any) => (
        <Button size="small" type="link" onClick={() => { setReviewModal({ open: true, request: r }); setReviewStatus(''); setReviewRemarks(''); setDocumentUrl('') }}>
          Review
        </Button>
      ),
    },
  ]

  const openReq = reviewModal.request

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <UserCog size={22} />
        <Title level={4} style={{ margin: 0 }}>Self-Service Educator Portal</Title>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          // ── SS-01: Transfer ───────────────────────────────────
          {
            key: 'transfer',
            label: <Space><ArrowRightLeft size={14} />Transfer</Space>,
            children: (
              <Card title="SS-01 — Internal Transfer Request">
                <Alert type="info" message="Submit a request to transfer to another school within the MOE system. Your current HOD and the receiving school will be notified." style={{ marginBottom: 16 }} />
                <Form form={transferForm} layout="vertical" style={{ maxWidth: 600 }}>
                  <Form.Item name="preferredSchools" label="Preferred School(s)" rules={[{ required: true }]}>
                    <Select mode="multiple" placeholder="Select one or more preferred schools">
                      {BRUNEI_SCHOOLS.map(s => <Option key={s} value={s}>{s}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="transferReason" label="Reason for Transfer" rules={[{ required: true }]}>
                    <TextArea rows={3} placeholder="Explain your reason for requesting a transfer" />
                  </Form.Item>
                  <Form.Item name="transferEffectiveDate" label="Preferred Effective Date">
                    <DatePicker style={{ width: '100%' }} disabledDate={d => d.isBefore(dayjs())} />
                  </Form.Item>
                  <Form.Item name="notes" label="Additional Notes">
                    <TextArea rows={2} placeholder="Any additional information" />
                  </Form.Item>
                  <Button type="primary" loading={submitMutation.isPending} onClick={handleTransfer} icon={<ArrowRightLeft size={14} />}>
                    Submit Transfer Request
                  </Button>
                </Form>
              </Card>
            ),
          },
          // ── SS-02: Promotion ──────────────────────────────────
          {
            key: 'promotion',
            label: <Space><TrendingUp size={14} />Promotion</Space>,
            children: (
              <Card title="SS-02 — Promotion Application">
                <Alert type="info" message="Apply for a promotion opportunity. Your application will be routed to HOD → Principal → HR for review." style={{ marginBottom: 16 }} />
                <Form form={promotionForm} layout="vertical" style={{ maxWidth: 600 }}>
                  <Form.Item name="currentPosition" label="Current Position">
                    <Input placeholder="e.g. Cikgu Gred DG41" />
                  </Form.Item>
                  <Form.Item name="desiredPosition" label="Desired Position" rules={[{ required: true }]}>
                    <Input placeholder="e.g. Cikgu Gred DG44" />
                  </Form.Item>
                  <Form.Item name="promotionJustification" label="Justification" rules={[{ required: true }]}>
                    <TextArea rows={4} placeholder="Describe your achievements, qualifications, and reasons for this promotion" />
                  </Form.Item>
                  <Form.Item name="notes" label="Supporting Notes">
                    <TextArea rows={2} placeholder="Additional context" />
                  </Form.Item>
                  <Button type="primary" loading={submitMutation.isPending} onClick={handlePromotion} icon={<TrendingUp size={14} />}>
                    Submit Promotion Application
                  </Button>
                </Form>
              </Card>
            ),
          },
          // ── SS-03: Training ───────────────────────────────────
          {
            key: 'training',
            label: <Space><BookOpen size={14} />Training</Space>,
            children: (
              <Card title="SS-03 — Training Course Request">
                <Alert type="info" message="Request approval for an external training course or conference. Approved courses will be added to your CPD record." style={{ marginBottom: 16 }} />
                <Form form={trainingForm} layout="vertical" style={{ maxWidth: 600 }}>
                  <Form.Item name="courseName" label="Course / Conference Name" rules={[{ required: true }]}>
                    <Input placeholder="e.g. Advanced STEM Teaching Methodology" />
                  </Form.Item>
                  <Form.Item name="courseProvider" label="Provider / Organiser">
                    <Input placeholder="e.g. UTB Professional Development Centre" />
                  </Form.Item>
                  <Form.Item name="courseDates" label="Course Dates">
                    <Input placeholder="e.g. 15–17 July 2026" />
                  </Form.Item>
                  <Form.Item name="courseCost" label="Estimated Cost (BND)">
                    <Input type="number" min={0} placeholder="0.00" />
                  </Form.Item>
                  <Form.Item name="courseJustification" label="Justification" rules={[{ required: true }]}>
                    <TextArea rows={3} placeholder="How will this course benefit your teaching and the school?" />
                  </Form.Item>
                  <Button type="primary" loading={submitMutation.isPending} onClick={handleTraining} icon={<BookOpen size={14} />}>
                    Submit Training Request
                  </Button>
                </Form>
              </Card>
            ),
          },
          // ── SS-04: Document Request ───────────────────────────
          {
            key: 'document',
            label: <Space><FileText size={14} />Documents</Space>,
            children: (
              <Card title="SS-04 — Official Document Request">
                <Alert type="info" message="Request official employment documents from HR. Once processed, the document will appear in your My Requests list as a download link." style={{ marginBottom: 16 }} />
                <Form form={documentForm} layout="vertical" style={{ maxWidth: 500 }}>
                  <Form.Item name="documentType" label="Document Type" rules={[{ required: true }]}>
                    <Select placeholder="Select document type">
                      <Option value="EMPLOYMENT_CERTIFICATE">Employment Certificate</Option>
                      <Option value="SALARY_SLIP">Salary Slip</Option>
                      <Option value="SERVICE_RECORD">Service Record</Option>
                      <Option value="OTHER">Other</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="notes" label="Notes / Specific Requirements">
                    <TextArea rows={2} placeholder="e.g. Required for bank loan application — please include salary details" />
                  </Form.Item>
                  <Button type="primary" loading={submitMutation.isPending} onClick={handleDocument} icon={<FileText size={14} />}>
                    Request Document
                  </Button>
                </Form>
              </Card>
            ),
          },
          // ── SS-05: Profile Update ─────────────────────────────
          {
            key: 'profile-update',
            label: <Space><UserCog size={14} />Profile</Space>,
            children: (
              <Card title="SS-05 — Profile Self-Update">
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Alert
                      type="info"
                      style={{ marginBottom: 16 }}
                      message="Safe fields (contact, address) update immediately. Sensitive fields (designation, qualification, department) require admin approval."
                    />
                    <Form form={profileForm} layout="vertical">
                      <Descriptions title="Safe Fields (update immediately)" size="small" style={{ marginBottom: 8 }} />
                      <Form.Item name="phone" label="Contact Number">
                        <Input placeholder="e.g. +673 7xxxxxx" />
                      </Form.Item>
                      <Form.Item name="emergencyContact" label="Emergency Contact">
                        <Input placeholder="Name and phone number" />
                      </Form.Item>
                      <Form.Item name="address" label="Home Address">
                        <Input placeholder="Current home address" />
                      </Form.Item>
                      <Descriptions title="Sensitive Fields (requires admin approval)" size="small" style={{ margin: '8px 0' }} />
                      <Form.Item name="designation" label="Designation / Title">
                        <Input placeholder="New designation (pending admin approval)" />
                      </Form.Item>
                      <Form.Item name="qualification" label="Highest Qualification">
                        <Input placeholder="e.g. Master of Education" />
                      </Form.Item>
                      <Form.Item name="department" label="Department">
                        <Input placeholder="e.g. Science Department" />
                      </Form.Item>
                      <Button type="primary" onClick={handleProfileUpdate} icon={<UserCog size={14} />}>
                        Submit Profile Update
                      </Button>
                    </Form>
                  </Col>
                </Row>
              </Card>
            ),
          },
          // ── My Requests ───────────────────────────────────────
          {
            key: 'my-requests',
            label: <Space><ClipboardList size={14} />My Requests</Space>,
            children: (
              <Card title="My Submitted Requests">
                <Table
                  rowKey="id"
                  columns={myRequestCols}
                  dataSource={myRequestsQuery.data || []}
                  loading={myRequestsQuery.isLoading}
                  pagination={{ pageSize: 10 }}
                  size="small"
                  locale={{ emptyText: 'No requests submitted yet. Use the tabs above to submit a request.' }}
                />
              </Card>
            ),
          },
          // ── Pending (admin) ───────────────────────────────────
          ...(isAdmin ? [{
            key: 'pending',
            label: (
              <Space>
                <ClipboardList size={14} />
                Pending Review
                {(pendingQuery.data?.length ?? 0) > 0 && (
                  <Badge count={pendingQuery.data?.length} size="small" />
                )}
              </Space>
            ),
            children: (
              <Card title="Pending Self-Service Requests">
                <Table
                  rowKey="id"
                  columns={pendingCols}
                  dataSource={pendingQuery.data || []}
                  loading={pendingQuery.isLoading}
                  pagination={{ pageSize: 15 }}
                  size="small"
                  expandable={{
                    expandedRowRender: (r: any) => (
                      <Descriptions size="small" bordered column={2}>
                        {r.type === 'TRANSFER' && <>
                          <Descriptions.Item label="Preferred Schools" span={2}>{r.preferredSchools ? JSON.parse(r.preferredSchools).join(', ') : '—'}</Descriptions.Item>
                          <Descriptions.Item label="Reason" span={2}>{r.transferReason}</Descriptions.Item>
                          <Descriptions.Item label="Effective Date">{r.transferEffectiveDate ? dayjs(r.transferEffectiveDate).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
                        </>}
                        {r.type === 'PROMOTION' && <>
                          <Descriptions.Item label="Current Position">{r.currentPosition || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Desired Position">{r.desiredPosition}</Descriptions.Item>
                          <Descriptions.Item label="Justification" span={2}>{r.promotionJustification}</Descriptions.Item>
                        </>}
                        {r.type === 'TRAINING' && <>
                          <Descriptions.Item label="Course">{r.courseName}</Descriptions.Item>
                          <Descriptions.Item label="Provider">{r.courseProvider || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Dates">{r.courseDates || '—'}</Descriptions.Item>
                          <Descriptions.Item label="Cost">BND {r.courseCost ?? '—'}</Descriptions.Item>
                          <Descriptions.Item label="Justification" span={2}>{r.courseJustification}</Descriptions.Item>
                        </>}
                        {r.type === 'DOCUMENT' && <>
                          <Descriptions.Item label="Document Type">{r.documentType?.replace(/_/g, ' ')}</Descriptions.Item>
                          <Descriptions.Item label="Notes">{r.notes || '—'}</Descriptions.Item>
                        </>}
                        {r.type === 'PROFILE_UPDATE' && <>
                          <Descriptions.Item label="Proposed Changes" span={2}>
                            <List
                              size="small"
                              dataSource={r.profileChanges || []}
                              renderItem={(ch: any) => (
                                <List.Item>
                                  <Text strong>{ch.field}: </Text>
                                  <Text delete style={{ marginLeft: 4 }}>{ch.oldValue || '(empty)'}</Text>
                                  <Text style={{ marginLeft: 8 }}>→ {ch.newValue}</Text>
                                </List.Item>
                              )}
                            />
                          </Descriptions.Item>
                        </>}
                        {r.notes && <Descriptions.Item label="Notes" span={2}>{r.notes}</Descriptions.Item>}
                      </Descriptions>
                    ),
                  }}
                />
              </Card>
            ),
          }] : []),
        ]}
      />

      {/* Review Modal */}
      <Modal
        title={`Review: ${openReq ? (TYPE_LABELS[openReq.type] ?? openReq.type) : ''}`}
        open={reviewModal.open}
        onCancel={() => setReviewModal({ open: false, request: null })}
        onOk={() => {
          if (!openReq || !reviewStatus) { message.warning('Please select a decision'); return }
          reviewMutation.mutate({ id: openReq.id, status: reviewStatus, reviewerRemarks: reviewRemarks, documentUrl: documentUrl || undefined })
        }}
        okButtonProps={{ loading: reviewMutation.isPending, disabled: !reviewStatus }}
        okText="Confirm Decision"
        width={500}
      >
        {openReq && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text><strong>Teacher:</strong> {openReq.teacherName}</Text>
            <Text><strong>Submitted:</strong> {dayjs(openReq.createdAt).format('DD/MM/YYYY HH:mm')}</Text>

            <Form layout="vertical">
              <Form.Item label="Decision" required>
                <Select value={reviewStatus || undefined} onChange={setReviewStatus} placeholder="Select decision" style={{ width: '100%' }}>
                  <Option value="under_review">Mark as Under Review</Option>
                  <Option value="approved">Approve</Option>
                  <Option value="rejected">Reject</Option>
                </Select>
              </Form.Item>
              <Form.Item label="Remarks">
                <TextArea rows={3} value={reviewRemarks} onChange={e => setReviewRemarks(e.target.value)} placeholder="Comments or instructions for the educator" />
              </Form.Item>
              {openReq.type === 'DOCUMENT' && (
                <Form.Item label="Upload Document Link (for approved requests)">
                  <Input value={documentUrl} onChange={e => setDocumentUrl(e.target.value)} placeholder="Paste document URL or path" />
                </Form.Item>
              )}
            </Form>
          </Space>
        )}
      </Modal>
    </div>
  )
}
