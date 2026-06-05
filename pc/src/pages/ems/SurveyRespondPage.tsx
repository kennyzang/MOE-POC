import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Button, Form, Input, Rate, Radio, Space, Typography, Alert,
  Spin, Tag, Result, Progress,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ClipboardList, ChevronLeft, ChevronRight, Send, Lock } from 'lucide-react'
import api from '../../lib/api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

// ─── Types ────────────────────────────────────────────────────────

interface SurveyQuestion {
  id: string
  order: number
  text: string
  type: 'RATING' | 'TEXT' | 'MULTIPLE_CHOICE' | 'YES_NO'
  options: string | null
  required: boolean
}

interface SurveyDetail {
  id: string
  title: string
  description: string | null
  category: string
  isAnonymous: boolean
  status: string
  hasResponded: boolean
  questions: SurveyQuestion[]
  _count: { responses: number }
}

const CATEGORY_COLOR: Record<string, string> = {
  GENERAL: 'blue', PROFESSIONAL_DEVELOPMENT: 'green',
  WELL_BEING: 'purple', SCHOOL_MANAGEMENT: 'orange',
}

// ─── Individual question renderer ─────────────────────────────────

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()

  if (question.type === 'RATING') {
    const ratingLabels: Record<number, string> = {
      1: t('surveys.ratingPoor', 'Poor'),
      2: t('surveys.ratingFair', 'Fair'),
      3: t('surveys.ratingGood', 'Good'),
      4: t('surveys.ratingVeryGood', 'Very Good'),
      5: t('surveys.ratingExcellent', 'Excellent'),
    }
    const num = Number(value) || 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <Rate
          value={num}
          onChange={v => onChange(String(v))}
          style={{ fontSize: 32 }}
        />
        {num > 0 && (
          <Text type="secondary" style={{ fontSize: 13 }}>{ratingLabels[num]}</Text>
        )}
      </div>
    )
  }

  if (question.type === 'YES_NO') {
    return (
      <Radio.Group value={value} onChange={e => onChange(e.target.value)}>
        <Space>
          <Radio.Button value="Yes">{t('surveys.yes', 'Yes')}</Radio.Button>
          <Radio.Button value="No">{t('surveys.no', 'No')}</Radio.Button>
        </Space>
      </Radio.Group>
    )
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    let options: string[] = []
    try { options = question.options ? JSON.parse(question.options) : [] } catch { options = [] }
    return (
      <Radio.Group value={value} onChange={e => onChange(e.target.value)}>
        <Space direction="vertical">
          {options.map(opt => <Radio key={opt} value={opt}>{opt}</Radio>)}
        </Space>
      </Radio.Group>
    )
  }

  // TEXT
  return (
    <TextArea
      rows={3}
      maxLength={500}
      showCount
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={t('surveys.textPlaceholder', 'Your answer...')}
    />
  )
}

// ─── Main page ────────────────────────────────────────────────────

