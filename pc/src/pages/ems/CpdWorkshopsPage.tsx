import { useState } from 'react'
import {
  Card, Row, Col, Typography, Space, Button, Tag, Progress, Alert,
  Modal, Descriptions, message, Spin, Badge, Tooltip, Select,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Award, CheckCircle2, Clock, Users, Loader2 } from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography

interface CpdWorkshop {
  id: string
  title: string
  provider?: string
  subject?: string
  hours: number
  startDate: string
  endDate: string
  location?: string
  maxParticipants: number
  status: string
  enrolledCount: number
  alreadyEnrolled: boolean
}

interface CpdTeacher {
  id: string
  staffId: string
  displayName: string
  department: string
  cpdHours: number
  cpdTarget: number
  cpdPercentage: number
  belowTarget: boolean
}

const CpdWorkshopsPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [enrollModal, setEnrollModal] = useState<{ open: boolean; workshop: CpdWorkshop | null }>({
    open: false, workshop: null,
  })
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | undefined>()

  const canEnrollOthers = ['admin', 'manager', 'hod', 'principal'].includes(user?.role ?? '')
  const isTeacher = user?.role === 'teacher'

  const { data: workshops = [], isLoading } = useQuery({
    queryKey: ['cpd-workshops'],
    queryFn: async () => {
      const { data } = await api.get('/ems/cpd-workshops')
      return data.data as CpdWorkshop[]
    },
    refetchInterval: 30000,
  })

  const { data: cpdSummary = [], isLoading: loadingCpd } = useQuery({
    queryKey: ['cpd-summary'],
    queryFn: async () => {
      const { data } = await api.get('/ems/cpd-summary')
      return data.data as CpdTeacher[]
    },
    enabled: canEnrollOthers,
  })

  const teacherOptions = cpdSummary.map(t => ({
    label: `${t.displayName} (${t.cpdHours}/${t.cpdTarget}h)`,
    value: t.id,
  }))

  const enrollMutation = useMutation({
    mutationFn: async ({ workshopId, teacherId }: { workshopId: string; teacherId?: string }) => {
      const body = teacherId ? { teacherId } : {}
      const { data } = await api.post(`/ems/cpd-workshops/${workshopId}/enroll`, body)
      return data
    },
    onSuccess: (res) => {
      message.success(res.message ?? 'Enrolled successfully!', 5)
      setEnrollModal({ open: false, workshop: null })
      setSelectedTeacherId(undefined)
      queryClient.invalidateQueries({ queryKey: ['cpd-workshops'] })
      queryClient.invalidateQueries({ queryKey: ['cpd-summary'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message ?? 'Enrollment failed.')
    },
  })

  const belowTarget = cpdSummary.filter(t => t.belowTarget)
  const atTarget = cpdSummary.filter(t => !t.belowTarget).length

  const handleEnroll = () => {
    if (!enrollModal.workshop) return
    enrollMutation.mutate({
      workshopId: enrollModal.workshop.id,
      teacherId: canEnrollOthers ? selectedTeacherId : undefined,
    })
  }

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <Award size={22} />
            <Title level={4} style={{ margin: 0 }}>CPD Workshops & Compliance</Title>
          </Space>
        </Col>
      </Row>

      {/* CPD compliance summary — only for admin/hod/principal */}
      {canEnrollOthers && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#52c41a' }}>{atTarget}</div>
                <div style={{ color: '#8c8c8c' }}>At CPD Target</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#ff4d4f' }}>{belowTarget.length}</div>
                <div style={{ color: '#8c8c8c' }}>Below Target</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#1677ff' }}>{workshops.length}</div>
                <div style={{ color: '#8c8c8c' }}>Open Workshops</div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Teachers below target — amber alert */}
      {canEnrollOthers && belowTarget.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${belowTarget.length} teacher${belowTarget.length > 1 ? 's' : ''} below CPD target:`}
          description={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {belowTarget.map(t => (
                <Tag key={t.id} color="orange">
                  {t.displayName} — {t.cpdHours}/{t.cpdTarget}h
                </Tag>
              ))}
            </div>
          }
        />
      )}

      {/* Workshop cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin indicator={<Loader2 size={32} className="spin-icon" />} />
          <div style={{ marginTop: 12, color: '#8c8c8c' }}>Loading workshops…</div>
        </div>
      ) : workshops.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>
            No open workshops available at this time.
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {workshops.map(w => (
            <Col key={w.id} xs={24} md={12} lg={8}>
              <Card
                style={{
                  border: w.alreadyEnrolled ? '2px solid #52c41a' : '1px solid #f0f0f0',
                  height: '100%',
                }}
                actions={[
                  w.alreadyEnrolled ? (
                    <Button type="text" icon={<CheckCircle2 size={16} color="#52c41a" />} disabled>
                      Enrolled
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      onClick={() => { setEnrollModal({ open: true, workshop: w }); setSelectedTeacherId(undefined) }}
                    >
                      {canEnrollOthers ? 'Enrol Teacher' : 'Enrol'}
                    </Button>
                  ),
                ]}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{w.title}</Text>
                    {w.subject && <Tag style={{ marginLeft: 8 }}>{w.subject}</Tag>}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {w.provider ?? 'MOE Professional Development Centre'}
                  </Text>
                  <Space>
                    <Tag icon={<Clock size={12} />} color="blue">{w.hours}h CPD</Tag>
                    <Tag icon={<Users size={12} />}>
                      {w.enrolledCount}/{w.maxParticipants} enrolled
                    </Tag>
                  </Space>
                  <div style={{ fontSize: 13, color: '#595959' }}>
                    <CalendarIcon /> {new Date(w.startDate).toLocaleDateString()} – {new Date(w.endDate).toLocaleDateString()}
                  </div>
                  {w.location && (
                    <Text type="secondary" style={{ fontSize: 12 }}>📍 {w.location}</Text>
                  )}
                  <Progress
                    percent={Math.round((w.enrolledCount / w.maxParticipants) * 100)}
                    size="small"
                    status={w.enrolledCount >= w.maxParticipants ? 'exception' : 'active'}
                    showInfo={false}
                  />
                  {w.enrolledCount >= w.maxParticipants && (
                    <Badge status="error" text="Full — contact admin" />
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Enrol Modal */}
      <Modal
        open={enrollModal.open}
        title={
          <Space>
            <BookOpen size={18} />
            <span>Enrol in Workshop</span>
          </Space>
        }
        onCancel={() => { setEnrollModal({ open: false, workshop: null }); setSelectedTeacherId(undefined) }}
        onOk={handleEnroll}
        okText="Confirm Enrolment"
        confirmLoading={enrollMutation.isPending}
        okButtonProps={{ disabled: canEnrollOthers && !selectedTeacherId && !isTeacher }}
      >
        {enrollModal.workshop && (
          <>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Workshop">{enrollModal.workshop.title}</Descriptions.Item>
              <Descriptions.Item label="CPD Hours">
                <Tag color="blue">{enrollModal.workshop.hours}h</Tag>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({(enrollModal.workshop.hours * 0.2).toFixed(1)}h pre-credited on enrolment)
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Date">
                {new Date(enrollModal.workshop.startDate).toLocaleDateString()} – {new Date(enrollModal.workshop.endDate).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label="Location">{enrollModal.workshop.location ?? 'TBC'}</Descriptions.Item>
            </Descriptions>

            {canEnrollOthers && (
              <>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Select Teacher to Enrol</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Select teacher..."
                  options={teacherOptions}
                  value={selectedTeacherId}
                  onChange={v => setSelectedTeacherId(v)}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  loading={loadingCpd}
                />
              </>
            )}

            <Alert
              type="info"
              showIcon
              style={{ marginTop: 16 }}
              message="On confirmation: teacher receives email confirmation, workshop dates are blocked in their schedule, and CPD hours are pre-credited."
            />
          </>
        )}
      </Modal>
    </div>
  )
}

// Inline calendar icon helper to avoid extra import
const CalendarIcon = () => <span style={{ marginRight: 4 }}>📅</span>

export default CpdWorkshopsPage
