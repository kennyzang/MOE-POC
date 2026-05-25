import { useState } from 'react'
import {
  Table,
  Select,
  Card,
  Space,
  Row,
  Col,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  Badge,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { Calendar, RefreshCw, PlusCircle, Trash2 } from 'lucide-react'
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

const GRADE_LEVELS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11']

const TimetablePage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()

  const [gradeLevel, setGradeLevel] = useState('Year 7')
  const [className, setClassName] = useState('7A')
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [constraintModalOpen, setConstraintModalOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  const qKey = ['timetable', gradeLevel, className]

  const { data: slots = [], isLoading, refetch } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        gradeLevel,
        className,
        semester: '2026-S1',
      })
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

  // Build a lookup: dayOfWeek × startTime → slot
  const slotMap = new Map<string, TimetableSlot>()
  for (const slot of slots) {
    slotMap.set(`${slot.dayOfWeek}-${slot.startTime}`, slot)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const { data } = await api.post('/sms/timetable/generate', {
        gradeLevel,
        className,
        semester: '2026-S1',
        constraints: constraints.map(c => ({
          teacherId: c.teacherId,
          dayOfWeek: c.dayOfWeek,
          startTime: c.startTime,
          reason: c.reason,
        })),
      })
      if (data.success) {
        message.success(t('sms.generatingSuccess'))
        queryClient.invalidateQueries({ queryKey: qKey })
      } else {
        message.error(data.message ?? t('sms.generatingFailed'))
      }
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string } } }
      message.error(axErr?.response?.data?.message ?? t('sms.generatingFailed'))
    } finally {
      setGenerating(false)
    }
  }

  const handleAddConstraint = () => {
    form.validateFields().then(values => {
      const teacher = teachers.find(t => t.id === values.teacherId)
      const newConstraint: Constraint = {
        teacherId: values.teacherId,
        teacherName: teacher?.user?.displayName ?? values.teacherId,
        dayOfWeek: values.dayOfWeek,
        startTime: values.startTime,
        reason: values.reason,
      }
      setConstraints(prev => [...prev, newConstraint])
      form.resetFields()
      setConstraintModalOpen(false)
    })
  }

  const removeConstraint = (idx: number) => {
    setConstraints(prev => prev.filter((_, i) => i !== idx))
  }

  // Build table columns: one per day (Mon-Fri)
  const dayColumns = DAY_KEYS.map((dayKey, dayIdx) => ({
    title: t(`sms.${dayKey}`),
    key: dayKey,
    width: 160,
    render: (_: unknown, row: { startTime: string; endTime: string; label: string }) => {
      const slot = slotMap.get(`${dayIdx}-${row.startTime}`)
      if (!slot) {
        return (
          <div
            style={{
              background: '#f5f5f5',
              borderRadius: 4,
              padding: '6px 8px',
              minHeight: 60,
              color: '#bfbfbf',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            —
          </div>
        )
      }
      return (
        <div
          style={{
            background: '#e6f4ff',
            border: '1px solid #91caff',
            borderRadius: 4,
            padding: '6px 8px',
            minHeight: 60,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, color: '#0958d9' }}>
            {slot.course?.name ?? slot.courseId}
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
            {slot.teacher?.user?.displayName ?? ''}
          </div>
          {slot.room && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              {slot.room}
            </div>
          )}
        </div>
      )
    },
  }))

  const timeColumn = {
    title: t('workload.weeklySchedule'),
    key: 'time',
    width: 130,
    render: (row: { label: string }) => (
      <Text style={{ fontWeight: 500, fontSize: 12 }}>{row.label}</Text>
    ),
  }

  const tableData = TIME_SLOTS.map(ts => ({
    key: ts.startTime,
    label: ts.label,
    startTime: ts.startTime,
    endTime: ts.endTime,
  }))

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <Calendar size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('sms.timetableTitle')}
            </Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Badge count={constraints.length} size="small">
              <Button
                icon={<PlusCircle size={15} />}
                onClick={() => setConstraintModalOpen(true)}
              >
                {t('sms.addConstraint')}
              </Button>
            </Badge>
            <Button
              type="primary"
              icon={<RefreshCw size={15} />}
              loading={generating}
              onClick={handleGenerate}
            >
              {t('sms.generateTimetable')}
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Select
              style={{ width: '100%' }}
              value={gradeLevel}
              onChange={setGradeLevel}
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
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <span>{t('sms.constraints')}</span>
              <Badge count={constraints.length} />
            </Space>
          }
        >
          <Space wrap>
            {constraints.map((c, idx) => (
              <Tag
                key={idx}
                closable
                onClose={() => removeConstraint(idx)}
                color="orange"
              >
                {c.teacherName} — {t(`sms.${DAY_KEYS[c.dayOfWeek]}`)} {c.startTime}
                {c.reason ? ` (${c.reason})` : ''}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {/* Timetable grid */}
      <Card>
        <Table
          rowKey="key"
          loading={isLoading}
          dataSource={tableData}
          columns={[timeColumn, ...dayColumns]}
          pagination={false}
          bordered
          size="small"
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>

      {/* Add Constraint Modal */}
      <Modal
        open={constraintModalOpen}
        title={t('sms.addConstraint')}
        onCancel={() => {
          form.resetFields()
          setConstraintModalOpen(false)
        }}
        onOk={handleAddConstraint}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="teacherId"
            label={t('sms.constraintTeacher')}
            rules={[{ required: true }]}
          >
            <Select
              placeholder={t('sms.constraintTeacher')}
              options={teachers.map(tc => ({
                label: tc.user?.displayName ?? tc.staffId,
                value: tc.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="dayOfWeek"
            label={t('sms.constraintDay')}
            rules={[{ required: true }]}
          >
            <Select
              placeholder={t('sms.constraintDay')}
              options={DAY_KEYS.map((dk, idx) => ({
                label: t(`sms.${dk}`),
                value: idx,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="startTime"
            label={t('sms.constraintTime')}
            rules={[{ required: true }]}
          >
            <Select
              placeholder={t('sms.constraintTime')}
              options={TIME_SLOTS.map(ts => ({
                label: ts.label,
                value: ts.startTime,
              }))}
            />
          </Form.Item>
          <Form.Item name="reason" label={t('sms.constraintReason')}>
            <Input placeholder={t('sms.constraintReason')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Tooltip to explain delete icon usage in constraint tags */}
      <Tooltip title="">
        <span style={{ display: 'none' }}>
          <Trash2 size={0} />
        </span>
      </Tooltip>
    </div>
  )
}

export default TimetablePage
