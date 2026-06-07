import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Row, Col, Typography, Space, Table, Tag, Divider,
  Button, Spin, Alert, Statistic, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, Printer, FileText, GraduationCap, Award } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

interface GradeItemRow {
  id: string; name: string; type: string
  maxScore: number; weight: number
  score: number | null; percentage: number | null; letterGrade: string | null
  dueDate: string | null; gradedAt: string | null
}

interface CourseRow {
  courseId: string; courseCode: string; courseName: string
  gradeLevel: string | null; creditHours: number; semester: string
  enrollmentStatus: string
  courseAverage: number | null; letterGrade: string; gpaPoints: number
  courseAttendanceRate: number | null
  gradeItems: GradeItemRow[]
}

interface TranscriptData {
  student: {
    id: string; studentId: string; displayName: string; email: string | null
    gradeLevel: string | null; className: string | null
    enrollmentStatus: string; academicStanding: string | null
    academicStandingUpdatedAt: string | null
  }
  courses: CourseRow[]
  cumulativeGPA: number | null
  totalCreditHours: number
  attendance: { total: number; present: number; late: number; absent: number; excused: number; rate: number }
  conduct: { merits: number; demerits: number; netPoints: number }
  standingHistory: Array<{ id: string; previousStanding: string; newStanding: string; trigger: string; gradeAvg: number; createdAt: string }>
  generatedAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LETTER_COLOR: Record<string, string> = {
  'A+': 'green', A: 'green', B: 'cyan', C: 'blue', D: 'orange', F: 'red', '-': 'default',
}

const STANDING_LABEL: Record<string, string> = {
  GOOD_STANDING: 'Good Standing', ACADEMIC_WATCH: 'Academic Watch',
  PROBATION: 'Probation', AT_RISK: 'At Risk',
}
const STANDING_COLOR: Record<string, string> = {
  GOOD_STANDING: 'success', ACADEMIC_WATCH: 'warning', PROBATION: 'error', AT_RISK: 'error',
}

// ─── Component ────────────────────────────────────────────────────────────────

const StudentTranscriptPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id: paramId } = useParams<{ id?: string }>()
  const { user } = useAuthStore()

  // For student self-view, derive the student's own DB id from the /me endpoint
  const isSelfView = !paramId || user?.role === 'student'

  const { data: meStudent } = useQuery({
    queryKey: ['student-me-id'],
    queryFn: async () => {
      const { data } = await api.get('/students/me')
      return data.data as { id: string }
    },
    enabled: isSelfView && user?.role === 'student',
  })

  const studentId = isSelfView ? (meStudent?.id ?? '') : paramId!

  const { data: transcript, isLoading, error } = useQuery<TranscriptData>({
    queryKey: ['student-transcript', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/students/${studentId}/transcript`)
      return data.data as TranscriptData
    },
    enabled: !!studentId,
  })

  const handlePrint = () => {
    const content = document.getElementById('transcript-body')
    if (!content) return
    const win = window.open('', '_blank', 'width=960,height=1100')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Academic Transcript — ${transcript?.student.displayName ?? ''}</title>
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
            #preview-bar .btn-print:hover { background: #e6f0ff; }
            #preview-bar .btn-close { background: transparent; color: rgba(255,255,255,.8); border: 1px solid rgba(255,255,255,.4); }
            #preview-bar .btn-close:hover { background: rgba(255,255,255,.1); }
            #doc { padding: 32px 40px; max-width: 900px; margin: 0 auto; }
            h1 { font-size: 20px; margin: 0 0 2px; }
            h2 { font-size: 13px; color: #165DFF; margin: 16px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 11px; }
            th { background: #f0f4ff; padding: 6px 8px; text-align: left; font-weight: 700; border: 1px solid #ddd; }
            td { padding: 5px 8px; border: 1px solid #eee; vertical-align: top; }
            tr:nth-child(even) td { background: #fafafa; }
            .header { border-bottom: 3px solid #165DFF; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
            .kpi-row { display: flex; gap: 32px; margin: 8px 0 16px; }
            .kpi .label { font-size: 10px; color: #888; text-transform: uppercase; }
            .kpi .val { font-size: 20px; font-weight: 700; }
            .row2 { display: flex; gap: 24px; }
            .box { flex: 1; border: 1px solid #eee; border-radius: 4px; padding: 10px 14px; }
            .box h3 { font-size: 12px; margin: 0 0 8px; color: #165DFF; }
            .footer { margin-top: 40px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
            @media print {
              #preview-bar { display: none !important; }
              #doc { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div id="preview-bar">
            <span>Preview — Academic Transcript · ${transcript?.student.displayName ?? ''}</span>
            <div class="actions">
              <button class="btn-close" onclick="window.close()">Close</button>
              <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
            </div>
          </div>
          <div id="doc">
            ${content.innerHTML}
            <div class="footer">
              This is a computer-generated official academic transcript. Alterations are not permitted.<br/>
              Generated: ${dayjs(transcript?.generatedAt).format('DD MMM YYYY HH:mm')} · MOE SERPS — Ministry of Education, Brunei Darussalam
            </div>
          </div>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
  }

  if (isLoading || (isSelfView && !meStudent && user?.role === 'student')) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  if (error || !transcript) {
    return <Alert type="error" message={t('common.error')} description={String(error ?? 'Transcript not found')} />
  }

  const { student, courses, cumulativeGPA, totalCreditHours, attendance, conduct, standingHistory } = transcript

  const courseColumns: ColumnsType<CourseRow> = [
    {
      title: t('transcript.courseCode', { defaultValue: 'Code' }),
      dataIndex: 'courseCode',
      key: 'code',
      width: 100,
      render: (v: string) => <Text strong style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: t('transcript.courseName', { defaultValue: 'Course / Subject' }),
      dataIndex: 'courseName',
      key: 'name',
    },
    {
      title: t('transcript.creditHours', { defaultValue: 'Credits' }),
      dataIndex: 'creditHours',
      key: 'credits',
      width: 70,
      align: 'center' as const,
    },
    {
      title: t('transcript.score', { defaultValue: 'Score (%)' }),
      dataIndex: 'courseAverage',
      key: 'score',
      width: 90,
      align: 'center' as const,
      render: (v: number | null) =>
        v !== null ? (
          <span style={{ color: v >= 70 ? '#52c41a' : v >= 50 ? '#fa8c16' : '#f5222d', fontWeight: 600 }}>
            {v.toFixed(1)}%
          </span>
        ) : <Text type="secondary">—</Text>,
    },
    {
      title: t('transcript.grade', { defaultValue: 'Grade' }),
      dataIndex: 'letterGrade',
      key: 'grade',
      width: 70,
      align: 'center' as const,
      render: (v: string) =>
        v !== '-' ? <Tag color={LETTER_COLOR[v] ?? 'default'}>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: t('transcript.gpaPoints', { defaultValue: 'GPA Pts' }),
      dataIndex: 'gpaPoints',
      key: 'gpa',
      width: 80,
      align: 'center' as const,
      render: (v: number, row: CourseRow) =>
        row.courseAverage !== null ? v.toFixed(2) : <Text type="secondary">—</Text>,
    },
    {
      title: t('transcript.attendance', { defaultValue: 'Att. Rate' }),
      dataIndex: 'courseAttendanceRate',
      key: 'att',
      width: 90,
      align: 'center' as const,
      render: (v: number | null) =>
        v !== null ? (
          <span style={{ color: v >= 80 ? '#52c41a' : '#fa8c16', fontSize: 12 }}>{v.toFixed(1)}%</span>
        ) : <Text type="secondary">—</Text>,
    },
  ]

  const standing = student.academicStanding ?? 'GOOD_STANDING'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Action bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Space>
            {user?.role !== 'student' && (
              <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(-1)}>
                {t('common.back', { defaultValue: 'Back' })}
              </Button>
            )}
            <Space>
              <FileText size={18} style={{ color: '#165DFF' }} />
              <Title level={4} style={{ margin: 0 }}>
                {t('transcript.title', { defaultValue: 'Academic Transcript' })}
              </Title>
            </Space>
          </Space>
          <Button type="primary" icon={<Printer size={14} />} onClick={handlePrint}>
            {t('transcript.print', { defaultValue: 'Print / Export PDF' })}
          </Button>
        </Row>
      </Card>

      {/* Transcript body */}
      <div id="transcript-body">
        {/* ── School header ── */}
        <Card style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="top">
            <Col>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#165DFF' }}>
                {user?.school?.name ?? 'MOE School'}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>Ministry of Education · Brunei Darussalam</Text>
              <div><Text type="secondary" style={{ fontSize: 11 }}>Jalan Dewan Bahasa, Bandar Seri Begawan, BB3910</Text></div>
            </Col>
            <Col style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>ACADEMIC TRANSCRIPT</div>
              <div style={{ fontSize: 12, color: '#888' }}>Academic Year 2025/2026</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>
                {t('transcript.issued', { defaultValue: 'Issued' })}: {dayjs(transcript.generatedAt).format('DD MMM YYYY')}
              </div>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />

          {/* Student info + KPI summary */}
          <Row gutter={24} align="middle">
            <Col flex={1}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                {t('transcript.student', { defaultValue: 'Student' })}
              </Text>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{student.displayName}</div>
              <div style={{ color: '#888', fontSize: 13 }}>
                {t('transcript.studentId', { defaultValue: 'ID' })}: {student.studentId}
              </div>
              <div style={{ color: '#888', fontSize: 13 }}>
                {student.gradeLevel}{student.className ? ` — Class ${student.className}` : ''}
              </div>
              <div style={{ marginTop: 6 }}>
                <Badge
                  status={STANDING_COLOR[standing] as any}
                  text={
                    <Text style={{ fontSize: 12 }}>
                      {t('transcript.standing', { defaultValue: 'Academic Standing' })}: <strong>{STANDING_LABEL[standing] ?? standing}</strong>
                    </Text>
                  }
                />
              </div>
            </Col>
            <Col>
              <Row gutter={24}>
                <Col style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Cumulative GPA</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#165DFF' }}>
                    {cumulativeGPA !== null ? cumulativeGPA.toFixed(2) : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>/ 4.00 · {totalCreditHours} credits</div>
                </Col>
                <Col style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Attendance</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: attendance.rate >= 80 ? '#52c41a' : '#f5222d' }}>
                    {attendance.rate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{attendance.total} sessions</div>
                </Col>
                <Col style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Conduct</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: conduct.netPoints >= 0 ? '#52c41a' : '#f5222d' }}>
                    {conduct.netPoints >= 0 ? '+' : ''}{conduct.netPoints}
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>net points</div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        {/* ── Academic Record ── */}
        <Card
          title={
            <Space>
              <GraduationCap size={16} />
              <span>{t('transcript.academicRecord', { defaultValue: 'Academic Record' })}</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {courses.length > 0 ? (
            <>
              <Table<CourseRow>
                rowKey="courseId"
                columns={courseColumns}
                dataSource={courses}
                pagination={false}
                size="small"
                summary={() => (
                  <Table.Summary.Row style={{ background: '#f0f4ff', fontWeight: 700 }}>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      {t('transcript.totals', { defaultValue: 'Overall / Cumulative' })}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="center">{totalCreditHours}</Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="center">—</Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="center">—</Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="center">
                      <span style={{ color: '#165DFF' }}>
                        {cumulativeGPA !== null ? cumulativeGPA.toFixed(2) : '—'}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="center">
                      {attendance.rate.toFixed(1)}%
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
              <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
                {t('transcript.gpaScale', { defaultValue: 'Grade Scale: A+/A = 4.00 · B = 3.00 · C = 2.00 · D = 1.00 · F = 0.00' })}
              </div>
            </>
          ) : (
            <Text type="secondary">{t('transcript.noCourses', { defaultValue: 'No course records available.' })}</Text>
          )}
        </Card>

        {/* ── Attendance & Conduct ── */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12}>
            <Card
              title={
                <Space>
                  <span>{t('transcript.attendanceSummary', { defaultValue: 'Attendance Summary' })}</span>
                </Space>
              }
              size="small"
            >
              <Row gutter={[12, 12]}>
                <Col span={12}><Statistic title={t('transcript.totalSessions', { defaultValue: 'Total Sessions' })} value={attendance.total} /></Col>
                <Col span={12}><Statistic title={t('attendance.present', { defaultValue: 'Present' })} value={attendance.present} valueStyle={{ color: '#52c41a' }} /></Col>
                <Col span={12}><Statistic title={t('attendance.late', { defaultValue: 'Late' })} value={attendance.late} valueStyle={{ color: '#fa8c16' }} /></Col>
                <Col span={12}><Statistic title={t('attendance.absent', { defaultValue: 'Absent' })} value={attendance.absent} valueStyle={{ color: '#f5222d' }} /></Col>
                {attendance.excused > 0 && (
                  <Col span={12}><Statistic title={t('attendance.excused', { defaultValue: 'Excused' })} value={attendance.excused} /></Col>
                )}
                <Col span={12}>
                  <Statistic
                    title={t('attendance.overallRate', { defaultValue: 'Overall Rate' })}
                    value={attendance.rate}
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: attendance.rate >= 80 ? '#52c41a' : '#f5222d' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card
              title={
                <Space>
                  <Award size={14} />
                  <span>{t('transcript.conductSummary', { defaultValue: 'Conduct Summary' })}</span>
                </Space>
              }
              size="small"
            >
              <Row gutter={[12, 12]}>
                <Col span={8}>
                  <Statistic
                    title={t('behavior.merits', { defaultValue: 'Merits' })}
                    value={conduct.merits}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={t('behavior.demerits', { defaultValue: 'Demerits' })}
                    value={conduct.demerits}
                    valueStyle={{ color: conduct.demerits > 0 ? '#f5222d' : undefined }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={t('transcript.net', { defaultValue: 'Net Points' })}
                    value={conduct.netPoints >= 0 ? `+${conduct.netPoints}` : conduct.netPoints}
                    valueStyle={{ color: conduct.netPoints >= 0 ? '#52c41a' : '#f5222d' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* ── Academic Standing History ── */}
        {standingHistory.length > 0 && (
          <Card
            title={t('transcript.standingHistory', { defaultValue: 'Academic Standing History' })}
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={standingHistory}
              columns={[
                {
                  title: t('common.date', { defaultValue: 'Date' }),
                  dataIndex: 'createdAt',
                  key: 'date',
                  width: 130,
                  render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
                },
                {
                  title: t('transcript.from', { defaultValue: 'From' }),
                  dataIndex: 'previousStanding',
                  key: 'from',
                  render: (v: string) => <Tag color={STANDING_COLOR[v] ?? 'default'}>{STANDING_LABEL[v] ?? v}</Tag>,
                },
                {
                  title: t('transcript.to', { defaultValue: 'To' }),
                  dataIndex: 'newStanding',
                  key: 'to',
                  render: (v: string) => <Tag color={STANDING_COLOR[v] ?? 'default'}>{STANDING_LABEL[v] ?? v}</Tag>,
                },
                {
                  title: t('transcript.trigger', { defaultValue: 'Trigger' }),
                  dataIndex: 'trigger',
                  key: 'trigger',
                  render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v.replace(/_/g, ' ')}</Text>,
                },
                {
                  title: t('transcript.gradeAvg', { defaultValue: 'Grade Avg' }),
                  dataIndex: 'gradeAvg',
                  key: 'avg',
                  width: 90,
                  render: (v: number) => `${v.toFixed(1)}%`,
                },
              ]}
            />
          </Card>
        )}

        {/* ── Signature block ── */}
        <Card size="small">
          <Row justify="space-between" align="bottom" style={{ minHeight: 80 }}>
            <Col>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('transcript.notice', {
                  defaultValue:
                    'This is an official academic transcript issued by the school. Any unauthorised alteration voids this document.',
                })}
              </Text>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                {t('transcript.generated', { defaultValue: 'Generated' })}: {dayjs(transcript.generatedAt).format('DD MMM YYYY, HH:mm')}
              </div>
            </Col>
            <Col style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #333', width: 200, paddingTop: 4, fontSize: 12, fontWeight: 600 }}>
                {t('transcript.principalSignature', { defaultValue: 'Principal / Authorized Signatory' })}
              </div>
              <div style={{ fontSize: 11, color: '#888' }}>
                {user?.school?.name ?? 'MOE School'}
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </div>
  )
}

export default StudentTranscriptPage
