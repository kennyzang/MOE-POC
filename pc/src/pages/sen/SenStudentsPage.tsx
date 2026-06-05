import { useState } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, Select, DatePicker, Drawer,
  Space, Popconfirm, message, Typography, Row, Col, Avatar, Divider,
  Timeline, Badge, Spin, Empty, InputNumber,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  HeartHandshake, Plus, Edit2, Trash2, BookOpen, Calendar, UserCheck,
} from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { StudentSearchResult } from '../../types'
import { useStudentSearch } from '../../hooks/useStudentSearch'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// ─── Types ────────────────────────────────────────────────────────────────────

interface SenRecord {
  id: string
  studentId: string
  diagnosisType: string
  supportLevel: string
  notes: string | null
  createdAt: string
  updatedAt: string
  studentName: string
  studentCode: string
  gradeLevel: string | null
  className: string | null
  avatar: string | null
  goalCount: number
  sessionCount: number
}

interface IepGoal {
  id: string
  senStudentId: string
  subject: string
  description: string
  targetDate: string
  status: string
  createdAt: string
}

interface SessionLog {
  id: string
  senStudentId: string
  date: string
  durationMins: number
  conductedBy: string
  conductedByName: string
  notes: string
  createdAt: string
}

interface SenDetail extends SenRecord {
  goals: IepGoal[]
  sessionLogs: SessionLog[]
}

type StudentOption = StudentSearchResult

// ─── Constants ────────────────────────────────────────────────────────────────

const DIAGNOSIS_TYPES = ['AUTISM', 'DYSLEXIA', 'ADHD', 'HEARING', 'VISUAL', 'PHYSICAL', 'OTHER']
const SUPPORT_LEVELS = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3']
const GOAL_STATUSES = ['active', 'achieved', 'revised']

const DIAGNOSIS_COLORS: Record<string, string> = {
  AUTISM: 'purple',
  DYSLEXIA: 'blue',
  ADHD: 'orange',
  HEARING: 'cyan',
  VISUAL: 'geekblue',
  PHYSICAL: 'gold',
  OTHER: 'default',
}

const LEVEL_COLORS: Record<string, string> = {
  LEVEL_1: 'green',
  LEVEL_2: 'orange',
  LEVEL_3: 'red',
}

