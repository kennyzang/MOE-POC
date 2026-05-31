import { useState } from 'react'
import {
  Table, Tag, Button, Card, Row, Col, Typography, Space, Modal,
  Descriptions, Badge, Alert, Tooltip, message, Spin, Steps, Popover,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, UserCheck, Users, CheckCircle2, Loader2, Paperclip } from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import FileUploader from '../../components/FileUploader'
import FileList from '../../components/FileList'

const { Title, Text } = Typography

interface LeaveApplication {
  id: string
  teacherId: string
  leaveType: string
  startDate: string
  endDate: string
  daysRequested: number
  reason?: string
  status: string
  substituteId?: string
  teacher: { user: { displayName: string } }
}

interface SubstituteSuggestion {
  teacherId: string
  teacherName: string
  freeSlots: number
  totalSlots: number
  substituteCountTerm: number
  rankScore: number
  affectedSlotsDetail: Array<{ day: string; time: string; course: string }>
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  HOD_APPROVED: 'processing',
  PRINCIPAL_APPROVED: 'success',
  REJECTED: 'error',
}

const LeaveManagementPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedLeave, setSelectedLeave] = useState<LeaveApplication | null>(null)
  const [substituteModal, setSubstituteModal] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const canApprove = ['admin', 'manager', 'hod', 'principal'].includes(user?.role ?? '')
  const canAssignSubstitute = ['admin', 'manager', 'principal'].includes(user?.role ?? '')

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['leave-applications'],
    queryFn: async () => {
      const { data } = await api.get('/ems/leave-applications')
      return data.data as LeaveApplication[]
    },
    refetchInterval: 15000,
  })

  const { data: suggestions = [], isLoading: loadingSuggestions } = useQuery({
    queryKey: ['substitute-suggestions', selectedLeave?.id],
    queryFn: async () => {
      if (!selectedLeave?.id) return []
      const { data } = await api.get(`/ems/leave-applications/${selectedLeave.id}/substitute-suggestions`)
      return data.data as SubstituteSuggestion[]
    },
    enabled: !!selectedLeave?.id && substituteModal,
  })

  const approveMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) => {
      const { data } = await api.post(`/ems/leave-applications/${id}/approve`, { decision })
      return data
    },
    onSuccess: (_, { decision }) => {
      message.success(decision === 'APPROVE' ? 'Leave approved. Substitute assignment may now proceed.' : 'Leave rejected.')
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] })
    },
    onError: () => message.error('Action failed. Please try again.'),
  })

  const assignMutation = useMutation({
    mutationFn: async ({ leaveId, substituteTeacherId }: { leaveId: string; substituteTeacherId: string }) => {
      const { data } = await api.post(`/ems/leave-applications/${leaveId}/assign-substitute`, { substituteTeacherId })
      return data
    },
    onSuccess: (res) => {
      const cascade = res.cascade
      message.success(
        `Substitute assigned. ${cascade?.affectedStudents ?? 0} students and ${cascade?.affectedParentsNotified ?? 0} parents notified.`,
        6,
      )
      setSubstituteModal(false)
      setSelectedLeave(null)
      setAssigningId(null)
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] })
    },
    onError: () => { message.error('Assignment failed.'); setAssigningId(null) },
  })

  const columns: ColumnsType<LeaveApplication> = [
    {
      title: 'Teacher',
      render: (_, r) => <Text strong>{r.teacher?.user?.displayName}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'leaveType',
      render: t => <Tag>{t}</Tag>,
      width: 110,
    },
    {
      title: 'Period',
      render: (_, r) => (
        <span>
          {new Date(r.startDate).toLocaleDateString()} → {new Date(r.endDate).toLocaleDateString()}
          <Text type="secondary" style={{ marginLeft: 6 }}>({r.daysRequested}d)</Text>
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: s => <Badge status={STATUS_COLOR[s] as any ?? 'default'} text={s.replace(/_/g, ' ')} />,
      width: 160,
    },
    {
      title: 'Substitute',
      dataIndex: 'substituteId',
      render: v => v ? <Tag color="success" icon={<CheckCircle2 size={12} />}>Assigned</Tag> : <Tag color="warning">Pending</Tag>,
      width: 110,
    },
    {
      title: 'Documents',
      key: 'documents',
      width: 130,
      render: (_, record) => (
        <Popover
          trigger="click"
          title={
            <Space>
              <Paperclip size={13} />
              Supporting Documents
            </Space>
          }
          content={
            <div style={{ width: 300 }}>
              <div style={{ marginBottom: 8 }}>
                <FileUploader
                  entityType="leave_application"
                  entityId={record.id}
                  accept=".pdf,.jpg,.jpeg,.png"
                  label="Attach (e.g. medical cert)"
                  description="Supporting document"
                />
              </div>
              <FileList entityType="leave_application" entityId={record.id} canDelete />
            </div>
          }
        >
          <Button size="small" icon={<Paperclip size={13} />}>
            Docs
          </Button>
        </Popover>
      ),
    },
    {
      title: 'Actions',
      width: 260,
      render: (_, record) => (
        <Space size={6}>
          {canApprove && record.status === 'PENDING' && (
            <>
              <Button
                size="small" type="primary"
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id: record.id, decision: 'APPROVE' })}
              >
                Approve
              </Button>
              <Button
                size="small" danger
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id: record.id, decision: 'REJECT' })}
              >
                Reject
              </Button>
            </>
          )}
          {canAssignSubstitute && record.status === 'HOD_APPROVED' && !record.substituteId && (
            <Button
              size="small" type="primary" ghost
              icon={<UserCheck size={14} />}
              onClick={() => { setSelectedLeave(record); setSubstituteModal(true) }}
            >
              Assign Substitute
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const pendingCount = leaves.filter(l => l.status === 'PENDING').length
  const approvedCount = leaves.filter(l => l.status === 'HOD_APPROVED').length
  const needsSubstitute = leaves.filter(l => l.status === 'HOD_APPROVED' && !l.substituteId).length

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <CalendarDays size={22} />
            <Title level={4} style={{ margin: 0 }}>Leave & Substitute Management</Title>
          </Space>
        </Col>
      </Row>

      {needsSubstitute > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${needsSubstitute} approved leave${needsSubstitute > 1 ? 's' : ''} still need${needsSubstitute === 1 ? 's' : ''} a substitute assignment.`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#faad14' }}>{pendingCount}</div>
              <div style={{ color: '#8c8c8c' }}>Pending Approval</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>{approvedCount}</div>
              <div style={{ color: '#8c8c8c' }}>HOD Approved</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ff4d4f' }}>{needsSubstitute}</div>
              <div style={{ color: '#8c8c8c' }}>Needs Substitute</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>
                {leaves.filter(l => l.status === 'PRINCIPAL_APPROVED').length}
              </div>
              <div style={{ color: '#8c8c8c' }}>Fully Approved</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card>
        <Table<LeaveApplication>
          rowKey="id"
          columns={columns}
          dataSource={leaves}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>

      {/* Substitute Assignment Modal */}
      <Modal
        open={substituteModal}
        title={
          <Space>
            <Users size={18} />
            <span>Assign Substitute — {selectedLeave?.teacher?.user?.displayName}</span>
          </Space>
        }
        onCancel={() => { setSubstituteModal(false); setSelectedLeave(null); setAssigningId(null) }}
        footer={null}
        width={720}
      >
        {selectedLeave && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Leave Period">
                {new Date(selectedLeave.startDate).toLocaleDateString()} – {new Date(selectedLeave.endDate).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label="Days">{selectedLeave.daysRequested}</Descriptions.Item>
              <Descriptions.Item label="Type">{selectedLeave.leaveType}</Descriptions.Item>
              <Descriptions.Item label="Reason">{selectedLeave.reason ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 12 }}>
              Ranked Substitute Candidates
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
                Ranked by availability × fairness
              </Text>
            </Title>

            {loadingSuggestions ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <Spin indicator={<Loader2 size={28} className="spin-icon" />} />
                <div style={{ marginTop: 8, color: '#8c8c8c' }}>Querying EMS availability + timetable…</div>
              </div>
            ) : suggestions.length === 0 ? (
              <Alert type="info" message="No available substitutes found for the affected periods." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestions.map((s, idx) => (
                  <Card
                    key={s.teacherId}
                    size="small"
                    style={{
                      border: idx === 0 ? '2px solid #1677ff' : '1px solid #f0f0f0',
                      background: idx === 0 ? '#f0f7ff' : undefined,
                    }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space>
                          <Tag color={idx === 0 ? 'blue' : 'default'}>Rank #{idx + 1}</Tag>
                          <Text strong>{s.teacherName}</Text>
                          <Text type="secondary">
                            Free {s.freeSlots}/{s.totalSlots} affected periods
                          </Text>
                        </Space>
                        <div style={{ marginTop: 6 }}>
                          {s.affectedSlotsDetail.map((d, i) => (
                            <Tag key={i} style={{ marginBottom: 4 }}>
                              {d.day} {d.time} — {d.course}
                            </Tag>
                          ))}
                        </div>
                      </Col>
                      <Col>
                        <Tooltip title={idx === 0 ? 'Recommended by system' : ''}>
                          <Button
                            type={idx === 0 ? 'primary' : 'default'}
                            loading={assignMutation.isPending && assigningId === s.teacherId}
                            onClick={() => {
                              setAssigningId(s.teacherId)
                              assignMutation.mutate({ leaveId: selectedLeave.id, substituteTeacherId: s.teacherId })
                            }}
                          >
                            {idx === 0 ? 'Assign (Recommended)' : 'Assign'}
                          </Button>
                        </Tooltip>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </div>
            )}

            <Alert
              type="info"
              showIcon
              style={{ marginTop: 16 }}
              message="On confirmation: substitute teacher + all affected students and parents will be notified automatically."
            />
          </>
        )}
      </Modal>
    </div>
  )
}

export default LeaveManagementPage
