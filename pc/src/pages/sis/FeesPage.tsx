import { useState } from 'react'
import {
  Card, Table, Tag, Button, Space, Statistic, Row, Col, Typography, Tooltip,
  Popover, message, Alert, Badge,
} from 'antd'
import { DollarSign, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

const { Title, Text } = Typography

interface FeeInvoice {
  id: string
  studentId: string
  invoiceNumber: string | null
  semester: string | null
  amount: number
  status: 'unpaid' | 'paid' | 'overdue'
  dueDate: string | null
  paidAt: string | null
  description: string | null
  lineItems: string | null
  holdActive: boolean
  holdReason: string | null
  createdAt: string
  student?: { id: string; studentId: string; gradeLevel: string | null; className: string | null; user: { displayName: string } }
}

interface InvoiceSummary { totalInvoiced: number; collected: number; outstanding: number; overdueCount: number }

export default function FeesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const { data, isLoading, refetch } = useQuery<{ invoices: FeeInvoice[]; summary: InvoiceSummary }>({
    queryKey: ['fee-invoices', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/finance/invoices', { params })
      const invoices: FeeInvoice[] = res.data.data ?? []
      const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0)
      const collected = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
      const outstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amount, 0)
      const overdueCount = invoices.filter(i => i.status === 'overdue').length
      return { invoices, summary: { totalInvoiced, collected, outstanding, overdueCount } }
    },
  })

  const payMutation = useMutation({
    mutationFn: (invoiceId: string) => api.patch(`/finance/invoices/${invoiceId}/pay`),
    onSuccess: () => {
      message.success('Payment recorded — fee hold cleared')
      qc.invalidateQueries({ queryKey: ['fee-invoices'] })
      qc.invalidateQueries({ queryKey: ['command-center'] })
    },
    onError: () => message.error('Failed to record payment'),
  })

  const overdueCheckMutation = useMutation({
    mutationFn: () => api.post('/finance/fees/check-overdue'),
    onSuccess: (res) => {
      const flagged = res.data.data?.flagged ?? 0
      message.success(`Overdue check complete — ${flagged} invoice(s) flagged`)
      qc.invalidateQueries({ queryKey: ['fee-invoices'] })
    },
  })

  const invoices = data?.invoices ?? []
  const summary = data?.summary ?? { totalInvoiced: 0, collected: 0, outstanding: 0, overdueCount: 0 }

  const statusTag = (status: string, holdActive: boolean) => {
    if (holdActive && status !== 'paid') {
      return <Tag color="red" icon={<AlertTriangle size={11} />}> Overdue (Hold Active)</Tag>
    }
    switch (status) {
      case 'paid':    return <Tag color="success" icon={<CheckCircle size={11} />}> Paid</Tag>
      case 'overdue': return <Tag color="error"   icon={<AlertTriangle size={11} />}> Overdue</Tag>
      default:        return <Tag color="warning" icon={<Clock size={11} />}> Unpaid</Tag>
    }
  }

  const columns = [
    {
      title: 'Invoice #',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (v: string | null) => <Text code style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
      width: 140,
    },
    {
      title: 'Student',
      key: 'student',
      render: (_: unknown, row: FeeInvoice) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{row.student?.user.displayName ?? row.studentId}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.student?.gradeLevel} {row.student?.className && `(${row.student.className})`}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string | null, row: FeeInvoice) => {
        if (!row.lineItems) return v ?? '—'
        try {
          const items: Array<{ code: string; name: string; amount: number }> = JSON.parse(row.lineItems)
          const content = (
            <div style={{ minWidth: 220 }}>
              {items.map(item => (
                <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '2px 0' }}>
                  <Text style={{ fontSize: 12 }}>{item.name}</Text>
                  <Text strong style={{ fontSize: 12 }}>BND {item.amount.toFixed(2)}</Text>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12 }}>Total</Text>
                <Text strong style={{ fontSize: 12 }}>BND {row.amount.toFixed(2)}</Text>
              </div>
            </div>
          )
          return <Popover content={content} title="Fee Breakdown" trigger="click"><a>{v ?? 'View breakdown'}</a></Popover>
        } catch {
          return v ?? '—'
        }
      },
    },
    {
      title: 'Amount (BND)',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (v: number) => <Text strong>BND {v.toFixed(2)}</Text>,
      width: 120,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (v: string | null) => v ? new Date(v).toLocaleDateString() : '—',
      width: 110,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, row: FeeInvoice) => (
        <Space>
          {statusTag(row.status, row.holdActive)}
          {row.holdActive && (
            <Tooltip title={row.holdReason ?? 'Fee hold active'}>
              <AlertTriangle size={14} color="#ff4d4f" />
            </Tooltip>
          )}
        </Space>
      ),
      width: 180,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, row: FeeInvoice) =>
        row.status !== 'paid' ? (
          <Tooltip title="Record a cash / cheque payment collected at the school office. Online payments are processed through the Parent Portal.">
            <Button
              size="small"
              icon={<DollarSign size={12} />}
              loading={payMutation.isPending}
              onClick={() => payMutation.mutate(row.id)}
            >
              Record Payment
            </Button>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Paid {row.paidAt ? new Date(row.paidAt).toLocaleDateString() : ''}</Text>
        ),
      width: 180,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Fee Invoices</Title>
        <Space>
          <Button size="small" onClick={() => refetch()} icon={<RefreshCw size={13} />}>Refresh</Button>
          <Button
            size="small"
            onClick={() => overdueCheckMutation.mutate()}
            loading={overdueCheckMutation.isPending}
            danger
          >
            Check Overdue
          </Button>
        </Space>
      </div>

      {/* Summary cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Invoiced', value: summary.totalInvoiced, color: '#1F2D3D', bg: '#EBF1F7', icon: DollarSign },
          { label: 'Collected', value: summary.collected, color: '#1A6B3A', bg: '#D4EDDA', icon: CheckCircle },
          { label: 'Outstanding', value: summary.outstanding, color: '#8B1A1A', bg: '#FDECEA', icon: AlertTriangle },
          { label: 'Overdue Invoices', value: summary.overdueCount, color: '#7D5A00', bg: '#FFF3CD', icon: Clock, isCount: true },
        ].map(card => (
          <Col span={6} key={card.label}>
            <Card size="small" style={{ background: card.bg, border: 'none' }}>
              <Statistic
                title={<Text style={{ color: card.color, fontSize: 12 }}>{card.label}</Text>}
                value={card.isCount ? card.value : `BND ${card.value.toFixed(2)}`}
                valueStyle={{ color: card.color, fontSize: 22 }}
                prefix={<card.icon size={16} color={card.color} style={{ marginRight: 4 }} />}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Alert
        type="info"
        showIcon
        closable
        style={{ marginBottom: 16 }}
        message="Payment Workflow"
        description="Parents pay online via the Parent Portal (credit/debit card, FPX, or bank transfer). Use 'Record Payment' only for cash or cheque payments collected at the school office."
      />

      {summary.overdueCount > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<AlertTriangle size={14} />}
          message={`${summary.overdueCount} invoice(s) overdue — fee holds active on affected student records`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Filter buttons */}
      <Space style={{ marginBottom: 12 }}>
        {[undefined, 'unpaid', 'overdue', 'paid'].map(s => (
          <Button
            key={s ?? 'all'}
            size="small"
            type={statusFilter === s ? 'primary' : 'default'}
            onClick={() => setStatusFilter(s)}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            {s === 'overdue' && summary.overdueCount > 0 && (
              <Badge count={summary.overdueCount} size="small" style={{ marginLeft: 4 }} />
            )}
          </Button>
        ))}
      </Space>

      <Table
        dataSource={invoices}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 15, showTotal: (t) => `${t} invoices` }}
        rowClassName={(row: FeeInvoice) => row.holdActive ? 'ant-table-row-danger' : ''}
        style={{ background: '#fff', borderRadius: 8 }}
      />
    </div>
  )
}
