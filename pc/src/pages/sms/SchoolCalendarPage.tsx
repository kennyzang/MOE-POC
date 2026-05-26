import { useState } from 'react'
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
  List,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { ApiResponse } from '../../types'

interface SchoolEvent {
  id: string
  title: string
  date: string
  endDate?: string
  type: string
  description?: string
}

const TYPE_COLORS: Record<string, string> = {
  holiday: 'red',
  exam: 'orange',
  activity: 'blue',
  event: 'green',
}

const SchoolCalendarPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [form] = Form.useForm()

  const canEdit = ['admin', 'manager', 'principal'].includes(user?.role ?? '')

  const { data: events = [] } = useQuery({
    queryKey: ['school-events'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SchoolEvent[]>>('/sms/calendar-events')
      return res.data.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<SchoolEvent>>('/sms/calendar-events', {
        ...values,
        date: (values.date as Dayjs).format('YYYY-MM-DD'),
        endDate: values.endDate ? (values.endDate as Dayjs).format('YYYY-MM-DD') : undefined,
      })
      return res.data.data
    },
    onSuccess: () => {
      message.success(t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['school-events'] })
      setModalOpen(false)
      form.resetFields()
    },
    onError: () => message.error(t('common.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/sms/calendar-events/${id}`)
    },
    onSuccess: () => {
      message.success(t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['school-events'] })
    },
    onError: () => message.error(t('common.error')),
  })

  // Group events by date string for calendar cell rendering
  const eventsByDate: Record<string, SchoolEvent[]> = {}
  for (const ev of events) {
    const key = ev.date.slice(0, 10)
    if (!eventsByDate[key]) eventsByDate[key] = []
    eventsByDate[key].push(ev)
  }

  const dateCellRender = (value: Dayjs) => {
    const key = value.format('YYYY-MM-DD')
    const dayEvents = eventsByDate[key] ?? []
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayEvents.map(ev => (
          <li key={ev.id}>
            <Badge
              color={TYPE_COLORS[ev.type] ?? 'default'}
              text={
                <span style={{ fontSize: 11 }}>
                  {ev.title.length > 18 ? ev.title.slice(0, 18) + '…' : ev.title}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    )
  }

  // Events for selected month
  const selectedMonthEvents = events.filter(ev =>
    dayjs(ev.date).isSame(selectedDate, 'month')
  )

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            <CalendarDays size={24} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('sms.calendarTitle')}
            </Typography.Title>
          </Space>
        </Col>
        <Col>
          {canEdit && (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setModalOpen(true)}
            >
              {t('sms.addEvent')}
            </Button>
          )}
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={17}>
          <Card>
            <Calendar
              cellRender={(current, info) => {
                if (info.type === 'date') return dateCellRender(current)
                return null
              }}
              onSelect={(date) => setSelectedDate(date)}
            />
          </Card>
        </Col>
        <Col xs={24} lg={7}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={16} />
                {selectedDate.format('MMMM YYYY')}
              </span>
            }
          >
            <List
              dataSource={selectedMonthEvents}
              locale={{ emptyText: t('common.noData') }}
              renderItem={ev => (
                <List.Item
                  actions={
                    canEdit
                      ? [
                          <Popconfirm
                            key="delete"
                            title={t('sms.deleteEventConfirm')}
                            onConfirm={() => deleteMutation.mutate(ev.id)}
                            okType="danger"
                          >
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<Trash2 size={14} />}
                            />
                          </Popconfirm>,
                        ]
                      : []
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={TYPE_COLORS[ev.type] ?? 'default'} style={{ margin: 0 }}>
                          {t(`sms.type${ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}` as never, ev.type)}
                        </Tag>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{ev.title}</span>
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: 12 }}>
                        <div>
                          {dayjs(ev.date).format('D MMM')}
                          {ev.endDate && ` – ${dayjs(ev.endDate).format('D MMM')}`}
                        </div>
                        {ev.description && (
                          <div style={{ color: '#00000073', marginTop: 2 }}>{ev.description}</div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        title={
          <Space>
            <CalendarDays size={18} />
            <span>{t('sms.addEvent')}</span>
          </Space>
        }
        footer={null}
        width={480}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values as Record<string, unknown>)}
        >
          <Form.Item
            name="title"
            label={t('sms.eventTitle')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="date"
                label={t('sms.eventDate')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endDate" label={t('sms.eventEndDate')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="type"
            label={t('sms.eventType')}
            initialValue="event"
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Select
              options={[
                { value: 'holiday', label: t('sms.typeHoliday') },
                { value: 'exam', label: t('sms.typeExam') },
                { value: 'activity', label: t('sms.typeActivity') },
                { value: 'event', label: t('sms.typeEvent') },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
              {t('common.save')}
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default SchoolCalendarPage
