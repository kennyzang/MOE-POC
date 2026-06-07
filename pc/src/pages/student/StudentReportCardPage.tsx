import { Card, Typography, Space, Table, Tag, Divider, Button, Spin, Row, Col, Statistic } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FileText, Printer, ScrollText } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// Reuse the same TranscriptData shape (subset of what the endpoint returns)
interface CourseRow {
  courseId: string; courseCode: string; courseName: string
  creditHours: number; courseAverage: number | null; letterGrade: string
  gradeItems: Array<{ id: string; name: string; maxScore: number; score: number | null; letterGrade: string | null }>
}
interface TranscriptData {
  student: { id: string; studentId: string; displayName: string; gradeLevel: string | null; className: string | null }
  courses: CourseRow[]
  cumulativeGPA: number | null
  attendance: { total: number; present: number; late: number; absent: number; rate: number }
  conduct: { merits: number; demerits: number; netPoints: number }
  generatedAt: string
}

const LETTER_COLOR: Record<string, string> = {
  'A+': 'green', A: 'green', B: 'cyan', C: 'blue', D: 'orange', F: 'red',
}

const StudentReportCardPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Step 1: get the student's DB id
  const { data: me } = useQuery({
    queryKey: ['student-me-id'],
    queryFn: async () => {
      const { data } = await api.get('/students/me')
      return data.data as { id: string; studentId: string; gradeLevel: string | null; className: string | null }
    },
    enabled: user?.role === 'student',
  })

  // Step 2: fetch full transcript using the same endpoint all roles use
  const { data: transcript, isLoading } = useQuery<TranscriptData>({
    queryKey: ['student-transcript', me?.id],
    queryFn: async () => {
      const { data } = await api.get(`/students/${me!.id}/transcript`)
      return data.data as TranscriptData
    },
    enabled: !!me?.id,
  })

  if (isLoading || !me) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  const courses = transcript?.courses ?? []
  const attendance = transcript?.attendance
  const conduct = transcript?.conduct
  const overallAvg = courses.length > 0
    ? Math.round(
        courses.filter((c) => c.courseAverage !== null)
          .reduce((s, c) => s + (c.courseAverage ?? 0), 0)
        / Math.max(courses.filter((c) => c.courseAverage !== null).length, 1)
        * 10
      ) / 10
    : null

  const handlePrint = () => {
    const content = document.getElementById('report-card-content')
    if (!content) return
    const win = window.open('', '_blank', 'width=820,height=1050')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Report Card — ${user?.displayName}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 0; color: #222; margin: 0; font-size: 12px; }
            #preview-bar {
              position: sticky; top: 0; z-index: 999;
              background: #165DFF; color: #fff;
              display: flex; align-items: center; justify-content: space-between;
              padding: 10px 24px; box-shadow: 0 2px 8px rgba(0,0,0,.2);
            }
            #preview-bar span { font-size: 13px; font-weight: 600; }
            #preview-bar .actions { display: flex; gap: 10px; }
            #preview-bar button {
              padding: 6px 18px; border-radius: 4px; border: none;
              font-size: 13px; font-weight: 600; cursor: pointer;
            }
            #preview-bar .btn-print { background: #fff; color: #165DFF; }
            #preview-bar .btn-close { background: transparent; color: rgba(255,255,255,.8); border: 1px solid rgba(255,255,255,.4); }
            #doc { padding: 32px 40px; max-width: 800px; margin: 0 auto; }
            h2 { font-size: 16px; color: #165DFF; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
            th { background: #f5f5f5; padding: 8px; text-align: left; font-size: 10px; border: 1px solid #ddd; }
            td { padding: 7px 8px; border: 1px solid #eee; }
            tr:nth-child(even) td { background: #fafafa; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #165DFF; padding-bottom: 12px; margin-bottom: 20px; }
            .kpi { display: flex; gap: 24px; margin: 12px 0; }
            .kpi-item { text-align: center; }
            .kpi-item .label { font-size: 10px; color: #888; }
            .kpi-item .value { font-size: 18px; font-weight: 700; }
            .footer { margin-top: 40px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
            @media print {
              #preview-bar { display: none !important; }
              #doc { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div id="preview-bar">
            <span>Preview — Report Card · ${user?.displayName}</span>
            <div class="actions">
              <button class="btn-close" onclick="window.close()">Close</button>
              <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
            </div>
          </div>
          <div id="doc">
            ${content.innerHTML}
            <div class="footer">This is a computer-generated report card. MOE SERPS · ${dayjs().format('DD MMM YYYY')}</div>
          </div>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <FileText size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>{t('student.reportCard', { defaultValue: 'Report Card' })}</Title>
          </Space>
          <Space>
            <Button icon={<ScrollText size={14} />} onClick={() => navigate('/student/transcript')}>
              {t('transcript.title', { defaultValue: 'Official Transcript' })}
            </Button>
            <Button icon={<Printer size={14} />} onClick={handlePrint} type="primary">
              {t('transcript.print', { defaultValue: 'Print / Export PDF' })}
            </Button>
          </Space>
        </div>
      </Card>

      <div id="report-card-content">
        {/* School Header */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#165DFF' }}>{user?.school?.name ?? 'MOE School'}</div>
              <div style={{ fontSize: 12, color: '#888' }}>Ministry of Education · Brunei Darussalam</div>
              <div style={{ fontSize: 12, color: '#888' }}>Jalan Dewan Bahasa, Bandar Seri Begawan</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>STUDENT REPORT CARD</div>
              <div style={{ color: '#888', fontSize: 13 }}>Academic Year 2025/2026</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>{t('transcript.issued', { defaultValue: 'Issued' })}: {dayjs().format('DD MMM YYYY')}</div>
            </div>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <Row gutter={24}>
            <Col span={12}>
              <div><Text type="secondary" style={{ fontSize: 11 }}>STUDENT NAME</Text></div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.displayName}</div>
              <div style={{ color: '#888', fontSize: 12 }}>ID: {me?.studentId}</div>
              <div style={{ color: '#888', fontSize: 12 }}>{me?.gradeLevel}{me?.className ? ` — ${me.className}` : ''}</div>
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Row gutter={16} justify="end">
                <Col>
                  <div style={{ fontSize: 10, color: '#888' }}>OVERALL AVG</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: overallAvg !== null && overallAvg >= 70 ? '#52c41a' : '#fa8c16' }}>
                    {overallAvg !== null ? `${overallAvg}%` : '—'}
                  </div>
                </Col>
                <Col>
                  <div style={{ fontSize: 10, color: '#888' }}>GPA</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#165DFF' }}>
                    {transcript?.cumulativeGPA !== null && transcript?.cumulativeGPA !== undefined ? transcript.cumulativeGPA.toFixed(2) : '—'}
                  </div>
                </Col>
                <Col>
                  <div style={{ fontSize: 10, color: '#888' }}>ATTENDANCE</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: (attendance?.rate ?? 100) >= 80 ? '#52c41a' : '#f5222d' }}>
                    {attendance?.rate != null ? `${attendance.rate.toFixed(1)}%` : '—'}
                  </div>
                </Col>
                <Col>
                  <div style={{ fontSize: 10, color: '#888' }}>CONDUCT</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: (conduct?.netPoints ?? 0) >= 0 ? '#52c41a' : '#f5222d' }}>
                    {conduct?.netPoints !== undefined ? (conduct.netPoints >= 0 ? `+${conduct.netPoints}` : conduct.netPoints) : '—'}
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        {/* Subject Results */}
        {courses.length > 0 ? (
          <Card title={t('transcript.academicRecord', { defaultValue: 'Academic Results by Subject' })}>
            <Table
              dataSource={courses}
              rowKey="courseId"
              pagination={false}
              size="small"
              columns={[
                {
                  title: t('transcript.courseName', { defaultValue: 'Subject' }),
                  key: 'course',
                  render: (_, r: CourseRow) => (
                    <div>
                      <Text strong>{r.courseName}</Text>
                      <div style={{ fontSize: 11, color: '#888' }}>{r.courseCode}</div>
                    </div>
                  ),
                },
                {
                  title: t('transcript.creditHours', { defaultValue: 'Credits' }),
                  dataIndex: 'creditHours',
                  key: 'credits',
                  width: 70,
                  align: 'center' as const,
                },
                {
                  title: t('transcript.score', { defaultValue: 'Avg Score' }),
                  key: 'avg',
                  width: 100,
                  align: 'center' as const,
                  render: (_, r: CourseRow) => r.courseAverage !== null ? (
                    <Tag color={r.courseAverage >= 70 ? 'green' : r.courseAverage >= 50 ? 'orange' : 'red'}>
                      {r.courseAverage.toFixed(1)}%
                    </Tag>
                  ) : '—',
                },
                {
                  title: t('transcript.grade', { defaultValue: 'Grade' }),
                  key: 'grade',
                  width: 70,
                  align: 'center' as const,
                  render: (_, r: CourseRow) =>
                    r.letterGrade !== '-'
                      ? <Tag color={LETTER_COLOR[r.letterGrade] ?? 'default'}>{r.letterGrade}</Tag>
                      : '—',
                },
                {
                  title: t('transcript.gpaPoints', { defaultValue: 'GPA' }),
                  key: 'items',
                  render: (_, r: CourseRow) => (
                    <Space wrap>
                      {r.gradeItems.filter((gi) => gi.score !== null).map((gi) => (
                        <span key={gi.id} style={{ fontSize: 11, color: '#888' }}>
                          {gi.name}: {gi.score}/{gi.maxScore}
                          {gi.letterGrade && (
                            <Tag color={LETTER_COLOR[gi.letterGrade] ?? 'default'} style={{ marginLeft: 2, fontSize: 10 }}>
                              {gi.letterGrade}
                            </Tag>
                          )}
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
            <Text type="secondary">{t('transcript.noCourses', { defaultValue: 'No grade data available.' })}</Text>
          </Card>
        )}

        {/* Attendance & Conduct */}
        <Row gutter={16}>
          <Col span={12}>
            <Card title={t('transcript.attendanceSummary', { defaultValue: 'Attendance Summary' })} size="small">
              {attendance ? (
                <Row gutter={12}>
                  <Col span={12}><Statistic title={t('transcript.totalSessions', { defaultValue: 'Total Sessions' })} value={attendance.total} /></Col>
                  <Col span={12}><Statistic title={t('attendance.present', { defaultValue: 'Present' })} value={attendance.present} valueStyle={{ color: '#52c41a' }} /></Col>
                  <Col span={12}><Statistic title={t('attendance.late', { defaultValue: 'Late' })} value={attendance.late} valueStyle={{ color: '#fa8c16' }} /></Col>
                  <Col span={12}><Statistic title={t('attendance.absent', { defaultValue: 'Absent' })} value={attendance.absent} valueStyle={{ color: '#f5222d' }} /></Col>
                  <Col span={24}>
                    <Statistic
                      title={t('attendance.overallRate', { defaultValue: 'Overall Rate' })}
                      value={attendance.rate}
                      suffix="%"
                      precision={1}
                      valueStyle={{ color: attendance.rate >= 80 ? '#52c41a' : '#f5222d' }}
                    />
                  </Col>
                </Row>
              ) : <Text type="secondary">{t('common.noData', { defaultValue: 'No attendance data.' })}</Text>}
            </Card>
          </Col>
          <Col span={12}>
            <Card title={t('transcript.conductSummary', { defaultValue: 'Conduct Summary' })} size="small">
              <Row gutter={12}>
                <Col span={8}><Statistic title={t('behavior.merits', { defaultValue: 'Merits' })} value={conduct?.merits ?? 0} valueStyle={{ color: '#52c41a' }} /></Col>
                <Col span={8}><Statistic title={t('behavior.demerits', { defaultValue: 'Demerits' })} value={conduct?.demerits ?? 0} valueStyle={{ color: (conduct?.demerits ?? 0) > 0 ? '#f5222d' : undefined }} /></Col>
                <Col span={8}><Statistic
                  title={t('transcript.net', { defaultValue: 'Net Points' })}
                  value={conduct?.netPoints !== undefined ? (conduct.netPoints >= 0 ? `+${conduct.netPoints}` : conduct.netPoints) : '—'}
                  valueStyle={{ color: (conduct?.netPoints ?? 0) >= 0 ? '#52c41a' : '#f5222d' }}
                /></Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  )
}

export default StudentReportCardPage
