import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import { User, Mail, BookOpen, CalendarDays, Award, Users, Building2 } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Teacher, TeacherDashboardStats } from '@/types'

export default function TeacherProfilePage() {
  const { t } = useTranslation()

  const { data: teacher, isLoading: loadingTeacher } = useQuery({
    queryKey: ['teacher-me-profile'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Teacher>>('/teachers/me')
      return data.data
    },
  })

  const { data: _stats } = useQuery({
    queryKey: ['teacher-dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TeacherDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  const { data: attendanceHistory } = useQuery({
    queryKey: ['staff-attendance-month'],
    queryFn: async () => {
      const r = await api.get('/staff-attendance/history?period=month')
      return r.data.data as { stats?: { attendancePct: number; present: number; late: number; absent: number } }
    },
  })

  if (loadingTeacher) {
    return (
      <AppLayout title={t('teacher.profile')} showLogout>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      </AppLayout>
    )
  }

  const assignments = teacher?.courseAssignments ?? []
  const totalStudents = assignments.reduce((sum, a) => sum + (a._count?.enrollments ?? 0), 0)
  const attStats = attendanceHistory?.stats

  return (
    <AppLayout title={t('teacher.profile')} showLogout>
      {/* Avatar Card */}
      <div style={{
        background: 'linear-gradient(135deg, #165DFF 0%, #0E42D2 100%)',
        borderRadius: 16, padding: '24px 20px', marginBottom: 12,
        color: 'white', textAlign: 'center',
      }}>
        <div style={{
          width: 76, height: 76, borderRadius: 38,
          background: 'rgba(255,255,255,0.2)',
          border: '2px solid rgba(255,255,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
        }}>
          <User size={34} color="white" />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{teacher?.user?.displayName}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 3 }}>{teacher?.staffId}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
          <Tag
            style={{
              background: teacher?.status === 'ACTIVE' ? 'rgba(255,255,255,0.25)' : 'rgba(255,77,79,0.3)',
              color: 'white', border: 'none',
            }}
          >
            {teacher?.status ?? 'Active'}
          </Tag>
          {teacher?.department && (
            <Tag style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>
              {teacher.department}
            </Tag>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          {
            label: t('teacher.activeCourses'),
            value: assignments.length,
            icon: <BookOpen size={16} />,
            color: '#165DFF',
            bg: '#E6F4FF',
          },
          {
            label: t('teacher.totalStudents'),
            value: totalStudents,
            icon: <Users size={16} />,
            color: '#00B42A',
            bg: '#E8F5E9',
          },
          {
            label: t('teacher.monthlyAttend'),
            value: `${attStats?.attendancePct ?? 0}%`,
            icon: <CalendarDays size={16} />,
            color: attStats?.attendancePct && attStats.attendancePct >= 95 ? '#00B42A' : '#FAAD14',
            bg: attStats?.attendancePct && attStats.attendancePct >= 95 ? '#E8F5E9' : '#FFF7E6',
          },
        ].map(item => (
          <div key={item.label} style={{
            background: item.bg, borderRadius: 12, padding: '12px 8px', textAlign: 'center',
          }}>
            <div style={{ color: item.color, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 10, color: '#86909c', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Personal Information */}
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <User size={15} color="#165DFF" />
        {t('teacher.personalInfo')}
      </div>
      <List style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <List.Item prefix={<Building2 size={17} color="#86909c" />} extra={teacher?.designation ?? '—'}>
          {t('teacher.designation')}
        </List.Item>
        <List.Item prefix={<Award size={17} color="#86909c" />} extra={teacher?.qualification ?? '—'}>
          {t('teacher.qualification')}
        </List.Item>
        <List.Item prefix={<Mail size={17} color="#86909c" />} extra={teacher?.user?.email ?? '—'}>
          {t('common.email')}
        </List.Item>
        <List.Item prefix={<CalendarDays size={17} color="#86909c" />} extra={
          teacher?.joinDate ? dayjs(teacher.joinDate).format('DD/MM/YYYY') : '—'
        }>
          {t('teacher.joinDate')}
        </List.Item>
      </List>

      {/* Course Assignments */}
      {assignments.length > 0 && (
        <>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={15} color="#165DFF" />
            {t('teacher.courseAssignments')}
            <span style={{ fontSize: 12, color: '#86909c', fontWeight: 400 }}>
              ({assignments.length})
            </span>
          </div>
          <div style={{
            background: 'white', borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            {assignments.map((a, idx) => (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 14px',
                borderBottom: idx < assignments.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.course?.name}</div>
                  <div style={{ fontSize: 12, color: '#86909c', marginTop: 2 }}>
                    {a.course?.code} {a.schedule ? `· ${a.schedule}` : ''}
                  </div>
                </div>
                <Tag fill="outline" color="primary" style={{ fontSize: 10, flexShrink: 0 }}>
                  {a._count?.enrollments ?? 0} {t('teacher.myStudents').toLowerCase()}
                </Tag>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bottom spacing for fixed tabbar */}
      <div style={{ height: 24 }} />
    </AppLayout>
  )
}