export default function SurveyRespondPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const { data: survey, isLoading, error } = useQuery<SurveyDetail>({
    queryKey: ['survey', id],
    queryFn: async () => {
      const r = await api.get(`/surveys/${id}`)
      return r.data.data as SurveyDetail
    },
    enabled: !!id,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const answerArray = Object.entries(answers).map(([questionId, value]) => ({ questionId, value }))
      const r = await api.post(`/surveys/${id}/respond`, { answers: answerArray })
      return r.data
    },
    onSuccess: () => setSubmitted(true),
  })

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  if (error || !survey) {
    return (
      <div style={{ padding: 40 }}>
        <Alert type="error" message={t('surveys.loadError', 'Failed to load survey')} />
      </div>
    )
  }

  // Already responded
  if (survey.hasResponded) {
    return (
      <div style={{ maxWidth: 600, margin: '48px auto', padding: '0 16px' }}>
        <Result
          status="success"
          title={t('surveys.alreadyRespondedTitle', 'Already Submitted')}
          subTitle={t('surveys.alreadyRespondedMsg', 'You have already responded to this survey. Thank you!')}
          extra={
            <Button onClick={() => navigate('/ems/surveys')}>{t('surveys.backToSurveys', 'Back to Surveys')}</Button>
          }
        />
      </div>
    )
  }

  // Submitted successfully
  if (submitted) {
    return (
      <div style={{ maxWidth: 600, margin: '48px auto', padding: '0 16px' }}>
        <Result
          status="success"
          title={t('surveys.thankYouTitle', 'Thank You!')}
          subTitle={t('surveys.thankYouMsg', 'Your response has been recorded. Your feedback helps improve our school.')}
          extra={
            <Button type="primary" onClick={() => navigate('/ems/surveys')}>
              {t('surveys.backToSurveys', 'Back to Surveys')}
            </Button>
          }
        />
      </div>
    )
  }

  // Survey not active
  if (survey.status !== 'ACTIVE') {
    return (
      <div style={{ maxWidth: 600, margin: '48px auto', padding: '0 16px' }}>
        <Alert
          type="warning"
          message={t('surveys.notActive', 'This survey is not currently accepting responses.')}
          action={<Button size="small" onClick={() => navigate('/ems/surveys')}>{t('surveys.back', 'Back')}</Button>}
        />
      </div>
    )
  }

  const questions = survey.questions
  const total = questions.length
  const q = questions[currentQ]
  const pct = total > 0 ? Math.round(((currentQ + 1) / total) * 100) : 0

  const currentAnswer = answers[q?.id ?? ''] ?? ''
  const canNext = !q?.required || currentAnswer.trim().length > 0
  const isLast = currentQ === total - 1

  const handleNext = () => {
    if (isLast) {
      mutation.mutate()
    } else {
      setCurrentQ(i => i + 1)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      {/* Survey header */}
      <Card bordered={false} style={{ borderRadius: 16, marginBottom: 16, background: '#f0f5ff' }}>
        <Space align="start" size={12}>
          <ClipboardList size={22} style={{ color: '#1677ff', marginTop: 2 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>{survey.title}</Title>
            <Space size={8} style={{ marginTop: 4 }} wrap>
              <Tag color={CATEGORY_COLOR[survey.category] ?? 'blue'}>{survey.category.replace('_', ' ')}</Tag>
              {survey.isAnonymous && (
                <Tag icon={<Lock size={10} />} color="purple">
                  {t('surveys.anonymous', 'Anonymous')}
                </Tag>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {survey._count.responses} {t('surveys.responsesCount', 'responses so far')}
              </Text>
            </Space>
            {survey.description && (
              <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
                {survey.description}
              </Paragraph>
            )}
          </div>
        </Space>
      </Card>

      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('surveys.questionOf', `Question ${currentQ + 1} of ${total}`)}
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>{pct}%</Text>
        </Space>
        <Progress percent={pct} showInfo={false} strokeColor="#1677ff" />
      </div>

      {/* Question card */}
      {q && (
        <Card bordered={false} style={{ borderRadius: 16, marginBottom: 16 }}>
          <Space align="start" style={{ marginBottom: 20 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#e6f4ff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <Text style={{ color: '#1677ff', fontSize: 13, fontWeight: 600 }}>{currentQ + 1}</Text>
            </div>
            <div>
              <Text strong style={{ fontSize: 15 }}>{q.text}</Text>
              {q.required && <Text type="danger" style={{ fontSize: 12, marginLeft: 4 }}>*</Text>}
            </div>
          </Space>

          <QuestionInput
            question={q}
            value={currentAnswer}
            onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
          />

          {q.required && !currentAnswer.trim() && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              {t('surveys.requiredNote', '* This question is required')}
            </Text>
          )}
        </Card>
      )}

      {/* Navigation */}
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button
          icon={<ChevronLeft size={14} />}
          disabled={currentQ === 0}
          onClick={() => setCurrentQ(i => i - 1)}
        >
          {t('surveys.previous', 'Previous')}
        </Button>

        <Button
          type="primary"
          icon={isLast ? <Send size={14} /> : <ChevronRight size={14} />}
          iconPosition="end"
          disabled={!canNext}
          loading={mutation.isPending}
          onClick={handleNext}
        >
          {isLast ? t('surveys.submit', 'Submit') : t('surveys.next', 'Next')}
        </Button>
      </Space>

      {mutation.isError && (
        <Alert
          type="error"
          message={t('surveys.submitError', 'Failed to submit. Please try again.')}
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  )
}
