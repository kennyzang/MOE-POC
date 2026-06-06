/**
 * ResolutionDrawer — reusable drawer for managing the closure/resolution of
 * any serious issue that requires documented evidence and assigned interventions
 * before it can be closed. Used by: Inspection Issues, Counselor Cases.
 *
 * The parent component owns: data fetching, mutations, which item is selected,
 * and the resolutionNotes string. This component owns its own add-item forms.
 */

import {
  Drawer, Space, Button, Table, Tag, Tooltip, Divider, Input, Form,
  Row, Col, Select, DatePicker, Card, Alert, Progress,
} from 'antd'
import {
  CheckCircle2, AlertTriangle, ClipboardList, Upload, FileText,
  PlusCircle, Trash2, CheckCheck,
} from 'lucide-react'
import { useState } from 'react'
import dayjs from 'dayjs'
import { Typography } from 'antd'

const { Text } = Typography

// ─── Shared types (importable by consumers) ──────────────────────────────────

export interface ResolutionActionItem {
  id: string
  title: string
  description: string | null
  assignedTo: string | null
  dueDate: string | null
  status: string        // OPEN | IN_PROGRESS | DONE
  closedAt: string | null
  createdAt: string
  category?: string | null
}

export interface ResolutionEvidenceDoc {
  id: string
  fileName: string
  filePath: string
  fileType: string | null
  description: string | null
  createdAt: string
}

export interface ResolutionDrawerProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode

  /** Slot for a compact summary of the issue (findings, concerns, etc.) */
  summaryContent?: React.ReactNode

  // ── State ──────────────────────────────────────────────────────────────────
  isResolved: boolean
  resolvedAt?: string | null
  resolvedNotes?: string | null

  // ── Action items ───────────────────────────────────────────────────────────
  actionItems: ResolutionActionItem[]
  onCreateActionItem: (vals: {
    title: string; description?: string; assignedTo?: string
    dueDate?: string; category?: string
  }) => void
  onUpdateActionItemStatus: (itemId: string, status: string) => void
  onDeleteActionItem: (itemId: string) => void
  creatingActionItem?: boolean

  // ── Evidence docs ──────────────────────────────────────────────────────────
  evidenceDocs: ResolutionEvidenceDoc[]
  onCreateEvidence: (vals: { fileName: string; fileType?: string; description?: string }) => void
  onDeleteEvidence: (docId: string) => void
  creatingEvidence?: boolean

  // ── Resolution ─────────────────────────────────────────────────────────────
  resolutionNotes: string
  onResolutionNotesChange: (v: string) => void
  onResolve: () => void
  resolving?: boolean

  // ── Config ─────────────────────────────────────────────────────────────────
  minNotesLength?: number         // characters required in summary (default 20)
  requireEvidence?: boolean       // default true
  requireAllActionsDone?: boolean // default true

  /** Dropdown options for linking a task to a category (finding, concern, etc.) */
  categoryOptions?: string[]

  /** Customise the label for action items — e.g. "Intervention" vs "Task" */
  actionItemLabel?: string
  /** Customise the label for evidence — e.g. "Session Record" vs "Evidence" */
  evidenceLabel?: string
}

// ─── Internal constants ───────────────────────────────────────────────────────

const ACTION_STATUS_COLOR: Record<string, string> = {
  OPEN: 'default', IN_PROGRESS: 'processing', DONE: 'success',
}

// ─── Component ────────────────────────────────────────────────────────────────

