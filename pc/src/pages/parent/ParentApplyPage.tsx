import { useState } from 'react'
import {
  Card, Button, Steps, Form, Input, Select, DatePicker, Tag, Table, Space,
  Typography, Row, Col, Statistic, message, Alert, Divider, Modal, Descriptions, Badge,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, FileText, Eye, Paperclip } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import api from '@/lib/api'
import FileUploader from '@/components/FileUploader'
import FileList from '@/components/FileList'

const { Title, Text } = Typography

interface Application {
  id: string
  applicationNumber: string
  applicantName: string
  gradeApplied: string
  status: string
  eligibilityScore: number | null
  submittedAt: string | null
  createdAt: string
  hasSiblingPriority: boolean
  icNumber?: string
  dateOfBirth?: string
  gender?: string
  nationality?: string
  guardianName?: string
  parentName?: string
  guardianRelation?: string
  guardianPhone?: string
  parentPhone?: string
  guardianEmail?: string
  parentEmail?: string
  siblingName?: string
  programmeStream?: string
  previousSchool?: string
  previousAcademicAvg?: number
  medicalConditions?: string
  remarks?: string
  decidedAt?: string
}

interface EnrolledChild {
  id: string
  displayName: string
  gradeLevel: string | null
  classSection: string | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  submitted: 'orange',
  under_review: 'blue',
  offer_issued: 'cyan',
  offer_accepted: 'green',
  rejected: 'red',
  waitlisted: 'purple',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  offer_issued: 'Offer Issued',
  offer_accepted: 'Offer Accepted',
  rejected: 'Rejected',
  waitlisted: 'Waitlisted',
}

const GRADE_LEVELS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12']

const COUNTRY_CODES = [
  { value: '+673', label: '+673 🇧🇳 Brunei' },
  { value: '+60', label: '+60 🇲🇾 Malaysia' },
  { value: '+65', label: '+65 🇸🇬 Singapore' },
  { value: '+62', label: '+62 🇮🇩 Indonesia' },
  { value: '+66', label: '+66 🇹🇭 Thailand' },
  { value: '+63', label: '+63 🇵🇭 Philippines' },
  { value: '+44', label: '+44 🇬🇧 UK' },
  { value: '+61', label: '+61 🇦🇺 Australia' },
  { value: '+1', label: '+1 🇺🇸 USA/Canada' },
  { value: '+86', label: '+86 🇨🇳 China' },
]

function phoneValidator(countryCode: string) {
  return (_: unknown, value: string) => {
    if (!value) return Promise.resolve()
    const digits = value.replace(/\s/g, '')
    if (countryCode === '+673') {
      return /^[8-9]\d{6}$/.test(digits)
        ? Promise.resolve()
        : Promise.reject(new Error('Brunei number: start with 8 or 9, 7 digits total'))
    }
    return /^\d{6,12}$/.test(digits)
      ? Promise.resolve()
      : Promise.reject(new Error('Enter 6–12 digits'))
  }
}

interface SiblingResult { matched: boolean; siblingStudentId?: string; siblingName?: string; siblingClass?: string }

const ParentApplyPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [form1] = Form.useForm()
  const [form2] = Form.useForm()
  const [form3] = Form.useForm()
  const [wizardData, setWizardData] = useState<Record<string, unknown>>({})
  const [submittedApp, setSubmittedApp] = useState<Application | null>(null)

  // Phone country code state
  const [countryCode, setCountryCode] = useState('+673')

  // Sibling state
  const [siblingLookup, setSiblingLookup] = useState<SiblingResult | null>(null)
  const [siblingLoading, setSiblingLoading] = useState(false)

  // Detail modal state
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Accept offer mutation
  const acceptOfferMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/admissions/applications/${id}/accept-offer`)
      return data
    },
    onSuccess: () => {
      message.success('Offer accepted! Enrollment confirmed.')
      void queryClient.invalidateQueries({ queryKey: ['parent-applications'] })
      setDetailOpen(false)
    },
    onError: () => message.error('Failed to accept offer. Please try again.'),
  })

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['parent-applications'],
    queryFn: async () => {
      const { data } = await api.get('/parent/applications')
      return data.data as Application[]
    },
  })

  // Enrolled children for sibling dropdown
  const { data: enrolledChildren = [] } = useQuery({
    queryKey: ['parent-children'],
    queryFn: async () => {
      const { data } = await api.get('/parent/children')
      return data.data as EnrolledChild[]
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/admissions/applications', payload)
      return data.data as Application
    },
    onSuccess: (app) => {
      setSubmittedApp(app)
      void queryClient.invalidateQueries({ queryKey: ['parent-applications'] })
      message.success(t('parentPortal.applicationSubmitted', { defaultValue: 'Application submitted successfully!' }))
      setWizardOpen(false)
      setCurrentStep(0)
      form1.resetFields(); form2.resetFields(); form3.resetFields()
      setWizardData({})
      setSiblingLookup(null)
      setCountryCode('+673')
    },
  })

  const handleSiblingSelect = async (childId: string) => {
    const child = enrolledChildren.find((c) => c.id === childId)
    if (!child) return
    setSiblingLoading(true)
    try {
      const { data } = await api.get(`/admissions/sibling-lookup?name=${encodeURIComponent(child.displayName)}`)
      const result = data.data as SiblingResult
      setSiblingLookup(result)
      if (result.matched) {
        form2.setFieldValue('hasSiblingPriority', true)
        form2.setFieldValue('siblingStudentId', result.siblingStudentId)
        form2.setFieldValue('siblingName', child.displayName)
      }
    } catch { /* ignore */ }
    setSiblingLoading(false)
  }

  const nextStep = async () => {
    const forms = [form1, form2, form3]
    if (currentStep < 3) {
      try {
        const values = await forms[currentStep].validateFields()
        // Combine country code + local number into guardianPhone
        if (currentStep === 1 && values.localPhone) {
          values.guardianPhone = `${countryCode}${String(values.localPhone).replace(/\s/g, '')}`
          delete values.localPhone
        }
        setWizardData((prev) => ({ ...prev, ...values }))
        setCurrentStep((s) => s + 1)
      } catch { /* validation failed */ }
    }
  }

  const handleSubmit = async () => {
    try {
      const step3Values = await form3.validateFields()
      const payload = { ...wizardData, ...step3Values }
      submitMutation.mutate(payload)
    } catch { /* validation failed */ }
  }

  const handleOpenDetail = (app: Application) => {
    setSelectedApp(app)
    setDetailOpen(true)
  }

  const columns: ColumnsType<Application> = [
    {
      title: t('admissions.applicantName'),
      dataIndex: 'applicantName',
      key: 'applicantName',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t('admissions.gradeApplied'),
      dataIndex: 'gradeApplied',
      key: 'gradeApplied',
    },
    {
      title: t('admissions.eligibilityScore'),
      dataIndex: 'eligibilityScore',
      key: 'score',
      render: (s: number | null) => s != null ? <Tag color="blue">{s}/100</Tag> : '—',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{STATUS_LABELS[s] ?? s}</Tag>,
    },
    {
      title: t('admissions.submittedAt'),
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (d: string | null) => d ? new Date(d).toLocaleDateString() : t('admissions.statusDraft'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" icon={<Eye size={14} />} onClick={(e) => { e.stopPropagation(); handleOpenDetail(record) }}>
          View
        </Button>
      ),
    },
  ]

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => ['submitted', 'under_review'].includes(a.status)).length,
    offers: applications.filter((a) => ['offer_issued', 'offer_accepted'].includes(a.status)).length,
  }

  const reviewData = wizardData

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space align="center">
            <ClipboardList size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>
              {t('parentPortal.myApplications', { defaultValue: 'My Applications' })}
            </Title>
          </Space>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setWizardOpen(true)}>
            {t('parentPortal.newApplication', { defaultValue: 'New Application' })}
          </Button>
        </div>
      </Card>

      {/* Success confirmation */}
      {submittedApp && (
        <Alert
          type="success"
          showIcon
          message={t('admissions.wizard.submitSuccess')}
          description={
            <span>
              {t('admissions.wizard.applicationId')}: <strong>{submittedApp.applicationNumber}</strong>
              {submittedApp.eligibilityScore != null && (
                <> · {t('admissions.submitSuccessScore', { score: submittedApp.eligibilityScore })}</>
              )}
            </span>
          }
          closable
          onClose={() => setSubmittedApp(null)}
        />
      )}

      {/* Stats */}
      {applications.length > 0 && (
        <Row gutter={[16, 16]}>
          <Col xs={8}><Card size="small"><Statistic title={t('admissions.totalApplications')} value={stats.total} /></Card></Col>
          <Col xs={8}><Card size="small"><Statistic title={t('admissions.pendingReview')} value={stats.pending} styles={{ content: { color: '#fa8c16' } }} /></Card></Col>
          <Col xs={8}><Card size="small"><Statistic title={t('admissions.accepted')} value={stats.offers} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        </Row>
      )}

      {/* Applications table — rows are clickable */}
      <Card>
        <Table
          columns={columns}
          dataSource={applications}
          rowKey="id"
          loading={isLoading}
          locale={{ emptyText: t('parentPortal.noApplications', { defaultValue: 'No applications yet. Click "New Application" to get started.' }) }}
          pagination={false}
          size="middle"
          onRow={(record) => ({
            onClick: () => handleOpenDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* Application Detail Modal (Issue 5 + Issue 3) */}
      <Modal
        title={
          <Space>
            <FileText size={16} />
            {selectedApp?.applicationNumber ?? 'Application Detail'}
          </Space>
        }
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setSelectedApp(null) }}
        footer={
          selectedApp?.status === 'offer_issued'
            ? (
              <Button
                type="primary"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                loading={acceptOfferMutation.isPending}
                onClick={() => selectedApp && acceptOfferMutation.mutate(selectedApp.id)}
              >
                Accept Offer & Confirm Enrollment
              </Button>
            )
            : null
        }
        width={700}
        destroyOnHidden
      >
        {selectedApp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status bar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 4 }}>
              <Tag color={STATUS_COLORS[selectedApp.status] ?? 'default'} style={{ fontSize: 13 }}>
                {STATUS_LABELS[selectedApp.status] ?? selectedApp.status}
              </Tag>
              {selectedApp.submittedAt && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Submitted: {new Date(selectedApp.submittedAt).toLocaleDateString()}
                </Text>
              )}
            </div>

            {selectedApp.status === 'offer_issued' && (
              <Alert
                type="success"
                showIcon
                message="Congratulations! An offer has been issued. Please accept it to confirm enrollment."
              />
            )}
            {selectedApp.status === 'rejected' && selectedApp.remarks && (
              <Alert type="error" showIcon message={`Remarks: ${selectedApp.remarks}`} />
            )}

            <Descriptions bordered column={2} size="small" title="Applicant Information">
              <Descriptions.Item label="Name">{selectedApp.applicantName}</Descriptions.Item>
              <Descriptions.Item label="IC Number">{selectedApp.icNumber ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Date of Birth">
                {selectedApp.dateOfBirth ? new Date(selectedApp.dateOfBirth).toLocaleDateString() : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Gender">{selectedApp.gender ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Nationality">{selectedApp.nationality ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Descriptions bordered column={2} size="small" title="Guardian Information">
              <Descriptions.Item label="Guardian Name">{selectedApp.guardianName ?? selectedApp.parentName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Relationship">{selectedApp.guardianRelation ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedApp.guardianPhone ?? selectedApp.parentPhone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedApp.guardianEmail ?? selectedApp.parentEmail ?? '—'}</Descriptions.Item>
              {selectedApp.hasSiblingPriority && selectedApp.siblingName && (
                <Descriptions.Item label="Sibling Priority" span={2}>
                  <Badge color="green" text={selectedApp.siblingName} />
                </Descriptions.Item>
              )}
            </Descriptions>

            <Descriptions bordered column={2} size="small" title="Academic Background">
              <Descriptions.Item label="Grade Applied">{selectedApp.gradeApplied}</Descriptions.Item>
              <Descriptions.Item label="Programme Stream">{selectedApp.programmeStream ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Previous School">{selectedApp.previousSchool ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Academic Average">
                {selectedApp.previousAcademicAvg != null ? `${selectedApp.previousAcademicAvg}%` : '—'}
              </Descriptions.Item>
              {selectedApp.medicalConditions && (
                <Descriptions.Item label="Medical Conditions" span={2}>{selectedApp.medicalConditions}</Descriptions.Item>
              )}
            </Descriptions>

            {/* Supporting Documents (Issue 3) */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Paperclip size={14} />
                Supporting Documents
              </div>
              <div style={{ marginBottom: 8 }}>
                <FileUploader
                  entityType="admission"
                  entityId={selectedApp.id}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  description="Supporting document"
                  label="Upload Document (IC, Birth Cert, Report Card…)"
                />
              </div>
              <FileList entityType="admission" entityId={selectedApp.id} />
            </div>
          </div>
        )}
      </Modal>

      {/* Wizard Modal */}
      {wizardOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setWizardOpen(false) }}
        >
          <Card
            style={{ width: 620, maxHeight: '92vh', overflowY: 'auto', borderRadius: 12 }}
            title={
              <Space>
                <FileText size={16} />
                {t('admissions.newApplication')}
              </Space>
            }
            extra={<Button type="text" onClick={() => setWizardOpen(false)}>✕</Button>}
          >
            <Steps
              current={currentStep}
              size="small"
              style={{ marginBottom: 24 }}
              items={[
                { title: t('admissions.wizard.step1') },
                { title: t('admissions.wizard.step2') },
                { title: t('admissions.wizard.step3') },
                { title: t('admissions.wizard.step4') },
              ]}
            />

            {/* Step 1 — Applicant Info */}
            {currentStep === 0 && (
              <Form form={form1} layout="vertical">
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="applicantName" label={t('admissions.applicantName')} rules={[{ required: true }]}>
                      <Input placeholder="Ahmad Bin Abdullah" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="icNumber" label={t('admissions.icNumber')}>
                      <Input placeholder="01-456789" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="dateOfBirth" label={t('admissions.dateOfBirth')} rules={[{ required: true }]}>
                      <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="gender" label={t('students.gender')} rules={[{ required: true }]}>
                      <Select options={[{ value: 'MALE', label: t('students.male') }, { value: 'FEMALE', label: t('students.female') }]} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="nationality" label={t('admissions.nationality')} initialValue="Brunei" rules={[{ required: true }]}>
                  <Select options={[{ value: 'Brunei', label: 'Bruneian' }, { value: 'PR', label: 'Permanent Resident' }, { value: 'Foreign', label: 'Foreign National' }]} />
                </Form.Item>
              </Form>
            )}

            {/* Step 2 — Guardian Info */}
            {currentStep === 1 && (
              <Form form={form2} layout="vertical">
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="guardianName" label={t('admissions.parentName')} rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="guardianRelation" label={t('admissions.relationship')} initialValue="Mother">
                      <Select options={[
                        { value: 'Father', label: t('admissions.relationshipFather') },
                        { value: 'Mother', label: t('admissions.relationshipMother') },
                        { value: 'Guardian', label: t('admissions.relationshipGuardian') },
                      ]} />
                    </Form.Item>
                  </Col>
                </Row>
                {/* Issue 1 — Phone with country code selector */}
                <Form.Item label={t('admissions.parentPhone')} required style={{ marginBottom: 0 }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Select
                      value={countryCode}
                      onChange={(val) => { setCountryCode(val); form2.validateFields(['localPhone']).catch(() => {}) }}
                      options={COUNTRY_CODES}
                      style={{ width: 180 }}
                      popupMatchSelectWidth={false}
                    />
                    <Form.Item
                      name="localPhone"
                      noStyle
                      rules={[
                        { required: true, message: 'Phone number is required' },
                        { validator: phoneValidator(countryCode) },
                      ]}
                    >
                      <Input
                        placeholder={countryCode === '+673' ? '8123456' : '612345678'}
                        style={{ flex: 1 }}
                      />
                    </Form.Item>
                  </Space.Compact>
                </Form.Item>
                <div style={{ marginBottom: 12, marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {countryCode === '+673'
                      ? 'Brunei format: 8 or 9 followed by 6 digits (e.g. 8123456)'
                      : 'Enter local number without country code, 6–12 digits'}
                  </Text>
                </div>

                <Form.Item name="guardianEmail" label={t('admissions.parentEmail')} rules={[{ type: 'email' }]}>
                  <Input placeholder="email@example.com" />
                </Form.Item>

                {/* Issue 2 — Sibling from enrolled children */}
                <Divider>{t('parentPortal.siblingCheck', { defaultValue: 'Sibling Already Enrolled?' })}</Divider>
                {enrolledChildren.length > 0 ? (
                  <>
                    <Form.Item name="siblingChildId" label={t('admissions.siblingName')}>
                      <Select
                        allowClear
                        placeholder="Select an enrolled sibling"
                        loading={siblingLoading}
                        onChange={(val: string | undefined) => {
                          if (!val) { setSiblingLookup(null); form2.setFieldValue('siblingName', undefined); return }
                          void handleSiblingSelect(val)
                        }}
                        options={enrolledChildren.map((c) => ({
                          value: c.id,
                          label: `${c.displayName}${c.gradeLevel ? ` — ${c.gradeLevel}${c.classSection ? ` (${c.classSection})` : ''}` : ''}`,
                        }))}
                      />
                    </Form.Item>
                    {siblingLookup?.matched && (
                      <Alert
                        type="success"
                        showIcon
                        message={t('admissions.siblingPriorityEligible', { name: siblingLookup.siblingName, class: siblingLookup.siblingClass })}
                        style={{ marginBottom: 8 }}
                      />
                    )}
                    {siblingLookup && !siblingLookup.matched && (
                      <Alert type="info" showIcon message="Sibling found but not confirmed as enrolled in the system." style={{ marginBottom: 8 }} />
                    )}
                  </>
                ) : (
                  <Alert type="info" showIcon message="No enrolled children found under this account." style={{ marginBottom: 8 }} />
                )}
                <Form.Item name="siblingName" hidden><Input /></Form.Item>
                <Form.Item name="hasSiblingPriority" hidden><Input /></Form.Item>
                <Form.Item name="siblingStudentId" hidden><Input /></Form.Item>
              </Form>
            )}

            {/* Step 3 — Academic Background */}
            {currentStep === 2 && (
              <Form form={form3} layout="vertical">
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="gradeApplied" label={t('admissions.gradeApplied')} rules={[{ required: true }]}>
                      <Select options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="programmeStream" label={t('admissions.programmeStream')}>
                      <Select options={[
                        { value: 'Academic', label: t('admissions.streamAcademic') },
                        { value: 'Vocational', label: t('admissions.streamVocational') },
                        { value: 'Religious', label: t('admissions.streamReligious') },
                      ]} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="previousSchool" label={t('admissions.previousSchool')}>
                  <Input placeholder="Sekolah Rendah Berakas" />
                </Form.Item>
                <Form.Item name="previousAcademicAvg" label={t('admissions.previousAcademicAvg')}>
                  <Input type="number" min={0} max={100} placeholder="75" />
                </Form.Item>
                <Form.Item name="medicalConditions" label={t('admissions.medicalConditions')}>
                  <Input.TextArea rows={2} placeholder="Mild asthma..." />
                </Form.Item>
                <Form.Item name="documentsComplete" initialValue={true} hidden><Input /></Form.Item>
              </Form>
            )}

            {/* Step 4 — Review & Submit (Issue 4: full info display) */}
            {currentStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Alert
                  type="info"
                  showIcon
                  message={t('parentPortal.reviewConfirm', { defaultValue: 'Please review your application before submitting.' })}
                />
                <Descriptions bordered column={2} size="small" title="Applicant Information">
                  <Descriptions.Item label={t('admissions.applicantName')}>
                    {String(reviewData.applicantName ?? '—')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admissions.icNumber')}>
                    {String(reviewData.icNumber ?? '—')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admissions.dateOfBirth')}>
                    {reviewData.dateOfBirth
                      ? dayjs(reviewData.dateOfBirth as dayjs.Dayjs).format('DD/MM/YYYY')
                      : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('students.gender')}>
                    {reviewData.gender === 'MALE' ? t('students.male') : reviewData.gender === 'FEMALE' ? t('students.female') : String(reviewData.gender ?? '—')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admissions.nationality')} span={2}>
                    {String(reviewData.nationality ?? '—')}
                  </Descriptions.Item>
                </Descriptions>

                <Descriptions bordered column={2} size="small" title="Guardian Information">
                  <Descriptions.Item label={t('admissions.parentName')}>
                    {String(reviewData.guardianName ?? '—')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admissions.relationship')}>
                    {String(reviewData.guardianRelation ?? '—')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admissions.parentPhone')}>
                    {String(reviewData.guardianPhone ?? '—')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admissions.parentEmail')}>
                    {String(reviewData.guardianEmail ?? '—')}
                  </Descriptions.Item>
                  {siblingLookup?.matched && (
                    <Descriptions.Item label="Sibling Priority" span={2}>
                      <span style={{ color: '#52c41a', fontWeight: 500 }}>
                        {siblingLookup.siblingName} — {siblingLookup.siblingClass}
                      </span>
                    </Descriptions.Item>
                  )}
                </Descriptions>

                <Descriptions bordered column={2} size="small" title="Academic Background">
                  <Descriptions.Item label={t('admissions.gradeApplied')}>
                    {String(reviewData.gradeApplied ?? '—')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admissions.programmeStream')}>
                    {String(reviewData.programmeStream ?? '—')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admissions.previousSchool')}>
                    {String(reviewData.previousSchool ?? '—')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('admissions.previousAcademicAvg')}>
                    {reviewData.previousAcademicAvg != null ? `${String(reviewData.previousAcademicAvg)}%` : '—'}
                  </Descriptions.Item>
                  {reviewData.medicalConditions && (
                    <Descriptions.Item label={t('admissions.medicalConditions')} span={2}>
                      {String(reviewData.medicalConditions)}
                    </Descriptions.Item>
                  )}
                </Descriptions>

                <Alert
                  type="warning"
                  showIcon
                  message="Supporting documents (IC, birth certificate, report card) can be uploaded after submission from the application detail page."
                />
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <Button onClick={() => currentStep === 0 ? setWizardOpen(false) : setCurrentStep((s) => s - 1)}>
                {currentStep === 0 ? t('common.cancel') : t('common.back')}
              </Button>
              {currentStep < 3 ? (
                <Button type="primary" onClick={nextStep}>
                  {t('common.next')}
                </Button>
              ) : (
                <Button type="primary" onClick={handleSubmit} loading={submitMutation.isPending}>
                  {t('common.submit')} {t('admissions.newApplication')}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default ParentApplyPage
