import { useState } from 'react'
import {
  Table, Button, Tag, Modal, Form, Input, Select, DatePicker, InputNumber,
  Drawer, Tabs, Space, Popconfirm, message, Alert, Spin, Divider, Radio,
  Typography, Row, Col, Statistic,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, Edit2, Trash2, Users, LayoutGrid, FileText, RefreshCw } from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'
import FileUploader from '../../components/FileUploader'
import FileList from '../../components/FileList'
import { useAuthStore } from '../../stores/authStore'
import type { StudentSearchResult } from '../../types'
import { useStudentSearch } from '../../hooks/useStudentSearch'

const { Title, Text } = Typography
const { Option } = Select

// ─── Types ──────────────────────────────────────────────────────────────────

interface Exam {
  id: string
  schoolId: string
  examType: string
  year: number
  examDate: string
  venue: string | null
  status: string
  candidateCount: number
  createdAt: string
}

interface ExamCandidate {
  id: string
  examId: string
  studentId: string
  subjectCode: string
  seatNumber: string | null
  status: string
  studentName: string
  studentCode: string
  icNumber: string | null
  gradeLevel: string | null
  className: string | null
}

type StudentOption = StudentSearchResult

// ─── Constants ───────────────────────────────────────────────────────────────

const EXAM_TYPES = ['PSR', 'O_LEVEL', 'A_LEVEL', 'IGCSE']
const EXAM_STATUS = ['upcoming', 'ongoing', 'completed']
const SUBJECTS = ['ENG', 'MAL', 'MATH', 'SCI', 'HIS', 'GEO', 'ICT', 'ART', 'PE', 'REL']
const GRADE_LEVELS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13']
const CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E']

const EXAM_TYPE_LABELS: Record<string, string> = {
  PSR: 'PSR',
  O_LEVEL: 'O Level',
  A_LEVEL: 'A Level',
  IGCSE: 'IGCSE',
}

const EXAM_TYPE_COLORS: Record<string, string> = {
  PSR: 'blue',
  O_LEVEL: 'purple',
  A_LEVEL: 'magenta',
  IGCSE: 'cyan',
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'orange',
  ongoing: 'green',
  completed: 'default',
}

