import { Card, Statistic, Alert, Spin, Typography, Row, Col } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Award, BookOpen } from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { StudentDashboardStats } from '../../types'

const { Title, Text } = Typography

const GPA_COLOR = (gpa: number) => {
  if (gpa >= 3.5) return '#52c41a'
  if (gpa >= 2.5) return '#fa8c16'
  return '#f5222d'
}

const StudentGradesPage = () => {
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

  const gpa = stats?.gpa ?? 0
  const gpaColor = GPA_COLOR(gpa)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Title level={4} style={{ marginBottom: 0 }}>
        {t('grades.title')}
      </Title>

      <Alert
        type="info"
        showIcon
        message={t('studentPortal.overallGpa')}
        description="Your academic performance overview for Semester 2026-S1. Detailed grade breakdowns per assessment are available from your subject teachers or via the school admin portal."
        style={{ borderRadius: 8 }}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={t('studentPortal.overallGpa')}
              value={gpa}
              precision={2}
              prefix={<Award size={20} color={gpaColor} style={{ marginRight: 6 }} />}
              valueStyle={{ color: gpaColor, fontWeight: 700, fontSize: 36 }}
              suffix="/ 4.00"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={t('dashboard.enrolledCourses')}
              value={stats?.enrolledCourses ?? 0}
              prefix={<BookOpen size={20} color="#1677ff" style={{ marginRight: 6 }} />}
              valueStyle={{ color: '#1677ff', fontWeight: 700, fontSize: 36 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={t('studentPortal.gradeHistory')}
        style={{ borderRadius: 10 }}
      >
        <Text type="secondary">
          Detailed assessment scores and grade history are recorded by your subject teachers. Please approach your teacher or school admin for a full transcript or grade breakdown.
        </Text>
      </Card>
    </div>
  )
}

export default StudentGradesPage
