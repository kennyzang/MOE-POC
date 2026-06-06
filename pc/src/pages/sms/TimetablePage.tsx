import { useState, useMemo } from 'react'
import {
  Select, Card, Space, Row, Col, Typography, Button,
  Modal, Form, Input, Badge, Tag, Tooltip, message, Alert,
  Progress, Steps, Switch, Divider, Radio, Tabs, Spin,
  Popconfirm, Drawer,
} from 'antd'
import {
  Calendar, RefreshCw, PlusCircle, Trash2, CheckCircle2,
  AlertTriangle, Cpu, Send, Eye, Edit3, Info, Move,
  GripHorizontal, BookOpen, Clock, X,
} from 'lucide-react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import type { TimetableSlot, Teacher } from '../../types'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography

const TIME_SLOTS = [
  { label: 'Period 1  08:00 – 09:30', startTime: '08:00', endTime: '09:30', short: 'P1' },
  { label: 'Period 2  10:00 – 11:30', startTime: '10:00', endTime: '11:30', short: 'P2' },
  { label: 'Period 3  13:00 – 14:30', startTime: '13:00', endTime: '14:30', short: 'P3' },
  { label: 'Period 4  14:30 – 16:00', startTime: '14:30', endTime: '16:00', short: 'P4' },
]
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const

const SLOT_BG: Record<string, string> = { '0': '#e6f4ff', '1': '#f6ffed', '2': '#fff7e6', '3': '#fff0f6', '4': '#f9f0ff' }
const SLOT_BORDER: Record<string, string> = { '0': '#91caff', '1': '#b7eb8f', '2': '#ffd591', '3': '#ffadd2', '4': '#d3adf7' }
const SLOT_TEXT: Record<string, string> = { '0': '#0958d9', '1': '#389e0d', '2': '#d46b08', '3': '#c41d7f', '4': '#531dab' }

interface Constraint { teacherId: string; teacherName: string; dayOfWeek: number; startTime: string; reason?: string }
interface CandidateSlot {
  courseId: string; teacherId: string; gradeLevel: string; className: string
  dayOfWeek: number; startTime: string; endTime: string; room: string; semester: string
  courseName: string; courseCode: string
}
interface TimetableCandidate {
  rank: number; id: number; hardConflicts: number; softViolations: number
  slotCount: number; description: string; slots: CandidateSlot[]
}

// ── Shared grid renderer ────────────────────────────────────────────────────

function useCourseColors(slots: TimetableSlot[]) {
  return useMemo(() => {
    const map = new Map<string, string>()
    let i = 0
    for (const s of slots) {
      if (!map.has(s.courseId)) map.set(s.courseId, String(i++ % 5))
    }
    return map
  }, [slots])
}

// ── Teacher read-only view ──────────────────────────────────────────────────

