import { useState } from 'react'
import {
  Table,
  Select,
  Tag,
  Card,
  Space,
  Row,
  Col,
  Typography,
  Statistic,
  Tabs,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, TrendingDown, CreditCard } from 'lucide-react'
import api from '../../lib/api'
import type { FeeInvoice, SchoolExpense } from '../../types'

const { Title } = Typography

const INVOICE_STATUS_COLORS: Record<string, string> = {
  paid: 'green',
  unpaid: 'orange',
  overdue: 'red',
}

const EXPENSE_STATUS_COLORS: Record<string, string> = {
  approved: 'green',
  pending: 'orange',
  rejected: 'red',
}

interface FinanceSummary {
  totalFees: number
  collected: number
  outstanding: number
  totalExpenses: number
}

const formatBND = (amount: number) =>
  `BND ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const FinancialReportsPage = () => {
  const { t } = useTranslation()
  const [invoiceStatus, setInvoiceStatus] = useState<string>('')
  const [expenseCategory, setExpenseCategory] = useState<string>('')

  const { data: summary } = useQuery({
    queryKey: ['finance-summary'],
    queryFn: async () => {
      const { data } = await api.get('/finance/summary')
      return data.data as FinanceSummary
    },
  })

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['finance-invoices', invoiceStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (invoiceStatus) params.set('status', invoiceStatus)
      const { data } = await api.get(`/finance/invoices?${params}`)
      return data.data as FeeInvoice[]
    },
  })

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['finance-expenses', expenseCategory],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (expenseCategory) params.set('category', expenseCategory)
      const { data } = await api.get(`/finance/expenses?${params}`)
      return data.data as SchoolExpense[]
    },
  })

  const invoiceColumns: ColumnsType<FeeInvoice> = [
    {
      title: t('common.name'),
      key: 'studentName',
      render: (_, record) => record.student?.user?.displayName ?? '-',
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: t('finance.invoiceAmount'),
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (val: number) => formatBND(val),
    },
    {
      title: t('finance.dueDate'),
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 130,
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : '-'),
    },
    {
      title: t('finance.invoiceStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string) => (
        <Tag color={INVOICE_STATUS_COLORS[val] ?? 'default'}>
          {t(`finance.${val}` as never, val)}
        </Tag>
      ),
    },
  ]

  const expenseColumns: ColumnsType<SchoolExpense> = [
    {
      title: t('finance.category'),
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (val: string) => t(`finance.${val}` as never, val),
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: t('finance.invoiceAmount'),
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (val: number) => formatBND(val),
    },
    {
      title: t('common.date'),
      dataIndex: 'date',
      key: 'date',
      width: 130,
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : '-'),
    },
    {
      title: t('finance.approvedBy'),
      dataIndex: 'approvedBy',
      key: 'approvedBy',
      width: 150,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val: string) => (
        <Tag color={EXPENSE_STATUS_COLORS[val] ?? 'default'}>
          {val}
        </Tag>
      ),
    },
  ]

  const EXPENSE_CATEGORIES = ['supplies', 'maintenance', 'salary', 'utilities']

  const tabItems = [
    {
      key: 'invoices',
      label: t('finance.invoices'),
      children: (
        <div>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={8}>
                <Select
                  placeholder={t('finance.allStatus')}
                  allowClear
                  style={{ width: '100%' }}
                  value={invoiceStatus || undefined}
                  onChange={(val) => setInvoiceStatus(val ?? '')}
                  options={[
                    { label: t('finance.paid'), value: 'paid' },
                    { label: t('finance.unpaid'), value: 'unpaid' },
                    { label: t('finance.overdue'), value: 'overdue' },
                  ]}
                />
              </Col>
            </Row>
          </Card>
          <Table<FeeInvoice>
            rowKey="id"
            columns={invoiceColumns}
            dataSource={invoices}
            loading={invoicesLoading}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
            locale={{ emptyText: t('common.noData') }}
          />
        </div>
      ),
    },
    {
      key: 'expenses',
      label: t('finance.expenses'),
      children: (
        <div>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={8}>
                <Select
                  placeholder={t('finance.allCategories')}
                  allowClear
                  style={{ width: '100%' }}
                  value={expenseCategory || undefined}
                  onChange={(val) => setExpenseCategory(val ?? '')}
                  options={EXPENSE_CATEGORIES.map((c) => ({
                    label: t(`finance.${c}` as never, c),
                    value: c,
                  }))}
                />
              </Col>
            </Row>
          </Card>
          <Table<SchoolExpense>
            rowKey="id"
            columns={expenseColumns}
            dataSource={expenses}
            loading={expensesLoading}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
            locale={{ emptyText: t('common.noData') }}
          />
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <DollarSign size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('finance.title')}
            </Title>
          </Space>
        </Col>
      </Row>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t('finance.totalFees')}
              value={summary?.totalFees ?? 0}
              prefix={<DollarSign size={16} />}
              formatter={(val) => formatBND(Number(val))}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t('finance.totalCollected')}
              value={summary?.collected ?? 0}
              prefix={<TrendingUp size={16} />}
              valueStyle={{ color: '#52c41a' }}
              formatter={(val) => formatBND(Number(val))}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t('finance.totalOutstanding')}
              value={summary?.outstanding ?? 0}
              prefix={<CreditCard size={16} />}
              valueStyle={{ color: '#faad14' }}
              formatter={(val) => formatBND(Number(val))}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t('finance.totalExpenses')}
              value={summary?.totalExpenses ?? 0}
              prefix={<TrendingDown size={16} />}
              valueStyle={{ color: '#ff4d4f' }}
              formatter={(val) => formatBND(Number(val))}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}

export default FinancialReportsPage
