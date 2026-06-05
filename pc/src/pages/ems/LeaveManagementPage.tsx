import { useState } from 'react'
import {
  Table, Tag, Button, Card, Row, Col, Typography, Space, Modal,
  Descriptions, Alert, Tooltip, message, Spin, Steps, Timeline,
  Popconfirm, Input, Select, DatePicker, Popover,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays, UserCheck, Users, CheckCircle2, Loader2, Paperclip,
  XCircle, Clock, Eye,
} from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import FileUploader from '../../components/FileUploader'
import FileList from '../../components/FileList'

const { Title, Text } = Typography
const { TextArea } = Input

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
  hodApproverId?: string
  hodApprovedAt?: string
  hodRemarks?: string
  principalApproverId?: string
  principalApprovedAt?: string
  principalRemarks?: string
  cancellationReason?: string
  cancelledAt?: string
  documentUrl?: string
  createdAt: string
  teacher: { user: { displayName: string } }
}

interface SubstituteSuggestion {
  teacherId: string
  teacherName: string
  freeSlots: number
  totalSlots: number
  rankScore: number
  affectedSlotsDetail: Array<{ day: string; time: string; course: string }>
}

const STATUS_STEPS: Record<string, number> = {
  PENDING:            0,
  HOD_APPROVED:       1,
  PRINCIPAL_APPROVED: 2,
  REJECTED:           -1,
  CANCELLED:          -2,
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:            'default',
  HOD_APPROVED:       'processing',
  PRINCIPAL_APPROVED: 'success',
  REJECTED:           'error',
  CANCELLED:          'warning',
}

const LeaveManagementPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [selectedLeave, setSelectedLeave] = useState<LeaveApplication | null>(null)
  const [substituteModal, setSubstituteModal] = useState(false)
  const [timelineModal, setTimelineModal]     = useState(false)
  const [cancelModal, setCancelModal]         = useState(false)
  const [cancelReason, setCancelReason]       = useState('')
  const [assigningId, setAssigningId]         = useState<string | null>(null)
  const [filterStatus, setFilterStatus]       = useState<string | undefined>()

  const canApproveHod       = ['admin', 'manager', 'hod'].includes(user?.role ?? '')
  const canApprovePrincipal = ['admin', 'manager', 'principal'].includes(user?.role ?? '')
  const canAssignSub        = ['admin', 'manager', 'principal'].includes(user?.role ?? '')
  const isTeacher           = user?.role === 'teacher'

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['leave-applications', filterStatus],
    queryFn: async () => {
      const { data } = await api.get('/ems/leave-applications', {
        params: filterStatus ? { status: filterStatus } : {},
      })
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

  const hodApproveMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) => {
      const { data } = await api.post(`/ems/leave-applications/${id}/approve`, { decision })
      return data
    },
    onSuccess: (_, { decision }) => {
      message.success(decision === 'APPROVE' ? t('leave.hodApproved', 'HOD approved. Awaiting Principal.') : t('leave.rejected', 'Leave rejected.'))
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] })
    },
    onError: () => message.error(t('common.actionFailed', 'Action failed')),
  })

  const principalApproveMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) => {
      const { data } = await api.patch(`/leave/${id}/principal-approve`, { decision })
      return data
    },
    onSuccess: (_, { decision }) => {
      message.success(decision === 'APPROVE' ? t('leave.finallyApproved', 'Leave finally approved') : t('leave.rejected', 'Leave rejected'))
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] })
    },
    onError: () => message.error(t('common.actionFailed', 'Action failed')),
  })

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await api.patch(`/leave/${id}/cancel`, { cancellationReason: reason })
      return data
    },
    onSuccess: () => {
      message.success(t('leave.cancelled', 'Leave cancelled'))
      setCancelModal(false)
      setCancelReason('')
      setSelectedLeave(null)
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] })
    },
    onError: () => message.error(t('common.actionFailed', 'Action failed')),
  })

  const assignMutation = useMutation({
    mutationFn: async ({ leaveId, substituteTeacherId }: { leaveId: string; substituteTeacherId: string }) => {
      const { data } = await api.post(`/ems/leave-applications/${leaveId}/assign-substitute`, { substituteTeacherId })
      return data
    },
    onSuccess: (res) => {
      const cascade = res.cascade
      message.success(
        `${t('leave.substituteAssigned', 'Substitute assigned.')} ${cascade?.affectedStudents ?? 0} students, ${cascade?.affectedParentsNotified ?? 0} parents notified.`,
        6,
      )
      setSubstituteModal(false)
      setSelectedLeave(null)
      setAssigningId(null)
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] })
    },
    onError: () => { message.error(t('leave.assignFailed', 'Assignment failed')); setAssigningId(null) },
  })

  const columns: ColumnsType<LeaveApplication> = [
    {
      title: t('leave.teacher', 'Teacher'),
      render: (_, r) => <Text strong>{r.teacher?.user?.displayName}</Text>,
    },
    {
      title: t('leave.type', 'Type'),
      dataIndex: 'leaveType',
      render: lt => <Tag>{lt}</Tag>,
      width: 120,
    },
    {
      title: t('leave.period', 'Period'),
      render: (_, r) => (
        <span>
          {new Date(r.startDate).toLocaleDateString()} → {new Date(r.endDate).toLocaleDateString()}
          <Text type="secondary" style={{ marginLeft: 6 }}>({r.daysRequested}d)</Text>
        </span>
      ),
    },
    {
      title: t('leave.status', 'Status'),
      dataIndex: 'status',
      width: 170,
      render: s => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: t('leave.substitute', 'Substitute'),
      dataIndex: 'substituteId',
      render: v => v
        ? <Tag color="success" icon={<CheckCircle2 size={12} />}>{t('leave.assigned', 'Assigned')}</Tag>
        : <Tag color="warning">{t('leave.pending', 'Pending')}</Tag>,
      width: 110,
    },
    {
      title: t('leave.actions', 'Actions'),
      width: 280,
      render: (_, record) => (
        <Space size={4} wrap>
          {/* View Timeline */}
          <Tooltip title={t('leave.viewTimeline', 'View Status Timeline')}>
            <Button
              size="small"
              icon={<Eye size={13} />}
              onClick={() => { setSelectedLeave(record); setTimelineModal(true) }}
            />
          </Tooltip>

          {/* Documents */}
          <Popover
            trigger="click"
            title={<Space><Paperclip size={13} />{t('leave.supportingDocs', 'Supporting Documents')}</Space>}
            content={
              <div style={{ width: 300 }}>
                <div style={{ marginBottom: 8 }}>
                  <FileUploader
                    entityType="leave_application"
                    entityId={record.id}
                    accept=".pdf,.jpg,.jpeg,.png"
                    label={t('leave.attachDoc', 'Attach document')}
                    description={t('leave.supportingDoc', 'Supporting document')}
                  />
                </div>
                <FileList entityType="leave_application" entityId={record.id} canDelete />
              </div>
            }
          >
            <Button size="small" icon={<Paperclip size={13} />}>{t('leave.docs', 'Docs')}</Button>
          </Popover>

          {/* HOD Approve */}
          {canApproveHod && record.status === 'PENDING' && (
            <>
              <Button
                size="small" type="primary"
                loading={hodApproveMutation.isPending}
                onClick={() => hodApproveMutation.mutate({ id: record.id, decision: 'APPROVE' })}
              >
                {t('leave.hodApprove', 'HOD Approve')}
              </Button>
              <Button
                size="small" danger
                loading={hodApproveMutation.isPending}
                onClick={() => hodApproveMutation.mutate({ id: record.id, decision: 'REJECT' })}
              >
                {t('leave.reject', 'Reject')}
              </Button>
            </>
          )}

          {/* Principal Approve */}
          {canApprovePrincipal && record.status === 'HOD_APPROVED' && (
            <>
              <Button
                size="small" type="primary"
                loading={principalApproveMutation.isPending}
                onClick={() => principalApproveMutation.mutate({ id: record.id, decision: 'APPROVE' })}
              >
                {t('leave.principalApprove', 'Final Approve')}
              </Button>
              <Button
                size="small" danger
                loading={principalApproveMutation.isPending}
                onClick={() => principalApproveMutation.mutate({ id: record.id, decision: 'REJECT' })}
              >
                {t('leave.reject', 'Reject')}
              </Button>
            </>
          )}

          {/* Assign Substitute */}
          {canAssignSub && record.status === 'HOD_APPROVED' && !record.substituteId && (
            <Button
              size="small" type="primary" ghost
              icon={<UserCheck size={14} />}
              onClick={() => { setSelectedLeave(record); setSubstituteModal(true) }}
            >
              {t('leave.assignSub', 'Assign Sub')}
            </Button>
          )}

          {/* Cancel */}
          {(isTeacher || canAssignSub) &&
            !['CANCELLED', 'REJECTED', 'PRINCIPAL_APPROVED'].includes(record.status) && (
            <Button
              size="small" danger ghost
              icon={<XCircle size={13} />}
              onClick={() => { setSelectedLeave(record); setCancelModal(true) }}
            >
              {t('leave.cancel', 'Cancel')}
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const pendingCount    = leaves.filter(l => l.status === 'PENDING').length
  const hodApproved     = leaves.filter(l => l.status === 'HOD_APPROVED').length
  const finalApproved   = leaves.filter(l => l.status === 'PRINCIPAL_APPROVED').length
  const needsSub        = leaves.filter(l => l.status === 'HOD_APPROVED' && !l.substituteId).length

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <CalendarDays size={22} />
            <Title level={4} style={{ margin: 0 }}>{t('leave.leaveManagement', 'Leave & Substitute Management')}</Title>
          </Space>
        </Col>
        <Col>
          <Select
            allowClear
            placeholder={t('leave.filterStatus', 'Filter by status')}
            style={{ width: 200 }}
            onChange={setFilterStatus}
            options={[
              { value: 'PENDING',            label: 'Pending' },
              { value: 'HOD_APPROVED',       label: 'HOD Approved' },
              { value: 'PRINCIPAL_APPROVED', label: 'Fully Approved' },
              { value: 'REJECTED',           label: 'Rejected' },
              { value: 'CANCELLED',          label: 'Cancelled' },
            ]}
          />
        </Col>
      </Row>

      {needsSub > 0 && (
        <Alert
          type="warning" showIcon
          message={t('leave.needsSubAlert', '{{count}} approved leave(s) still need a substitute assignment.', { count: needsSub })}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          { label: t('leave.pendingApproval', 'Pending Approval'), value: pendingCount, color: '#faad14' },
          { label: t('leave.hodApproved', 'HOD Approved'),         value: hodApproved,  color: '#1677ff' },
          { label: t('leave.needsSub', 'Needs Substitute'),        value: needsSub,     color: '#ff4d4f' },
          { label: t('leave.fullyApproved', 'Fully Approved'),     value: finalApproved, color: '#52c41a' },
        ].map(stat => (
          <Col key={stat.label} xs={12} md={6}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ color: '#8c8c8c', fontSize: 12 }}>{stat.label}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Table<LeaveApplication>
          rowKey="id"
          columns={columns}
          dataSource={leaves}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: t('common.noData') }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Timeline Modal */}
      <Modal
        open={timelineModal}
        title={
          <Space>
            <Clock size={18} />
            <span>{t('leave.statusTimeline', 'Leave Status Timeline')}</span>
          </Space>
        }
        onCancel={() => { setTimelineModal(false); setSelectedLeave(null) }}
        footer={<Button onClick={() => { setTimelineModal(false); setSelectedLeave(null) }}>{t('common.close', 'Close')}</Button>}
        width={560}
      >
        {selectedLeave && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label={t('leave.teacher', 'Teacher')}>
                {selectedLeave.teacher?.user?.displayName}
              </Descriptions.Item>
              <Descriptions.Item label={t('leave.type', 'Type')}>
                <Tag>{selectedLeave.leaveType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('leave.period', 'Period')}>
                {new Date(selectedLeave.startDate).toLocaleDateString()} – {new Date(selectedLeave.endDate).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('leave.days', 'Days')}>
                {selectedLeave.daysRequested}
              </Descriptions.Item>
              {selectedLeave.reason && (
                <Descriptions.Item label={t('leave.reason', 'Reason')} span={2}>
                  {selectedLeave.reason}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Steps
              current={Math.max(0, STATUS_STEPS[selectedLeave.status] ?? 0)}
              status={selectedLeave.status === 'REJECTED' || selectedLeave.status === 'CANCELLED' ? 'error' : 'process'}
              items={[
                { title: t('leave.submitted', 'Submitted'),            description: new Date(selectedLeave.createdAt).toLocaleDateString() },
                { title: t('leave.hodReview', 'HOD Review'),           description: selectedLeave.hodApprovedAt ? new Date(selectedLeave.hodApprovedAt).toLocaleDateString() : '—' },
                { title: t('leave.principalReview', 'Principal'),       description: selectedLeave.principalApprovedAt ? new Date(selectedLeave.principalApprovedAt).toLocaleDateString() : '—' },
              ]}
              style={{ marginBottom: 16 }}
            />

            <Timeline
              items={[
                {
                  color: 'blue',
                  children: (
                    <div>
                      <Text strong>{t('leave.submitted', 'Application Submitted')}</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        {new Date(selectedLeave.createdAt).toLocaleString()}
                      </Text>
                    </div>
                  ),
                },
                ...(selectedLeave.hodApprovedAt ? [{
                  color: selectedLeave.status === 'REJECTED' && !selectedLeave.principalApprovedAt ? 'red' : 'green',
                  children: (
                    <div>
                      <Text strong>
                        {selectedLeave.hodRemarks
                          ? t('leave.hodRejected', 'Rejected by HOD')
                          : t('leave.hodApproved', 'Approved by HOD')}
                      </Text>
                      {selectedLeave.hodRemarks && (
                        <Text type="danger" style={{ display: 'block', fontSize: 12 }}>
                          {t('leave.reason', 'Reason')}: {selectedLeave.hodRemarks}
                        </Text>
                      )}
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        {new Date(selectedLeave.hodApprovedAt).toLocaleString()}
                      </Text>
                    </div>
                  ),
                }] : []),
                ...(selectedLeave.principalApprovedAt ? [{
                  color: selectedLeave.status === 'REJECTED' ? 'red' : 'green',
                  children: (
                    <div>
                      <Text strong>
                        {selectedLeave.principalRemarks && selectedLeave.status === 'REJECTED'
                          ? t('leave.principalRejected', 'Rejected by Principal')
                          : t('leave.finalApproved', 'Approved by Principal')}
                      </Text>
                      {selectedLeave.principalRemarks && (
                        <Text type={selectedLeave.status === 'REJECTED' ? 'danger' : 'secondary'} style={{ display: 'block', fontSize: 12 }}>
                          {t('leave.remarks', 'Remarks')}: {selectedLeave.principalRemarks}
                        </Text>
                      )}
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        {new Date(selectedLeave.principalApprovedAt).toLocaleString()}
                      </Text>
                    </div>
                  ),
                }] : []),
                ...(selectedLeave.cancelledAt ? [{
                  color: 'orange',
                  children: (
                    <div>
                      <Text strong>{t('leave.cancelled', 'Cancelled')}</Text>
                      {selectedLeave.cancellationReason && (
                        <Text type="warning" style={{ display: 'block', fontSize: 12 }}>
                          {t('leave.reason', 'Reason')}: {selectedLeave.cancellationReason}
                        </Text>
                      )}
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        {new Date(selectedLeave.cancelledAt).toLocaleString()}
                      </Text>
                    </div>
                  ),
                }] : []),
              ]}
            />
          </>
        )}
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={cancelModal}
        title={<Space><XCircle size={18} /><span>{t('leave.cancelLeave', 'Cancel Leave Application')}</span></Space>}
        onCancel={() => { setCancelModal(false); setCancelReason(''); setSelectedLeave(null) }}
        footer={null}
        width={440}
      >
        <Alert
          type="warning"
          showIcon
          message={t('leave.cancelWarning', 'Cancelling an approved leave will restore the balance and notify approvers.')}
          style={{ marginBottom: 16 }}
        />
        <TextArea
          rows={3}
          placeholder={t('leave.cancelReasonPlaceholder', 'Reason for cancellation (optional)')}
          value={cancelReason}
          onChange={e => setCancelReason(e.target.value)}
          maxLength={300}
          showCount
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <Button onClick={() => { setCancelModal(false); setCancelReason(''); setSelectedLeave(null) }}>
            {t('common.back', 'Back')}
          </Button>
          <Popconfirm
            title={t('leave.confirmCancel', 'Confirm cancellation?')}
            onConfirm={() => selectedLeave && cancelMutation.mutate({ id: selectedLeave.id, reason: cancelReason })}
            okText={t('leave.yesCancel', 'Yes, Cancel')}
            cancelText={t('common.no', 'No')}
          >
            <Button danger loading={cancelMutation.isPending}>
              {t('leave.confirmCancelBtn', 'Cancel Application')}
            </Button>
          </Popconfirm>
        </div>
      </Modal>

      {/* Substitute Modal */}
      <Modal
        open={substituteModal}
        title={<Space><Users size={18} /><span>{t('leave.assignSub', 'Assign Substitute')} — {selectedLeave?.teacher?.user?.displayName}</span></Space>}
        onCancel={() => { setSubstituteModal(false); setSelectedLeave(null); setAssigningId(null) }}
        footer={null}
        width={720}
      >
        {selectedLeave && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label={t('leave.period', 'Period')}>
                {new Date(selectedLeave.startDate).toLocaleDateString()} – {new Date(selectedLeave.endDate).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('leave.days', 'Days')}>{selectedLeave.daysRequested}</Descriptions.Item>
              <Descriptions.Item label={t('leave.type', 'Type')}>{selectedLeave.leaveType}</Descriptions.Item>
              <Descriptions.Item label={t('leave.reason', 'Reason')}>{selectedLeave.reason ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 12 }}>
              {t('leave.rankedCandidates', 'Ranked Substitute Candidates')}
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
                {t('leave.rankedNote', 'Ranked by availability × fairness')}
              </Text>
            </Title>

            {loadingSuggestions ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <Spin indicator={<Loader2 size={28} />} />
                <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                  {t('leave.queryingAvailability', 'Querying EMS availability + timetable…')}
                </div>
              </div>
            ) : suggestions.length === 0 ? (
              <Alert type="info" message={t('leave.noSubstitutes', 'No available substitutes found for the affected periods.')} />
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
                          <Tag color={idx === 0 ? 'blue' : 'default'}>#{idx + 1}</Tag>
                          <Text strong>{s.teacherName}</Text>
                          <Text type="secondary">{t('leave.freeSlots', 'Free {{free}}/{{total}} periods', { free: s.freeSlots, total: s.totalSlots })}</Text>
                        </Space>
                        <div style={{ marginTop: 6 }}>
                          {s.affectedSlotsDetail.map((d, i) => (
                            <Tag key={i} style={{ marginBottom: 4 }}>{d.day} {d.time} — {d.course}</Tag>
                          ))}
                        </div>
                      </Col>
                      <Col>
                        <Tooltip title={idx === 0 ? t('leave.recommended', 'Recommended by system') : ''}>
                          <Button
                            type={idx === 0 ? 'primary' : 'default'}
                            loading={assignMutation.isPending && assigningId === s.teacherId}
                            onClick={() => {
                              setAssigningId(s.teacherId)
                              assignMutation.mutate({ leaveId: selectedLeave.id, substituteTeacherId: s.teacherId })
                            }}
                          >
                            {idx === 0 ? t('leave.assignRecommended', 'Assign (Recommended)') : t('leave.assign', 'Assign')}
                          </Button>
                        </Tooltip>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </div>
            )}
            <Alert
              type="info" showIcon style={{ marginTop: 16 }}
              message={t('leave.assignNotice', 'On confirmation: substitute + all affected students and parents will be notified automatically.')}
            />
          </>
        )}
      </Modal>
    </div>
  )
}

export default LeaveManagementPage
