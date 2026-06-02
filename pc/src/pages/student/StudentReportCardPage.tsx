import { useState } from 'react'
import { Card, Select, Typography, Space, Table, Tag, Divider, Button, Spin, Row, Col, Statistic } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { FileText, Printer } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface GradeItem {
  id: string
  name: string
  type: string
  maxScore: number
  weight: number
  score: number | null
  letterGrade: string | null
  percentage: number | null
}

interface CourseGrade {
  courseId: string
  courseCode: string
  courseName: string
  gradeLevel: string | null
  courseAverage: number | null
  gradeItems: GradeItem[]
}

interface BehaviorData {
  netPoints: number
  merits: number
  demerits: number
}

const LETTER_COLOR: Record<string, string> = {
  A: 'green', B: 'cyan', C: 'blue', D: 'orange', F: 'red',
}

const SEMESTERS = ['2026-S1', '2026-S2', '2025-S1', '2025-S2']

const StudentReportCardPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [semester] = useState(SEMESTERS[0])

  const { data: grades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ['parent-grades', semester],
    queryFn: async () => {
      const { data } = await api.get(`/parent/grades`)
      return data.data as CourseGrade[]
    },
  })

  const { data: student } = useQuery({
    queryKey: ['student-me'],
    queryFn: async () => {
      const { data } = await api.get('/students/me')
      return data.data as { gradeLevel: string | null; className: string | null; studentId: string }
    },
  })

  const { data: behaviorData } = useQuery({
    queryKey: ['student-behavior'],
    queryFn: async () => {
      const { data } = await api.get('/students/me/behavior')
      return data.data as BehaviorData
    },
  })

  const { data: attendance } = useQuery({
    queryKey: ['parent-attendance'],
    queryFn: async () => {
      const { data } = await api.get('/parent/attendance')
      return data.data as { attendanceRate: number; totalSessions: number; presentCount: number; absentCount: number } | null
    },
  })

  if (gradesLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  const overallAvg = grades.length > 0
    ? Math.round(grades.filter((g) => g.courseAverage !== null).reduce((s, g) => s + (g.courseAverage ?? 0), 0) / Math.max(grades.filter((g) => g.courseAverage !== null).length, 1) * 10) / 10
    : null

  const handlePrint = () => {
    const content = document.getElementById('report-card-content')
    if (!content) return
    const win = window.open('', '_blank', 'width=800,height=1000')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Report Card — ${user?.displayName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #222; margin: 0; }
            h1 { font-size: 22px; } h2 { font-size: 16px; color: #165DFF; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
            th { background: #f5f5f5; padding: 8px; text-align: left; font-size: 11px; }
            td { padding: 8px; border-bottom: 1px solid #eee; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #165DFF; padding-bottom: 12px; margin-bottom: 20px; }
            .kpi { display: flex; gap: 24px; margin: 12px 0; }
            .kpi-item { text-align: center; }
            .label { font-size: 10px; color: #888; }
            .value { font-size: 18px; font-weight: 700; }
            .footer { margin-top: 40px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <div class="footer">This is a computer-generated report card. MOE School · ${new Date().toLocaleDateString()}</div>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <FileText size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Report Card</Title>
          </Space>
          <Button icon={<Printer size={14} />} onClick={handlePrint} type="primary">
            Download / Print PDF
          </Button>
        </div>
      </Card>

      <div id="report-card-content">
        {/* School Header */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#165DFF' }}>MOE School</div>
              <div style={{ fontSize: 12, color: '#888' }}>Ministry of Education · Brunei Darussalam</div>
              <div style={{ fontSize: 12, color: '#888' }}>Jalan Dewan Bahasa, Bandar Seri Begawan</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>STUDENT REPORT CARD</div>
              <div style={{ color: '#888', fontSize: 13 }}>Academic Year 2025/2026 · {semester}</div>
            </div>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <Row gutter={24}>
            <Col span={12}>
              <div><Text type="secondary" style={{ fontSize: 11 }}>STUDENT NAME</Text></div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.displayName}</div>
              {student && (
                <>
                  <div style={{ color: '#888', fontSize: 12 }}>ID: {student.studentId}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>{student.gradeLevel} {student.className && `— ${student.className}`}</div>
                </>
              )}
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ fontSize: 10, color: '#888' }}>OVERALL AVG</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: overallAvg !== null && overallAvg >= 70 ? '#52c41a' : '#fa8c16' }}>
                    {overallAvg !== null ? `${overallAvg}%` : '—'}
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ fontSize: 10, color: '#888' }}>ATTENDANCE</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: (attendance?.attendanceRate ?? 100) >= 80 ? '#52c41a' : '#f5222d' }}>
                    {attendance?.attendanceRate != null ? `${attendance.attendanceRate}%` : '—'}
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ fontSize: 10, color: '#888' }}>CONDUCT</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: (behaviorData?.netPoints ?? 0) >= 0 ? '#52c41a' : '#f5222d' }}>
                    {behaviorData?.netPoints !== undefined ? (behaviorData.netPoints >= 0 ? `+${behaviorData.netPoints}` : behaviorData.netPoints) : '—'}
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        {/* Subject Results */}
        {grades.length > 0 ? (
          <Card title="Academic Results by Subject">
            <Table
              dataSource={grades}
              rowKey="courseId"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Subject',
                  key: 'course',
                  render: (_, r: CourseGrade) => (
                    <div>
                      <Text strong>{r.courseName}</Text>
                      <div style={{ fontSize: 11, color: '#888' }}>{r.courseCode}</div>
                    </div>
                  ),
                },
                {
                  title: 'Avg Score',
                  key: 'avg',
                  render: (_, r: CourseGrade) => r.courseAverage !== null ? (
                    <Tag color={r.courseAverage >= 70 ? 'green' : r.courseAverage >= 50 ? 'orange' : 'red'}>
                      {r.courseAverage}%
                    </Tag>
                  ) : '—',
                },
                {
                  title: 'Grade Items',
                  key: 'items',
                  render: (_, r: CourseGrade) => (
                    <Space wrap>
                      {r.gradeItems.filter((gi) => gi.score !== null).map((gi) => (
                        <span key={gi.id} style={{ fontSize: 12, color: '#888' }}>
                          {gi.name}: {gi.score}/{gi.maxScore}
                          {gi.letterGrade && <Tag color={LETTER_COLOR[gi.letterGrade] ?? 'default'} style={{ marginLeft: 2, fontSize: 10 }}>{gi.letterGrade}</Tag>}
                        </span>
                      ))}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        ) : (
          <Card>
            <Text type="secondary">No grade data available for this semester.</Text>
          </Card>
        )}

        {/* Attendance & Conduct */}
        <Row gutter={16}>
          <Col span={12}>
            <Card title="Attendance Summary" size="small">
              {attendance ? (
                <Row gutter={12}>
                  <Col span={12}><Statistic title="Total Sessions" value={attendance.totalSessions} /></Col>
                  <Col span={12}><Statistic title="Attended" value={attendance.presentCount} /></Col>
                  <Col span={12}><Statistic title="Absent" value={attendance.absentCount} /></Col>
                  <Col span={12}><Statistic title="Rate" value={attendance.attendanceRate} suffix="%" /></Col>
                </Row>
              ) : <Text type="secondary">No attendance data available.</Text>}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Conduct Summary" size="small">
              <Row gutter={12}>
                <Col span={8}><Statistic title="Merits" value={behaviorData?.merits ?? 0} styles={{ content: { color: '#52c41a' } }} /></Col>
                <Col span={8}><Statistic title="Demerits" value={behaviorData?.demerits ?? 0} styles={{ content: { color: behaviorData?.demerits ? '#f5222d' : undefined } }} /></Col>
                <Col span={8}><Statistic title="Net" value={behaviorData?.netPoints ?? 0} styles={{ content: { color: (behaviorData?.netPoints ?? 0) >= 0 ? '#52c41a' : '#f5222d' } }} /></Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  )
}

export default StudentReportCardPage
