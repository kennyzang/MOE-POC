import { useState } from 'react'
import {
  Card, Table, Tag, Button, Select, Drawer, Descriptions, Space,
  Typography, Progress, Input, Form, message, Spin, Row, Col, Statistic,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, AlertTriangle, MessageSquare } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { ColumnsType } from 'antd/es/table'
import api from '@/lib/api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface CaseRow {
  id: string
  studentId: string
  studentName: string
  openedReason: string
  status: string
  openedAt: string
  resolvedAt: string | null
  notes: string | null
  currentRiskBand: string | null
  currentRiskScore: number | null
}

interface CaseDetail extends CaseRow {
  attendanceRate: number
  gpa: number
  riskHistory: { score: number; band: string; gradeAvg: number | null; absences14d: number; computedAt: string }[]
  parents: { name: string; email: string | null }[]
}

const RISK_COLORS: Record<string, string> = { HIGH_RISK: '#f5222d', MONITOR: '#fa8c16', ON_TRACK: '#52c41a' }
const RISK_LABELS: Record<string, string> = { HIGH_RISK: 'High Risk', MONITOR: 'Monitor', ON_TRACK: 'On Track' }
const STATUS_COLOR: Record<string, string> = { OPEN: 'red', IN_PROGRESS: 'orange', RESOLVED: 'green', CLOSED: 'default' }
const REASON_LABEL: Record<string, string> = {
  AUTO_RISK_THRESHOLD: 'Risk Threshold',
  AUTO_ABSENCE_THRESHOLD: 'Absence Alert',
  TEACHER_REFERRAL: 'Teacher Referral',
  PARENT_REQUEST: 'Parent Request',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

const RISK_FILTER_OPTIONS = [
  { value: '', label: 'All Risk Bands' },
  { value: 'HIGH_RISK', label: 'High Risk' },
  { value: 'MEDIUM_RISK', label: 'Medium Risk' },
  { value: 'LOW_RISK', label: 'Low Risk' },
]

const CounselorCasesPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [notesForm] = Form.useForm()

  const { data: cases, isLoading } = useQuery({
    queryKey: ['counselor-cases', statusFilter, riskFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (riskFilter) params.riskBand = riskFilter
      const { data } = await api.get('/counselor/cases', { params })
      return data.data as CaseRow[]
    },
  })

  const { data: caseDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['counselor-case-detail', selectedCaseId],
    queryFn: async () => {
      const { data } = await api.get(`/counselor/cases/${selectedCaseId}`)
      return data.data as CaseDetail
    },
    enabled: !!selectedCaseId,
  })

  const updateCase = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status?: string; notes?: string }) => {
      const { data } = await api.patch(`/counselor/cases/${id}`, { status, notes })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['counselor-cases'] })
      void queryClient.invalidateQueries({ queryKey: ['counselor-case-detail', selectedCaseId] })
      void queryClient.invalidateQueries({ queryKey: ['counselor-dashboard'] })
      message.success(t('counselor.caseUpdated', { defaultValue: 'Case updated successfully' }))
    },
  })

  const handleSaveNotes = (values: { notes: string }) => {
    if (!selectedCaseId) return
    updateCase.mutate({ id: selectedCaseId, notes: values.notes })
  }

  const handleStatusChange = (status: string) => {
    if (!selectedCaseId) return
    updateCase.mutate({ id: selectedCaseId, status })
  }

  const openDrawer = (caseId: string) => {
    setSelectedCaseId(caseId)
    setDrawerOpen(true)
  }

  const columns: ColumnsType<CaseRow> = [
    {
      title: t('common.name'),
      dataIndex: 'studentName',
      key: 'studentName',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t('counselor.openedReason', { defaultValue: 'Reason' }),
      dataIndex: 'openedReason',
      key: 'openedReason',
      render: (r: string) => REASON_LABEL[r] ?? r,
    },
    {
      title: t('counselor.riskBand', { defaultValue: 'Risk Band' }),
      key: 'risk',
      render: (_: unknown, record: CaseRow) =>
        record.currentRiskBand ? (
          <Tag color={RISK_COLORS[record.currentRiskBand] ?? 'default'}>
            {RISK_LABELS[record.currentRiskBand] ?? record.currentRiskBand}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s.replace('_', ' ')}</Tag>,
    },
    {
      title: t('counselor.openedAt', { defaultValue: 'Opened' }),
      dataIndex: 'openedAt',
      key: 'openedAt',
      render: (d: string) => new Date(d).toLocaleDateString(),
      sorter: (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: unknown, record: CaseRow) => (
        <Button size="small" onClick={() => openDrawer(record.id)}>
          {t('common.view')}
        </Button>
      ),
    },
  ]

  return (
    <div>
      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>
            <FolderOpen size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            <Title level={4} style={{ margin: 0, display: 'inline' }}>
              {t('counselor.caseManagement', { defaultValue: 'Case Management' })}
            </Title>
          </span>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            style={{ width: 160 }}
          />
          <Select
            value={riskFilter}
            onChange={setRiskFilter}
            options={RISK_FILTER_OPTIONS}
            style={{ width: 160 }}
          />
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={cases ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          locale={{ emptyText: t('common.noData') }}
          size="middle"
        />
      </Card>

      {/* Case Detail Drawer */}
      <Drawer
        title={
          <Space>
            <AlertTriangle size={16} />
            {t('counselor.caseDetail', { defaultValue: 'Case Detail' })}
          </Space>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        destroyOnClose
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : caseDetail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Student Snapshot */}
            <Card size="small">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title={t('dashboard.attendanceRate')}
                    value={caseDetail.attendanceRate}
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: caseDetail.attendanceRate < 75 ? '#f5222d' : '#52c41a', fontSize: 22 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={t('dashboard.gpa')}
                    value={caseDetail.gpa}
                    precision={2}
                    valueStyle={{ fontSize: 22 }}
                  />
                </Col>
              </Row>
              {caseDetail.currentRiskBand && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Risk Band: </Text>
                  <Tag color={RISK_COLORS[caseDetail.currentRiskBand] ?? 'default'}>
                    {RISK_LABELS[caseDetail.currentRiskBand] ?? caseDetail.currentRiskBand}
                  </Tag>
                  {caseDetail.currentRiskScore != null && (
                    <Progress
                      percent={Math.round(caseDetail.currentRiskScore * 100)}
                      size="small"
                      strokeColor={RISK_COLORS[caseDetail.currentRiskBand] ?? '#999'}
                      style={{ marginTop: 6 }}
                    />
                  )}
                </div>
              )}
            </Card>

            {/* Risk History Chart */}
            {caseDetail.riskHistory.length > 0 && (
              <Card size="small" title={t('counselor.riskTrend', { defaultValue: 'Risk Score Trend (8 weeks)' })}>
                <div style={{ width: '100%', height: 160 }}>
                  <ResponsiveContainer>
                    <LineChart data={[...caseDetail.riskHistory].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis
                        dataKey="computedAt"
                        tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                      <Tooltip formatter={(v: number) => [`${Math.round(v * 100)}%`, 'Risk']} />
                      <Line type="monotone" dataKey="score" stroke="#f5222d" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Case Info */}
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('counselor.openedReason', { defaultValue: 'Reason' })}>
                {REASON_LABEL[caseDetail.openedReason] ?? caseDetail.openedReason}
              </Descriptions.Item>
              <Descriptions.Item label={t('counselor.openedAt', { defaultValue: 'Opened' })}>
                {new Date(caseDetail.openedAt).toLocaleDateString()}
              </Descriptions.Item>
              {caseDetail.resolvedAt && (
                <Descriptions.Item label={t('counselor.resolvedAt', { defaultValue: 'Resolved' })}>
                  {new Date(caseDetail.resolvedAt).toLocaleDateString()}
                </Descriptions.Item>
              )}
              {caseDetail.parents.length > 0 && (
                <Descriptions.Item label={t('counselor.parentContact', { defaultValue: 'Parent Contact' })}>
                  {caseDetail.parents.map((p) => (
                    <div key={p.name}>
                      {p.name} {p.email ? `— ${p.email}` : ''}
                    </div>
                  ))}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Status Actions */}
            <Card size="small" title={t('counselor.updateStatus', { defaultValue: 'Update Status' })}>
              <Space wrap>
                {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                  <Button
                    key={s}
                    size="small"
                    type={caseDetail.status === s ? 'primary' : 'default'}
                    onClick={() => handleStatusChange(s)}
                    loading={updateCase.isPending}
                    disabled={caseDetail.status === s}
                  >
                    {s.replace('_', ' ')}
                  </Button>
                ))}
              </Space>
            </Card>

            {/* Case Notes */}
            <Card
              size="small"
              title={
                <Space>
                  <MessageSquare size={14} />
                  {t('counselor.caseNotes', { defaultValue: 'Case Notes' })}
                </Space>
              }
            >
              {caseDetail.notes && (
                <Paragraph
                  style={{
                    background: '#f5f5f5',
                    padding: '8px 12px',
                    borderRadius: 6,
                    marginBottom: 12,
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {caseDetail.notes}
                </Paragraph>
              )}
              <Form form={notesForm} onFinish={handleSaveNotes} initialValues={{ notes: caseDetail.notes ?? '' }}>
                <Form.Item name="notes" style={{ marginBottom: 8 }}>
                  <TextArea
                    rows={3}
                    placeholder={t('counselor.addNote', { defaultValue: 'Add or update case notes...' })}
                  />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="small"
                  loading={updateCase.isPending}
                >
                  {t('counselor.saveNotes', { defaultValue: 'Save Notes' })}
                </Button>
              </Form>
            </Card>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

export default CounselorCasesPage