const GOAL_STATUS_COLORS: Record<string, string> = {
  active: 'blue',
  achieved: 'green',
  revised: 'orange',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SenStudentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = ['admin', 'manager', 'principal', 'hod', 'counselor'].includes(user?.role ?? '')

  // List filter state
  const [diagnosisFilter, setDiagnosisFilter] = useState<string | undefined>()
  const [levelFilter, setLevelFilter] = useState<string | undefined>()

  // Register/edit modal
  const [regModalOpen, setRegModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<SenRecord | null>(null)
  const [regForm] = Form.useForm()
  const [studentSearch, setStudentSearch] = useState('')

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Goal inline add form state
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [addGoalForm] = Form.useForm()

  // Goal edit modal
  const [editGoalOpen, setEditGoalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<IepGoal | null>(null)
  const [editGoalForm] = Form.useForm()

  // Session modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [sessionForm] = Form.useForm()

  // ── Queries ────────────────────────────────────────────────────────────────

  const params = new URLSearchParams()
  if (diagnosisFilter) params.append('diagnosisType', diagnosisFilter)
  if (levelFilter) params.append('supportLevel', levelFilter)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['sen-students', diagnosisFilter, levelFilter],
    queryFn: async () => {
      const { data } = await api.get<{ data: SenRecord[] }>(`/sen/students?${params}`)
      return data.data
    },
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['sen-detail', selectedId],
    queryFn: async () => {
      const { data } = await api.get<{ data: SenDetail }>(`/sen/students/${selectedId}`)
      return data.data
    },
    enabled: !!selectedId && drawerOpen,
  })

  const { data: studentOptions = [] } = useStudentSearch(studentSearch)

  // ── Mutations ──────────────────────────────────────────────────────────────

  const registerMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/sen/students', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sen-students'] })
      message.success(t('sen.registered'))
      setRegModalOpen(false)
      regForm.resetFields()
      setStudentSearch('')
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      api.put(`/sen/students/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sen-students'] })
      queryClient.invalidateQueries({ queryKey: ['sen-detail', selectedId] })
      message.success(t('common.success'))
      setRegModalOpen(false)
      setEditingRecord(null)
      regForm.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sen/students/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sen-students'] })
      message.success(t('sen.removed'))
      if (drawerOpen) { setDrawerOpen(false); setSelectedId(null) }
    },
    onError: () => message.error(t('common.error')),
  })

  const addGoalMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      api.post(`/sen/students/${selectedId}/goals`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sen-detail', selectedId] })
      queryClient.invalidateQueries({ queryKey: ['sen-students'] })
      message.success(t('sen.goalAdded'))
      setShowAddGoal(false)
      addGoalForm.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const updateGoalMutation = useMutation({
    mutationFn: ({ goalId, values }: { goalId: string; values: Record<string, unknown> }) =>
      api.put(`/sen/goals/${goalId}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sen-detail', selectedId] })
      message.success(t('common.success'))
      setEditGoalOpen(false)
      setEditingGoal(null)
    },
    onError: () => message.error(t('common.error')),
  })

  const deleteGoalMutation = useMutation({
    mutationFn: (goalId: string) => api.delete(`/sen/goals/${goalId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sen-detail', selectedId] })
      queryClient.invalidateQueries({ queryKey: ['sen-students'] })
      message.success(t('sen.goalDeleted'))
    },
    onError: () => message.error(t('common.error')),
  })

  // Inline status change — fires immediately
  const patchGoalStatusMutation = useMutation({
    mutationFn: ({ goalId, status }: { goalId: string; status: string }) =>
      api.put(`/sen/goals/${goalId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sen-detail', selectedId] }),
    onError: () => message.error(t('common.error')),
  })

  const addSessionMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      api.post(`/sen/students/${selectedId}/sessions`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sen-detail', selectedId] })
      queryClient.invalidateQueries({ queryKey: ['sen-students'] })
      message.success(t('sen.sessionLogged'))
      setSessionModalOpen(false)
      sessionForm.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/sen/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sen-detail', selectedId] })
      queryClient.invalidateQueries({ queryKey: ['sen-students'] })
      message.success(t('sen.sessionDeleted'))
    },
    onError: () => message.error(t('common.error')),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openRegister = () => {
    setEditingRecord(null)
    regForm.resetFields()
    setStudentSearch('')
    setRegModalOpen(true)
  }

  const openEdit = (record: SenRecord) => {
    setEditingRecord(record)
    regForm.setFieldsValue({
      diagnosisType: record.diagnosisType,
      supportLevel: record.supportLevel,
      notes: record.notes ?? '',
    })
    setRegModalOpen(true)
  }

  const handleRegisterSubmit = async () => {
    const values = await regForm.validateFields()
    if (editingRecord) {
      updateRecordMutation.mutate({ id: editingRecord.id, values })
    } else {
      registerMutation.mutate(values)
    }
  }

  const openDrawer = (record: SenRecord) => {
    setSelectedId(record.id)
    setShowAddGoal(false)
    addGoalForm.resetFields()
    setDrawerOpen(true)
  }

  const openEditGoal = (goal: IepGoal) => {
    setEditingGoal(goal)
    editGoalForm.setFieldsValue({
      subject: goal.subject,
      description: goal.description,
      targetDate: dayjs(goal.targetDate),
      status: goal.status,
    })
    setEditGoalOpen(true)
  }

  const openSessionModal = () => {
    sessionForm.setFieldsValue({
      date: dayjs(),
      durationMins: 60,
      conductedBy: user?.displayName ?? '',
    })
    setSessionModalOpen(true)
  }

  const handleAddGoal = async () => {
    const values = await addGoalForm.validateFields()
    addGoalMutation.mutate({ ...values, targetDate: values.targetDate.toISOString() })
  }

  const handleLogSession = async () => {
    const values = await sessionForm.validateFields()
    addSessionMutation.mutate({
      ...values,
      date: values.date.toISOString(),
      durationMins: values.durationMins,
    })
  }

  // ── SEN list columns ──────────────────────────────────────────────────────

  const columns: ColumnsType<SenRecord> = [
    {
      title: t('sen.studentName'),
      key: 'student',
      render: (_: unknown, r: SenRecord) => (
        <Space>
          <Avatar size={32} style={{ background: '#1677ff', flexShrink: 0 }}>
            {r.studentName.charAt(0)}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13 }}>{r.studentName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{r.studentCode}{r.className ? ` · ${r.className}` : ''}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: t('sen.diagnosisType'),
      dataIndex: 'diagnosisType',
      width: 120,
      render: (v: string) => (
        <Tag color={DIAGNOSIS_COLORS[v] ?? 'default'}>{t(`sen.diagnosis_${v.toLowerCase()}`, { defaultValue: v })}</Tag>
      ),
    },
    {
      title: t('sen.supportLevel'),
      dataIndex: 'supportLevel',
      width: 110,
      render: (v: string) => (
        <Tag color={LEVEL_COLORS[v] ?? 'default'}>{t(`sen.level_${v.toLowerCase().replace('_', '')}`, { defaultValue: v })}</Tag>
      ),
    },
    {
      title: t('sen.iepGoals'),
      dataIndex: 'goalCount',
      width: 90,
      render: (v: number) => <Badge count={v} showZero style={{ backgroundColor: v > 0 ? '#1677ff' : '#d9d9d9' }} />,
    },
    {
      title: t('sen.sessions'),
      dataIndex: 'sessionCount',
      width: 90,
      render: (v: number) => <Badge count={v} showZero style={{ backgroundColor: v > 0 ? '#52c41a' : '#d9d9d9' }} />,
    },
    {
      title: t('common.actions'),
      width: 150,
      render: (_: unknown, record: SenRecord) => (
        <Space size={4}>
          <Button size="small" icon={<BookOpen size={12} />} onClick={() => openDrawer(record)}>
            {t('sen.iep')}
          </Button>
          {canManage && (
            <>
              <Button size="small" icon={<Edit2 size={12} />} onClick={e => { e.stopPropagation(); openEdit(record) }} />
              <Popconfirm
                title={t('sen.removeConfirm')}
                description={t('sen.removeConfirmDesc')}
                onConfirm={() => deleteMutation.mutate(record.id)}
                okText={t('common.delete')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<Trash2 size={12} />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  // ── Goal columns ──────────────────────────────────────────────────────────

  const goalColumns: ColumnsType<IepGoal> = [
    {
      title: t('sen.subject'),
      dataIndex: 'subject',
      width: 100,
    },
    {
      title: t('sen.goalDescription'),
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: t('sen.targetDate'),
      dataIndex: 'targetDate',
      width: 110,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 130,
      render: (v: string, record: IepGoal) => (
        <Select
          size="small"
          value={v}
          style={{ width: 110 }}
          onChange={status => patchGoalStatusMutation.mutate({ goalId: record.id, status })}
          loading={patchGoalStatusMutation.isPending}
          disabled={!canManage}
        >
          {GOAL_STATUSES.map(s => (
            <Option key={s} value={s}>
              <Tag color={GOAL_STATUS_COLORS[s]} style={{ margin: 0 }}>
                {t(`sen.goalStatus_${s}`, { defaultValue: s })}
              </Tag>
            </Option>
          ))}
        </Select>
      ),
    },
    ...(canManage ? [{
      title: '',
      width: 72,
      render: (_: unknown, record: IepGoal) => (
        <Space size={4}>
          <Button size="small" icon={<Edit2 size={12} />} onClick={() => openEditGoal(record)} />
          <Popconfirm
            title={t('sen.deleteGoalConfirm')}
            onConfirm={() => deleteGoalMutation.mutate(record.id)}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </Space>
      ),
    }] as ColumnsType<IepGoal> : []),
  ]

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HeartHandshake size={22} color="#1677ff" />
          <Title level={4} style={{ margin: 0 }}>{t('sen.title')}</Title>
        </div>
        {canManage && (
          <Button type="primary" icon={<Plus size={14} />} onClick={openRegister}>
            {t('sen.registerStudent')}
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder={t('sen.diagnosisType')}
          value={diagnosisFilter}
          onChange={setDiagnosisFilter}
          style={{ width: 180 }}
        >
          {DIAGNOSIS_TYPES.map(d => (
            <Option key={d} value={d}>
              <Tag color={DIAGNOSIS_COLORS[d]} style={{ margin: 0 }}>{t(`sen.diagnosis_${d.toLowerCase()}`, { defaultValue: d })}</Tag>
            </Option>
          ))}
        </Select>
        <Select
          allowClear
          placeholder={t('sen.supportLevel')}
          value={levelFilter}
          onChange={setLevelFilter}
          style={{ width: 150 }}
        >
          {SUPPORT_LEVELS.map(l => (
            <Option key={l} value={l}>
              <Tag color={LEVEL_COLORS[l]} style={{ margin: 0 }}>{t(`sen.level_${l.toLowerCase().replace('_', '')}`, { defaultValue: l })}</Tag>
            </Option>
          ))}
        </Select>
      </Space>

      <Table<SenRecord>
        dataSource={records}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 15 }}
        onRow={record => ({ onClick: () => openDrawer(record), style: { cursor: 'pointer' } })}
      />

      {/* ── Register / Edit Modal ── */}
      <Modal
        title={editingRecord ? t('sen.editRecord') : t('sen.registerStudent')}
        open={regModalOpen}
        onOk={handleRegisterSubmit}
        onCancel={() => { setRegModalOpen(false); setEditingRecord(null); regForm.resetFields() }}
        confirmLoading={registerMutation.isPending || updateRecordMutation.isPending}
        okText={editingRecord ? t('common.save') : t('common.submit')}
        destroyOnClose
      >
        <Form form={regForm} layout="vertical" style={{ marginTop: 16 }}>
          {!editingRecord && (
            <Form.Item name="studentId" label={t('sen.selectStudent')} rules={[{ required: true }]}>
              <Select
                showSearch
                filterOption={false}
                onSearch={v => setStudentSearch(v)}
                placeholder={t('sen.searchStudent')}
                notFoundContent={studentSearch.length < 2 ? t('exams.typeToSearch') : t('common.noData')}
              >
                {studentOptions.map(s => (
                  <Option key={s.id} value={s.id}>
                    {s.user.displayName} ({s.studentId}){s.className ? ` · ${s.className}` : ''}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="diagnosisType" label={t('sen.diagnosisType')} rules={[{ required: true }]}>
                <Select>
                  {DIAGNOSIS_TYPES.map(d => (
                    <Option key={d} value={d}>
                      {t(`sen.diagnosis_${d.toLowerCase()}`, { defaultValue: d })}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supportLevel" label={t('sen.supportLevel')} rules={[{ required: true }]}>
                <Select>
                  {SUPPORT_LEVELS.map(l => (
                    <Option key={l} value={l}>
                      {t(`sen.level_${l.toLowerCase().replace('_', '')}`, { defaultValue: l })}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label={t('sen.notes')}>
            <TextArea rows={3} placeholder={t('sen.notesPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── IEP Drawer ── */}
      <Drawer
        title={
          detail ? (
            <Space>
              <HeartHandshake size={16} color="#1677ff" />
              <span>{t('sen.iepProfile')}</span>
              <Tag color={DIAGNOSIS_COLORS[detail.diagnosisType] ?? 'default'}>
                {t(`sen.diagnosis_${detail.diagnosisType.toLowerCase()}`, { defaultValue: detail.diagnosisType })}
              </Tag>
              <Tag color={LEVEL_COLORS[detail.supportLevel] ?? 'default'}>
                {t(`sen.level_${detail.supportLevel.toLowerCase().replace('_', '')}`, { defaultValue: detail.supportLevel })}
              </Tag>
            </Space>
          ) : t('sen.iepProfile')
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedId(null); setShowAddGoal(false) }}
        width={720}
        destroyOnClose
      >
        {detailLoading || !detail ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
        ) : (
          <div>
            {/* ── Section 1: Student Info Header ── */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              padding: '0 0 20px', borderBottom: '1px solid #f0f0f0', marginBottom: 24,
            }}>
              <Avatar size={64} style={{ background: 'linear-gradient(135deg, #1677ff, #0958d9)', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
                {detail.studentName.charAt(0)}
              </Avatar>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text strong style={{ fontSize: 16 }}>{detail.studentName}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{detail.studentCode}</Text>
                  {detail.className && <Tag>{detail.className}</Tag>}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Tag color={DIAGNOSIS_COLORS[detail.diagnosisType] ?? 'default'} style={{ marginRight: 6 }}>
                    {t(`sen.diagnosis_${detail.diagnosisType.toLowerCase()}`, { defaultValue: detail.diagnosisType })}
                  </Tag>
                  <Tag color={LEVEL_COLORS[detail.supportLevel] ?? 'default'}>
                    {t(`sen.level_${detail.supportLevel.toLowerCase().replace('_', '')}`, { defaultValue: detail.supportLevel })}
                  </Tag>
                </div>
                {detail.notes && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>{detail.notes}</Text>
                )}
              </div>
              {canManage && (
                <Button size="small" icon={<Edit2 size={12} />} onClick={() => { setDrawerOpen(false); openEdit(detail) }}>
                  {t('common.edit')}
                </Button>
              )}
            </div>

            {/* ── Section 2: IEP Goals ── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Space>
                  <BookOpen size={16} color="#1677ff" />
                  <Text strong style={{ fontSize: 14 }}>{t('sen.iepGoals')}</Text>
                  <Badge count={detail.goals.length} style={{ backgroundColor: '#1677ff' }} />
                </Space>
                {canManage && !showAddGoal && (
                  <Button size="small" icon={<Plus size={12} />} onClick={() => setShowAddGoal(true)}>
                    {t('sen.addGoal')}
                  </Button>
                )}
              </div>

              {/* Inline add goal form */}
              {showAddGoal && (
                <div style={{ background: '#f8f9fa', border: '1px solid #e8e8e8', borderRadius: 6, padding: 12, marginBottom: 12 }}>
                  <Form form={addGoalForm} layout="vertical" size="small">
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item name="subject" label={t('sen.subject')} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                          <Input placeholder="e.g. Reading" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="targetDate" label={t('sen.targetDate')} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                          <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="status" label={t('common.status')} initialValue="active" style={{ marginBottom: 8 }}>
                          <Select>
                            {GOAL_STATUSES.map(s => <Option key={s} value={s}>{t(`sen.goalStatus_${s}`, { defaultValue: s })}</Option>)}
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="description" label={t('sen.goalDescription')} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                      <TextArea rows={2} placeholder={t('sen.goalDescPlaceholder')} />
                    </Form.Item>
                    <Space>
                      <Button type="primary" size="small" onClick={handleAddGoal} loading={addGoalMutation.isPending}>
                        {t('sen.addGoal')}
                      </Button>
                      <Button size="small" onClick={() => { setShowAddGoal(false); addGoalForm.resetFields() }}>
                        {t('common.cancel')}
                      </Button>
                    </Space>
                  </Form>
                </div>
              )}

              {detail.goals.length === 0 && !showAddGoal ? (
                <Empty description={t('sen.noGoals')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Table<IepGoal>
                  dataSource={detail.goals}
                  columns={goalColumns}
                  rowKey="id"
                  size="small"
                  pagination={false}
                />
              )}
            </div>

            <Divider />

            {/* ── Section 3: Session Log ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Space>
                  <Calendar size={16} color="#52c41a" />
                  <Text strong style={{ fontSize: 14 }}>{t('sen.sessionLog')}</Text>
                  <Badge count={detail.sessionLogs.length} style={{ backgroundColor: '#52c41a' }} />
                </Space>
                {canManage && (
                  <Button size="small" icon={<Plus size={12} />} onClick={openSessionModal}>
                    {t('sen.logSession')}
                  </Button>
                )}
              </div>

              {detail.sessionLogs.length === 0 ? (
                <Empty description={t('sen.noSessions')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Timeline
                  items={detail.sessionLogs.map(s => ({
                    color: 'green',
                    children: (
                      <div style={{ paddingBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <Text strong style={{ fontSize: 13 }}>
                              {dayjs(s.date).format('DD MMM YYYY')}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                              {s.durationMins} {t('sen.mins')}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                              · <UserCheck size={11} style={{ verticalAlign: 'middle' }} /> {s.conductedByName}
                            </Text>
                          </div>
                          {canManage && (
                            <Popconfirm
                              title={t('sen.deleteSessionConfirm')}
                              onConfirm={() => deleteSessionMutation.mutate(s.id)}
                              okText={t('common.delete')}
                              cancelText={t('common.cancel')}
                              okButtonProps={{ danger: true }}
                            >
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<Trash2 size={12} />}
                                style={{ flexShrink: 0 }}
                              />
                            </Popconfirm>
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{s.notes}</Text>
                      </div>
                    ),
                  }))}
                />
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Edit Goal Modal ── */}
      <Modal
        title={t('sen.editGoal')}
        open={editGoalOpen}
        onOk={() => editGoalForm.validateFields().then(values =>
          updateGoalMutation.mutate({ goalId: editingGoal!.id, values: { ...values, targetDate: values.targetDate.toISOString() } })
        )}
        onCancel={() => { setEditGoalOpen(false); setEditingGoal(null) }}
        confirmLoading={updateGoalMutation.isPending}
        okText={t('common.save')}
        destroyOnClose
      >
        <Form form={editGoalForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="subject" label={t('sen.subject')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="targetDate" label={t('sen.targetDate')} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label={t('sen.goalDescription')} rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="status" label={t('common.status')}>
            <Select>
              {GOAL_STATUSES.map(s => <Option key={s} value={s}>{t(`sen.goalStatus_${s}`, { defaultValue: s })}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Log Session Modal ── */}
      <Modal
        title={t('sen.logSession')}
        open={sessionModalOpen}
        onOk={handleLogSession}
        onCancel={() => { setSessionModalOpen(false); sessionForm.resetFields() }}
        confirmLoading={addSessionMutation.isPending}
        okText={t('sen.logSession')}
        destroyOnClose
      >
        <Form form={sessionForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date" label={t('common.date')} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="durationMins" label={t('sen.durationMins')} rules={[{ required: true }]}>
                <InputNumber min={5} max={480} step={15} style={{ width: '100%' }} addonAfter={t('sen.mins')} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="conductedBy" label={t('sen.conductedBy')} rules={[{ required: true }]}>
            <Input placeholder={t('sen.conductedByPlaceholder')} />
          </Form.Item>
          <Form.Item name="notes" label={t('sen.sessionNotes')} rules={[{ required: true }]}>
            <TextArea rows={3} placeholder={t('sen.sessionNotesPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
