import { useState } from 'react'
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
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Plus, Eye, CheckCircle, XCircle } from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { PerformanceEvaluation, Teacher, ApiResponse } from '../../types'
import type { ColumnsType } from 'antd/es/table'

const { TextArea } = Input

// ─── Rating color/label helpers ────────────────────────────────

function ratingColor(rating: string | undefined): string {
  const map: Record<string, string> = {
    Excellent: 'green',
    Good: 'blue',
    Satisfactory: 'orange',
    NeedsImprovement: 'red',
  }
  return map[rating ?? ''] ?? 'default'
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'default',
    submitted: 'blue',
    approved: 'green',
    rejected: 'red',
  }
  return map[status] ?? 'default'
}

// ─── Component ─────────────────────────────────────────────────

const PerformanceEvaluationPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [newModalOpen, setNewModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedEval, setSelectedEval] = useState<PerformanceEvaluation | null>(null)

  const [form] = Form.useForm()
  const [reviewForm] = Form.useForm()

  const role = user?.role ?? ''
  const isHOD = ['hod', 'admin', 'manager'].includes(role)
  const isPrincipal = ['principal', 'admin'].includes(role)

  // Fetch evaluations
  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ['performance-evaluations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PerformanceEvaluation[]>>('/ems/performance-evaluations')
      return res.data.data
    },
  })

  // Fetch teachers (for new evaluation select)
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Teacher[]>>('/teachers')
      return res.data.data
    },
    enabled: isHOD,
  })

  // Create evaluation mutation
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

  // Submit evaluation mutation
  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<ApiResponse<PerformanceEvaluation>>(
        `/ems/performance-evaluations/${id}/submit`
      )
      return res.data.data
    },
    onSuccess: () => {
      message.success(t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['performance-evaluations'] })
      setDetailModalOpen(false)
    },
    onError: () => message.error(t('common.error')),
  })

  // Review (approve/reject) mutation
  const reviewMutation = useMutation({
    mutationFn: async (payload: { id: string; action: string; reviewerComments: string }) => {
      const res = await api.patch<ApiResponse<PerformanceEvaluation>>(
        `/ems/performance-evaluations/${payload.id}/review`,
        { action: payload.action, reviewerComments: payload.reviewerComments }
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

  // ─── Handlers ──────────────────────────────────────────────

  const handleView = (record: PerformanceEvaluation) => {
    setSelectedEval(record)
    setDetailModalOpen(true)
  }

  const handleOpenReview = (record: PerformanceEvaluation) => {
    setSelectedEval(record)
    setReviewModalOpen(true)
  }

  const handleCreateSubmit = (values: Record<string, unknown>) => {
    createMutation.mutate(values)
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

  // ─── Columns ───────────────────────────────────────────────

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

  const columns: ColumnsType<PerformanceEvaluation> = [
    {
      title: t('common.name'),
      key: 'teacherName',
      render: (_: unknown, record: PerformanceEvaluation) =>
        record.teacher?.user?.displayName ?? '-',
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
      render: (val: string) => (
        <Tag color={statusColor(val)}>{statusLabel(val)}</Tag>
      ),
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
      width: 180,
      render: (_: unknown, record: PerformanceEvaluation) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<Eye size={14} />}
            onClick={() => handleView(record)}
          >
            {t('common.view')}
          </Button>
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

  // ─── Teacher options for select ─────────────────────────────

  const teacherOptions = teachers.map(t => ({
    value: t.id,
    label: t.user?.displayName ?? t.staffId,
  }))

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            <ClipboardCheck size={24} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('ems.performanceEvaluations')}
            </Typography.Title>
            <Tag>{`${t('common.total')}: ${evaluations.length}`}</Tag>
          </Space>
        </Col>
        <Col>
          {isHOD && (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setNewModalOpen(true)}
            >
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

      {/* ─── New Evaluation Modal ─────────────────────────────── */}
      <Modal
        open={newModalOpen}
        onCancel={() => { setNewModalOpen(false); form.resetFields() }}
        title={
          <Space>
            <ClipboardCheck size={18} />
            <span>{t('ems.newEvaluation')}</span>
          </Space>
        }
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateSubmit}
          initialValues={{ academicYear: '2025/2026' }}
        >
          <Form.Item
            name="teacherId"
            label={t('courses.teacher')}
            rules={[{ required: true, message: t('common.error') }]}
          >
            <Select
              options={teacherOptions}
              placeholder={t('courses.teacher')}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            name="academicYear"
            label={t('ems.academicYear')}
            rules={[{ required: true, message: t('common.error') }]}
          >
            <Input />
          </Form.Item>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="teachingScore"
                label={t('ems.teachingScore')}
                rules={[{ required: true, message: t('common.error') }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="professionalScore"
                label={t('ems.professionalScore')}
                rules={[{ required: true, message: t('common.error') }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="conductScore"
                label={t('ems.conductScore')}
                rules={[{ required: true, message: t('common.error') }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="comments" label={t('ems.evaluatorComments')}>
            <TextArea rows={3} />
          </Form.Item>

          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setNewModalOpen(false); form.resetFields() }}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
              {t('common.save')}
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* ─── Detail View Modal ────────────────────────────────── */}
      <Modal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        title={
          <Space>
            <ClipboardCheck size={18} />
            <span>{t('ems.evaluationDetail')}</span>
          </Space>
        }
        footer={null}
        width={640}
        destroyOnClose
      >
        {selectedEval && (
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
                {selectedEval.rating ? (
                  <Tag color={ratingColor(selectedEval.rating)}>
                    {ratingLabel(selectedEval.rating)}
                  </Tag>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('ems.evalStatus')}>
                <Tag color={statusColor(selectedEval.status)}>
                  {statusLabel(selectedEval.status)}
                </Tag>
              </Descriptions.Item>
              {selectedEval.submittedAt && (
                <Descriptions.Item label={t('ems.submittedAt')}>
                  {selectedEval.submittedAt.slice(0, 10)}
                </Descriptions.Item>
              )}
              {selectedEval.reviewedAt && (
                <Descriptions.Item label={t('ems.reviewedAt')}>
                  {selectedEval.reviewedAt.slice(0, 10)}
                </Descriptions.Item>
              )}
              {selectedEval.comments && (
                <Descriptions.Item label={t('ems.evaluatorComments')} span={2}>
                  {selectedEval.comments}
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
        )}
      </Modal>

      {/* ─── Review Modal (Principal) ─────────────────────────── */}
      <Modal
        open={reviewModalOpen}
        onCancel={() => { setReviewModalOpen(false); reviewForm.resetFields() }}
        title={
          <Space>
            <ClipboardCheck size={18} />
            <span>
              {t('ems.evaluationDetail')} —{' '}
              {selectedEval?.teacher?.user?.displayName ?? ''}
            </span>
          </Space>
        }
        footer={null}
        width={560}
        destroyOnClose
      >
        {selectedEval && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('ems.overallScore')}>
                {selectedEval.overallScore != null ? selectedEval.overallScore.toFixed(1) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('ems.rating')}>
                {selectedEval.rating ? (
                  <Tag color={ratingColor(selectedEval.rating)}>
                    {ratingLabel(selectedEval.rating)}
                  </Tag>
                ) : '-'}
              </Descriptions.Item>
              {selectedEval.comments && (
                <Descriptions.Item label={t('ems.evaluatorComments')} span={2}>
                  {selectedEval.comments}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Form form={reviewForm} layout="vertical">
              <Form.Item name="reviewerComments" label={t('ems.reviewerComments')}>
                <TextArea rows={3} />
              </Form.Item>
              <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                <Button
                  onClick={() => { setReviewModalOpen(false); reviewForm.resetFields() }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  danger
                  icon={<XCircle size={16} />}
                  loading={reviewMutation.isPending}
                  onClick={() => handleReview('reject')}
                >
                  {t('ems.reject')}
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircle size={16} />}
                  loading={reviewMutation.isPending}
                  onClick={() => handleReview('approve')}
                >
                  {t('ems.approve')}
                </Button>
              </Space>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default PerformanceEvaluationPage
