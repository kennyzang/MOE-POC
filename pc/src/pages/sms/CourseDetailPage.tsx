import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Card, Tabs, Tag, Spin, Alert, Typography, Space, Row, Col,
  Table, Progress, Statistic, Empty, Breadcrumb, Button, Drawer, Descriptions,
  Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BookOpen, Users, Calendar, BarChart2, Clock, ArrowLeft, Eye,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const { Title, Text } = Typography

// ─── Helpers ────────────────────────────────────────────────────

function computeStudentAvg(grades: any[]): number | null {
  if (!grades || grades.length === 0) return null
  let totalWeight = 0, weightedSum = 0
  for (const g of grades) {
    if (g.score == null || !g.gradeItem?.maxScore) continue
    const w = g.gradeItem.weight ?? 1
    weightedSum += (g.score / g.gradeItem.maxScore) * 100 * w
    totalWeight += w
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null
}

function attendancePct(counts: any[], studentId: string, totalSessions: number): number {
  if (totalSessions === 0) return 0
  const present = counts
    .filter((c: any) => c.studentId === studentId && (c.status === 'present' || c.status === 'late'))
    .reduce((s: number, c: any) => s + c._count, 0)
  return Math.round((present / totalSessions) * 100)
}

// ─── Session Detail Drawer ───────────────────────────────────────

function SessionDetailDrawer({ sessionId, open, onClose }: { sessionId: string | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['session-detail', sessionId],
    queryFn: async () => {
      const res = await api.get(`/attendance/sessions/${sessionId}`)
      return res.data.data
    },
    enabled: !!sessionId && open,
  })

  const rowBg = (status: string) => {
    if (status === 'absent') return '#fff2f0'
    if (status === 'late') return '#fffbe6'
    if (status === 'excused') return '#e6f4ff'
    return undefined
  }

  const recordColumns: ColumnsType<any> = [
    {
      title: 'Student',
      render: (_, r) => (
        <Link to={`/sis/students/${r.studentId}`}>
          {r.student?.user?.displayName ?? r.studentId}
        </Link>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => (
        <Tag color={val === 'present' ? 'green' : val === 'late' ? 'orange' : val === 'excused' ? 'blue' : 'red'}>
          {val}
        </Tag>
      ),
    },
    { title: 'Reason', render: (_, r) => r.absenceReason ?? (r.parentNote ? `Parent: ${r.parentNote}` : '-') },
    { title: 'Checked In', render: (_, r) => r.checkedInAt ? new Date(r.checkedInAt).toLocaleTimeString() : '-', width: 110 },
  ]

  const session = data
  const present = session?.records?.filter((r: any) => r.status === 'present').length ?? 0
  const late = session?.records?.filter((r: any) => r.status === 'late').length ?? 0
  const absent = session?.records?.filter((r: any) => r.status === 'absent').length ?? 0
  const total = session?.records?.length ?? 0

  return (
    <Drawer
      title={
        <Space>
          <Calendar size={16} />
          {session ? `Session — ${new Date(session.date).toLocaleDateString()}` : 'Session Detail'}
        </Space>
      }
      open={open}
      onClose={onClose}
      width={640}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      ) : session ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Date">{new Date(session.date).toLocaleDateString()}</Descriptions.Item>
            <Descriptions.Item label="Topic">{session.topic ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Token">{session.token ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={session.status === 'active' ? 'green' : 'default'}>{session.status}</Tag>
            </Descriptions.Item>
          </Descriptions>
          <Row gutter={8}>
            {[
              { label: 'Present', count: present, color: '#52c41a' },
              { label: 'Late', count: late, color: '#fa8c16' },
              { label: 'Absent', count: absent, color: '#f5222d' },
            ].map(({ label, count, color }) => (
              <Col span={8} key={label}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic title={label} value={count} valueStyle={{ color, fontSize: 22 }} />
                </Card>
              </Col>
            ))}
          </Row>
          {total > 0 && (
            <Progress
              percent={total > 0 ? Math.round(((present + late) / total) * 100) : 0}
              status={((present + late) / total) < 0.75 ? 'exception' : 'success'}
              format={(p) => `${p}% attendance`}
            />
          )}
          <Table
            rowKey="id"
            columns={recordColumns}
            dataSource={session.records ?? []}
            size="small"
            pagination={false}
            onRow={(record) => ({ style: { background: rowBg(record.status) ?? 'transparent' } })}
          />
        </Space>
      ) : (
        <Empty description="Session not found" />
      )}
    </Drawer>
  )
}

