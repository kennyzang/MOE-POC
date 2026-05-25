import { Card, Statistic, Alert, Spin, Typography, Row, Col } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarCheck } from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { StudentDashboardStats } from '../../types'

const { Title, Text } = Typography

const StudentCoursesPage = () => {
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
      <Title level={4} style={{ marginBottom: 0 }}>
        {t('studentPortal.courses')}
      </Title>

      <Alert
        type="info"
        showIcon
        message="Semester 2026-S1"
        description={`You are enrolled in ${stats?.enrolledCourses ?? 0} course(s) for Semester 2026-S1. Contact your class teacher or school admin to view the full course schedule and materials.`}
        style={{ borderRadius: 8 }}
      />

      <Row gutter={[16, 16]}>
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
        <Col xs={24} sm={12}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={t('dashboard.attendanceRate')}
              value={stats?.attendanceRate ?? 0}
              suffix="%"
              precision={1}
              prefix={<CalendarCheck size={20} color="#52c41a" style={{ marginRight: 6 }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 700, fontSize: 36 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={t('studentPortal.courseSchedule')}
        style={{ borderRadius: 10 }}
      >
        <Text type="secondary">
          Detailed course schedule is managed by your school. Please refer to your physical timetable or contact your homeroom teacher for the latest schedule information.
        </Text>
      </Card>
    </div>
  )
}

export default StudentCoursesPage
