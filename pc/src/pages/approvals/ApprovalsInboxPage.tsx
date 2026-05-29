import { useState } from 'react'
import {
  Card, Typography, Space, Button, Tag, Empty, Spin, Modal, Input, message, Badge, Tabs, Divider,
} from 'antd'
import { CheckCircle, XCircle, Clock, DollarSign, FileEdit, BookOpen, ChevronRight } from 'lucide-react'
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
  const step1Done = status !== 'PENDING'
  const fullyDone = status === 'FULLY_APPROVED'
  return (
    <Space size={4} style={{ fontSize: 11 }}>
      <Tag color={step1Done ? 'success' : currentLevel === 1 ? 'processing' : 'default'} style={{ fontSize: 10 }}>
        HOD
      </Tag>
      {levelsRequired > 1 && (
        <>
          <ChevronRight size={10} color="#bbb" />
          <Tag color={fullyDone ? 'success' : currentLevel === 2 ? 'processing' : 'default'} style={{ fontSize: 10 }}>
            Principal
          </Tag>
        </>
      )}
    </Space>
  )
}

export default function ApprovalsInboxPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean } | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState('')

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
      setRejectModal(null)
      setRejectRemarks('')
    },
    onError: () => message.error('Action failed'),
  })

  const requests = data ?? []
  const pending = requests.filter(r => ['PENDING', 'LEVEL1_APPROVED'].includes(r.status))

  const renderCard = (req: ApprovalRequest) => {
    const meta = parseMetadata(req.metadata)
    const amount = meta.amount as number | undefined
    const daysPending = Math.floor((Date.now() - new Date(req.createdAt).getTime()) / (24 * 3600 * 1000))

    return (
      <Card
        key={req.id}
        size="small"
        style={{ marginBottom: 12, borderLeft: `4px solid ${req.entityType === 'SchoolExpense' ? '#2E5A8E' : '#7D5A00'}` }}
        extra={
          <Space>
            <Button
              size="small"
              type="primary"
              icon={<CheckCircle size={12} />}
              loading={decideMutation.isPending}
              onClick={() => decideMutation.mutate({ id: req.id, decision: 'APPROVE' })}
              style={{ background: '#1A6B3A', borderColor: '#1A6B3A' }}
            >
              Approve
            </Button>
            <Button
              size="small"
              danger
              icon={<XCircle size={12} />}
              onClick={() => { setRejectModal({ id: req.id, open: true }); setRejectRemarks('') }}
            >
              Reject
            </Button>
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

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          Approvals Inbox
          {pending.length > 0 && <Badge count={pending.length} style={{ marginLeft: 10 }} />}
        </Title>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : pending.length === 0 ? (
        <Empty description="No pending approvals" style={{ marginTop: 60 }} />
      ) : (
        <Tabs
          defaultActiveKey="expenses"
          items={[
            {
              key: 'expenses',
              label: `Expenses (${pending.filter(r => r.entityType === 'SchoolExpense').length})`,
              children: pending.filter(r => r.entityType === 'SchoolExpense').map(renderCard),
            },
            {
              key: 'grades',
              label: `Grade Amendments (${pending.filter(r => r.entityType === 'GradeAmendment').length})`,
              children: pending.filter(r => r.entityType === 'GradeAmendment').length === 0
                ? <Empty description="No pending grade amendments" />
                : pending.filter(r => r.entityType === 'GradeAmendment').map(renderCard),
            },
            {
              key: 'other',
              label: `Other (${pending.filter(r => !['SchoolExpense', 'GradeAmendment'].includes(r.entityType)).length})`,
              children: pending.filter(r => !['SchoolExpense', 'GradeAmendment'].includes(r.entityType)).map(renderCard),
            },
          ]}
        />
      )}

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
    </div>
  )
}
