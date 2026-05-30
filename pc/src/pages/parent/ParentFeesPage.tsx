import { Card, Row, Col, Table, Tag, Statistic, Spin, Typography, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, CheckCircle, AlertTriangle } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import api from '@/lib/api'

const { Title, Text } = Typography

interface Invoice {
  id: string
  studentId: string
  studentName: string
  invoiceNumber: string | null
  semester: string | null
  amount: number
  status: string
  dueDate: string | null
  paidAt: string | null
  description: string | null
}

interface FeeData {
  invoices: Invoice[]
  summary: { totalBilled: number; paid: number; outstanding: number }
}

const STATUS_COLOR: Record<string, string> = { paid: 'green', unpaid: 'orange', overdue: 'red' }

const ParentFeesPage = () => {
  const { t } = useTranslation()

  const { data: feeData, isLoading } = useQuery({
    queryKey: ['parent-fees'],
    queryFn: async () => {
      const { data } = await api.get('/parent/fees')
      return data.data as FeeData
    },
  })

  const fmt = (n: number) =>
    `BND ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const columns: ColumnsType<Invoice> = [
    {
      title: t('students.title'),
      dataIndex: 'studentName',
      key: 'studentName',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t('finance.invoiceAmount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amt: number) => fmt(amt),
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: t('courses.semester'),
      dataIndex: 'semester',
      key: 'semester',
      render: (s: string | null) => s ?? '—',
    },
    {
      title: t('finance.dueDate'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—'),
      sorter: (a, b) =>
        (a.dueDate ? new Date(a.dueDate).getTime() : 0) -
        (b.dueDate ? new Date(b.dueDate).getTime() : 0),
    },
    {
      title: t('finance.invoiceStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={STATUS_COLOR[s] ?? 'default'}>{t(`finance.${s}` as never, s)}</Tag>
      ),
      filters: [
        { text: t('finance.paid'), value: 'paid' },
        { text: t('finance.unpaid'), value: 'unpaid' },
        { text: t('finance.overdue'), value: 'overdue' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: t('finance.paidAt'),
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—'),
    },
  ]

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const summary = feeData?.summary ?? { totalBilled: 0, paid: 0, outstanding: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <Card style={{ marginBottom: 0 }}>
        <Space align="center">
          <DollarSign size={24} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>
            {t('parentPortal.feeInvoices', { defaultValue: 'Fee Invoices' })}
          </Title>
        </Space>
      </Card>

      {/* Summary KPIs */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('finance.totalFees')}
              value={fmt(summary.totalBilled)}
              prefix={<DollarSign size={16} color="#165DFF" style={{ marginRight: 4 }} />}
              styles={{ content: { color: '#165DFF', fontWeight: 700 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('finance.totalCollected')}
              value={fmt(summary.paid)}
              prefix={<CheckCircle size={16} color="#52c41a" style={{ marginRight: 4 }} />}
              styles={{ content: { color: '#52c41a', fontWeight: 700 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('finance.totalOutstanding')}
              value={fmt(summary.outstanding)}
              prefix={<AlertTriangle size={16} color={summary.outstanding > 0 ? '#f5222d' : '#52c41a'} style={{ marginRight: 4 }} />}
              styles={{ content: { color: summary.outstanding > 0 ? '#f5222d' : '#52c41a', fontWeight: 700 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Invoice Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={feeData?.invoices ?? []}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{ emptyText: t('common.noData') }}
          size="middle"
        />
      </Card>
    </div>
  )
}

export default ParentFeesPage
