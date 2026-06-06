import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SpinLoading, Card, Tag } from 'antd-mobile'
import { BookOpen, ChevronRight, List, CalendarDays, Clock, MapPin, User } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Teacher } from '@/types'

/* ────── Timetable types & helpers ────── */

interface TimetableSlot {
  id: string
  courseId: string
  teacherId: string
  gradeLevel: string
  className?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room?: string
  semester: string
  course?: { id: string; code: string; name: string; creditHours?: number }
  teacher?: { id: string; user?: { displayName?: string } }
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const

const GRADE_LEVEL = 'Year 7'
const CLASS_NAME = '7A'
const SEMESTER = '2026-S1'

const PERIODS = [
  { label: '1', time: '08:00' },
  { label: '2', time: '08:40' },
  { label: '3', time: '09:40' },
  { label: '4', time: '10:20' },
  { label: '5', time: '11:10' },
  { label: '6', time: '11:50' },
  { label: '7', time: '14:00' },
  { label: '8', time: '14:40' },
]

const COURSE_COLORS = [
  { bg: '#E8F5E9', border: '#4CAF50', text: '#2E7D32' },
  { bg: '#FFF3E0', border: '#FF9800', text: '#E65100' },
  { bg: '#E3F2FD', border: '#2196F3', text: '#1565C0' },
  { bg: '#FCE4EC', border: '#E91E63', text: '#C2185B' },
  { bg: '#F3E5F5', border: '#9C27B0', text: '#7B1FA2' },
  { bg: '#E0F7FA', border: '#00BCD4', text: '#00838F' },
  { bg: '#FFF8E1', border: '#FFC107', text: '#F57F17' },
  { bg: '#EFEBE9', border: '#795548', text: '#4E342E' },
]

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function findPeriodIndex(time: string): number {
  const t = timeToMinutes(time)
  for (let i = 0; i < PERIODS.length; i++) {
    const ps = timeToMinutes(PERIODS[i].time)
    const pe = i < PERIODS.length - 1 ? timeToMinutes(PERIODS[i + 1].time) : ps + 40
    if (t >= ps && t < pe) return i
  }
  return PERIODS.length - 1
}

function getCourseColor(index: number) {
  return COURSE_COLORS[index % COURSE_COLORS.length]
}

/* ────── View Toggle Component ────── */

function ViewToggle({ value, onChange }: {
  value: 'list' | 'calendar'
  onChange: (v: 'list' | 'calendar') => void
}) {
  return (
    <div style={{
      display: 'flex', borderRadius: 8, overflow: 'hidden',
      border: '1px solid #e0e0e0', background: '#f5f5f5', flexShrink: 0,
    }}>
      <button
        onClick={() => onChange('list')}
        style={{
          flex: 1, border: 'none', padding: '6px 14px', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 4, transition: 'all 0.2s',
          background: value === 'list' ? '#1677ff' : 'transparent',
          color: value === 'list' ? '#fff' : '#666',
          borderRadius: 7,
        }}
      >
        <List size={14} />
        <span>List</span>
      </button>
      <button
        onClick={() => onChange('calendar')}
        style={{
          flex: 1, border: 'none', padding: '6px 14px', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 4, transition: 'all 0.2s',
          background: value === 'calendar' ? '#1677ff' : 'transparent',
          color: value === 'calendar' ? '#fff' : '#666',
          borderRadius: 7,
        }}
      >
        <CalendarDays size={14} />
        <span>Calendar</span>
      </button>
    </div>
  )
}

/* ────── List View ────── */

function ListView({ assignments, onNavigate }: {
  assignments: Teacher['courseAssignments']
  onNavigate: (courseId: string) => void
}) {
  const { t } = useTranslation()

  if (!assignments || assignments.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#86909c', padding: 60, fontSize: 14 }}>
        {t('teacher.noClasses')}
      </div>
    )
  }

