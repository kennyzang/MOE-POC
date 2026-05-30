import { useEffect } from 'react'
import { Card, Row, Col, Tag, List, Spin, Typography, Badge, Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  HeartHandshake,
  AlertTriangle,
  TrendingUp,
  Users,
  FolderOpen,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface CounselorDashboardStats {
  casesOpen: number
  casesInProgress: number
  casesResolved: number
  casesClosed: number
  totalActive: number
  riskBandDistribution: { HIGH_RISK: number; MEDIUM_RISK: number; LOW_RISK: number }
  activeCases: {
    id: string
    studentName: string
    openedReason: string
    status: string
    openedAt: string
    currentRiskBand: string | null
    currentRiskScore: number | null
  }[]
}

const RISK_COLORS: Record<string, string> = { HIGH_RISK: '#f5222d', MONITOR: '#fa8c16', ON_TRACK: '#52c41a' }
const RISK_LABELS: Record<string, string> = { HIGH_RISK: 'High Risk', MONITOR: 'Monitor', ON_TRACK: 'On Track' }

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'red',
  IN_PROGRESS: 'orange',
  RESOLVED: 'green',
  CLOSED: 'default',
}

const REASON_LABEL: Record<string, string> = {
  AUTO_RISK_THRESHOLD: 'Risk Threshold',
  AUTO_ABSENCE_THRESHOLD: 'Absence Alert',
  TEACHER_REFERRAL: 'Teacher Referral',
  PARENT_REQUEST: 'Parent Request',
}

interface KpiCardProps {
  icon: React.ElementType
  color: string
  bg: string
  title: string
  value: number
}

const KpiCard = ({ icon: Icon, color, bg, title, value }: KpiCardProps) => (
  <Card style={{ borderTop: `3px solid ${color}`, height: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div>
        <div style={{ fontSize: 12, color: '#86909c', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1d2129' }}>{value}</div>
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
    </div>
  </Card>
)

const CounselorDashboardPage = () => {
  const { t } = useTranslation()
  const { user, token } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['counselor-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/counselor/dashboard')
      return data.data as CounselorDashboardStats
    },
  })

  // SSE: refresh when risk scores change or thresholds change
  useEffect(() => {
    if (!token) return
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1'
    const es = new EventSource(`${base}/events/stream?topics=dashboard&token=${token}`)
    const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ['counselor-dashboard'] }) }
    es.addEventListener('dashboard.risk.changed', invalidate)
    es.addEventListener('system.thresholds.changed', invalidate)
    return () => {
      es.removeEventListener('dashboard.risk.changed', invalidate)
      es.removeEventListener('system.thresholds.changed', invalidate)
      es.close()
    }
  }, [token, queryClient])

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const dist = stats?.riskBandDistribution ?? { HIGH_RISK: 0, MONITOR: 0, ON_TRACK: 0 }
  const pieData = Object.entries(dist)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: RISK_LABELS[k] ?? k, value: v, color: RISK_COLORS[k as keyof typeof RISK_COLORS] ?? '#999' }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #6b1e1e 0%, #b53a3a 65%, #d46b08 100%)',
          borderRadius: 12,
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {t('dashboard.welcomeBack', { name: user?.displayName ?? '' })}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
            {t('counselor.subtitle', { defaultValue: 'Student Wellbeing & Case Management' })}
          </div>
        </div>
        <HeartHandshake size={48} color="rgba(255,255,255,0.15)" />
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={FolderOpen} color="#f5222d" bg="#fff2f0" title={t('counselor.openCases', { defaultValue: 'Open Cases' })} value={stats?.casesOpen ?? 0} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={TrendingUp} color="#fa8c16" bg="#fff7e6" title={t('counselor.inProgressCases', { defaultValue: 'In Progress' })} value={stats?.casesInProgress ?? 0} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={AlertTriangle} color="#f5222d" bg="#fff2f0" title={t('counselor.highRisk', { defaultValue: 'High-Risk Students' })} value={dist.HIGH_RISK ?? 0} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={Users} color="#52c41a" bg="#f6ffed" title={t('counselor.resolvedCases', { defaultValue: 'Resolved Cases' })} value={stats?.casesResolved ?? 0} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Risk Distribution Donut */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} />
                {t('counselor.riskDistribution', { defaultValue: 'Risk Band Distribution' })}
              </span>
            }
            style={{ height: '100%' }}
          >
            {pieData.length === 0 ? (
              <Text type="secondary">{t('common.noData')}</Text>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'Students']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>

        {/* Active Cases List */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderOpen size={15} />
                {t('counselor.activeCases', { defaultValue: 'Active Cases' })}
                {(stats?.totalActive ?? 0) > 0 && (
                  <Badge count={stats!.totalActive} style={{ marginLeft: 4 }} />
                )}
              </span>
            }
            extra={
              <Button size="small" onClick={() => navigate('/counselor/cases')}>
                {t('common.view')} {t('common.actions')}
              </Button>
            }
            style={{ height: '100%' }}
          >
            <List
              dataSource={stats?.activeCases ?? []}
              locale={{ emptyText: t('counselor.noActiveCases', { defaultValue: 'No active cases — all students are well!' }) }}
              renderItem={(c) => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '10px 0' }}
                  onClick={() => navigate('/counselor/cases')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{c.studentName}</div>
                      <div style={{ fontSize: 11, color: '#86909c' }}>
                        {REASON_LABEL[c.openedReason] ?? c.openedReason}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {c.currentRiskBand && (
                        <Tag color={RISK_COLORS[c.currentRiskBand as keyof typeof RISK_COLORS] ?? 'default'} style={{ fontSize: 10 }}>
                          {RISK_LABELS[c.currentRiskBand] ?? c.currentRiskBand}
                        </Tag>
                      )}
                      <Tag color={STATUS_COLOR[c.status] ?? 'default'} style={{ fontSize: 10 }}>
                        {c.status.replace('_', ' ')}
                      </Tag>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default CounselorDashboardPage
