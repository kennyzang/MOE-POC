import { Card, Row, Col, Statistic, List, Spin, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarCheck, Award } from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { StudentDashboardStats, GradeItem } from '../../types'

const { Title, Text } = Typography

const GRADE_TYPE_COLORS: Record<string, string> = {
  exam: '#f5222d',
  quiz: '#fa8c16',
  assignment: '#1677ff',
  project: '#52c41a',
}

const StudentDashboardPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-dashboard-stats', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      return data.data as StudentDashboardStats
    },
    enabled: !!user,
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Welcome Card */}
      <Card
        style={{
          background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
          border: 'none',
          borderRadius: 12,
        }}
        styles={{ body: { padding: '28px 32px' } }}
      >
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          {t('dashboard.welcomeBack', { name: user?.displayName })}
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
          Semester 2026-S1 &mdash; MOE SERPS
        </Text>
      </Card>

      {/* Stat Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={t('dashboard.enrolledCourses')}
              value={stats?.enrolledCourses ?? 0}
              prefix={<BookOpen size={18} color="#1677ff" style={{ marginRight: 4 }} />}
              valueStyle={{ color: '#1677ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={t('dashboard.attendanceRate')}
              value={stats?.attendanceRate ?? 0}
              suffix="%"
              precision={1}
              prefix={<CalendarCheck size={18} color="#52c41a" style={{ marginRight: 4 }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={t('dashboard.gpa')}
              value={stats?.gpa ?? 0}
              precision={2}
              prefix={<Award size={18} color="#fa8c16" style={{ marginRight: 4 }} />}
              valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Upcoming Assessments */}
      <Card
        title={t('dashboard.upcomingAssessments')}
        style={{ borderRadius: 10 }}
      >
        {stats?.upcomingItems && stats.upcomingItems.length > 0 ? (
          <List<GradeItem>
            dataSource={stats.upcomingItems}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#fff',
                        background: GRADE_TYPE_COLORS[item.type] ?? '#8c8c8c',
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.type}
                    </span>
                  }
                  title={<Text strong>{item.name}</Text>}
                  description={
                    item.dueDate
                      ? `Due: ${new Date(item.dueDate).toLocaleDateString()}`
                      : undefined
                  }
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.weight}%
                </Text>
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">{t('common.noData')}</Text>
        )}
      </Card>
    </div>
  )
}

export default StudentDashboardPage
