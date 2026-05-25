import { Card, Table, Tag, Spin, Typography, Row, Col, Statistic } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarCheck } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { StudentDashboardStats } from '../../types'

const { Title } = Typography

interface CourseInfo {
  id: string
  code: string
  name: string
  gradeLevel?: string
  creditHours: number
}

interface Enrollment {
  id: string
  studentId: string
  courseId: string
  semester?: string
  status: string
  course?: CourseInfo
}

const STATUS_COLOR: Record<string, string> = {
  enrolled: 'green',
  pending: 'orange',
  withdrawn: 'red',
  completed: 'blue',
}

const StudentCoursesPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data: stats } = useQuery({
    queryKey: ['student-dashboard-stats', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      return data.data as StudentDashboardStats
    },
    enabled: !!user,
  })

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['student-enrollments', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/enrollments')
      return data.data as Enrollment[]
    },
    enabled: !!user,
  })

  const columns: ColumnsType<Enrollment> = [
    {
      title: t('courses.code'),
      dataIndex: ['course', 'code'],
      key: 'code',
      width: 120,
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: t('courses.courseName'),
      dataIndex: ['course', 'name'],
      key: 'name',
    },
    {
      title: t('courses.gradeLevel'),
      dataIndex: ['course', 'gradeLevel'],
      key: 'gradeLevel',
      width: 120,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('courses.creditHours'),
      dataIndex: ['course', 'creditHours'],
      key: 'creditHours',
      width: 100,
      align: 'center',
    },
    {
      title: t('courses.semester'),
      dataIndex: 'semester',
      key: 'semester',
      width: 120,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status] ?? 'default'}>
          {t(`students.${status}` as never, status)}
        </Tag>
      ),
    },
  ]

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

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={t('dashboard.enrolledCourses')}
              value={stats?.enrolledCourses ?? enrollments?.length ?? 0}
              prefix={<BookOpen size={20} color="#1677ff" style={{ marginRight: 6 }} />}
              styles={{ content: { color: '#1677ff', fontWeight: 700, fontSize: 36 } }}
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
              styles={{ content: { color: '#52c41a', fontWeight: 700, fontSize: 36 } }}
            />
          </Card>
        </Col>
      </Row>

      <Card title={t('studentPortal.courseSchedule')} style={{ borderRadius: 10 }}>
        <Table
          columns={columns}
          dataSource={enrollments ?? []}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: t('studentPortal.noCoursesEnrolled') }}
          size="middle"
        />
      </Card>
    </div>
  )
}

export default StudentCoursesPage
