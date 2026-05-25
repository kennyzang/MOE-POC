import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, AttendanceSession } from '@/types'

export default function TeacherAttendancePage() {
  const { t } = useTranslation()

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['teacher-sessions'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttendanceSession[]>>('/attendance/sessions')
      return data.data
    },
  })

  return (
    <AppLayout title={t('teacher.attendance')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('teacher.noSessions')}</div>
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
    </AppLayout>
  )
}
