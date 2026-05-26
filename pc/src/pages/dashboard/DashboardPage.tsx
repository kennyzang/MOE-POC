import { Card, Row, Col, Typography, Tag, Spin, Statistic, Alert, Badge, List } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  UserCheck,
  UserX,
  BookMarked,
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
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
  enrollmentByGrade: { gradeLevel: string; count: number }[]
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
  staffStatus?: {
    active: number
    onLeave: number
    inTraining: number
  }
  timetableConflicts?: {
    count: number
    conflicts: { teacherName: string; course1: string; course2: string; day: string }[]
  }
}

interface TeacherDashboardStats {
  myCourses: number
  myStudents: number
  upcomingSessions: Array<{
    id: string
    date: string
    status: string
    course: { id: string; code: string; name: string }
  }>
  recentGrades: Array<{
    id: string
    score: number | null
    gradedAt: string
    gradeItem: { name: string; courseId: string }
    student: { user: { displayName: string } }
  }>
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

  const isTeacher = user?.role === 'teacher'

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      if (isTeacher) return data.data as TeacherDashboardStats
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

  // ── Teacher Dashboard ──────────────────────────────────────────
  if (isTeacher) {
    const teacherStats = stats as TeacherDashboardStats | undefined
    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('dashboard.welcomeBack', { name: user?.displayName ?? '' })}
          </Typography.Title>
          <Typography.Text type="secondary">{t('dashboard.teacherOverview')}</Typography.Text>
        </Card>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title={t('dashboard.myCourses')}
                value={teacherStats?.myCourses ?? 0}
                prefix={<BookOpen size={18} style={{ color: '#165DFF' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title={t('dashboard.myStudents')}
                value={teacherStats?.myStudents ?? 0}
                prefix={<Users size={18} style={{ color: '#165DFF' }} />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarCheck size={16} />
                  {t('dashboard.todaySessions')}
                </span>
              }
            >
              <List
                dataSource={teacherStats?.upcomingSessions ?? []}
                locale={{ emptyText: t('common.noData') }}
                renderItem={item => (
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{item.course.name}</div>
                        <div style={{ fontSize: 12, color: '#00000073' }}>{item.course.code}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Tag color={item.status === 'active' ? 'green' : 'default'}>{item.status}</Tag>
                        <div style={{ fontSize: 12, color: '#00000073' }}>
                          {new Date(item.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClipboardCheck size={16} />
                  {t('dashboard.recentGrades')}
                </span>
              }
            >
              <List
                dataSource={teacherStats?.recentGrades ?? []}
                locale={{ emptyText: t('common.noData') }}
                renderItem={item => (
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{item.student.user.displayName}</div>
                        <div style={{ fontSize: 12, color: '#00000073' }}>{item.gradeItem.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: '#165DFF' }}>
                          {item.score != null ? item.score : '-'}
                        </div>
                        <div style={{ fontSize: 12, color: '#00000073' }}>
                          {new Date(item.gradedAt).toLocaleDateString()}
                        </div>
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

  const adminStats = stats as DashboardStats | undefined
  const enrollmentData = adminStats?.enrollmentByGrade?.map((item) => ({
    grade: item.gradeLevel,
    count: item.count,
  })) ?? []

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
              value={adminStats?.totalStudents ?? 0}
              prefix={<Users size={18} style={{ color: '#165DFF' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <Card>
            <Statistic
              title={t('dashboard.totalTeachers')}
              value={adminStats?.totalTeachers ?? 0}
              prefix={<GraduationCap size={18} style={{ color: '#165DFF' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <Card>
            <Statistic
              title={t('dashboard.totalCourses')}
              value={adminStats?.totalCourses ?? 0}
              prefix={<BookOpen size={18} style={{ color: '#165DFF' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <Card>
            <Statistic
              title={t('dashboard.attendanceRate')}
              value={adminStats?.attendanceRate ?? 0}
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
              value={adminStats?.pendingAdmissions ?? 0}
              prefix={<ClipboardList size={18} style={{ color: '#165DFF' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Row 1b: Staff Status + Timetable Conflicts (admin/manager/principal only) */}
      {adminStats?.staffStatus && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} />
                {t('dashboard.staffStatus')}
              </span>
            }>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <UserCheck size={28} style={{ color: '#52c41a', marginBottom: 8 }} />
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a', lineHeight: 1 }}>
                      {adminStats.staffStatus.active}
                    </div>
                    <div style={{ fontSize: 12, color: '#00000073', marginTop: 4 }}>
                      {t('dashboard.staffActive')}
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <UserX size={28} style={{ color: '#faad14', marginBottom: 8 }} />
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#faad14', lineHeight: 1 }}>
                      {adminStats.staffStatus.onLeave}
                    </div>
                    <div style={{ fontSize: 12, color: '#00000073', marginTop: 4 }}>
                      {t('dashboard.staffOnLeave')}
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <BookMarked size={28} style={{ color: '#165DFF', marginBottom: 8 }} />
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#165DFF', lineHeight: 1 }}>
                      {adminStats.staffStatus.inTraining}
                    </div>
                    <div style={{ fontSize: 12, color: '#00000073', marginTop: 4 }}>
                      {t('dashboard.staffInTraining')}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(adminStats.timetableConflicts?.count ?? 0) > 0
                  ? <AlertTriangle size={16} style={{ color: '#ff4d4f' }} />
                  : <CheckCircle size={16} style={{ color: '#52c41a' }} />
                }
                {t('dashboard.timetableConflicts')}
                {(adminStats.timetableConflicts?.count ?? 0) > 0 && (
                  <Badge count={adminStats.timetableConflicts!.count} style={{ marginLeft: 4 }} />
                )}
              </span>
            }>
              {(adminStats.timetableConflicts?.count ?? 0) === 0 ? (
                <Alert
                  title={t('dashboard.noConflicts')}
                  type="success"
                  showIcon
                  style={{ border: 'none', background: '#f6ffed' }}
                />
              ) : (
                <div>
                  {adminStats.timetableConflicts!.conflicts.slice(0, 4).map((c, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 0',
                      borderBottom: idx < (adminStats.timetableConflicts!.conflicts.length - 1) ? '1px solid #f0f0f0' : 'none',
                    }}>
                      <AlertTriangle size={14} style={{ color: '#ff4d4f', flexShrink: 0 }} />
                      <span style={{ fontSize: 13 }}>
                        {t('dashboard.conflictDetail', { teacher: c.teacherName, c1: c.course1, c2: c.course2, day: c.day })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>
      )}

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
                value={adminStats?.attendanceRate ?? 0}
                suffix="%"
                precision={1}
                styles={{
                  content: {
                    fontSize: 48,
                    color:
                      (adminStats?.attendanceRate ?? 0) >= 80
                        ? '#52c41a'
                        : (adminStats?.attendanceRate ?? 0) >= 60
                          ? '#faad14'
                          : '#ff4d4f',
                  },
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
            {(adminStats?.recentAdmissions ?? []).slice(0, 5).length === 0 ? (
              <div style={{ color: '#00000040', textAlign: 'center', padding: '12px 0' }}>
                {t('common.noData')}
              </div>
            ) : (
              (adminStats?.recentAdmissions ?? []).slice(0, 5).map((item, idx, arr) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: idx < arr.length - 1 ? '1px solid #f0f0f0' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.applicantName}</div>
                    <div style={{ fontSize: 12, color: '#00000073' }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Tag color={ADMISSION_STATUS_COLORS[item.status] ?? 'default'}>
                    {t(
                      `admissions.status${item.status.charAt(0).toUpperCase() + item.status.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}` as never,
                      item.status
                    )}
                  </Tag>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* Row 4: Finance Summary */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('dashboard.totalFees')}
              value={adminStats?.financeSummary?.totalFees ?? 0}
              prefix={<DollarSign size={16} style={{ color: '#165DFF' }} />}
              suffix="BND"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('dashboard.collected')}
              value={adminStats?.financeSummary?.collected ?? 0}
              prefix={<DollarSign size={16} style={{ color: '#52c41a' }} />}
              suffix="BND"
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t('dashboard.outstanding')}
              value={adminStats?.financeSummary?.outstanding ?? 0}
              prefix={<DollarSign size={16} style={{ color: '#ff4d4f' }} />}
              suffix="BND"
              styles={{ content: { color: '#ff4d4f' } }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DashboardPage
