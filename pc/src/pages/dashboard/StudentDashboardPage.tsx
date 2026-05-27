import { Card, Row, Col, Statistic, List, Spin, Typography, Tag, Progress } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarCheck, Award, Clock } from 'lucide-react'
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
              styles={{ content: { color: '#1677ff', fontWeight: 700 } }}
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
              styles={{ content: { color: '#52c41a', fontWeight: 700 } }}
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
              styles={{ content: { color: '#fa8c16', fontWeight: 700 } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* My Timetable */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={15} />
                {t('dashboard.myTimetable')}
              </span>
            }
            style={{ borderRadius: 10 }}
          >
            {(stats?.courseSchedules ?? []).length === 0 ? (
              <Text type="secondary">{t('common.noData')}</Text>
            ) : (
              <List
                dataSource={stats?.courseSchedules ?? []}
                renderItem={cs => (
                  <List.Item style={{ padding: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cs.courseName}
                        </div>
                        <div style={{ fontSize: 11, color: '#86909c' }}>{cs.courseCode}</div>
                      </div>
                      <Tag color="blue" style={{ flexShrink: 0, fontSize: 11 }}>
                        {cs.schedule ?? t('dashboard.noSchedule')}
                      </Tag>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Attendance Detail */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarCheck size={15} />
                {t('dashboard.attendanceDetail')}
              </span>
            }
            style={{ borderRadius: 10 }}
          >
            {(() => {
              const bd = stats?.attendanceBreakdown ?? { present: 0, absent: 0, late: 0, excused: 0 }
              const total = bd.present + bd.absent + bd.late + bd.excused
              const rows = [
                { key: 'present', label: t('attendance.present'), value: bd.present, color: '#52c41a' },
                { key: 'absent',  label: t('attendance.absent'),  value: bd.absent,  color: '#f53f3f' },
                { key: 'late',    label: t('attendance.late'),    value: bd.late,    color: '#faad14' },
                { key: 'excused', label: t('attendance.excused'), value: bd.excused, color: '#8c8c8c' },
              ]
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rows.map(r => (
                    <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 56, fontSize: 12, color: '#4e5969' }}>{r.label}</div>
                      <Progress
                        percent={total === 0 ? 0 : Math.round((r.value / total) * 100)}
                        size="small"
                        showInfo={false}
                        strokeColor={r.color}
                        style={{ flex: 1, margin: 0 }}
                      />
                      <div style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 600, color: r.color }}>
                        {r.value}
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#86909c', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                    {t('attendance.totalSessions')}: {total}
                  </div>
                </div>
              )
            })()}
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
