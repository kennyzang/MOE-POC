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
  Upload,
  List,
  Alert,
  Spin,
  Tooltip,
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck, Plus, Eye, CheckCircle, XCircle,
  TrendingUp, TrendingDown, Minus, Paperclip, History, BookOpen,
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
    draft: 'default', submitted: 'blue', approved: 'green', rejected: 'red',
  }
  return map[status] ?? 'default'
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
  const [selectedEval, setSelectedEval] = useState<PerformanceEvaluation | null>(null)
  const [historyTeacherId, setHistoryTeacherId] = useState<string | null>(null)
  const [selfAssessText, setSelfAssessText] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form] = Form.useForm()
  const [reviewForm] = Form.useForm()

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

  // Attachments for the open evaluation
  const { data: attachments = [], refetch: refetchAttachments } = useQuery<FileAttachment[]>({
    queryKey: ['eval-attachments', selectedEval?.id],
    queryFn: async () => {
      const res = await api.get(`/files?entityType=performance_evaluation&entityId=${selectedEval!.id}`)
      return res.data.data
    },
    enabled: detailModalOpen && !!selectedEval?.id,
  })

  // Recommended workshops for the open evaluation
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

  // Evaluation history for the selected teacher
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
      message.success(t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['performance-evaluations'] })
      setNewModalOpen(false)
      form.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<ApiResponse<PerformanceEvaluation>>(`/ems/performance-evaluations/${id}/submit`)
      return res.data.data
    },
    onSuccess: () => {
      message.success(t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['performance-evaluations'] })
      setDetailModalOpen(false)
    },
    onError: () => message.error(t('common.error')),
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
    onError: () => message.error(t('common.error')),
  })

  const selfAssessMutation = useMutation({
    mutationFn: async (payload: { id: string; selfAssessment: string }) => {
      await api.patch(`/ems/performance-evaluations/${payload.id}/self-assess`, {
        selfAssessment: payload.selfAssessment,
      })
    },
    onSuccess: () => {
      message.success('Self-assessment saved')
      queryClient.invalidateQueries({ queryKey: ['performance-evaluations'] })
    },
    onError: () => message.error(t('common.error')),
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
    setSelfAssessText((record as any).selfAssessment ?? '')
    setDetailModalOpen(true)
  }

  const handleOpenReview = (record: PerformanceEvaluation) => {
    setSelectedEval(record)
    setReviewModalOpen(true)
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

  const handleFileUpload = async (file: File) => {
    if (!selectedEval) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityType', 'performance_evaluation')
      formData.append('entityId', selectedEval.id)
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
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
      Excellent: t('ems.excellent'),
      Good: t('ems.good'),
      Satisfactory: t('ems.satisfactory'),
      NeedsImprovement: t('ems.needsImprovement'),
    }
    return map[rating ?? ''] ?? rating ?? '-'
  }

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: t('ems.draft'),
      submitted: t('ems.submitted'),
      approved: t('ems.approved'),
      rejected: t('ems.rejected'),
    }
    return map[status] ?? status
  }

  const formatBytes = (b: number) =>
    b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1048576).toFixed(1)}MB`

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
      title: t('ems.overallScore'),
      dataIndex: 'overallScore',
      key: 'overallScore',
      width: 110,
      render: (val: number | undefined) => (val != null ? val.toFixed(1) : '-'),
    },
    {
      title: t('ems.rating'),
      dataIndex: 'rating',
      key: 'rating',
      width: 130,
      render: (val: string | undefined) =>
        val ? <Tag color={ratingColor(val)}>{ratingLabel(val)}</Tag> : '-',
    },
    {
      title: t('ems.evalStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (val: string) => <Tag color={statusColor(val)}>{statusLabel(val)}</Tag>,
    },
    {
      title: t('ems.submittedAt'),
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 110,
      render: (val: string | undefined) => (val ? val.slice(0, 10) : '-'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 200,
      render: (_: unknown, record: PerformanceEvaluation) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<Eye size={14} />} onClick={() => handleView(record)}>
            {t('common.view')}
          </Button>
          {(isHOD || isPrincipal) && (
            <Tooltip title="View evaluation history">
              <Button
                type="link"
                size="small"
                icon={<History size={14} />}
                onClick={() => handleOpenHistory(record.teacherId)}
              />
            </Tooltip>
          )}
          {isPrincipal && record.status === 'submitted' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircle size={14} />}
              onClick={() => handleOpenReview(record)}
            >
              {t('ems.approve')} / {t('ems.reject')}
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

  // ─── Detail modal tab items ──────────────────────────────────────

  const detailTabItems = selectedEval
    ? [
        {
          key: 'scores',
          label: 'Scores',
          children: (
            <div>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label={t('common.name')}>
                  {selectedEval.teacher?.user?.displayName ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('ems.academicYear')}>
                  {selectedEval.academicYear}
                </Descriptions.Item>
                <Descriptions.Item label={t('ems.teachingScore')}>
                  {selectedEval.teachingScore ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('ems.professionalScore')}>
                  {selectedEval.professionalScore ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('ems.conductScore')}>
                  {selectedEval.conductScore ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('ems.overallScore')}>
                  {selectedEval.overallScore != null ? selectedEval.overallScore.toFixed(1) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('ems.rating')}>
                  {selectedEval.rating
                    ? <Tag color={ratingColor(selectedEval.rating)}>{ratingLabel(selectedEval.rating)}</Tag>
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('ems.evalStatus')}>
                  <Tag color={statusColor(selectedEval.status)}>{statusLabel(selectedEval.status)}</Tag>
                </Descriptions.Item>
                {selectedEval.submittedAt && (
                  <Descriptions.Item label={t('ems.submittedAt')}>{selectedEval.submittedAt.slice(0, 10)}</Descriptions.Item>
                )}
                {selectedEval.reviewedAt && (
                  <Descriptions.Item label={t('ems.reviewedAt')}>{selectedEval.reviewedAt.slice(0, 10)}</Descriptions.Item>
                )}
                {selectedEval.comments && (
                  <Descriptions.Item label={t('ems.evaluatorComments')} span={2}>
                    {selectedEval.comments}
                  </Descriptions.Item>
                )}
                {(selectedEval as any).selfAssessment && (
                  <Descriptions.Item label="Teacher Self-Assessment" span={2}>
                    <Text style={{ fontStyle: 'italic' }}>{(selectedEval as any).selfAssessment}</Text>
                  </Descriptions.Item>
                )}
                {selectedEval.reviewerComments && (
                  <Descriptions.Item label={t('ems.reviewerComments')} span={2}>
                    {selectedEval.reviewerComments}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {isHOD && selectedEval.status === 'draft' && (
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <Button
                    type="primary"
                    icon={<CheckCircle size={16} />}
                    loading={submitMutation.isPending}
                    onClick={() => submitMutation.mutate(selectedEval.id)}
                  >
                    {t('ems.submitForReview')}
                  </Button>
                </div>
              )}
            </div>
          ),
        },
        {
          key: 'self-assessment',
          label: (
            <Space size={4}>
              <span>Self-Assessment</span>
              {(selectedEval as any).selfAssessment && (
                <Tag color="green" style={{ fontSize: 10 }}>Submitted</Tag>
              )}
            </Space>
          ),
          children: (
            <div>
              {isTeacher && selectedEval.status === 'draft' ? (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    Share your reflection on your performance this academic year. Your HOD will see this before submitting.
                  </Text>
                  <TextArea
                    rows={5}
                    value={selfAssessText}
                    onChange={e => setSelfAssessText(e.target.value)}
                    placeholder="Describe your teaching approach, professional achievements, and areas you are working on..."
                  />
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <Button
                      type="primary"
                      loading={selfAssessMutation.isPending}
                      disabled={!selfAssessText.trim()}
                      onClick={() => selfAssessMutation.mutate({ id: selectedEval.id, selfAssessment: selfAssessText })}
                    >
                      Save Self-Assessment
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {(selectedEval as any).selfAssessment ? (
                    <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                      <Text style={{ fontStyle: 'italic' }}>{(selectedEval as any).selfAssessment}</Text>
                    </Card>
                  ) : (
                    <Text type="secondary">No self-assessment has been submitted for this evaluation.</Text>
                  )}
                </div>
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
          children: (
            <div>
              {(isHOD || isPrincipal) && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.csv"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) void handleFileUpload(file)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    icon={<Paperclip size={14} />}
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Attach File
                  </Button>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    PDF, Word, Excel, images up to 10 MB
                  </Text>
                </div>
              )}
              {attachments.length === 0 ? (
                <Text type="secondary">No files attached to this evaluation.</Text>
              ) : (
                <List
                  size="small"
                  dataSource={attachments}
                  renderItem={file => (
                    <List.Item
                      actions={[
                        <Button
                          key="dl"
                          type="link"
                          size="small"
                          href={`/api/v1${file.downloadUrl}`}
                          target="_blank"
                        >
                          Download
                        </Button>,
                        (isHOD || isPrincipal) && (
                          <Button
                            key="del"
                            type="link"
                            size="small"
                            danger
                            onClick={() => deleteAttachmentMutation.mutate(file.id)}
                          >
                            Delete
                          </Button>
                        ),
                      ].filter(Boolean)}
                    >
                      <List.Item.Meta
                        title={file.originalName}
                        description={`${formatBytes(file.size)} · ${file.createdAt.slice(0, 10)}`}
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
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
                    Workshops recommended based on this evaluation's lowest-scoring dimension.
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
                            <Button
                              key="enroll"
                              type="primary"
                              size="small"
                              disabled={ws.alreadyEnrolled || ws.enrolledCount >= ws.maxParticipants}
                              loading={enrollMutation.isPending}
                              onClick={() => enrollMutation.mutate(ws.id)}
                            >
                              {ws.alreadyEnrolled ? 'Enrolled' : 'Enrol'}
                            </Button>,
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              <Space size={4}>
                                <span>{ws.title}</span>
                                <Tag color="blue">{ws.hours}h</Tag>
                                {ws.category && <Tag>{ws.category}</Tag>}
                              </Space>
                            }
                            description={
                              <Space size={4} wrap>
                                {ws.provider && <Text type="secondary">{ws.provider}</Text>}
                                <Text type="secondary">{ws.startDate.slice(0, 10)}</Text>
                                <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                                  {ws.recommendationReason}
                                </Text>
                              </Space>
                            }
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
            <Title level={4} style={{ margin: 0 }}>
              {t('ems.performanceEvaluations')}
            </Title>
            <Tag>{`${t('common.total')}: ${evaluations.length}`}</Tag>
          </Space>
        </Col>
        <Col>
          {isHOD && (
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setNewModalOpen(true)}>
              {t('ems.newEvaluation')}
            </Button>
          )}
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={evaluations}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>

      {/* ─── New Evaluation Modal ───────────────────────────────── */}
      <Modal
        open={newModalOpen}
        onCancel={() => { setNewModalOpen(false); form.resetFields() }}
        title={<Space><ClipboardCheck size={18} /><span>{t('ems.newEvaluation')}</span></Space>}
        footer={null}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={values => createMutation.mutate(values)} initialValues={{ academicYear: '2025/2026' }}>
          <Form.Item name="teacherId" label={t('courses.teacher')} rules={[{ required: true, message: t('common.error') }]}>
            <Select
              options={teacherOptions}
              placeholder={t('courses.teacher')}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="academicYear" label={t('ems.academicYear')} rules={[{ required: true, message: t('common.error') }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="teachingScore" label={t('ems.teachingScore')} rules={[{ required: true, message: t('common.error') }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="professionalScore" label={t('ems.professionalScore')} rules={[{ required: true, message: t('common.error') }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="conductScore" label={t('ems.conductScore')} rules={[{ required: true, message: t('common.error') }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="comments" label={t('ems.evaluatorComments')}>
            <TextArea rows={3} />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setNewModalOpen(false); form.resetFields() }}>{t('common.cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>{t('common.save')}</Button>
          </Space>
        </Form>
      </Modal>

      {/* ─── Detail View Modal ──────────────────────────────────── */}
      <Modal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        title={
          <Space>
            <ClipboardCheck size={18} />
            <span>
              {t('ems.evaluationDetail')} — {selectedEval?.teacher?.user?.displayName ?? ''}
            </span>
          </Space>
        }
        footer={null}
        width={720}
        destroyOnHidden
      >
        {selectedEval && (
          <Tabs items={detailTabItems} defaultActiveKey="scores" />
        )}
      </Modal>

      {/* ─── Review Modal (Principal) ───────────────────────────── */}
      <Modal
        open={reviewModalOpen}
        onCancel={() => { setReviewModalOpen(false); reviewForm.resetFields() }}
        title={
          <Space>
            <ClipboardCheck size={18} />
            <span>{t('ems.evaluationDetail')} — {selectedEval?.teacher?.user?.displayName ?? ''}</span>
          </Space>
        }
        footer={null}
        width={580}
        destroyOnHidden
      >
        {selectedEval && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label={t('ems.overallScore')}>
                {selectedEval.overallScore != null ? selectedEval.overallScore.toFixed(1) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('ems.rating')}>
                {selectedEval.rating
                  ? <Tag color={ratingColor(selectedEval.rating)}>{ratingLabel(selectedEval.rating)}</Tag>
                  : '-'}
              </Descriptions.Item>
              {selectedEval.comments && (
                <Descriptions.Item label={t('ems.evaluatorComments')} span={2}>
                  {selectedEval.comments}
                </Descriptions.Item>
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

      {/* ─── History Modal ──────────────────────────────────────── */}
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
            {/* Trend indicator */}
            <div style={{ marginBottom: 16 }}>
              {history.trend === 'improving' && (
                <Alert
                  type="success"
                  icon={<TrendingUp size={16} />}
                  message="Improving trend — scores have risen over recent evaluations"
                  showIcon
                />
              )}
              {history.trend === 'declining' && (
                <Alert
                  type="warning"
                  icon={<TrendingDown size={16} />}
                  message="Declining trend — scores have dropped over recent evaluations"
                  showIcon
                />
              )}
              {history.trend === 'stable' && (
                <Alert
                  type="info"
                  icon={<Minus size={16} />}
                  message="Stable performance — scores are consistent across evaluations"
                  showIcon
                />
              )}
            </div>

            {/* Mini line chart */}
            {history.evaluations.filter(e => e.overallScore != null).length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={history.evaluations.filter(e => e.overallScore != null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="academicYear" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <RechartTooltip formatter={(v: number) => [`${v.toFixed(1)}`, 'Score']} />
                    <Line
                      type="monotone"
                      dataKey="overallScore"
                      stroke="#165DFF"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* History table */}
            <Table
              size="small"
              dataSource={history.evaluations}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Academic Year', dataIndex: 'academicYear', width: 120 },
                {
                  title: 'Teaching',
                  dataIndex: 'teachingScore',
                  width: 80,
                  render: (v: number | null) => v?.toFixed(0) ?? '-',
                },
                {
                  title: 'Professional',
                  dataIndex: 'professionalScore',
                  width: 95,
                  render: (v: number | null) => v?.toFixed(0) ?? '-',
                },
                {
                  title: 'Conduct',
                  dataIndex: 'conductScore',
                  width: 80,
                  render: (v: number | null) => v?.toFixed(0) ?? '-',
                },
                {
                  title: 'Overall',
                  dataIndex: 'overallScore',
                  width: 70,
                  render: (v: number | null) => v?.toFixed(1) ?? '-',
                },
                {
                  title: 'Rating',
                  dataIndex: 'rating',
                  width: 130,
                  render: (v: string | null) =>
                    v ? <Tag color={ratingColor(v)}>{ratingLabel(v)}</Tag> : '-',
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  width: 90,
                  render: (v: string) => <Tag color={statusColor(v)}>{statusLabel(v)}</Tag>,
                },
              ]}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default PerformanceEvaluationPage
