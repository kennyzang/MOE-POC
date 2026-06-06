import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag, Button, Popup, Selector, Toast } from 'antd-mobile'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, AttendanceSession, Course } from '@/types'

type AttStatus = 'present' | 'absent' | 'late'

export default function TeacherAttendancePage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [showMarker, setShowMarker] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [studentStatuses, setStudentStatuses] = useState<Record<string, AttStatus>>({})

  // Teacher's assigned courses
  const { data: courses } = useQuery({
    queryKey: ['teacher-courses'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Course[]>>('/courses')
      return data.data
    },
  })

  // Attendance sessions list
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['teacher-sessions'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttendanceSession[]>>('/attendance/sessions')
      return data.data
    },
  })

  // Enrolled students for selected course
  const { data: enrolledStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ['course-students', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return []
      const { data } = await api.get<ApiResponse<any[]>>('/enrollments', {
        params: { courseId: selectedCourseId, status: 'active' },
      })
      return data.data ?? []
    },
    enabled: !!selectedCourseId && showMarker,
  })

  // Build student list with display names
  const studentList = useMemo(() => {
    if (!enrolledStudents) return []
    return enrolledStudents
      .filter((e: any) => e.student && e.student.user)
      .map((e: any) => ({
        studentId: e.studentId,
        displayName: e.student.user.displayName || `Student ${e.student.studentId}`,
      }))
  }, [enrolledStudents])

  // Reset states when course changes
  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId)
    setStudentStatuses({})
  }

  // Toggle status for a student (present → absent → late → present)
  const toggleStatus = (studentId: string) => {
    setStudentStatuses(prev => {
      const current = prev[studentId] || 'present'
      const next: AttStatus = current === 'present' ? 'absent' : current === 'absent' ? 'late' : 'present'
      return { ...prev, [studentId]: next }
    })
  }

  // Save attendance
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Create session
      const { data: sessionRes } = await api.post<ApiResponse<AttendanceSession>>('/attendance/sessions', {
        courseId: selectedCourseId,
        date: dayjs().format('YYYY-MM-DD'),
        topic: 'Class Attendance',
      })
      const sessionId = sessionRes.data.id

      // Step 2: Batch create records
      const records = studentList.map(s => ({
        studentId: s.studentId,
        status: studentStatuses[s.studentId] || 'present',
      }))
      await api.post('/attendance/records', { sessionId, records })
    },
    onSuccess: () => {
      Toast.show({ icon: 'success', content: t('teacher.attendanceSaved') })
      setShowMarker(false)
      setSelectedCourseId(null)
      setStudentStatuses({})
      qc.invalidateQueries({ queryKey: ['teacher-sessions'] })
    },
    onError: () => {
      Toast.show({ icon: 'fail', content: t('common.error') })
    },
  })

  const hasChanges = Object.values(studentStatuses).some(s => s !== 'present')

  return (
    <AppLayout title={t('teacher.attendance')} showLogout>
      {/* ===== Existing Sessions List ===== */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>
          {t('teacher.noSessions')}
        </div>
      ) : (
        <List style={{ borderRadius: 12, overflow: 'hidden' }}>
          {sessions.map(session => (
            <List.Item
              key={session.id}
              prefix={
                <Tag color={session.status === 'active' ? 'primary' : 'default'}>
                  {session.status === 'active' ? t('teacher.active') : t('teacher.completed')}
                </Tag>
              }
              description={
                <span>
                  {session.course?.name}
                  {session._count?.records !== undefined && (
                    <> · {session._count.records} {t('teacher.recordCount')}</>
                  )}
                </span>
              }
              extra={
                <span style={{ fontSize: 12, color: '#86909c' }}>
                  {dayjs(session.date).format('DD/MM/YY')}
                </span>
              }
            >
              {session.topic ?? session.course?.code ?? '—'}
            </List.Item>
          ))}
        </List>
      )}

      {/* ===== Start Attendance FAB ===== */}
      <div style={{ position: 'fixed', bottom: 80, right: 20, zIndex: 100 }}>
        <Button
          color="primary"
          size="large"
          shape="rounded"
          onClick={() => setShowMarker(true)}
          style={{ boxShadow: '0 4px 12px rgba(22,93,255,0.4)' }}
        >
          <span style={{ fontSize: 16, marginRight: 4 }}>+</span> {t('teacher.startAttendance')}
        </Button>
      </div>

      {/* ===== Attendance Marker Popup ===== */}
      <Popup
        visible={showMarker}
        onMaskClick={() => setShowMarker(false)}
        position="bottom"
        bodyStyle={{ height: '70vh', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 0 }}
      >
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{t('teacher.markAttendance')}</h3>

          {/* Step 1: Select Course */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, color: '#697b8c', marginBottom: 8 }}>{t('teacher.selectCourse')}</div>
            <Selector
              options={
                (courses || []).map(c => ({
                  label: `${c.code ?? ''} ${c.name}`,
                  value: c.id,
                }))
              }
              value={selectedCourseId ? [selectedCourseId] : []}
              onChange={(vals) => {
                if (vals.length) handleCourseChange(vals[0] as string)
              }}
              showCheckMark={false}
            />
          </div>

          {/* Step 2: Student List with Toggles */}
          {selectedCourseId && (
            <div style={{ flex: 1, overflow: 'auto', marginTop: 16 }}>
              {studentsLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <SpinLoading style={{ '--size': '24px' } as React.CSSProperties} color="primary" />
                </div>
              ) : studentList.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#86909c', padding: 20 }}>
                  {t('teacher.noStudentsEnrolled')}
                </div>
              ) : (
                <div>
                  {studentList.map(s => {
                    const status = studentStatuses[s.studentId] || 'present'
                    const colors: Record<AttStatus, string> = {
                      present: '#00b42a',
                      absent: '#f53f3f',
                      late: '#ff7d00',
                    }
                    const labels: Record<AttStatus, string> = {
                      present: t('attendance.present'),
                      absent: t('attendance.absent'),
                      late: t('attendance.late'),
                    }
                    return (
                      <div
                        key={s.studentId}
                        onClick={() => toggleStatus(s.studentId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 4px',
                          borderBottom: '1px solid #f0f0f0',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 15 }}>{s.displayName}</span>
                        <Tag color={colors[status]}>{labels[status]}</Tag>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Save Button */}
          {selectedCourseId && studentList.length > 0 && (
            <div style={{ paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
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
    </AppLayout>
  )
}
