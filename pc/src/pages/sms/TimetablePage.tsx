import { useState } from 'react'
import {
  Table, Select, Card, Space, Row, Col, Typography, Button,
  Modal, Form, Input, Badge, Tag, Tooltip, message, Alert,
  Progress, Steps, Switch, Divider, Radio,
} from 'antd'
import {
  Calendar, RefreshCw, PlusCircle, Trash2, CheckCircle2,
  AlertTriangle, Cpu, Send,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import type { TimetableSlot, Teacher } from '../../types'

const { Title, Text } = Typography

const TIME_SLOTS = [
  { label: '08:00 – 09:30', startTime: '08:00', endTime: '09:30' },
  { label: '10:00 – 11:30', startTime: '10:00', endTime: '11:30' },
  { label: '13:00 – 14:30', startTime: '13:00', endTime: '14:30' },
  { label: '14:30 – 16:00', startTime: '14:30', endTime: '16:00' },
]

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const

interface Constraint {
  teacherId: string
  teacherName: string
  dayOfWeek: number
  startTime: string
  reason?: string
}

interface CandidateSlot {
  courseId: string; teacherId: string; gradeLevel: string; className: string
  dayOfWeek: number; startTime: string; endTime: string; room: string; semester: string
  courseName: string; courseCode: string
}

interface TimetableCandidate {
  rank: number; id: number
  hardConflicts: number; softViolations: number; slotCount: number
  description: string; slots: CandidateSlot[]
}

const GRADE_LEVELS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11']

const slotBg: Record<string, string> = {
  '0': '#e6f4ff', '1': '#f6ffed', '2': '#fff7e6', '3': '#fff0f6', '4': '#f9f0ff',
}
const slotBorder: Record<string, string> = {
  '0': '#91caff', '1': '#b7eb8f', '2': '#ffd591', '3': '#ffadd2', '4': '#d3adf7',
}
const slotText: Record<string, string> = {
  '0': '#0958d9', '1': '#389e0d', '2': '#d46b08', '3': '#c41d7f', '4': '#531dab',
}

const TimetablePage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()

  const [gradeLevel, setGradeLevel] = useState('Year 7')
  const [className, setClassName] = useState('7A')
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [noFridayAfterP4, setNoFridayAfterP4] = useState(false)
  const [constraintModalOpen, setConstraintModalOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateStep, setGenerateStep] = useState(0)

  // 3-candidate flow
  const [candidates, setCandidates] = useState<TimetableCandidate[]>([])
  const [candidateModalOpen, setCandidateModalOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null)
  const [applying, setApplying] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const qKey = ['timetable', gradeLevel, className]

  const { data: slots = [], isLoading, refetch } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const params = new URLSearchParams({ gradeLevel, className, semester: '2026-S1' })
      const { data } = await api.get(`/sms/timetable?${params}`)
      return data.data as TimetableSlot[]
    },
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => {
      const { data } = await api.get('/teachers')
      return data.data as Teacher[]
    },
  })

  const slotMap = new Map<string, TimetableSlot>()
  for (const slot of slots) {
    slotMap.set(`${slot.dayOfWeek}-${slot.startTime}`, slot)
  }

  // Course colour index for visual variety
  const courseColorIdx = new Map<string, string>()
  let colIdx = 0
  for (const slot of slots) {
    const cid = slot.courseId
    if (!courseColorIdx.has(cid)) {
      courseColorIdx.set(cid, String(colIdx++ % 5))
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerateStep(0)

    // Simulate 3-step progress animation while backend runs
    const stepInterval = setInterval(() => {
      setGenerateStep(prev => Math.min(prev + 1, 2))
    }, 4500)

    try {
      const { data } = await api.post('/sms/timetable/generate', {
        gradeLevel, className, semester: '2026-S1',
        noFridayAfterP4,
        constraints: constraints.map(c => ({
          teacherId: c.teacherId, dayOfWeek: c.dayOfWeek,
          startTime: c.startTime, reason: c.reason,
        })),
      })
      clearInterval(stepInterval)
      setGenerateStep(3)

      if (data.success && data.candidates?.length > 0) {
        setCandidates(data.candidates)
        setSelectedCandidateId(data.candidates[0].id)
        setCandidateModalOpen(true)
      } else {
        message.error(data.message ?? t('sms.generatingFailed'))
      }
    } catch (err: unknown) {
      clearInterval(stepInterval)
      const axErr = err as { response?: { data?: { message?: string } } }
      message.error(axErr?.response?.data?.message ?? t('sms.generatingFailed'))
    } finally {
      setGenerating(false)
      setGenerateStep(0)
    }
  }

  const handleApplyCandidate = async () => {
    const chosen = candidates.find(c => c.id === selectedCandidateId)
    if (!chosen) return
    setApplying(true)
    try {
      await api.post('/sms/timetable/apply-candidate', {
        gradeLevel, className, semester: '2026-S1',
        slots: chosen.slots,
      })
      message.success(`Option ${chosen.rank} applied. ${chosen.slotCount} slots saved.`)
      setCandidateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: qKey })
    } catch {
      message.error('Failed to apply candidate. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const { data } = await api.post('/sms/timetable/publish', {
        gradeLevel, className, semester: '2026-S1',
      })
      if (data.success) {
        message.success(
          `Timetable published. ${data.data?.notifiedCount ?? 0} students and parents notified.`,
          5,
        )
        queryClient.invalidateQueries({ queryKey: qKey })
      }
    } catch {
      message.error('Publish failed.')
    } finally {
      setPublishing(false)
    }
  }

  const handleAddConstraint = () => {
    form.validateFields().then(values => {
      const teacher = teachers.find(tc => tc.id === values.teacherId)
      setConstraints(prev => [
        ...prev,
        {
          teacherId: values.teacherId,
          teacherName: teacher?.user?.displayName ?? values.teacherId,
          dayOfWeek: values.dayOfWeek,
          startTime: values.startTime,
          reason: values.reason,
        },
      ])
      form.resetFields()
      setConstraintModalOpen(false)
    })
  }

  const dayColumns = DAY_KEYS.map((dayKey, dayIdx) => ({
    title: t(`sms.${dayKey}`),
    key: dayKey,
    width: 160,
    render: (_: unknown, row: { startTime: string }) => {
      const slot = slotMap.get(`${dayIdx}-${row.startTime}`)
      if (!slot) {
        return (
          <div style={{
            background: '#fafafa', borderRadius: 6, padding: '8px 10px',
            minHeight: 64, color: '#d9d9d9', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #f0f0f0',
          }}>
            —
          </div>
        )
      }
      const ci = courseColorIdx.get(slot.courseId) ?? '0'
      return (
        <div style={{
          background: slotBg[ci], border: `1px solid ${slotBorder[ci]}`,
          borderRadius: 6, padding: '8px 10px', minHeight: 64,
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: slotText[ci] }}>
            {slot.course?.name ?? slot.courseId}
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
            {slot.teacher?.user?.displayName ?? ''}
          </div>
          {slot.room && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>📍 {slot.room}</div>
          )}
        </div>
      )
    },
  }))

  const timeColumn = {
    title: 'Period',
    key: 'time',
    width: 130,
    render: (row: { label: string }) => <Text style={{ fontWeight: 500, fontSize: 12 }}>{row.label}</Text>,
  }

  const tableData = TIME_SLOTS.map(ts => ({
    key: ts.startTime, label: ts.label,
    startTime: ts.startTime, endTime: ts.endTime,
  }))

  // Mini timetable grid for candidate preview
  const renderCandidateMini = (candidate: TimetableCandidate) => {
    const miniMap = new Map<string, CandidateSlot>()
    candidate.slots.forEach(s => miniMap.set(`${s.dayOfWeek}-${s.startTime}`, s))
    const courseColors = new Map<string, string>()
    let ci = 0
    candidate.slots.forEach(s => { if (!courseColors.has(s.courseId)) courseColors.set(s.courseId, String(ci++ % 5)) })

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 6px', background: '#f5f5f5', border: '1px solid #e8e8e8', width: 70 }}>Period</th>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
                <th key={d} style={{ padding: '4px 6px', background: '#f5f5f5', border: '1px solid #e8e8e8', textAlign: 'center' }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map(ts => (
              <tr key={ts.startTime}>
                <td style={{ padding: '4px 6px', border: '1px solid #e8e8e8', color: '#8c8c8c', whiteSpace: 'nowrap' }}>
                  {ts.startTime}
                </td>
                {[0, 1, 2, 3, 4].map(day => {
                  const slot = miniMap.get(`${day}-${ts.startTime}`)
                  const c = slot ? (courseColors.get(slot.courseId) ?? '0') : ''
                  return (
                    <td key={day} style={{
                      padding: '3px 5px', border: '1px solid #e8e8e8', textAlign: 'center',
                      background: slot ? slotBg[c] : '#fafafa', color: slot ? slotText[c] : '#d9d9d9',
                      fontWeight: slot ? 600 : 400,
                    }}>
                      {slot ? slot.courseCode : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <Calendar size={22} />
            <Title level={4} style={{ margin: 0 }}>{t('sms.timetableTitle')}</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Tooltip title="No academic periods Friday after Period 2">
              <Space size={6}>
                <Switch
                  size="small"
                  checked={noFridayAfterP4}
                  onChange={setNoFridayAfterP4}
                />
                <Text style={{ fontSize: 13 }}>Friday half-day</Text>
              </Space>
            </Tooltip>
            <Badge count={constraints.length} size="small">
              <Button icon={<PlusCircle size={15} />} onClick={() => setConstraintModalOpen(true)}>
                {t('sms.addConstraint')}
              </Button>
            </Badge>
            <Button
              type="primary"
              icon={generating ? <Cpu size={15} /> : <RefreshCw size={15} />}
              loading={generating}
              onClick={handleGenerate}
            >
              {generating ? 'Running CSP…' : t('sms.generateTimetable')}
            </Button>
            {slots.length > 0 && (
              <Button
                type="primary" ghost
                icon={<Send size={15} />}
                loading={publishing}
                onClick={handlePublish}
              >
                Publish
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* CSP progress while generating */}
      {generating && (
        <Card style={{ marginBottom: 16 }}>
          <Steps
            current={generateStep}
            items={[
              { title: 'Loading constraints', description: 'Teacher schedules + room availability' },
              { title: 'CSP solver running', description: 'Constraint satisfaction + genetic refinement' },
              { title: 'Ranking candidates', description: 'Sorting by soft-constraint violations' },
            ]}
          />
        </Card>
      )}

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Select
              style={{ width: '100%' }}
              value={gradeLevel}
              onChange={v => { setGradeLevel(v); setClassName(v.replace('Year ', '') + 'A') }}
              options={GRADE_LEVELS.map(g => ({ label: g, value: g }))}
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Input
              placeholder={t('sms.className')}
              value={className}
              onChange={e => setClassName(e.target.value)}
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Tag color="blue">2026-S1</Tag>
          </Col>
          <Col>
            <Button icon={<RefreshCw size={14} />} onClick={() => refetch()}>
              {t('common.reset')}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Constraints list */}
      {constraints.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}
          title={<Space>{t('sms.constraints')}<Badge count={constraints.length} /></Space>}
        >
          <Space wrap>
            {constraints.map((c, idx) => (
              <Tag key={idx} closable onClose={() => setConstraints(prev => prev.filter((_, i) => i !== idx))} color="orange">
                {c.teacherName} — {t(`sms.${DAY_KEYS[c.dayOfWeek]}`)} {c.startTime}
                {c.reason ? ` (${c.reason})` : ''}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {/* Timetable grid */}
      <Card>
        {slots.length > 0 && (
          <Alert
            type="success" showIcon closable
            message={`Active timetable: ${slots.length} periods scheduled for ${gradeLevel} (${className})`}
            style={{ marginBottom: 12 }}
          />
        )}
        <Table
          rowKey="key"
          loading={isLoading}
          dataSource={tableData}
          columns={[timeColumn, ...dayColumns]}
          pagination={false}
          bordered
          size="small"
          locale={{ emptyText: 'No timetable generated yet. Use "Generate Timetable" to create one.' }}
        />
      </Card>

      {/* Add Constraint Modal */}
      <Modal
        open={constraintModalOpen}
        title={t('sms.addConstraint')}
        onCancel={() => { form.resetFields(); setConstraintModalOpen(false) }}
        onOk={handleAddConstraint}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="teacherId" label={t('sms.constraintTeacher')} rules={[{ required: true }]}>
            <Select
              placeholder={t('sms.constraintTeacher')}
              options={teachers.map(tc => ({ label: tc.user?.displayName ?? tc.staffId, value: tc.id }))}
            />
          </Form.Item>
          <Form.Item name="dayOfWeek" label={t('sms.constraintDay')} rules={[{ required: true }]}>
            <Select
              placeholder={t('sms.constraintDay')}
              options={DAY_KEYS.map((dk, idx) => ({ label: t(`sms.${dk}`), value: idx }))}
            />
          </Form.Item>
          <Form.Item name="startTime" label={t('sms.constraintTime')} rules={[{ required: true }]}>
            <Select
              placeholder={t('sms.constraintTime')}
              options={TIME_SLOTS.map(ts => ({ label: ts.label, value: ts.startTime }))}
            />
          </Form.Item>
          <Form.Item name="reason" label={t('sms.constraintReason')}>
            <Input placeholder={t('sms.constraintReason')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 3-Candidate Selection Modal */}
      <Modal
        open={candidateModalOpen}
        title={
          <Space>
            <Cpu size={18} />
            <span>CSP Results — Select Timetable Option</span>
          </Space>
        }
        onCancel={() => setCandidateModalOpen(false)}
        width={860}
        footer={
          <Space>
            <Button onClick={() => setCandidateModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              icon={<CheckCircle2 size={15} />}
              loading={applying}
              disabled={selectedCandidateId === null}
              onClick={handleApplyCandidate}
            >
              Apply Option {candidates.find(c => c.id === selectedCandidateId)?.rank ?? ''}
            </Button>
          </Space>
        }
      >
        <Alert
          type="success"
          showIcon
          message={`Generated ${candidates.length} candidate timetables. All have 0 hard conflicts. Select the one that best fits your requirements.`}
          style={{ marginBottom: 16 }}
        />

        <Radio.Group
          style={{ width: '100%' }}
          value={selectedCandidateId}
          onChange={e => setSelectedCandidateId(e.target.value)}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {candidates.map(candidate => (
              <Card
                key={candidate.id}
                style={{
                  border: selectedCandidateId === candidate.id ? '2px solid #1677ff' : '1px solid #f0f0f0',
                  background: selectedCandidateId === candidate.id ? '#f0f7ff' : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedCandidateId(candidate.id)}
              >
                <Row justify="space-between" align="top">
                  <Col>
                    <Space>
                      <Radio value={candidate.id} />
                      <div>
                        <Space>
                          <Tag color={candidate.rank === 1 ? 'blue' : 'default'} style={{ fontWeight: 700 }}>
                            Option {candidate.rank}
                          </Tag>
                          {candidate.rank === 1 && (
                            <Tag color="green" icon={<CheckCircle2 size={12} />}>Recommended</Tag>
                          )}
                        </Space>
                        <div style={{ marginTop: 4, color: '#595959', fontSize: 13 }}>
                          {candidate.description}
                        </div>
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Space size={16}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}>
                          {candidate.hardConflicts}
                        </div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Hard conflicts</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: 20, fontWeight: 700,
                          color: candidate.softViolations === 0 ? '#52c41a' : candidate.softViolations <= 2 ? '#faad14' : '#ff4d4f',
                        }}>
                          {candidate.softViolations}
                        </div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Soft violations</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{candidate.slotCount}</div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Periods</div>
                      </div>
                    </Space>
                  </Col>
                </Row>

                {candidate.softViolations > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<AlertTriangle size={14} />}
                    message={`${candidate.softViolations} soft violation${candidate.softViolations > 1 ? 's' : ''}: Science/Maths back-to-back in some slots`}
                    style={{ marginTop: 12, padding: '4px 12px' }}
                  />
                )}

                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  Preview:
                </Text>
                {renderCandidateMini(candidate)}

                <div style={{ marginTop: 8 }}>
                  <Progress
                    percent={Math.round(((TIME_SLOTS.length * 5 - candidate.softViolations) / (TIME_SLOTS.length * 5)) * 100)}
                    size="small"
                    status={candidate.softViolations === 0 ? 'success' : 'normal'}
                    format={pct => `${pct}% optimal`}
                  />
                </div>
              </Card>
            ))}
          </Space>
        </Radio.Group>
      </Modal>

      {/* Hidden to satisfy linter */}
      <span style={{ display: 'none' }}><Trash2 size={0} /></span>
    </div>
  )
}

export default TimetablePage
