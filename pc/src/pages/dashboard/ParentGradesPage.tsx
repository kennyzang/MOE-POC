import { useEffect, useState } from 'react'
import {
  Card, Select, Collapse, Tag, Space, Typography, Spin, Progress,
  Row, Col, Statistic, List, message,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography
const { Panel } = Collapse

interface ChildInfo {
  id: string
  studentId: string
  gradeLevel: string
  className: string
  user: { displayName: string }
  gpa: number
  gradeAverage: number
}

interface DashboardStats { children: ChildInfo[] }

interface GradeItem {
  id: string
  name: string
  type: string
  maxScore: number
  weight: number
  dueDate: string | null
  score: number | null
  letterGrade: string | null
  remarks: string | null
  gradedAt: string | null
  percentage: number | null
}

interface SubjectData {
  courseId: string
  courseCode: string
  courseName: string
  gradeLevel: string | null
  courseAverage: number | null
  gradeItems: GradeItem[]
}

const TYPE_COLORS: Record<string, string> = { exam: '#f5222d', quiz: '#fa8c16', assignment: '#1677ff', project: '#52c41a' }

const letterColor = (l: string | null) => {
  if (!l) return '#86909c'
  if (l === 'A') return '#52c41a'
  if (l === 'B') return '#1677ff'
  if (l === 'C') return '#fa8c16'
  return '#f5222d'
}

const ParentGradesPage = () => {
  const { t } = useTranslation()
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>(undefined)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['parent-dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      const result = data.data as DashboardStats
      if (result.children?.length > 0 && !selectedChildId) {
        setSelectedChildId(result.children[0].id)
      }
      return result
    },
  })

  const children = stats?.children ?? []
  const selectedChild = children.find((c) => c.id === selectedChildId) ?? children[0]

  const { data: subjectData, isLoading: gradesLoading } = useQuery({
    queryKey: ['parent-grades', selectedChild?.id],
    queryFn: async () => {
      const { data } = await api.get('/parent/grades', { params: { childId: selectedChild!.id } })
      return data.data as SubjectData[]
    },
    enabled: !!selectedChild?.id,
  })

  // SSE: refresh when grades are updated
  useEffect(() => {
    if (!token) return
    const es = new EventSource(`/api/v1/events/stream?topics=dashboard&token=${token}`)
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { event?: string }
        if (msg.event === 'dashboard.gradeUpdated' || msg.event?.startsWith('dashboard.grade')) {
          void queryClient.invalidateQueries({ queryKey: ['parent-grades'] })
          void message.info(t('parentPortal.gradeUpdated', { defaultValue: 'A new grade has been posted for your child.' }), 3)
        }
      } catch {
        // ignore
      }
    }
    return () => es.close()
  }, [token, queryClient, t])

  if (statsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  // Compute overall GPA trend from subject averages (simplified: flat data point per subject)
  const gpaTrendData = (subjectData ?? []).map((s) => ({
    name: s.courseCode,
    average: s.courseAverage ?? 0,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <Card>
        <Space align="center">
          <GraduationCap size={24} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>
            {t('parentPortal.childGrades')}
          </Title>
        </Space>
      </Card>

      {/* Child Selector */}
      {children.length > 1 && (
        <Card>
          <Space align="center">
            <Text>{t('parentPortal.selectChild')}:</Text>
            <Select
              value={selectedChildId}
              onChange={setSelectedChildId}
              style={{ minWidth: 200 }}
              options={children.map((c) => ({ value: c.id, label: c.user.displayName }))}
            />
          </Space>
        </Card>
      )}

      {selectedChild && (
        <>
          {/* Summary Row */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title={t('parentPortal.gradeOverview')}
                  value={selectedChild.gradeAverage}
                  suffix="%"
                  precision={1}
                  styles={{
                    content: {
                      fontSize: 28,
                      color:
                        selectedChild.gradeAverage >= 75
                          ? '#52c41a'
                          : selectedChild.gradeAverage >= 50
                            ? '#faad14'
                            : '#f5222d',
                    },
                  }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title={t('dashboard.gpa')}
                  value={selectedChild.gpa}
                  precision={2}
                  styles={{ content: { fontSize: 28, color: '#165DFF' } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title={t('students.className')}
                  value={`${selectedChild.gradeLevel} ${selectedChild.className}`}
                  styles={{ content: { fontSize: 20 } }}
                />
              </Card>
            </Col>
          </Row>

          {/* Subject Performance Chart */}
          {gpaTrendData.length > 0 && (
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={15} />
                  {t('parentPortal.subjectPerformance', { defaultValue: 'Subject Performance Overview' })}
                </span>
              }
            >
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={gpaTrendData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: number) => [`${v?.toFixed(1)}%`, t('parentPortal.gradeOverview')]} />
                    <Line type="monotone" dataKey="average" stroke="#165DFF" strokeWidth={2} dot={{ r: 5, fill: '#165DFF' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Subject-by-Subject Breakdown */}
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
                        ) : (
                          <Tag color="default">No Grades</Tag>
                        )}
                      </Space>
                    </div>
                  }
                >
                  {/* Course Average Progress */}
                  {subject.courseAverage != null && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12 }}>{t('grades.weightedAvg')}</Text>
                        <Text strong style={{ fontSize: 12 }}>{subject.courseAverage.toFixed(1)}%</Text>
                      </div>
                      <Progress
                        percent={Math.round(subject.courseAverage)}
                        strokeColor={subject.courseAverage >= 75 ? '#52c41a' : subject.courseAverage >= 50 ? '#fa8c16' : '#f5222d'}
                        size="small"
                        showInfo={false}
                      />
                    </div>
                  )}

                  {/* Grade Items */}
                  <List
                    dataSource={subject.gradeItems}
                    locale={{ emptyText: t('grades.noGradeItems') }}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '8px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                              <Tag style={{ fontSize: 10, padding: '0 5px' }} color={TYPE_COLORS[item.type] ?? 'default'}>
                                {t(`grades.${item.type}` as never, item.type)}
                              </Tag>
                              {item.dueDate && (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {new Date(item.dueDate).toLocaleDateString()}
                                </Text>
                              )}
                              {item.weight !== 1 && (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  Weight: {item.weight}
                                </Text>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {item.score != null ? (
                              <>
                                <div style={{ fontWeight: 700, fontSize: 15 }}>
                                  {item.score}/{item.maxScore}
                                </div>
                                <div style={{ fontSize: 11, color: '#86909c' }}>
                                  {item.percentage?.toFixed(1)}%
                                </div>
                                {item.letterGrade && (
                                  <Tag style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }} color="default">
                                    <span style={{ color: letterColor(item.letterGrade) }}>{item.letterGrade}</span>
                                  </Tag>
                                )}
                              </>
                            ) : (
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('common.noData')}</Text>
                            )}
                          </div>
                        </div>
                        {item.remarks && (
                          <div style={{ width: '100%', fontSize: 12, color: '#595959', fontStyle: 'italic', marginTop: 4 }}>
                            "{item.remarks}"
                          </div>
                        )}
                      </List.Item>
                    )}
                  />
                </Panel>
              ))}
            </Collapse>
          )}
        </>
      )}

      {children.length === 0 && (
        <Card><Text type="secondary">{t('common.noData')}</Text></Card>
      )}
    </div>
  )
}

export default ParentGradesPage
