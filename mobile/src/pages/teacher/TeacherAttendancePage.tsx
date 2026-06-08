import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  SpinLoading, Tag, Button, Popup, Selector, Toast, List,
} from 'antd-mobile'
import { ChevronLeft, Plus, Users, Clock, CheckCircle2, LogIn, LogOut, ListChecks, History } from 'lucide-react'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, AttendanceSession, Course } from '@/types'

type AttStatus = 'present' | 'absent' | 'late'
type TabKey = 'my-records' | 'manage'

const PAGE_SIZE = 10

/* ────── Staff check-in types ────── */

interface StaffRecord {
  id: string
  date: string
  checkInAt: string | null
  checkOutAt: string | null
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  lateMinutes: number
  locationLabel: string | null
}

interface StaffTodayResponse {
  record: StaffRecord | null
  config: { startTime: string; cutoffTime: string }
}

/* ────── Helper functions ────── */

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-BN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-BN', { weekday: 'short', month: 'short', day: 'numeric' })
}

function staffStatusColor(s: string) {
  if (s === 'PRESENT') return { bg: '#E8F5E9', text: '#2E7D32', label: 'Present' }
  if (s === 'LATE') return { bg: '#FFF3E0', text: '#E65100', label: 'Late' }
  return { bg: '#FFEBEE', text: '#C62828', label: 'Absent' }
}

/* ────── Sub: Check-in Hero ────── */

