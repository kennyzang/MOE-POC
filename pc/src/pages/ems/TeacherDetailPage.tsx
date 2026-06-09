import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Card, Tabs, Descriptions, Tag, Spin, Alert, Typography, Space, Row, Col,
  Table, Progress, Statistic, Empty, Breadcrumb, Button, Timeline, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  User, BookOpen, Award, BarChart2, Calendar, GraduationCap,
  ArrowLeft, CheckCircle, Clock, AlertTriangle, Briefcase, Star,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import api from '@/lib/api'
import SyncBadge from '@/components/SyncBadge'

const { Title, Text } = Typography

// ─── Types for new tabs ──────────────────────────────────────────

interface AwardItem {
  id: string
  title: string
  category: string
  description: string | null
  awardedDate: string
  awardedBy: string | null
  badgeColor: string
}

interface PostingItem {
  id: string
  schoolName: string
  position: string
  department: string | null
  startDate: string
  endDate: string | null
  isCurrent: boolean
  notes: string | null
}

const BADGE_COLORS_MAP: Record<string, string> = {
  gold: '#faad14', silver: '#8c8c8c', bronze: '#d46b08',
  blue: '#1677ff', green: '#52c41a', purple: '#722ed1',
}
const CATEGORY_COLORS_MAP: Record<string, string> = {
  EXCELLENCE: '#faad14', SERVICE: '#1677ff', INNOVATION: '#52c41a',
  LEADERSHIP: '#722ed1', COMMUNITY: '#13c2c2', OTHER: '#8c8c8c',
}

// ─── Awards tab ───────────────────────────────────────────────────

function AwardsTab({ awards }: { awards: AwardItem[] }) {
  if (awards.length === 0) {
    return <Empty description="No awards recorded yet" style={{ padding: 32 }} />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {awards.map(a => (
        <Card key={a.id} size="small" bordered={false} style={{ background: '#fafafa', borderRadius: 10 }}>
          <Space align="start" size={12}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: BADGE_COLORS_MAP[a.badgeColor] ?? '#8c8c8c',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Star size={18} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <Space size={8} wrap>
                <Text strong style={{ fontSize: 14 }}>{a.title}</Text>
                <Tag color={CATEGORY_COLORS_MAP[a.category] ?? 'default'} style={{ fontSize: 11 }}>{a.category}</Tag>
              </Space>
              <div style={{ marginTop: 2 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(a.awardedDate).format('D MMM YYYY')}
                  {a.awardedBy ? ` · ${a.awardedBy}` : ''}
                </Text>
              </div>
              {a.description && (
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>{a.description}</Text>
              )}
            </div>
          </Space>
        </Card>
      ))}
    </div>
  )
}

// ─── Career History tab ───────────────────────────────────────────

function CareerHistoryTab({ postings }: { postings: PostingItem[] }) {
  if (postings.length === 0) {
    return <Empty description="No posting history recorded yet" style={{ padding: 32 }} />
  }
  return (
    <Timeline
      items={postings.map(p => ({
        color: p.isCurrent ? 'green' : 'blue',
        dot: <Briefcase size={14} style={{ color: p.isCurrent ? '#52c41a' : '#1677ff' }} />,
        children: (
          <div style={{ paddingBottom: 8 }}>
            <Space size={8} wrap>
              <Text strong>{p.schoolName}</Text>
              {p.isCurrent && <Tag color="success">Current</Tag>}
            </Space>
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {p.position}
                {p.department ? ` · ${p.department}` : ''}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(p.startDate).format('MMM YYYY')} — {p.endDate ? dayjs(p.endDate).format('MMM YYYY') : 'Present'}
              </Text>
            </div>
            {p.notes && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>{p.notes}</Text>
            )}
          </div>
        ),
      }))}
    />
  )
}

// ─── Helpers ────────────────────────────────────────────────────

const RATING_COLOR: Record<string, string> = {
  Excellent: 'success',
  Good:      'processing',
  Satisfactory: 'warning',
  'Needs Improvement': 'error',
}
const LEAVE_STATUS_COLOR: Record<string, string> = {
  PENDING:           'warning',
  HOD_APPROVED:      'processing',
  PRINCIPAL_APPROVED: 'success',
  REJECTED:          'error',
}
const CERT_STATUS_COLOR: Record<string, string> = {
  active:  'success',
  expired: 'error',
  pending: 'warning',
}

// ─── Tab: Overview ──────────────────────────────────────────────

