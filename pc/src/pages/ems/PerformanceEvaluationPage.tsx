import { useState, useRef } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Typography,
  Descriptions,
  message,
  Tabs,
  List,
  Alert,
  Spin,
  Tooltip,
  Steps,
  Divider,
  Upload,
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck, Plus, Eye, CheckCircle, XCircle,
  TrendingUp, TrendingDown, Minus, Paperclip, History, BookOpen,
  Send, FileText, Star, UserCheck,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer,
} from 'recharts'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { PerformanceEvaluation, Teacher, ApiResponse } from '../../types'
import type { ColumnsType } from 'antd/es/table'

const { TextArea } = Input
const { Title, Text } = Typography

// ─── Helpers ─────────────────────────────────────────────────────

function ratingColor(rating: string | undefined): string {
  const map: Record<string, string> = {
    Excellent: 'green', Good: 'blue', Satisfactory: 'orange', NeedsImprovement: 'red',
  }
  return map[rating ?? ''] ?? 'default'
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending_self_assessment: 'gold',
    self_assessment_submitted: 'cyan',
    draft: 'default',
    submitted: 'blue',
    approved: 'green',
    rejected: 'red',
  }
  return map[status] ?? 'default'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_self_assessment: 'Awaiting Self-Assessment',
    self_assessment_submitted: 'Self-Assessment Done',
    draft: 'Draft',
    submitted: 'Submitted for Review',
    approved: 'Approved',
    rejected: 'Rejected',
  }
  return map[status] ?? status
}

function workflowStep(status: string): number {
  const steps: Record<string, number> = {
    pending_self_assessment: 0,
    self_assessment_submitted: 1,
    draft: 1,
    submitted: 2,
    approved: 3,
    rejected: 3,
  }
  return steps[status] ?? 0
}

interface FileAttachment {
  id: string
  originalName: string
  mimeType: string
  size: number
  description: string | null
  createdAt: string
  downloadUrl: string
}

interface EvalHistory {
  evaluations: Array<{
    id: string; academicYear: string; overallScore: number | null
    rating: string | null; status: string; submittedAt: string | null
    teachingScore: number | null; professionalScore: number | null; conductScore: number | null
  }>
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data'
}

interface Workshop {
  id: string; title: string; provider: string | null; subject: string | null
  hours: number; startDate: string; endDate: string; location: string | null
  category: string; enrolledCount: number; maxParticipants: number
  alreadyEnrolled: boolean; recommendationReason?: string
}

// ─── Component ────────────────────────────────────────────────────

const PerformanceEvaluationPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [newModalOpen, setNewModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [hodScoreModalOpen, setHodScoreModalOpen] = useState(false)
  const [evalTab, setEvalTab] = useState<'active' | 'history'>('active')
  const [selectedEval, setSelectedEval] = useState<PerformanceEvaluation | null>(null)
  const [historyTeacherId, setHistoryTeacherId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const evidenceInputRef = useRef<HTMLInputElement>(null)

  // Self-assessment form state (teacher)
  const [selfText, setSelfText] = useState('')
  const [selfTeaching, setSelfTeaching] = useState<number | null>(null)
  const [selfProfessional, setSelfProfessional] = useState<number | null>(null)
  const [selfConduct, setSelfConduct] = useState<number | null>(null)

  const [form] = Form.useForm()
  const [reviewForm] = Form.useForm()
  const [hodForm] = Form.useForm()

  const role = user?.role ?? ''
  const isHOD = ['hod', 'admin', 'manager'].includes(role)
  const isPrincipal = ['principal', 'admin'].includes(role)
  const isTeacher = role === 'teacher'

  // ─── Queries ────────────────────────────────────────────────────

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ['performance-evaluations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PerformanceEvaluation[]>>('/ems/performance-evaluations')
      return res.data.data
    },
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Teacher[]>>('/teachers')
      return res.data.data
    },
    enabled: isHOD,
  })

  const { data: attachments = [], refetch: refetchAttachments } = useQuery<FileAttachment[]>({
    queryKey: ['eval-attachments', selectedEval?.id],
    queryFn: async () => {
      const res = await api.get(`/files?entityType=performance_evaluation&entityId=${selectedEval!.id}`)
      return res.data.data
    },
    enabled: detailModalOpen && !!selectedEval?.id,
  })

  const { data: recommendations = [] } = useQuery<Workshop[]>({
    queryKey: ['eval-recommendations', selectedEval?.id],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedEval?.teacherId) params.set('teacherId', selectedEval.teacherId)
      if (selectedEval?.id) params.set('basedOn', selectedEval.id)
      const res = await api.get(`/ems/cpd-workshops/recommendations?${params}`)
      return res.data.data
    },
    enabled: detailModalOpen && !!selectedEval && ['submitted', 'approved'].includes(selectedEval.status),
  })

  const { data: history, isLoading: historyLoading } = useQuery<EvalHistory>({
    queryKey: ['eval-history', historyTeacherId],
    queryFn: async () => {
      const res = await api.get(`/ems/teachers/${historyTeacherId}/evaluation-history`)
      return res.data.data
    },
    enabled: historyModalOpen && !!historyTeacherId,
  })

  // ─── Mutations ──────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<PerformanceEvaluation>>('/ems/performance-evaluations', values)
      return res.data.data
    },
    onSuccess: () => {
      message.success('Evaluation initiated — teacher notified to complete self-assessment')
      queryClient.invalidateQueries({ queryKey: ['performance-evaluations'] })
      setNewModalOpen(false)
      form.resetFields()
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? t('common.error')),
  })

  // Teacher: save draft self-assessment
  const selfAssessDraftMutation = useMutation({
    mutationFn: async (payload: {
      id: string; selfAssessment: string
      selfAssessmentTeachingScore?: number; selfAssessmentProfessionalScore?: number; selfAssessmentConductScore?: number
    }) => {
      await api.patch(`/ems/performance-evaluations/${payload.id}/self-assess`, payload)
    },
    onSuccess: () => {
      message.success('Draft saved')
      queryClient.invalidateQueries({ queryKey: ['performance-evaluations'] })
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? t('common.error')),
  })

  // Teacher: officially submit self-assessment
  const teacherSubmitMutation = useMutation({
    mutationFn: async (payload: {
      id: string; selfAssessment: string
      selfAssessmentTeachingScore: number; selfAssessmentProfessionalScore: number; selfAssessmentConductScore: number
    }) => {
      await api.patch(`/ems/performance-evaluations/${payload.id}/teacher-submit`, payload)
    },
    onSuccess: () => {
      message.success('Self-assessment submitted — your HOD has been notified')
      queryClient.invalidateQueries({ queryKey: ['performance-evaluations'] })
      setDetailModalOpen(false)
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? t('common.error')),
  })

  // HOD: submit with scores for principal review
  const hodSubmitMutation = useMutation({
    mutationFn: async (payload: { id: string; teachingScore: number; professionalScore: number; conductScore: number; comments?: string }) => {
      const res = await api.patch<ApiResponse<PerformanceEvaluation>>(`/ems/performance-evaluations/${payload.id}/submit`, payload)
      return res.data.data
    },
    onSuccess: () => {
      message.success('Evaluation submitted to principal for review')
      queryClient.invalidateQueries({ queryKey: ['performance-evaluations'] })
      setHodScoreModalOpen(false)
      setDetailModalOpen(false)
      hodForm.resetFields()
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const reviewMutation = useMutation({
    mutationFn: async (payload: { id: string; action: string; reviewerComments: string }) => {
      const res = await api.patch<ApiResponse<PerformanceEvaluation>>(
        `/ems/performance-evaluations/${payload.id}/review`,
        { action: payload.action, reviewerComments: payload.reviewerComments },
      )
      return res.data.data
    },
    onSuccess: () => {
      message.success(t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['performance-evaluations'] })
      setReviewModalOpen(false)
      reviewForm.resetFields()
    },
    onError: (err: any) => message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const enrollMutation = useMutation({
    mutationFn: async (workshopId: string) => {
      await api.post(`/ems/cpd-workshops/${workshopId}/enroll`)
    },
    onSuccess: () => {
      message.success('Enrolled successfully')
      queryClient.invalidateQueries({ queryKey: ['eval-recommendations', selectedEval?.id] })
    },
    onError: () => message.error('Enrollment failed'),
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (fileId: string) => { await api.delete(`/files/${fileId}`) },
    onSuccess: () => { void refetchAttachments() },
    onError: () => message.error('Delete failed'),
  })

  // ─── Handlers ───────────────────────────────────────────────────

  const handleView = (record: PerformanceEvaluation) => {
    setSelectedEval(record)
    const ra = record as any
    setSelfText(ra.selfAssessment ?? '')
    setSelfTeaching(ra.selfAssessmentTeachingScore ?? null)
    setSelfProfessional(ra.selfAssessmentProfessionalScore ?? null)
    setSelfConduct(ra.selfAssessmentConductScore ?? null)
    setDetailModalOpen(true)
  }

  const handleOpenReview = (record: PerformanceEvaluation) => {
    setSelectedEval(record)
    setReviewModalOpen(true)
  }

  const handleOpenHodScores = (record: PerformanceEvaluation) => {
    setSelectedEval(record)
    hodForm.setFieldsValue({
      teachingScore: record.teachingScore,
      professionalScore: record.professionalScore,
      conductScore: record.conductScore,
      comments: record.comments,
    })
    setHodScoreModalOpen(true)
  }

  const handleOpenHistory = (teacherId: string) => {
    setHistoryTeacherId(teacherId)
    setHistoryModalOpen(true)
  }

  const handleReview = (action: 'approve' | 'reject') => {
    reviewForm.validateFields().then(values => {
      reviewMutation.mutate({
        id: selectedEval!.id,
        action,
        reviewerComments: values.reviewerComments ?? '',
      })
    })
  }

  const handleFileUpload = async (file: File, isEvidence = false) => {
    if (!selectedEval) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityType', 'performance_evaluation')
      formData.append('entityId', selectedEval.id)
      formData.append('description', isEvidence ? 'teacher_evidence' : 'hod_attachment')
      await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      void refetchAttachments()
      message.success('File uploaded')
    } catch {
      message.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────

  const ratingLabel = (rating: string | undefined) => {
    const map: Record<string, string> = {
      Excellent: t('ems.excellent'), Good: t('ems.good'),
      Satisfactory: t('ems.satisfactory'), NeedsImprovement: t('ems.needsImprovement'),
    }
    return map[rating ?? ''] ?? rating ?? '-'
  }

  const formatBytes = (b: number) =>
    b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1048576).toFixed(1)}MB`

  const canPreview = (mimeType: string) =>
    mimeType.startsWith('image/') || mimeType === 'application/pdf'

  // ─── Columns ─────────────────────────────────────────────────────

  const columns: ColumnsType<PerformanceEvaluation> = [
    {
      title: t('common.name'),
      key: 'teacherName',
      render: (_: unknown, record: PerformanceEvaluation) => record.teacher?.user?.displayName ?? '-',
    },
    {
      title: t('ems.academicYear'),
      dataIndex: 'academicYear',
      key: 'academicYear',
      width: 120,
    },
    {
      title: 'Workflow Step',
      key: 'workflow',
      width: 200,
      render: (_: unknown, record: PerformanceEvaluation) => (
        <Tag color={statusColor(record.status)}>{statusLabel(record.status)}</Tag>
      ),
    },
    {
      title: t('ems.overallScore'),
      dataIndex: 'overallScore',
      key: 'overallScore',
      width: 100,
      render: (val: number | undefined) => (val != null ? val.toFixed(1) : '—'),
    },
    {
      title: t('ems.rating'),
      dataIndex: 'rating',
      key: 'rating',
      width: 130,
      render: (val: string | undefined) =>
        val ? <Tag color={ratingColor(val)}>{ratingLabel(val)}</Tag> : '—',
    },
    {
      title: 'Current Approver',
      key: 'approver',
      width: 150,
      render: (_: unknown, record: PerformanceEvaluation) => {
        if (record.status === 'pending_self_assessment') return <Text type="secondary">Teacher</Text>
        if (record.status === 'self_assessment_submitted') return <Text type="secondary">HOD</Text>
        if (record.status === 'submitted') return <Text type="secondary">Principal</Text>
        if (record.status === 'approved') return <Tag color="green">Completed</Tag>
        if (record.status === 'rejected') return <Tag color="red">Rejected</Tag>
        return '—'
      },
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 220,
      render: (_: unknown, record: PerformanceEvaluation) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<Eye size={14} />} onClick={() => handleView(record)}>
            {t('common.view')}
          </Button>
          {(isHOD || isPrincipal) && (
            <Tooltip title="Evaluation history">
              <Button type="link" size="small" icon={<History size={14} />}
                onClick={() => handleOpenHistory(record.teacherId)} />
            </Tooltip>
          )}
          {isHOD && record.status === 'self_assessment_submitted' && (
            <Button type="link" size="small" icon={<Star size={14} />} onClick={() => handleOpenHodScores(record)}>
              Add Scores
            </Button>
          )}
          {isPrincipal && record.status === 'submitted' && (
            <Button type="link" size="small" icon={<CheckCircle size={14} />} onClick={() => handleOpenReview(record)}>
              Review
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const teacherOptions = teachers.map(t => ({
    value: t.id,
    label: t.user?.displayName ?? t.staffId,
  }))

  // ─── Evidence tab content ─────────────────────────────────────────
  const teacherEvidenceDocs = attachments.filter(f => (f as any).description === 'teacher_evidence' || !(f as any).description)
  const hodDocs = attachments.filter(f => (f as any).description === 'hod_attachment')

  const evidenceTabContent = selectedEval ? (
    <div>
      {/* Teacher can upload evidence when in pending_self_assessment */}
      {isTeacher && selectedEval.status === 'pending_self_assessment' && (
        <div style={{ marginBottom: 16 }}>
          <input
            type="file"
            ref={evidenceInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.csv"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) void handleFileUpload(file, true)
              e.target.value = ''
            }}
          />
          <Button icon={<Paperclip size={14} />} loading={uploading} onClick={() => evidenceInputRef.current?.click()}>
            Upload Evidence
          </Button>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            Attach lesson plans, awards, certificates, feedback forms…
          </Text>
        </div>
      )}

      {/* HOD/Admin can attach files */}
      {isHOD && (
        <div style={{ marginBottom: 16 }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.csv"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) void handleFileUpload(file, false)
              e.target.value = ''
            }}
          />
          <Button icon={<Paperclip size={14} />} loading={uploading} onClick={() => fileInputRef.current?.click()}>
            Attach File
          </Button>
        </div>
      )}

      {attachments.length === 0 ? (
        <Text type="secondary">No files attached to this evaluation.</Text>
      ) : (
        <>
          {teacherEvidenceDocs.length > 0 && (
            <>
              <Text strong style={{ fontSize: 12, color: '#595959' }}>Teacher Evidence</Text>
              <List
                size="small"
                dataSource={teacherEvidenceDocs}
                style={{ marginBottom: 12 }}
                renderItem={file => (
                  <List.Item
                    actions={[
                      canPreview(file.mimeType) ? (
                        <Button key="preview" type="link" size="small"
                          href={`/api/v1${file.downloadUrl}`} target="_blank">
                          Preview
                        </Button>
                      ) : (
                        <Button key="dl" type="link" size="small"
                          href={`/api/v1${file.downloadUrl}`} target="_blank">
                          Download
                        </Button>
                      ),
                      (isHOD || isPrincipal || isTeacher) ? (
                        <Button key="del" type="link" size="small" danger
                          onClick={() => deleteAttachmentMutation.mutate(file.id)}>
                          Delete
                        </Button>
                      ) : null,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={file.originalName}
                      description={`${formatBytes(file.size)} · ${file.createdAt.slice(0, 10)}`}
                    />
                  </List.Item>
                )}
              />
            </>
          )}
          {hodDocs.length > 0 && (
            <>
              <Text strong style={{ fontSize: 12, color: '#595959' }}>HOD Documents</Text>
              <List
                size="small"
                dataSource={hodDocs}
                renderItem={file => (
                  <List.Item
                    actions={[
                      canPreview(file.mimeType) ? (
                        <Button key="preview" type="link" size="small"
                          href={`/api/v1${file.downloadUrl}`} target="_blank">
                          Preview
                        </Button>
                      ) : (
                        <Button key="dl" type="link" size="small"
                          href={`/api/v1${file.downloadUrl}`} target="_blank">
                          Download
                        </Button>
                      ),
                      isHOD ? (
                        <Button key="del" type="link" size="small" danger
                          onClick={() => deleteAttachmentMutation.mutate(file.id)}>
                          Delete
                        </Button>
                      ) : null,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={file.originalName}
                      description={`${formatBytes(file.size)} · ${file.createdAt.slice(0, 10)}`}
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </>
      )}
    </div>
  ) : null

  // ─── Detail modal tab items ──────────────────────────────────────

  const detailTabItems = selectedEval
    ? [
        {
          key: 'workflow',
          label: 'Workflow',
          children: (
            <div>
              <Steps
                current={workflowStep(selectedEval.status)}
                status={selectedEval.status === 'rejected' ? 'error' : undefined}
                size="small"
                style={{ marginBottom: 20 }}
                items={[
                  { title: 'Initiated', description: 'HOD initiates', icon: <FileText size={14} /> },
                  { title: 'Self-Assessment', description: 'Teacher fills in', icon: <UserCheck size={14} /> },
                  { title: 'HOD Review', description: 'HOD scores & submits', icon: <ClipboardCheck size={14} /> },
                  { title: selectedEval.status === 'rejected' ? 'Rejected' : 'Principal Approval', description: 'Final decision', icon: <CheckCircle size={14} /> },
                ]}
              />

              {/* Teacher self-assessment form */}
              {isTeacher && selectedEval.status === 'pending_self_assessment' && (
                <Card
                  size="small"
                  title={<Space><UserCheck size={14} /><span>Your Self-Assessment</span></Space>}
                  style={{ marginBottom: 16, background: '#f6fbff' }}
                >
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                    Rate yourself on each dimension (0–100) and write your reflection. You can save a draft before submitting.
                  </Text>
                  <Row gutter={12} style={{ marginBottom: 12 }}>
                    <Col span={8}>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>Teaching & Learning</div>
                      <InputNumber
                        min={0} max={100} style={{ width: '100%' }}
                        value={selfTeaching}
                        onChange={v => setSelfTeaching(v)}
                        placeholder="0–100"
                      />
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>Professional Dev.</div>
                      <InputNumber
                        min={0} max={100} style={{ width: '100%' }}
                        value={selfProfessional}
                        onChange={v => setSelfProfessional(v)}
                        placeholder="0–100"
                      />
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>Conduct & Values</div>
                      <InputNumber
                        min={0} max={100} style={{ width: '100%' }}
                        value={selfConduct}
                        onChange={v => setSelfConduct(v)}
                        placeholder="0–100"
                      />
                    </Col>
                  </Row>
                  <TextArea
                    rows={4}
                    value={selfText}
                    onChange={e => setSelfText(e.target.value)}
                    placeholder="Describe your key achievements, teaching approach, professional development, and areas you are working on…"
                    style={{ marginBottom: 10 }}
                  />
                  <Space>
                    <Button
                      loading={selfAssessDraftMutation.isPending}
                      disabled={!selfText.trim()}
                      onClick={() => selfAssessDraftMutation.mutate({
                        id: selectedEval.id,
                        selfAssessment: selfText,
                        selfAssessmentTeachingScore: selfTeaching ?? undefined,
                        selfAssessmentProfessionalScore: selfProfessional ?? undefined,
                        selfAssessmentConductScore: selfConduct ?? undefined,
                      })}
                    >
                      Save Draft
                    </Button>
                    <Button
                      type="primary"
                      icon={<Send size={14} />}
                      loading={teacherSubmitMutation.isPending}
                      disabled={
                        !selfText.trim() ||
                        selfTeaching === null ||
                        selfProfessional === null ||
                        selfConduct === null
                      }
                      onClick={() => teacherSubmitMutation.mutate({
                        id: selectedEval.id,
                        selfAssessment: selfText,
                        selfAssessmentTeachingScore: selfTeaching!,
                        selfAssessmentProfessionalScore: selfProfessional!,
                        selfAssessmentConductScore: selfConduct!,
                      })}
                    >
                      Submit Self-Assessment
                    </Button>
                  </Space>
                  <Alert
                    type="info" showIcon style={{ marginTop: 12 }}
                    message="Also upload supporting evidence in the Evidence tab (lesson plans, CPD certificates, feedback forms)."
                  />
                </Card>
              )}

              {/* Show submitted self-assessment to HOD/Principal */}
              {(isHOD || isPrincipal) && (selectedEval as any).selfAssessment && (
                <Card
                  size="small"
                  title={<Space><UserCheck size={14} /><span>Teacher Self-Assessment</span><Tag color="cyan">Submitted</Tag></Space>}
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={12} style={{ marginBottom: 8 }}>
                    {[
                      { label: 'Teaching', key: 'selfAssessmentTeachingScore' },
                      { label: 'Professional', key: 'selfAssessmentProfessionalScore' },
                      { label: 'Conduct', key: 'selfAssessmentConductScore' },
                    ].map(d => (
                      <Col span={8} key={d.key}>
                        <div style={{ textAlign: 'center', background: '#f0f5ff', borderRadius: 6, padding: '8px 4px' }}>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{d.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#1677ff' }}>
                            {(selectedEval as any)[d.key] ?? '—'}
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  <Text style={{ fontStyle: 'italic', fontSize: 13 }}>{(selectedEval as any).selfAssessment}</Text>
                </Card>
              )}

              {/* HOD scores (once filled) */}
              {selectedEval.overallScore != null && (
                <Card size="small" title={<Space><ClipboardCheck size={14} /><span>HOD Evaluation Scores</span></Space>}>
                  <Row gutter={12}>
                    {[
                      { label: 'Teaching', val: selectedEval.teachingScore },
                      { label: 'Professional', val: selectedEval.professionalScore },
                      { label: 'Conduct', val: selectedEval.conductScore },
                    ].map(d => (
                      <Col span={8} key={d.label}>
                        <div style={{ textAlign: 'center', background: '#f6ffed', borderRadius: 6, padding: '8px 4px' }}>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{d.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}>{d.val ?? '—'}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <Space>
                      <Text>Overall: <strong>{selectedEval.overallScore.toFixed(1)}</strong></Text>
                      {selectedEval.rating && <Tag color={ratingColor(selectedEval.rating)}>{ratingLabel(selectedEval.rating)}</Tag>}
                    </Space>
                  </div>
                  {selectedEval.comments && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#595959' }}>{selectedEval.comments}</div>
                  )}
                </Card>
              )}

              {/* HOD action button */}
              {isHOD && selectedEval.status === 'self_assessment_submitted' && (
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <Button type="primary" icon={<Star size={16} />} onClick={() => handleOpenHodScores(selectedEval)}>
                    Add My Scores & Submit for Review
                  </Button>
                </div>
              )}

              {/* Reviewer comments */}
              {selectedEval.reviewerComments && (
                <Card size="small" style={{ marginTop: 16, background: '#fffbe6' }}
                  title="Principal / Reviewer Comments">
                  {selectedEval.reviewerComments}
                </Card>
              )}
            </div>
          ),
        },
        {
          key: 'evidence',
          label: (
            <Space size={4}>
              <Paperclip size={13} />
              <span>Evidence</span>
              {attachments.length > 0 && <Tag>{attachments.length}</Tag>}
            </Space>
          ),
          children: evidenceTabContent,
        },
        ...((['submitted', 'approved'].includes(selectedEval.status))
          ? [{
              key: 'recommendations',
              label: (
                <Space size={4}>
                  <BookOpen size={13} />
                  <span>Recommended CPD</span>
                  {recommendations.length > 0 && <Tag color="blue">{recommendations.length}</Tag>}
                </Space>
              ),
              children: (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                    Workshops recommended based on the lowest-scoring dimension.
                  </Text>
                  {recommendations.length === 0 ? (
                    <Text type="secondary">No open workshops available for recommendation right now.</Text>
                  ) : (
                    <List
                      size="small"
                      dataSource={recommendations}
                      renderItem={ws => (
                        <List.Item
                          actions={[
                            <Button key="enroll" type="primary" size="small"
                              disabled={ws.alreadyEnrolled || ws.enrolledCount >= ws.maxParticipants}
                              loading={enrollMutation.isPending}
                              onClick={() => enrollMutation.mutate(ws.id)}>
                              {ws.alreadyEnrolled ? 'Enrolled' : 'Enrol'}
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            title={<Space size={4}><span>{ws.title}</span><Tag color="blue">{ws.hours}h</Tag>{ws.category && <Tag>{ws.category}</Tag>}</Space>}
                            description={<Space size={4} wrap>{ws.provider && <Text type="secondary">{ws.provider}</Text>}<Text type="secondary">{ws.startDate.slice(0, 10)}</Text><Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>{ws.recommendationReason}</Text></Space>}
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              ),
            }]
          : []),
      ]
    : []

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            <ClipboardCheck size={24} />
            <Title level={4} style={{ margin: 0 }}>{t('ems.performanceEvaluations')}</Title>
            <Tag>{`${t('common.total')}: ${evaluations.length}`}</Tag>
          </Space>
        </Col>
        <Col>
          {isHOD && (
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setNewModalOpen(true)}>
              Initiate Evaluation
            </Button>
          )}
        </Col>
      </Row>

      {(() => {
        const EVAL_ACTIVE = ['pending_self_assessment', 'self_assessment_submitted', 'draft', 'submitted']
        const EVAL_HISTORY = ['approved', 'rejected']
        const activeEvals = evaluations.filter(e => EVAL_ACTIVE.includes(e.status))
        const historyEvals = evaluations.filter(e => EVAL_HISTORY.includes(e.status))
        const displayEvals = evalTab === 'active' ? activeEvals : historyEvals
        return (
          <Card
            tabList={[
              { key: 'active', tab: `Active (${activeEvals.length})` },
              { key: 'history', tab: `History (${historyEvals.length})` },
            ]}
            activeTabKey={evalTab}
            onTabChange={k => setEvalTab(k as 'active' | 'history')}
          >
            <Table
              dataSource={displayEvals}
              columns={columns}
              rowKey="id"
              loading={isLoading}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
              locale={{ emptyText: t('common.noData') }}
            />
          </Card>
        )
      })()}

      {/* ─── New Evaluation Modal (HOD initiates) ───────────────────── */}
      <Modal
        open={newModalOpen}
        onCancel={() => { setNewModalOpen(false); form.resetFields() }}
        title={<Space><ClipboardCheck size={18} /><span>Initiate Performance Evaluation</span></Space>}
        footer={null}
        width={480}
        destroyOnHidden
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message="The teacher will be notified to complete a self-assessment. After they submit, you can add your scores and forward to the principal."
        />
        <Form form={form} layout="vertical" onFinish={values => createMutation.mutate(values)} initialValues={{ academicYear: '2025/2026' }}>
          <Form.Item name="teacherId" label={t('courses.teacher')} rules={[{ required: true, message: t('common.error') }]}>
            <Select
              options={teacherOptions}
              placeholder="Select teacher"
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="academicYear" label={t('ems.academicYear')} rules={[{ required: true, message: t('common.error') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="comments" label="Initial Notes (optional)">
            <TextArea rows={2} placeholder="Any initial guidance for the teacher…" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setNewModalOpen(false); form.resetFields() }}>{t('common.cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>Initiate & Notify Teacher</Button>
          </Space>
        </Form>
      </Modal>

      {/* ─── Detail View Modal ──────────────────────────────────────── */}
      <Modal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        title={
          <Space>
            <ClipboardCheck size={18} />
            <span>{selectedEval?.teacher?.user?.displayName ?? ''} — {selectedEval?.academicYear}</span>
            {selectedEval && <Tag color={statusColor(selectedEval.status)}>{statusLabel(selectedEval.status)}</Tag>}
          </Space>
        }
        footer={null}
        width={760}
        destroyOnHidden
      >
        {selectedEval && <Tabs items={detailTabItems} defaultActiveKey="workflow" />}
      </Modal>

      {/* ─── HOD Score Entry Modal ──────────────────────────────────── */}
      <Modal
        open={hodScoreModalOpen}
        onCancel={() => { setHodScoreModalOpen(false); hodForm.resetFields() }}
        title={<Space><Star size={18} /><span>HOD Evaluation Scores — {selectedEval?.teacher?.user?.displayName}</span></Space>}
        footer={null}
        width={520}
        destroyOnHidden
      >
        {selectedEval && (selectedEval as any).selfAssessment && (
          <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}
            title="Teacher's Self-Assessment Summary">
            <Row gutter={8} style={{ marginBottom: 8 }}>
              {[
                { label: 'Teaching', key: 'selfAssessmentTeachingScore' },
                { label: 'Professional', key: 'selfAssessmentProfessionalScore' },
                { label: 'Conduct', key: 'selfAssessmentConductScore' },
              ].map(d => (
                <Col span={8} key={d.key}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{d.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{(selectedEval as any)[d.key] ?? '—'}</div>
                  </div>
                </Col>
              ))}
            </Row>
            <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
              "{(selectedEval as any).selfAssessment}"
            </Text>
          </Card>
        )}
        <Form
          form={hodForm}
          layout="vertical"
          onFinish={values => hodSubmitMutation.mutate({ id: selectedEval!.id, ...values })}
        >
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="teachingScore" label="Teaching Score" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0–100" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="professionalScore" label="Professional Dev." rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0–100" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="conductScore" label="Conduct & Values" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0–100" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="comments" label="HOD Comments">
            <TextArea rows={3} />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setHodScoreModalOpen(false); hodForm.resetFields() }}>{t('common.cancel')}</Button>
            <Button type="primary" icon={<Send size={14} />} htmlType="submit" loading={hodSubmitMutation.isPending}>
              Submit to Principal
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* ─── Review Modal (Principal) ───────────────────────────────── */}
      <Modal
        open={reviewModalOpen}
        onCancel={() => { setReviewModalOpen(false); reviewForm.resetFields() }}
        title={<Space><ClipboardCheck size={18} /><span>Review — {selectedEval?.teacher?.user?.displayName}</span></Space>}
        footer={null}
        width={580}
        destroyOnHidden
      >
        {selectedEval && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label={t('ems.overallScore')}>
                {selectedEval.overallScore != null ? selectedEval.overallScore.toFixed(1) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('ems.rating')}>
                {selectedEval.rating
                  ? <Tag color={ratingColor(selectedEval.rating)}>{ratingLabel(selectedEval.rating)}</Tag>
                  : '—'}
              </Descriptions.Item>
              {[
                { label: 'Teaching', val: selectedEval.teachingScore },
                { label: 'Professional', val: selectedEval.professionalScore },
                { label: 'Conduct', val: selectedEval.conductScore },
              ].map(d => (
                <Descriptions.Item key={d.label} label={d.label}>{d.val ?? '—'}</Descriptions.Item>
              ))}
              {selectedEval.comments && (
                <Descriptions.Item label="HOD Comments" span={2}>{selectedEval.comments}</Descriptions.Item>
              )}
              {(selectedEval as any).selfAssessment && (
                <Descriptions.Item label="Teacher Self-Assessment" span={2}>
                  <Text style={{ fontStyle: 'italic' }}>{(selectedEval as any).selfAssessment}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Form form={reviewForm} layout="vertical">
              <Form.Item name="reviewerComments" label={t('ems.reviewerComments')}>
                <TextArea rows={3} />
              </Form.Item>
              <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                <Button onClick={() => { setReviewModalOpen(false); reviewForm.resetFields() }}>{t('common.cancel')}</Button>
                <Button danger icon={<XCircle size={16} />} loading={reviewMutation.isPending} onClick={() => handleReview('reject')}>
                  {t('ems.reject')}
                </Button>
                <Button type="primary" icon={<CheckCircle size={16} />} loading={reviewMutation.isPending} onClick={() => handleReview('approve')}>
                  {t('ems.approve')}
                </Button>
              </Space>
            </Form>
          </div>
        )}
      </Modal>

      {/* ─── History Modal ──────────────────────────────────────────── */}
      <Modal
        open={historyModalOpen}
        onCancel={() => setHistoryModalOpen(false)}
        title={<Space><History size={18} /><span>Evaluation History</span></Space>}
        footer={null}
        width={680}
        destroyOnHidden
      >
        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : history ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              {history.trend === 'improving' && <Alert type="success" icon={<TrendingUp size={16} />} message="Improving trend" showIcon />}
              {history.trend === 'declining' && <Alert type="warning" icon={<TrendingDown size={16} />} message="Declining trend" showIcon />}
              {history.trend === 'stable' && <Alert type="info" icon={<Minus size={16} />} message="Stable performance" showIcon />}
            </div>
            {history.evaluations.filter(e => e.overallScore != null).length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={history.evaluations.filter(e => e.overallScore != null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="academicYear" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <RechartTooltip formatter={(v) => [`${(v as number).toFixed(1)}`, 'Score']} />
                    <Line type="monotone" dataKey="overallScore" stroke="#165DFF" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <Table
              size="small"
              dataSource={history.evaluations}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Academic Year', dataIndex: 'academicYear', width: 120 },
                { title: 'Teaching', dataIndex: 'teachingScore', width: 80, render: (v: number | null) => v?.toFixed(0) ?? '—' },
                { title: 'Professional', dataIndex: 'professionalScore', width: 95, render: (v: number | null) => v?.toFixed(0) ?? '—' },
                { title: 'Conduct', dataIndex: 'conductScore', width: 80, render: (v: number | null) => v?.toFixed(0) ?? '—' },
                { title: 'Overall', dataIndex: 'overallScore', width: 70, render: (v: number | null) => v?.toFixed(1) ?? '—' },
                { title: 'Rating', dataIndex: 'rating', width: 130, render: (v: string | null) => v ? <Tag color={ratingColor(v)}>{ratingLabel(v)}</Tag> : '—' },
                { title: 'Status', dataIndex: 'status', width: 130, render: (v: string) => <Tag color={statusColor(v)}>{statusLabel(v)}</Tag> },
              ]}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default PerformanceEvaluationPage