  return (
    <>
      {assignments.map(assignment => (
        <Card
          key={assignment.id}
          style={{ marginBottom: 12, borderRadius: 16 }}
          onClick={() => onNavigate(assignment.courseId)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                {assignment.course?.name}
              </div>
              <Tag color="primary" fill="outline">{assignment.course?.code}</Tag>
            </div>
            <ChevronRight size={16} color="#c0c4cc" style={{ flexShrink: 0 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {assignment.course?.gradeLevel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#86909c' }}>
                <BookOpen size={12} />
                <span>{t('teacher.gradeLevel')}: {assignment.course.gradeLevel}</span>
              </div>
            )}
            {assignment.semester && (
              <Tag color="default" fill="outline" style={{ fontSize: 11 }}>
                {assignment.semester}
              </Tag>
            )}
          </div>
          {assignment.schedule && (
            <div style={{ fontSize: 12, color: '#86909c', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} />
              <span>{assignment.schedule}</span>
            </div>
          )}
        </Card>
      ))}
    </>
  )
}

/* ────── Calendar / Timetable Grid View ────── */

function CalendarView({ slots, onNavigate }: {
  slots: TimetableSlot[]
  onNavigate: (courseId: string) => void
}) {
  const { t } = useTranslation()

  // Assign colors per unique course
  const courseColorMap = new Map<string, number>()
  let colorIdx = 0
  for (const slot of slots) {
    if (!courseColorMap.has(slot.courseId)) courseColorMap.set(slot.courseId, colorIdx++)
  }

  // Group by day
  const daySlots: TimetableSlot[][] = [[], [], [], [], []]
  for (const slot of slots) {
    if (slot.dayOfWeek >= 0 && slot.dayOfWeek <= 4) {
      daySlots[slot.dayOfWeek].push(slot)
    }
  }

  // Track occupied cells and build course card elements
  const occupied = new Set<string>()
  const courseCards: React.ReactNode[] = []

  for (let d = 0; d < 5; d++) {
    for (const slot of daySlots[d]) {
      const p = findPeriodIndex(slot.startTime)
      const endP = findPeriodIndex(slot.endTime)
      const span = Math.max(1, endP - p + 1)

      for (let r = p; r < p + span && r < PERIODS.length; r++) {
        occupied.add(`${r}-${d}`)
      }

      const color = getCourseColor(courseColorMap.get(slot.courseId) ?? 0)

      courseCards.push(
        <div
          key={slot.id}
          onClick={() => onNavigate(slot.courseId)}
          style={{
            gridColumn: d + 2,
            gridRow: `${p + 2} / span ${span}`,
            background: color.bg,
            borderLeft: `3px solid ${color.border}`,
            borderRadius: 6,
            margin: 2,
            padding: '4px 6px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 3,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 11, color: color.text, lineHeight: 1.3, marginBottom: 1 }}>
            {slot.course?.name ?? '—'}
          </div>
          <div style={{ fontSize: 10, color: color.text, opacity: 0.75, lineHeight: 1.3 }}>
            {slot.room && <span>{slot.room}</span>}
            {slot.teacher?.user?.displayName && (
              <span>{slot.room ? ' · ' : ''}{slot.teacher.user.displayName}</span>
            )}
          </div>
          {span >= 2 && slot.course?.code && (
            <div style={{ fontSize: 9, color: color.text, opacity: 0.6, marginTop: 1 }}>
              {slot.course.code}
            </div>
          )}
        </div>,
      )
    }
  }

  const hasAnySlots = slots.length > 0

  return (
    <div style={{
      overflowX: 'auto', overflowY: 'visible',
      WebkitOverflowScrolling: 'touch', paddingBottom: 4,
    }}>
      {!hasAnySlots ? (
        <div style={{ textAlign: 'center', color: '#c0c4cc', fontSize: 13, padding: '40px 0' }}>
          {t('teacher.noClassesOnDay', 'No classes scheduled')}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `44px repeat(5, minmax(96px, 1fr))`,
            gridTemplateRows: `36px repeat(${PERIODS.length}, 56px)`,
            minWidth: 524,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #e8ecf1',
            background: '#fff',
          }}
        >
          {/* Corner */}
          <div style={{
            gridColumn: 1, gridRow: 1,
            background: '#f5f7fa',
            borderBottom: '1px solid #e8ecf1',
            borderRight: '1px solid #e8ecf1',
          }} />

          {/* Day headers */}
          {[0, 1, 2, 3, 4].map(d => (
            <div key={`h-${d}`} style={{
              gridColumn: d + 2, gridRow: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 11, color: '#1677ff',
              background: '#f5f7fa',
              borderBottom: '2px solid #d6e4ff',
              borderRight: '1px solid #e8ecf1',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {t(`teacher.${DAYS[d]}`, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d])}
            </div>
          ))}

          {/* Period rows */}
          {PERIODS.map((period, p) => (
            <div key={`p-${p}`} style={{ display: 'contents' }}>
              <div style={{
                gridColumn: 1, gridRow: p + 2,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: '#86909c',
                borderRight: '1px solid #e8ecf1',
                borderBottom: '1px solid #f0f2f5',
                background: '#fafbfc',
                padding: '0 2px', lineHeight: 1.3,
              }}>
                <span style={{ fontWeight: 700, fontSize: 11, color: '#555' }}>{period.label}</span>
                <span style={{ fontSize: 8 }}>{period.time}</span>
              </div>
              {[0, 1, 2, 3, 4].map(d => {
                const isOcc = occupied.has(`${p}-${d}`)
                return (
                  <div key={`c-${p}-${d}`} style={{
                    gridColumn: d + 2, gridRow: p + 2,
                    borderBottom: '1px solid #f0f2f5',
                    borderRight: '1px solid #f0f2f5',
                    background: isOcc ? 'transparent' : (p % 2 === 0 ? '#fafbfc' : '#fff'),
                  }} />
                )
              })}
            </div>
          ))}

          {courseCards}
        </div>
      )}
    </div>
  )
}

/* ────── Main Component ────── */

type ViewMode = 'list' | 'calendar'

export default function TeacherClassesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Fetch course assignments (used by list view)
  const { data: teacher, isLoading: loadingAssignments } = useQuery({
    queryKey: ['teacher-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Teacher>>('/teachers/me')
      return data.data
    },
  })

  // Fetch timetable slots (used by calendar view)
  const { data: slots = [], isLoading: loadingTimetable } = useQuery({
    queryKey: ['teacher-timetable', GRADE_LEVEL, CLASS_NAME, SEMESTER],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TimetableSlot[]>>('/sms/timetable', {
        params: { gradeLevel: GRADE_LEVEL, className: CLASS_NAME, semester: SEMESTER },
      })
      return data.data
    },
  })

  const isLoading = loadingAssignments || loadingTimetable

  const handleCourseClick = (courseId: string) => {
    navigate(`/course/detail?courseId=${courseId}`)
  }

  return (
    <AppLayout title={t('teacher.classes')} showLogout>
      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 45px - 70px)' }}>
        {/* Header & View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{t('teacher.classes')}</div>
            {viewMode === 'calendar' && (
              <div style={{ fontSize: 12, color: '#86909c', marginTop: 2 }}>
                {GRADE_LEVEL} — {CLASS_NAME} · {SEMESTER}
              </div>
            )}
            {viewMode === 'list' && teacher && (
              <div style={{ fontSize: 12, color: '#86909c', marginTop: 2 }}>
                {teacher.courseAssignments?.length ?? 0} {t('teacher.myCourses').toLowerCase()}
              </div>
            )}
          </div>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <SpinLoading style={{ '--size': '36px' } as React.CSSProperties} color="primary" />
          </div>
        ) : viewMode === 'list' ? (
          <ListView
            assignments={teacher?.courseAssignments}
            onNavigate={handleCourseClick}
          />
        ) : (
          <CalendarView
            slots={slots}
            onNavigate={handleCourseClick}
          />
        )}
      </div>
    </AppLayout>
  )
}
