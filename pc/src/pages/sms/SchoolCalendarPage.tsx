import { useState, useMemo } from 'react'
import {
  Calendar,
  Badge,
  Card,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Space,
  Typography,
  Tag,
  Popconfirm,
  message,
  Row,
  Col,
  Descriptions,
  Alert,
  Empty,
  Segmented,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays, Plus, Trash2, Edit2, ExternalLink,
  Plane, BookOpen, Users, Briefcase, Bell, ChevronRight,
} from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { ApiResponse } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────

interface SchoolEvent {
  id: string
  title: string
  date: string
  endDate?: string
  type: string
  description?: string
  isPersonal?: boolean
  createdByUserId?: string
}

interface CalEvent {
  id: string
  title: string
  date: string
  endDate?: string
  source: 'school' | 'leave' | 'cpd' | 'meeting' | 'training' | 'personal'
  color: string
  description?: string
  navPath?: string
  isPersonal?: boolean
  rawType?: string
}

// ── Color + icon map by source ───────────────────────────────────────────

const SOURCE_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  school:   { color: 'blue',    icon: <CalendarDays size={12} />, label: 'School Event' },
  leave:    { color: 'purple',  icon: <Plane size={12} />,        label: 'Leave' },
  cpd:      { color: 'cyan',    icon: <BookOpen size={12} />,     label: 'CPD Workshop' },
  meeting:  { color: 'orange',  icon: <Users size={12} />,        label: 'Meeting' },
  training: { color: 'geekblue',icon: <Briefcase size={12} />,    label: 'Training' },
  personal: { color: 'default', icon: <Bell size={12} />,         label: 'Personal Reminder' },
}

// Maps SchoolEvent.type → badge color for calendar cells
const SCHOOL_TYPE_COLORS: Record<string, string> = {
  holiday:  'red',
  exam:     'gold',
  activity: 'green',
  event:    'blue',
  personal: '#8c8c8c',
}

// Human-readable labels for school event types
const EVENT_TYPE_LABELS: Record<string, string> = {
  holiday: 'Holiday', exam: 'Exam', activity: 'Activity', event: 'School Event',
}

