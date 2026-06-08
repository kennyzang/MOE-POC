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
  Row, Col, Select, DatePicker, Card, Alert, Progress, Upload, message,
} from 'antd'
import type { UploadFile, UploadProps } from 'antd'
import {
  CheckCircle2, AlertTriangle, ClipboardList, FileText,
  PlusCircle, Trash2, CheckCheck, UploadCloud, Download,
} from 'lucide-react'
import { useState } from 'react'
import dayjs from 'dayjs'
import { Typography } from 'antd'
import api from '@/lib/api'

const { Text } = Typography

// ─── Shared types (importable by consumers) ──────────────────────────────────

export interface ResolutionActionItem {
  id: string
  title: string
  description: string | null
  assignedTo: string | null
  assignedToUserId: string | null
  dueDate: string | null
  status: string        // OPEN | IN_PROGRESS | DONE
  resultNotes: string | null
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

export interface StaffOption {
  value: string   // User.id
  label: string   // displayName
  role?: string
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
    title: string; description?: string; assignedTo?: string; assignedToUserId?: string
    dueDate?: string; category?: string
  }) => void
  onUpdateActionItemStatus: (itemId: string, status: string) => void
  onDeleteActionItem: (itemId: string) => void
  creatingActionItem?: boolean

  /** When provided, "Assigned to" becomes a searchable staff picker */
  assigneeOptions?: StaffOption[]

  // ── Evidence docs ──────────────────────────────────────────────────────────
  evidenceDocs: ResolutionEvidenceDoc[]
  onCreateEvidence: (vals: { fileName: string; fileType?: string; description?: string; filePath?: string }) => void
  onDeleteEvidence: (docId: string) => void
  creatingEvidence?: boolean

  /**
   * When provided, the evidence form includes a real file upload.
   * Should be the case/entity ID (used as entityId in /files/upload).
   */
  evidenceEntityId?: string

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

function isRealFilePath(p: string): boolean {
  return p.startsWith('/api/') || p.startsWith('http')
}

// ─── Component ────────────────────────────────────────────────────────────────