// ─── Grade Item Detail Drawer ────────────────────────────────────

function GradeItemDrawer({ gradeItemId, courseName, open, onClose }: { gradeItemId: string | null; courseName: string; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['grade-item-detail', gradeItemId],
    queryFn: async () => {
      const res = await api.get(`/grades?gradeItemId=${gradeItemId}`)
      return res.data.data as any[]
    },
    enabled: !!gradeItemId && open,
  })

  const grades = data ?? []
  const scored = grades.filter((g: any) => g.score != null)
  const scores = scored.map((g: any) => g.score as number)
  const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-'
  const max = scores.length > 0 ? Math.max(...scores) : '-'
  const min = scores.length > 0 ? Math.min(...scores) : '-'

  const columns: ColumnsType<any> = [
    {
      title: 'Student',
      render: (_, r) => (
        <Link to={`/sis/students/${r.studentId}`}>
          {r.student?.user?.displayName ?? r.studentId}
        </Link>
      ),
    },
    {
      title: 'Score',
      render: (_, r) => r.score != null ? `${r.score} / ${r.gradeItem?.maxScore ?? '?'}` : <Text type="secondary">Not graded</Text>,
      width: 110,
    },
    {
      title: 'Pct',
      render: (_, r) => r.score != null && r.gradeItem?.maxScore ? `${Math.round((r.score / r.gradeItem.maxScore) * 100)}%` : '-',
      width: 70,
    },
    {
      title: 'Grade',
      render: (_, r) => r.letterGrade
        ? <Tag color={r.letterGrade === 'F' ? 'red' : r.letterGrade.startsWith('A') ? 'green' : 'blue'}>{r.letterGrade}</Tag>
        : '-',
      width: 80,
    },
    { title: 'Remarks', dataIndex: 'remarks', render: (v) => v ?? '-' },
  ]

  return (
    <Drawer
      title={<Space><BarChart2 size={16} />Assessment Results — {courseName}</Space>}
      open={open}
      onClose={onClose}
      width={620}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={8}>
            {[
              { label: 'Class Average', value: avg, suffix: '' },
              { label: 'Highest', value: max, suffix: '' },
              { label: 'Lowest', value: min, suffix: '' },
              { label: 'Ungraded', value: grades.length - scored.length, suffix: '' },
            ].map(({ label, value }) => (
              <Col span={6} key={label}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic title={label} value={value} valueStyle={{ fontSize: 20 }} />
                </Card>
              </Col>
            ))}
          </Row>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={grades}
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No grades recorded" /> }}
          />
        </Space>
      )}
    </Drawer>
  )
}