function CheckInHero() {
  const qc = useQueryClient()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { data, isLoading, isError } = useQuery<StaffTodayResponse>({
    queryKey: ['staffAttendanceToday'],
    queryFn: async () => {
      const r = await api.get('/staff-attendance/today')
      return r.data.data as StaffTodayResponse
    },
    retry: false,
  })

  const { data: historyData } = useQuery<{ records: StaffRecord[] }>({
    queryKey: ['staffAttendanceHistory', 'week'],
    queryFn: async () => {
      const r = await api.get('/staff-attendance/history?period=week')
      return r.data.data as { records: StaffRecord[] }
    },
    retry: false,
  })

  const { data: assignments } = useQuery({
    queryKey: ['teacher-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ courseAssignments: any[] }>>('/teachers/me')
      return data.data
    },
    retry: false,
  })

  // ── Condition logic ──
  const today = useMemo(() => new Date(), [])
  const dayOfWeek = today.getDay() // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const hasCourses = (assignments?.courseAssignments?.length ?? 0) > 0

  // Hide if weekend or no courses or API failed
  if (isWeekend || !hasCourses || isError) {
    return null
  }

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post('/staff-attendance/check-in', {})
      return r.data
    },
    onSuccess: () => {
      Toast.show({ icon: 'success', content: 'Checked in' })
      qc.invalidateQueries({ queryKey: ['staffAttendanceToday'] })
      qc.invalidateQueries({ queryKey: ['staffAttendanceHistory'] })
    },
    onError: () => Toast.show({ icon: 'fail', content: 'Check-in failed' }),
  })

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post('/staff-attendance/check-out', {})
      return r.data
    },
    onSuccess: () => {
      Toast.show({ icon: 'success', content: 'Checked out' })
      qc.invalidateQueries({ queryKey: ['staffAttendanceToday'] })
    },
    onError: () => Toast.show({ icon: 'fail', content: 'Check-out failed' }),
  })

  const record = data?.record ?? null
  const hasCheckedIn = !!record?.checkInAt
  const hasCheckedOut = !!record?.checkOutAt
  const isLate = record?.status === 'LATE'
  const records = (historyData?.records ?? []).slice(0, 7)

  return (
    <div>
      {/* Compact Clock + Check-in card */}
      <div style={{
        background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
        borderRadius: 12, padding: '12px 16px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: 1, fontVariantNumeric: 'tabular-nums' }}>
          {now.toLocaleTimeString('en-BN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div style={{ marginTop: 2, color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
          {now.toLocaleDateString('en-BN', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>

        {isLoading ? (
          <div style={{ padding: '6px 0' }}><SpinLoading color="white" style={{ '--size': '18px' } as React.CSSProperties} /></div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {hasCheckedIn ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
                  <CheckCircle2 size={16} color="#52c41a" />
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
                    {fmtTime(record!.checkInAt)}
                  </span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-block', padding: '1px 8px', borderRadius: 8,
                    fontSize: 10, fontWeight: 600,
                    background: isLate ? '#fff3e0' : '#e8f5e9',
                    color: isLate ? '#e65100' : '#2e7d32',
                  }}>
                    {record!.status}
                    {isLate && record!.lateMinutes > 0 && ` (${record!.lateMinutes} min)`}
                  </span>
                </div>
                {hasCheckedOut ? (
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                    <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                    Out {fmtTime(record!.checkOutAt)}
                  </div>
                ) : (
                  <div
                    onClick={() => !checkOutMutation.isPending && checkOutMutation.mutate()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: 16, padding: '4px 14px', cursor: 'pointer',
                      color: '#fff', fontSize: 12, fontWeight: 600,
                      opacity: checkOutMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {checkOutMutation.isPending ? '...' : <LogOut size={12} />}
                    <span>Check Out</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => !checkInMutation.isPending && checkInMutation.mutate()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 16, padding: '4px 14px', cursor: 'pointer',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  opacity: checkInMutation.isPending ? 0.6 : 1, marginTop: 6,
                }}
              >
                {checkInMutation.isPending ? '...' : <LogIn size={12} />}
                <span>Check In</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7-day mini history — compact */}
      {records.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 10, overflow: 'hidden',
          border: '1px solid #f0f0f0', marginTop: 6,
        }}>
          <div style={{ fontWeight: 600, fontSize: 11, padding: '6px 10px', borderBottom: '1px solid #f5f5f5' }}>
            <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            Last 7 Days
          </div>
          <div style={{ padding: '4px 8px' }}>
            {records.map(r => {
              const sc = staffStatusColor(r.status)
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 2px', borderLeft: `3px solid ${sc.bg === '#E8F5E9' ? '#52c41a' : sc.bg === '#FFF3E0' ? '#faad14' : '#ff4d4f'}`,
                  borderRadius: 2,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 500, minWidth: 80 }}>{fmtDate(r.date)}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '0 6px',
                    borderRadius: 6, background: sc.bg, color: sc.text,
                  }}>
                    {sc.label}
                  </span>
                  <span style={{ fontSize: 10, color: '#86909c', marginLeft: 'auto' }}>
                    {fmtTime(r.checkInAt)}
                    {r.checkOutAt ? ` – ${fmtTime(r.checkOutAt)}` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ────── Sub: My Records Tab ────── */

function MyRecordsTab() {
  const { data, isLoading } = useQuery<{
    records: StaffRecord[]
    stats: { present: number; late: number; absent: number; total: number; attendancePct: number }
  }>({
    queryKey: ['staffAttendanceHistory', 'month'],
    queryFn: async () => {
      const r = await api.get('/staff-attendance/history?period=month')
      return r.data.data
    },
    retry: false,
  })

  const stats = data?.stats
  const records = data?.records ?? []

  if (isLoading || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 30, color: '#86909c', fontSize: 12 }}>
        {isLoading ? <SpinLoading style={{ '--size': '24px' } as React.CSSProperties} color="primary" /> : 'No data available'}
      </div>
    )
  }

  return (
    <div>
      {/* Stats cards — compact */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 8 }}>
        {[
          { label: 'Rate', value: `${stats?.attendancePct ?? 0}%`, color: '#1677ff' },
          { label: 'Present', value: stats?.present ?? 0, color: '#52c41a' },
          { label: 'Late', value: stats?.late ?? 0, color: '#faad14' },
          { label: 'Absent', value: stats?.absent ?? 0, color: '#ff4d4f' },
        ].map(item => (
          <div key={item.label} style={{
            background: '#fff', borderRadius: 8, padding: '6px 2px', textAlign: 'center',
            border: '1px solid #f0f0f0',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 9, color: '#86909c', marginTop: 1 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar heatmap — compact */}
      <div style={{
        background: '#fff', borderRadius: 10, padding: '8px 10px',
        border: '1px solid #f0f0f0', marginBottom: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Last 42 Days Calendar</div>
        <CalendarHeatmap records={records} />
      </div>

      {/* Records list — compact */}
      <div style={{
        background: '#fff', borderRadius: 10, overflow: 'hidden',
        border: '1px solid #f0f0f0',
      }}>
        <div style={{ fontWeight: 600, fontSize: 11, padding: '6px 10px', borderBottom: '1px solid #f5f5f5' }}>
          Detailed Records
        </div>
        {records.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#c0c4cc', padding: 16, fontSize: 12 }}>No records</div>
        ) : (
          <div>
            {records.slice(0, 20).map(r => {
              const sc = staffStatusColor(r.status)
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderBottom: '1px solid #f8f8f8',
                }}>
                  <div style={{ flex: 1, fontSize: 10 }}>{fmtDate(r.date)}</div>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '0 6px',
                    borderRadius: 6, background: sc.bg, color: sc.text,
                  }}>
                    {sc.label}
                  </span>
                  <div style={{ fontSize: 10, color: '#86909c', minWidth: 42, textAlign: 'right' }}>
                    {fmtTime(r.checkInAt)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ────── Calendar Heatmap ────── */

function CalendarHeatmap({ records }: { records: StaffRecord[] }) {
  const statusMap: Record<string, string> = {}
  for (const r of records) {
    statusMap[r.date.slice(0, 10)] = r.status
  }

  const today = new Date()
  const cells: { date: Date; key: string }[] = []
  for (let i = 41; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    cells.push({ date: d, key: d.toISOString().slice(0, 10) })
  }

  const cellColor = (status: string | undefined, isWeekend: boolean) => {
    if (isWeekend) return '#f0f0f0'
    if (!status) return '#e8e8e8'
    if (status === 'PRESENT') return '#52c41a'
    if (status === 'LATE') return '#faad14'
    return '#ff4d4f'
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {cells.map(({ date, key }) => {
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          const status = statusMap[key]
          return (
            <div
              key={key}
              title={`${key}: ${status ?? (isWeekend ? 'Weekend' : 'No record')}`}
              style={{
                width: 14, height: 14, borderRadius: 2,
                backgroundColor: cellColor(status, isWeekend),
                flexShrink: 0,
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { color: '#52c41a', label: 'Present' },
          { color: '#faad14', label: 'Late' },
          { color: '#ff4d4f', label: 'Absent' },
          { color: '#e8e8e8', label: 'No record' },
          { color: '#f0f0f0', label: 'Weekend' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
            <span style={{ fontSize: 8, color: '#aaa' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ────── Sub: Manage Attendance Tab ────── */

function ManageAttendanceTab({
  sessions, isLoading, onStartMarker,
}: {
  sessions: AttendanceSession[] | undefined
  isLoading: boolean
  onStartMarker: () => void
}) {
  const { t } = useTranslation()

  const { sortedSessions, totalCount, activeCount, completedCount } = (() => {
    const sorted = [...(sessions ?? [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    const active = sorted.filter(s => s.status === 'active').length
    return {
      sortedSessions: sorted.slice(0, PAGE_SIZE),
      totalCount: sorted.length,
      activeCount: active,
      completedCount: sorted.length - active,
    }
  })()

  return (
    <div>
      {/* Stats mini cards — compact */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
        {[
          { label: 'Total', value: totalCount, color: '#1677ff' },
          { label: 'Active', value: activeCount, color: '#52c41a' },
          { label: 'Completed', value: completedCount, color: '#86909c' },
        ].map(item => (
          <div key={item.label} style={{
            background: '#fff', borderRadius: 8, padding: '6px 2px', textAlign: 'center',
            border: '1px solid #f0f0f0',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 9, color: '#86909c', marginTop: 1 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Session list — compact */}
      <div style={{
        background: '#fff', borderRadius: 10, overflow: 'hidden',
        border: '1px solid #f0f0f0', marginBottom: 8,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderBottom: '1px solid #f5f5f5',
        }}>
          <div style={{ fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} color="#1677ff" />
            <span>Session History</span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <SpinLoading style={{ '--size': '22px' } as React.CSSProperties} color="primary" />
          </div>
        ) : sortedSessions.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#c0c4cc', padding: 20, fontSize: 12 }}>
            {t('teacher.noSessions')}
          </div>
        ) : (
          <List style={{ '--border-bottom': '0' } as React.CSSProperties}>
            {sortedSessions.map(session => (
              <List.Item
                key={session.id}
                prefix={
                  <Tag
                    color={session.status === 'active' ? 'primary' : 'default'}
                    style={{
                      background: session.status === 'active' ? '#E8F5E9' : '#f5f5f5',
                      color: session.status === 'active' ? '#2E7D32' : '#666',
                      border: 'none', fontSize: 9,
                    }}
                  >
                    {session.status === 'active' ? t('teacher.active') : t('teacher.completed')}
                  </Tag>
                }
                description={
                  <div style={{ fontSize: 10, color: '#86909c' }}>
                    {session.course?.name && <span>{session.course.name}</span>}
                    {session._count?.records !== undefined && (
                      <span> · <Users size={9} style={{ verticalAlign: 'middle' }} /> {session._count.records}</span>
                    )}
                  </div>
                }
                extra={
                  <span style={{ fontSize: 9, color: '#c9cdd4', whiteSpace: 'nowrap' }}>
                    {dayjs(session.date).format('DD/MM')}
                  </span>
                }
              >
                {session.topic ?? session.course?.code ?? '—'}
              </List.Item>
            ))}
          </List>
        )}
      </div>

      {/* Start Attendance CTA — compact */}
      <div
        onClick={onStartMarker}
        style={{
          background: 'linear-gradient(135deg, #1677ff 0%, #4080ff 100%)',
          borderRadius: 12, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(22,93,255,0.2)',
          cursor: 'pointer',
        }}
      >
        <div style={{ color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{t('teacher.startAttendance')}</div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 0 }}>
            Mark attendance for a course session
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3,
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 16, padding: '4px 12px',
          color: '#fff', fontSize: 12, fontWeight: 600, flexShrink: 0,
        }}>
          <Plus size={14} />
          <span>Start</span>
        </div>
      </div>
    </div>
  )
}

/* ────── Sub: Attendance Marker Popup ────── */

function AttendanceMarkerPopup({
  visible, onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [studentStatuses, setStudentStatuses] = useState<Record<string, AttStatus>>({})

  const { data: courses } = useQuery({
    queryKey: ['teacher-courses'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Course[]>>('/courses')
      return data.data
    },
  })

  const { data: enrolledStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ['course-students', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return []
      const { data } = await api.get<ApiResponse<any[]>>('/enrollments', {
        params: { courseId: selectedCourseId, status: 'active' },
      })
      return data.data ?? []
    },
    enabled: !!selectedCourseId && visible,
  })

  const studentList = (enrolledStudents ?? [])
    .filter((e: any) => e.student?.user)
    .map((e: any) => ({
      studentId: e.studentId,
      displayName: e.student.user.displayName || `Student ${e.student.studentId}`,
    }))

  const toggleStatus = (studentId: string) => {
    setStudentStatuses(prev => {
      const current = prev[studentId] || 'present'
      const next: AttStatus = current === 'present' ? 'absent' : current === 'absent' ? 'late' : 'present'
      return { ...prev, [studentId]: next }
    })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionRes } = await api.post<ApiResponse<AttendanceSession>>('/attendance/sessions', {
        courseId: selectedCourseId,
        date: dayjs().format('YYYY-MM-DD'),
        topic: 'Class Attendance',
      })
      const sessionId = sessionRes.data.id
      const records = studentList.map(s => ({
        studentId: s.studentId,
        status: studentStatuses[s.studentId] || 'present',
      }))
      await api.post('/attendance/records', { sessionId, records })
    },
    onSuccess: () => {
      Toast.show({ icon: 'success', content: t('teacher.attendanceSaved') })
      onClose()
      setSelectedCourseId(null)
      setStudentStatuses({})
      qc.invalidateQueries({ queryKey: ['teacher-sessions'] })
      qc.invalidateQueries({ queryKey: ['teacher-courses'] })
    },
    onError: () => Toast.show({ icon: 'fail', content: t('common.error') }),
  })

  const hasChanges = Object.values(studentStatuses).some(s => s !== 'present')

  const handleClose = () => {
    onClose()
    setSelectedCourseId(null)
    setStudentStatuses({})
  }

  return (
    <Popup
      visible={visible}
      onMaskClick={handleClose}
      position="bottom"
      bodyStyle={{ height: '75vh', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 0 }}
    >
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div onClick={handleClose} style={{ cursor: 'pointer', display: 'flex', color: '#666', padding: 4 }}>
            <ChevronLeft size={20} />
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, flex: 1 }}>
            {t('teacher.markAttendance')}
          </h3>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#697b8c', marginBottom: 6 }}>
            Step 1: {t('teacher.selectCourse')}
          </div>
          <Selector
            options={(courses || []).map(c => ({ label: `${c.code ?? ''} ${c.name}`, value: c.id }))}
            value={selectedCourseId ? [selectedCourseId] : []}
            onChange={(vals) => {
              if (vals.length) {
                setSelectedCourseId(vals[0] as string)
                setStudentStatuses({})
              }
            }}
            showCheckMark={false}
          />
        </div>

        {selectedCourseId && (
          <div style={{ flex: 1, overflow: 'auto', marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#697b8c', marginBottom: 6 }}>
              Step 2: Mark Attendance <span style={{ fontWeight: 400, color: '#aaa' }}>(tap to toggle)</span>
            </div>
            {studentsLoading ? (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <SpinLoading style={{ '--size': '22px' } as React.CSSProperties} color="primary" />
              </div>
            ) : studentList.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#86909c', padding: 16, fontSize: 13 }}>
                {t('teacher.noStudentsEnrolled')}
              </div>
            ) : (
              <div style={{ borderRadius: 8, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                {studentList.map((s, idx) => {
                  const status = studentStatuses[s.studentId] || 'present'
                  const colors: Record<AttStatus, { bg: string; text: string }> = {
                    present: { bg: '#E8F5E9', text: '#00b42a' },
                    absent: { bg: '#FFF1F0', text: '#f53f3f' },
                    late: { bg: '#FFF7E6', text: '#ff7d00' },
                  }
                  const labels: Record<AttStatus, string> = {
                    present: t('attendance.present'),
                    absent: t('attendance.absent'),
                    late: t('attendance.late'),
                  }
                  const c = colors[status]
                  return (
                    <div
                      key={s.studentId}
                      onClick={() => toggleStatus(s.studentId)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderBottom: idx < studentList.length - 1 ? '1px solid #f5f5f5' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{s.displayName}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 8, background: c.bg, color: c.text }}>
                        {labels[status]}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {selectedCourseId && studentList.length > 0 && (
          <div style={{ paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
            <Button
              block
              color="primary"
              size="large"
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges}
            >
              {hasChanges
                ? `${t('teacher.saveAttendance')} (${Object.values(studentStatuses).filter(s => s !== 'present').length})`
                : t('teacher.saveAttendance')}
            </Button>
          </div>
        )}
      </div>
    </Popup>
  )
}

/* ────── Main Component ────── */

export default function TeacherAttendancePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('my-records')
  const [showMarker, setShowMarker] = useState(false)

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['teacher-sessions'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttendanceSession[]>>('/attendance/sessions')
      return data.data
    },
  })

  return (
    <AppLayout title={t('teacher.attendance')} showLogout>
      <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* ── Check In/Out Hero ── */}
        <CheckInHero />

        {/* ── Full History Link ── */}
        <div
          onClick={() => navigate('/teacher/attendance/history')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 0', cursor: 'pointer',
            fontSize: 13, color: '#165DFF', fontWeight: 500,
          }}
        >
          <History size={15} />
          <span>{t('teacher.viewAttendanceHistory', 'View Full Attendance History')}</span>
        </div>

        {/* ── Tab Switcher ── */}
        <div style={{
          display: 'flex', borderRadius: 8, overflow: 'hidden',
          border: '1px solid #e0e0e0', background: '#f5f5f5',
          flexShrink: 0,
        }}>
          {[
            { key: 'my-records' as TabKey, label: 'My Attendance', icon: <CheckCircle2 size={13} /> },
            { key: 'manage' as TabKey, label: 'Manage Sessions', icon: <ListChecks size={13} /> },
          ].map(tab => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, textAlign: 'center', padding: '6px 8px', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 3, transition: 'all 0.2s',
                background: activeTab === tab.key ? '#1677ff' : 'transparent',
                color: activeTab === tab.key ? '#fff' : '#666',
                borderRadius: 7,
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </div>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 'my-records' ? (
          <MyRecordsTab />
        ) : (
          <ManageAttendanceTab
            sessions={sessions}
            isLoading={isLoading}
            onStartMarker={() => setShowMarker(true)}
          />
        )}

        <div style={{ height: 8 }} />
      </div>

      {/* ── Attendance Marker Popup ── */}
      <AttendanceMarkerPopup
        visible={showMarker}
        onClose={() => setShowMarker(false)}
      />
    </AppLayout>
  )
}