const ResolutionDrawer = ({
  open, onClose, title,
  summaryContent,
  isResolved, resolvedAt, resolvedNotes,
  actionItems, onCreateActionItem, onUpdateActionItemStatus, onDeleteActionItem, creatingActionItem,
  evidenceDocs, onCreateEvidence, onDeleteEvidence, creatingEvidence,
  resolutionNotes, onResolutionNotesChange, onResolve, resolving,
  minNotesLength = 20,
  requireEvidence = true,
  requireAllActionsDone = true,
  categoryOptions,
  actionItemLabel = 'Task',
  evidenceLabel = 'Evidence',
}: ResolutionDrawerProps) => {
  const [showAddAction, setShowAddAction] = useState(false)
  const [showAddEvidence, setShowAddEvidence] = useState(false)
  const [actionItemForm] = Form.useForm()
  const [evidenceForm] = Form.useForm()

  // Gate checks
  const gateNotesOk = resolutionNotes.trim().length >= minNotesLength
  const gateEvidenceOk = !requireEvidence || evidenceDocs.length >= 1
  const openActionCount = actionItems.filter((a) => a.status !== 'DONE').length
  const gateActionsOk = !requireAllActionsDone || openActionCount === 0
  const canResolve = gateNotesOk && gateEvidenceOk && gateActionsOk
  const gateCount = [gateNotesOk, gateEvidenceOk, gateActionsOk].filter(Boolean).length
  const gateTotal = [true, requireEvidence, requireAllActionsDone].filter(Boolean).length

  const resolveTooltip = !gateNotesOk
    ? `Resolution summary must be at least ${minNotesLength} characters`
    : !gateEvidenceOk
    ? 'At least one supporting document is required'
    : !gateActionsOk
    ? `${openActionCount} ${actionItemLabel.toLowerCase()}(s) must be completed first`
    : ''

  const handleCloseDrawer = () => {
    setShowAddAction(false)
    setShowAddEvidence(false)
    actionItemForm.resetFields()
    evidenceForm.resetFields()
    onClose()
  }

  return (
    <Drawer
      title={title}
      width={760}
      open={open}
      onClose={handleCloseDrawer}
      footer={
        !isResolved ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleCloseDrawer}>Close</Button>
            <Tooltip title={resolveTooltip}>
              <Button
                type="primary"
                icon={<CheckCheck size={14} />}
                disabled={!canResolve}
                loading={resolving}
                onClick={onResolve}
              >
                Mark Resolved
              </Button>
            </Tooltip>
          </div>
        ) : null
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size={20}>

        {/* ── Gate checklist ─────────────────────────────────────────────── */}
        {!isResolved && (
          <Card size="small" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong>Resolution Requirements</Text>
              <Progress
                percent={Math.round((gateCount / gateTotal) * 100)}
                size="small"
                strokeColor={gateCount === gateTotal ? '#52c41a' : '#faad14'}
                style={{ marginTop: 4 }}
              />
            </div>
            <Space direction="vertical" size={4}>
              <Space>
                {gateNotesOk
                  ? <CheckCircle2 size={14} style={{ color: '#52c41a' }} />
                  : <AlertTriangle size={14} style={{ color: '#faad14' }} />}
                <Text style={{ fontSize: 13 }}>
                  Resolution summary written (min. {minNotesLength} characters)
                </Text>
              </Space>
              {requireEvidence && (
                <Space>
                  {gateEvidenceOk
                    ? <CheckCircle2 size={14} style={{ color: '#52c41a' }} />
                    : <AlertTriangle size={14} style={{ color: '#faad14' }} />}
                  <Text style={{ fontSize: 13 }}>
                    At least 1 {evidenceLabel.toLowerCase()} document recorded
                    {evidenceDocs.length > 0 && ` (${evidenceDocs.length} on record)`}
                  </Text>
                </Space>
              )}
              {requireAllActionsDone && (
                <Space>
                  {gateActionsOk
                    ? <CheckCircle2 size={14} style={{ color: '#52c41a' }} />
                    : <AlertTriangle size={14} style={{ color: '#faad14' }} />}
                  <Text style={{ fontSize: 13 }}>
                    All {actionItemLabel.toLowerCase()}s completed
                    {actionItems.length > 0 &&
                      ` (${actionItems.filter(a => a.status === 'DONE').length}/${actionItems.length} done)`}
                  </Text>
                </Space>
              )}
            </Space>
          </Card>
        )}

        {/* ── Summary slot ───────────────────────────────────────────────── */}
        {summaryContent}

        <Divider style={{ margin: 0 }} />

        {/* ── Action items ───────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text strong>
              <ClipboardList size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {actionItemLabel}s ({actionItems.length})
            </Text>
            {!isResolved && (
              <Button
                size="small"
                icon={<PlusCircle size={12} />}
                onClick={() => {
                  setShowAddAction(!showAddAction)
                  if (!showAddAction) actionItemForm.resetFields()
                }}
              >
                {showAddAction ? 'Cancel' : `Assign ${actionItemLabel}`}
              </Button>
            )}
          </div>

          {showAddAction && !isResolved && (
            <Card size="small" style={{ marginBottom: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
              <Form
                form={actionItemForm}
                layout="vertical"
                size="small"
                onFinish={(vals) => {
                  onCreateActionItem({
                    title: vals.title,
                    description: vals.description,
                    assignedTo: vals.assignedTo,
                    dueDate: vals.dueDate?.toISOString(),
                    category: vals.category,
                  })
                  actionItemForm.resetFields()
                  setShowAddAction(false)
                }}
              >
                <Row gutter={8}>
                  <Col span={categoryOptions && categoryOptions.length > 0 ? 16 : 24}>
                    <Form.Item name="title" label={actionItemLabel} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                      <Input placeholder={`Describe what must be done`} />
                    </Form.Item>
                  </Col>
                  {categoryOptions && categoryOptions.length > 0 && (
                    <Col span={8}>
                      <Form.Item name="category" label="Related to" style={{ marginBottom: 8 }}>
                        <Select
                          allowClear
                          placeholder="Select category"
                          options={categoryOptions.map(c => ({ value: c, label: c }))}
                        />
                      </Form.Item>
                    </Col>
                  )}
                  <Col span={12}>
                    <Form.Item name="assignedTo" label="Assigned to" style={{ marginBottom: 8 }}>
                      <Input placeholder="Person or party responsible" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="dueDate" label="Due date" style={{ marginBottom: 8 }}>
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="description" label="Instructions / details" style={{ marginBottom: 8 }}>
                      <Input.TextArea rows={2} placeholder="Specific steps or requirements" />
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" size="small" htmlType="submit" loading={creatingActionItem}>
                  Add {actionItemLabel}
                </Button>
              </Form>
            </Card>
          )}

          {actionItems.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              No {actionItemLabel.toLowerCase()}s assigned yet.
              {!isResolved && ` Use "Assign ${actionItemLabel}" to add steps with responsible parties and due dates.`}
            </Text>
          ) : (
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={actionItems}
              columns={[
                {
                  title: actionItemLabel,
                  dataIndex: 'title',
                  render: (title: string, row: ResolutionActionItem) => (
                    <div>
                      <Text style={{ fontSize: 12 }}>{title}</Text>
                      {row.category && <div style={{ fontSize: 11, color: '#8c8c8c' }}>Re: {row.category}</div>}
                      {row.assignedTo && <div style={{ fontSize: 11, color: '#8c8c8c' }}>→ {row.assignedTo}</div>}
                      {row.description && <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{row.description}</div>}
                    </div>
                  ),
                },
                {
                  title: 'Due', dataIndex: 'dueDate', width: 100,
                  render: (v: string | null, row: ResolutionActionItem) => {
                    if (!v) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
                    const overdue = dayjs(v).isBefore(dayjs()) && row.status !== 'DONE'
                    return (
                      <Text type={overdue ? 'danger' : 'secondary'} style={{ fontSize: 11 }}>
                        {dayjs(v).format('DD MMM YY')}
                      </Text>
                    )
                  },
                },
                {
                  title: 'Status', dataIndex: 'status', width: 120,
                  render: (s: string) => (
                    <Tag color={ACTION_STATUS_COLOR[s]} style={{ fontSize: 11 }}>
                      {s.replace('_', ' ')}
                    </Tag>
                  ),
                },
                {
                  title: '', width: 120,
                  render: (_: unknown, row: ResolutionActionItem) =>
                    !isResolved ? (
                      <Space size={4}>
                        {row.status !== 'DONE' && (
                          <Button
                            size="small" type="link" style={{ padding: 0, fontSize: 11 }}
                            onClick={() => onUpdateActionItemStatus(row.id, 'DONE')}
                          >
                            Mark done
                          </Button>
                        )}
                        {row.status === 'OPEN' && (
                          <Button
                            size="small" type="link" style={{ padding: 0, fontSize: 11 }}
                            onClick={() => onUpdateActionItemStatus(row.id, 'IN_PROGRESS')}
                          >
                            Start
                          </Button>
                        )}
                        <Button
                          size="small" type="link" danger
                          icon={<Trash2 size={11} />}
                          style={{ padding: 0 }}
                          onClick={() => onDeleteActionItem(row.id)}
                        />
                      </Space>
                    ) : null,
                },
              ]}
            />
          )}
        </div>

        <Divider style={{ margin: 0 }} />

        {/* ── Evidence docs ──────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text strong>
              <Upload size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {evidenceLabel} Documents ({evidenceDocs.length})
            </Text>
            {!isResolved && (
              <Button
                size="small"
                icon={<PlusCircle size={12} />}
                onClick={() => {
                  setShowAddEvidence(!showAddEvidence)
                  if (!showAddEvidence) evidenceForm.resetFields()
                }}
              >
                {showAddEvidence ? 'Cancel' : `Record ${evidenceLabel}`}
              </Button>
            )}
          </div>

          {showAddEvidence && !isResolved && (
            <Card size="small" style={{ marginBottom: 12, background: '#e6f4ff', border: '1px solid #91caff' }}>
              <Form
                form={evidenceForm}
                layout="vertical"
                size="small"
                onFinish={(vals) => {
                  onCreateEvidence({
                    fileName: vals.fileName,
                    fileType: vals.fileType,
                    description: vals.description,
                  })
                  evidenceForm.resetFields()
                  setShowAddEvidence(false)
                }}
              >
                <Row gutter={8}>
                  <Col span={14}>
                    <Form.Item name="fileName" label="File name / reference" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                      <Input placeholder="e.g. Session-Notes-2026-06-05.pdf" />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item name="fileType" label="Type" style={{ marginBottom: 8 }}>
                      <Select
                        allowClear
                        placeholder="Select type"
                        options={[
                          { value: 'PDF', label: 'PDF Report' },
                          { value: 'JPG', label: 'Photo / Image' },
                          { value: 'DOCX', label: 'Word Document' },
                          { value: 'XLSX', label: 'Spreadsheet' },
                          { value: 'Certificate', label: 'Certificate' },
                          { value: 'Letter', label: 'Official Letter' },
                          { value: 'Session Notes', label: 'Session Notes' },
                          { value: 'Referral', label: 'Referral Form' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="description" label="Description" style={{ marginBottom: 8 }}>
                      <Input.TextArea rows={2} placeholder="What does this document show or prove?" />
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" size="small" htmlType="submit" loading={creatingEvidence}>
                  Record
                </Button>
              </Form>
            </Card>
          )}

          {evidenceDocs.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              No documents recorded yet.
              {!isResolved && requireEvidence && ' Supporting documents are required before marking resolved.'}
            </Text>
          ) : (
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={evidenceDocs}
              columns={[
                {
                  title: 'Document',
                  dataIndex: 'fileName',
                  render: (name: string, row: ResolutionEvidenceDoc) => (
                    <div>
                      <Space size={4}>
                        <FileText size={12} style={{ color: '#1677ff' }} />
                        <Text style={{ fontSize: 12 }}>{name}</Text>
                        {row.fileType && <Tag style={{ fontSize: 10 }}>{row.fileType}</Tag>}
                      </Space>
                      {row.description && (
                        <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{row.description}</div>
                      )}
                    </div>
                  ),
                },
                {
                  title: 'Recorded', dataIndex: 'createdAt', width: 110,
                  render: (v: string) => (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(v).format('DD MMM YYYY')}
                    </Text>
                  ),
                },
                {
                  title: '', width: 60,
                  render: (_: unknown, row: ResolutionEvidenceDoc) =>
                    !isResolved ? (
                      <Button
                        size="small" type="link" danger
                        icon={<Trash2 size={11} />}
                        style={{ padding: 0 }}
                        onClick={() => onDeleteEvidence(row.id)}
                      />
                    ) : null,
                },
              ]}
            />
          )}
        </div>

        <Divider style={{ margin: 0 }} />

        {/* ── Resolution summary ─────────────────────────────────────────── */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            <CheckCheck size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Resolution Summary
          </Text>
          {isResolved ? (
            <Alert
              type="success"
              showIcon
              message={resolvedAt ? `Resolved on ${dayjs(resolvedAt).format('DD MMM YYYY')}` : 'Resolved'}
              description={resolvedNotes ?? '—'}
            />
          ) : (
            <Input.TextArea
              rows={4}
              placeholder={`Summarise the outcome: what actions were taken, what evidence confirms resolution, and confirm the issue is closed. (minimum ${minNotesLength} characters)`}
              value={resolutionNotes}
              onChange={(e) => onResolutionNotesChange(e.target.value)}
              showCount
              minLength={minNotesLength}
            />
          )}
        </div>

      </Space>
    </Drawer>
  )
}

export default ResolutionDrawer