function TeacherView() {
  const navigate = useNavigate()
  const { gradeLevels } = useSchoolConfig()
  const [gradeLevel, setGradeLevel] = useState(() => gradeLevels[0] ?? 'Year 7')
  const [className, setClassName] = useState(() => (gradeLevels[0] ?? 'Year 7').replace(/\D+/g, '') + 'A')
  const [activeTab, setActiveTab] = useState<'class' | 'mine'>('mine')
  const [semester, setSemester] = useState('2026-S1')

  const { data: classSlots = [], isLoading: loadingClass } = useQuery({
    queryKey: ['timetable', gradeLevel, className, semester],
    queryFn: async () => {
      const p = new URLSearchParams({ gradeLevel, className, semester })
      const { data } = await api.get(`/sms/timetable?${p}`)
      return data.data as TimetableSlot[]
    },
    enabled: activeTab === 'class',
  })

  const { data: mySlots = [], isLoading: loadingMine } = useQuery({
    queryKey: ['timetable-my-schedule', semester],
    queryFn: async () => {
      const { data } = await api.get(`/sms/timetable/my-schedule?semester=${semester}`)
      return data.data as TimetableSlot[]
    },
    enabled: activeTab === 'mine',
  })

  const classColors = useCourseColors(classSlots)
  const myColors = useCourseColors(mySlots)

  const renderGrid = (slots: TimetableSlot[], colorMap: Map<string, string>, showClass = false) => {
    // Build a multi-slot map so same-time classes are all visible (teacher may teach multiple classes at once)
    const slotMap = new Map<string, TimetableSlot[]>()
    for (const s of slots) {
      const key = `${s.dayOfWeek}-${s.startTime}`
      const existing = slotMap.get(key) ?? []
      slotMap.set(key, [...existing, s])
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 12px', background: '#fafafa', border: '1px solid #f0f0f0', width: 130, textAlign: 'left', fontSize: 12, color: '#8c8c8c' }}>
                Period
              </th>
              {DAY_LABELS.map((d, i) => (
                <th key={i} style={{ padding: '10px 12px', background: '#fafafa', border: '1px solid #f0f0f0', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#262626' }}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map(ts => (
              <tr key={ts.startTime}>
                <td style={{ padding: '8px 12px', border: '1px solid #f0f0f0', background: '#fafafa' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#595959' }}>{ts.short}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>{ts.startTime} – {ts.endTime}</div>
                </td>
                {[0, 1, 2, 3, 4].map(day => {
                  const cellSlots = slotMap.get(`${day}-${ts.startTime}`) ?? []
                  if (cellSlots.length === 0) {
                    return (
                      <td key={day} style={{ padding: 6, border: '1px solid #f0f0f0' }}>
                        <div style={{ minHeight: 64, borderRadius: 6, background: '#fafafa', border: '1px dashed #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#d9d9d9', fontSize: 12 }}>—</Text>
                        </div>
                      </td>
                    )
                  }
                  return (
                    <td key={day} style={{ padding: 6, border: '1px solid #f0f0f0', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cellSlots.map((slot, si) => {
                          const ci = colorMap.get(slot.courseId) ?? String(si % 5)
                          return (
                            <Tooltip key={slot.id} title="Click to view course details">
                              <div
                                style={{ background: SLOT_BG[ci], border: `1px solid ${SLOT_BORDER[ci]}`, borderRadius: 6, padding: '6px 10px', minHeight: 56, cursor: 'pointer', transition: 'opacity 0.15s' }}
                                onClick={() => navigate(`/sms/courses/${slot.courseId}`)}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                              >
                                <div style={{ fontWeight: 600, fontSize: 12, color: SLOT_TEXT[ci] }}>{slot.course?.name ?? slot.courseId}</div>
                                {showClass && (
                                  <div style={{ fontSize: 11, color: SLOT_TEXT[ci], opacity: 0.8, marginTop: 1 }}>
                                    {slot.gradeLevel} {slot.className}
                                  </div>
                                )}
                                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{slot.teacher?.user?.displayName ?? ''}</div>
                                {slot.room && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>📍 {slot.room}</div>}
                              </div>
                            </Tooltip>
                          )
                        })}
                      </div>
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
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            <Calendar size={22} />
            <Title level={4} style={{ margin: 0 }}>Timetable</Title>
          </Space>
        </Col>
        <Col>
          <Select
            size="small"
            value={semester}
            onChange={setSemester}
            style={{ width: 120 }}
            options={[
              { label: '2026-S1', value: '2026-S1' },
              { label: '2026-S2', value: '2026-S2' },
              { label: '2025-S2', value: '2025-S2' },
            ]}
          />
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={k => setActiveTab(k as 'class' | 'mine')}
        items={[
          {
            key: 'mine',
            label: <Space size={6}><BookOpen size={14} />My Teaching Schedule</Space>,
            children: (
              <Card>
                <Alert
                  type="info" showIcon
                  message="Your personal teaching schedule across all classes you are assigned to this semester."
                  style={{ marginBottom: 16 }}
                />
                {loadingMine ? <Spin style={{ display: 'block', margin: '40px auto' }} /> : (
                  mySlots.length === 0
                    ? <Alert type="warning" message="No teaching slots found for this semester. Contact the school administrator if this is incorrect." showIcon />
                    : renderGrid(mySlots, myColors, true)
                )}
              </Card>
            ),
          },
          {
            key: 'class',
            label: <Space size={6}><Eye size={14} />Class Timetable</Space>,
            children: (
              <Card>
                <Alert
                  type="info" showIcon
                  message="Browse the timetable for any class. Click a lesson to view the full course details."
                  style={{ marginBottom: 16 }}
                />
                <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
                  <Col xs={24} sm={8} md={5}>
                    <Select
                      style={{ width: '100%' }}
                      value={gradeLevel}
                      onChange={v => { setGradeLevel(v); setClassName(v.replace(/\D+/g, '') + 'A') }}
                      options={gradeLevels.map(g => ({ label: g, value: g }))}
                    />
                  </Col>
                  <Col xs={24} sm={6} md={3}>
                    <Input
                      placeholder="Class (e.g. 7A)"
                      value={className}
                      onChange={e => setClassName(e.target.value)}
                    />
                  </Col>
                </Row>
                {loadingClass
                  ? <Spin style={{ display: 'block', margin: '40px auto' }} />
                  : classSlots.length === 0
                    ? <Alert type="warning" message={`No timetable found for ${gradeLevel} (${className}). The timetable may not have been published yet.`} showIcon />
                    : renderGrid(classSlots, classColors, false)
                }
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}

// ── Admin management view ───────────────────────────────────────────────────

function AdminView() {
  const navigate = useNavigate()
  const { gradeLevels } = useSchoolConfig()
  const queryClient = useQueryClient()

  const [gradeLevel, setGradeLevel] = useState(() => gradeLevels[0] ?? 'Year 7')
  const [className, setClassName] = useState(() => (gradeLevels[0] ?? 'Year 7').replace(/\D+/g, '') + 'A')
  const [editMode, setEditMode] = useState(false)

  // Moving-slot state
  const [movingSlot, setMovingSlot] = useState<TimetableSlot | null>(null)

  // Constraints
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [noFridayAfterP4, setNoFridayAfterP4] = useState(false)
  const [constraintDrawerOpen, setConstraintDrawerOpen] = useState(false)
  const [constraintForm] = Form.useForm()

  // Add-slot modal
  const [addSlotOpen, setAddSlotOpen] = useState(false)
  const [addSlotCell, setAddSlotCell] = useState<{ day: number; startTime: string; endTime: string } | null>(null)
  const [addSlotForm] = Form.useForm()

  // Generate
  const [generating, setGenerating] = useState(false)
  const [generateStep, setGenerateStep] = useState(0)
  const [generateDrawerOpen, setGenerateDrawerOpen] = useState(false)
  const [candidates, setCandidates] = useState<TimetableCandidate[]>([])
  const [candidateModalOpen, setCandidateModalOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null)
  const [applying, setApplying] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const qKey = ['timetable', gradeLevel, className]

  const { data: slots = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const p = new URLSearchParams({ gradeLevel, className, semester: '2026-S1' })
      const { data } = await api.get(`/sms/timetable?${p}`)
      return data.data as TimetableSlot[]
    },
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => (await api.get('/teachers')).data.data as Teacher[],
  })

  const { data: courses = [] } = useQuery({
    queryKey: ['courses', gradeLevel],
    queryFn: async () => (await api.get(`/courses?gradeLevel=${encodeURIComponent(gradeLevel)}`)).data.data as any[],
  })

  const colorMap = useCourseColors(slots)

  const slotMap = useMemo(() => {
    const m = new Map<string, TimetableSlot>()
    for (const s of slots) m.set(`${s.dayOfWeek}-${s.startTime}`, s)
    return m
  }, [slots])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const deleteSlotMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sms/timetable/slot/${id}`),
    onSuccess: () => { message.success('Lesson removed'); queryClient.invalidateQueries({ queryKey: qKey }) },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to remove'),
  })

  const addSlotMutation = useMutation({
    mutationFn: (body: any) => api.post('/sms/timetable/slot', body),
    onSuccess: () => {
      message.success('Lesson added')
      queryClient.invalidateQueries({ queryKey: qKey })
      setAddSlotOpen(false); addSlotForm.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Failed to add lesson'),
  })

  const moveSlotMutation = useMutation({
    mutationFn: ({ id, dayOfWeek, startTime, endTime }: { id: string; dayOfWeek: number; startTime: string; endTime: string }) =>
      api.patch(`/sms/timetable/slot/${id}`, { dayOfWeek, startTime, endTime }),
    onSuccess: () => {
      message.success('Lesson moved')
      setMovingSlot(null)
      queryClient.invalidateQueries({ queryKey: qKey })
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Cannot move — time conflict'),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCellClick = (day: number, ts: { startTime: string; endTime: string }) => {
    const existing = slotMap.get(`${day}-${ts.startTime}`)

    if (movingSlot) {
      // Drop mode
      if (existing) {
        message.warning('That slot is already occupied. Choose an empty slot.')
        return
      }
      moveSlotMutation.mutate({ id: movingSlot.id, dayOfWeek: day, startTime: ts.startTime, endTime: ts.endTime })
      return
    }

    if (!editMode) {
      if (existing) navigate(`/sms/courses/${existing.courseId}`)
      return
    }

    if (existing) {
      // In edit mode, clicking existing → start moving
      setMovingSlot(existing)
    } else {
      // Empty cell in edit mode → open add drawer
      setAddSlotCell({ day, startTime: ts.startTime, endTime: ts.endTime })
      addSlotForm.setFieldsValue({ dayOfWeek: day, startTime: ts.startTime })
      setAddSlotOpen(true)
    }
  }

  const handleAddSlot = async () => {
    const v = await addSlotForm.validateFields()
    if (!addSlotCell) return
    const course = courses.find((c: any) => c.id === v.courseId)
    const teacherId = v.teacherId ?? course?.assignments?.[0]?.teacher?.id
    if (!teacherId) { message.error('Please select a teacher'); return }
    addSlotMutation.mutate({
      courseId: v.courseId,
      teacherId,
      gradeLevel,
      className,
      dayOfWeek: addSlotCell.day,
      startTime: addSlotCell.startTime,
      endTime: addSlotCell.endTime,
      room: v.room,
      semester: '2026-S1',
    })
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerateStep(0)
    setGenerateDrawerOpen(false)
    const stepInterval = setInterval(() => setGenerateStep(prev => Math.min(prev + 1, 2)), 4500)
    try {
      const { data } = await api.post('/sms/timetable/generate', {
        gradeLevel, className, semester: '2026-S1',
        noFridayAfterP4,
        constraints: constraints.map(c => ({ teacherId: c.teacherId, dayOfWeek: c.dayOfWeek, startTime: c.startTime, reason: c.reason })),
      })
      clearInterval(stepInterval)
      setGenerateStep(3)
      if (data.success && data.candidates?.length > 0) {
        setCandidates(data.candidates)
        setSelectedCandidateId(data.candidates[0].id)
        setCandidateModalOpen(true)
      } else {
        message.error(data.message ?? 'Auto-arrange failed')
      }
    } catch (err: any) {
      clearInterval(stepInterval)
      message.error(err?.response?.data?.message ?? 'Auto-arrange failed')
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
      await api.post('/sms/timetable/apply-candidate', { gradeLevel, className, semester: '2026-S1', slots: chosen.slots })
      message.success(`Option ${chosen.rank} applied — ${chosen.slotCount} lessons placed.`)
      setCandidateModalOpen(false)
      queryClient.invalidateQueries({ queryKey: qKey })
      setEditMode(false)
    } catch { message.error('Failed to apply. Please try again.') }
    finally { setApplying(false) }
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const { data } = await api.post('/sms/timetable/publish', { gradeLevel, className, semester: '2026-S1' })
      if (data.success) {
        message.success(`Published! ${data.data?.notifiedCount ?? 0} students and parents notified.`, 5)
        queryClient.invalidateQueries({ queryKey: qKey })
      }
    } catch { message.error('Publish failed.') }
    finally { setPublishing(false) }
  }

  // ── Mini timetable for candidate preview ──────────────────────────────────

  const renderCandidateMini = (candidate: TimetableCandidate) => {
    const miniMap = new Map(candidate.slots.map(s => [`${s.dayOfWeek}-${s.startTime}`, s]))
    const cc = new Map<string, string>(); let ci = 0
    candidate.slots.forEach(s => { if (!cc.has(s.courseId)) cc.set(s.courseId, String(ci++ % 5)) })
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '3px 6px', background: '#f5f5f5', border: '1px solid #e8e8e8', width: 50 }}>Period</th>
              {DAY_SHORT.map(d => <th key={d} style={{ padding: '3px 6px', background: '#f5f5f5', border: '1px solid #e8e8e8', textAlign: 'center' }}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map(ts => (
              <tr key={ts.startTime}>
                <td style={{ padding: '3px 6px', border: '1px solid #e8e8e8', color: '#8c8c8c', whiteSpace: 'nowrap' }}>{ts.short}</td>
                {[0, 1, 2, 3, 4].map(day => {
                  const slot = miniMap.get(`${day}-${ts.startTime}`)
                  const c = slot ? (cc.get(slot.courseId) ?? '0') : ''
                  return (
                    <td key={day} style={{ padding: '3px 5px', border: '1px solid #e8e8e8', textAlign: 'center', background: slot ? SLOT_BG[c] : '#fafafa', color: slot ? SLOT_TEXT[c] : '#d9d9d9', fontWeight: slot ? 600 : 400 }}>
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

  // ── Timetable grid render ─────────────────────────────────────────────────

  const renderGrid = () => (
    <div style={{ overflowX: 'auto' }}>
      {movingSlot && (
        <Alert
          type="info" showIcon
          icon={<Move size={14} />}
          message={
            <Space>
              <Text strong>{movingSlot.course?.name}</Text>
              <Text>— Click any empty slot to move this lesson here</Text>
              <Button size="small" onClick={() => setMovingSlot(null)} icon={<X size={12} />}>Cancel</Button>
            </Space>
          }
          style={{ marginBottom: 12 }}
        />
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ padding: '10px 12px', background: '#fafafa', border: '1px solid #f0f0f0', width: 130, textAlign: 'left', fontSize: 12, color: '#8c8c8c' }}>Period</th>
            {DAY_LABELS.map((d, i) => (
              <th key={i} style={{ padding: '10px 12px', background: '#fafafa', border: '1px solid #f0f0f0', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#262626' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map(ts => (
            <tr key={ts.startTime}>
              <td style={{ padding: '8px 12px', border: '1px solid #f0f0f0', background: '#fafafa' }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#595959' }}>{ts.short}</div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>{ts.startTime} – {ts.endTime}</div>
              </td>
              {[0, 1, 2, 3, 4].map(day => {
                const slot = slotMap.get(`${day}-${ts.startTime}`)
                const isMoving = movingSlot?.id === slot?.id

                if (!slot) {
                  // Empty cell
                  const isDropTarget = !!movingSlot
                  const isEditable = editMode && !movingSlot
                  return (
                    <td key={day} style={{ padding: 6, border: '1px solid #f0f0f0' }}>
                      <div
                        style={{
                          minHeight: 64, borderRadius: 6,
                          background: isDropTarget ? '#e6f4ff' : isEditable ? '#f6ffed' : '#fafafa',
                          border: isDropTarget ? '2px dashed #1677ff' : isEditable ? '2px dashed #52c41a' : '1px dashed #f0f0f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: isDropTarget || isEditable ? 'pointer' : 'default',
                          transition: 'all 0.15s',
                        }}
                        onClick={() => handleCellClick(day, ts)}
                      >
                        {isDropTarget ? (
                          <Text style={{ fontSize: 11, color: '#1677ff' }}>Drop here</Text>
                        ) : isEditable ? (
                          <Space direction="vertical" align="center" size={2}>
                            <PlusCircle size={16} style={{ color: '#52c41a' }} />
                            <Text style={{ fontSize: 10, color: '#52c41a' }}>Add lesson</Text>
                          </Space>
                        ) : (
                          <Text style={{ color: '#d9d9d9', fontSize: 12 }}>—</Text>
                        )}
                      </div>
                    </td>
                  )
                }

                // Filled cell
                const ci = colorMap.get(slot.courseId) ?? '0'
                return (
                  <td key={day} style={{ padding: 6, border: '1px solid #f0f0f0' }}>
                    <div
                      style={{
                        background: isMoving ? '#e6f4ff' : SLOT_BG[ci],
                        border: isMoving ? '2px solid #1677ff' : `1px solid ${SLOT_BORDER[ci]}`,
                        borderRadius: 6, padding: '8px 10px', minHeight: 64,
                        cursor: editMode ? 'grab' : 'pointer',
                        transition: 'all 0.15s', position: 'relative',
                      }}
                      onClick={() => handleCellClick(day, ts)}
                      onMouseEnter={e => { if (!editMode) e.currentTarget.style.opacity = '0.8' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                    >
                      {editMode && !isMoving && (
                        <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2 }}>
                          <Tooltip title="Move this lesson to another slot">
                            <div style={{ cursor: 'pointer', color: '#1677ff', padding: 2 }}
                              onClick={e => { e.stopPropagation(); setMovingSlot(slot) }}>
                              <GripHorizontal size={12} />
                            </div>
                          </Tooltip>
                          <Popconfirm
                            title="Remove this lesson from the timetable?"
                            onConfirm={e => { e?.stopPropagation(); deleteSlotMutation.mutate(slot.id) }}
                            okType="danger"
                          >
                            <div style={{ cursor: 'pointer', color: '#ff4d4f', padding: 2 }}
                              onClick={e => e.stopPropagation()}>
                              <X size={12} />
                            </div>
                          </Popconfirm>
                        </div>
                      )}
                      <div style={{ fontWeight: 600, fontSize: 12, color: isMoving ? '#1677ff' : SLOT_TEXT[ci], paddingRight: editMode ? 36 : 0 }}>
                        {slot.course?.name ?? slot.courseId}
                      </div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{slot.teacher?.user?.displayName ?? ''}</div>
                      {slot.room && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>📍 {slot.room}</div>}
                      {isMoving && (
                        <div style={{ fontSize: 10, color: '#1677ff', marginTop: 4 }}>Moving… (click to cancel)</div>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            <Calendar size={22} />
            <Title level={4} style={{ margin: 0 }}>Timetable Management</Title>
          </Space>
        </Col>
        <Col>
          <Space wrap>
            <Tooltip title={editMode ? 'Exit edit mode — return to view-only' : 'Enter edit mode to add, move, or remove individual lessons'}>
              <Button
                icon={editMode ? <Eye size={15} /> : <Edit3 size={15} />}
                type={editMode ? 'primary' : 'default'}
                onClick={() => { setEditMode(e => !e); setMovingSlot(null) }}
              >
                {editMode ? 'View Mode' : 'Edit Mode'}
              </Button>
            </Tooltip>
            <Tooltip title="Block specific teachers from certain time slots (e.g. meetings, duties, off-site)">
              <Badge count={constraints.length} size="small">
                <Button icon={<Clock size={15} />} onClick={() => setConstraintDrawerOpen(true)}>
                  Availability Restrictions
                </Button>
              </Badge>
            </Tooltip>
            <Tooltip title="Automatically arrange all course assignments into the timetable, resolving conflicts">
              <Button
                type="primary" ghost
                icon={generating ? <Cpu size={15} /> : <RefreshCw size={15} />}
                loading={generating}
                onClick={() => !generating && setGenerateDrawerOpen(true)}
              >
                {generating ? 'Arranging…' : 'Auto-Arrange'}
              </Button>
            </Tooltip>
            {slots.length > 0 && (
              <Tooltip title="Send the current timetable to all enrolled students and their parents via notifications">
                <Button
                  type="primary"
                  icon={<Send size={15} />}
                  loading={publishing}
                  onClick={handlePublish}
                >
                  Publish to Students
                </Button>
              </Tooltip>
            )}
          </Space>
        </Col>
      </Row>

      {/* Class selector */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8} md={5}>
            <Select
              style={{ width: '100%' }}
              value={gradeLevel}
              onChange={v => { setGradeLevel(v); setClassName(v.replace(/\D+/g, '') + 'A'); setMovingSlot(null) }}
              options={gradeLevels.map(g => ({ label: g, value: g }))}
            />
          </Col>
          <Col xs={24} sm={6} md={3}>
            <Input placeholder="Class (e.g. 7A)" value={className} onChange={e => { setClassName(e.target.value); setMovingSlot(null) }} />
          </Col>
          <Col>
            <Tag color="blue">2026-S1</Tag>
          </Col>
          <Col>
            <Button icon={<RefreshCw size={14} />} onClick={() => queryClient.invalidateQueries({ queryKey: qKey })}>
              Refresh
            </Button>
          </Col>
        </Row>
        {editMode && (
          <Alert
            type="success" showIcon
            style={{ marginTop: 10 }}
            icon={<Edit3 size={13} />}
            message="Edit mode is on — click an empty slot to add a lesson, or click a lesson to move/remove it."
          />
        )}
      </Card>

      {/* Generate progress */}
      {generating && (
        <Card style={{ marginBottom: 16 }}>
          <Steps
            current={generateStep}
            items={[
              { title: 'Loading course assignments', description: `${gradeLevel} courses for semester 2026-S1` },
              { title: 'Arranging lessons', description: 'Placing courses in available slots, avoiding conflicts' },
              { title: 'Ranking options', description: 'Selecting best arrangement by subject distribution' },
            ]}
          />
        </Card>
      )}

      {/* Main grid */}
      <Card>
        {slots.length > 0 && (
          <Alert
            type="success" showIcon closable
            message={`${slots.length} lessons scheduled for ${gradeLevel} (${className})`}
            style={{ marginBottom: 12 }}
          />
        )}
        {isLoading
          ? <Spin style={{ display: 'block', margin: '40px auto' }} />
          : slots.length === 0 && !editMode
            ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                <Calendar size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                <div style={{ fontSize: 15, marginBottom: 8 }}>No timetable for {gradeLevel} ({className})</div>
                <div style={{ fontSize: 13 }}>
                  Use <strong>Auto-Arrange</strong> to generate a full timetable automatically, or turn on <strong>Edit Mode</strong> to build it manually.
                </div>
              </div>
            )
            : renderGrid()
        }
      </Card>

      {/* ── Availability Restrictions drawer ─────────────────────── */}
      <Drawer
        title={
          <Space>
            <Clock size={16} />
            Availability Restrictions
            <Tooltip title="Block a teacher from being scheduled at a specific day and time. Useful for recurring meetings, duties, or off-site commitments.">
              <Info size={14} style={{ color: '#8c8c8c', cursor: 'help' }} />
            </Tooltip>
          </Space>
        }
        open={constraintDrawerOpen}
        onClose={() => setConstraintDrawerOpen(false)}
        width={420}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setConstraintDrawerOpen(false)}>Close</Button>
          </Space>
        }
      >
        <Alert
          type="info" showIcon
          message="These restrictions are applied when using Auto-Arrange. They do not affect manually placed lessons."
          style={{ marginBottom: 16 }}
        />

        <Form form={constraintForm} layout="vertical">
          <Form.Item name="teacherId" label="Teacher" rules={[{ required: true, message: 'Select a teacher' }]}>
            <Select
              placeholder="Select teacher"
              options={teachers.map(t => ({ label: t.user?.displayName ?? t.staffId, value: t.id }))}
              showSearch
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="dayOfWeek" label="Day" rules={[{ required: true }]}>
                <Select options={DAY_LABELS.map((d, i) => ({ label: d, value: i }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="startTime" label="Period" rules={[{ required: true }]}>
                <Select options={TIME_SLOTS.map(ts => ({ label: ts.short + ' (' + ts.startTime + ')', value: ts.startTime }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason (optional)">
            <Input placeholder="e.g. Weekly department meeting" />
          </Form.Item>
          <Button
            type="primary"
            block
            onClick={() => {
              constraintForm.validateFields().then(v => {
                const teacher = teachers.find(t => t.id === v.teacherId)
                setConstraints(prev => [...prev, { teacherId: v.teacherId, teacherName: teacher?.user?.displayName ?? v.teacherId, dayOfWeek: v.dayOfWeek, startTime: v.startTime, reason: v.reason }])
                constraintForm.resetFields()
                message.success('Restriction added')
              })
            }}
          >
            Add Restriction
          </Button>
        </Form>

        {constraints.length > 0 && (
          <>
            <Divider>Active Restrictions ({constraints.length})</Divider>
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {constraints.map((c, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '6px 10px' }}>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{c.teacherName}</Text>
                    <Text style={{ fontSize: 12, color: '#595959' }}> — {DAY_LABELS[c.dayOfWeek]} {c.startTime}</Text>
                    {c.reason && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{c.reason}</div>}
                  </div>
                  <Button type="text" size="small" danger icon={<Trash2 size={12} />} onClick={() => setConstraints(prev => prev.filter((_, i) => i !== idx))} />
                </div>
              ))}
            </Space>
            <Button type="link" danger size="small" style={{ marginTop: 8, padding: 0 }} onClick={() => setConstraints([])}>
              Clear all restrictions
            </Button>
          </>
        )}

        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Switch size="small" checked={noFridayAfterP4} onChange={setNoFridayAfterP4} />
            <Text style={{ fontSize: 13 }}>Friday half-day</Text>
          </Space>
          <Tooltip title="When enabled, no lessons will be scheduled on Friday afternoon (Period 3 and Period 4)">
            <Info size={14} style={{ color: '#8c8c8c' }} />
          </Tooltip>
        </div>
      </Drawer>

      {/* ── Auto-Arrange drawer ──────────────────────────────────── */}
      <Drawer
        title={<Space><Cpu size={16} />Auto-Arrange Timetable</Space>}
        open={generateDrawerOpen}
        onClose={() => setGenerateDrawerOpen(false)}
        width={440}
        footer={
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setGenerateDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" icon={<Cpu size={14} />} onClick={handleGenerate}>
              Start Auto-Arrange
            </Button>
          </Space>
        }
      >
        <Alert
          type="warning" showIcon
          message="This will replace the current timetable for this class."
          description={`All existing lessons for ${gradeLevel} (${className}) semester 2026-S1 will be removed and replaced with the new arrangement.`}
          style={{ marginBottom: 16 }}
        />
        <Card size="small" style={{ marginBottom: 12 }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <div>
              <Text strong>What Auto-Arrange does:</Text>
            </div>
            <div style={{ fontSize: 13, color: '#595959' }}>
              <div style={{ marginBottom: 4 }}>✅ Places all assigned courses into available time slots</div>
              <div style={{ marginBottom: 4 }}>✅ Prevents double-booking teachers or rooms</div>
              <div style={{ marginBottom: 4 }}>✅ Respects availability restrictions you've set</div>
              <div style={{ marginBottom: 4 }}>✅ Generates 3 options so you can choose the best layout</div>
              <div>✅ Spreads heavy subjects (Maths, Science) evenly across the week</div>
            </div>
          </Space>
        </Card>
        <Alert
          type="info" showIcon
          message={`Currently viewing: ${gradeLevel} (${className})`}
          description={courses.length > 0 ? `${courses.length} courses assigned to this grade will be scheduled.` : 'No courses found for this grade yet.'}
          style={{ marginBottom: 12 }}
        />
        {constraints.length > 0 && (
          <Alert
            type="info" showIcon
            message={`${constraints.length} availability restriction${constraints.length > 1 ? 's' : ''} will be applied`}
            style={{ marginBottom: 12 }}
          />
        )}
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          This process takes about 10–15 seconds. You will be presented with 3 options to choose from.
        </div>
      </Drawer>

      {/* ── Add Slot modal ───────────────────────────────────────── */}
      <Modal
        open={addSlotOpen}
        title={
          <Space>
            <PlusCircle size={16} />
            Add Lesson — {addSlotCell ? `${DAY_LABELS[addSlotCell.day]}, ${addSlotCell.startTime}` : ''}
          </Space>
        }
        onCancel={() => { setAddSlotOpen(false); addSlotForm.resetFields() }}
        onOk={handleAddSlot}
        confirmLoading={addSlotMutation.isPending}
        width={440}
        destroyOnHidden
      >
        <Form form={addSlotForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="courseId" label="Course" rules={[{ required: true, message: 'Select a course' }]}>
            <Select
              placeholder={`Select a ${gradeLevel} course`}
              options={courses.map((c: any) => ({ label: `${c.code} — ${c.name}`, value: c.id }))}
              showSearch
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              onChange={courseId => {
                const course = courses.find((c: any) => c.id === courseId)
                const teacherId = course?.assignments?.[0]?.teacher?.id
                if (teacherId) addSlotForm.setFieldValue('teacherId', teacherId)
              }}
            />
          </Form.Item>
          <Form.Item name="teacherId" label="Teacher" rules={[{ required: true, message: 'Select a teacher' }]}>
            <Select
              placeholder="Select teacher"
              options={teachers.map(t => ({ label: t.user?.displayName ?? t.staffId, value: t.id }))}
              showSearch
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="room" label="Room (optional)">
            <Input placeholder={`Classroom ${className}`} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Candidate selection modal ────────────────────────────── */}
      <Modal
        open={candidateModalOpen}
        title={<Space><Cpu size={18} />Choose Timetable Arrangement</Space>}
        onCancel={() => setCandidateModalOpen(false)}
        width={860}
        footer={
          <Space>
            <Button onClick={() => setCandidateModalOpen(false)}>Cancel</Button>
            <Button type="primary" icon={<CheckCircle2 size={15} />} loading={applying} disabled={selectedCandidateId === null} onClick={handleApplyCandidate}>
              Use Option {candidates.find(c => c.id === selectedCandidateId)?.rank ?? ''}
            </Button>
          </Space>
        }
      >
        <Alert
          type="success" showIcon
          message={`Auto-arrange complete — ${candidates.length} options generated. All have zero scheduling conflicts.`}
          style={{ marginBottom: 16 }}
        />
        <Radio.Group style={{ width: '100%' }} value={selectedCandidateId} onChange={e => setSelectedCandidateId(e.target.value)}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {candidates.map(candidate => (
              <Card
                key={candidate.id}
                style={{ border: selectedCandidateId === candidate.id ? '2px solid #1677ff' : '1px solid #f0f0f0', background: selectedCandidateId === candidate.id ? '#f0f7ff' : undefined, cursor: 'pointer' }}
                onClick={() => setSelectedCandidateId(candidate.id)}
              >
                <Row justify="space-between" align="top">
                  <Col>
                    <Space>
                      <Radio value={candidate.id} />
                      <div>
                        <Space>
                          <Tag color={candidate.rank === 1 ? 'blue' : 'default'} style={{ fontWeight: 700 }}>Option {candidate.rank}</Tag>
                          {candidate.rank === 1 && <Tag color="green" icon={<CheckCircle2 size={12} />}>Recommended</Tag>}
                        </Space>
                        <div style={{ marginTop: 4, color: '#595959', fontSize: 13 }}>{candidate.description}</div>
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Space size={16}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>{candidate.hardConflicts}</div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Conflicts</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: candidate.softViolations === 0 ? '#52c41a' : '#faad14' }}>{candidate.softViolations}</div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Soft issues</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{candidate.slotCount}</div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Lessons</div>
                      </div>
                    </Space>
                  </Col>
                </Row>
                {candidate.softViolations > 0 && (
                  <Alert type="warning" showIcon icon={<AlertTriangle size={13} />}
                    message={`${candidate.softViolations} minor issue${candidate.softViolations > 1 ? 's' : ''}: Maths/Science lessons back-to-back`}
                    style={{ marginTop: 10, padding: '4px 12px' }}
                  />
                )}
                <Divider style={{ margin: '10px 0' }} />
                {renderCandidateMini(candidate)}
                <Progress
                  percent={Math.round(((TIME_SLOTS.length * 5 - candidate.softViolations) / (TIME_SLOTS.length * 5)) * 100)}
                  size="small"
                  status={candidate.softViolations === 0 ? 'success' : 'normal'}
                  format={pct => `${pct}% optimal`}
                  style={{ marginTop: 8 }}
                />
              </Card>
            ))}
          </Space>
        </Radio.Group>
      </Modal>
    </div>
  )
}

// ── Root component — role-based split ───────────────────────────────────────

const TimetablePage = () => {
  const { user } = useAuthStore()
  const role = user?.role ?? ''
  const isManager = ['admin', 'manager', 'principal', 'hod'].includes(role)
  return isManager ? <AdminView /> : <TeacherView />
}

export default TimetablePage
