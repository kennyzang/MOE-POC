import { useState } from 'react'
import {
  Card, Row, Col, Typography, Tag, Space, Descriptions,
  Progress, Empty, Divider, Button, Modal, Form, Input, Spin,
  Alert, Badge, Statistic, Avatar, Tooltip,
} from 'antd'
import {
  User, Award, Briefcase, GraduationCap, Star,
  Clock, CheckCircle, Phone, Mail, Edit, ShieldCheck,
  TrendingUp, Calendar, MapPin, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography
const { TextArea } = Input

const BADGE_COLORS: Record<string, string> = {
  gold: '#faad14', silver: '#8c8c8c', bronze: '#d46b08',
  blue: '#1677ff', green: '#52c41a', purple: '#722ed1',
}
const CATEGORY_COLORS: Record<string, string> = {
  EXCELLENCE: '#faad14', SERVICE: '#1677ff', INNOVATION: '#52c41a',
  LEADERSHIP: '#722ed1', COMMUNITY: '#13c2c2', OTHER: '#8c8c8c',
}

export default function MyProfilePage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [profileForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['my-teacher-profile'],
    queryFn: async () => {
      const { data } = await api.get('/teachers/me')
      return data.data
    },
  })

  const { data: awards = [] } = useQuery({
    queryKey: ['my-awards'],
    queryFn: async () => {
      const { data } = await api.get('/awards')
      return data.data
    },
  })

  const { data: postings = [] } = useQuery({
    queryKey: ['my-postings'],
    queryFn: async () => {
      const { data } = await api.get('/postings/my-history')
      return data.data
    },
  })

  const { data: certifications = [] } = useQuery({
    queryKey: ['my-certifications'],
    queryFn: async () => {
      const { data } = await api.get('/certifications')
      return data.data
    },
  })

  const { data: retirementStatus } = useQuery({
    queryKey: ['my-retirement-status'],
    queryFn: async () => {
      const { data } = await api.get('/retirement/my-status')
      return data.data
    },
  })

  const { data: evaluations = [] } = useQuery({
    queryKey: ['my-evaluations'],
    queryFn: async () => {
      if (!teacher?.id) return []
      const { data } = await api.get('/ems/performance-evaluations', { params: { teacherId: teacher.id } })
      return data.data
    },
    enabled: !!teacher?.id,
  })

  const handleProfileUpdate = async () => {
    const values = await profileForm.validateFields()
    const changes = Object.entries(values)
      .filter(([, val]) => val !== undefined && val !== '')
      .map(([field, newValue]) => ({ field, newValue: String(newValue) }))
    if (changes.length === 0) { return }
    setSubmitting(true)
    try {
      await api.patch('/self-service/profile', { changes })
      setEditOpen(false)
      profileForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['my-teacher-profile'] })
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 60 }} />

  if (!teacher) return (
    <Alert type="warning" message="No teacher record found for your account." style={{ margin: 24 }} />
  )

  const latestEval = evaluations.find((e: any) => e.status === 'approved') ?? evaluations[0]
  const expiredCerts = certifications.filter((c: any) => c.expiryDate && dayjs(c.expiryDate).isBefore(dayjs()))
  const activeCerts = certifications.filter((c: any) => !c.expiryDate || dayjs(c.expiryDate).isAfter(dayjs()))
  // Sort postings: current first, then by startDate desc
  const sortedPostings = [...postings].sort((a: any, b: any) => {
    if (a.isCurrent && !b.isCurrent) return -1
    if (!a.isCurrent && b.isCurrent) return 1
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  })
  const currentPosting = postings.find((p: any) => p.isCurrent)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* ── Header card ─────────────────────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[24, 16]} align="middle">
          <Col flex="none">
            <Avatar
              size={80}
              style={{ background: '#1677ff', fontSize: 28, fontWeight: 700 }}
            >
              {teacher.user?.displayName?.charAt(0) ?? 'T'}
            </Avatar>
          </Col>
          <Col flex="1">
            <Space direction="vertical" size={4}>
              <Title level={3} style={{ margin: 0 }}>{teacher.user?.displayName}</Title>
              <Space wrap size={8}>
                <Tag color="blue">{teacher.designation ?? 'Teacher'}</Tag>
                <Tag color="cyan">{teacher.department}</Tag>
                <Tag color="green">{teacher.employmentStatus}</Tag>
                {retirementStatus?.hasApplication && (
                  <Tag color="orange" icon={<Clock size={11} />}>
                    Retirement: {retirementStatus.applicationStatus?.replace(/_/g, ' ')}
                  </Tag>
                )}
                {retirementStatus?.urgencyLevel && retirementStatus.urgencyLevel !== 'NONE' && !retirementStatus.hasApplication && (
                  <Tag color={retirementStatus.urgencyLevel === 'OVERDUE' ? 'error' : 'warning'} icon={<AlertTriangle size={11} />}>
                    Retirement {retirementStatus.urgencyLevel}
                  </Tag>
                )}
              </Space>
              <Space size={16} wrap style={{ fontSize: 13, color: '#595959' }}>
                <Space size={4}><Mail size={13} />{teacher.user?.email}</Space>
                {teacher.phone && <Space size={4}><Phone size={13} />{teacher.phone}</Space>}
                <Space size={4}><Briefcase size={13} />Staff ID: {teacher.staffId}</Space>
                <Space size={4}><Calendar size={13} />Joined {dayjs(teacher.joinDate).format('MMM YYYY')}</Space>
              </Space>
            </Space>
          </Col>
          <Col flex="none">
            <Button icon={<Edit size={14} />} onClick={() => setEditOpen(true)}>
              Edit Profile
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        {/* ── Left column ──────────────────────────────── */}
        <Col xs={24} md={16}>
          {/* Personal Details */}
          <Card
            size="small"
            title={<Space><User size={14} />Personal Details</Space>}
            style={{ marginBottom: 16 }}
          >
            <Descriptions column={1} size="small" labelStyle={{ color: '#8c8c8c', width: 150 }}>
              <Descriptions.Item label="Full Name">{teacher.user?.displayName}</Descriptions.Item>
              <Descriptions.Item label="Qualification">{teacher.qualification ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Subjects">{teacher.subjects ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Department">{teacher.department ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Designation">{teacher.designation ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Employment">{teacher.employmentStatus}</Descriptions.Item>
              <Descriptions.Item label="Date of Birth">{teacher.dateOfBirth ? dayjs(teacher.dateOfBirth).format('D MMM YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="IC / Passport">{teacher.icNumber ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Address">{teacher.address ?? '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Career History */}
          <Card
            size="small"
            title={
              <Space>
                <Briefcase size={14} />Career History
                <Tag color="blue" style={{ fontSize: 11 }}>{postings.length} posting{postings.length !== 1 ? 's' : ''}</Tag>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {sortedPostings.length === 0 ? (
              <Empty description="No posting history recorded" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ position: 'relative', paddingLeft: 28 }}>
                {/* vertical spine */}
                <div style={{
                  position: 'absolute', left: 9, top: 10, bottom: 10,
                  width: 2, background: 'linear-gradient(to bottom, #52c41a 0%, #1677ff 40%, #d9d9d9 100%)',
                  borderRadius: 2,
                }} />

                {sortedPostings.map((p: any, i: number) => {
                  const start = dayjs(p.startDate)
                  const end = p.endDate ? dayjs(p.endDate) : dayjs()
                  const months = end.diff(start, 'month')
                  const years = Math.floor(months / 12)
                  const remMonths = months % 12
                  const tenure = years > 0
                    ? `${years} yr${years > 1 ? 's' : ''}${remMonths > 0 ? ` ${remMonths} mo` : ''}`
                    : `${remMonths} mo`

                  return (
                    <div key={p.id ?? i} style={{ position: 'relative', marginBottom: i < sortedPostings.length - 1 ? 20 : 0 }}>
                      {/* dot */}
                      <div style={{
                        position: 'absolute', left: -22, top: 4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: p.isCurrent ? '#52c41a' : '#1677ff',
                        border: '2px solid #fff',
                        boxShadow: p.isCurrent ? '0 0 0 3px rgba(82,196,26,0.25)' : '0 0 0 2px #d6e4ff',
                        zIndex: 1,
                      }} />

                      <div style={{
                        background: p.isCurrent ? '#f6ffed' : '#fafafa',
                        border: `1px solid ${p.isCurrent ? '#b7eb8f' : '#f0f0f0'}`,
                        borderRadius: 8,
                        padding: '10px 14px',
                      }}>
                        <Row justify="space-between" align="top">
                          <Col flex="1">
                            <Space size={6} wrap style={{ marginBottom: 2 }}>
                              <Text strong style={{ fontSize: 13 }}>{p.position}</Text>
                              {p.isCurrent && <Tag color="success" style={{ fontSize: 10, padding: '0 5px' }}>Current</Tag>}
                            </Space>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#262626', marginBottom: 2 }}>
                              <Briefcase size={12} style={{ color: '#8c8c8c', flexShrink: 0 }} />
                              {p.schoolName}
                            </div>
                            {p.department && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8c8c8c' }}>
                                <MapPin size={11} style={{ flexShrink: 0 }} />
                                {p.department}
                              </div>
                            )}
                          </Col>
                          <Col flex="none" style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#8c8c8c', whiteSpace: 'nowrap' }}>
                              {start.format('MMM YYYY')} — {p.endDate ? end.format('MMM YYYY') : 'Present'}
                            </div>
                            <Tooltip title="Tenure duration">
                              <Tag color={p.isCurrent ? 'green' : 'default'} style={{ fontSize: 10, marginTop: 4, cursor: 'default' }}>
                                {tenure}
                              </Tag>
                            </Tooltip>
                          </Col>
                        </Row>
                        {p.notes && (
                          <div style={{
                            marginTop: 8, fontSize: 12, color: '#595959',
                            background: p.isCurrent ? '#f0fae6' : '#f5f5f5',
                            borderLeft: `3px solid ${p.isCurrent ? '#52c41a' : '#d9d9d9'}`,
                            padding: '4px 8px', borderRadius: '0 4px 4px 0',
                          }}>
                            {p.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Certifications */}
          <Card
            size="small"
            title={
              <Space>
                <ShieldCheck size={14} />Certifications
                {expiredCerts.length > 0 && (
                  <Badge count={`${expiredCerts.length} expired`} color="red" />
                )}
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {certifications.length === 0 ? (
              <Empty description="No certifications on record" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {certifications.map((c: any) => {
                  const expired = c.expiryDate && dayjs(c.expiryDate).isBefore(dayjs())
                  const daysLeft = c.expiryDate ? dayjs(c.expiryDate).diff(dayjs(), 'day') : null
                  return (
                    <Card key={c.id} size="small" style={{ background: expired ? '#fff2f0' : '#fafafa', border: expired ? '1px solid #ffccc7' : undefined }}>
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Space size={6} wrap>
                            <Text strong style={{ fontSize: 13 }}>{c.name}</Text>
                            <Tag color={expired ? 'red' : 'green'} style={{ fontSize: 11 }}>
                              {expired ? 'Expired' : 'Active'}
                            </Tag>
                          </Space>
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                            {c.issuedBy} · Issued {dayjs(c.issuedDate).format('D MMM YYYY')}
                          </div>
                        </Col>
                        <Col>
                          {daysLeft !== null && (
                            <Text style={{ fontSize: 12, color: expired ? '#cf1322' : daysLeft < 60 ? '#d46b08' : '#8c8c8c' }}>
                              {expired ? `Expired ${Math.abs(daysLeft)}d ago` : `Expires in ${daysLeft}d`}
                            </Text>
                          )}
                        </Col>
                      </Row>
                    </Card>
                  )
                })}
              </Space>
            )}
          </Card>

          {/* Awards */}
          <Card
            size="small"
            title={<Space><Award size={14} />Awards & Recognition</Space>}
            style={{ marginBottom: 16 }}
          >
            {awards.length === 0 ? (
              <Empty description="No awards recorded yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {awards.map((a: any) => (
                  <Card key={a.id} size="small" style={{ background: '#fafafa' }}>
                    <Space align="start" size={12}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: BADGE_COLORS[a.badgeColor] ?? '#8c8c8c',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Star size={16} style={{ color: '#fff' }} />
                      </div>
                      <div>
                        <Space size={6} wrap>
                          <Text strong style={{ fontSize: 13 }}>{a.title}</Text>
                          <Tag color={CATEGORY_COLORS[a.category] ?? 'default'} style={{ fontSize: 11 }}>{a.category}</Tag>
                        </Space>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                          {dayjs(a.awardedDate).format('D MMM YYYY')}
                          {a.awardedBy ? ` · ${a.awardedBy}` : ''}
                        </div>
                        {a.description && <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>{a.description}</div>}
                      </div>
                    </Space>
                  </Card>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        {/* ── Right column ─────────────────────────────── */}
        <Col xs={24} md={8}>
          {/* Quick Stats */}
          <Card size="small" title="At a Glance" style={{ marginBottom: 16 }}>
            <Row gutter={[8, 12]}>
              <Col span={12}>
                <Statistic
                  title="CPD Hours"
                  value={teacher.cpdHours ?? 0}
                  suffix={`/ ${teacher.cpdTarget ?? 20}h`}
                  valueStyle={{ fontSize: 18 }}
                />
                <Progress
                  percent={Math.min(100, Math.round(((teacher.cpdHours ?? 0) / (teacher.cpdTarget ?? 20)) * 100))}
                  size="small"
                  showInfo={false}
                  strokeColor="#52c41a"
                  style={{ marginTop: 4 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Certs"
                  value={activeCerts.length}
                  suffix={certifications.length > 0 ? `/ ${certifications.length}` : ''}
                  valueStyle={{ fontSize: 18, color: expiredCerts.length > 0 ? '#d46b08' : '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Awards"
                  value={awards.length}
                  valueStyle={{ fontSize: 18, color: awards.length > 0 ? '#faad14' : '#8c8c8c' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Yrs Service"
                  value={dayjs().diff(dayjs(teacher.joinDate), 'year')}
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
            </Row>
          </Card>

          {/* Latest Performance */}
          {latestEval && (
            <Card size="small" title={<Space><TrendingUp size={14} />Latest Evaluation</Space>} style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Row justify="space-between">
                  <Text type="secondary" style={{ fontSize: 12 }}>Academic Year</Text>
                  <Text strong style={{ fontSize: 12 }}>{latestEval.academicYear}</Text>
                </Row>
                <Row justify="space-between">
                  <Text type="secondary" style={{ fontSize: 12 }}>Overall Score</Text>
                  <Text strong style={{ fontSize: 14, color: '#1677ff' }}>{latestEval.overallScore?.toFixed(1)}</Text>
                </Row>
                <Row justify="space-between">
                  <Text type="secondary" style={{ fontSize: 12 }}>Rating</Text>
                  <Tag color={latestEval.rating === 'Excellent' ? 'green' : latestEval.rating === 'Good' ? 'blue' : 'orange'}>
                    {latestEval.rating}
                  </Tag>
                </Row>
                <Divider style={{ margin: '6px 0' }} />
                <Row gutter={[4, 4]}>
                  {[
                    { label: 'Teaching', val: latestEval.teachingScore },
                    { label: 'Professional', val: latestEval.professionalScore },
                    { label: 'Conduct', val: latestEval.conductScore },
                  ].map(({ label, val }) => (
                    <Col span={24} key={label}>
                      <Row justify="space-between" style={{ marginBottom: 2 }}>
                        <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</Text>
                        <Text style={{ fontSize: 11 }}>{val}</Text>
                      </Row>
                      <Progress percent={val} size="small" showInfo={false} />
                    </Col>
                  ))}
                </Row>
              </Space>
            </Card>
          )}

          {/* Retirement status */}
          {retirementStatus && (
            <Card
              size="small"
              title={<Space><Clock size={14} />Retirement</Space>}
              extra={
                retirementStatus.urgencyLevel !== 'NONE' ? (
                  <Tag
                    color={retirementStatus.urgencyLevel === 'OVERDUE' ? 'error' : retirementStatus.urgencyLevel === 'URGENT' ? 'warning' : 'processing'}
                    style={{ fontSize: 10, margin: 0 }}
                  >
                    {retirementStatus.urgencyLevel}
                  </Tag>
                ) : null
              }
              style={{ marginBottom: 16 }}
            >
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {retirementStatus.urgencyLevel !== 'NONE' && !retirementStatus.hasApplication && (
                  <Alert
                    type={retirementStatus.urgencyLevel === 'OVERDUE' ? 'error' : 'warning'}
                    message={
                      retirementStatus.urgencyLevel === 'OVERDUE'
                        ? 'Passed mandatory retirement date'
                        : `Approaching in ${retirementStatus.daysUntilEligible}d`
                    }
                    banner
                    showIcon
                    icon={<AlertTriangle size={12} />}
                    style={{ borderRadius: 4, fontSize: 11, padding: '4px 8px', marginBottom: 4 }}
                  />
                )}
                <Row justify="space-between">
                  <Text type="secondary" style={{ fontSize: 12 }}>Eligible From</Text>
                  <Text strong style={{ fontSize: 12 }}>
                    {retirementStatus.eligibleRetirementDate
                      ? dayjs(retirementStatus.eligibleRetirementDate).format('D MMM YYYY')
                      : '—'}
                  </Text>
                </Row>
                {retirementStatus.daysUntilEligible !== null && (
                  <Row justify="space-between">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {retirementStatus.daysUntilEligible < 0 ? 'Overdue by' : 'Days Left'}
                    </Text>
                    <Text
                      strong
                      style={{
                        fontSize: 12,
                        color: retirementStatus.daysUntilEligible < 0
                          ? '#ff4d4f'
                          : retirementStatus.daysUntilEligible <= 180 ? '#faad14' : '#595959',
                      }}
                    >
                      {Math.abs(retirementStatus.daysUntilEligible)}d
                    </Text>
                  </Row>
                )}
                <Row justify="space-between">
                  <Text type="secondary" style={{ fontSize: 12 }}>Age</Text>
                  <Text style={{ fontSize: 12 }}>
                    {retirementStatus.currentAge ?? '—'} / 55 yrs
                  </Text>
                </Row>
                <Row justify="space-between">
                  <Text type="secondary" style={{ fontSize: 12 }}>Service</Text>
                  <Text style={{ fontSize: 12 }}>
                    {retirementStatus.serviceYears ?? '—'} / 30 yrs
                  </Text>
                </Row>
                {retirementStatus.hasApplication && (
                  <>
                    <Divider style={{ margin: '4px 0' }} />
                    <Row justify="space-between">
                      <Text type="secondary" style={{ fontSize: 12 }}>Application</Text>
                      <Tag
                        color={
                          retirementStatus.applicationStatus === 'APPROVED' ? 'success'
                            : retirementStatus.applicationStatus === 'REJECTED' ? 'error'
                            : retirementStatus.applicationStatus === 'UNDER_REVIEW' ? 'warning'
                            : 'processing'
                        }
                        style={{ fontSize: 11 }}
                      >
                        {retirementStatus.applicationStatus?.replace(/_/g, ' ')}
                      </Tag>
                    </Row>
                  </>
                )}
                <Divider style={{ margin: '4px 0' }} />
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, fontSize: 12, height: 'auto' }}
                  onClick={() => navigate('/ems/retirement')}
                >
                  View full details <ChevronRight size={11} style={{ verticalAlign: 'middle' }} />
                </Button>
              </Space>
            </Card>
          )}

          {/* Current Posting */}
          {currentPosting && (
            <Card size="small" title={<Space><GraduationCap size={14} />Current Posting</Space>} style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={2}>
                <Text strong>{currentPosting.position}</Text>
                <Text style={{ fontSize: 13 }}>{currentPosting.schoolName}</Text>
                {currentPosting.department && (
                  <Text type="secondary" style={{ fontSize: 12 }}>{currentPosting.department}</Text>
                )}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Since {dayjs(currentPosting.startDate).format('MMM YYYY')}
                </Text>
              </Space>
            </Card>
          )}

          {/* Certifications summary */}
          {expiredCerts.length > 0 && (
            <Alert
              type="warning"
              icon={<CheckCircle size={14} />}
              showIcon
              message={`${expiredCerts.length} certification${expiredCerts.length > 1 ? 's' : ''} expired`}
              description="Please renew your certifications and submit updated records."
              style={{ marginBottom: 16 }}
            />
          )}
        </Col>
      </Row>

      {/* ── Edit Profile Modal ──────────────────────────── */}
      <Modal
        open={editOpen}
        title={<Space><Edit size={15} />Edit Profile</Space>}
        onCancel={() => { setEditOpen(false); profileForm.resetFields() }}
        onOk={handleProfileUpdate}
        confirmLoading={submitting}
        width={560}
        destroyOnHidden
      >
        <Alert
          type="info"
          message="Safe fields update immediately. Sensitive fields (designation, qualification, department) require admin approval via the Self-Service Portal."
          style={{ marginBottom: 16 }}
          showIcon
        />
        <Form form={profileForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phone" label="Contact Number">
                <Input placeholder="e.g. +673 7xxxxxx" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email Address">
                <Input placeholder="your.email@school.edu.bn" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Home Address">
            <TextArea rows={2} placeholder="Current residential address" />
          </Form.Item>
          <Divider>Requires Admin Approval</Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="designation" label="Designation">
                <Input placeholder="e.g. Cikgu Gred DG44" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="Department">
                <Input placeholder="e.g. Science & Mathematics" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="qualification" label="Highest Qualification">
            <Input placeholder="e.g. MEd, Universiti Brunei Darussalam" />
          </Form.Item>
          <Form.Item name="subjects" label="Teaching Subjects">
            <Input placeholder="e.g. Mathematics, Science" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