const ResolutionDrawer = ({
  open, onClose, title,
  summaryContent,
  isResolved, resolvedAt, resolvedNotes,
  actionItems, onCreateActionItem, onUpdateActionItemStatus, onDeleteActionItem, creatingActionItem,
  assigneeOptions,
  evidenceDocs, onCreateEvidence, onDeleteEvidence, creatingEvidence,
  evidenceEntityId,
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

  // File upload state for evidence
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([])
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

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
    setUploadFileList([])
    setUploadedFilePath(null)
    setUploadedFileName(null)
    onClose()
  }

  const handleUploadFile = async () => {
    if (!uploadFileList.length || !evidenceEntityId) return
    const formData = new FormData()
    formData.append('file', uploadFileList[0] as unknown as File)
    formData.append('entityType', 'case_evidence')
    formData.append('entityId', evidenceEntityId)
    setUploading(true)
    try {
      const { data } = await api.post<{ success: boolean; data: { originalName: string; downloadUrl: string } }>(
        '/files/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setUploadedFilePath(data.data.downloadUrl)
      setUploadedFileName(data.data.originalName)
      evidenceForm.setFieldValue('fileName', data.data.originalName)
      message.success(`${data.data.originalName} uploaded`)
    } catch {
      message.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const uploadProps: UploadProps = {
    fileList: uploadFileList,
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt',
    maxCount: 1,
    beforeUpload: (file) => {
      if (file.size / 1024 / 1024 > 10) { message.error('File must be < 10 MB'); return Upload.LIST_IGNORE }
      setUploadFileList([file])
      setUploadedFilePath(null)
      setUploadedFileName(null)
      return false
    },
    onRemove: () => {
      setUploadFileList([])
      setUploadedFilePath(null)
      setUploadedFileName(null)
      evidenceForm.setFieldValue('fileName', '')
    },
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
                  const selectedOption = assigneeOptions?.find(o => o.value === vals.assignedToUserId)
                  onCreateActionItem({
                    title: vals.title,
                    description: vals.description,
                    assignedTo: selectedOption?.label ?? vals.assignedTo,
                    assignedToUserId: vals.assignedToUserId,
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
                    <Form.Item
                      name={assigneeOptions ? 'assignedToUserId' : 'assignedTo'}
                      label="Assigned to"
                      style={{ marginBottom: 8 }}
                    >
                      {assigneeOptions ? (
                        <Select
                          showSearch
                          allowClear
                          placeholder="Select staff member"
                          filterOption={(input, opt) =>
                            (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={assigneeOptions.map(o => ({
                            value: o.value,
                            label: o.label,
                          }))}
                          optionRender={(opt) => {
                            const staff = assigneeOptions.find(s => s.value === opt.value)
                            return (
                              <div>
                                <div style={{ fontSize: 13 }}>{staff?.label}</div>
                                {staff?.role && (
                                  <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'capitalize' }}>
                                    {staff.role}
                                  </div>
                                )}
                              </div>
                            )
                          }}
                        />
                      ) : (
                        <Input placeholder="Person or party responsible" />
                      )}
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
                      {row.resultNotes && (
                        <div style={{ fontSize: 11, color: '#52c41a', marginTop: 2, fontStyle: 'italic' }}>
                          Result: {row.resultNotes}
                        </div>
                      )}
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
              <UploadCloud size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {evidenceLabel} Documents ({evidenceDocs.length})
            </Text>
            {!isResolved && (
              <Button
                size="small"
                icon={<PlusCircle size={12} />}
                onClick={() => {
                  setShowAddEvidence(!showAddEvidence)
                  if (!showAddEvidence) {
                    evidenceForm.resetFields()
                    setUploadFileList([])
                    setUploadedFilePath(null)
                    setUploadedFileName(null)
                  }
                }}
              >
                {showAddEvidence ? 'Cancel' : `Add ${evidenceLabel}`}
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
                    filePath: uploadedFilePath ?? undefined,
                  })
                  evidenceForm.resetFields()
                  setUploadFileList([])
                  setUploadedFilePath(null)
                  setUploadedFileName(null)
                  setShowAddEvidence(false)
                }}
              >
                {/* File upload (when evidenceEntityId provided) */}
                {evidenceEntityId && (
                  <Form.Item label="Upload file" style={{ marginBottom: 8 }}>
                    <Space wrap>
                      <Upload {...uploadProps}>
                        <Button icon={<UploadCloud size={13} />} size="small" disabled={!!uploadedFilePath}>
                          Choose File
                        </Button>
                      </Upload>
                      {uploadFileList.length > 0 && !uploadedFilePath && (
                        <Button
                          type="primary"
                          size="small"
                          loading={uploading}
                          onClick={handleUploadFile}
                        >
                          Upload
                        </Button>
                      )}
                      {uploadedFileName && (
                        <Text type="success" style={{ fontSize: 12 }}>
                          <CheckCircle2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {uploadedFileName} uploaded
                        </Text>
                      )}
                    </Space>
                  </Form.Item>
                )}

                <Row gutter={8}>
                  <Col span={14}>
                    <Form.Item
                      name="fileName"
                      label={evidenceEntityId ? 'File name (auto-filled on upload)' : 'File name / reference'}
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 8 }}
                    >
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
                <Button
                  type="primary"
                  size="small"
                  htmlType="submit"
                  loading={creatingEvidence}
                  disabled={evidenceEntityId ? uploading : false}
                >
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
                        {isRealFilePath(row.filePath) ? (
                          <a
                            href={`/api/v1${row.filePath}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 12 }}
                          >
                            {name}
                          </a>
                        ) : (
                          <Text style={{ fontSize: 12 }}>{name}</Text>
                        )}
                        {row.fileType && <Tag style={{ fontSize: 10 }}>{row.fileType}</Tag>}
                        {isRealFilePath(row.filePath) && (
                          <Tooltip title="Download">
                            <a href={`/api/v1${row.filePath}`} download>
                              <Download size={11} style={{ color: '#1677ff' }} />
                            </a>
                          </Tooltip>
                        )}
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
