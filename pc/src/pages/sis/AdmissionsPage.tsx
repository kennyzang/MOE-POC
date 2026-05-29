import { useState, useMemo, useRef } from 'react'
import {
  Table,
  Input,
  Select,
  Tag,
  Modal,
  Descriptions,
  Card,
  Space,
  Row,
  Col,
  Button,
  Statistic,
  message,
  Steps,
  Form,
  DatePicker,
  Alert,
  Progress,
  InputNumber,
  Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Plus,
  ArrowLeft,
  ArrowRight,
  Gavel,
} from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'
import type { Admission } from '../../types'

const STATUS_TAG_COLORS: Record<string, string> = {
  draft: 'default',
  pending: 'orange',
  submitted: 'orange',
  under_review: 'blue',
  offer_issued: 'cyan',
  offer_accepted: 'green',
  accepted: 'green',
  rejected: 'red',
  waitlisted: 'purple',
}

// Age-grade compatibility: [min, max] age for grade
const GRADE_AGE_RANGES: Record<string, { min: number; max: number }> = {
  'Year 7': { min: 11, max: 13 },
  'Year 8': { min: 12, max: 14 },
  'Year 9': { min: 13, max: 15 },
  'Year 10': { min: 14, max: 16 },
  'Year 11': { min: 15, max: 17 },
}

function calcAge(dob: dayjs.Dayjs): number {
  return dayjs().diff(dob, 'year')
}

// Generate a frontend-only reference ID for display in Step 4
function genRefId(): string {
  const num = Math.floor(Math.random() * 900) + 100
  return `ADM-2026-${num}`
}

interface SiblingLookupResult {
  matched: boolean
  siblingStudentId?: string
  siblingName?: string
  siblingClass?: string
}

interface WizardFormData {
  // Step 1 — Applicant Info
  applicantName: string
  icNumber?: string
  dateOfBirth?: dayjs.Dayjs
  gender: string
  nationality: string
  // Step 2 — Guardian Info
  parentName: string
  parentPhone: string
  parentEmail?: string
  parentRelationship?: string
  siblingName?: string
  hasSiblingPriority?: boolean
  siblingStudentId?: string
  siblingMatchedClass?: string
  // Step 3 — Academic Info
  gradeApplied: string
  previousSchool?: string
  programmeStream?: string
  medicalConditions?: string
  previousAcademicAvg?: number
}

function computeFrontendScore(data: Partial<WizardFormData>): number {
  const academic = data.previousAcademicAvg ?? 50
  const dob = data.dateOfBirth
  const gradeApplied = data.gradeApplied ?? ''
  const range = GRADE_AGE_RANGES[gradeApplied]
  let ageGradeMatch = false
  if (range && dob) {
    const age = calcAge(dob)
    ageGradeMatch = age >= range.min && age <= range.max
  }
  const sibling = data.hasSiblingPriority ? 100 : 0
  const docs = 60 // unknown at this stage — use 60 as default
  return Math.round(0.4 * academic + 0.3 * (ageGradeMatch ? 100 : 0) + 0.15 * sibling + 0.15 * docs)
}

function EligibilityProgressBar({ score }: { score?: number }) {
  if (score === undefined || score === null) return <span>-</span>
  const color = score >= 80 ? '#52c41a' : score >= 60 ? '#fa8c16' : '#f5222d'
  return (
    <Space direction="vertical" size={0} style={{ width: 100 }}>
      <Progress
        percent={score}
        size="small"
        strokeColor={color}
        format={(p) => `${p}`}
        style={{ margin: 0 }}
      />
    </Space>
  )
}

const AdmissionsPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // List state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Review modal state
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [actionType, setActionType] = useState<'accepted' | 'rejected' | null>(null)
  const [remarks, setRemarks] = useState('')

  // Decide modal state
  const [decideOpen, setDecideOpen] = useState(false)
  const [decideDecision, setDecideDecision] = useState<string>('')
  const [decideNotes, setDecideNotes] = useState('')

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [refId] = useState(genRefId)
  const [wizardData, setWizardData] = useState<Partial<WizardFormData>>({
    nationality: 'Bruneian',
  })
  const [ageMismatch, setAgeMismatch] = useState<string | null>(null)
  const [siblingLookup, setSiblingLookup] = useState<SiblingLookupResult | null>(null)
  const [siblingLookupLoading, setSiblingLookupLoading] = useState(false)
  const siblingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form1] = Form.useForm()
  const [form2] = Form.useForm()
  const [form3] = Form.useForm()

  const { data: admissions = [], isLoading } = useQuery({
    queryKey: ['admissions', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await api.get(`/admissions?${params}`)
      return data.data as Admission[]
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string
      body: { status: string; remarks: string }
    }) => {
      const { data } = await api.patch(`/admissions/${id}/status`, body)
      return data
    },
    onSuccess: () => {
      message.success(t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
      setActionType(null)
      setRemarks('')
      setDetailOpen(false)
      setSelectedAdmission(null)
    },
    onError: () => {
      message.error(t('common.error'))
    },
  })

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post('/admissions/applications', body)
      return data
    },
    onSuccess: (data) => {
      const score = data?.data?.eligibilityScore
      if (score !== undefined) {
        message.success(
          t('admissions.submitSuccessScore', {
            score,
            defaultValue: `Application submitted. Eligibility Score: ${score}`,
          })
        )
      } else {
        message.success(t('admissions.wizard.submitSuccess'))
      }
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
      handleCloseWizard()
    },
    onError: () => {
      message.error(t('common.error'))
    },
  })

  const decideMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      notes,
    }: {
      id: string
      decision: string
      notes?: string
    }) => {
      const { data } = await api.post(`/admissions/applications/${id}/decide`, {
        decision,
        notes,
      })
      return data
    },
    onSuccess: () => {
      message.success(t('admissions.decideSuccess', { defaultValue: 'Decision recorded successfully' }))
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
      setDecideOpen(false)
      setDecideDecision('')
      setDecideNotes('')
      setDetailOpen(false)
      setSelectedAdmission(null)
    },
    onError: () => {
      message.error(t('common.error'))
    },
  })

  // Compute stats from data
  const totalCount = admissions.length
  const pendingCount = admissions.filter(
    (a) => a.status === 'pending' || a.status === 'submitted' || a.status === 'under_review'
  ).length
  const acceptedCount = admissions.filter(
    (a) => a.status === 'accepted' || a.status === 'offer_issued' || a.status === 'offer_accepted'
  ).length
  const rejectedCount = admissions.filter((a) => a.status === 'rejected').length

  const handleReview = (admission: Admission) => {
    setSelectedAdmission(admission)
    setDetailOpen(true)
    setActionType(null)
    setRemarks('')
  }

  const handleConfirmAction = () => {
    if (!selectedAdmission || !actionType) return
    updateMutation.mutate({
      id: selectedAdmission.id,
      body: { status: actionType, remarks },
    })
  }

  const handleOpenDecide = () => {
    setDecideDecision('')
    setDecideNotes('')
    setDecideOpen(true)
  }

  const handleConfirmDecide = () => {
    if (!selectedAdmission || !decideDecision) return
    decideMutation.mutate({
      id: selectedAdmission.id,
      decision: decideDecision,
      notes: decideNotes,
    })
  }

  const statusLabel = (val: string) => {
    const keyMap: Record<string, string> = {
      draft: 'admissions.statusDraft',
      pending: 'admissions.statusPending',
      submitted: 'admissions.statusSubmitted',
      under_review: 'admissions.statusUnderReview',
      offer_issued: 'admissions.statusOfferIssued',
      offer_accepted: 'admissions.statusOfferAccepted',
      accepted: 'admissions.statusAccepted',
      rejected: 'admissions.statusRejected',
      waitlisted: 'admissions.statusWaitlisted',
    }
    return t(keyMap[val] ?? val)
  }

  // Wizard helpers
  const handleOpenWizard = () => {
    setCurrentStep(0)
    setWizardData({ nationality: 'Bruneian' })
    setAgeMismatch(null)
    setSiblingLookup(null)
    form1.resetFields()
    form2.resetFields()
    form3.resetFields()
    setWizardOpen(true)
  }

  const handleCloseWizard = () => {
    setWizardOpen(false)
    setCurrentStep(0)
    setWizardData({ nationality: 'Bruneian' })
    setAgeMismatch(null)
    setSiblingLookup(null)
    form1.resetFields()
    form2.resetFields()
    form3.resetFields()
  }

  const checkAgeMismatch = (grade: string, dob: dayjs.Dayjs | undefined) => {
    if (!grade || !dob) {
      setAgeMismatch(null)
      return
    }
    const range = GRADE_AGE_RANGES[grade]
    if (!range) {
      setAgeMismatch(null)
      return
    }
    const age = calcAge(dob)
    if (age < range.min || age > range.max) {
      setAgeMismatch(
        t('admissions.wizard.ageMismatch', {
          age,
          grade,
          min: range.min,
          max: range.max,
        })
      )
    } else {
      setAgeMismatch(null)
    }
  }

  // Debounced sibling lookup
  const handleSiblingNameChange = (value: string) => {
    if (siblingDebounceRef.current) clearTimeout(siblingDebounceRef.current)
    if (!value || value.trim().length < 2) {
      setSiblingLookup(null)
      setWizardData((prev) => ({
        ...prev,
        hasSiblingPriority: false,
        siblingStudentId: undefined,
        siblingMatchedClass: undefined,
      }))
      return
    }
    siblingDebounceRef.current = setTimeout(async () => {
      setSiblingLookupLoading(true)
      try {
        const { data } = await api.get(
          `/admissions/sibling-lookup?name=${encodeURIComponent(value.trim())}`
        )
        const result: SiblingLookupResult = data.data
        setSiblingLookup(result)
        if (result.matched) {
          setWizardData((prev) => ({
            ...prev,
            hasSiblingPriority: true,
            siblingStudentId: result.siblingStudentId,
            siblingMatchedClass: result.siblingClass,
          }))
        } else {
          setWizardData((prev) => ({
            ...prev,
            hasSiblingPriority: false,
            siblingStudentId: undefined,
            siblingMatchedClass: undefined,
          }))
        }
      } catch {
        setSiblingLookup(null)
      } finally {
        setSiblingLookupLoading(false)
      }
    }, 500)
  }

  const handleNextStep = async () => {
    if (currentStep === 0) {
      try {
        const values = await form1.validateFields()
        setWizardData((prev) => ({ ...prev, ...values }))
        setCurrentStep(1)
      } catch {
        // validation failed, stay on step
      }
    } else if (currentStep === 1) {
      try {
        const values = await form2.validateFields()
        setWizardData((prev) => ({ ...prev, ...values }))
        setCurrentStep(2)
      } catch {
        // validation failed
      }
    } else if (currentStep === 2) {
      try {
        const values = await form3.validateFields()
        setWizardData((prev) => ({ ...prev, ...values }))
        // check age/grade mismatch with stored dob
        const dob = wizardData.dateOfBirth ?? form1.getFieldValue('dateOfBirth')
        checkAgeMismatch(values.gradeApplied, dob)
        setCurrentStep(3)
      } catch {
        // validation failed
      }
    }
  }

  const handlePrevStep = () => {
    setCurrentStep((s) => Math.max(0, s - 1))
  }

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      applicantName: wizardData.applicantName,
      icNumber: wizardData.icNumber,
      dateOfBirth: wizardData.dateOfBirth
        ? wizardData.dateOfBirth.toISOString()
        : undefined,
      gender: wizardData.gender,
      nationality: wizardData.nationality,
      guardianName: wizardData.parentName,
      guardianPhone: wizardData.parentPhone,
      guardianEmail: wizardData.parentEmail,
      guardianRelation: wizardData.parentRelationship,
      siblingName: wizardData.siblingName,
      siblingStudentId: wizardData.siblingStudentId,
      hasSiblingPriority: wizardData.hasSiblingPriority ?? false,
      gradeApplied: wizardData.gradeApplied,
      previousSchool: wizardData.previousSchool,
      programmeStream: wizardData.programmeStream,
      medicalConditions: wizardData.medicalConditions,
      previousAcademicAvg: wizardData.previousAcademicAvg,
      documentsComplete: false,
    }
    createMutation.mutate(payload)
  }

  // Merged wizard data for review step (step 4)
  const reviewData = useMemo(() => wizardData, [wizardData])
  const estimatedScore = useMemo(() => computeFrontendScore(wizardData), [wizardData])

  const gradeOptions = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'].map(
    (g) => ({ label: g, value: g })
  )

  const relationshipOptions = [
    { label: t('admissions.relationshipFather'), value: 'father' },
    { label: t('admissions.relationshipMother'), value: 'mother' },
    { label: t('admissions.relationshipGuardian'), value: 'guardian' },
  ]

  const programmeStreamOptions = [
    { label: t('admissions.streamAcademic', { defaultValue: 'Academic' }), value: 'academic' },
    { label: t('admissions.streamVocational', { defaultValue: 'Vocational' }), value: 'vocational' },
    { label: t('admissions.streamReligious', { defaultValue: 'Religious' }), value: 'religious' },
  ]

  const columns: ColumnsType<Admission> = [
    {
      title: t('admissions.applicantName'),
      dataIndex: 'applicantName',
      key: 'applicantName',
    },
    {
      title: t('students.gender'),
      dataIndex: 'gender',
      key: 'gender',
      width: 100,
      render: (val: string) =>
        val === 'male'
          ? t('students.male')
          : val === 'female'
            ? t('students.female')
            : val ?? '-',
    },
    {
      title: t('admissions.gradeApplied'),
      dataIndex: 'gradeApplied',
      key: 'gradeApplied',
      width: 130,
    },
    {
      title: t('admissions.previousSchool'),
      dataIndex: 'previousSchool',
      key: 'previousSchool',
    },
    {
      title: t('admissions.eligibilityScore', { defaultValue: 'Eligibility Score' }),
      dataIndex: 'eligibilityScore',
      key: 'eligibilityScore',
      width: 150,
      render: (val: number | undefined) => <EligibilityProgressBar score={val} />,
    },
    {
      title: t('admissions.submittedAt'),
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 140,
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : '-'),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (val: string) => (
        <Tag color={STATUS_TAG_COLORS[val] ?? 'default'}>{statusLabel(val)}</Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<Eye size={16} />}
          onClick={() => handleReview(record)}
        >
          {t('admissions.review')}
        </Button>
      ),
    },
  ]

  const canDecide = selectedAdmission?.status === 'pending' ||
    selectedAdmission?.status === 'submitted' ||
    selectedAdmission?.status === 'under_review'

  const wizardSteps = [
    { title: t('admissions.wizard.step1') },
    { title: t('admissions.wizard.step2') },
    { title: t('admissions.wizard.step3') },
    { title: t('admissions.wizard.step4') },
  ]

  // Score card row helper
  const scoreCardItems = useMemo(() => {
    const academic = reviewData.previousAcademicAvg ?? 50
    const dob = reviewData.dateOfBirth
    const grade = reviewData.gradeApplied ?? ''
    const range = GRADE_AGE_RANGES[grade]
    let ageGradeMatch = false
    if (range && dob) {
      const age = calcAge(dob)
      ageGradeMatch = age >= range.min && age <= range.max
    }
    const sibling = reviewData.hasSiblingPriority ?? false
    return { academic, ageGradeMatch, sibling }
  }, [reviewData])

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <ClipboardList size={22} />
            <Card.Meta
              title={
                <span style={{ fontSize: 20, fontWeight: 600 }}>
                  {t('admissions.title')}
                </span>
              }
            />
          </Space>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleOpenWizard}
          >
            {t('admissions.newApplication')}
          </Button>
        </Col>
      </Row>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title={t('admissions.totalApplications')} value={totalCount} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('admissions.pendingReview')}
              value={pendingCount}
              styles={{ content: { color: '#fa8c16' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('admissions.accepted')}
              value={acceptedCount}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('admissions.rejected')}
              value={rejectedCount}
              styles={{ content: { color: '#f5222d' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <Input.Search
              placeholder={t('common.search')}
              prefix={<Search size={14} />}
              allowClear
              onSearch={(val) => setSearch(val)}
              onChange={(e) => {
                if (!e.target.value) setSearch('')
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t('admissions.allStatus')}
              allowClear
              style={{ width: '100%' }}
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val ?? '')}
              options={[
                { label: t('admissions.statusDraft', { defaultValue: 'Draft' }), value: 'draft' },
                { label: t('admissions.statusPending'), value: 'pending' },
                { label: t('admissions.statusSubmitted', { defaultValue: 'Submitted' }), value: 'submitted' },
                { label: t('admissions.statusUnderReview'), value: 'under_review' },
                { label: t('admissions.statusOfferIssued', { defaultValue: 'Offer Issued' }), value: 'offer_issued' },
                { label: t('admissions.statusOfferAccepted', { defaultValue: 'Offer Accepted' }), value: 'offer_accepted' },
                { label: t('admissions.statusAccepted'), value: 'accepted' },
                { label: t('admissions.statusRejected'), value: 'rejected' },
                { label: t('admissions.statusWaitlisted', { defaultValue: 'Waitlisted' }), value: 'waitlisted' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table<Admission>
          rowKey="id"
          columns={columns}
          dataSource={admissions}
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${t('common.total')}: ${total}`,
          }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>

      {/* Review Modal */}
      <Modal
        title={t('admissions.reviewApplication')}
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false)
          setActionType(null)
          setRemarks('')
        }}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {selectedAdmission && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label={t('admissions.applicantName')}>
                {selectedAdmission.applicantName}
              </Descriptions.Item>
              <Descriptions.Item label={t('students.dateOfBirth')}>
                {selectedAdmission.dateOfBirth
                  ? new Date(selectedAdmission.dateOfBirth).toLocaleDateString()
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('students.gender')}>
                {selectedAdmission.gender === 'male'
                  ? t('students.male')
                  : selectedAdmission.gender === 'female'
                    ? t('students.female')
                    : selectedAdmission.gender ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('students.nationality')}>
                {selectedAdmission.nationality ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.parentName')}>
                {selectedAdmission.parentName ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.parentPhone')}>
                {selectedAdmission.parentPhone ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.parentEmail')} span={2}>
                {selectedAdmission.parentEmail ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.gradeApplied')}>
                {selectedAdmission.gradeApplied}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.previousSchool')}>
                {selectedAdmission.previousSchool ?? '-'}
              </Descriptions.Item>
              {selectedAdmission.programmeStream && (
                <Descriptions.Item label={t('admissions.programmeStream', { defaultValue: 'Programme Stream' })}>
                  {selectedAdmission.programmeStream}
                </Descriptions.Item>
              )}
              {selectedAdmission.previousAcademicAvg !== undefined && (
                <Descriptions.Item label={t('admissions.previousAcademicAvg', { defaultValue: 'Academic Average (%)' })}>
                  {selectedAdmission.previousAcademicAvg}%
                </Descriptions.Item>
              )}
              {selectedAdmission.hasSiblingPriority && (
                <Descriptions.Item
                  label={t('admissions.siblingName', { defaultValue: 'Sibling Priority' })}
                  span={2}
                >
                  <Badge
                    color="green"
                    text={`${selectedAdmission.siblingName ?? '-'}`}
                  />
                </Descriptions.Item>
              )}
              {selectedAdmission.medicalConditions && (
                <Descriptions.Item
                  label={t('admissions.medicalConditions', { defaultValue: 'Medical Conditions' })}
                  span={2}
                >
                  {selectedAdmission.medicalConditions}
                </Descriptions.Item>
              )}
              {selectedAdmission.eligibilityScore !== undefined && (
                <Descriptions.Item
                  label={t('admissions.eligibilityScore', { defaultValue: 'Eligibility Score' })}
                  span={2}
                >
                  <EligibilityProgressBar score={selectedAdmission.eligibilityScore} />
                </Descriptions.Item>
              )}
              <Descriptions.Item label={t('admissions.submittedAt')}>
                {selectedAdmission.submittedAt ? new Date(selectedAdmission.submittedAt).toLocaleDateString() : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={STATUS_TAG_COLORS[selectedAdmission.status] ?? 'default'}>
                  {statusLabel(selectedAdmission.status)}
                </Tag>
              </Descriptions.Item>
              {selectedAdmission.remarks && (
                <Descriptions.Item label={t('admissions.remarks')} span={2}>
                  {selectedAdmission.remarks}
                </Descriptions.Item>
              )}
              {selectedAdmission.decidedAt && (
                <Descriptions.Item label={t('admissions.decidedAt')} span={2}>
                  {new Date(selectedAdmission.decidedAt).toLocaleDateString()}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Decide button (new spec endpoint) */}
            {canDecide && !actionType && (
              <Space style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}>
                <Button
                  icon={<Gavel size={16} />}
                  onClick={handleOpenDecide}
                >
                  {t('admissions.decideAction', { defaultValue: 'Decide' })}
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircle size={16} />}
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                  onClick={() => setActionType('accepted')}
                >
                  {t('admissions.accept')}
                </Button>
                <Button
                  danger
                  icon={<XCircle size={16} />}
                  onClick={() => setActionType('rejected')}
                >
                  {t('admissions.reject')}
                </Button>
              </Space>
            )}

            {actionType && (
              <Card
                size="small"
                title={
                  actionType === 'accepted'
                    ? t('admissions.accept')
                    : t('admissions.reject')
                }
                style={{ marginTop: 16 }}
              >
                <Input.TextArea
                  rows={3}
                  placeholder={t('admissions.remarks')}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <Space>
                  <Button
                    type="primary"
                    loading={updateMutation.isPending}
                    onClick={handleConfirmAction}
                    danger={actionType === 'rejected'}
                  >
                    {t('common.confirm')}
                  </Button>
                  <Button onClick={() => setActionType(null)}>
                    {t('common.cancel')}
                  </Button>
                </Space>
              </Card>
            )}
          </div>
        )}
      </Modal>

      {/* Decide Modal */}
      <Modal
        title={t('admissions.decideTitle', { defaultValue: 'Application Decision' })}
        open={decideOpen}
        onCancel={() => {
          setDecideOpen(false)
          setDecideDecision('')
          setDecideNotes('')
        }}
        onOk={handleConfirmDecide}
        okButtonProps={{
          loading: decideMutation.isPending,
          disabled: !decideDecision,
        }}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item
            label={t('admissions.decideDecision', { defaultValue: 'Decision' })}
            required
          >
            <Select
              value={decideDecision || undefined}
              onChange={(val) => setDecideDecision(val)}
              options={[
                {
                  label: t('admissions.decideAccept', { defaultValue: 'Accept' }),
                  value: 'ACCEPT',
                },
                {
                  label: t('admissions.decideReject', { defaultValue: 'Reject' }),
                  value: 'REJECT',
                },
                {
                  label: t('admissions.decideWaitlist', { defaultValue: 'Waitlist' }),
                  value: 'WAITLIST',
                },
              ]}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label={t('admissions.decideNotes', { defaultValue: 'Notes' })}>
            <Input.TextArea
              rows={3}
              value={decideNotes}
              onChange={(e) => setDecideNotes(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* New Application Wizard Modal */}
      <Modal
        title={t('admissions.newApplication')}
        open={wizardOpen}
        onCancel={handleCloseWizard}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {/* Steps progress */}
        <Steps
          current={currentStep}
          items={wizardSteps}
          size="small"
          style={{ marginBottom: 32 }}
        />

        {/* Step 1: Applicant Information */}
        {currentStep === 0 && (
          <Form
            form={form1}
            layout="vertical"
            initialValues={{ nationality: 'Bruneian' }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="applicantName"
                  label={t('admissions.applicantName')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="icNumber" label={t('admissions.icNumber')}>
                  <Input placeholder="e.g. BN20100312" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="dateOfBirth"
                  label={t('admissions.dateOfBirth')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="gender"
                  label={t('students.gender')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Select
                    options={[
                      { label: t('students.male'), value: 'male' },
                      { label: t('students.female'), value: 'female' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="nationality" label={t('admissions.nationality')}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}

        {/* Step 2: Guardian Information (with sibling lookup) */}
        {currentStep === 1 && (
          <Form form={form2} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="parentName"
                  label={t('admissions.parentName')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="parentPhone"
                  label={t('admissions.parentPhone')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="parentEmail"
                  label={t('admissions.parentEmail')}
                  rules={[{ type: 'email', message: t('common.invalidEmail') }]}
                >
                  <Input type="email" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="parentRelationship"
                  label={t('admissions.relationship')}
                >
                  <Select options={relationshipOptions} allowClear />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="siblingName"
                  label={t('admissions.siblingName', { defaultValue: 'Sibling Name (if enrolled)' })}
                  extra={
                    siblingLookupLoading
                      ? t('common.loading')
                      : siblingLookup?.matched
                        ? undefined
                        : siblingLookup?.matched === false
                          ? undefined
                          : undefined
                  }
                >
                  <Input
                    onChange={(e) => handleSiblingNameChange(e.target.value)}
                    placeholder="e.g. Ahmad Bin Abdullah"
                  />
                </Form.Item>
                {siblingLookup?.matched && (
                  <div style={{ marginTop: -12, marginBottom: 12 }}>
                    <Badge
                      color="green"
                      text={
                        <span style={{ color: '#52c41a', fontWeight: 500 }}>
                          {t('admissions.siblingPriorityEligible', {
                            name: siblingLookup.siblingName,
                            class: siblingLookup.siblingClass,
                            defaultValue: `Sibling Priority eligible — ${siblingLookup.siblingName}, ${siblingLookup.siblingClass}`,
                          })}
                        </span>
                      }
                    />
                  </div>
                )}
              </Col>
            </Row>
          </Form>
        )}

        {/* Step 3: Academic Background */}
        {currentStep === 2 && (
          <Form form={form3} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="gradeApplied"
                  label={t('admissions.gradeApplied')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <Select
                    options={gradeOptions}
                    onChange={(val) => {
                      const dob = wizardData.dateOfBirth
                      checkAgeMismatch(val, dob)
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="previousSchool" label={t('admissions.previousSchool')}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="programmeStream"
                  label={t('admissions.programmeStream', { defaultValue: 'Programme Stream' })}
                >
                  <Select options={programmeStreamOptions} allowClear />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="previousAcademicAvg"
                  label={t('admissions.previousAcademicAvg', { defaultValue: 'Previous Academic Average (%)' })}
                >
                  <InputNumber min={0} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="medicalConditions"
                  label={t('admissions.medicalConditions', { defaultValue: 'Medical Conditions / Special Needs' })}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
              </Col>
            </Row>
            {ageMismatch && (
              <Alert
                type="warning"
                message={ageMismatch}
                showIcon
                style={{ marginTop: 8 }}
              />
            )}
          </Form>
        )}

        {/* Step 4: Review & Submit */}
        {currentStep === 3 && (
          <div>
            <Card
              size="small"
              title={t('admissions.wizard.applicationId')}
              style={{ marginBottom: 16 }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1677ff' }}>
                {refId}
              </span>
            </Card>

            <Descriptions
              bordered
              column={2}
              size="small"
              title={t('admissions.wizard.step1')}
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label={t('admissions.applicantName')}>
                {reviewData.applicantName ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.icNumber')}>
                {reviewData.icNumber ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.dateOfBirth')}>
                {reviewData.dateOfBirth
                  ? reviewData.dateOfBirth.format('YYYY-MM-DD')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('students.gender')}>
                {reviewData.gender === 'male'
                  ? t('students.male')
                  : reviewData.gender === 'female'
                    ? t('students.female')
                    : reviewData.gender ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.nationality')}>
                {reviewData.nationality ?? '-'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              bordered
              column={2}
              size="small"
              title={t('admissions.wizard.step2')}
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label={t('admissions.parentName')}>
                {reviewData.parentName ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.parentPhone')}>
                {reviewData.parentPhone ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.parentEmail')}>
                {reviewData.parentEmail ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.relationship')}>
                {reviewData.parentRelationship
                  ? t(
                      `admissions.relationship${reviewData.parentRelationship.charAt(0).toUpperCase() + reviewData.parentRelationship.slice(1)}`
                    )
                  : '-'}
              </Descriptions.Item>
              {reviewData.hasSiblingPriority && (
                <Descriptions.Item
                  label={t('admissions.siblingName', { defaultValue: 'Sibling Priority' })}
                  span={2}
                >
                  <Badge
                    color="green"
                    text={`${reviewData.siblingName ?? '-'} — ${reviewData.siblingMatchedClass ?? ''}`}
                  />
                </Descriptions.Item>
              )}
            </Descriptions>

            <Descriptions
              bordered
              column={2}
              size="small"
              title={t('admissions.wizard.step3')}
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label={t('admissions.gradeApplied')}>
                {reviewData.gradeApplied ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.previousSchool')}>
                {reviewData.previousSchool ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.programmeStream', { defaultValue: 'Programme Stream' })}>
                {reviewData.programmeStream ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.previousAcademicAvg', { defaultValue: 'Academic Average (%)' })}>
                {reviewData.previousAcademicAvg !== undefined
                  ? `${reviewData.previousAcademicAvg}%`
                  : '-'}
              </Descriptions.Item>
              {reviewData.medicalConditions && (
                <Descriptions.Item
                  label={t('admissions.medicalConditions', { defaultValue: 'Medical Conditions' })}
                  span={2}
                >
                  {reviewData.medicalConditions}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Eligibility Score Preview Card */}
            <Card
              size="small"
              title={t('admissions.scoreCard', { defaultValue: 'Eligibility Score Preview' })}
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[12, 8]}>
                <Col span={12}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <span style={{ fontSize: 12, color: '#888' }}>
                      {t('admissions.scoreAcademicAvg', { defaultValue: 'Academic Average' })}
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {scoreCardItems.academic}%
                    </span>
                  </Space>
                </Col>
                <Col span={12}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <span style={{ fontSize: 12, color: '#888' }}>
                      {t('admissions.scoreAgeGradeMatch', { defaultValue: 'Age-Grade Match' })}
                    </span>
                    <Tag color={scoreCardItems.ageGradeMatch ? 'green' : 'orange'}>
                      {scoreCardItems.ageGradeMatch ? 'Y' : 'N'}
                    </Tag>
                  </Space>
                </Col>
                <Col span={12}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <span style={{ fontSize: 12, color: '#888' }}>
                      {t('admissions.scoreSiblingPriority', { defaultValue: 'Sibling Priority' })}
                    </span>
                    <Tag color={scoreCardItems.sibling ? 'green' : 'default'}>
                      {scoreCardItems.sibling ? 'Y' : 'N'}
                    </Tag>
                  </Space>
                </Col>
                <Col span={12}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <span style={{ fontSize: 12, color: '#888' }}>
                      {t('admissions.scoreDocsComplete', { defaultValue: 'Documents Complete' })}
                    </span>
                    <Tag color="default">N</Tag>
                  </Space>
                </Col>
              </Row>
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 0',
                  borderTop: '1px solid #f0f0f0',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color:
                      estimatedScore >= 80
                        ? '#52c41a'
                        : estimatedScore >= 60
                          ? '#fa8c16'
                          : '#f5222d',
                  }}
                >
                  {t('admissions.scoreEstimated', {
                    score: estimatedScore,
                    defaultValue: `Estimated Score: ${estimatedScore}/100`,
                  })}
                </span>
              </div>
            </Card>

            {ageMismatch && (
              <Alert
                type="warning"
                message={ageMismatch}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
          </div>
        )}

        {/* Wizard footer buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 24,
            borderTop: '1px solid #f0f0f0',
            paddingTop: 16,
          }}
        >
          <Button
            icon={<ArrowLeft size={16} />}
            onClick={handlePrevStep}
            disabled={currentStep === 0}
          >
            {t('common.previous')}
          </Button>

          {currentStep < 3 ? (
            <Button
              type="primary"
              icon={<ArrowRight size={16} />}
              iconPosition="end"
              onClick={handleNextStep}
            >
              {t('common.next')}
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircle size={16} />}
              loading={createMutation.isPending}
              onClick={handleSubmit}
            >
              {t('common.submit')}
            </Button>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default AdmissionsPage
