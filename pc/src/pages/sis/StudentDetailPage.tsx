import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Card, Tabs, Descriptions, Tag, Spin, Alert, Typography, Space, Row, Col,
  Table, Progress, Statistic, Badge, Empty, Breadcrumb, Button, Timeline,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  User, BookOpen, BarChart2, Calendar, DollarSign, MessageSquare,
  ArrowLeft, GraduationCap, AlertTriangle,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

// ─── Helpers ────────────────────────────────────────────────────

const STANDING_COLOR: Record<string, string> = {
  GOOD_STANDING:  'success',
  ACADEMIC_WATCH: 'warning',
  PROBATION:      'error',
  AT_RISK:        'error',
}
const STANDING_LABEL: Record<string, string> = {
  GOOD_STANDING:  'Good Standing',
  ACADEMIC_WATCH: 'Academic Watch',
  PROBATION:      'Probation',
  AT_RISK:        'At Risk',
}
const ATTENDANCE_COLOR: Record<string, string> = {
  present:  '#52c41a',
  late:     '#fa8c16',
  absent:   '#f5222d',
  excused:  '#1677ff',
}
const INVOICE_COLOR: Record<string, string> = {
  paid:     'success',
  unpaid:   'warning',
  overdue:  'error',
}

function computeWeightedAverage(grades: any[], gradeItems: any[]): number | null {
  if (!grades || !gradeItems) return null
  let totalWeight = 0
  let weightedSum = 0
  for (const g of grades) {
    const item = gradeItems.find((i: any) => i.id === g.gradeItemId) ?? g.gradeItem
    if (!item || g.score == null) continue
    const weight = item.weight ?? 1
    weightedSum += (g.score / item.maxScore) * 100 * weight
    totalWeight += weight
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null
}

function gradeAvgToLetter(avg: number | null): string {
  if (avg === null) return '-'
  if (avg >= 90) return 'A+'
  if (avg >= 80) return 'A'
  if (avg >= 70) return 'B'
  if (avg >= 60) return 'C'
  if (avg >= 50) return 'D'
  return 'F'
}

// ─── Tab: Overview ──────────────────────────────────────────────

function OverviewTab({ student }: { student: any }) {
  const standing = student.academicStanding ?? 'GOOD_STANDING'
  return (
    <Row gutter={[24, 24]}>
      <Col xs={24} md={14}>
        <Card size="small" title="Personal Information" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="Student ID">{student.studentId}</Descriptions.Item>
            <Descriptions.Item label="Full Name">{student.user?.displayName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Email">{student.user?.email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Username">{student.user?.username ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">
              {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Gender">
              {student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Nationality">{student.nationality ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="IC Number">{student.icNumber ?? '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card size="small" title="Academic Information">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="Grade Level">{student.gradeLevel ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Class">{student.className ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Enrollment Status">
              <Tag color={student.enrollmentStatus === 'enrolled' ? 'green' : 'orange'}>
                {student.enrollmentStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Account Status">
              <Tag color={student.user?.status === 'active' ? 'green' : 'default'}>
                {student.user?.status ?? '-'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} md={10}>
        <Card size="small" title="Academic Standing" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <Badge
                status={STANDING_COLOR[standing] as any}
                text={
                  <Text strong style={{ fontSize: 16 }}>
                    {STANDING_LABEL[standing] ?? standing}
                  </Text>
                }
              />
            </div>
            {standing !== 'GOOD_STANDING' && (
              <Alert
                type={standing === 'PROBATION' || standing === 'AT_RISK' ? 'error' : 'warning'}
                showIcon
                icon={<AlertTriangle size={14} />}
                message={
                  standing === 'PROBATION'
                    ? 'This student is on academic probation. Immediate intervention required.'
                    : 'This student is on academic watch. Monitoring recommended.'
                }
                style={{ fontSize: 12 }}
              />
            )}
          </Space>
        </Card>
        {student.riskScores && student.riskScores.length > 0 && (
          <Card size="small" title="Risk Score">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Progress
                percent={Math.round(student.riskScores[0].score * 100)}
                status={student.riskScores[0].score > 0.6 ? 'exception' : student.riskScores[0].score > 0.3 ? 'active' : 'success'}
                format={(p) => `${p}%`}
              />
              <Row gutter={8}>
                <Col span={12}>
                  <Statistic title="Absences (14d)" value={student.riskScores[0].absences14d ?? 0} valueStyle={{ fontSize: 20 }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Grade Avg" value={student.riskScores[0].gradeAvg ?? '-'} suffix={student.riskScores[0].gradeAvg ? '%' : ''} valueStyle={{ fontSize: 20 }} />
                </Col>
              </Row>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Computed {new Date(student.riskScores[0].computedAt).toLocaleDateString()}
              </Text>
            </Space>
          </Card>
        )}
        {student._count?.counselorCases > 0 && (
          <Card size="small" style={{ marginTop: 16, borderLeft: '3px solid #fa8c16' }}>
            <Space>
              <MessageSquare size={16} color="#fa8c16" />
              <Text style={{ color: '#fa8c16' }}>
                {student._count.counselorCases} counselor case{student._count.counselorCases > 1 ? 's' : ''} on record
              </Text>
            </Space>
          </Card>
        )}
      </Col>
    </Row>
  )
}

// ─── Tab: Academic (Courses + Standing History) ──────────────────

function AcademicTab({ student, standingHistory }: { student: any; standingHistory: any[] }) {
  const enrollments = student.enrollments ?? []
  const grades = student.grades ?? []
  const gradeItems = grades.map((g: any) => g.gradeItem).filter(Boolean)

  const courseColumns: ColumnsType<any> = [
    {
      title: 'Course Code',
      render: (_, r) => (
        <Link to={`/sms/courses/${r.courseId}`}>
          <Text code>{r.course?.code ?? '-'}</Text>
        </Link>
      ),
      width: 120,
    },
    { title: 'Course Name', render: (_, r) => r.course?.name ?? '-' },
    {
      title: 'Teacher',
      render: (_, r) => {
        const assignment = r.course?.assignments?.[0]
        return assignment?.teacher?.user?.displayName ?? '-'
      },
    },
    { title: 'Schedule', render: (_, r) => r.course?.assignments?.[0]?.schedule ?? '-', width: 160 },
    { title: 'Semester', dataIndex: 'semester', width: 120 },
    {
      title: 'Avg Grade',
      render: (_, r) => {
        const courseGrades = grades.filter((g: any) => g.gradeItem?.course?.id === r.courseId || g.gradeItem?.courseId === r.courseId)
        const avg = computeWeightedAverage(courseGrades, gradeItems)
        if (avg === null) return <Text type="secondary">—</Text>
        return (
          <Space size={4}>
            <Text strong>{avg}%</Text>
            <Tag color={avg >= 70 ? 'green' : avg >= 50 ? 'orange' : 'red'}>{gradeAvgToLetter(avg)}</Tag>
          </Space>
        )
      },
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => (
        <Tag color={val === 'enrolled' || val === 'active' ? 'green' : val === 'completed' ? 'blue' : 'default'}>{val}</Tag>
      ),
    },
  ]

  return (
    <div>
      <Card size="small" title={<Space><BookOpen size={14} />Enrolled Courses</Space>} style={{ marginBottom: 16 }}>
        <Table
          rowKey="id"
          columns={courseColumns}
          dataSource={enrollments}
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="No courses enrolled" /> }}
        />
      </Card>

      {standingHistory.length > 0 && (
        <Card size="small" title="Academic Standing History">
          <Timeline
            items={standingHistory.map((h: any) => ({
              color: STANDING_COLOR[h.newStanding] === 'success' ? 'green' : STANDING_COLOR[h.newStanding] === 'warning' ? 'orange' : 'red',
              children: (
                <div>
                  <Text strong>{STANDING_LABEL[h.newStanding] ?? h.newStanding}</Text>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    (from {STANDING_LABEL[h.previousStanding] ?? h.previousStanding})
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Trigger: {h.trigger} · Grade avg: {h.gradeAvg ?? '-'} · {new Date(h.createdAt).toLocaleDateString()}
                  </Text>
                </div>
              ),
            }))}
          />
        </Card>
      )}
    </div>
  )
}

// ─── Tab: Grades ─────────────────────────────────────────────────

function GradesTab({ student }: { student: any }) {
  const grades: any[] = student.grades ?? []

  // Group by course
  const byCourse = grades.reduce((acc: Record<string, any[]>, g: any) => {
    const courseName = g.gradeItem?.course?.name ?? g.gradeItem?.courseId ?? 'Unknown'
    if (!acc[courseName]) acc[courseName] = []
    acc[courseName].push(g)
    return acc
  }, {})

  const gradeColumns: ColumnsType<any> = [
    { title: 'Assessment', render: (_, r) => r.gradeItem?.name ?? '-' },
    { title: 'Type', render: (_, r) => r.gradeItem?.type ? <Tag>{r.gradeItem.type}</Tag> : '-', width: 100 },
    {
      title: 'Score',
      render: (_, r) => r.score != null ? `${r.score} / ${r.gradeItem?.maxScore ?? '?'}` : '—',
      width: 110,
    },
    {
      title: 'Pct',
      render: (_, r) => {
        if (r.score == null || !r.gradeItem?.maxScore) return '—'
        return `${Math.round((r.score / r.gradeItem.maxScore) * 100)}%`
      },
      width: 70,
    },
    {
      title: 'Grade',
      render: (_, r) => r.letterGrade ? <Tag color={r.letterGrade === 'F' ? 'red' : r.letterGrade.startsWith('A') ? 'green' : 'blue'}>{r.letterGrade}</Tag> : '—',
      width: 80,
    },
    { title: 'Weight', render: (_, r) => r.gradeItem?.weight != null ? `${r.gradeItem.weight}%` : '-', width: 80 },
    { title: 'Graded', render: (_, r) => r.gradedAt ? new Date(r.gradedAt).toLocaleDateString() : '-', width: 110 },
  ]

  if (grades.length === 0) {
    return <Empty description="No grades recorded yet" />
  }

  return (
    <div>
      {Object.entries(byCourse).map(([courseName, courseGrades]) => {
        const avg = computeWeightedAverage(courseGrades, courseGrades.map((g: any) => g.gradeItem))
        return (
          <Card
            key={courseName}
            size="small"
            title={
              <Space>
                <Text strong>{courseName}</Text>
                {avg !== null && (
                  <Tag color={avg >= 70 ? 'green' : avg >= 50 ? 'orange' : 'red'}>
                    Avg: {avg}% ({gradeAvgToLetter(avg)})
                  </Tag>
                )}
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="id"
              columns={gradeColumns}
              dataSource={courseGrades}
              pagination={false}
              size="small"
            />
          </Card>
        )
      })}
    </div>
  )
}

// ─── Tab: Attendance ─────────────────────────────────────────────

function AttendanceTab({ records }: { records: any[] }) {
  const total = records.length
  const present = records.filter((r) => r.status === 'present').length
  const late = records.filter((r) => r.status === 'late').length
  const absent = records.filter((r) => r.status === 'absent').length
  const excused = records.filter((r) => r.status === 'excused').length
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0

  // Separate daily roll call records from subject-specific records
  const isRollCall = (r: any) => (r.session?.topic as string | undefined)?.startsWith('Daily Roll Call')
  const rollCallRecords = records.filter(isRollCall)
  const subjectRecords = records.filter((r) => !isRollCall(r))

  // Group subject records by course name
  const byCourse: Record<string, any[]> = {}
  for (const r of subjectRecords) {
    const courseName = r.session?.course?.name ?? r.session?.courseId ?? 'Unknown'
    if (!byCourse[courseName]) byCourse[courseName] = []
    byCourse[courseName].push(r)
  }

  const rollCallColumns: ColumnsType<any> = [
    {
      title: 'Date',
      render: (_, r) => r.session?.date ? new Date(r.session.date).toLocaleDateString() : '-',
      width: 120,
      sorter: (a, b) => new Date(a.session?.date).getTime() - new Date(b.session?.date).getTime(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (val: string) => (
        <Tag color={val === 'present' ? 'green' : val === 'late' ? 'orange' : val === 'excused' ? 'blue' : 'red'}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Absence Reason',
      render: (_, r) => r.absenceReason ?? (r.parentNote ? `Parent: ${r.parentNote}` : '-'),
    },
    {
      title: 'Checked In',
      render: (_, r) => r.checkedInAt ? new Date(r.checkedInAt).toLocaleTimeString() : '-',
      width: 110,
    },
  ]

  const recordColumns: ColumnsType<any> = [
    {
      title: 'Date',
      render: (_, r) => r.session?.date ? new Date(r.session.date).toLocaleDateString() : '-',
      width: 120,
      sorter: (a, b) => new Date(a.session?.date).getTime() - new Date(b.session?.date).getTime(),
    },
    { title: 'Session Topic', render: (_, r) => r.session?.topic ?? '-' },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (val: string) => (
        <Tag color={val === 'present' ? 'green' : val === 'late' ? 'orange' : val === 'excused' ? 'blue' : 'red'}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Absence Reason',
      render: (_, r) => r.absenceReason ?? (r.parentNote ? `Parent: ${r.parentNote}` : '-'),
    },
    {
      title: 'Checked In',
      render: (_, r) => r.checkedInAt ? new Date(r.checkedInAt).toLocaleTimeString() : '-',
      width: 110,
    },
  ]

  if (records.length === 0) {
    return <Empty description="No attendance records found" />
  }

  return (
    <div>
      {/* Summary stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="Attendance Rate" value={rate} suffix="%" valueStyle={{ color: rate >= 85 ? '#52c41a' : rate >= 75 ? '#fa8c16' : '#f5222d', fontSize: 24 }} />
          </Card>
        </Col>
        {[
          { label: 'Present', count: present, color: ATTENDANCE_COLOR.present },
          { label: 'Late', count: late, color: ATTENDANCE_COLOR.late },
          { label: 'Absent', count: absent, color: ATTENDANCE_COLOR.absent },
          { label: 'Excused', count: excused, color: ATTENDANCE_COLOR.excused },
        ].map(({ label, count, color }) => (
          <Col xs={6} sm={4} key={label}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic title={label} value={count} valueStyle={{ color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Daily Roll Call section */}
      {rollCallRecords.length > 0 && (() => {
        const rcTotal = rollCallRecords.length
        const rcPresent = rollCallRecords.filter((r) => r.status === 'present' || r.status === 'late').length
        const rcRate = rcTotal > 0 ? Math.round((rcPresent / rcTotal) * 100) : 0
        return (
          <Card
            size="small"
            title={
              <Space>
                <Text strong>Daily Roll Call</Text>
                <Progress
                  percent={rcRate}
                  size="small"
                  style={{ width: 120 }}
                  status={rcRate < 75 ? 'exception' : rcRate < 85 ? 'active' : 'success'}
                  format={(p) => `${p}%`}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>{rcPresent}/{rcTotal} days</Text>
              </Space>
            }
            style={{ marginBottom: 12 }}
          >
            <Table
              rowKey="id"
              columns={rollCallColumns}
              dataSource={rollCallRecords}
              pagination={{ pageSize: 10, size: 'small' }}
              size="small"
            />
          </Card>
        )
      })()}

      {/* Per-subject breakdown */}
      {Object.entries(byCourse).map(([courseName, courseRecords]) => {
        const cTotal = courseRecords.length
        const cPresent = courseRecords.filter((r) => r.status === 'present' || r.status === 'late').length
        const cRate = cTotal > 0 ? Math.round((cPresent / cTotal) * 100) : 0
        return (
          <Card
            key={courseName}
            size="small"
            title={
              <Space>
                <Text strong>{courseName}</Text>
                <Progress
                  percent={cRate}
                  size="small"
                  style={{ width: 120 }}
                  status={cRate < 75 ? 'exception' : cRate < 85 ? 'active' : 'success'}
                  format={(p) => `${p}%`}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>{cPresent}/{cTotal} sessions</Text>
              </Space>
            }
            style={{ marginBottom: 12 }}
          >
            <Table
              rowKey="id"
              columns={recordColumns}
              dataSource={courseRecords}
              pagination={{ pageSize: 10, size: 'small' }}
              size="small"
            />
          </Card>
        )
      })}
    </div>
  )
}

// ─── Tab: Finance ────────────────────────────────────────────────

function FinanceTab({ invoices }: { invoices: any[] }) {
  const outstanding = invoices.filter((i) => i.status !== 'paid').reduce((sum, i) => sum + i.amount, 0)
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)

  const invoiceColumns: ColumnsType<any> = [
    { title: 'Invoice #', dataIndex: 'invoiceNumber', width: 160, render: (v) => <Text code>{v}</Text> },
    { title: 'Description', dataIndex: 'description' },
    { title: 'Semester', dataIndex: 'semester', width: 120 },
    { title: 'Amount', dataIndex: 'amount', width: 100, render: (v) => `$${v.toLocaleString()}` },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => <Tag color={INVOICE_COLOR[val] ?? 'default'}>{val}</Tag>,
    },
    { title: 'Due Date', dataIndex: 'dueDate', width: 120, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    { title: 'Paid At', dataIndex: 'paidAt', width: 120, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    {
      title: 'Hold',
      width: 80,
      render: (_, r) => r.holdActive ? (
        <Tag color="error" title={r.holdReason}>Hold</Tag>
      ) : null,
    },
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic
              title="Outstanding Balance"
              value={outstanding}
              prefix="$"
              valueStyle={{ color: outstanding > 0 ? '#f5222d' : '#52c41a', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="Total Paid" value={totalPaid} prefix="$" valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="Total Invoices" value={invoices.length} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
      </Row>
      <Card size="small">
        <Table
          rowKey="id"
          columns={invoiceColumns}
          dataSource={invoices}
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="No invoices found" /> }}
        />
      </Card>
    </div>
  )
}

// ─── Tab: Notes (Counselor Cases) ───────────────────────────────

function NotesTab({ cases }: { cases: any[] }) {
  if (cases.length === 0) {
    return <Empty description="No counselor cases on record" />
  }

  const caseColumns: ColumnsType<any> = [
    { title: 'Opened', dataIndex: 'openedAt', width: 120, render: (v) => new Date(v).toLocaleDateString() },
    {
      title: 'Reason',
      dataIndex: 'openedReason',
      render: (val: string) => {
        const labels: Record<string, string> = {
          AUTO_RISK_THRESHOLD: 'Auto: High Risk Score',
          AUTO_ABSENCE_THRESHOLD: 'Auto: Absence Threshold',
          TEACHER_REFERRAL: 'Teacher Referral',
          PARENT_REQUEST: 'Parent Request',
        }
        return <Tag>{labels[val] ?? val}</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (val: string) => (
        <Tag color={val === 'RESOLVED' || val === 'CLOSED' ? 'success' : val === 'IN_PROGRESS' ? 'processing' : 'warning'}>
          {val}
        </Tag>
      ),
    },
    { title: 'Notes', dataIndex: 'notes', render: (v) => v ?? '-' },
    { title: 'Resolved', dataIndex: 'resolvedAt', width: 120, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
  ]

  return (
    <Card size="small" title="Counselor Cases">
      <Table rowKey="id" columns={caseColumns} dataSource={cases} pagination={false} size="small" />
    </Card>
  )
}

// ─── Main Page ───────────────────────────────────────────────────

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: studentData, isLoading, error } = useQuery({
    queryKey: ['student-detail', id],
    queryFn: async () => {
      const res = await api.get(`/students/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['student-attendance-history', id],
    queryFn: async () => {
      const res = await api.get(`/students/${id}/attendance-history`)
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: standingHistory = [] } = useQuery({
    queryKey: ['student-standing-history', id],
    queryFn: async () => {
      const res = await api.get(`/students/${id}/standing-history`)
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ['student-invoices', id],
    queryFn: async () => {
      const res = await api.get(`/students/${id}/invoices`)
      return res.data.data
    },
    enabled: !!id && ['admin', 'manager', 'finance', 'principal'].includes(user?.role ?? ''),
  })

  const { data: counselorCases = [] } = useQuery({
    queryKey: ['student-counselor-cases', id],
    queryFn: async () => {
      const res = await api.get(`/students/${id}/counselor-cases`)
      return res.data.data
    },
    enabled: !!id && ['admin', 'manager', 'counselor', 'principal'].includes(user?.role ?? ''),
  })

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }
  if (error || !studentData) {
    return <Alert type="error" message="Failed to load student profile" />
  }

  const student = studentData
  const standing = student.academicStanding ?? 'GOOD_STANDING'
  const canViewFinance = ['admin', 'manager', 'finance', 'principal'].includes(user?.role ?? '')
  const canViewNotes = ['admin', 'manager', 'counselor', 'principal'].includes(user?.role ?? '')

  const tabItems = [
    {
      key: 'overview',
      label: <Space size={4}><User size={14} />Overview</Space>,
      children: <OverviewTab student={student} />,
    },
    {
      key: 'academic',
      label: <Space size={4}><GraduationCap size={14} />Academic</Space>,
      children: <AcademicTab student={student} standingHistory={standingHistory} />,
    },
    {
      key: 'grades',
      label: <Space size={4}><BarChart2 size={14} />Grades</Space>,
      children: <GradesTab student={student} />,
    },
    {
      key: 'attendance',
      label: (
        <Space size={4}>
          <Calendar size={14} />
          Attendance
          {attendanceHistory.filter((r: any) => r.status === 'absent').length > 0 && (
            <Badge count={attendanceHistory.filter((r: any) => r.status === 'absent').length} size="small" />
          )}
        </Space>
      ),
      children: <AttendanceTab records={attendanceHistory} />,
    },
    ...(canViewFinance ? [{
      key: 'finance',
      label: (
        <Space size={4}>
          <DollarSign size={14} />
          Finance
          {invoices.filter((i: any) => i.status !== 'paid').length > 0 && (
            <Badge count={invoices.filter((i: any) => i.status !== 'paid').length} size="small" color="orange" />
          )}
        </Space>
      ),
      children: <FinanceTab invoices={invoices} />,
    }] : []),
    ...(canViewNotes ? [{
      key: 'notes',
      label: (
        <Space size={4}>
          <MessageSquare size={14} />
          Notes
          {counselorCases.filter((c: any) => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length > 0 && (
            <Badge count={counselorCases.filter((c: any) => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length} size="small" />
          )}
        </Space>
      ),
      children: <NotesTab cases={counselorCases} />,
    }] : []),
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/sis/students">Students</Link> },
          { title: student.user?.displayName ?? student.studentId },
        ]}
      />

      {/* Header */}
      <Card style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space size={16} align="center">
              <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(-1)} size="small">
                Back
              </Button>
              <div
                style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: '#1677ff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
                  {(student.user?.displayName ?? 'S')[0].toUpperCase()}
                </Text>
              </div>
              <div>
                <Title level={4} style={{ margin: 0 }}>{student.user?.displayName}</Title>
                <Space size={8}>
                  <Text type="secondary" style={{ fontSize: 13 }}>{student.studentId}</Text>
                  <Text type="secondary">·</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>{student.gradeLevel} {student.className}</Text>
                  <Text type="secondary">·</Text>
                  <Tag color={STANDING_COLOR[standing]}>{STANDING_LABEL[standing] ?? standing}</Tag>
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<GraduationCap size={14} />}
                onClick={() => navigate(`/sis/students/${id}/transcript`)}
              >
                Transcript
              </Button>
              <Tag color={student.enrollmentStatus === 'enrolled' ? 'green' : 'orange'} style={{ fontSize: 13 }}>
                {student.enrollmentStatus}
              </Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}
