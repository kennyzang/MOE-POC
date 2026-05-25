import { Card, Row, Col, Typography, Tag, Spin, Statistic, List } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  DollarSign,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography

interface DashboardStats {
  totalStudents: number
  totalTeachers: number
  totalCourses: number
  attendanceRate: number
  pendingAdmissions: number
  enrollmentByGrade: { gradeLevel: string; _count: { _all: number } }[]
  recentAdmissions: {
    id: string
    applicantName: string
    status: string
    createdAt: string
  }[]
  financeSummary: {
    totalFees: number
    collected: number
    outstanding: number
  }
}

const ADMISSION_STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  under_review: 'blue',
  accepted: 'green',
  rejected: 'red',
}

const DashboardPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      return data.data as DashboardStats
    },
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const enrollmentData = (stats?.enrollmentByGrade ?? []).map((item) => ({
    grade: item.gradeLevel,
    count: item._count._all,
  }))

  return (
    <div>
      {/* Welcome Banner */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('dashboard.welcomeBack', { name: user?.displayName ?? '' })}
        </Title>
        <Text type="secondary">{t('dashboard.overviewTitle')}</Text>
      </Card>

      {/* Row 1: Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8} lg={4} xl={4}>
          <Card>
            <Statistic
              title={t('dashboard.totalStudents')}
              value={stats?.totalStudents ?? 0}
              prefix={<Users size={18} style={{ color: '#165DFF' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <Card>
            <Statistic
              title={t('dashboard.totalTeachers')}
              value={stats?.totalTeachers ?? 0}
              prefix={<GraduationCap size={18} style={{ color: '#165DFF' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <Card>
            <Statistic
              title={t('dashboard.totalCourses')}
              value={stats?.totalCourses ?? 0}
              prefix={<BookOpen size={18} style={{ color: '#165DFF' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <Card>
            <Statistic
              title={t('dashboard.attendanceRate')}
              value={stats?.attendanceRate ?? 0}
              suffix="%"
              precision={1}
              prefix={<CalendarCheck size={18} style={{ color: '#165DFF' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <Card>
            <Statistic
              title={t('dashboard.pendingAdmissions')}
              value={stats?.pendingAdmissions ?? 0}
              prefix={<ClipboardList size={18} style={{ color: '#165DFF' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Row 2: Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title={t('dashboard.enrollmentByGrade')}>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={enrollmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#165DFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={t('dashboard.attendanceTrend')} style={{ height: '100%' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 260,
              }}
            >
              <Statistic
                value={stats?.attendanceRate ?? 0}
                suffix="%"
                precision={1}
                valueStyle={{
                  fontSize: 48,
                  color:
                    (stats?.attendanceRate ?? 0) >= 80
                      ? '#52c41a'
                      : (stats?.attendanceRate ?? 0) >= 60
                        ? '#faad14'
                        : '#ff4d4f',
                }}
                prefix={
                  <CalendarCheck size={36} style={{ marginRight: 8 }} />
                }
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Row 3: Recent Admissions */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card title={t('dashboard.recentAdmissions')}>
            <List
              size="small"
              dataSource={(stats?.recentAdmissions ?? []).slice(0, 5)}
              locale={{ emptyText: t('common.noData') }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.applicantName}
                    description={new Date(item.createdAt).toLocaleDateString()}
                  />
                  <Tag
                    color={
                      ADMISSION_STATUS_COLORS[item.status] ?? 'default'
                    }
                  >
                    {t(
                      `admissions.status${item.status.charAt(0).toUpperCase() + item.status.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}` as never,
                      item.status
                    )}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Row 4: Finance Summary */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('dashboard.totalFees')}
              value={stats?.financeSummary?.totalFees ?? 0}
              prefix={<DollarSign size={16} style={{ color: '#165DFF' }} />}
              suffix="BND"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('dashboard.collected')}
              value={stats?.financeSummary?.collected ?? 0}
              prefix={<DollarSign size={16} style={{ color: '#52c41a' }} />}
              suffix="BND"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('dashboard.outstanding')}
              value={stats?.financeSummary?.outstanding ?? 0}
              prefix={<DollarSign size={16} style={{ color: '#ff4d4f' }} />}
              suffix="BND"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DashboardPage
