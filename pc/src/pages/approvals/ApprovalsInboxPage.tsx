import { useState } from 'react'
import {
  Card, Typography, Space, Button, Tag, Empty, Spin, Modal, Input, message,
  Badge, Tabs, Divider, Drawer, Descriptions, Table, Timeline,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircle, XCircle, Clock, DollarSign, FileEdit, BookOpen,
  ChevronRight, Eye, History,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface ApprovalRequest {
  id: string
  entityType: 'SchoolExpense' | 'GradeAmendment' | 'LeaveApplication'
  entityId: string
  requestedBy: string
  currentLevel: number
  levelsRequired: number
  status: string
  metadata: string | null
  entitySummary: string
  requesterName: string
  createdAt: string
  level1ApproverId: string | null
  level2ApproverId: string | null
  level1ApprovedAt?: string | null
  level2ApprovedAt?: string | null
  level1Remarks?: string | null
  level2Remarks?: string | null
  rejectedBy?: string | null
  rejectedAt?: string | null
  rejectionReason?: string | null
  // enriched
  level1Name?: string | null
  level2Name?: string | null
  rejectedByName?: string | null
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function EntityIcon({ type }: { type: string }) {
  if (type === 'SchoolExpense') return <DollarSign size={16} color="#2E5A8E" />
  if (type === 'GradeAmendment') return <BookOpen size={16} color="#7D5A00" />
  return <FileEdit size={16} color="#1A6B3A" />
}

function RoutingPath({ levelsRequired, currentLevel, status }: { levelsRequired: number; currentLevel: number; status: string }) {
  const step1Done = !['PENDING'].includes(status)
  const fullyDone = status === 'FULLY_APPROVED'
  const rejected = status === 'REJECTED'
  return (
    <Space size={4} style={{ fontSize: 11 }}>
      <Tag
        color={rejected ? 'error' : step1Done ? 'success' : currentLevel === 1 ? 'processing' : 'default'}
        style={{ fontSize: 10 }}
      >HOD</Tag>
      {levelsRequired > 1 && (
        <>
          <ChevronRight size={10} color="#bbb" />
          <Tag
            color={rejected ? 'default' : fullyDone ? 'success' : currentLevel === 2 ? 'processing' : 'default'}
            style={{ fontSize: 10 }}
          >Principal</Tag>
        </>
      )}
    </Space>
  )
}

// ─── Detail Drawer ───────────────────────────────────────────────

function DetailDrawer({ requestId, open, onClose, onApprove, onReject, canAct }: {
  requestId: string | null
  open: boolean
  onClose: () => void
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  canAct?: boolean
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['approval-detail', requestId],
    queryFn: async () => {
      const res = await api.get(`/approvals/${requestId}/detail`)
      return res.data.data as ApprovalRequest & { entity: any }
    },
    enabled: !!requestId && open,
  })

  const req = data
  const meta = req ? parseMetadata(req.metadata) : {}

  const auditItems = []
  if (req) {
    auditItems.push({ dot: <Clock size={12} />, children: <Text style={{ fontSize: 12 }}>Submitted by <strong>{req.requesterName}</strong> · {new Date(req.createdAt).toLocaleString()}</Text> })
    if (req.level1Name && req.level1ApprovedAt) {
      auditItems.push({ color: 'green', children: <Text style={{ fontSize: 12 }}>HOD approved by <strong>{req.level1Name}</strong> · {new Date(req.level1ApprovedAt).toLocaleString()}{req.level1Remarks ? ` — "${req.level1Remarks}"` : ''}</Text> })
    }
    if (req.level2Name && req.level2ApprovedAt) {
      auditItems.push({ color: 'green', children: <Text style={{ fontSize: 12 }}>Principal approved by <strong>{req.level2Name}</strong> · {new Date(req.level2ApprovedAt).toLocaleString()}{req.level2Remarks ? ` — "${req.level2Remarks}"` : ''}</Text> })
    }
    if (req.status === 'REJECTED' && req.rejectedAt) {
      auditItems.push({ color: 'red', children: <Text style={{ fontSize: 12 }}>Rejected by <strong>{req.rejectedByName ?? 'Unknown'}</strong> · {new Date(req.rejectedAt).toLocaleString()}{req.rejectionReason ? ` — "${req.rejectionReason}"` : ''}</Text> })
    }
    if (req.status === 'FULLY_APPROVED') {
      auditItems.push({ color: 'green', dot: <CheckCircle size={12} />, children: <Text style={{ fontSize: 12 }}>Request fully approved</Text> })
    }
    if (req.status === 'LEVEL1_APPROVED' && !req.level2Name) {
      auditItems.push({ color: 'orange', children: <Text style={{ fontSize: 12 }}>Awaiting Principal approval</Text> })
    }
    if (req.status === 'PENDING') {
      auditItems.push({ color: 'blue', children: <Text style={{ fontSize: 12 }}>Awaiting HOD approval</Text> })
    }
  }

  return (
    <Drawer
      title={
        <Space>
          {req && <EntityIcon type={req.entityType} />}
          <span>{req?.entityType ?? 'Approval Request'} — Detail</span>
          {req && (
            <Tag color={req.status === 'FULLY_APPROVED' ? 'success' : req.status === 'REJECTED' ? 'error' : 'processing'}>
              {req.status}
            </Tag>
          )}
        </Space>
      }
      open={open}
      onClose={onClose}
      width={580}
      extra={
        canAct && req && ['PENDING', 'LEVEL1_APPROVED'].includes(req.status) ? (
          <Space>
            <Button
              size="small"
              type="primary"
              icon={<CheckCircle size={12} />}
              style={{ background: '#1A6B3A', borderColor: '#1A6B3A' }}
              onClick={() => { onApprove?.(req.id); onClose() }}
            >Approve</Button>
            <Button
              size="small"
              danger
              icon={<XCircle size={12} />}
              onClick={() => { onReject?.(req.id); onClose() }}
            >Reject</Button>
          </Space>
        ) : null
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      ) : !req ? (
        <Empty description="Request not found" />
      ) : (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          {/* Submitter / routing */}
          <Card size="small" title="Request Overview">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Type">
                <Tag>{req.entityType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={req.status === 'FULLY_APPROVED' ? 'success' : req.status === 'REJECTED' ? 'error' : 'processing'}>
                  {req.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Submitted By">{req.requesterName}</Descriptions.Item>
              <Descriptions.Item label="Submitted">{new Date(req.createdAt).toLocaleDateString()}</Descriptions.Item>
              <Descriptions.Item label="Approval Route" span={2}>
                <RoutingPath levelsRequired={req.levelsRequired} currentLevel={req.currentLevel} status={req.status} />
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Entity-specific details */}
          {req.entityType === 'SchoolExpense' && (
            <Card size="small" title="Expense Details">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Category">{(req.entity?.category ?? meta.category ?? '-') as string}</Descriptions.Item>
                <Descriptions.Item label="Amount">
                  <Text strong style={{ color: '#2E5A8E' }}>
                    BND {Number(req.entity?.amount ?? meta.amount ?? 0).toFixed(2)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                  {(req.entity?.description ?? meta.description ?? '-') as string}
                </Descriptions.Item>
                <Descriptions.Item label="Date">
                  {req.entity?.date ? new Date(req.entity.date).toLocaleDateString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Expense Status">
                  <Tag color={req.entity?.status === 'approved' ? 'success' : 'default'}>{req.entity?.status ?? '-'}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {req.entityType === 'GradeAmendment' && (
            <Card size="small" title="Grade Amendment Details">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Original Score">{req.entity?.originalScore ?? meta.originalScore ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Proposed Score">
                  <Text strong>{req.entity?.proposedScore ?? meta.proposedScore ?? '-'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Reason" span={2}>
                  {(req.entity?.reason ?? meta.reason ?? '-') as string}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {/* Approval trail */}
          <Card size="small" title="Approval Trail">
            <Timeline items={auditItems} />
          </Card>
        </Space>
      )}
    </Drawer>
  )
}

// ─── History Table ───────────────────────────────────────────────

function HistoryTab() {
  const { data, isLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ['approvals-history'],
    queryFn: async () => {
      const res = await api.get('/approvals/history')
      return res.data.data ?? []
    },
  })

  const [viewingId, setViewingId] = useState<string | null>(null)

  const columns: ColumnsType<ApprovalRequest> = [
    {
      title: 'Type',
      dataIndex: 'entityType',
      width: 150,
      render: (val: string) => (
        <Space size={4}>
          <EntityIcon type={val} />
          <Text style={{ fontSize: 12 }}>{val}</Text>
        </Space>
      ),
    },
    { title: 'Description', dataIndex: 'entitySummary', render: (v) => v || '-' },
    { title: 'Submitted By', dataIndex: 'requesterName', width: 140 },
    {
      title: 'Decision',
      dataIndex: 'status',
      width: 130,
      render: (val: string) => (
        <Tag color={val === 'FULLY_APPROVED' ? 'success' : 'error'}>
          {val === 'FULLY_APPROVED' ? 'Approved' : 'Rejected'}
        </Tag>
      ),
    },
    {
      title: 'Decided By',
      width: 140,
      render: (_, r) => r.level2Name ?? r.level1Name ?? r.rejectedByName ?? '-',
    },
    {
      title: 'Date',
      width: 110,
      render: (_, r) => {
        const d = r.level2ApprovedAt ?? r.level1ApprovedAt ?? r.rejectedAt ?? r.createdAt
        return d ? new Date(d).toLocaleDateString() : '-'
      },
    },
    {
      title: '',
      width: 80,
      render: (_, r) => (
        <Button size="small" icon={<Eye size={13} />} onClick={() => setViewingId(r.id)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="No approval history yet" /> }}
      />
      <DetailDrawer requestId={viewingId} open={!!viewingId} onClose={() => setViewingId(null)} />
    </div>
  )
}

// ─── Pending Card ────────────────────────────────────────────────

function PendingCard({ req, onViewDetail, onApprove, onReject }: {
  req: ApprovalRequest
  onViewDetail: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const meta = parseMetadata(req.metadata)
  const amount = meta.amount as number | undefined
  const daysPending = Math.floor((Date.now() - new Date(req.createdAt).getTime()) / (24 * 3600 * 1000))

  return (
    <Card
      key={req.id}
      size="small"
      style={{ marginBottom: 12, borderLeft: `4px solid ${req.entityType === 'SchoolExpense' ? '#2E5A8E' : '#7D5A00'}`, cursor: 'pointer' }}
      onClick={() => onViewDetail(req.id)}
      extra={
        <Space onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            icon={<Eye size={12} />}
            onClick={(e) => { e.stopPropagation(); onViewDetail(req.id) }}
          >Details</Button>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircle size={12} />}
            onClick={(e) => { e.stopPropagation(); onApprove(req.id) }}
            style={{ background: '#1A6B3A', borderColor: '#1A6B3A' }}
          >Approve</Button>
          <Button
            size="small"
            danger
            icon={<XCircle size={12} />}
            onClick={(e) => { e.stopPropagation(); onReject(req.id) }}
          >Reject</Button>
        </Space>
      }
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space>
          <EntityIcon type={req.entityType} />
          <Text strong style={{ fontSize: 13 }}>{req.entitySummary || req.entityType}</Text>
          <Tag color="blue" style={{ fontSize: 10 }}>{req.entityType}</Tag>
        </Space>
        {amount !== undefined && (
          <Text style={{ fontSize: 12 }}>
            Amount: <Text strong style={{ color: '#2E5A8E' }}>BND {Number(amount).toFixed(2)}</Text>
            {amount >= 2000 && <Tag color="red" style={{ marginLeft: 6, fontSize: 10 }}>Requires HOD + Principal</Tag>}
            {amount >= 500 && amount < 2000 && <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>Requires HOD approval</Tag>}
          </Text>
        )}
        <Space split={<Divider type="vertical" />} style={{ fontSize: 11, color: '#888' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>Submitted by: {req.requesterName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <Clock size={10} style={{ marginRight: 2 }} />
            {daysPending === 0 ? 'Today' : `${daysPending}d ago`}
          </Text>
          <RoutingPath levelsRequired={req.levelsRequired} currentLevel={req.currentLevel} status={req.status} />
        </Space>
      </Space>
    </Card>
  )
}

// ─── Main Page ───────────────────────────────────────────────────

export default function ApprovalsInboxPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean } | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ['approvals-inbox'],
    queryFn: async () => {
      const res = await api.get('/approvals/inbox')
      return res.data.data ?? []
    },
    refetchInterval: 15000,
  })

  const decideMutation = useMutation({
    mutationFn: ({ id, decision, remarks }: { id: string; decision: 'APPROVE' | 'REJECT'; remarks?: string }) =>
      api.post(`/approvals/${id}/decide`, { decision, remarks }),
    onSuccess: (_, vars) => {
      message.success(vars.decision === 'APPROVE' ? 'Approved and routed' : 'Request rejected')
      qc.invalidateQueries({ queryKey: ['approvals-inbox'] })
      qc.invalidateQueries({ queryKey: ['approvals-history'] })
      setRejectModal(null)
      setRejectRemarks('')
    },
    onError: () => message.error('Action failed'),
  })

  const requests = data ?? []
  const pending = requests.filter(r => ['PENDING', 'LEVEL1_APPROVED'].includes(r.status))

  const openDetail = (id: string) => {
    setDetailId(id)
    setDetailOpen(true)
  }

  const renderPendingList = (items: ApprovalRequest[]) => {
    if (items.length === 0) return <Empty description="No pending items in this category" style={{ padding: 40 }} />
    return items.map(req => (
      <PendingCard
        key={req.id}
        req={req}
        onViewDetail={openDetail}
        onApprove={(id) => decideMutation.mutate({ id, decision: 'APPROVE' })}
        onReject={(id) => { setRejectModal({ id, open: true }); setRejectRemarks('') }}
      />
    ))
  }

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          Approvals Inbox
          {pending.length > 0 && <Badge count={pending.length} style={{ marginLeft: 10 }} />}
        </Title>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <Tabs
          defaultActiveKey="expenses"
          items={[
            {
              key: 'expenses',
              label: (
                <Space size={4}>
                  <DollarSign size={13} />
                  Expenses
                  {pending.filter(r => r.entityType === 'SchoolExpense').length > 0 && (
                    <Badge count={pending.filter(r => r.entityType === 'SchoolExpense').length} size="small" />
                  )}
                </Space>
              ),
              children: renderPendingList(pending.filter(r => r.entityType === 'SchoolExpense')),
            },
            {
              key: 'grades',
              label: (
                <Space size={4}>
                  <BookOpen size={13} />
                  Grade Amendments
                  {pending.filter(r => r.entityType === 'GradeAmendment').length > 0 && (
                    <Badge count={pending.filter(r => r.entityType === 'GradeAmendment').length} size="small" />
                  )}
                </Space>
              ),
              children: renderPendingList(pending.filter(r => r.entityType === 'GradeAmendment')),
            },
            {
              key: 'other',
              label: (
                <Space size={4}>
                  <FileEdit size={13} />
                  Other
                  {pending.filter(r => !['SchoolExpense', 'GradeAmendment'].includes(r.entityType)).length > 0 && (
                    <Badge count={pending.filter(r => !['SchoolExpense', 'GradeAmendment'].includes(r.entityType)).length} size="small" />
                  )}
                </Space>
              ),
              children: renderPendingList(pending.filter(r => !['SchoolExpense', 'GradeAmendment'].includes(r.entityType))),
            },
            {
              key: 'history',
              label: (
                <Space size={4}>
                  <History size={13} />
                  History
                </Space>
              ),
              children: <HistoryTab />,
            },
          ]}
        />
      )}

      {/* Reject modal */}
      <Modal
        title="Reject Request"
        open={!!rejectModal?.open}
        onCancel={() => setRejectModal(null)}
        onOk={() => {
          if (rejectModal) {
            decideMutation.mutate({ id: rejectModal.id, decision: 'REJECT', remarks: rejectRemarks })
          }
        }}
        okText="Confirm Rejection"
        okType="danger"
        confirmLoading={decideMutation.isPending}
      >
        <Paragraph>Please provide a reason for rejection (optional):</Paragraph>
        <TextArea
          rows={3}
          value={rejectRemarks}
          onChange={e => setRejectRemarks(e.target.value)}
          placeholder="Enter reason..."
        />
      </Modal>

      {/* Detail drawer */}
      <DetailDrawer
        requestId={detailId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        canAct
        onApprove={(id) => { decideMutation.mutate({ id, decision: 'APPROVE' }); setDetailOpen(false) }}
        onReject={(id) => { setRejectModal({ id, open: true }); setRejectRemarks(''); setDetailOpen(false) }}
      />
    </div>
  )
}
