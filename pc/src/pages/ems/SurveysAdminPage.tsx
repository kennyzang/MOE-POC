import { useState } from 'react'
import {
  Card, Table, Tag, Button, Modal, Form, Input, Select, Switch,
  DatePicker, Space, Typography, Popconfirm, Spin, Empty, Drawer,
  Progress, List, Rate, Statistic, Row, Col, Divider, Badge, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, Plus, Trash2, Play, Square, BarChart2,
  MessageSquare, CheckSquare, AlignLeft,
} from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

// ─── Types ────────────────────────────────────────────────────────

interface SurveyItem {
  id: string
  title: string
  description: string | null
  category: string
  isAnonymous: boolean
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  startDate: string | null
  endDate: string | null
  createdAt: string
  _count: { questions: number; responses: number }
}

interface Question {
  id: string
  order: number
  text: string
  type: string
  options: string | null
  required: boolean
}

interface QuestionResult {
  questionId: string
  text: string
  type: string
  totalAnswers: number
  avgRating?: number
  distribution?: Record<string, number>
  textResponses?: string[]
}

interface SurveyResults {
  title: string
  category: string
  isAnonymous: boolean
  status: string
  totalResponses: number
  questions: QuestionResult[]
}

// ─── Constants ────────────────────────────────────────────────────

const CATEGORIES = ['GENERAL', 'PROFESSIONAL_DEVELOPMENT', 'WELL_BEING', 'SCHOOL_MANAGEMENT']
const QUESTION_TYPES = ['RATING', 'TEXT', 'MULTIPLE_CHOICE', 'YES_NO']
const STATUS_COLOR: Record<string, string> = { DRAFT: 'default', ACTIVE: 'processing', CLOSED: 'success' }
const CATEGORY_COLOR: Record<string, string> = {
  GENERAL: 'blue', PROFESSIONAL_DEVELOPMENT: 'green',
  WELL_BEING: 'purple', SCHOOL_MANAGEMENT: 'orange',
}

function fmtDate(s: string | null) { return s ? dayjs(s).format('D MMM YYYY') : '—' }

// ─── Question builder sub-component ──────────────────────────────

interface QDraft { text: string; type: string; options: string; required: boolean }

