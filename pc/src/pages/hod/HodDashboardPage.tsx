import { Card, Row, Col, Progress, List, Tag, Spin, Typography, Badge, Space, Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  Users,
  Award,
  CheckCircle,
  ClipboardCheck,
} from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip,
} from 'recharts'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface HodStats {
  department: string | null
  totalTeachers: number
  cpdComplianceRate: number
  avgPerformanceScore: number
  pendingLeave: number
  pendingEvals: number
  cpdProgress: {
    id: string
    name: string
    cpdHours: number
    cpdTarget: number
    compliant: boolean
    overallScore: number | null
    teachingScore: number | null
    professionalScore: number | null
    conductScore: number | null
  }[]
  recentEvals: {
    id: string
    submittedAt: string | null
    teacher: { user: { displayName: string } }
  }[]
  pendingLeaveList: {
    id: string
    leaveType: string
    startDate: string
    endDate: string
    daysRequested: number
    teacher: { user: { displayName: string } }
  }[]
}

interface KpiCardProps {
  icon: React.ElementType
  color: string
  bg: string
  title: string
  value: number | string
  suffix?: string
}

const KpiCard = ({ icon: Icon, color, bg, title, value, suffix }: KpiCardProps) => (
  <Card style={{ borderTop: `3px solid ${color}`, height: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div>
        <div style={{ fontSize: 12, color: '#86909c', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1d2129' }}>
          {value}
          {suffix && <span style={{ fontSize: 14, color: '#86909c', marginLeft: 3 }}>{suffix}</span>}
        </div>
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
    </div>
  </Card>
)

const HodDashboardPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['hod-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/hod/dashboard')
      return data.data as HodStats
    },
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  // Build radar data from first teacher with full scores
  const radarData = [
    { subject: 'Teaching', fullMark: 100 },
    { subject: 'Professional', fullMark: 100 },
    { subject: 'Conduct', fullMark: 100 },
  ].map((d) => {
    const avgScore =
      stats?.cpdProgress
        .map((t) => {
          if (d.subject === 'Teaching') return t.teachingScore
          if (d.subject === 'Professional') return t.professionalScore
          return t.conductScore
        })
        .filter((v): v is number => v != null)
        .reduce<[number, number]>((acc, v) => [acc[0] + v, acc[1] + 1], [0, 0]) ?? [0, 0]
    return { ...d, score: avgScore[1] > 0 ? Math.round(avgScore[0] / avgScore[1]) : 0 }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #003a8c 0%, #0958d9 65%, #1677ff 100%)',
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
            {stats?.department
              ? t('hod.departmentSubtitle', { dept: stats.department, defaultValue: `Department of ${stats.department}` })
              : t('hod.subtitle', { defaultValue: 'Head of Department Overview' })}
          </div>
        </div>
        <TrendingUp size={48} color="rgba(255,255,255,0.15)" />
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={Users} color="#165DFF" bg="#EBF1FF" title={t('hod.totalTeachers', { defaultValue: 'Teachers in Dept' })} value={stats?.totalTeachers ?? 0} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={CheckCircle} color="#52c41a" bg="#f6ffed" title={t('hod.cpdCompliance', { defaultValue: 'CPD Compliance' })} value={stats?.cpdComplianceRate ?? 0} suffix="%" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard icon={Award} color="#fa8c16" bg="#fff7e6" title={t('hod.avgPerformance', { defaultValue: 'Avg Performance Score' })} value={stats?.avgPerformanceScore ?? 0} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            icon={ClipboardCheck}
            color="#f5222d"
            bg="#fff2f0"
            title={t('hod.pendingActions', { defaultValue: 'Pending Actions' })}
            value={(stats?.pendingLeave ?? 0) + (stats?.pendingEvals ?? 0)}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* CPD Progress */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={15} />
                {t('hod.cpdProgress', { defaultValue: 'CPD Progress by Teacher' })}
              </span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(stats?.cpdProgress ?? []).map((t) => (
                <div key={t.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13 }}>{t.name}</Text>
                    <Space>
                      {t.compliant ? (
                        <Tag color="green" style={{ fontSize: 10 }}>On Track</Tag>
                      ) : (
                        <Tag color="red" style={{ fontSize: 10 }}>Below Target</Tag>
                      )}
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {t.cpdHours.toFixed(0)}/{t.cpdTarget.toFixed(0)}h
                      </Text>
                    </Space>
                  </div>
                  <Progress
                    percent={Math.min(100, Math.round((t.cpdHours / t.cpdTarget) * 100))}
                    size="small"
                    strokeColor={t.compliant ? '#52c41a' : t.cpdHours / t.cpdTarget >= 0.7 ? '#fa8c16' : '#f5222d'}
                    showInfo={false}
                  />
                </div>
              ))}
              {(stats?.cpdProgress ?? []).length === 0 && (
                <Text type="secondary">{t('common.noData')}</Text>
              )}
            </div>
          </Card>
        </Col>

        {/* Performance Radar */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={15} />
                {t('hod.performanceRadar', { defaultValue: 'Dept Performance Avg' })}
              </span>
            }
          >
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <RadarChart cx="50%" cy="50%" outerRadius={80} data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <Radar name="Avg Score" dataKey="score" stroke="#165DFF" fill="#165DFF" fillOpacity={0.25} />
                  <Tooltip formatter={(v: number) => [`${v}/100`, 'Avg Score']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Pending Leave */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t('hod.pendingLeave', { defaultValue: 'Pending Leave Applications' })}
                {(stats?.pendingLeave ?? 0) > 0 && <Badge count={stats!.pendingLeave} />}
              </span>
            }
            extra={<Button size="small" onClick={() => navigate('/ems/leave')}>{t('common.view')}</Button>}
          >
            <List
              dataSource={stats?.pendingLeaveList ?? []}
              locale={{ emptyText: t('counselor.noActiveCases', { defaultValue: 'No pending leave requests' }) }}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div>
                      <Text strong style={{ fontSize: 13 }}>{item.teacher.user.displayName}</Text>
                      <div style={{ fontSize: 11, color: '#86909c' }}>
                        {item.leaveType} · {item.daysRequested} days · {new Date(item.startDate).toLocaleDateString()} – {new Date(item.endDate).toLocaleDateString()}
                      </div>
                    </div>
                    <Button size="small" type="primary" onClick={() => navigate('/ems/leave')}>
                      {t('common.view')}
                    </Button>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Pending Evals */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t('hod.pendingEvals', { defaultValue: 'Pending Evaluations' })}
                {(stats?.pendingEvals ?? 0) > 0 && <Badge count={stats!.pendingEvals} />}
              </span>
            }
            extra={<Button size="small" onClick={() => navigate('/ems/performance-evaluations')}>{t('common.view')}</Button>}
          >
            <List
              dataSource={stats?.recentEvals ?? []}
              locale={{ emptyText: 'No evaluations awaiting review' }}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div>
                      <Text strong style={{ fontSize: 13 }}>{item.teacher.user.displayName}</Text>
                      <div style={{ fontSize: 11, color: '#86909c' }}>
                        {t('ems.submitted')}: {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    <Tag color="orange">Awaiting HOD</Tag>
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

export default HodDashboardPage
