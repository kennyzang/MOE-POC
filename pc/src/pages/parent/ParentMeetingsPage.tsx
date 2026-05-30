import { useState } from 'react'
import {
  Card, Button, Select, DatePicker, Tag, List, Space, Typography,
  Spin, Empty, Modal, message, Row, Col,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Users, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import api from '@/lib/api'

const { Title, Text } = Typography

interface Teacher {
  teacherId: string
  teacherName: string
  teacherEmail: string
  courses: string[]
}

interface TimeSlot { startTime: string; endTime: string }

interface Meeting {
  id: string
  meetingDate: string
  startTime: string
  endTime: string
  purpose: string | null
  status: string
  teacher: { user: { displayName: string; email: string | null } }
  student: { user: { displayName: string } }
}

const STATUS_COLORS: Record<string, string> = { SCHEDULED: 'blue', COMPLETED: 'green', CANCELLED: 'default' }

const ParentMeetingsPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [bookOpen, setBookOpen] = useState(false)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | undefined>()
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [purpose, setPurpose] = useState('')

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['parent-meetings'],
    queryFn: async () => {
      const { data } = await api.get('/parent/meetings')
      return data.data as Meeting[]
    },
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ['parent-meeting-teachers'],
    queryFn: async () => {
      const { data } = await api.get('/parent/meetings/teachers')
      return data.data as Teacher[]
    },
  })

  const { data: availableSlots = [], isFetching: slotsLoading } = useQuery({
    queryKey: ['meeting-slots', selectedTeacherId, selectedDate?.format('YYYY-MM-DD')],
    queryFn: async () => {
      const { data } = await api.get(
        `/ems/meetings/availability/${selectedTeacherId}?date=${selectedDate!.format('YYYY-MM-DD')}`,
      )
      return data.data as TimeSlot[]
    },
    enabled: !!selectedTeacherId && !!selectedDate,
  })

  const bookMutation = useMutation({
    mutationFn: async () => {
      const childId = await api.get('/dashboard/stats').then(
        (r) => (r.data.data.children as Array<{ id: string }>)[0]?.id,
      )
      const { data } = await api.post('/ems/meetings/book', {
        teacherId: selectedTeacherId,
        studentId: childId,
        meetingDate: selectedDate!.format('YYYY-MM-DD'),
        startTime: selectedSlot!.startTime,
        endTime: selectedSlot!.endTime,
        purpose: purpose || 'Academic discussion',
      })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parent-meetings'] })
      message.success(t('parentPortal.meetingBooked', { defaultValue: 'Meeting booked successfully!' }))
      setBookOpen(false)
      setSelectedTeacherId(undefined)
      setSelectedDate(null)
      setSelectedSlot(null)
      setPurpose('')
    },
    onError: () => message.error(t('parentPortal.meetingBookFailed', { defaultValue: 'Could not book meeting. Please try another slot.' })),
  })

  const upcoming = meetings.filter((m) => m.status === 'SCHEDULED' && dayjs(m.meetingDate).isAfter(dayjs().subtract(1, 'day')))
  const past = meetings.filter((m) => m.status !== 'SCHEDULED' || dayjs(m.meetingDate).isBefore(dayjs()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space align="center">
            <Calendar size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>
              {t('parentPortal.parentTeacherMeetings', { defaultValue: 'Parent-Teacher Meetings' })}
            </Title>
          </Space>
          <Button type="primary" icon={<Calendar size={14} />} onClick={() => setBookOpen(true)}>
            {t('parentPortal.bookMeeting', { defaultValue: 'Book Meeting' })}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <>
          {/* Upcoming */}
          <Card title={<Space><Clock size={15} />{t('parentPortal.upcomingMeetings', { defaultValue: 'Upcoming Meetings' })}</Space>}>
            {upcoming.length === 0 ? (
              <Empty description={t('parentPortal.noMeetings', { defaultValue: 'No upcoming meetings. Book one with your child\'s teacher.' })} />
            ) : (
              <List
                dataSource={upcoming}
                renderItem={(m) => (
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <div>
                        <Text strong>{m.teacher.user.displayName}</Text>
                        <div style={{ fontSize: 12, color: '#86909c' }}>
                          {dayjs(m.meetingDate).format('ddd, D MMM YYYY')} · {m.startTime}–{m.endTime}
                        </div>
                        {m.purpose && <div style={{ fontSize: 12, color: '#595959' }}>{m.purpose}</div>}
                        <div style={{ fontSize: 11, color: '#86909c' }}>For: {m.student.user.displayName}</div>
                      </div>
                      <Tag color={STATUS_COLORS[m.status] ?? 'default'}>{m.status}</Tag>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>

          {/* Past */}
          {past.length > 0 && (
            <Card title={t('parentPortal.pastMeetings', { defaultValue: 'Past Meetings' })}>
              <List
                dataSource={past.slice(0, 5)}
                renderItem={(m) => (
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <div>
                        <Text>{m.teacher.user.displayName}</Text>
                        <div style={{ fontSize: 12, color: '#86909c' }}>
                          {dayjs(m.meetingDate).format('D MMM YYYY')} · {m.startTime}
                        </div>
                      </div>
                      <Tag color={STATUS_COLORS[m.status] ?? 'default'}>{m.status}</Tag>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </>
      )}

      {/* Book Meeting Modal */}
      <Modal
        title={<Space><Users size={16} />{t('parentPortal.bookMeeting', { defaultValue: 'Book a Meeting' })}</Space>}
        open={bookOpen}
        onCancel={() => setBookOpen(false)}
        onOk={() => selectedSlot && bookMutation.mutate()}
        okText={t('parentPortal.confirmBooking', { defaultValue: 'Confirm Booking' })}
        okButtonProps={{ disabled: !selectedSlot, loading: bookMutation.isPending }}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ fontSize: 12, color: '#86909c' }}>{t('parentPortal.selectTeacher', { defaultValue: 'Select Teacher' })}</Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              placeholder={t('parentPortal.selectTeacher', { defaultValue: 'Select a teacher' })}
              value={selectedTeacherId}
              onChange={(v) => { setSelectedTeacherId(v); setSelectedSlot(null) }}
              options={teachers.map((t) => ({
                value: t.teacherId,
                label: `${t.teacherName} (${t.courses.join(', ')})`,
              }))}
            />
          </div>
          <div>
            <Text style={{ fontSize: 12, color: '#86909c' }}>{t('parentPortal.selectDate', { defaultValue: 'Select Date' })}</Text>
            <DatePicker
              style={{ width: '100%', marginTop: 4 }}
              disabledDate={(d) => d.isBefore(dayjs(), 'day') || d.day() === 0 || d.day() === 6}
              value={selectedDate}
              onChange={(d) => { setSelectedDate(d); setSelectedSlot(null) }}
            />
          </div>
          {selectedTeacherId && selectedDate && (
            <div>
              <Text style={{ fontSize: 12, color: '#86909c' }}>{t('parentPortal.availableSlots', { defaultValue: 'Available Slots' })}</Text>
              {slotsLoading ? (
                <div style={{ textAlign: 'center', padding: 12 }}><Spin size="small" /></div>
              ) : availableSlots.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>No slots available on this date.</Text>
              ) : (
                <Row gutter={[8, 8]} style={{ marginTop: 6 }}>
                  {availableSlots.map((slot) => (
                    <Col key={`${slot.startTime}-${slot.endTime}`} span={8}>
                      <Button
                        size="small"
                        block
                        type={selectedSlot?.startTime === slot.startTime ? 'primary' : 'default'}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot.startTime}–{slot.endTime}
                      </Button>
                    </Col>
                  ))}
                </Row>
              )}
            </div>
          )}
          <div>
            <Text style={{ fontSize: 12, color: '#86909c' }}>{t('parentPortal.meetingPurpose', { defaultValue: 'Purpose (optional)' })}</Text>
            <input
              style={{ width: '100%', marginTop: 4, padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13 }}
              placeholder="Discuss academic progress..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ParentMeetingsPage
