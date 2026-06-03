import { Card, Row, Col, Typography, Tag, Spin, Alert, Badge, List, Progress } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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
  School,
  TrendingUp,
  FileEdit,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { AttendanceAlert } from '../../types'

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
  weeklyAttendance?: { week: string; rate: number | null }[]
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
  pendingGrading: number
  attendanceAlerts: AttendanceAlert[]
}

const ADMISSION_STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  under_review: 'blue',
  accepted: 'green',
  rejected: 'red',
}

interface KpiCardProps {
  icon: React.ElementType
  color: string
  bg: string
  title: string
  value: number | string
  suffix?: string
  precision?: number
}

const KpiCard = ({ icon: Icon, color, bg, title, value, suffix, precision }: KpiCardProps) => (
  <Card style={{ borderTop: `3px solid ${color}`, height: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#86909c', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: '#1d2129' }}>
          {precision !== undefined ? Number(value).toFixed(precision) : value}
          {suffix && <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 3, color: '#86909c' }}>{suffix}</span>}
        </div>
      </div>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={color} />
      </div>
    </div>
  </Card>
)

const DashboardPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const navigate = useNavigate()
  const isTeacher = user?.role === 'teacher'
  const isPrincipal = user?.role === 'principal'
  const isManager = user?.role === 'manager'

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
        {/* Welcome Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #002a5c 0%, #0040a0 65%, #165DFF 100%)',
            borderRadius: 12,
            padding: '20px 28px',
            marginBottom: 16,
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
              {t('dashboard.teacherOverview')}
            </div>
          </div>
          <GraduationCap size={48} color="rgba(255,255,255,0.15)" />
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              icon={BookOpen}
              color="#165DFF"
              bg="#EBF1FF"
              title={t('dashboard.myCourses')}
              value={teacherStats?.myCourses ?? 0}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              icon={Users}
              color="#722ED1"
              bg="#F9F0FF"
              title={t('dashboard.myStudents')}
              value={teacherStats?.myStudents ?? 0}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              icon={FileEdit}
              color="#FA8C16"
              bg="#FFF7E6"
              title={t('dashboard.pendingGrading')}
              value={teacherStats?.pendingGrading ?? 0}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              icon={AlertTriangle}
              color="#F53F3F"
              bg="#FFF2F0"
              title={t('dashboard.attendanceAlerts')}
              value={(teacherStats?.attendanceAlerts ?? []).length}
            />
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
                  <AlertTriangle size={16} color="#f53f3f" />
                  {t('dashboard.attendanceAlerts')}
                </span>
              }
            >
              {(teacherStats?.attendanceAlerts ?? []).length === 0 ? (
                <Alert message={t('dashboard.noAlerts')} type="success" showIcon style={{ border: 'none', background: '#f6ffed' }} />
              ) : (
                <List
                  dataSource={teacherStats?.attendanceAlerts ?? []}
                  renderItem={item => (
                    <List.Item style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: '#86909c' }}>{item.className}</div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 80 }}>
                          <div style={{ fontWeight: 700, color: item.attendanceRate < 60 ? '#f53f3f' : '#ff7d00', fontSize: 15 }}>
                            {item.attendanceRate.toFixed(0)}%
                          </div>
                          <Progress percent={item.attendanceRate} size="small" showInfo={false}
                            strokeColor={item.attendanceRate < 60 ? '#f53f3f' : '#ff7d00'}
                            style={{ margin: 0, width: 80 }} />
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>
      </div>
    )
  }

  // ── Principal Dashboard ──────────────────────────────────────────
  if (isPrincipal) {
    const adminStats = stats as DashboardStats | undefined

    return (
      <div>
        <div
          style={{
            background: 'linear-gradient(135deg, #003a8c 0%, #0958d9 65%, #1677ff 100%)',
            borderRadius: 12,
            padding: '20px 28px',
            marginBottom: 16,
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
              School Strategic Overview
            </div>
          </div>
          <School size={48} color="rgba(255,255,255,0.15)" />
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8} lg={4}>
            <KpiCard icon={Users} color="#165DFF" bg="#EBF1FF" title={t('dashboard.totalStudents')} value={adminStats?.totalStudents ?? 0} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <KpiCard icon={GraduationCap} color="#722ED1" bg="#F9F0FF" title={t('dashboard.totalTeachers')} value={adminStats?.totalTeachers ?? 0} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <KpiCard icon={TrendingUp} color="#52C41A" bg="#F6FFED" title={t('dashboard.attendanceRate')} value={adminStats?.attendanceRate ?? 0} suffix="%" precision={1} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <KpiCard icon={ClipboardCheck} color="#FA8C16" bg="#FFF7E6" title={t('dashboard.pendingAdmissions')} value={adminStats?.pendingAdmissions ?? 0} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={5}>
            <KpiCard icon={DollarSign} color="#F53F3F" bg="#FFF2F0" title={t('dashboard.outstanding')} value={`${((adminStats?.financeSummary?.outstanding ?? 0) / 1000).toFixed(0)}k BND`} />
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={14}>
            <Card title={t('dashboard.enrollmentByGrade')} style={{ height: '100%' }}>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={(adminStats?.enrollmentByGrade ?? []).map((i) => ({ grade: i.gradeLevel, count: i.count }))} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="grade" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8 }} cursor={{ fill: '#f0f4ff' }} />
                    <Bar dataKey="count" fill="#003a8c" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#86909c' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={t('dashboard.attendanceTrendWeekly')} style={{ height: '100%' }}>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart
                    data={(adminStats?.weeklyAttendance ?? []).map(w => ({ ...w, rate: w.rate ?? undefined }))}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="principalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#003a8c" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#003a8c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v) => [`${(v as number)?.toFixed(1)}%`, t('dashboard.attendanceRate')]} contentStyle={{ borderRadius: 8 }} />
                    <Area type="monotone" dataKey="rate" stroke="#003a8c" strokeWidth={2} fill="url(#principalGrad)" dot={{ r: 4, fill: '#003a8c' }} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        </Row>

        {adminStats?.staffStatus && (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={16} />{t('dashboard.staffStatus')}</span>}>
                <Row gutter={16}>
                  {[{ label: t('dashboard.staffActive'), value: adminStats.staffStatus.active, color: '#52c41a', Icon: UserCheck },
                    { label: t('dashboard.staffOnLeave'), value: adminStats.staffStatus.onLeave, color: '#faad14', Icon: UserX },
                    { label: t('dashboard.staffInTraining'), value: adminStats.staffStatus.inTraining, color: '#165DFF', Icon: BookMarked }].map(({ label, value, color, Icon }) => (
                    <Col span={8} key={label}>
                      <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <Icon size={28} style={{ color, marginBottom: 8 }} />
                        <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 12, color: '#00000073', marginTop: 4 }}>{label}</div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={t('dashboard.financeSummary')}>
                <Row gutter={16}>
                  {[
                    { label: t('dashboard.totalFees'), value: adminStats.financeSummary?.totalFees ?? 0, color: '#165DFF' },
                    { label: t('dashboard.collected'), value: adminStats.financeSummary?.collected ?? 0, color: '#52c41a' },
                    { label: t('dashboard.outstanding'), value: adminStats.financeSummary?.outstanding ?? 0, color: '#f53f3f' },
                  ].map(({ label, value, color }) => (
                    <Col span={8} key={label} style={{ textAlign: 'center', padding: '8px 0' }}>
                      <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color }}>{(value / 1000).toFixed(0)}k</div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
          </Row>
        )}
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
      <div
        style={{
          background: 'linear-gradient(135deg, #002a5c 0%, #0040a0 65%, #165DFF 100%)',
          borderRadius: 12,
          padding: '20px 28px',
          marginBottom: 16,
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
            {t('dashboard.overviewTitle')}
          </div>
        </div>
        <School size={48} color="rgba(255,255,255,0.15)" />
      </div>

      {/* Row 1: KPI Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8} lg={4} xl={4}>
          <KpiCard
            icon={Users}
            color="#165DFF"
            bg="#EBF1FF"
            title={t('dashboard.totalStudents')}
            value={adminStats?.totalStudents ?? 0}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <KpiCard
            icon={GraduationCap}
            color="#722ED1"
            bg="#F9F0FF"
            title={t('dashboard.totalTeachers')}
            value={adminStats?.totalTeachers ?? 0}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <KpiCard
            icon={BookOpen}
            color="#13C2C2"
            bg="#E6FFFB"
            title={t('dashboard.totalCourses')}
            value={adminStats?.totalCourses ?? 0}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <KpiCard
            icon={TrendingUp}
            color="#52C41A"
            bg="#F6FFED"
            title={t('dashboard.attendanceRate')}
            value={adminStats?.attendanceRate ?? 0}
            suffix="%"
            precision={1}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={5} xl={5}>
          <KpiCard
            icon={ClipboardList}
            color="#FA8C16"
            bg="#FFF7E6"
            title={t('dashboard.pendingAdmissions')}
            value={adminStats?.pendingAdmissions ?? 0}
          />
        </Col>
      </Row>

      {/* Row 1b: Staff Status + Timetable Conflicts */}
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
          <Card title={t('dashboard.enrollmentByGrade')} style={{ height: '100%' }}>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={enrollmentData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="grade" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e6eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    cursor={{ fill: '#f0f4ff' }}
                  />
                  <Bar dataKey="count" fill="#165DFF" radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fontSize: 11, fill: '#86909c' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={t('dashboard.attendanceTrendWeekly')} style={{ height: '100%' }}>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <AreaChart
                  data={(adminStats?.weeklyAttendance ?? []).map(w => ({ ...w, rate: w.rate ?? undefined }))}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#165DFF" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#165DFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip
                    formatter={(v) => [`${(v as number)?.toFixed(1)}%`, t('dashboard.attendanceRate')]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e6eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                  />
                  <Area type="monotone" dataKey="rate" stroke="#165DFF" strokeWidth={2}
                    fill="url(#attendGrad)" dot={{ r: 4, fill: '#165DFF' }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
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
          <KpiCard
            icon={DollarSign}
            color="#165DFF"
            bg="#EBF1FF"
            title={t('dashboard.totalFees')}
            value={`${(adminStats?.financeSummary?.totalFees ?? 0).toLocaleString()} BND`}
          />
        </Col>
        <Col xs={24} sm={8}>
          <KpiCard
            icon={DollarSign}
            color="#52C41A"
            bg="#F6FFED"
            title={t('dashboard.collected')}
            value={`${(adminStats?.financeSummary?.collected ?? 0).toLocaleString()} BND`}
          />
        </Col>
        <Col xs={24} sm={8}>
          <KpiCard
            icon={DollarSign}
            color="#F53F3F"
            bg="#FFF2F0"
            title={t('dashboard.outstanding')}
            value={`${(adminStats?.financeSummary?.outstanding ?? 0).toLocaleString()} BND`}
          />
        </Col>
      </Row>
    </div>
  )
}

export default DashboardPage