// ─── Main Page ───────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sessionDrawer, setSessionDrawer] = useState<string | null>(null)
  const [gradeItemDrawer, setGradeItemDrawer] = useState<{ id: string; name: string } | null>(null)

  const { data: course, isLoading, error } = useQuery({
    queryKey: ['course-detail', id],
    queryFn: async () => {
      const res = await api.get(`/courses/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (error || !course) return <Alert type="error" message="Failed to load course details" />

  const totalSessions = course.attendanceSessions?.length ?? 0
  const attendanceCounts = course.attendanceCounts ?? []

  const enrollmentColumns: ColumnsType<any> = [
    {
      title: 'Student ID',
      render: (_, r) => r.student?.studentId ?? '-',
      width: 130,
    },
    {
      title: 'Name',
      render: (_, r) => (
        <Link to={`/sis/students/${r.studentId}`}>
          {r.student?.user?.displayName ?? '-'}
        </Link>
      ),
    },
    {
      title: 'Avg Grade',
      render: (_, r) => {
        const avg = computeStudentAvg(r.student?.grades ?? [])
        if (avg === null) return <Text type="secondary">—</Text>
        return (
          <Space size={4}>
            <Text strong>{avg}%</Text>
            <Tag color={avg >= 70 ? 'green' : avg >= 50 ? 'orange' : 'red'}>
              {avg >= 90 ? 'A+' : avg >= 80 ? 'A' : avg >= 70 ? 'B' : avg >= 60 ? 'C' : avg >= 50 ? 'D' : 'F'}
            </Tag>
          </Space>
        )
      },
      width: 130,
    },
    {
      title: 'Attendance',
      render: (_, r) => {
        if (totalSessions === 0) return '-'
        const pct = attendancePct(attendanceCounts, r.studentId, totalSessions)
        return (
          <Space size={4}>
            <Progress percent={pct} size="small" style={{ width: 80 }} status={pct < 75 ? 'exception' : pct < 85 ? 'active' : 'success'} />
            <Text style={{ fontSize: 12 }}>{pct}%</Text>
          </Space>
        )
      },
      width: 160,
    },
    { title: 'Semester', dataIndex: 'semester', width: 110 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => <Tag color={val === 'enrolled' || val === 'active' ? 'green' : val === 'completed' ? 'blue' : 'default'}>{val}</Tag>,
    },
  ]

  const sessionColumns: ColumnsType<any> = [
    {
      title: 'Date',
      render: (_, r) => new Date(r.date).toLocaleDateString(),
      width: 120,
    },
    { title: 'Topic', dataIndex: 'topic', render: (v) => v ?? '-' },
    {
      title: 'Records',
      render: (_, r) => r._count?.records ?? 0,
      width: 90,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => <Tag color={val === 'active' ? 'green' : 'default'}>{val}</Tag>,
    },
    {
      title: '',
      width: 90,
      render: (_, r) => (
        <Button size="small" icon={<Eye size={13} />} onClick={() => setSessionDrawer(r.id)}>
          Details
        </Button>
      ),
    },
  ]

  const gradeItemColumns: ColumnsType<any> = [
    { title: 'Assessment', dataIndex: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 110,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    { title: 'Max Score', dataIndex: 'maxScore', width: 100 },
    { title: 'Weight', render: (_, r) => `${r.weight}%`, width: 80 },
    { title: 'Due', dataIndex: 'dueDate', width: 110, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    {
      title: 'Graded',
      render: (_, r) => `${r._count?.grades ?? 0} / ${course.enrollments?.length ?? 0}`,
      width: 100,
    },
    {
      title: '',
      width: 90,
      render: (_, r) => (
        <Button size="small" icon={<BarChart2 size={13} />} onClick={() => setGradeItemDrawer({ id: r.id, name: r.name })}>
          Results
        </Button>
      ),
    },
  ]

  const timetableColumns: ColumnsType<any> = [
    {
      title: 'Day',
      dataIndex: 'dayOfWeek',
      width: 100,
      render: (d: number) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d] ?? '-',
    },
    { title: 'Start', dataIndex: 'startTime', width: 90 },
    { title: 'End', dataIndex: 'endTime', width: 90 },
    { title: 'Room', dataIndex: 'room', render: (v) => v ?? '-' },
    { title: 'Class', dataIndex: 'className', render: (v) => v ?? '-' },
    { title: 'Semester', dataIndex: 'semester' },
  ]

  const assignedTeacher = course.assignments?.[0]?.teacher

  const tabItems = [
    {
      key: 'students',
      label: (
        <Space size={4}>
          <Users size={14} />
          Students
          <Badge count={course.enrollments?.length ?? 0} showZero style={{ backgroundColor: '#1677ff' }} />
        </Space>
      ),
      children: (
        <Card size="small">
          <Table
            rowKey="id"
            columns={enrollmentColumns}
            dataSource={course.enrollments ?? []}
            size="small"
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="No students enrolled" /> }}
          />
        </Card>
      ),
    },
    {
      key: 'sessions',
      label: (
        <Space size={4}>
          <Calendar size={14} />
          Sessions
          <Badge count={totalSessions} showZero style={{ backgroundColor: '#52c41a' }} />
        </Space>
      ),
      children: (
        <Card size="small">
          <Table
            rowKey="id"
            columns={sessionColumns}
            dataSource={course.attendanceSessions ?? []}
            size="small"
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: <Empty description="No sessions held yet" /> }}
          />
        </Card>
      ),
    },
    {
      key: 'assessments',
      label: (
        <Space size={4}>
          <BarChart2 size={14} />
          Assessments
          <Badge count={course.gradeItems?.length ?? 0} showZero style={{ backgroundColor: '#722ed1' }} />
        </Space>
      ),
      children: (
        <Card size="small">
          <Table
            rowKey="id"
            columns={gradeItemColumns}
            dataSource={course.gradeItems ?? []}
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No assessments defined" /> }}
          />
        </Card>
      ),
    },
    {
      key: 'timetable',
      label: <Space size={4}><Clock size={14} />Timetable</Space>,
      children: (
        <Card size="small">
          <Table
            rowKey="id"
            columns={timetableColumns}
            dataSource={course.timetableSlots ?? []}
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No timetable slots defined" /> }}
          />
        </Card>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/sms/courses">Courses</Link> },
          { title: `${course.code} — ${course.name}` },
        ]}
      />

      {/* Header card */}
      <Card style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space size={16} align="center">
              <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(-1)} size="small">
                Back
              </Button>
              <div
                style={{
                  width: 48, height: 48, borderRadius: 8,
                  background: '#f0f5ff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}
              >
                <BookOpen size={22} color="#2f54eb" />
              </div>
              <div>
                <Space size={8} align="baseline">
                  <Title level={4} style={{ margin: 0 }}>{course.name}</Title>
                  <Tag color="blue">{course.code}</Tag>
                  <Tag color={course.status === 'active' ? 'green' : 'default'}>{course.status}</Tag>
                </Space>
                <Space size={12} style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>Grade: {course.gradeLevel ?? '-'}</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>Credit Hours: {course.creditHours}</Text>
                  {assignedTeacher && (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Teacher:{' '}
                      <Link to={`/ems/teachers/${assignedTeacher.id}`}>
                        {assignedTeacher.user?.displayName}
                      </Link>
                    </Text>
                  )}
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <Row gutter={16}>
              <Col>
                <Statistic title="Enrolled" value={course.enrollments?.length ?? 0} valueStyle={{ fontSize: 20 }} />
              </Col>
              <Col>
                <Statistic title="Sessions" value={totalSessions} valueStyle={{ fontSize: 20 }} />
              </Col>
              <Col>
                <Statistic title="Assessments" value={course.gradeItems?.length ?? 0} valueStyle={{ fontSize: 20 }} />
              </Col>
            </Row>
          </Col>
        </Row>
        {course.description && (
          <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
            {course.description}
          </Text>
        )}
      </Card>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* Session detail drawer */}
      <SessionDetailDrawer
        sessionId={sessionDrawer}
        open={!!sessionDrawer}
        onClose={() => setSessionDrawer(null)}
      />

      {/* Grade item detail drawer */}
      <GradeItemDrawer
        gradeItemId={gradeItemDrawer?.id ?? null}
        courseName={gradeItemDrawer?.name ?? ''}
        open={!!gradeItemDrawer}
        onClose={() => setGradeItemDrawer(null)}
      />
    </div>
  )
}
