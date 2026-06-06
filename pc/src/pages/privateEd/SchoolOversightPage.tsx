import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Row, Col, Tag, Typography, Spin, Empty, Tabs, Timeline, Descriptions,
  Space, Button, Table, Modal, Form, Input, DatePicker, Select, message, Alert,
  Divider,
} from 'antd'
import {
  ArrowLeft, School, CalendarClock, ShieldCheck, FileSearch, Bell, ScrollText,
  CheckCircle2, RefreshCw, ClipboardList, CheckCheck,
} from 'lucide-react'
import { useState } from 'react'
import dayjs from 'dayjs'
import api from '@/lib/api'
import ResolutionDrawer from '@/components/ResolutionDrawer'
import type { ResolutionActionItem, ResolutionEvidenceDoc } from '@/components/ResolutionDrawer'

const { Title, Text, Paragraph } = Typography

interface InspectionDetail {
  id: string
  inspectionDate: string
  inspectionType: string
  rating: string | null
  findings: Array<{ category: string; severity: string; observation: string; recommendation: string }>
  followUpDueDate: string | null
  resolved: boolean
  resolvedAt: string | null
  resolutionStatus: string
  resolutionNotes: string | null
  notes: string | null
  actionItems: ResolutionActionItem[]
  evidenceDocs: ResolutionEvidenceDoc[]
}

interface SchoolDetail {
  id: string
  name: string
  code: string
  schoolType: string
  address?: string
  phone?: string
  principal?: string
  establishedYear?: number
  profile: {
    registrationNo: string
    ownerOrganisation: string
    ownerContactName?: string
    ownerContactPhone?: string
    ownerContactEmail?: string
    district: string
    curriculumModel: string
    studentCapacity: number
    feeRangeBnd?: string
    notes?: string
  } | null
  licenses: Array<{
    id: string
    licenseNumber: string
    issuedDate: string
    expiryDate: string
    status: string
    computedStatus: string
    authorisedLevels: string[]
    conditions: string | null
    renewals: Array<{ id: string; previousExpiry: string; newExpiry: string; renewedAt: string; notes: string | null }>
  }>
  inspections: InspectionDetail[]
  circulars: Array<{
    targetId: string
    circularId: string
    circularNumber: string
    title: string
    effectiveDate: string
    acknowledgementDueDate: string | null
    acknowledgedAt: string | null
  }>
  counts: { studentCount: number; teacherCount: number }
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  ACTIVE:         { color: '#52c41a', label: 'Active' },
  EXPIRING_SOON:  { color: '#faad14', label: 'Expiring soon' },
  EXPIRED:        { color: '#ff4d4f', label: 'Expired' },
  SUSPENDED:      { color: '#cf1322', label: 'Suspended' },
  REVOKED:        { color: '#820014', label: 'Revoked' },
  UNLICENSED:     { color: '#8c8c8c', label: 'Unlicensed' },
}
const RATING_COLOR: Record<string, string> = {
  EXCELLENT: '#52c41a', GOOD: '#73d13d', SATISFACTORY: '#faad14',
  NEEDS_IMPROVEMENT: '#fa8c16', UNSATISFACTORY: '#ff4d4f',
}
const SEVERITY_COLOR: Record<string, string> = {
  minor: 'blue', moderate: 'orange', major: 'red',
}

const SchoolOversightPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [renewLicenseId, setRenewLicenseId] = useState<string | null>(null)
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false)
  const [renewForm] = Form.useForm()
  const [inspectionForm] = Form.useForm()

  // Resolution drawer
  const [resolutionInspId, setResolutionInspId] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')

  const { data: school, isLoading } = useQuery<SchoolDetail>({
    queryKey: ['priv-ed-school', id],
    queryFn: async () => (await api.get(`/private-ed/schools/${id}`)).data.data,
    enabled: !!id,
  })

  const activeInsp = school?.inspections.find((i) => i.id === resolutionInspId) ?? null
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['priv-ed-school', id] })
    queryClient.invalidateQueries({ queryKey: ['priv-ed-dashboard'] })
  }

  const renewMutation = useMutation({
    mutationFn: async ({ licenseId, newExpiryDate, notes }: { licenseId: string; newExpiryDate: string; notes?: string }) => {
      return (await api.post(`/private-ed/licenses/${licenseId}/renew`, { newExpiryDate, notes })).data
    },
    onSuccess: () => {
      message.success('License renewed')
      queryClient.invalidateQueries({ queryKey: ['priv-ed-school', id] })
      queryClient.invalidateQueries({ queryKey: ['priv-ed-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['priv-ed-schools'] })
      setRenewModalOpen(false)
      renewForm.resetFields()
    },
    onError: () => message.error('Failed to renew license'),
  })

  const recordInspectionMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post('/private-ed/inspections', { ...payload, schoolId: id })).data,
    onSuccess: () => {
      message.success('Inspection recorded')
      invalidate()
      setInspectionModalOpen(false)
      inspectionForm.resetFields()
    },
    onError: () => message.error('Failed to record inspection'),
  })

  // Resolution mutations — all invalidate the school query
  const createActionItemMutation = useMutation({
    mutationFn: async (vals: Record<string, unknown>) =>
      (await api.post(`/private-ed/inspections/${resolutionInspId}/action-items`, vals)).data,
    onSuccess: () => { message.success('Task added'); invalidate() },
    onError: () => message.error('Failed to add task'),
  })

  const updateActionItemMutation = useMutation({
    mutationFn: async ({ inspId, itemId, status }: { inspId: string; itemId: string; status: string }) =>
      (await api.patch(`/private-ed/inspections/${inspId}/action-items/${itemId}`, { status })).data,
    onSuccess: () => invalidate(),
    onError: () => message.error('Failed to update task'),
  })

  const deleteActionItemMutation = useMutation({
    mutationFn: async ({ inspId, itemId }: { inspId: string; itemId: string }) =>
      (await api.delete(`/private-ed/inspections/${inspId}/action-items/${itemId}`)).data,
    onSuccess: () => { message.success('Task removed'); invalidate() },
    onError: () => message.error('Failed to remove task'),
  })

  const addEvidenceMutation = useMutation({
    mutationFn: async (vals: Record<string, unknown>) =>
      (await api.post(`/private-ed/inspections/${resolutionInspId}/evidence`, vals)).data,
    onSuccess: () => { message.success('Evidence recorded'); invalidate() },
    onError: () => message.error('Failed to record evidence'),
  })

  const deleteEvidenceMutation = useMutation({
    mutationFn: async ({ inspId, docId }: { inspId: string; docId: string }) =>
      (await api.delete(`/private-ed/inspections/${inspId}/evidence/${docId}`)).data,
    onSuccess: () => { message.success('Evidence removed'); invalidate() },
    onError: () => message.error('Failed to remove evidence'),
  })

  const resolveInspectionMutation = useMutation({
    mutationFn: async ({ inspectionId, notes }: { inspectionId: string; notes: string }) =>
      (await api.post(`/private-ed/inspections/${inspectionId}/resolve`, { resolutionNotes: notes })).data,
    onSuccess: () => {
      message.success('Inspection resolved and closed')
      invalidate()
      setResolutionInspId(null)
      setResolutionNotes('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      message.error(msg ?? 'Failed to resolve inspection')
    },
  })

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!school) return <Empty description="School not found" />

  const latestLicense = school.licenses[0]
  const latestStatus = latestLicense ? STATUS_META[latestLicense.computedStatus] : STATUS_META.UNLICENSED
  const openInspections = school.inspections.filter((i) => !i.resolved)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Button
        type="link"
        icon={<ArrowLeft size={14} />}
        onClick={() => navigate('/private-ed/dashboard')}
        style={{ alignSelf: 'flex-start', padding: 0 }}
      >
        Back to Private Education Dashboard
      </Button>

      <Card>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space size={12} align="start">
              <School size={28} style={{ color: '#165DFF' }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>{school.name}</Title>
                <Space size={8} style={{ marginTop: 4 }}>
                  <Tag>{school.code}</Tag>
                  <Tag color="purple">PRIVATE</Tag>
                  {school.profile?.registrationNo && <Tag color="cyan">{school.profile.registrationNo}</Tag>}
                  <Tag color={latestStatus.color}>{latestStatus.label}</Tag>
                </Space>
                <div style={{ marginTop: 6, color: '#8c8c8c', fontSize: 12 }}>
                  {school.profile?.district} · {school.profile?.curriculumModel} · Est. {school.establishedYear ?? '—'}
                </div>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<RefreshCw size={14} />} disabled={!latestLicense} onClick={() => {
                if (latestLicense) { setRenewLicenseId(latestLicense.id); setRenewModalOpen(true) }
              }}>Renew license</Button>
              <Button type="primary" icon={<FileSearch size={14} />} onClick={() => setInspectionModalOpen(true)}>
                Record inspection
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {openInspections.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${openInspections.length} unresolved inspection${openInspections.length > 1 ? 's' : ''}`}
          description="Use 'Manage Resolution' on each inspection to assign tasks, record evidence, and close."
        />
      )}

      <Tabs
        defaultActiveKey="profile"
        items={[
          {
            key: 'profile',
            label: <Space size={6}><ScrollText size={14} /> Profile</Space>,
            children: (
              <Card>
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="Registration No.">{school.profile?.registrationNo ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Owner Organisation">{school.profile?.ownerOrganisation ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="District">{school.profile?.district ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Curriculum">{school.profile?.curriculumModel ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Student Capacity">{school.profile?.studentCapacity ?? 0}</Descriptions.Item>
                  <Descriptions.Item label="Fee Range (BND)">{school.profile?.feeRangeBnd ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Principal">{school.principal ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Phone">{school.phone ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Address" span={2}>{school.address ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Owner Contact" span={2}>
                    {school.profile?.ownerContactName ?? '—'}
                    {school.profile?.ownerContactPhone && ` · ${school.profile.ownerContactPhone}`}
                    {school.profile?.ownerContactEmail && ` · ${school.profile.ownerContactEmail}`}
                  </Descriptions.Item>
                  <Descriptions.Item label="Notes" span={2}>{school.profile?.notes ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Current student enrolment">{school.counts.studentCount}</Descriptions.Item>
                  <Descriptions.Item label="Teaching staff">{school.counts.teacherCount}</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'licenses',
            label: <Space size={6}><ShieldCheck size={14} /> Licensing ({school.licenses.length})</Space>,
            children: (
              <Card>
                {school.licenses.length === 0 ? <Empty description="No license records" /> : (
                  <Timeline
                    items={school.licenses.flatMap((lic) => {
                      const items = [{
                        color: STATUS_META[lic.computedStatus]?.color ?? '#8c8c8c',
                        children: (
                          <div>
                            <Space>
                              <Text strong>{lic.licenseNumber}</Text>
                              <Tag color={STATUS_META[lic.computedStatus]?.color}>{STATUS_META[lic.computedStatus]?.label}</Tag>
                            </Space>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                              Issued {dayjs(lic.issuedDate).format('DD MMM YYYY')} · Expires {dayjs(lic.expiryDate).format('DD MMM YYYY')}
                            </div>
                            {lic.authorisedLevels.length > 0 && (
                              <div style={{ marginTop: 4 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Authorised: </Text>
                                {lic.authorisedLevels.map((g) => <Tag key={g} style={{ fontSize: 11 }}>{g}</Tag>)}
                              </div>
                            )}
                            {lic.conditions && (
                              <Paragraph style={{ marginTop: 6, marginBottom: 0, fontSize: 12 }} type="secondary">
                                <Text strong>Conditions:</Text> {lic.conditions}
                              </Paragraph>
                            )}
                          </div>
                        ),
                      }]
                      lic.renewals.forEach((r) => {
                        items.push({
                          color: '#52c41a',
                          children: (
                            <div>
                              <Text>Renewed: {dayjs(r.previousExpiry).format('DD MMM YYYY')} → {dayjs(r.newExpiry).format('DD MMM YYYY')}</Text>
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                {dayjs(r.renewedAt).format('DD MMM YYYY')}{r.notes && ` · ${r.notes}`}
                              </div>
                            </div>
                          ),
                        })
                      })
                      return items
                    })}
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'inspections',
            label: <Space size={6}><FileSearch size={14} /> Inspections ({school.inspections.length})</Space>,
            children: (
              <Card>
                {school.inspections.length === 0 ? <Empty description="No inspections recorded" /> : (
                  <Space direction="vertical" style={{ width: '100%' }} size={16}>
                    {school.inspections.map((insp) => (
                      <Card key={insp.id} size="small" type="inner"
                        title={
                          <Space>
                            <Text strong>{dayjs(insp.inspectionDate).format('DD MMM YYYY')}</Text>
                            <Tag>{insp.inspectionType}</Tag>
                            {insp.rating && <Tag color={RATING_COLOR[insp.rating]}>{insp.rating.replace(/_/g, ' ')}</Tag>}
                            {insp.resolved
                              ? <Tag color="green" icon={<CheckCircle2 size={11} />}> Resolved</Tag>
                              : <Tag color="orange">Open</Tag>}
                            {!insp.resolved && insp.actionItems.length > 0 && (
                              <Tag color={insp.actionItems.every(a => a.status === 'DONE') ? 'green' : 'orange'}>
                                {insp.actionItems.filter(a => a.status === 'DONE').length}/{insp.actionItems.length} tasks done
                              </Tag>
                            )}
                            {!insp.resolved && insp.evidenceDocs.length > 0 && (
                              <Tag color="blue">{insp.evidenceDocs.length} evidence doc{insp.evidenceDocs.length > 1 ? 's' : ''}</Tag>
                            )}
                          </Space>
                        }
                        extra={
                          !insp.resolved ? (
                            <Button size="small" type="primary" icon={<ClipboardList size={12} />}
                              onClick={() => { setResolutionInspId(insp.id); setResolutionNotes('') }}>
                              Manage Resolution
                            </Button>
                          ) : (
                            <Button size="small" type="link" icon={<ClipboardList size={12} />}
                              onClick={() => { setResolutionInspId(insp.id); setResolutionNotes(insp.resolutionNotes ?? '') }}>
                              View Resolution Record
                            </Button>
                          )
                        }
                      >
                        {insp.followUpDueDate && (
                          <div style={{ marginBottom: 8 }}>
                            <CalendarClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            <Text type={dayjs(insp.followUpDueDate).isBefore(dayjs()) && !insp.resolved ? 'danger' : 'secondary'}>
                              Follow-up due {dayjs(insp.followUpDueDate).format('DD MMM YYYY')}
                              {dayjs(insp.followUpDueDate).isBefore(dayjs()) && !insp.resolved && ' — OVERDUE'}
                            </Text>
                          </div>
                        )}
                        {insp.findings.length > 0 ? (
                          <Table
                            size="small" pagination={false}
                            rowKey={(_, idx) => String(idx)}
                            dataSource={insp.findings}
                            columns={[
                              { title: 'Category', dataIndex: 'category', width: 140 },
                              { title: 'Severity', dataIndex: 'severity', width: 100,
                                render: (s: string) => <Tag color={SEVERITY_COLOR[s]}>{s.toUpperCase()}</Tag> },
                              { title: 'Observation', dataIndex: 'observation' },
                              { title: 'Recommendation', dataIndex: 'recommendation' },
                            ]}
                          />
                        ) : (
                          <Text type="secondary">No findings recorded.</Text>
                        )}
                        {insp.resolved && insp.resolutionNotes && (
                          <>
                            <Divider style={{ margin: '12px 0' }} />
                            <Space size={4}>
                              <CheckCheck size={13} style={{ color: '#52c41a' }} />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                <Text strong style={{ fontSize: 12 }}>Resolution: </Text>
                                {insp.resolutionNotes}
                              </Text>
                            </Space>
                            {insp.evidenceDocs.length > 0 && (
                              <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
                                {insp.evidenceDocs.length} evidence document{insp.evidenceDocs.length > 1 ? 's' : ''} on record · Resolved {dayjs(insp.resolvedAt).format('DD MMM YYYY')}
                              </div>
                            )}
                          </>
                        )}
                        {insp.notes && !insp.resolved && (
                          <>
                            <Divider style={{ margin: '12px 0' }} />
                            <Text type="secondary">{insp.notes}</Text>
                          </>
                        )}
                      </Card>
                    ))}
                  </Space>
                )}
              </Card>
            ),
          },
          {
            key: 'circulars',
            label: <Space size={6}><Bell size={14} /> Circulars ({school.circulars.length})</Space>,
            children: (
              <Card>
                {school.circulars.length === 0 ? <Empty description="No circulars" /> : (
                  <Table
                    size="small" rowKey="targetId" pagination={false}
                    dataSource={school.circulars}
                    columns={[
                      { title: 'Circular #', dataIndex: 'circularNumber', width: 160,
                        render: (v: string) => <Tag color="blue">{v}</Tag> },
                      { title: 'Title', dataIndex: 'title' },
                      { title: 'Effective', dataIndex: 'effectiveDate', width: 130,
                        render: (v: string) => dayjs(v).format('DD MMM YYYY') },
                      { title: 'Acknowledged', dataIndex: 'acknowledgedAt', width: 200,
                        render: (v: string | null) => v
                          ? <Tag color="green" icon={<CheckCircle2 size={11} />}> {dayjs(v).format('DD MMM YYYY')}</Tag>
                          : <Tag color="orange">Pending</Tag> },
                    ]}
                  />
                )}
              </Card>
            ),
          },
        ]}
      />

      {/* ── Shared Resolution Drawer ─────────────────────────────────────────── */}
      <ResolutionDrawer
        open={!!resolutionInspId}
        onClose={() => { setResolutionInspId(null); setResolutionNotes('') }}
        title={
          activeInsp ? (
            <Space>
              <ClipboardList size={16} />
              {activeInsp.resolved ? 'Resolution Record' : 'Manage Resolution'} —{' '}
              {activeInsp.inspectionType} · {dayjs(activeInsp.inspectionDate).format('DD MMM YYYY')}
            </Space>
          ) : 'Inspection Resolution'
        }
        isResolved={activeInsp?.resolved ?? false}
        resolvedAt={activeInsp?.resolvedAt}
        resolvedNotes={activeInsp?.resolutionNotes}
        actionItems={activeInsp?.actionItems ?? []}
        evidenceDocs={activeInsp?.evidenceDocs ?? []}
        resolutionNotes={resolutionNotes}
        onResolutionNotesChange={setResolutionNotes}
        categoryOptions={activeInsp?.findings.map(f => f.category) ?? []}
        actionItemLabel="Task"
        evidenceLabel="Evidence"
        onCreateActionItem={(vals) => createActionItemMutation.mutate(vals as Record<string, unknown>)}
        onUpdateActionItemStatus={(itemId, status) => {
          if (activeInsp) updateActionItemMutation.mutate({ inspId: activeInsp.id, itemId, status })
        }}
        onDeleteActionItem={(itemId) => {
          if (activeInsp) deleteActionItemMutation.mutate({ inspId: activeInsp.id, itemId })
        }}
        onCreateEvidence={(vals) => addEvidenceMutation.mutate(vals as Record<string, unknown>)}
        onDeleteEvidence={(docId) => {
          if (activeInsp) deleteEvidenceMutation.mutate({ inspId: activeInsp.id, docId })
        }}
        onResolve={() => {
          if (activeInsp) resolveInspectionMutation.mutate({ inspectionId: activeInsp.id, notes: resolutionNotes })
        }}
        resolving={resolveInspectionMutation.isPending}
        creatingActionItem={createActionItemMutation.isPending}
        creatingEvidence={addEvidenceMutation.isPending}
        summaryContent={
          activeInsp && activeInsp.findings.length > 0 ? (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                <FileSearch size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Inspection Findings ({activeInsp.findings.length})
              </Text>
              <Table
                size="small" pagination={false}
                rowKey={(_, idx) => String(idx)}
                dataSource={activeInsp.findings}
                columns={[
                  { title: 'Category', dataIndex: 'category', width: 130 },
                  { title: 'Severity', dataIndex: 'severity', width: 90,
                    render: (s: string) => <Tag color={SEVERITY_COLOR[s]}>{s.toUpperCase()}</Tag> },
                  { title: 'Observation', dataIndex: 'observation' },
                ]}
              />
            </div>
          ) : undefined
        }
      />

      {/* Renew license modal */}
      <Modal title="Renew License" open={renewModalOpen} onCancel={() => setRenewModalOpen(false)}
        onOk={() => renewForm.submit()} confirmLoading={renewMutation.isPending} okText="Renew">
        <Form form={renewForm} layout="vertical"
          onFinish={(vals) => {
            if (!renewLicenseId) return
            renewMutation.mutate({ licenseId: renewLicenseId, newExpiryDate: vals.newExpiryDate.toISOString(), notes: vals.notes })
          }}>
          <Form.Item name="newExpiryDate" label="New expiry date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Renewal notes">
            <Input.TextArea rows={3} placeholder="Conditions imposed, follow-ups required, etc." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Record inspection modal */}
      <Modal title="Record Inspection" open={inspectionModalOpen}
        onCancel={() => setInspectionModalOpen(false)}
        onOk={() => inspectionForm.submit()}
        confirmLoading={recordInspectionMutation.isPending} okText="Record" width={640}>
        <Form form={inspectionForm} layout="vertical"
          initialValues={{ inspectionType: 'ROUTINE', findings: [] }}
          onFinish={(vals) => {
            recordInspectionMutation.mutate({
              inspectionDate: vals.inspectionDate.toISOString(),
              inspectionType: vals.inspectionType,
              rating: vals.rating,
              findings: vals.findings ?? [],
              followUpDueDate: vals.followUpDueDate?.toISOString(),
              notes: vals.notes,
            })
          }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="inspectionDate" label="Inspection date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspectionType" label="Type" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'ROUTINE', label: 'Routine' }, { value: 'COMPLAINT', label: 'Complaint' },
                  { value: 'RENEWAL', label: 'Renewal' }, { value: 'FOLLOW_UP', label: 'Follow-up' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rating" label="Overall rating">
                <Select allowClear options={[
                  { value: 'EXCELLENT', label: 'Excellent' }, { value: 'GOOD', label: 'Good' },
                  { value: 'SATISFACTORY', label: 'Satisfactory' },
                  { value: 'NEEDS_IMPROVEMENT', label: 'Needs improvement' },
                  { value: 'UNSATISFACTORY', label: 'Unsatisfactory' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="followUpDueDate" label="Follow-up due date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.List name="findings">
            {(fields, { add, remove }) => (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Findings</Text>
                  <Button type="link" size="small" onClick={() => add({ severity: 'minor' })}>+ Add finding</Button>
                </div>
                {fields.map((field) => (
                  <Card key={field.key} size="small" style={{ marginBottom: 8 }}
                    extra={<Button type="link" danger size="small" onClick={() => remove(field.name)}>Remove</Button>}>
                    <Row gutter={8}>
                      <Col span={10}>
                        <Form.Item name={[field.name, 'category']} label="Category" rules={[{ required: true }]}>
                          <Input placeholder="e.g. Staffing, Facilities, Curriculum" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[field.name, 'severity']} label="Severity">
                          <Select options={[
                            { value: 'minor', label: 'Minor' }, { value: 'moderate', label: 'Moderate' },
                            { value: 'major', label: 'Major' },
                          ]} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name={[field.name, 'observation']} label="Observation" rules={[{ required: true }]}>
                      <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'recommendation']} label="Recommendation">
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Card>
                ))}
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  )
}

export default SchoolOversightPage
