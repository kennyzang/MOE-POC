import { useState, useRef } from 'react'
import {
  Card, Button, Steps, Form, Input, Select, DatePicker, Tag, Table, Space,
  Typography, Row, Col, Statistic, message, Alert, Divider,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, FileText } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import api from '@/lib/api'

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

interface SiblingResult { matched: boolean; siblingStudentId?: string; siblingName?: string; siblingClass?: string }

const ParentApplyPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [form1] = Form.useForm()
  const [form2] = Form.useForm()
  const [form3] = Form.useForm()
  const [siblingLookup, setSiblingLookup] = useState<SiblingResult | null>(null)
  const [siblingLoading, setSiblingLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [wizardData, setWizardData] = useState<Record<string, unknown>>({})
  const [submittedApp, setSubmittedApp] = useState<Application | null>(null)

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['parent-applications'],
    queryFn: async () => {
      const { data } = await api.get('/parent/applications')
      return data.data as Application[]
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
    },
  })

  const handleSiblingSearch = (name: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!name || name.length < 2) { setSiblingLookup(null); return }
    debounceRef.current = setTimeout(async () => {
      setSiblingLoading(true)
      try {
        const { data } = await api.get(`/admissions/sibling-lookup?name=${encodeURIComponent(name)}`)
        setSiblingLookup(data.data as SiblingResult)
        if ((data.data as SiblingResult).matched) {
          form2.setFieldValue('hasSiblingPriority', true)
          form2.setFieldValue('siblingStudentId', (data.data as SiblingResult).siblingStudentId)
        }
      } catch { /* ignore */ }
      setSiblingLoading(false)
    }, 400)
  }

  const nextStep = async () => {
    const forms = [form1, form2, form3]
    if (currentStep < 3) {
      try {
        const values = await forms[currentStep].validateFields()
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
  ]

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => ['submitted', 'under_review'].includes(a.status)).length,
    offers: applications.filter((a) => ['offer_issued', 'offer_accepted'].includes(a.status)).length,
  }

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
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setWizardOpen(true)}
          >
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

      {/* Applications table */}
      <Card>
        <Table
          columns={columns}
          dataSource={applications}
          rowKey="id"
          loading={isLoading}
          locale={{ emptyText: t('parentPortal.noApplications', { defaultValue: 'No applications yet. Click "New Application" to get started.' }) }}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* Wizard Drawer */}
      {wizardOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setWizardOpen(false) }}
        >
          <Card
            style={{ width: 600, maxHeight: '90vh', overflowY: 'auto', borderRadius: 12 }}
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
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="guardianPhone" label={t('admissions.parentPhone')}
                      rules={[{ required: true }, { pattern: /^\+673\s?[8-9]\d{6}$/, message: 'Must be +673 format' }]}>
                      <Input placeholder="+673 8123 4567" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="guardianEmail" label={t('admissions.parentEmail')} rules={[{ type: 'email' }]}>
                      <Input placeholder="email@example.com" />
                    </Form.Item>
                  </Col>
                </Row>
                <Divider>{t('parentPortal.siblingCheck', { defaultValue: 'Sibling Already Enrolled?' })}</Divider>
                <Form.Item name="siblingName" label={t('admissions.siblingName')}>
                  <Input
                    placeholder="Hafiz Bin Abdullah"
                    onChange={(e) => handleSiblingSearch(e.target.value)}
                  />
                </Form.Item>
                {siblingLoading && <Text type="secondary">Searching...</Text>}
                {siblingLookup?.matched && (
                  <Alert
                    type="success"
                    showIcon
                    message={t('admissions.siblingPriorityEligible', { name: siblingLookup.siblingName, class: siblingLookup.siblingClass })}
                    style={{ marginBottom: 8 }}
                  />
                )}
                {siblingLookup && !siblingLookup.matched && (
                  <Alert type="info" showIcon message="No enrolled sibling found with that name." style={{ marginBottom: 8 }} />
                )}
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

            {/* Step 4 — Review & Submit */}
            {currentStep === 3 && (
              <div>
                <Alert
                  type="info"
                  showIcon
                  message={t('parentPortal.reviewConfirm', { defaultValue: 'Please review your application before submitting.' })}
                  style={{ marginBottom: 16 }}
                />
                <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, fontSize: 13 }}>
                  <div><strong>{t('admissions.applicantName')}:</strong> {String(wizardData.applicantName ?? '')}</div>
                  <div><strong>{t('admissions.gradeApplied')}:</strong> {String(wizardData.gradeApplied ?? '')}</div>
                  <div><strong>{t('admissions.parentName')}:</strong> {String(wizardData.guardianName ?? '')}</div>
                  {siblingLookup?.matched && (
                    <div style={{ color: '#52c41a', marginTop: 4 }}>
                      <strong>Sibling Priority:</strong> {siblingLookup.siblingName} ({siblingLookup.siblingClass})
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <Button
                onClick={() => currentStep === 0 ? setWizardOpen(false) : setCurrentStep((s) => s - 1)}
              >
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
