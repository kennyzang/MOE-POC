import { useEffect } from 'react'
import {
  Card, Row, Col, Statistic, List, Spin, Typography, Tag, Progress, Alert, Space,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CalendarCheck, Award, Clock, TrendingUp, Bell } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type { GradeItem } from '@/types'

const { Title, Text } = Typography

interface SubjectScore {
  courseId: string
  courseName: string
  courseCode: string
  studentScore: number | null
  classAverage: number | null
}

interface Notification {
  id: string
  title: string
  message: string
  type: string
  createdAt: string
}

interface StudentDashboardStats {
  enrolledCourses: number
  attendanceRate: number
  gpa: number
  riskBand: string
  upcomingItems: GradeItem[]
  courseSchedules: { courseId: string; courseCode: string; courseName: string; gradeLevel: string; schedule: string | null }[]
  attendanceBreakdown: { present: number; absent: number; late: number; excused: number }
  weeklyGpaTrend: { week: string; gpa: number }[]
  subjectScores: SubjectScore[]
  recentNotifications: Notification[]
}

const GRADE_TYPE_COLORS: Record<string, string> = {
  exam: '#f5222d',
  quiz: '#fa8c16',
  assignment: '#1677ff',
  project: '#52c41a',
}

const RISK_COLORS: Record<string, string> = { HIGH_RISK: '#f5222d', MEDIUM_RISK: '#fa8c16', LOW_RISK: '#52c41a' }

const StudentDashboardPage = () => {
  const { t } = useTranslation()
  const { user, token } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-dashboard-stats', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      return data.data as StudentDashboardStats
    },
    enabled: !!user,
  })

  // SSE: refresh when teacher posts a grade or marks attendance
  useEffect(() => {
    if (!token) return
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1'
    const es = new EventSource(`${base}/events/stream?topics=dashboard&token=${token}`)
    const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] }) }
    es.addEventListener('dashboard.gradeUpdated', invalidate)
    es.addEventListener('dashboard.attendance.changed', invalidate)
    return () => {
      es.removeEventListener('dashboard.gradeUpdated', invalidate)
      es.removeEventListener('dashboard.attendance.changed', invalidate)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      {/* Risk Alert Banner */}
      {stats?.riskBand === 'HIGH_RISK' && (
        <Alert
          type="error"
          showIcon
          message={t('dashboard.riskAlertHigh', { defaultValue: 'Your attendance is critically low. Please speak to your class counselor.' })}
        />
      )}
      {stats?.riskBand === 'MONITOR' && (
        <Alert
          type="warning"
          showIcon
          message={t('dashboard.riskAlertMonitor', { defaultValue: 'Your attendance needs attention. Please maintain regular attendance to stay on track.' })}
        />
      )}

      {/* KPI Stat Cards */}
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
              styles={{
                content: {
                  color: (stats?.attendanceRate ?? 0) >= 80 ? '#52c41a' : (stats?.attendanceRate ?? 0) >= 60 ? '#fa8c16' : '#f5222d',
                  fontWeight: 700,
                },
              }}
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
        {/* GPA Trend Chart */}
        {(stats?.weeklyGpaTrend ?? []).length > 0 && (
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={15} />
                  {t('dashboard.gpaTrend', { defaultValue: 'GPA Trend (8 Weeks)' })}
                </span>
              }
              style={{ borderRadius: 10 }}
            >
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={stats!.weeklyGpaTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 4]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toFixed(1)} />
                    <Tooltip formatter={(v) => [(v as number).toFixed(2), t('dashboard.gpa')]} />
                    <Line type="monotone" dataKey="gpa" stroke="#fa8c16" strokeWidth={2} dot={{ r: 4, fill: '#fa8c16' }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        )}

        {/* My Timetable */}
        <Col xs={24} lg={(stats?.weeklyGpaTrend ?? []).length > 0 ? 12 : 24}>
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
      </Row>

      {/* Subject Performance */}
      {(stats?.subjectScores ?? []).length > 0 && (
        <Card
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={15} />
              {t('dashboard.subjectPerformance', { defaultValue: 'Subject Performance' })}
            </span>
          }
          style={{ borderRadius: 10 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(stats!.subjectScores).map((s) => (
              <div key={s.courseId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13 }}>{s.courseName}</Text>
                  <Space>
                    {s.studentScore != null && (
                      <Tag color={s.studentScore >= 75 ? 'green' : s.studentScore >= 50 ? 'orange' : 'red'} style={{ fontSize: 11 }}>
                        You: {s.studentScore.toFixed(1)}%
                      </Tag>
                    )}
                    {s.classAverage != null && (
                      <Tag color="blue" style={{ fontSize: 11 }}>
                        Class avg: {s.classAverage.toFixed(1)}%
                      </Tag>
                    )}
                  </Space>
                </div>
                {s.studentScore != null && (
                  <Progress
                    percent={Math.round(s.studentScore)}
                    size="small"
                    strokeColor={s.studentScore >= 75 ? '#52c41a' : s.studentScore >= 50 ? '#fa8c16' : '#f5222d'}
                    showInfo={false}
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Row gutter={[16, 16]}>
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
                { key: 'absent', label: t('attendance.absent'), value: bd.absent, color: '#f53f3f' },
                { key: 'late', label: t('attendance.late'), value: bd.late, color: '#faad14' },
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

        {/* Recent Notifications */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={15} />
                {t('notifications.title')}
              </span>
            }
            style={{ borderRadius: 10 }}
          >
            {(stats?.recentNotifications ?? []).length === 0 ? (
              <Text type="secondary">{t('notifications.noNotifications')}</Text>
            ) : (
              <List
                dataSource={stats!.recentNotifications}
                renderItem={(n) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: '#86909c' }}>{n.message}</div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Upcoming Assessments */}
      <Card title={t('dashboard.upcomingAssessments')} style={{ borderRadius: 10 }}>
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
