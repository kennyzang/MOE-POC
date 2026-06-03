import { useEffect } from 'react'
import { Card, Row, Col, Progress, List, Tag, Spin, Typography, Alert, Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface FinanceDashboardStats {
  totalFees: number
  collected: number
  outstanding: number
  collectionRate: number
  overdueCount: number
  overdueInvoices: { id: string; amount: number; semester: string | null; description: string | null; studentId: string }[]
  recentPayments: { id: string; amount: number; paidAt: string | null; semester: string | null; description: string | null }[]
  monthlyTrend: { month: string; revenue: number; expense: number }[]
  pendingApprovals: number
}

interface KpiCardProps {
  icon: React.ElementType
  color: string
  bg: string
  title: string
  value: string
}

const KpiCard = ({ icon: Icon, color, bg, title, value }: KpiCardProps) => (
  <Card style={{ borderTop: `3px solid ${color}`, height: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div>
        <div style={{ fontSize: 12, color: '#86909c', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1d2129' }}>{value}</div>
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
    </div>
  </Card>
)

const FinanceDashboardPage = () => {
  const { t } = useTranslation()
  const { token } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/finance/dashboard')
      return data.data as FinanceDashboardStats
    },
  })

  // SSE: refresh when fees change
  useEffect(() => {
    if (!token) return
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1'
    const es = new EventSource(`${base}/events/stream?topics=dashboard&token=${token}`)
    const handler = () => { void queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] }) }
    es.addEventListener('dashboard.fees.changed', handler)
    return () => { es.removeEventListener('dashboard.fees.changed', handler); es.close() }
  }, [token, queryClient])

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const fmt = (n: number) => `BND ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #003333 0%, #006d75 65%, #13c2c2 100%)',
          borderRadius: 12,
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {t('finance.dashboardTitle', { defaultValue: 'Finance Overview' })}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
            {t('finance.dashboardSubtitle', { defaultValue: 'Fee Collection & Financial Performance' })}
          </div>
        </div>
        <DollarSign size={48} color="rgba(255,255,255,0.15)" />
      </div>

      {/* Pending Approvals Alert */}
      {(stats?.pendingApprovals ?? 0) > 0 && (
        <Alert
          type="warning"
          showIcon
          message={t('finance.pendingApprovalsAlert', {
            count: stats!.pendingApprovals,
            defaultValue: `${stats!.pendingApprovals} expense approval(s) awaiting review`,
          })}
          action={
            <Button size="small" onClick={() => navigate('/approvals')}>
              {t('common.view')}
            </Button>
          }
        />
      )}

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={DollarSign} color="#165DFF" bg="#EBF1FF" title={t('finance.totalFees')} value={fmt(stats?.totalFees ?? 0)} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={CheckCircle} color="#52c41a" bg="#f6ffed" title={t('finance.totalCollected')} value={fmt(stats?.collected ?? 0)} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={AlertTriangle} color="#f5222d" bg="#fff2f0" title={t('finance.totalOutstanding')} value={fmt(stats?.outstanding ?? 0)} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={TrendingUp} color="#fa8c16" bg="#fff7e6" title={t('finance.collectionRate', { defaultValue: 'Collection Rate' })} value={`${(stats?.collectionRate ?? 0).toFixed(1)}%`} />
        </Col>
      </Row>

      {/* Collection Progress */}
      <Card>
        <div style={{ marginBottom: 8 }}>
          <Text strong>{t('finance.collectionProgress', { defaultValue: 'Fee Collection Progress' })}</Text>
          <Text type="secondary" style={{ float: 'right' }}>
            {(stats?.collectionRate ?? 0).toFixed(1)}%
          </Text>
        </div>
        <Progress
          percent={Math.round(stats?.collectionRate ?? 0)}
          strokeColor={{
            '0%': '#165DFF',
            '100%': '#52c41a',
          }}
          size={['100%', 16] as [string, number]}
        />
      </Card>

      {/* Monthly Trend Chart */}
      {(stats?.monthlyTrend ?? []).length > 0 && (
        <Card title={t('finance.monthlyTrend', { defaultValue: 'Monthly Revenue vs Expenses' })}>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={stats!.monthlyTrend} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `BND ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => [fmt(v as number)]}
                  contentStyle={{ borderRadius: 8 }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#165DFF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#f5222d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        {/* Overdue Invoices */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} color="#f5222d" />
                {t('finance.overdueInvoices', { defaultValue: 'Overdue Invoices' })}
                {(stats?.overdueCount ?? 0) > 0 && (
                  <span style={{ fontSize: 11, color: '#f5222d', fontWeight: 600 }}>({stats!.overdueCount})</span>
                )}
              </span>
            }
            extra={<Button size="small" onClick={() => navigate('/sis/fees')}>{t('common.view')}</Button>}
          >
            {(stats?.overdueInvoices ?? []).length === 0 ? (
              <Text type="secondary">{t('finance.noOverdue', { defaultValue: 'No overdue invoices!' })}</Text>
            ) : (
              <List
                dataSource={stats!.overdueInvoices.slice(0, 5)}
                renderItem={(inv) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <div>
                        <Text style={{ fontSize: 13 }}>{inv.description ?? inv.semester ?? 'Invoice'}</Text>
                      </div>
                      <div>
                        <Tag color="red">{fmt(inv.amount)}</Tag>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Recent Payments */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={15} color="#52c41a" />
                {t('finance.recentPayments', { defaultValue: 'Recent Payments' })}
              </span>
            }
            extra={<Button size="small" onClick={() => navigate('/sms/finance')}>{t('common.view')}</Button>}
          >
            {(stats?.recentPayments ?? []).length === 0 ? (
              <Text type="secondary">{t('common.noData')}</Text>
            ) : (
              <List
                dataSource={stats!.recentPayments.slice(0, 5)}
                renderItem={(inv) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <div>
                        <Text style={{ fontSize: 13 }}>{inv.description ?? inv.semester ?? 'Payment'}</Text>
                        <div style={{ fontSize: 11, color: '#86909c' }}>
                          {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : ''}
                        </div>
                      </div>
                      <Tag color="green">{fmt(inv.amount)}</Tag>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default FinanceDashboardPage