function QuestionBuilder({ questions, onChange }: {
  questions: QDraft[]
  onChange: (qs: QDraft[]) => void
}) {
  const { t } = useTranslation()
  const add = () => onChange([...questions, { text: '', type: 'RATING', options: '', required: true }])
  const remove = (i: number) => onChange(questions.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof QDraft, val: string | boolean) => {
    const copy = [...questions]
    copy[i] = { ...copy[i], [field]: val }
    onChange(copy)
  }

  return (
    <div>
      {questions.map((q, i) => (
        <Card
          key={i}
          size="small"
          style={{ marginBottom: 8, borderRadius: 8 }}
          extra={
            <Button danger size="small" icon={<Trash2 size={12} />} onClick={() => remove(i)} />
          }
          title={<Text type="secondary" style={{ fontSize: 12 }}>Q{i + 1}</Text>}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Input
              placeholder={t('surveys.questionText', 'Question text...')}
              value={q.text}
              onChange={e => update(i, 'text', e.target.value)}
              maxLength={250}
            />
            <Space size={8} wrap>
              <Select
                size="small"
                value={q.type}
                onChange={v => update(i, 'type', v)}
                style={{ width: 160 }}
              >
                {QUESTION_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
              </Select>
              <Switch
                size="small"
                checked={q.required}
                onChange={v => update(i, 'required', v)}
              />
              <Text style={{ fontSize: 12 }}>{t('surveys.required', 'Required')}</Text>
            </Space>
            {q.type === 'MULTIPLE_CHOICE' && (
              <Input
                size="small"
                placeholder={t('surveys.optionsPlaceholder', 'Options, comma-separated e.g. Option A, Option B')}
                value={q.options}
                onChange={e => update(i, 'options', e.target.value)}
              />
            )}
          </Space>
        </Card>
      ))}
      <Button
        type="dashed"
        icon={<Plus size={14} />}
        onClick={add}
        block
        style={{ marginTop: 4 }}
      >
        {t('surveys.addQuestion', 'Add Question')}
      </Button>
    </div>
  )
}

// ─── Create / Edit modal ──────────────────────────────────────────

function SurveyFormModal({ open, onClose, editing }: {
  open: boolean; onClose: () => void; editing: SurveyItem | null
}) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [questions, setQuestions] = useState<QDraft[]>([{ text: '', type: 'RATING', options: '', required: true }])
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = {
        title: values.title,
        description: values.description || undefined,
        category: values.category,
        isAnonymous: values.isAnonymous,
        startDate: values.startDate ? (values.startDate as dayjs.Dayjs).toISOString() : undefined,
        endDate: values.endDate ? (values.endDate as dayjs.Dayjs).toISOString() : undefined,
        questions: questions.filter(q => q.text.trim()).map((q, i) => ({
          text: q.text,
          type: q.type,
          options: q.options ? q.options.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          required: q.required,
          order: i + 1,
        })),
      }
      if (editing) return api.put(`/surveys/${editing.id}`, payload)
      return api.post('/surveys', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surveys'] })
      onClose()
      form.resetFields()
      setQuestions([{ text: '', type: 'RATING', options: '', required: true }])
    },
  })

  return (
    <Modal
      open={open}
      onCancel={() => { onClose(); form.resetFields() }}
      title={
        <Space>
          <ClipboardList size={16} />
          {editing ? t('surveys.editSurvey', 'Edit Survey') : t('surveys.createSurvey', 'Create Survey')}
        </Space>
      }
      footer={null}
      width={640}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ category: 'GENERAL', isAnonymous: true }}
        onFinish={v => mutation.mutate(v as Record<string, unknown>)}
        style={{ marginTop: 16 }}
      >
        <Form.Item name="title" label={t('surveys.surveyTitle', 'Survey Title')} rules={[{ required: true }]}>
          <Input maxLength={150} />
        </Form.Item>

        <Form.Item name="description" label={t('surveys.description', 'Description (optional)')}>
          <TextArea rows={2} maxLength={300} showCount />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="category" label={t('surveys.category', 'Category')} rules={[{ required: true }]}>
              <Select>
                {CATEGORIES.map(c => <Select.Option key={c} value={c}>{c.replace('_', ' ')}</Select.Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="isAnonymous" label={t('surveys.anonymous', 'Anonymous Responses')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="startDate" label={t('surveys.startDate', 'Start Date (optional)')}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="endDate" label={t('surveys.endDate', 'End Date (optional)')}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0' }}>{t('surveys.questions', 'Questions')}</Divider>
        <QuestionBuilder questions={questions} onChange={setQuestions} />

        <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
          <Space>
            <Button onClick={() => { onClose(); form.resetFields() }}>{t('common.cancel', 'Cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              {editing ? t('common.save', 'Save') : t('surveys.create', 'Create Survey')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Results drawer ───────────────────────────────────────────────

function ResultsDrawer({ surveyId, onClose }: { surveyId: string | null; onClose: () => void }) {
  const { t } = useTranslation()

  const { data: results, isLoading } = useQuery<SurveyResults>({
    queryKey: ['surveyResults', surveyId],
    queryFn: async () => {
      const r = await api.get(`/surveys/${surveyId}/results`)
      return r.data.data as SurveyResults
    },
    enabled: !!surveyId,
  })

  const typeIcon = (type: string) => {
    if (type === 'RATING') return <BarChart2 size={14} />
    if (type === 'TEXT') return <AlignLeft size={14} />
    if (type === 'YES_NO') return <CheckSquare size={14} />
    return <MessageSquare size={14} />
  }

  return (
    <Drawer
      open={!!surveyId}
      onClose={onClose}
      title={
        <Space>
          <BarChart2 size={16} />
          {results?.title ?? t('surveys.results', 'Survey Results')}
        </Space>
      }
      width={560}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : results ? (
        <div>
          <Row gutter={12} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Statistic
                title={t('surveys.totalResponses', 'Responses')}
                value={results.totalResponses}
                valueStyle={{ color: '#1677ff' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={t('surveys.status', 'Status')}
                value={results.status}
                valueStyle={{ fontSize: 14, textTransform: 'capitalize' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={t('surveys.anonymous', 'Anonymous')}
                value={results.isAnonymous ? 'Yes' : 'No'}
                valueStyle={{ fontSize: 14 }}
              />
            </Col>
          </Row>

          {results.questions.map((q, i) => (
            <Card key={q.questionId} size="small" style={{ marginBottom: 12, borderRadius: 10 }}>
              <Space style={{ marginBottom: 8 }}>
                {typeIcon(q.type)}
                <Text strong style={{ fontSize: 13 }}>Q{i + 1}: {q.text}</Text>
              </Space>
              <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                {q.totalAnswers} {t('surveys.answers', 'answers')}
              </Text>

              {q.type === 'RATING' && q.avgRating !== undefined && (
                <div>
                  <Space>
                    <Rate disabled value={q.avgRating} allowHalf />
                    <Text strong style={{ color: '#faad14' }}>{q.avgRating} / 5</Text>
                  </Space>
                  {q.distribution && (
                    <div style={{ marginTop: 8 }}>
                      {['5', '4', '3', '2', '1'].map(star => {
                        const count = q.distribution![star] ?? 0
                        const pct = q.totalAnswers > 0 ? Math.round((count / q.totalAnswers) * 100) : 0
                        return (
                          <Space key={star} style={{ display: 'flex', marginBottom: 4, alignItems: 'center' }}>
                            <Text style={{ width: 20, textAlign: 'right', fontSize: 12 }}>{star}★</Text>
                            <Progress percent={pct} showInfo={false} size="small" style={{ flex: 1, margin: '0 8px' }} />
                            <Text style={{ width: 36, fontSize: 12, textAlign: 'right' }}>{count}</Text>
                          </Space>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {(q.type === 'MULTIPLE_CHOICE' || q.type === 'YES_NO') && q.distribution && (
                <div>
                  {Object.entries(q.distribution).map(([opt, count]) => {
                    const pct = q.totalAnswers > 0 ? Math.round((count / q.totalAnswers) * 100) : 0
                    return (
                      <Space key={opt} style={{ display: 'flex', marginBottom: 4, alignItems: 'center' }}>
                        <Text style={{ width: 60, fontSize: 12 }}>{opt}</Text>
                        <Progress percent={pct} size="small" style={{ flex: 1, margin: '0 8px' }} />
                        <Text style={{ width: 36, fontSize: 12, textAlign: 'right' }}>{count}</Text>
                      </Space>
                    )
                  })}
                </div>
              )}

              {q.type === 'TEXT' && (
                <List
                  size="small"
                  dataSource={q.textResponses ?? []}
                  locale={{ emptyText: t('surveys.noTextResponses', 'No text responses') }}
                  renderItem={item => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <Text style={{ fontSize: 13 }}>"{item}"</Text>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          ))}
        </div>
      ) : null}
    </Drawer>
  )
}

// ─── Main page ────────────────────────────────────────────────────

export default function SurveysAdminPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const role = user?.role ?? ''
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [resultsId, setResultsId] = useState<string | null>(null)

  const canManage = ['admin', 'manager', 'principal'].includes(role)
  const canDelete = ['admin', 'manager'].includes(role)

  const { data: surveys = [], isLoading } = useQuery<SurveyItem[]>({
    queryKey: ['surveys'],
    queryFn: async () => {
      const r = await api.get('/surveys')
      return r.data.data as SurveyItem[]
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await api.patch(`/surveys/${id}/status`, { status })
      return r.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surveys'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/surveys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['surveys'] }),
  })

  const columns: ColumnsType<SurveyItem> = [
    {
      title: t('surveys.survey', 'Survey'),
      key: 'survey',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.title}</Text>
          {r.description && (
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: r.description }}>
              {r.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('surveys.category', 'Category'),
      dataIndex: 'category',
      key: 'category',
      render: v => <Tag color={CATEGORY_COLOR[v] ?? 'blue'}>{v.replace('_', ' ')}</Tag>,
      width: 160,
    },
    {
      title: t('surveys.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      render: v => <Badge status={v === 'ACTIVE' ? 'processing' : v === 'CLOSED' ? 'success' : 'default'} text={v} />,
      width: 90,
    },
    {
      title: t('surveys.anon', 'Anon'),
      dataIndex: 'isAnonymous',
      key: 'isAnonymous',
      render: v => v ? <Tag color="purple">Yes</Tag> : <Tag>No</Tag>,
      width: 70,
    },
    {
      title: t('surveys.questions', 'Qs'),
      key: 'qCount',
      render: (_, r) => r._count.questions,
      width: 50,
    },
    {
      title: t('surveys.responses', 'Responses'),
      key: 'rCount',
      render: (_, r) => <Text strong style={{ color: '#1677ff' }}>{r._count.responses}</Text>,
      width: 80,
    },
    {
      title: t('surveys.dates', 'Dates'),
      key: 'dates',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11 }}>{t('surveys.from', 'From')}: {fmtDate(r.startDate)}</Text>
          <Text style={{ fontSize: 11 }}>{t('surveys.to', 'To')}: {fmtDate(r.endDate)}</Text>
        </Space>
      ),
      width: 130,
    },
    ...(canManage ? [{
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 160,
      render: (_: unknown, r: SurveyItem) => (
        <Space size={4} wrap>
          {/* Activate */}
          {r.status === 'DRAFT' && (
            <Button
              size="small"
              type="primary"
              icon={<Play size={12} />}
              onClick={() => {
                if (r._count.questions === 0) {
                  message.warning(t('surveys.noQuestionsWarning', 'Please add at least one question before activating.'))
                  return
                }
                Modal.confirm({
                  title: t('surveys.activateConfirm', 'Activate this survey?'),
                  content: t('surveys.activateContent', 'Staff will be able to respond once activated.'),
                  onOk: () => statusMutation.mutate({ id: r.id, status: 'ACTIVE' }),
                })
              }}
            >
              {t('surveys.activate', 'Activate')}
            </Button>
          )}
          {/* Close */}
          {r.status === 'ACTIVE' && (
            <Button
              size="small"
              icon={<Square size={12} />}
              onClick={() => Modal.confirm({
                title: t('surveys.closeConfirm', 'Close this survey?'),
                onOk: () => statusMutation.mutate({ id: r.id, status: 'CLOSED' }),
              })}
            >
              {t('surveys.close', 'Close')}
            </Button>
          )}
          {/* Results */}
          {r.status !== 'DRAFT' && (
            <Button
              size="small"
              icon={<BarChart2 size={12} />}
              onClick={() => setResultsId(r.id)}
            >
              {t('surveys.results', 'Results')}
            </Button>
          )}
          {/* Delete */}
          {canDelete && r.status !== 'ACTIVE' && (
            <Popconfirm
              title={t('surveys.deleteConfirm', 'Delete this survey?')}
              onConfirm={() => deleteMutation.mutate(r.id)}
            >
              <Button size="small" danger icon={<Trash2 size={12} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <ClipboardList size={20} />
            <Title level={4} style={{ margin: 0 }}>{t('surveys.pageTitle', 'Staff Surveys')}</Title>
          </Space>
        </Col>
        {canManage && (
          <Col>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              {t('surveys.create', 'Create Survey')}
            </Button>
          </Col>
        )}
      </Row>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : surveys.length === 0 ? (
          <Empty description={t('surveys.noSurveys', 'No surveys yet')} />
        ) : (
          <Table
            columns={columns}
            dataSource={surveys}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 12 }}
            scroll={{ x: 800 }}
          />
        )}
      </Card>

      <SurveyFormModal open={createOpen} onClose={() => setCreateOpen(false)} editing={null} />
      <ResultsDrawer surveyId={resultsId} onClose={() => setResultsId(null)} />
    </div>
  )
}
