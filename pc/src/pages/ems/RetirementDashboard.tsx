import { useState } from 'react'
import {
  Card, Row, Col, Typography, Space, Table, Tag, Button, Modal,
  Form, Select, Input, Statistic, Badge, Alert, Spin, Tooltip, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, AlertTriangle, Clock, CalendarClock, Bell, CheckCircle2, XCircle, Download,
} from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography
const { TextArea } = Input

// ─── Types ────────────────────────────────────────────────────────

interface EligibilityInfo {
  teacherId: string
  teacherName: string
  staffId: string
  department: string | null
  currentAge: number | null
  serviceYears: number | null
  eligibleRetirementDate: string | null
  daysUntilEligible: number | null
  isEligible: boolean
  canApplyEarlyRetirement: boolean
  urgencyLevel: 'NONE' | 'WATCH' | 'URGENT' | 'OVERDUE'
  hasApplication: boolean
  applicationStatus: string | null
}

interface UpcomingData {
  teachers: EligibilityInfo[]
  summary: { overdue: number; urgent: number; watch: number; total: number }
}

interface Application {
  id: string
  teacherName: string
  department: string | null
  staffId: string
  retirementType: string
  requestedDate: string
  reason: string | null
  status: string
  submittedAt: string
  reviewedAt: string | null
  reviewRemarks: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────

const urgencyColor: Record<string, string> = {
  OVERDUE: 'red', URGENT: 'orange', WATCH: 'blue', NONE: 'default',
}
const appStatusColor: Record<string, string> = {
  SUBMITTED: 'processing', UNDER_REVIEW: 'warning', APPROVED: 'success', REJECTED: 'error',
}

function fmtDate(iso: string | null) {
  return iso ? dayjs(iso).format('D MMM YYYY') : '—'
}

// ─── Review Modal ─────────────────────────────────────────────────

function ReviewModal({ app, onClose }: { app: Application | null; onClose: () => void }) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ status, reviewRemarks }: { status: string; reviewRemarks?: string }) => {
      const r = await api.patch(`/retirement/applications/${app!.id}`, { status, reviewRemarks })
      return r.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retirementApplications'] })
      onClose()
      form.resetFields()
    },
  })

  return (
    <Modal
      open={!!app}
      onCancel={onClose}
      title={t('retirement.reviewApplication', 'Review Application')}
      footer={null}
      width={520}
    >
      {app && (
        <>
          <div style={{ background: '#fafafa', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <Text strong>{app.teacherName}</Text>
            <div><Text type="secondary">{app.staffId} · {app.department ?? '—'}</Text></div>
            <div><Text type="secondary">{t('retirement.type', 'Type')}: {app.retirementType.replace('_', ' ')}</Text></div>
            <div><Text type="secondary">{t('retirement.requestedDate', 'Requested Last Day')}: {fmtDate(app.requestedDate)}</Text></div>
            {app.reason && <div><Text type="secondary">{t('retirement.reason', 'Reason')}: {app.reason}</Text></div>}
          </div>
          <Form form={form} layout="vertical" onFinish={v => mutation.mutate(v as Parameters<typeof mutation.mutate>[0])}>
            <Form.Item name="status" label={t('retirement.decision', 'Decision')} rules={[{ required: true }]}>
              <Select>
                <Select.Option value="UNDER_REVIEW">{t('retirement.underReview', 'Mark as Under Review')}</Select.Option>
                <Select.Option value="APPROVED">{t('retirement.approve', 'Approve')}</Select.Option>
                <Select.Option value="REJECTED">{t('retirement.reject', 'Reject')}</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="reviewRemarks" label={t('retirement.remarks', 'Remarks (optional)')}>
              <TextArea rows={3} maxLength={500} showCount />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
                <Button type="primary" htmlType="submit" loading={mutation.isPending}>
                  {t('common.save', 'Save')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  )
}

// ─── CSV export helper ────────────────────────────────────────────

function exportUpcomingCsv(teachers: EligibilityInfo[]) {
  const header = ['Name', 'Staff ID', 'Department', 'Age', 'Service (yrs)', 'Eligible From', 'Days Until Eligible', 'Urgency', 'Application']
  const rows = teachers.map(t => [
    t.teacherName,
    t.staffId,
    t.department ?? '',
    t.currentAge ?? '',
    t.serviceYears ?? '',
    t.eligibleRetirementDate ? dayjs(t.eligibleRetirementDate).format('YYYY-MM-DD') : '',
    t.daysUntilEligible ?? '',
    t.urgencyLevel,
    t.hasApplication ? (t.applicationStatus ?? '') : 'None',
  ])
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `upcoming-retirements-${dayjs().format('YYYY-MM-DD')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main ─────────────────────────────────────────────────────────

export default function RetirementDashboard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const role = user?.role ?? ''
  const qc = useQueryClient()
  const [reviewApp, setReviewApp] = useState<Application | null>(null)

  const { data: upcoming, isLoading: upcomingLoading } = useQuery<UpcomingData>({
    queryKey: ['retirementUpcoming'],
    queryFn: async () => {
      const r = await api.get('/retirement/upcoming?months=12')
      return r.data.data as UpcomingData
    },
  })

  const { data: applications, isLoading: appsLoading } = useQuery<Application[]>({
    queryKey: ['retirementApplications'],
    queryFn: async () => {
      const r = await api.get('/retirement/applications')
      return r.data.data as Application[]
    },
    enabled: ['admin', 'manager', 'principal'].includes(role),
  })

  const runAlertsMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post('/retirement/run-alerts', {})
      return r.data
    },
    onSuccess: d => {
      Modal.success({ title: t('retirement.alertsSent', 'Alerts Sent'), content: `${d.data.notified} staff notified.` })
      qc.invalidateQueries({ queryKey: ['retirementUpcoming'] })
    },
  })

  const notifyTeacherMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      const r = await api.post(`/retirement/notify-teacher/${teacherId}`, {})
      return r.data
    },
    onSuccess: d => {
      message.success(`Notification sent to ${d.data.teacherName}.`)
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? 'Failed to send notification.')
    },
  })

  // HOD department (for context label)
  const hodDept = role === 'hod' ? upcoming?.teachers[0]?.department : undefined

  // Upcoming table columns
  const upcomingCols: ColumnsType<EligibilityInfo> = [
    {
      title: t('common.name', 'Name'),
      dataIndex: 'teacherName',
      key: 'teacherName',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.staffId}</Text>
        </Space>
      ),
    },
    { title: t('common.department', 'Dept'), dataIndex: 'department', key: 'department', render: v => v ?? '—' },
    { title: t('retirement.currentAge', 'Age'), dataIndex: 'currentAge', key: 'currentAge', render: v => v ?? '—', width: 60 },
    { title: t('retirement.serviceYears', 'Service'), dataIndex: 'serviceYears', key: 'serviceYears', render: v => v != null ? `${v} yrs` : '—', width: 80 },
    {
      title: t('retirement.eligibleDate', 'Eligible From'),
      dataIndex: 'eligibleRetirementDate',
      key: 'eligibleRetirementDate',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text>{fmtDate(v)}</Text>
          {r.daysUntilEligible !== null && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {r.daysUntilEligible < 0
                ? `${Math.abs(r.daysUntilEligible)}d overdue`
                : `in ${r.daysUntilEligible}d`}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('retirement.urgency', 'Urgency'),
      dataIndex: 'urgencyLevel',
      key: 'urgencyLevel',
      render: v => <Tag color={urgencyColor[v] ?? 'default'}>{v.replace('_', ' ')}</Tag>,
      filters: [
        { text: 'OVERDUE', value: 'OVERDUE' },
        { text: 'URGENT', value: 'URGENT' },
        { text: 'WATCH', value: 'WATCH' },
      ],
      onFilter: (value, r) => r.urgencyLevel === value,
    },
    {
      title: t('retirement.applicationStatus', 'Application'),
      key: 'app',
      render: (_, r) => r.hasApplication
        ? <Tag color={appStatusColor[r.applicationStatus ?? ''] ?? 'default'}>{(r.applicationStatus ?? '').replace('_', ' ')}</Tag>
        : <Text type="secondary">—</Text>,
    },
    ...(['admin', 'manager'].includes(role) ? [{
      title: '',
      key: 'notify',
      width: 80,
      render: (_: unknown, r: EligibilityInfo) => (
        !r.hasApplication ? (
          <Tooltip title={`Send retirement reminder to ${r.teacherName}`}>
            <Button
              size="small"
              icon={<Bell size={12} />}
              loading={notifyTeacherMutation.isPending}
              onClick={() => Modal.confirm({
                title: 'Send Reminder',
                content: `Send a retirement notification to ${r.teacherName}?`,
                onOk: () => notifyTeacherMutation.mutate(r.teacherId),
              })}
            >
              Notify
            </Button>
          </Tooltip>
        ) : null
      ),
    }] as ColumnsType<EligibilityInfo> : []),
  ]

  // Applications table columns
  const appCols: ColumnsType<Application> = [
    {
      title: t('common.name', 'Name'),
      dataIndex: 'teacherName',
      key: 'teacherName',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.staffId} · {r.department ?? '—'}</Text>
        </Space>
      ),
    },
    { title: t('retirement.type', 'Type'), dataIndex: 'retirementType', key: 'retirementType', render: v => v.replace('_', ' '), width: 120 },
    { title: t('retirement.requestedDate', 'Requested Date'), dataIndex: 'requestedDate', key: 'requestedDate', render: fmtDate },
    { title: t('retirement.submitted', 'Submitted'), dataIndex: 'submittedAt', key: 'submittedAt', render: fmtDate },
    {
      title: t('common.status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      render: v => <Tag color={appStatusColor[v] ?? 'default'}>{v.replace('_', ' ')}</Tag>,
      filters: [
        { text: 'SUBMITTED', value: 'SUBMITTED' },
        { text: 'UNDER REVIEW', value: 'UNDER_REVIEW' },
        { text: 'APPROVED', value: 'APPROVED' },
        { text: 'REJECTED', value: 'REJECTED' },
      ],
      onFilter: (v, r) => r.status === v,
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      render: (_, r) => (
        r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW'
          ? (
            <Button size="small" onClick={() => setReviewApp(r)}>
              {t('retirement.review', 'Review')}
            </Button>
          ) : (
            <Tooltip title={r.reviewRemarks ?? undefined}>
              <Space>
                {r.status === 'APPROVED'
                  ? <CheckCircle2 size={14} style={{ color: '#52c41a' }} />
                  : <XCircle size={14} style={{ color: '#ff4d4f' }} />}
                <Text type="secondary" style={{ fontSize: 12 }}>{fmtDate(r.reviewedAt)}</Text>
              </Space>
            </Tooltip>
          )
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space align="center">
            <CalendarClock size={20} />
            <Title level={4} style={{ margin: 0 }}>{t('retirement.dashboard', 'Retirement Management')}</Title>
            {role === 'hod' && hodDept && (
              <Tag color="blue" style={{ fontSize: 12 }}>{hodDept} Dept</Tag>
            )}
          </Space>
        </Col>
        {['admin', 'manager'].includes(role) && (
          <Col>
            <Space>
              <Button
                icon={<Download size={14} />}
                disabled={!upcoming?.teachers?.length}
                onClick={() => exportUpcomingCsv(upcoming?.teachers ?? [])}
              >
                {t('retirement.exportCsv', 'Export CSV')}
              </Button>
              <Button
                icon={<Bell size={14} />}
                onClick={() => Modal.confirm({
                  title: t('retirement.runAlertsTitle', 'Send Retirement Notifications'),
                  content: t('retirement.runAlertsContent', 'This will notify all teachers with upcoming retirement dates who have not yet applied. Continue?'),
                  onOk: () => runAlertsMutation.mutate(),
                })}
                loading={runAlertsMutation.isPending}
              >
                {t('retirement.runAlerts', 'Send All Alerts')}
              </Button>
            </Space>
          </Col>
        )}
      </Row>

      {/* Summary stat cards */}
      {upcomingLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card bordered={false} style={{ borderRadius: 12, background: '#fff2f0' }}>
                <Statistic
                  title={<Space><AlertTriangle size={14} style={{ color: '#ff4d4f' }} />{t('retirement.overdue', 'Overdue')}</Space>}
                  value={upcoming?.summary.overdue ?? 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card bordered={false} style={{ borderRadius: 12, background: '#fffbe6' }}>
                <Statistic
                  title={<Space><Clock size={14} style={{ color: '#faad14' }} />{t('retirement.urgent', 'Urgent (6 mo)')}</Space>}
                  value={upcoming?.summary.urgent ?? 0}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card bordered={false} style={{ borderRadius: 12, background: '#e6f4ff' }}>
                <Statistic
                  title={<Space><CalendarClock size={14} style={{ color: '#1677ff' }} />{t('retirement.watch', 'Watch (1 yr)')}</Space>}
                  value={upcoming?.summary.watch ?? 0}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card bordered={false} style={{ borderRadius: 12 }}>
                <Statistic
                  title={<Space><Users size={14} />{t('retirement.total', 'Total Flagged')}</Space>}
                  value={upcoming?.summary.total ?? 0}
                />
              </Card>
            </Col>
          </Row>

          {/* Upcoming retirements table */}
          {(upcoming?.summary.total ?? 0) === 0 ? (
            <Alert
              type="success"
              showIcon
              message={t('retirement.noUpcoming', 'No staff are approaching retirement within the next 12 months.')}
              style={{ marginBottom: 24 }}
            />
          ) : (
            <Card
              title={
                <Space>
                  <AlertTriangle size={16} />
                  {t('retirement.upcomingTitle', 'Upcoming Retirements (Next 12 Months)')}
                  <Badge count={upcoming?.summary.total ?? 0} />
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12, marginBottom: 24 }}
            >
              <Table
                columns={upcomingCols}
                dataSource={upcoming?.teachers ?? []}
                rowKey="teacherId"
                size="small"
                pagination={{ pageSize: 10 }}
                scroll={{ x: 760 }}
                rowClassName={r => r.urgencyLevel === 'OVERDUE' ? 'ant-table-row-danger' : ''}
              />
            </Card>
          )}

          {/* Applications table — admin/principal only */}
          {['admin', 'manager', 'principal'].includes(role) && (
            <Card
              title={
                <Space>
                  <CheckCircle2 size={16} />
                  {t('retirement.applications', 'Retirement Applications')}
                  {applications && <Badge count={applications.filter(a => a.status === 'SUBMITTED').length} />}
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12 }}
            >
              {appsLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
              ) : (applications?.length ?? 0) === 0 ? (
                <Text type="secondary">{t('retirement.noApplications', 'No applications submitted yet.')}</Text>
              ) : (
                <Table
                  columns={appCols}
                  dataSource={applications ?? []}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 760 }}
                />
              )}
            </Card>
          )}
        </>
      )}

      <ReviewModal app={reviewApp} onClose={() => setReviewApp(null)} />
    </div>
  )
}
