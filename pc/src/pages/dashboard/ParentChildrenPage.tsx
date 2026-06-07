import { useEffect, useState } from 'react'
import {
  Card, Row, Col, Statistic, Button, Space, Typography, Spin, Empty,
  Tag, Modal, List, Badge, Select, Tabs, Table, Progress, Collapse,
} from 'antd'
import { Calendar as AntCalendar } from 'antd'
import type { Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users, Phone, AlertTriangle, CalendarCheck, GraduationCap, TrendingUp,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { ColumnsType } from 'antd/es/table'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography
const { Panel } = Collapse

// ─── Shared types ─────────────────────────────────────────────────────────────

interface Teacher { courseId: string; courseName: string; teacherName: string; teacherEmail: string }

interface ChildInfo {
  id: string
  studentId: string
  gradeLevel: string
  className: string
  user: { displayName: string }
  gpa: number
  gradeAverage: number
  attendanceRate: number
  riskBand: string
  riskScore: number | null
  recentAbsences: number
  teachers: Teacher[]
}

interface DashboardStats { children: ChildInfo[] }

interface GradeItem {
  id: string; name: string; type: string; maxScore: number; weight: number
  dueDate: string | null; score: number | null; letterGrade: string | null
  remarks: string | null; gradedAt: string | null; percentage: number | null
}

interface SubjectData {
  courseId: string; courseCode: string; courseName: string
  gradeLevel: string | null; courseAverage: number | null; gradeItems: GradeItem[]
}

interface AttendanceRecord {
  id: string
  status: 'present' | 'absent' | 'late' | 'excused'
  checkedInAt: string | null
  absenceReason: string | null
  session: { date: string; topic: string | null; course: { name: string; code: string } }
}

// ─── Colour maps ──────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = { HIGH_RISK: 'red', MONITOR: 'orange', ON_TRACK: 'green' }
const RISK_LABEL: Record<string, string> = { HIGH_RISK: 'High Risk', MONITOR: 'Monitor', ON_TRACK: 'Good Standing' }
const GRADE_TYPE_COLORS: Record<string, string> = { exam: '#f5222d', quiz: '#fa8c16', assignment: '#1677ff', project: '#52c41a' }
const ATT_STATUS_COLOR: Record<string, string> = { present: 'green', absent: 'red', late: 'orange', excused: 'blue' }
const ATT_CAL_COLOR: Record<string, string> = { present: '#52c41a', absent: '#f5222d', late: '#fa8c16', excused: '#1677ff' }

const letterColor = (l: string | null) => {
  if (!l) return '#86909c'
  if (l === 'A') return '#52c41a'
  if (l === 'B') return '#1677ff'
  if (l === 'C') return '#fa8c16'
  return '#f5222d'
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ParentChildrenPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialTab = searchParams.get('tab') ?? 'overview'
  const initialChild = searchParams.get('child') ?? undefined

  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>(initialChild)
  const [contactChild, setContactChild] = useState<ChildInfo | null>(null)

  // ── Load children ──────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['parent-dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      return data.data as DashboardStats
    },
  })

  const children = stats?.children ?? []

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id)
    }
  }, [children, selectedChildId])

  const selectedChild = children.find((c) => c.id === selectedChildId) ?? children[0]

  // ── Load grades for selected child ─────────────────────────────────────────

  const { data: subjectData, isLoading: gradesLoading } = useQuery({
    queryKey: ['parent-grades', selectedChild?.id],
    queryFn: async () => {
      const { data } = await api.get('/parent/grades', { params: { childId: selectedChild!.id } })
      return data.data as SubjectData[]
    },
    enabled: !!selectedChild?.id && activeTab === 'grades',
  })

  // ── Load attendance for selected child ─────────────────────────────────────

  const { data: attendanceRecords, isLoading: attLoading } = useQuery({
    queryKey: ['parent-attendance-records', selectedChild?.studentId],
    queryFn: async () => {
      const { data } = await api.get('/attendance/records', {
        params: { studentId: selectedChild!.studentId },
      })
      return data.data as AttendanceRecord[]
    },
    enabled: !!selectedChild?.studentId && activeTab === 'attendance',
    retry: false,
  })

  // SSE for grades / attendance refresh
  useEffect(() => {
    if (!token) return
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1'
    const es = new EventSource(`${base}/events/stream?topics=dashboard&token=${token}`)
    const onGrade = () => void queryClient.invalidateQueries({ queryKey: ['parent-grades'] })
    const onAtt = () => {
      void queryClient.invalidateQueries({ queryKey: ['parent-attendance-records'] })
      void queryClient.invalidateQueries({ queryKey: ['parent-dashboard-stats'] })
    }
    es.addEventListener('dashboard.gradeUpdated', onGrade)
    es.addEventListener('dashboard.attendance.changed', onAtt)
    return () => {
      es.removeEventListener('dashboard.gradeUpdated', onGrade)
      es.removeEventListener('dashboard.attendance.changed', onAtt)
      es.close()
    }
  }, [token, queryClient])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const switchToTab = (tab: string, childId?: string) => {
    const id = childId ?? selectedChildId
    if (id) setSelectedChildId(id)
    setActiveTab(tab)
    setSearchParams(id ? { tab, child: id } : { tab })
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    setSearchParams(selectedChildId ? { tab: key, child: selectedChildId } : { tab: key })
  }

  const handleChildChange = (id: string) => {
    setSelectedChildId(id)
    setSearchParams({ tab: activeTab, child: id })
  }

  // Attendance helpers
  const dateStatusMap = (attendanceRecords ?? []).reduce<Record<string, string>>((acc, r) => {
    const dateKey = new Date(r.session.date).toISOString().slice(0, 10)
    const priority: Record<string, number> = { absent: 4, late: 3, excused: 2, present: 1 }
    if (!acc[dateKey] || (priority[r.status] ?? 0) > (priority[acc[dateKey]] ?? 0)) acc[dateKey] = r.status
    return acc
  }, {})

  const breakdown = (attendanceRecords ?? []).reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc },
    { present: 0, absent: 0, late: 0, excused: 0 } as Record<string, number>,
  )
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)

  const dateCellRender = (date: Dayjs) => {
    const key = date.format('YYYY-MM-DD')
    const status = dateStatusMap[key]
    if (!status) return null
    return <Badge color={ATT_CAL_COLOR[status] ?? '#999'} style={{ width: 6, height: 6, borderRadius: '50%', display: 'block', margin: '0 auto' }} />
  }

  const attColumns: ColumnsType<AttendanceRecord> = [
    {
      title: t('common.date'), key: 'date',
      render: (_: unknown, r) => new Date(r.session.date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.session.date).getTime() - new Date(b.session.date).getTime(),
      defaultSortOrder: 'descend', width: 110,
    },
    {
      title: t('courses.courseName'), key: 'course',
      render: (_: unknown, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.session.course.name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.session.course.code}</Text>
        </Space>
      ),
    },
    {
      title: t('attendance.topic'), key: 'topic',
      render: (_: unknown, r) => r.session.topic ?? '—',
    },
    {
      title: t('common.status'), dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => <Tag color={ATT_STATUS_COLOR[s] ?? 'default'}>{t(`attendance.${s}` as never, s)}</Tag>,
      filters: ['present', 'absent', 'late', 'excused'].map((s) => ({ text: t(`attendance.${s}` as never), value: s })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: t('parentPortal.absenceReason', { defaultValue: 'Reason' }), key: 'reason',
      render: (_: unknown, r) => r.absenceReason ?? '—',
    },
  ]

  // ── Child selector (shown in Grades and Attendance tabs) ────────────────────

  const childSelector = children.length > 1 && (
    <Card style={{ marginBottom: 16 }}>
      <Space>
        <Text>{t('parentPortal.selectChild')}:</Text>
        <Select
          value={selectedChildId}
          onChange={handleChildChange}
          style={{ minWidth: 200 }}
          options={children.map((c) => ({ value: c.id, label: c.user.displayName }))}
        />
      </Space>
    </Card>
  )

  // ── GPA trend data ─────────────────────────────────────────────────────────

  const gpaTrendData = (subjectData ?? []).map((s) => ({ name: s.courseCode, average: s.courseAverage ?? 0 }))

  // ── TAB ITEMS ──────────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'overview',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> My Children</span>,
      children: (
        <>
          {statsLoading ? (
            <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
          ) : children.length === 0 ? (
            <Card><Empty description={<Text type="secondary">{t('common.noData')}</Text>} /></Card>
          ) : (
            <Row gutter={[16, 16]}>
              {children.map((child) => (
                <Col key={child.id} xs={24} sm={12} lg={8}>
                  <Card
                    title={<Space><Users size={16} style={{ color: '#165DFF' }} /><span>{child.user.displayName}</span></Space>}
                    extra={<Tag color={RISK_COLOR[child.riskBand] ?? 'default'} style={{ fontSize: 11 }}>{RISK_LABEL[child.riskBand] ?? child.riskBand}</Tag>}
                    style={{ height: '100%' }}
                  >
                    <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                      <Col span={12}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t('students.gradeLevel')}</Text>
                        <div><Text strong>{child.gradeLevel}</Text></div>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t('students.className')}</Text>
                        <div><Text strong>{child.className}</Text></div>
                      </Col>
                    </Row>

                    <Row gutter={[12, 12]} style={{ marginBottom: 8 }}>
                      <Col span={12}>
                        <Statistic
                          title={t('dashboard.attendanceRate')} value={child.attendanceRate} suffix="%" precision={1}
                          styles={{ content: { fontSize: 20, color: child.attendanceRate >= 80 ? '#52c41a' : child.attendanceRate >= 60 ? '#faad14' : '#ff4d4f' } }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title={t('parentPortal.gradeOverview')} value={child.gradeAverage} suffix="%" precision={1}
                          styles={{ content: { fontSize: 20, color: '#165DFF' } }}
                        />
                      </Col>
                    </Row>

                    {child.recentAbsences > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: child.recentAbsences >= 3 ? '#fff2f0' : '#fff7e6', borderRadius: 6, padding: '6px 10px', marginBottom: 12 }}>
                        <AlertTriangle size={13} color={child.recentAbsences >= 3 ? '#f5222d' : '#fa8c16'} />
                        <Text style={{ fontSize: 12, color: child.recentAbsences >= 3 ? '#f5222d' : '#fa8c16' }}>
                          {child.recentAbsences} {t('parentPortal.recentAbsences', { defaultValue: 'absence(s) in last 14 days' })}
                        </Text>
                      </div>
                    )}

                    <Space style={{ width: '100%' }} direction="vertical">
                      <Button type="primary" block icon={<GraduationCap size={14} />} onClick={() => switchToTab('grades', child.id)}>
                        {t('parentPortal.viewGrades')}
                      </Button>
                      <Button block icon={<CalendarCheck size={14} />} onClick={() => switchToTab('attendance', child.id)}>
                        {t('parentPortal.viewAttendance')}
                      </Button>
                      <Button block icon={<Phone size={14} />} onClick={() => setContactChild(child)}>
                        {t('parentPortal.contactTeacher', { defaultValue: 'Contact Teachers' })}
                      </Button>
                      <Button block onClick={() => navigate(`/parent/transcript/${child.id}`)}>
                        {t('transcript.title', { defaultValue: 'Academic Transcript' })}
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </>
      ),
    },

    {
      key: 'grades',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><GraduationCap size={14} /> Grades</span>,
      children: (
        <>
          {childSelector}
          {selectedChild ? (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={8}>
                  <Card>
                    <Statistic title={t('parentPortal.gradeOverview')} value={selectedChild.gradeAverage} suffix="%" precision={1}
                      styles={{ content: { fontSize: 28, color: selectedChild.gradeAverage >= 75 ? '#52c41a' : selectedChild.gradeAverage >= 50 ? '#faad14' : '#f5222d' } }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card><Statistic title={t('dashboard.gpa')} value={selectedChild.gpa} precision={2} styles={{ content: { fontSize: 28, color: '#165DFF' } }} /></Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card><Statistic title={t('students.className')} value={`${selectedChild.gradeLevel} ${selectedChild.className}`} styles={{ content: { fontSize: 20 } }} /></Card>
                </Col>
              </Row>

              {gpaTrendData.length > 0 && (
                <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={15} />{t('parentPortal.subjectPerformance', { defaultValue: 'Subject Performance Overview' })}</span>} style={{ marginBottom: 16 }}>
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <LineChart data={gpaTrendData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                        <Tooltip formatter={(v) => [`${(v as number)?.toFixed(1)}%`, t('parentPortal.gradeOverview')]} />
                        <Line type="monotone" dataKey="average" stroke="#165DFF" strokeWidth={2} dot={{ r: 5, fill: '#165DFF' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {gradesLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
              ) : (
                <Collapse accordion>
                  {(subjectData ?? []).map((subject) => (
                    <Panel
                      key={subject.courseId}
                      header={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 12 }}>
                          <span style={{ fontWeight: 600 }}>{subject.courseName}</span>
                          <Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>{subject.courseCode}</Text>
                            {subject.courseAverage != null ? (
                              <Tag color={subject.courseAverage >= 75 ? 'green' : subject.courseAverage >= 50 ? 'orange' : 'red'}>
                                {subject.courseAverage.toFixed(1)}%
                              </Tag>
                            ) : <Tag color="default">No Grades</Tag>}
                          </Space>
                        </div>
                      }
                    >
                      {subject.courseAverage != null && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12 }}>{t('grades.weightedAvg')}</Text>
                            <Text strong style={{ fontSize: 12 }}>{subject.courseAverage.toFixed(1)}%</Text>
                          </div>
                          <Progress percent={Math.round(subject.courseAverage)}
                            strokeColor={subject.courseAverage >= 75 ? '#52c41a' : subject.courseAverage >= 50 ? '#fa8c16' : '#f5222d'}
                            size="small" showInfo={false}
                          />
                        </div>
                      )}
                      <List dataSource={subject.gradeItems} locale={{ emptyText: t('grades.noGradeItems') }}
                        renderItem={(item) => (
                          <List.Item style={{ padding: '8px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                                  <Tag style={{ fontSize: 10, padding: '0 5px' }} color={GRADE_TYPE_COLORS[item.type] ?? 'default'}>
                                    {t(`grades.${item.type}` as never, item.type)}
                                  </Tag>
                                  {item.dueDate && <Text type="secondary" style={{ fontSize: 11 }}>{new Date(item.dueDate).toLocaleDateString()}</Text>}
                                  {item.weight !== 1 && <Text type="secondary" style={{ fontSize: 11 }}>Weight: {item.weight}</Text>}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                {item.score != null ? (
                                  <>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{item.score}/{item.maxScore}</div>
                                    <div style={{ fontSize: 11, color: '#86909c' }}>{item.percentage?.toFixed(1)}%</div>
                                    {item.letterGrade && (
                                      <Tag style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }} color="default">
                                        <span style={{ color: letterColor(item.letterGrade) }}>{item.letterGrade}</span>
                                      </Tag>
                                    )}
                                  </>
                                ) : <Text type="secondary" style={{ fontSize: 12 }}>{t('common.noData')}</Text>}
                              </div>
                            </div>
                            {item.remarks && (
                              <div style={{ width: '100%', fontSize: 12, color: '#595959', fontStyle: 'italic', marginTop: 4 }}>"{item.remarks}"</div>
                            )}
                          </List.Item>
                        )}
                      />
                    </Panel>
                  ))}
                </Collapse>
              )}
            </>
          ) : <Card><Text type="secondary">{t('common.noData')}</Text></Card>}
        </>
      ),
    },

    {
      key: 'attendance',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarCheck size={14} /> Attendance</span>,
      children: (
        <>
          {childSelector}
          {selectedChild ? (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={6}>
                  <Card>
                    <Statistic title={t('parentPortal.attendanceRate')} value={selectedChild.attendanceRate} suffix="%" precision={1}
                      styles={{ content: { fontSize: 24, color: selectedChild.attendanceRate >= 80 ? '#52c41a' : selectedChild.attendanceRate >= 60 ? '#faad14' : '#f5222d' } }}
                    />
                  </Card>
                </Col>
                {(['present', 'absent', 'late', 'excused'] as const).map((s) => (
                  <Col xs={12} sm={4} key={s}>
                    <Card>
                      <Statistic title={t(`attendance.${s}`)} value={breakdown[s] ?? 0}
                        styles={{ content: { color: ATT_CAL_COLOR[s], fontSize: 22 } }}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>

              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(['present', 'absent', 'late', 'excused'] as const).map((s) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 64, fontSize: 12, color: '#4e5969' }}>{t(`attendance.${s}`)}</div>
                      <Progress
                        percent={total === 0 ? 0 : Math.round(((breakdown[s] ?? 0) / total) * 100)}
                        size="small" showInfo={false} strokeColor={ATT_CAL_COLOR[s]}
                        style={{ flex: 1, margin: 0 }}
                      />
                      <div style={{ width: 36, textAlign: 'right', fontSize: 12, fontWeight: 600, color: ATT_CAL_COLOR[s] }}>
                        {breakdown[s] ?? 0}
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#86909c', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                    {t('attendance.totalSessions')}: {total}
                  </div>
                </div>
              </Card>

              <Card
                title={<Space><CalendarCheck size={15} />{t('parentPortal.attendanceCalendar', { defaultValue: 'Attendance Calendar' })}</Space>}
                extra={
                  <Space wrap>
                    {(['present', 'absent', 'late', 'excused'] as const).map((s) => (
                      <Space key={s} size={4}><Badge color={ATT_CAL_COLOR[s]} /><Text style={{ fontSize: 11 }}>{t(`attendance.${s}`)}</Text></Space>
                    ))}
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                {attLoading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                ) : (
                  <AntCalendar fullscreen={false} cellRender={dateCellRender} />
                )}
              </Card>

              <Card title={t('attendance.session')}>
                <Table
                  columns={attColumns}
                  dataSource={attendanceRecords ?? []}
                  rowKey="id"
                  loading={attLoading}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  locale={{ emptyText: t('common.noData') }}
                  size="middle"
                />
              </Card>
            </>
          ) : <Card><Text type="secondary">{t('common.noData')}</Text></Card>}
        </>
      ),
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space align="center">
          <Users size={24} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>{t('parentPortal.myChildren')}</Title>
        </Space>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        type="card"
        size="middle"
        style={{ background: '#fff', borderRadius: 8, padding: '12px 16px 0' }}
        tabBarStyle={{ marginBottom: 16 }}
      />

      {/* Contact Teachers Modal */}
      <Modal
        title={<Space><Phone size={16} />{t('parentPortal.contactTeacherTitle', { name: contactChild?.user.displayName ?? '', defaultValue: `Teachers for ${contactChild?.user.displayName ?? ''}` })}</Space>}
        open={!!contactChild}
        onCancel={() => setContactChild(null)}
        footer={null}
        width={480}
      >
        {contactChild && (
          <List
            dataSource={contactChild.teachers}
            locale={{ emptyText: t('common.noData') }}
            renderItem={(teacher) => (
              <List.Item>
                <div style={{ width: '100%' }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{teacher.teacherName}</div>
                  <div style={{ fontSize: 11, color: '#86909c' }}>{teacher.courseName}</div>
                  {teacher.teacherEmail && (
                    <div style={{ fontSize: 12, color: '#165DFF', marginTop: 2 }}>
                      <a href={`mailto:${teacher.teacherEmail}`}>{teacher.teacherEmail}</a>
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  )
}

export default ParentChildrenPage