const SchoolCalendarPage = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [viewEvent, setViewEvent] = useState<CalEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDate, setCreateDate] = useState<Dayjs>(dayjs())
  const [reminderOpen, setReminderOpen] = useState(false)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [reminderForm] = Form.useForm()

  const role = user?.role ?? ''
  const canEditSchool = ['admin', 'manager', 'principal'].includes(role)
  const [sidebarView, setSidebarView] = useState<'upcoming' | 'month'>('upcoming')

  // ── Data fetching ────────────────────────────────────────────────────────

  const { data: schoolEvents = [] } = useQuery<SchoolEvent[]>({
    queryKey: ['school-events'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SchoolEvent[]>>('/sms/calendar-events')
      return res.data.data
    },
  })

  const { data: leaveData = [] } = useQuery<any[]>({
    queryKey: ['calendar-leave'],
    queryFn: async () => {
      const res = await api.get('/leave/calendar')
      return res.data.data
    },
    enabled: ['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role),
  })

  const { data: cpdData = [] } = useQuery<any[]>({
    queryKey: ['calendar-cpd'],
    queryFn: async () => {
      const res = await api.get('/ems/cpd-workshops')
      return res.data.data
    },
    enabled: ['admin', 'manager', 'hod', 'principal', 'teacher'].includes(role),
  })

  const { data: meetingData = [] } = useQuery<any[]>({
    queryKey: ['calendar-meetings'],
    queryFn: async () => {
      const res = await api.get('/ems/meetings')
      return res.data.data
    },
    enabled: ['teacher', 'parent'].includes(role),
  })

  const { data: trainingData = [] } = useQuery<any[]>({
    queryKey: ['calendar-training'],
    queryFn: async () => {
      const res = await api.get('/self-service/my-requests')
      return res.data.data
    },
    enabled: ['teacher', 'hod', 'principal'].includes(role),
  })

  // ── Normalise all sources into unified CalEvent[] ────────────────────────

  const allEvents = useMemo<CalEvent[]>(() => {
    const events: CalEvent[] = []

    // School events
    for (const ev of schoolEvents) {
      if (ev.isPersonal) {
        events.push({
          id: ev.id, title: ev.title,
          date: ev.date.slice(0, 10),
          endDate: ev.endDate?.slice(0, 10),
          source: 'personal', color: 'default',
          description: ev.description, isPersonal: true,
        })
      } else {
        events.push({
          id: ev.id, title: ev.title,
          date: ev.date.slice(0, 10),
          endDate: ev.endDate?.slice(0, 10),
          source: 'school',
          color: SCHOOL_TYPE_COLORS[ev.type] ?? 'blue',
          description: ev.description, rawType: ev.type,
        })
      }
    }

    // Leave — for teachers show only their own; for others show all approved
    const teacherUserId = user?.id
    for (const l of leaveData) {
      const isTeacher = role === 'teacher'
      if (isTeacher && l.teacher?.user?.id && l.teacher.user.id !== teacherUserId) continue
      const label = isTeacher
        ? `Leave — ${l.leaveType?.replace(/_/g, ' ')}`
        : `${l.teacher?.user?.displayName ?? 'Teacher'} on leave`
      events.push({
        id: `leave-${l.id}`, title: label,
        date: l.startDate?.slice(0, 10),
        endDate: l.endDate?.slice(0, 10),
        source: 'leave', color: 'purple',
        description: `${l.leaveType?.replace(/_/g, ' ')} · ${l.status}`,
        navPath: '/ems/leave',
      })
    }

    // CPD — only show workshops the user is enrolled in
    for (const w of cpdData) {
      const isEnrolled = w.enrollments?.some((e: any) => e.status === 'ENROLLED')
      if (!isEnrolled) continue
      events.push({
        id: `cpd-${w.id}`, title: `CPD: ${w.title}`,
        date: w.startDate?.slice(0, 10),
        endDate: w.endDate?.slice(0, 10),
        source: 'cpd', color: 'cyan',
        description: `${w.category ?? ''} · ${w.venue ?? ''}`,
        navPath: '/ems/cpd-workshops',
      })
    }

    // Meetings
    for (const m of meetingData) {
      const who = role === 'teacher'
        ? `Meeting with parent of ${m.student?.user?.displayName ?? 'student'}`
        : `Meeting with ${m.teacher?.user?.displayName ?? 'teacher'}`
      events.push({
        id: `meeting-${m.id}`, title: who,
        date: m.meetingDate?.slice(0, 10),
        source: 'meeting', color: 'orange',
        description: `${m.startTime ?? ''} – ${m.endTime ?? ''} · ${m.purpose ?? ''}`,
        navPath: role === 'parent' ? '/parent/meetings' : undefined,
      })
    }

    // Training requests
    for (const t of trainingData) {
      if (t.type !== 'TRAINING') continue
      events.push({
        id: `train-${t.id}`, title: `Training: ${t.courseName ?? 'Course'}`,
        date: t.createdAt?.slice(0, 10),
        source: 'training', color: 'geekblue',
        description: `${t.courseProvider ? t.courseProvider + ' · ' : ''}${t.courseDates ?? ''} · Status: ${t.status}`,
        navPath: '/ems/self-service',
      })
    }

    return events
  }, [schoolEvents, leaveData, cpdData, meetingData, trainingData, role])

  // ── Group by date ────────────────────────────────────────────────────────

  const eventsByDate = useMemo<Record<string, CalEvent[]>>(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const ev of allEvents) {
      if (!ev.date) continue
      // expand multi-day events
      const start = dayjs(ev.date)
      const end = ev.endDate ? dayjs(ev.endDate) : start
      let cur = start
      while (!cur.isAfter(end)) {
        const key = cur.format('YYYY-MM-DD')
        if (!map[key]) map[key] = []
        map[key].push(ev)
        cur = cur.add(1, 'day')
      }
    }
    return map
  }, [allEvents])

  // ── Calendar cell renderer ────────────────────────────────────────────────

  const dateCellRender = (value: Dayjs) => {
    const key = value.format('YYYY-MM-DD')
    const dayEvents = eventsByDate[key] ?? []
    if (!dayEvents.length) return null
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayEvents.slice(0, 3).map(ev => {
          // Resolve badge color: school events use type-based color, others use source color
          const badgeColor = ev.source === 'school' && ev.rawType
            ? (SCHOOL_TYPE_COLORS[ev.rawType] ?? 'blue')
            : ev.color === 'default' ? '#8c8c8c' : ev.color
          return (
            <li key={ev.id} onClick={(e) => { e.stopPropagation(); setViewEvent(ev) }} style={{ cursor: 'pointer' }}>
              <Badge
                color={badgeColor}
                text={
                  <span style={{ fontSize: 11 }}>
                    {ev.title.length > 22 ? ev.title.slice(0, 22) + '…' : ev.title}
                  </span>
                }
                style={{ lineHeight: '20px' }}
              />
            </li>
          )
        })}
        {dayEvents.length > 3 && (
          <li style={{ fontSize: 11, color: '#8c8c8c', paddingLeft: 14 }}>+{dayEvents.length - 3} more</li>
        )}
      </ul>
    )
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      api.post('/sms/calendar-events', {
        ...values,
        date: (values.date as Dayjs).format('YYYY-MM-DD'),
        endDate: values.endDate ? (values.endDate as Dayjs).format('YYYY-MM-DD') : undefined,
      }),
    onSuccess: () => {
      message.success('Event created')
      queryClient.invalidateQueries({ queryKey: ['school-events'] })
      setCreateOpen(false); form.resetFields()
    },
    onError: () => message.error('Failed to create event'),
  })

  const createReminderMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      api.post('/sms/calendar-events', {
        ...values,
        date: (values.date as Dayjs).format('YYYY-MM-DD'),
        type: 'personal',
      }),
    onSuccess: () => {
      message.success('Reminder saved')
      queryClient.invalidateQueries({ queryKey: ['school-events'] })
      setReminderOpen(false); reminderForm.resetFields()
    },
    onError: () => message.error('Failed to save reminder'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      api.patch(`/sms/calendar-events/${id}`, {
        ...values,
        date: (values.date as Dayjs).format('YYYY-MM-DD'),
        endDate: values.endDate ? (values.endDate as Dayjs).format('YYYY-MM-DD') : undefined,
      }),
    onSuccess: () => {
      message.success('Event updated')
      queryClient.invalidateQueries({ queryKey: ['school-events'] })
      setEditingEvent(null)
    },
    onError: () => message.error('Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/sms/calendar-events/${id}`),
    onSuccess: () => {
      message.success('Deleted')
      queryClient.invalidateQueries({ queryKey: ['school-events'] })
      setViewEvent(null)
    },
    onError: () => message.error('Failed to delete'),
  })

  const openEdit = (ev: SchoolEvent) => {
    setEditingEvent(ev)
    setViewEvent(null)
    editForm.setFieldsValue({
      title: ev.title,
      date: dayjs(ev.date),
      endDate: ev.endDate ? dayjs(ev.endDate) : undefined,
      type: ev.type,
      description: ev.description ?? '',
    })
  }

  // ── Sidebar event lists ───────────────────────────────────────────────────

  const selectedMonthEvents = useMemo(() =>
    allEvents.filter(ev => ev.date && dayjs(ev.date).isSame(selectedDate, 'month'))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [allEvents, selectedDate]
  )

  const upcomingEvents = useMemo(() => {
    const today = dayjs().startOf('day')
    const cutoff = today.add(90, 'day')
    return allEvents
      .filter(ev => ev.date && !dayjs(ev.date).isBefore(today) && !dayjs(ev.date).isAfter(cutoff))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 20)
  }, [allEvents])

  // ── Legend ───────────────────────────────────────────────────────────────

  const activeSources = [...new Set(allEvents.map(e => e.source))]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            <CalendarDays size={24} />
            <Typography.Title level={4} style={{ margin: 0 }}>Calendar Hub</Typography.Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<Bell size={16} />} onClick={() => { setCreateDate(selectedDate); reminderForm.setFieldsValue({ date: selectedDate }); setReminderOpen(true) }}>
              Add Reminder
            </Button>
            {canEditSchool && (
              <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
                Add School Event
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* Legend */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* School event type sub-legend */}
        <Badge color="red" text={<span style={{ fontSize: 12 }}>Holiday</span>} />
        <Badge color="gold" text={<span style={{ fontSize: 12 }}>Exam</span>} />
        <Badge color="green" text={<span style={{ fontSize: 12 }}>Activity</span>} />
        <Badge color="blue" text={<span style={{ fontSize: 12 }}>School Event</span>} />
        {activeSources.filter(s => s !== 'school').map(src => {
          const meta = SOURCE_META[src]
          return (
            <Tag key={src} color={meta.color} icon={meta.icon} style={{ fontSize: 12 }}>
              {meta.label}
            </Tag>
          )
        })}
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={17}>
          <Card bodyStyle={{ padding: 0 }}>
            <Calendar
              cellRender={(current, info) => {
                if (info.type === 'date') return dateCellRender(current)
                return null
              }}
              onSelect={(date) => {
                setSelectedDate(date)
              }}
              onPanelChange={(date) => setSelectedDate(date)}
            />
          </Card>
          <Alert
            type="info"
            style={{ marginTop: 8 }}
            message="Click any event to view details and navigate. Use 'Add Reminder' to create a personal note on any date."
            showIcon
          />
        </Col>

        <Col xs={24} lg={7}>
          <Card
            title={
              <Space>
                <CalendarDays size={16} />
                Events
              </Space>
            }
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: '8px 0 0' }}
            extra={
              <Segmented
                size="small"
                value={sidebarView}
                onChange={v => setSidebarView(v as 'upcoming' | 'month')}
                options={[
                  { label: 'Upcoming', value: 'upcoming' },
                  { label: selectedDate.format('MMM'), value: 'month' },
                ]}
              />
            }
          >
            {(() => {
              const eventsToShow = sidebarView === 'upcoming' ? upcomingEvents : selectedMonthEvents
              if (!eventsToShow.length) {
                return (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={sidebarView === 'upcoming' ? 'No upcoming events in the next 90 days' : `No events in ${selectedDate.format('MMMM YYYY')}`}
                    style={{ margin: '16px 0' }}
                  />
                )
              }
              let lastMonth = ''
              return (
                <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                  {eventsToShow.map(ev => {
                    const meta = SOURCE_META[ev.source]
                    const schoolEv = ev.source === 'school' ? schoolEvents.find(s => s.id === ev.id) : null
                    const canDelete = ev.isPersonal || (canEditSchool && ev.source === 'school')
                    const evMonth = dayjs(ev.date).format('MMMM YYYY')
                    const showHeader = evMonth !== lastMonth
                    lastMonth = evMonth
                    const badgeColor = ev.source === 'school' && ev.rawType
                      ? (SCHOOL_TYPE_COLORS[ev.rawType] ?? 'blue')
                      : ev.color === 'default' ? '#8c8c8c' : ev.color
                    return (
                      <div key={ev.id}>
                        {showHeader && (
                          <div style={{ padding: '6px 16px 3px', fontSize: 11, fontWeight: 600, color: '#8c8c8c', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
                            {evMonth}
                          </div>
                        )}
                        <div
                          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '6px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
                          onClick={() => setViewEvent(ev)}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <Space size={8} align="start" style={{ flex: 1, minWidth: 0 }}>
                            <Badge color={badgeColor} style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#262626', lineHeight: '18px' }}>
                                {ev.title.length > 26 ? ev.title.slice(0, 26) + '…' : ev.title}
                              </div>
                              <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                {dayjs(ev.date).format('D MMM')}
                                {ev.endDate && ev.endDate !== ev.date ? ` – ${dayjs(ev.endDate).format('D MMM')}` : ''}
                                {' · '}{meta.label}
                              </div>
                            </div>
                          </Space>
                          <Space size={2} style={{ flexShrink: 0, marginLeft: 4 }}>
                            {canEditSchool && schoolEv && !schoolEv.isPersonal && (
                              <Button type="text" size="small" icon={<Edit2 size={11} />}
                                onClick={(e) => { e.stopPropagation(); openEdit(schoolEv) }} />
                            )}
                            {canDelete && (
                              <Popconfirm title="Delete this event?" onConfirm={(e) => { e?.stopPropagation(); deleteMutation.mutate(ev.id) }} okType="danger">
                                <Button type="text" size="small" danger icon={<Trash2 size={11} />}
                                  onClick={(e) => e.stopPropagation()} />
                              </Popconfirm>
                            )}
                            <ChevronRight size={11} style={{ color: '#d9d9d9' }} />
                          </Space>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </Card>

          {/* Quick create reminder panel */}
          <Card
            size="small"
            title={<Space><Bell size={14} />Quick Reminder</Space>}
          >
            <Button
              block
              icon={<Plus size={14} />}
              onClick={() => {
                reminderForm.setFieldsValue({ date: selectedDate })
                setCreateDate(selectedDate)
                setReminderOpen(true)
              }}
            >
              Add on {selectedDate.format('D MMM YYYY')}
            </Button>
          </Card>
        </Col>
      </Row>

      {/* ── Event detail modal ───────────────────────────────────────── */}
      {viewEvent && (
        <Modal
          open={!!viewEvent}
          onCancel={() => setViewEvent(null)}
          title={
            <Space>
              <Tag color={SOURCE_META[viewEvent.source].color}>
                {SOURCE_META[viewEvent.source].label.toUpperCase()}
              </Tag>
              {viewEvent.title}
            </Space>
          }
          footer={
            <Space wrap>
              {viewEvent.navPath && (
                <Button
                  type="primary"
                  icon={<ExternalLink size={14} />}
                  onClick={() => { setViewEvent(null); navigate(viewEvent.navPath!) }}
                >
                  Go to {SOURCE_META[viewEvent.source].label}
                </Button>
              )}
              {viewEvent.isPersonal && (
                <Popconfirm title="Delete this reminder?" onConfirm={() => deleteMutation.mutate(viewEvent.id)} okType="danger">
                  <Button danger icon={<Trash2 size={14} />}>Delete</Button>
                </Popconfirm>
              )}
              {canEditSchool && viewEvent.source === 'school' && !viewEvent.isPersonal && (() => {
                const schoolEv = schoolEvents.find(s => s.id === viewEvent.id)
                return schoolEv ? (
                  <>
                    <Button icon={<Edit2 size={14} />} onClick={() => openEdit(schoolEv)}>Edit</Button>
                    <Popconfirm title="Delete this event?" onConfirm={() => deleteMutation.mutate(viewEvent.id)} okType="danger">
                      <Button danger icon={<Trash2 size={14} />}>Delete</Button>
                    </Popconfirm>
                  </>
                ) : null
              })()}
              <Button onClick={() => setViewEvent(null)}>Close</Button>
            </Space>
          }
          width={460}
        >
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Title">{viewEvent.title}</Descriptions.Item>
            <Descriptions.Item label="Type">
              {viewEvent.source === 'school' && viewEvent.rawType ? (
                <Space size={4}>
                  <Tag color={SOURCE_META['school'].color}>{SOURCE_META['school'].label}</Tag>
                  <Tag color={SCHOOL_TYPE_COLORS[viewEvent.rawType] ?? 'blue'}>
                    {EVENT_TYPE_LABELS[viewEvent.rawType] ?? viewEvent.rawType}
                  </Tag>
                </Space>
              ) : (
                <Tag color={SOURCE_META[viewEvent.source].color}>{SOURCE_META[viewEvent.source].label}</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Date">
              {dayjs(viewEvent.date).format('D MMMM YYYY')}
              {viewEvent.endDate && viewEvent.endDate !== viewEvent.date
                ? ` — ${dayjs(viewEvent.endDate).format('D MMMM YYYY')}`
                : ''}
            </Descriptions.Item>
            {viewEvent.description && (
              <Descriptions.Item label="Details">{viewEvent.description}</Descriptions.Item>
            )}
          </Descriptions>
        </Modal>
      )}

      {/* ── Edit school event modal ──────────────────────────────────── */}
      {editingEvent && (
        <Modal
          open={!!editingEvent}
          onCancel={() => setEditingEvent(null)}
          title={<Space><Edit2 size={16} />Edit Event</Space>}
          footer={null}
          width={480}
          destroyOnHidden
        >
          <Form form={editForm} layout="vertical" onFinish={(v) => updateMutation.mutate({ id: editingEvent.id, values: v as Record<string, unknown> })}>
            <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="endDate" label="End Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select options={[
                { value: 'holiday', label: 'Holiday' },
                { value: 'exam', label: 'Exam' },
                { value: 'activity', label: 'Activity' },
                { value: 'event', label: 'Event' },
              ]} />
            </Form.Item>
            <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={() => setEditingEvent(null)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>Save</Button>
            </Space>
          </Form>
        </Modal>
      )}

      {/* ── Create school event modal ────────────────────────────────── */}
      <Modal
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        title={<Space><CalendarDays size={18} />Add School Event</Space>}
        footer={null}
        width={480}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v as Record<string, unknown>)}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endDate" label="End Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="type" label="Type" initialValue="event" rules={[{ required: true }]}>
            <Select options={[
              { value: 'holiday', label: 'Holiday' },
              { value: 'exam', label: 'Exam' },
              { value: 'activity', label: 'Activity' },
              { value: 'event', label: 'Event' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>Create</Button>
          </Space>
        </Form>
      </Modal>

      {/* ── Create personal reminder modal ───────────────────────────── */}
      <Modal
        open={reminderOpen}
        onCancel={() => { setReminderOpen(false); reminderForm.resetFields() }}
        title={<Space><Bell size={18} />Add Personal Reminder</Space>}
        footer={null}
        width={440}
        destroyOnHidden
      >
        <Alert
          type="info"
          message="Personal reminders are only visible to you."
          style={{ marginBottom: 16 }}
          showIcon
        />
        <Form form={reminderForm} layout="vertical" onFinish={(v) => createReminderMutation.mutate(v as Record<string, unknown>)}>
          <Form.Item name="title" label="Reminder" rules={[{ required: true }]}>
            <Input placeholder="e.g. Submit marks, Parent call, Meeting prep" />
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Notes (optional)">
            <Input.TextArea rows={2} placeholder="Additional details" />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setReminderOpen(false); reminderForm.resetFields() }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createReminderMutation.isPending}>Save Reminder</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default SchoolCalendarPage