function OverviewTab({ teacher }: { teacher: any }) {
  const nearExpiryCerts = (teacher.certifications ?? []).filter((c: any) => {
    if (c.status !== 'active' || !c.expiryDate) return false
    const daysLeft = (new Date(c.expiryDate).getTime() - Date.now()) / 86400000
    return daysLeft < 90
  })

  return (
    <Row gutter={[24, 24]}>
      <Col xs={24} md={14}>
        <Card size="small" title="Staff Information" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="Staff ID">{teacher.staffId}</Descriptions.Item>
            <Descriptions.Item label="Full Name">{teacher.user?.displayName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Email">{teacher.user?.email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Username">{teacher.user?.username ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Designation">{teacher.designation ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Department">{teacher.department ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Qualification">{teacher.qualification ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Subjects">{teacher.subjects ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Form Class">
              {teacher.formClass
                ? <Tag color="purple">{teacher.formClass.className}</Tag>
                : <Text type="secondary">—</Text>
              }
            </Descriptions.Item>
            <Descriptions.Item label="Join Date">
              {teacher.joinDate ? new Date(teacher.joinDate).toLocaleDateString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Employment Status">
              <Tag color={teacher.employmentStatus === 'full-time' ? 'blue' : 'default'}>
                {teacher.employmentStatus ?? '-'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Card size="small" title="Account Status">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="Status">
              <Tag color={teacher.status === 'active' ? 'green' : teacher.status === 'on_leave' ? 'orange' : 'default'}>
                {teacher.status ?? '-'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Account">
              <Tag color={teacher.user?.status === 'active' ? 'green' : 'default'}>
                {teacher.user?.status ?? '-'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} md={10}>
        <Card size="small" title="Leave Balances" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="Annual Leave"
                value={teacher.annualLeaveBalance ?? 0}
                suffix="days"
                valueStyle={{ fontSize: 22, color: '#1677ff' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Medical Leave"
                value={teacher.medicalLeaveBalance ?? 0}
                suffix="days"
                valueStyle={{ fontSize: 22, color: '#52c41a' }}
              />
            </Col>
          </Row>
        </Card>

        <Card size="small" title="CPD Progress" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Progress
              percent={Math.min(100, Math.round(((teacher.cpdHours ?? 0) / (teacher.cpdTarget ?? 20)) * 100))}
              status={((teacher.cpdHours ?? 0) >= (teacher.cpdTarget ?? 20)) ? 'success' : 'active'}
              format={(p) => `${p}%`}
            />
            <Row justify="space-between">
              <Text type="secondary" style={{ fontSize: 12 }}>
                Completed: <strong>{teacher.cpdHours ?? 0}h</strong>
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Target: <strong>{teacher.cpdTarget ?? 20}h</strong>
              </Text>
            </Row>
          </Space>
        </Card>

        {nearExpiryCerts.length > 0 && (
          <Card size="small" style={{ borderLeft: '3px solid #fa8c16' }}>
            <Space align="start">
              <AlertTriangle size={16} color="#fa8c16" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <Text strong style={{ color: '#fa8c16', display: 'block' }}>
                  Certifications Expiring Soon
                </Text>
                {nearExpiryCerts.map((c: any) => (
                  <Text key={c.id} type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {c.name} — expires {new Date(c.expiryDate).toLocaleDateString()}
                  </Text>
                ))}
              </div>
            </Space>
          </Card>
        )}
      </Col>
    </Row>
  )
}

// ─── Tab: Courses ────────────────────────────────────────────────

function CoursesTab({ teacher }: { teacher: any }) {
  const assignments = teacher.courseAssignments ?? []

  const columns: ColumnsType<any> = [
    {
      title: 'Course Code',
      render: (_, r) => (
        <Link to={`/sms/courses/${r.courseId}`}>
          <Text code>{r.course?.code ?? '-'}</Text>
        </Link>
      ),
      width: 130,
    },
    { title: 'Course Name', render: (_, r) => r.course?.name ?? '-' },
    { title: 'Grade Level', render: (_, r) => r.course?.gradeLevel ?? '-', width: 110 },
    { title: 'Credit Hours', render: (_, r) => r.course?.creditHours ?? '-', width: 110 },
    { title: 'Semester', dataIndex: 'semester', width: 120 },
    { title: 'Schedule', dataIndex: 'schedule', width: 160 },
    {
      title: 'Enrolled',
      render: (_, r) => r.course?._count?.enrollments ?? '-',
      width: 90,
    },
    {
      title: 'Status',
      render: (_, r) => (
        <Tag color={r.course?.status === 'active' ? 'green' : 'default'}>{r.course?.status ?? '-'}</Tag>
      ),
      width: 90,
    },
  ]

  return (
    <Card size="small" title={<Space><BookOpen size={14} />Assigned Courses ({assignments.length})</Space>}>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={assignments}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="No courses assigned" /> }}
      />
    </Card>
  )
}

// ─── Tab: Performance Evaluations ───────────────────────────────

function PerformanceTab({ evaluations }: { evaluations: any[] }) {
  const evalColumns: ColumnsType<any> = [
    { title: 'Academic Year', dataIndex: 'academicYear', width: 130 },
    { title: 'Teaching', dataIndex: 'teachingScore', width: 90, render: (v) => v ?? '-' },
    { title: 'Professional', dataIndex: 'professionalScore', width: 110, render: (v) => v ?? '-' },
    { title: 'Conduct', dataIndex: 'conductScore', width: 90, render: (v) => v ?? '-' },
    {
      title: 'Overall',
      dataIndex: 'overallScore',
      width: 90,
      render: (v) => v != null ? <Text strong>{v}</Text> : '-',
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      width: 130,
      render: (val: string) => val ? <Tag color={RATING_COLOR[val] ?? 'default'}>{val}</Tag> : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (val: string) => (
        <Tag color={val === 'approved' ? 'success' : val === 'submitted' ? 'processing' : 'default'}>{val}</Tag>
      ),
    },
    {
      title: 'Comments',
      dataIndex: 'comments',
      render: (v) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v.substring(0, 80)}{v.length > 80 ? '…' : ''}</Text> : '-',
    },
  ]

  return (
    <Card size="small" title={<Space><BarChart2 size={14} />Performance Evaluations</Space>}>
      <Table
        rowKey="id"
        columns={evalColumns}
        dataSource={evaluations}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="No evaluations on record" /> }}
        expandable={{
          expandedRowRender: (record) => (
            <Space direction="vertical" size={4} style={{ padding: '8px 24px' }}>
              {record.reviewerComments && <Text><strong>Reviewer remarks:</strong> {record.reviewerComments}</Text>}
              {record.submittedAt && <Text type="secondary" style={{ fontSize: 12 }}>Submitted: {new Date(record.submittedAt).toLocaleDateString()}</Text>}
              {record.reviewedAt && <Text type="secondary" style={{ fontSize: 12 }}>Reviewed: {new Date(record.reviewedAt).toLocaleDateString()}</Text>}
            </Space>
          ),
          rowExpandable: (record) => !!(record.reviewerComments || record.submittedAt),
        }}
      />
    </Card>
  )
}

// ─── Tab: Certifications ─────────────────────────────────────────

function CertificationsTab({ certifications }: { certifications: any[] }) {
  const certColumns: ColumnsType<any> = [
    { title: 'Certification', dataIndex: 'name' },
    { title: 'Issued By', dataIndex: 'issuedBy', width: 160 },
    { title: 'Issued', dataIndex: 'issuedDate', width: 110, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    {
      title: 'Expiry',
      dataIndex: 'expiryDate',
      width: 110,
      render: (v) => {
        if (!v) return '-'
        const d = new Date(v)
        const daysLeft = (d.getTime() - Date.now()) / 86400000
        return (
          <Space size={4}>
            <Text style={{ color: daysLeft < 30 ? '#f5222d' : daysLeft < 90 ? '#fa8c16' : undefined }}>
              {d.toLocaleDateString()}
            </Text>
            {daysLeft < 90 && daysLeft > 0 && (
              <Badge count={`${Math.round(daysLeft)}d`} color={daysLeft < 30 ? 'red' : 'orange'} />
            )}
          </Space>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => <Tag color={CERT_STATUS_COLOR[val] ?? 'default'}>{val}</Tag>,
    },
  ]

  return (
    <Card size="small" title={<Space><Award size={14} />Certifications ({certifications.length})</Space>}>
      <Table
        rowKey="id"
        columns={certColumns}
        dataSource={certifications}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="No certifications recorded" /> }}
      />
    </Card>
  )
}

// ─── Tab: CPD ────────────────────────────────────────────────────

function CpdTab({ teacher, cpdEnrollments }: { teacher: any; cpdEnrollments: any[] }) {
  const completed = cpdEnrollments.filter((e) => e.status === 'COMPLETED')
  const totalHoursLogged = completed.reduce((sum, e) => sum + (e.hoursAwarded ?? e.workshop?.hours ?? 0), 0)

  const cpdColumns: ColumnsType<any> = [
    { title: 'Workshop', render: (_, r) => r.workshop?.title ?? '-' },
    { title: 'Provider', render: (_, r) => r.workshop?.provider ?? '-', width: 140 },
    { title: 'Hours', render: (_, r) => r.hoursAwarded ?? r.workshop?.hours ?? '-', width: 70 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (val: string) => (
        <Tag color={val === 'COMPLETED' ? 'success' : val === 'ENROLLED' ? 'processing' : 'default'}>
          {val}
        </Tag>
      ),
    },
    { title: 'Enrolled', dataIndex: 'enrolledAt', width: 110, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    { title: 'Completed', dataIndex: 'completedAt', width: 110, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic
              title="Hours This Year"
              value={teacher.cpdHours ?? totalHoursLogged}
              suffix="h"
              valueStyle={{ fontSize: 22, color: (teacher.cpdHours ?? totalHoursLogged) >= (teacher.cpdTarget ?? 20) ? '#52c41a' : '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="Annual Target" value={teacher.cpdTarget ?? 20} suffix="h" valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="Workshops Completed" value={completed.length} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic title="Total Enrolled" value={cpdEnrollments.length} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
      </Row>
      <Card size="small" title={<Space><GraduationCap size={14} />CPD Workshop History</Space>}>
        <Table
          rowKey="id"
          columns={cpdColumns}
          dataSource={cpdEnrollments}
          pagination={{ pageSize: 10, size: 'small' }}
          size="small"
          locale={{ emptyText: <Empty description="No CPD workshops enrolled" /> }}
        />
      </Card>
    </div>
  )
}

// ─── Tab: Leave History ──────────────────────────────────────────

function LeaveTab({ leaves }: { leaves: any[] }) {
  const leaveColumns: ColumnsType<any> = [
    {
      title: 'Type',
      dataIndex: 'leaveType',
      width: 130,
      render: (val: string) => <Tag>{val?.replace(/_/g, ' ')}</Tag>,
    },
    { title: 'Start', dataIndex: 'startDate', width: 110, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    { title: 'End', dataIndex: 'endDate', width: 110, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    { title: 'Days', dataIndex: 'daysRequested', width: 70 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 160,
      render: (val: string) => <Tag color={LEAVE_STATUS_COLOR[val] ?? 'default'}>{val?.replace(/_/g, ' ')}</Tag>,
    },
    { title: 'Reason', dataIndex: 'reason', render: (v) => v ?? '-' },
    { title: 'HOD Remarks', dataIndex: 'hodRemarks', render: (v) => v ?? '-' },
  ]

  return (
    <Card size="small" title={<Space><Calendar size={14} />Leave History</Space>}>
      <Table
        rowKey="id"
        columns={leaveColumns}
        dataSource={leaves}
        pagination={{ pageSize: 10, size: 'small' }}
        size="small"
        locale={{ emptyText: <Empty description="No leave applications on record" /> }}
      />
    </Card>
  )
}

// ─── Main Page ───────────────────────────────────────────────────

export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: teacher, isLoading, error } = useQuery({
    queryKey: ['teacher-detail', id],
    queryFn: async () => {
      const res = await api.get(`/teachers/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: evaluations = [] } = useQuery({
    queryKey: ['teacher-evals', id],
    queryFn: async () => {
      const res = await api.get(`/teachers/${id}/performance-evaluations`)
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: leaves = [] } = useQuery({
    queryKey: ['teacher-leaves', id],
    queryFn: async () => {
      const res = await api.get(`/teachers/${id}/leave-history`)
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: cpdEnrollments = [] } = useQuery({
    queryKey: ['teacher-cpd', id],
    queryFn: async () => {
      const res = await api.get(`/teachers/${id}/cpd-enrollments`)
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: teacherAwards = [] } = useQuery<AwardItem[]>({
    queryKey: ['teacher-awards', id],
    queryFn: async () => {
      const res = await api.get(`/awards/teacher/${id}`)
      return res.data.data as AwardItem[]
    },
    enabled: !!id,
  })

  const { data: postingHistory = [] } = useQuery<PostingItem[]>({
    queryKey: ['teacher-postings', id],
    queryFn: async () => {
      const res = await api.get(`/postings/teacher/${id}`)
      return res.data.data as PostingItem[]
    },
    enabled: !!id,
  })

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }
  if (error || !teacher) {
    return <Alert type="error" message="Failed to load teacher profile" />
  }

  const certifications = teacher.certifications ?? []
  const cpdPct = Math.min(100, Math.round(((teacher.cpdHours ?? 0) / (teacher.cpdTarget ?? 20)) * 100))

  const isTeaching = !teacher.staffType || teacher.staffType === 'TEACHING'

  const tabItems = [
    {
      key: 'overview',
      label: <Space size={4}><User size={14} />Overview</Space>,
      children: <OverviewTab teacher={teacher} />,
    },
    // Teaching-only tabs
    ...(isTeaching ? [
      {
        key: 'courses',
        label: <Space size={4}><BookOpen size={14} />Courses ({teacher.courseAssignments?.length ?? 0})</Space>,
        children: <CoursesTab teacher={teacher} />,
      },
      {
        key: 'performance',
        label: <Space size={4}><BarChart2 size={14} />Performance ({evaluations.length})</Space>,
        children: <PerformanceTab evaluations={evaluations} />,
      },
    ] : []),
    {
      key: 'certifications',
      label: (
        <Space size={4}>
          <Award size={14} />
          Certifications
          {certifications.filter((c: any) => c.status === 'expired').length > 0 && (
            <Badge count={certifications.filter((c: any) => c.status === 'expired').length} size="small" />
          )}
        </Space>
      ),
      children: <CertificationsTab certifications={certifications} />,
    },
    ...(isTeaching ? [
      {
        key: 'cpd',
        label: (
          <Space size={4}>
            <GraduationCap size={14} />
            CPD
            {cpdPct >= 100 ? <CheckCircle size={14} color="#52c41a" /> : <Clock size={14} color="#fa8c16" />}
          </Space>
        ),
        children: <CpdTab teacher={teacher} cpdEnrollments={cpdEnrollments} />,
      },
    ] : []),
    {
      key: 'leave',
      label: (
        <Space size={4}>
          <Calendar size={14} />
          Leave
          {leaves.filter((l: any) => l.status === 'PENDING').length > 0 && (
            <Badge count={leaves.filter((l: any) => l.status === 'PENDING').length} size="small" color="orange" />
          )}
        </Space>
      ),
      children: <LeaveTab leaves={leaves} />,
    },
    {
      key: 'awards',
      label: (
        <Space size={4}>
          <Star size={14} />
          Awards
          {teacherAwards.length > 0 && <Badge count={teacherAwards.length} size="small" style={{ backgroundColor: '#faad14' }} />}
        </Space>
      ),
      children: <AwardsTab awards={teacherAwards} />,
    },
    {
      key: 'career',
      label: <Space size={4}><Briefcase size={14} />Career History</Space>,
      children: <CareerHistoryTab postings={postingHistory} />,
    },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/ems/teachers">Teachers</Link> },
          { title: teacher.user?.displayName ?? teacher.staffId },
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
                  width: 52, height: 52, borderRadius: '50%',
                  background: '#722ed1', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
                  {(teacher.user?.displayName ?? 'T')[0].toUpperCase()}
                </Text>
              </div>
              <div>
                <Space align="center" size={8}>
                  <Title level={4} style={{ margin: 0 }}>{teacher.user?.displayName}</Title>
                  <SyncBadge source="SSM" relativeTime="2 min ago" absoluteTime="Synced from SSM Civil Service HR System" />
                </Space>
                <Space size={8}>
                  <Text type="secondary" style={{ fontSize: 13 }}>{teacher.staffId}</Text>
                  <Text type="secondary">·</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>{teacher.designation ?? 'Teacher'}</Text>
                  {teacher.department && (
                    <>
                      <Text type="secondary">·</Text>
                      <Text type="secondary" style={{ fontSize: 13 }}>{teacher.department}</Text>
                    </>
                  )}
                  {teacher.formClass && (
                    <>
                      <Text type="secondary">·</Text>
                      <Tag color="purple" style={{ margin: 0, fontSize: 12 }}>
                        Form: {teacher.formClass.className}
                      </Tag>
                    </>
                  )}
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <Space direction="vertical" align="end" size={4}>
              <Tag color={teacher.status === 'active' ? 'green' : 'orange'} style={{ fontSize: 13 }}>
                {teacher.status}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                CPD: {teacher.cpdHours ?? 0}h / {teacher.cpdTarget ?? 20}h
              </Text>
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