const CANDIDATE_STATUS_COLORS: Record<string, string> = {
  registered: 'blue',
  present: 'green',
  absent: 'red',
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ExamsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = ['admin', 'manager', 'principal'].includes(user?.role ?? '')

  // List state
  const [examForm] = Form.useForm()
  const [examModalOpen, setExamModalOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<Exam | null>(null)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [activeTab, setActiveTab] = useState('candidates')

  // Candidate filters
  const [subjectFilter, setSubjectFilter] = useState<string | undefined>()
  const [markingMode, setMarkingMode] = useState(false)
  const [attendanceChanges, setAttendanceChanges] = useState<Record<string, string>>({})

  // Add candidates state
  const [addClassModalOpen, setAddClassModalOpen] = useState(false)
  const [addIndivModalOpen, setAddIndivModalOpen] = useState(false)
  const [classForm] = Form.useForm()
  const [indivForm] = Form.useForm()
  const [studentSearch, setStudentSearch] = useState('')

  // Seating
  const [seatingLoading, setSeatingLoading] = useState(false)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Exam[] }>('/exams')
      return data.data
    },
  })

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ['exam-candidates', selectedExam?.id, subjectFilter],
    queryFn: async () => {
      const params = subjectFilter ? `?subjectCode=${subjectFilter}` : ''
      const { data } = await api.get<{ data: ExamCandidate[] }>(`/exams/${selectedExam!.id}/candidates${params}`)
      return data.data
    },
    enabled: !!selectedExam && drawerOpen && activeTab === 'candidates',
  })

  const { data: seatingPlan = [], isLoading: seatingLoading2 } = useQuery({
    queryKey: ['exam-seating', selectedExam?.id],
    queryFn: async () => {
      const { data } = await api.get<{ data: ExamCandidate[] }>(`/exams/${selectedExam!.id}/seating-plan`)
      return data.data
    },
    enabled: !!selectedExam && drawerOpen && activeTab === 'seating',
  })

  const { data: studentOptions = [] } = useStudentSearch(studentSearch)

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createExamMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/exams', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      message.success(t('exams.created'))
      setExamModalOpen(false)
      examForm.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const updateExamMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) => api.put(`/exams/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      message.success(t('common.success'))
      setExamModalOpen(false)
      setEditingExam(null)
      examForm.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const deleteExamMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/exams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      message.success(t('exams.deleted'))
      if (drawerOpen && selectedExam?.id) { setDrawerOpen(false); setSelectedExam(null) }
    },
    onError: () => message.error(t('common.error')),
  })

  const addByClassMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      api.post(`/exams/${selectedExam!.id}/candidates`, { mode: 'class', ...values }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['exam-candidates', selectedExam?.id] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      message.success((res.data as { message: string }).message)
      setAddClassModalOpen(false)
      classForm.resetFields()
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const addIndivMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      api.post(`/exams/${selectedExam!.id}/candidates`, { mode: 'individual', ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-candidates', selectedExam?.id] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      message.success(t('exams.candidateAdded'))
      setAddIndivModalOpen(false)
      indivForm.resetFields()
      setStudentSearch('')
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      message.error(err?.response?.data?.message ?? t('common.error')),
  })

  const removeCandidateMutation = useMutation({
    mutationFn: (candidateId: string) =>
      api.delete(`/exams/${selectedExam!.id}/candidates/${candidateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-candidates', selectedExam?.id] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      message.success(t('exams.candidateRemoved'))
    },
    onError: () => message.error(t('common.error')),
  })

  const patchCandidateMutation = useMutation({
    mutationFn: ({ candidateId, status }: { candidateId: string; status: string }) =>
      api.patch(`/exams/${selectedExam!.id}/candidates/${candidateId}`, { status }),
    onError: () => message.error(t('common.error')),
  })

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setEditingExam(null)
    examForm.resetFields()
    setExamModalOpen(true)
  }

  const openEditModal = (exam: Exam) => {
    setEditingExam(exam)
    examForm.setFieldsValue({
      examType: exam.examType,
      year: exam.year,
      examDate: dayjs(exam.examDate),
      venue: exam.venue ?? '',
      status: exam.status,
    })
    setExamModalOpen(true)
  }

  const handleExamSubmit = async () => {
    const values = await examForm.validateFields()
    const payload = { ...values, examDate: values.examDate.toISOString() }
    if (editingExam) {
      updateExamMutation.mutate({ id: editingExam.id, values: payload })
    } else {
      createExamMutation.mutate(payload)
    }
  }

  const openDrawer = (exam: Exam) => {
    setSelectedExam(exam)
    setActiveTab('candidates')
    setMarkingMode(false)
    setAttendanceChanges({})
    setSubjectFilter(undefined)
    setDrawerOpen(true)
  }

  const handleGenerateSeating = async () => {
    if (!selectedExam) return
    setSeatingLoading(true)
    try {
      await api.post(`/exams/${selectedExam.id}/generate-seating`)
      queryClient.invalidateQueries({ queryKey: ['exam-seating', selectedExam.id] })
      message.success(t('exams.seatingGenerated'))
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      message.error(axiosErr?.response?.data?.message ?? t('common.error'))
    } finally {
      setSeatingLoading(false)
    }
  }

  const handleSaveAttendance = async () => {
    const entries = Object.entries(attendanceChanges)
    if (!entries.length) { message.info(t('exams.noChanges')); return }
    await Promise.all(entries.map(([candidateId, status]) => patchCandidateMutation.mutateAsync({ candidateId, status })))
    queryClient.invalidateQueries({ queryKey: ['exam-candidates', selectedExam?.id] })
    setMarkingMode(false)
    setAttendanceChanges({})
    message.success(t('exams.attendanceSaved'))
  }

  // ── Exam list columns ─────────────────────────────────────────────────────

  const examColumns: ColumnsType<Exam> = [
    {
      title: t('exams.examType'),
      dataIndex: 'examType',
      width: 100,
      render: (v: string) => <Tag color={EXAM_TYPE_COLORS[v] ?? 'default'}>{EXAM_TYPE_LABELS[v] ?? v}</Tag>,
    },
    { title: t('exams.year'), dataIndex: 'year', width: 80 },
    {
      title: t('exams.examDate'),
      dataIndex: 'examDate',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: t('exams.venue'),
      dataIndex: 'venue',
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: t('exams.candidates'),
      dataIndex: 'candidateCount',
      width: 100,
      render: (v: number) => <Tag>{v}</Tag>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{t(`exams.${v}`, { defaultValue: v })}</Tag>,
    },
    {
      title: t('common.actions'),
      width: 140,
      render: (_: unknown, record: Exam) => (
        <Space size={4}>
          <Button size="small" icon={<Users size={12} />} onClick={() => openDrawer(record)}>
            {t('common.view')}
          </Button>
          {canManage && (
            <>
              <Button size="small" icon={<Edit2 size={12} />} onClick={e => { e.stopPropagation(); openEditModal(record) }} />
              <Popconfirm
                title={t('exams.deleteConfirm')}
                onConfirm={() => deleteExamMutation.mutate(record.id)}
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

  // ── Candidate columns ─────────────────────────────────────────────────────

  const candidateColumns: ColumnsType<ExamCandidate> = [
    { title: t('exams.studentName'), dataIndex: 'studentName' },
    {
      title: t('exams.class'),
      dataIndex: 'className',
      width: 80,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: t('exams.subject'),
      dataIndex: 'subjectCode',
      width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: t('exams.seatNumber'),
      dataIndex: 'seatNumber',
      width: 90,
      render: (v: string | null) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 130,
      render: (v: string, record: ExamCandidate) => {
        if (markingMode) {
          const current = attendanceChanges[record.id] ?? v
          return (
            <Radio.Group
              size="small"
              value={current}
              onChange={e => setAttendanceChanges(prev => ({ ...prev, [record.id]: e.target.value }))}
            >
              <Radio.Button value="present" style={{ color: current === 'present' ? '#52c41a' : undefined }}>P</Radio.Button>
              <Radio.Button value="absent" style={{ color: current === 'absent' ? '#ff4d4f' : undefined }}>A</Radio.Button>
              <Radio.Button value="registered">—</Radio.Button>
            </Radio.Group>
          )
        }
        return <Tag color={CANDIDATE_STATUS_COLORS[v] ?? 'default'}>{t(`exams.status_${v}`, { defaultValue: v })}</Tag>
      },
    },
    ...(canManage && !markingMode ? [{
      title: '',
      width: 48,
      render: (_: unknown, record: ExamCandidate) => (
        <Popconfirm
          title={t('exams.removeCandidateConfirm')}
          onConfirm={() => removeCandidateMutation.mutate(record.id)}
          okText={t('common.delete')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger icon={<Trash2 size={12} />} />
        </Popconfirm>
      ),
    }] as ColumnsType<ExamCandidate> : []),
  ]

  // ── Seating plan columns ──────────────────────────────────────────────────

  const seatingColumns: ColumnsType<ExamCandidate> = [
    {
      title: t('exams.seatNumber'),
      dataIndex: 'seatNumber',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: t('exams.studentName'), dataIndex: 'studentName' },
    {
      title: t('exams.icNumber'),
      dataIndex: 'icNumber',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: t('exams.subject'),
      dataIndex: 'subjectCode',
      width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
  ]

  // ── Stats in drawer header ────────────────────────────────────────────────

  const presentCount = candidates.filter(c => c.status === 'present').length
  const absentCount = candidates.filter(c => c.status === 'absent').length
  const registeredCount = candidates.filter(c => c.status === 'registered').length

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClipboardList size={22} color="#1677ff" />
          <Title level={4} style={{ margin: 0 }}>{t('exams.title')}</Title>
        </div>
        {canManage && (
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreateModal}>
            {t('exams.createExam')}
          </Button>
        )}
      </div>

      <Table<Exam>
        dataSource={exams}
        columns={examColumns}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 15 }}
        onRow={record => ({ onDoubleClick: () => openDrawer(record), style: { cursor: 'pointer' } })}
      />

      {/* ── Create / Edit Exam Modal ── */}
      <Modal
        title={editingExam ? t('exams.editExam') : t('exams.createExam')}
        open={examModalOpen}
        onOk={handleExamSubmit}
        onCancel={() => { setExamModalOpen(false); setEditingExam(null); examForm.resetFields() }}
        confirmLoading={createExamMutation.isPending || updateExamMutation.isPending}
        okText={editingExam ? t('common.save') : t('common.submit')}
        destroyOnClose
      >
        <Form form={examForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="examType" label={t('exams.examType')} rules={[{ required: true }]}>
                <Select>
                  {EXAM_TYPES.map(et => (
                    <Option key={et} value={et}>{EXAM_TYPE_LABELS[et]}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="year" label={t('exams.year')} rules={[{ required: true }]}>
                <InputNumber min={2020} max={2050} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="examDate" label={t('exams.examDate')} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="venue" label={t('exams.venue')}>
                <Input placeholder={t('exams.venuePlaceholder')} />
              </Form.Item>
            </Col>
          </Row>
          {editingExam && (
            <Form.Item name="status" label={t('common.status')}>
              <Select>
                {EXAM_STATUS.map(s => (
                  <Option key={s} value={s}>{t(`exams.${s}`, { defaultValue: s })}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* ── Exam Detail Drawer ── */}
      <Drawer
        title={
          selectedExam ? (
            <Space>
              <Tag color={EXAM_TYPE_COLORS[selectedExam.examType] ?? 'default'}>
                {EXAM_TYPE_LABELS[selectedExam.examType] ?? selectedExam.examType}
              </Tag>
              <span>{selectedExam.year}</span>
              {selectedExam.venue && <Text type="secondary" style={{ fontSize: 13 }}>· {selectedExam.venue}</Text>}
              <Tag color={STATUS_COLORS[selectedExam.status] ?? 'default'}>
                {t(`exams.${selectedExam.status}`, { defaultValue: selectedExam.status })}
              </Tag>
            </Space>
          ) : ''
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedExam(null); setMarkingMode(false); setAttendanceChanges({}) }}
        width={840}
        destroyOnClose
      >
        {selectedExam && (
          <Tabs
            activeKey={activeTab}
            onChange={key => { setActiveTab(key); setMarkingMode(false); setAttendanceChanges({}) }}
            items={[
              {
                key: 'candidates',
                label: (
                  <span>
                    <Users size={14} style={{ marginRight: 6 }} />
                    {t('exams.candidates')}
                    <Tag style={{ marginLeft: 6 }}>{selectedExam.candidateCount}</Tag>
                  </span>
                ),
                children: (
                  <div>
                    {/* Stats row */}
                    {candidates.length > 0 && (
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col span={6}><Statistic title={t('exams.total')} value={candidates.length} /></Col>
                        <Col span={6}><Statistic title={t('exams.status_present')} value={presentCount} valueStyle={{ color: '#52c41a' }} /></Col>
                        <Col span={6}><Statistic title={t('exams.status_absent')} value={absentCount} valueStyle={{ color: '#ff4d4f' }} /></Col>
                        <Col span={6}><Statistic title={t('exams.status_registered')} value={registeredCount} /></Col>
                      </Row>
                    )}

                    {/* Toolbar */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      <Select
                        allowClear
                        placeholder={t('exams.filterBySubject')}
                        value={subjectFilter}
                        onChange={v => setSubjectFilter(v)}
                        style={{ width: 160 }}
                      >
                        {SUBJECTS.map(s => <Option key={s} value={s}>{s}</Option>)}
                      </Select>
                      {canManage && !markingMode && (
                        <>
                          <Button icon={<Plus size={13} />} onClick={() => setAddClassModalOpen(true)}>
                            {t('exams.addByClass')}
                          </Button>
                          <Button icon={<Plus size={13} />} onClick={() => setAddIndivModalOpen(true)}>
                            {t('exams.addIndividual')}
                          </Button>
                        </>
                      )}
                      <div style={{ flex: 1 }} />
                      {canManage && (
                        markingMode ? (
                          <Space>
                            <Button onClick={() => { setMarkingMode(false); setAttendanceChanges({}) }}>
                              {t('common.cancel')}
                            </Button>
                            <Button type="primary" onClick={handleSaveAttendance} loading={patchCandidateMutation.isPending}>
                              {t('exams.saveAttendance')}
                            </Button>
                          </Space>
                        ) : (
                          <Button icon={<ClipboardList size={13} />} onClick={() => setMarkingMode(true)}>
                            {t('exams.markAttendance')}
                          </Button>
                        )
                      )}
                    </div>

                    <Table<ExamCandidate>
                      dataSource={candidates}
                      columns={candidateColumns}
                      rowKey="id"
                      loading={candidatesLoading}
                      size="small"
                      pagination={{ pageSize: 20 }}
                    />
                  </div>
                ),
              },
              {
                key: 'seating',
                label: (
                  <span>
                    <LayoutGrid size={14} style={{ marginRight: 6 }} />
                    {t('exams.seatingPlan')}
                  </span>
                ),
                children: (
                  <div>
                    {seatingLoading2 ? (
                      <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                    ) : seatingPlan.length === 0 ? (
                      <Alert
                        type="info"
                        message={t('exams.noSeatingYet')}
                        description={t('exams.noSeatingDesc')}
                        style={{ marginBottom: 16 }}
                        action={
                          canManage && (
                            <Button
                              type="primary"
                              loading={seatingLoading}
                              onClick={handleGenerateSeating}
                              icon={<RefreshCw size={13} />}
                            >
                              {t('exams.generateSeating')}
                            </Button>
                          )
                        }
                      />
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
                          {canManage && (
                            <Popconfirm
                              title={t('exams.regenerateConfirm')}
                              onConfirm={handleGenerateSeating}
                              okText={t('exams.regenerate')}
                              cancelText={t('common.cancel')}
                            >
                              <Button icon={<RefreshCw size={13} />} loading={seatingLoading}>
                                {t('exams.regenerate')}
                              </Button>
                            </Popconfirm>
                          )}
                        </div>
                        <Table<ExamCandidate>
                          dataSource={seatingPlan}
                          columns={seatingColumns}
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 30 }}
                        />
                      </>
                    )}
                  </div>
                ),
              },
              {
                key: 'transcripts',
                label: (
                  <span>
                    <FileText size={14} style={{ marginRight: 6 }} />
                    {t('exams.transcripts')}
                  </span>
                ),
                children: (
                  <div>
                    {canManage && (
                      <>
                        <Text strong>{t('exams.uploadTranscript')}</Text>
                        <div style={{ marginTop: 8, marginBottom: 16 }}>
                          <FileUploader
                            entityType="exam"
                            entityId={selectedExam.id}
                            description={`${selectedExam.examType} ${selectedExam.year} transcript`}
                            accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                          />
                        </div>
                        <Divider />
                      </>
                    )}
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('exams.uploadedFiles')}</Text>
                    <FileList entityType="exam" entityId={selectedExam.id} canDelete={canManage} />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* ── Add by Class Modal ── */}
      <Modal
        title={t('exams.addByClass')}
        open={addClassModalOpen}
        onOk={() => classForm.validateFields().then(vals => addByClassMutation.mutate(vals))}
        onCancel={() => { setAddClassModalOpen(false); classForm.resetFields() }}
        confirmLoading={addByClassMutation.isPending}
        okText={t('exams.addCandidates')}
        destroyOnClose
      >
        <Form form={classForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="gradeLevel" label={t('exams.gradeLevel')} rules={[{ required: true }]}>
                <Select placeholder={t('exams.selectGrade')}>
                  {GRADE_LEVELS.map(g => <Option key={g} value={g}>{g}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="className" label={t('exams.class')}>
                <Select allowClear placeholder={t('exams.allClasses')}>
                  {CLASS_LETTERS.map(l => <Option key={l} value={l}>{l}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="subjects" label={t('exams.subjects')} rules={[{ required: true, message: t('exams.subjectsRequired') }]}>
            <Select mode="multiple" placeholder={t('exams.selectSubjects')}>
              {SUBJECTS.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Add Individual Modal ── */}
      <Modal
        title={t('exams.addIndividual')}
        open={addIndivModalOpen}
        onOk={() => indivForm.validateFields().then(vals => addIndivMutation.mutate(vals))}
        onCancel={() => { setAddIndivModalOpen(false); indivForm.resetFields(); setStudentSearch('') }}
        confirmLoading={addIndivMutation.isPending}
        okText={t('exams.addCandidate')}
        destroyOnClose
      >
        <Form form={indivForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="studentId" label={t('exams.student')} rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={v => setStudentSearch(v)}
              placeholder={t('exams.searchStudent')}
              notFoundContent={studentSearch.length < 2 ? t('exams.typeToSearch') : t('common.noData')}
            >
              {studentOptions.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.user.displayName} ({s.studentId}){s.className ? ` · ${s.className}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="subjectCode" label={t('exams.subject')} rules={[{ required: true }]}>
            <Select placeholder={t('exams.selectSubject')}>
              {SUBJECTS.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
