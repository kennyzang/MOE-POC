import { useState } from 'react'
import {
  Card, Row, Col, Typography, Space, Tag, Button, Alert, Progress,
  Descriptions, Modal, Form, DatePicker, Select, Input, Upload,
  Timeline, Spin, Statistic,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock, Clock, Award, FileText, CheckCircle2,
  AlertTriangle, HelpCircle, UploadCloud,
} from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

// ─── Types ────────────────────────────────────────────────────────

interface EligibilityInfo {
  teacherId: string
  teacherName: string
  staffId: string
  department: string | null
  dateOfBirth: string | null
  joinDate: string | null
  serviceYears: number | null
  currentAge: number | null
  mandatoryRetirementDate: string | null
  serviceRetirementDate: string | null
  eligibleRetirementDate: string | null
  daysUntilEligible: number | null
  isEligible: boolean
  canApplyEarlyRetirement: boolean
  urgencyLevel: 'NONE' | 'WATCH' | 'URGENT' | 'OVERDUE'
  hasApplication: boolean
  applicationStatus: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────

function urgencyTag(level: EligibilityInfo['urgencyLevel']) {
  const map: Record<typeof level, { color: string; label: string }> = {
    NONE:    { color: 'default', label: 'No Action' },
    WATCH:   { color: 'processing', label: 'Within 1 Year' },
    URGENT:  { color: 'warning',    label: 'Within 6 Months' },
    OVERDUE: { color: 'error',      label: 'Overdue' },
  }
  const { color, label } = map[level]
  return <Tag color={color}>{label}</Tag>
}

function appStatusTag(s: string | null) {
  if (!s) return null
  const map: Record<string, { color: string }> = {
    SUBMITTED:    { color: 'processing' },
    UNDER_REVIEW: { color: 'warning' },
    APPROVED:     { color: 'success' },
    REJECTED:     { color: 'error' },
  }
  return <Tag color={map[s]?.color ?? 'default'}>{s.replace('_', ' ')}</Tag>
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return dayjs(iso).format('D MMM YYYY')
}

function yearsProgress(serviceYears: number | null, target: number) {
  if (serviceYears === null) return 0
  return Math.min(Math.round((serviceYears / target) * 100), 100)
}

// ─── Apply Modal ──────────────────────────────────────────────────

function ApplyModal({
  open,
  onClose,
  canEarly,
}: {
  open: boolean; onClose: () => void; canEarly: boolean
}) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: {
      retirementType: string; requestedDate: dayjs.Dayjs; reason?: string; documentUrl?: string
    }) => {
      const r = await api.post('/retirement/apply', {
        retirementType: values.retirementType,
        requestedDate: values.requestedDate.toISOString(),
        reason: values.reason,
        documentUrl: values.documentUrl,
      })
      return r.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retirementMyStatus'] })
      onClose()
      form.resetFields()
      Modal.success({ title: t('retirement.applicationSubmitted', 'Application Submitted'), content: t('retirement.hrWillReview', 'HR will review your application and notify you.') })
    },
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <FileText size={16} />
          {t('retirement.applyTitle', 'Apply for Retirement')}
        </Space>
      }
      footer={null}
      width={540}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={v => mutation.mutate(v as Parameters<typeof mutation.mutate>[0])}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="retirementType"
          label={t('retirement.type', 'Retirement Type')}
          initialValue="NORMAL"
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="NORMAL">{t('retirement.typeNormal', 'Normal (Mandatory Age)')}</Select.Option>
            {canEarly && (
              <Select.Option value="VOLUNTARY_EARLY">{t('retirement.typeEarly', 'Voluntary Early Retirement')}</Select.Option>
            )}
            <Select.Option value="MEDICAL">{t('retirement.typeMedical', 'Medical / Incapacity')}</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="requestedDate"
          label={t('retirement.requestedDate', 'Requested Last Working Day')}
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: '100%' }} disabledDate={d => d.isBefore(dayjs())} />
        </Form.Item>

        <Form.Item
          name="reason"
          label={t('retirement.reason', 'Reason / Additional Notes')}
        >
          <TextArea rows={3} maxLength={500} showCount />
        </Form.Item>

        <Form.Item
          name="documentUrl"
          label={t('retirement.supportingDoc', 'Supporting Document (optional)')}
        >
          <Input placeholder="https://..." />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              {t('retirement.submit', 'Submit Application')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────

export default function MyRetirementPage() {
  const { t } = useTranslation()
  const [applyOpen, setApplyOpen] = useState(false)

  const { data, isLoading } = useQuery<EligibilityInfo>({
    queryKey: ['retirementMyStatus'],
    queryFn: async () => {
      const r = await api.get('/retirement/my-status')
      return r.data.data as EligibilityInfo
    },
  })

  if (isLoading) return <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>
  if (!data) return null

  const progressToMandatory = yearsProgress(data.currentAge, 55)
  const progressToService   = yearsProgress(data.serviceYears, 30)

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Space style={{ marginBottom: 24 }} align="center">
        <CalendarClock size={22} />
        <Title level={4} style={{ margin: 0 }}>{t('retirement.myRetirement', 'My Retirement Status')}</Title>
        {urgencyTag(data.urgencyLevel)}
      </Space>

      {/* Alert for approaching / overdue */}
      {data.urgencyLevel !== 'NONE' && !data.hasApplication && (
        <Alert
          type={data.urgencyLevel === 'OVERDUE' ? 'error' : 'warning'}
          showIcon
          icon={<AlertTriangle size={16} />}
          message={
            data.urgencyLevel === 'OVERDUE'
              ? t('retirement.overdueMsg', 'You have passed your mandatory retirement date. Please submit a formal retirement application.')
              : t('retirement.approachingMsg', `Your retirement eligibility date is in ${data.daysUntilEligible} days. You may begin the retirement process.`)
          }
          action={
            <Button size="small" type="primary" onClick={() => setApplyOpen(true)}>
              {t('retirement.applyNow', 'Apply Now')}
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Application status banner */}
      {data.hasApplication && (
        <Alert
          type={data.applicationStatus === 'APPROVED' ? 'success' : data.applicationStatus === 'REJECTED' ? 'error' : 'info'}
          showIcon
          message={
            <Space>
              {t('retirement.applicationStatus', 'Application Status:')}
              {appStatusTag(data.applicationStatus)}
            </Space>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Key dates */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#f0f5ff' }}>
            <Statistic
              title={<Space><Clock size={14} />{t('retirement.currentAge', 'Current Age')}</Space>}
              value={data.currentAge ?? '—'}
              suffix={data.currentAge ? t('retirement.years', 'yrs') : ''}
              valueStyle={{ color: '#2f54eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#f6ffed' }}>
            <Statistic
              title={<Space><Award size={14} />{t('retirement.serviceYears', 'Years of Service')}</Space>}
              value={data.serviceYears ?? '—'}
              suffix={data.serviceYears !== null ? t('retirement.years', 'yrs') : ''}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card bordered={false} style={{ borderRadius: 12, background: data.daysUntilEligible !== null && data.daysUntilEligible < 0 ? '#fff2f0' : '#fffbe6' }}>
            <Statistic
              title={<Space><CalendarClock size={14} />{t('retirement.daysUntilEligible', 'Days Until Eligible')}</Space>}
              value={data.daysUntilEligible !== null ? Math.abs(data.daysUntilEligible) : '—'}
              suffix={data.daysUntilEligible !== null ? (data.daysUntilEligible < 0 ? t('retirement.overdue', '(overdue)') : t('retirement.days', 'days')) : ''}
              valueStyle={{ color: data.daysUntilEligible !== null && data.daysUntilEligible < 0 ? '#ff4d4f' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Progress bars */}
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 16 }}>{t('retirement.progressTitle', 'Retirement Progress')}</Title>
        <Row gutter={[24, 20]}>
          <Col xs={24} md={12}>
            <Text type="secondary">{t('retirement.ageProgress', 'Age Progress (Mandatory at 55)')}</Text>
            <Progress
              percent={progressToMandatory}
              strokeColor={progressToMandatory >= 90 ? '#ff4d4f' : progressToMandatory >= 75 ? '#faad14' : '#1677ff'}
              format={() => `${data.currentAge ?? '?'}/55 yrs`}
              style={{ marginTop: 4 }}
            />
          </Col>
          <Col xs={24} md={12}>
            <Text type="secondary">{t('retirement.serviceProgress', 'Service Progress (Full at 30 years)')}</Text>
            <Progress
              percent={progressToService}
              strokeColor={progressToService >= 90 ? '#52c41a' : '#1677ff'}
              format={() => `${data.serviceYears ?? '?'}/30 yrs`}
              style={{ marginTop: 4 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Key dates */}
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 16 }}>{t('retirement.keyDates', 'Key Dates')}</Title>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label={t('retirement.dob', 'Date of Birth')}>
            {fmtDate(data.dateOfBirth)}
          </Descriptions.Item>
          <Descriptions.Item label={t('retirement.joinDate', 'Service Start')}>
            {fmtDate(data.joinDate)}
          </Descriptions.Item>
          <Descriptions.Item label={t('retirement.mandatoryDate', 'Mandatory Retirement (Age 55)')}>
            <Text style={{ color: '#2f54eb' }}>{fmtDate(data.mandatoryRetirementDate)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('retirement.serviceDate', 'Full Service Retirement (30 yrs)')}>
            <Text style={{ color: '#52c41a' }}>{fmtDate(data.serviceRetirementDate)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('retirement.eligibleDate', 'Eligible From (Earliest)')}>
            <Text strong>{fmtDate(data.eligibleRetirementDate)}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Early retirement eligibility */}
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 24 }}>
        <Space align="start">
          {data.canApplyEarlyRetirement
            ? <CheckCircle2 size={20} style={{ color: '#52c41a', marginTop: 2 }} />
            : <HelpCircle size={20} style={{ color: '#8c8c8c', marginTop: 2 }} />
          }
          <div>
            <Text strong>{t('retirement.earlyRetirementTitle', 'Voluntary Early Retirement')}</Text>
            <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13 }}>
              {data.canApplyEarlyRetirement
                ? t('retirement.earlyEligibleMsg', 'You are eligible to apply for voluntary early retirement (age ≥ 50 or ≥ 25 years of service).')
                : t('retirement.earlyNotEligibleMsg', 'Eligible after reaching age 50 or completing 25 years of service.')}
            </Paragraph>
          </div>
        </Space>
      </Card>

      {/* Apply button */}
      {!data.hasApplication && (data.isEligible || data.canApplyEarlyRetirement || data.urgencyLevel !== 'NONE') && (
        <Button
          type="primary"
          size="large"
          icon={<FileText size={16} />}
          onClick={() => setApplyOpen(true)}
          style={{ borderRadius: 10 }}
        >
          {t('retirement.applyBtn', 'Submit Retirement Application')}
        </Button>
      )}

      <ApplyModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        canEarly={data.canApplyEarlyRetirement}
      />
    </div>
  )
}
