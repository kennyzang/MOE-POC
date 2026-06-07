import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag, Dialog, Toast } from 'antd-mobile'
import { Calendar, Users, Clock, Plus, CheckCircle2, XCircle } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'

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

const TIME_SLOTS = [
  { start: '14:00', end: '14:30' },
  { start: '14:30', end: '15:00' },
  { start: '15:00', end: '15:30' },
  { start: '15:30', end: '16:00' },
  { start: '16:00', end: '16:30' },
  { start: '16:30', end: '17:00' },
]

const STATUS_MAP: Record<string, { color: string; labelKey: string }> = {
  SCHEDULED: { color: '#165DFF', labelKey: 'parent.scheduled' },
  COMPLETED: { color: '#00B42A', labelKey: 'parent.completed' },
  CANCELLED: { color: '#86909c', labelKey: 'parent.cancelled' },
}

export default function ParentMeetingsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [bookOpen, setBookOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<number>(-1)
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))

  const { data: meetings = [], isLoading, refetch } = useQuery({
    queryKey: ['parent-meetings'],
    queryFn: async () => {
      const { data } = await api.get('/parent/meetings')
      return data.data as Meeting[]
    },
  })

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (selectedSlot < 0) throw new Error('Select a time slot')
      const slot = TIME_SLOTS[selectedSlot]
      const { data } = await api.post('/parent/meetings', {
        meetingDate: selectedDate,
        startTime: slot.start,
        endTime: slot.end,
        purpose: '',
      })
      return data
    },
    onSuccess: () => {
      setBookOpen(false)
      setSelectedSlot(-1)
      Toast.show({ icon: 'success', content: t('parent.scheduled') })
      void queryClient.invalidateQueries({ queryKey: ['parent-meetings'] })
    },
    onError: () => {
      Toast.show({ icon: 'fail', content: 'Booking failed' })
    },
  })

  const handleBook = () => {
    Dialog.confirm({
      content: `${t('parent.selectDate')}: ${selectedDate}\n${t('parent.selectTimeSlot')}: ${TIME_SLOTS[selectedSlot]?.start}-${TIME_SLOTS[selectedSlot]?.end}`,
      confirmText: t('parent.confirmBooking'),
      cancelText: 'Cancel',
      onConfirm: () => void bookMutation.mutate(),
    })
  }

  // Group upcoming meetings by date
  const upcoming = meetings
    .filter((m) => m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && dayjs(m.meetingDate).isAfter(dayjs(), 'day'))
    .sort((a, b) => dayjs(a.meetingDate + ' ' + a.startTime).valueOf() - dayjs(b.meetingDate + ' ' + b.startTime).valueOf())

  const past = meetings
    .filter((m) => dayjs(m.meetingDate).isBefore(dayjs(), 'day') || m.status === 'COMPLETED' || m.status === 'CANCELLED')
    .sort((a, b) => dayjs(b.meetingDate).valueOf() - dayjs(a.meetingDate).valueOf())

  return (
    <AppLayout title={t('parent.meetings')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Book FAB */}
        <button
          onClick={() => setBookOpen(true)}
          style={{
            position: 'fixed', right: 16, bottom: 80,
            width: 48, height: 48, borderRadius: 24,
            background: '#165DFF', color: 'white', border: 'none',
            boxShadow: '0 4px 12px rgba(22,93,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 90,
          }}
          aria-label={t('parent.bookMeeting')}
        >
          <Plus size={22} />
        </button>

        {/* Booking Modal */}
        {bookOpen && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }} onClick={() => setBookOpen(false)}>
            <div
              style={{
                background: 'white', borderRadius: '16px 16px 0 0',
                padding: '20px 16px 32px', width: '100%', maxWidth: 480,
                maxHeight: '80vh', overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
                {t('parent.bookMeeting')}
              </div>

              {/* Date picker */}
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>
                {t('parent.selectDate')}
              </label>
              <input
                type="date"
                value={selectedDate}
                min={dayjs().format('YYYY-MM-DD')}
                max={dayjs().add(30, 'day').format('YYYY-MM-DD')}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #e5e5e5', fontSize: 14, marginBottom: 14,
                  boxSizing: 'border-box',
                }}
              />

              {/* Time slots */}
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>
                {t('parent.selectTimeSlot')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                {TIME_SLOTS.map((slot, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(idx)}
                    style={{
                      padding: '10px 6px', borderRadius: 8,
                      border: selectedSlot === idx ? '2px solid #165DFF' : '1px solid #e5e5e5',
                      background: selectedSlot === idx ? '#E6F4FF' : 'white',
                      color: selectedSlot === idx ? '#165DFF' : '#333',
                      fontSize: 12, cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    {slot.start}-{slot.end}
                  </button>
                ))}
              </div>

              {/* Confirm button */}
              <button
                onClick={handleBook}
                disabled={selectedSlot < 0 || bookMutation.isPending}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10,
                  background: selectedSlot < 0 ? '#e0e0e0' : '#165DFF',
                  color: 'white', border: 'none', fontSize: 15, fontWeight: 600,
                  cursor: selectedSlot < 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {bookMutation.isPending ? '...' : t('parent.confirmBooking')}
              </button>
            </div>
          </div>
        )}

        {/* Upcoming Section */}
        {upcoming.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#165DFF', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={14} /> Upcoming ({upcoming.length})
            </div>
            {upcoming.map(meeting => {
              const st = STATUS_MAP[meeting.status] ?? STATUS_MAP.SCHEDULED
              return (
                <div key={meeting.id} style={{
                  background: 'white', borderRadius: 12, padding: '14px',
                  marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  borderLeft: '3px solid #165DFF',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1d1d1f' }}>
                        {meeting.purpose || t('parent.meetings')}
                      </div>
                      <div style={{ fontSize: 11, color: '#86909c', marginTop: 2 }}>
                        {meeting.teacher.user.displayName}
                        {meeting.student.user.displayName && ` · ${meeting.student.user.displayName}`}
                      </div>
                    </div>
                    <Tag fill="solid" color="primary" style={{ fontSize: 10 }}>{t(st.labelKey)}</Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#86909c', marginTop: 8 }}>
                    <Clock size={11} />
                    {dayjs(meeting.meetingDate).format('ddd, DD MMM YYYY')} · {meeting.startTime}-{meeting.endTime}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Past / Other Meetings */}
        {(past.length > 0 || upcoming.length === 0) && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#86909c', marginBottom: 8, marginTop: upcoming.length > 0 ? 16 : 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={14} /> All Meetings ({meetings.length})
            </div>
            {isLoading ? (
              <>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    background: 'white', borderRadius: 12, padding: '14px',
                    marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    <Skeleton animated style={{ height: 14, width: '50%', marginBottom: 6 }} />
                    <Skeleton animated style={{ height: 12, width: '60%' }} />
                  </div>
                ))}
              </>
            ) : meetings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
                <Calendar size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 14 }}>{t('parent.noMeetings')}</div>
              </div>
            ) : (
              past.map(meeting => {
                const st = STATUS_MAP[meeting.status] ?? STATUS_MAP.CANCELLED
                return (
                  <div key={meeting.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'white', borderRadius: 10, padding: '12px',
                    marginBottom: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    opacity: meeting.status === 'CANCELLED' ? 0.65 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: meeting.status === 'COMPLETED' ? '#E8F5E9' :
                          meeting.status === 'CANCELLED' ? '#f5f5f5' : '#E6F4FF',
                        color: meeting.status === 'COMPLETED' ? '#00B42A' :
                          meeting.status === 'CANCELLED' ? '#ccc' : '#165DFF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14,
                      }}>
                        {meeting.status === 'COMPLETED' ? <CheckCircle2 size={14} /> :
                         meeting.status === 'CANCELLED' ? <XCircle size={14} /> : <Calendar size={14} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13, color: '#1d1d1f' }}>
                          {meeting.teacher.user.displayName}
                        </div>
                        <div style={{ fontSize: 11, color: '#86909c' }}>
                          {dayjs(meeting.meetingDate).format('DD MMM YYYY')} · {meeting.startTime}-{meeting.endTime}
                        </div>
                      </div>
                    </div>
                    <Tag fill="outline" color={st.color} style={{ fontSize: 10 }}>{t(st.labelKey)}</Tag>
                  </div>
                )
              })
            )}
          </>
        )}

        <div style={{ height: 24 }} />
      </PullToRefresh>
    </AppLayout>
  )
}
