import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SpinLoading, Card, Tag } from 'antd-mobile'
import { BookOpen, ChevronRight, Clock, MapPin } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Student } from '@/types'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_KEYS = [0, 1, 2, 3, 4, 5]

const COURSE_COLORS = [
  '#165DFF', '#00B42A', '#FF7D00', '#722ED1', '#EB2F96', '#0FC6C2', '#F7BA1E',
]

interface TimetableEntry {
  id: string
  courseId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room: string
  course: { id: string; code: string; name: string }
  teacher: { id: string; user: { displayName: string } }
}

export default function StudentCoursesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [view, setView] = useState<'list' | 'timetable'>('list')

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['student-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Student>>('/students/me')
      return data.data
    },
  })

  const { data: timetable, isLoading: ttLoading } = useQuery({
    queryKey: ['student-timetable'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TimetableEntry[]>>('/sms/timetable')
      return data.data ?? []
    },
    enabled: view === 'timetable',
  })

  const enrollments = student?.enrollments?.filter(e => e.status === 'enrolled') ?? []
  const isLoading = view === 'list' ? studentLoading : ttLoading

  // Assign stable colors to courses
  const courseColorMap: Record<string, string> = {}
  const allEntries = timetable ?? []
  allEntries.forEach(entry => {
    if (!courseColorMap[entry.courseId]) {
      const idx = Object.keys(courseColorMap).length % COURSE_COLORS.length
      courseColorMap[entry.courseId] = COURSE_COLORS[idx]
    }
  })

  const renderList = () => {
    if (enrollments.length === 0) {
      return <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('student.noCourses')}</div>
    }
    return (
      <>
        {enrollments.map(enrollment => (
          <Card
            key={enrollment.id}
            style={{ marginBottom: 12, borderRadius: 16 }}
            onClick={() => navigate(`/course/detail?courseId=${enrollment.courseId}`)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  {enrollment.course?.name}
                </div>
                <Tag color="primary" fill="outline">{enrollment.course?.code}</Tag>
              </div>
              <ChevronRight size={16} color="#c0c4cc" style={{ flexShrink: 0 }} />
            </div>
            {enrollment.course?.gradeLevel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: '#86909c' }}>
                <BookOpen size={13} />
                <span>{t('student.gradeLevel')}: {enrollment.course.gradeLevel}</span>
              </div>
            )}
          </Card>
        ))}
      </>
    )
  }

  const renderTimetable = () => {
    if (!timetable || timetable.length === 0) {
      return <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('student.noCourses')}</div>
    }

    // Group by day
    const byDay: Record<number, TimetableEntry[]> = {}
    DAY_KEYS.forEach(d => { byDay[d] = [] })
    timetable.forEach(entry => {
      if (byDay[entry.dayOfWeek]) {
        byDay[entry.dayOfWeek].push(entry)
      }
    })

    // Filter days that have entries
    const activeDays = DAY_KEYS.filter(d => byDay[d].length > 0)

    return (
      <div>
        {activeDays.map(day => (
          <div key={day} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#86909c',
              textTransform: 'uppercase', letterSpacing: 0.8,
              marginBottom: 8, paddingLeft: 2,
            }}>
              {DAY_LABELS[day]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byDay[day]
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(entry => {
                  const color = courseColorMap[entry.courseId] ?? '#165DFF'
                  return (
                    <div
                      key={entry.id}
                      style={{
                        background: 'white',
                        borderRadius: 12,
                        padding: '12px 14px',
                        borderLeft: `4px solid ${color}`,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1d2129', marginBottom: 4 }}>
                        {entry.course.name}
                      </div>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#86909c' }}>
                          <Clock size={12} />
                          <span>{entry.startTime}–{entry.endTime}</span>
                        </div>
                        {entry.room && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#86909c' }}>
                            <MapPin size={12} />
                            <span>{entry.room}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#595959' }}>
                        {entry.teacher?.user?.displayName}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <AppLayout title={t('student.courses')} showLogout>
      {/* View toggle */}
      <div style={{
        display: 'flex',
        background: '#f0f2f5',
        borderRadius: 10,
        padding: 3,
        marginBottom: 14,
      }}>
        {(['list', 'timetable'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1,
              padding: '7px 0',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: view === v ? 'white' : 'transparent',
              color: view === v ? '#165DFF' : '#86909c',
              boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {v === 'list' ? t('student.listView') : t('student.timetableView')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : view === 'list' ? renderList() : renderTimetable()}
    </AppLayout>
  )
}
