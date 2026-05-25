import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag } from 'antd-mobile'
import { User } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Student } from '@/types'

export default function StudentProfilePage() {
  const { t } = useTranslation()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Student>>('/students/me')
      return data.data
    },
  })

  return (
    <AppLayout title={t('student.profile')} showLogout>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : (
        <>
          {/* Avatar card */}
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 24,
            textAlign: 'center',
            marginBottom: 12,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 40,
              background: 'linear-gradient(135deg, #165DFF, #0E42D2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <User size={36} color="white" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{student?.user?.displayName}</div>
            <div style={{ fontSize: 13, color: '#86909c', marginTop: 4 }}>{student?.studentId}</div>
            <Tag color="primary" fill="outline" style={{ marginTop: 8 }}>
              {student?.enrollmentStatus}
            </Tag>
          </div>

          <List style={{ borderRadius: 12, overflow: 'hidden' }}>
            <List.Item extra={student?.gradeLevel ?? '—'}>{t('student.gradeLevel')}</List.Item>
            <List.Item extra={student?.className ?? '—'}>{t('student.className')}</List.Item>
            <List.Item extra={student?.gender ?? '—'}>{t('student.gender')}</List.Item>
            <List.Item extra={student?.nationality ?? '—'}>{t('student.nationality')}</List.Item>
            <List.Item extra={
              student?.dateOfBirth ? dayjs(student.dateOfBirth).format('DD/MM/YYYY') : '—'
            }>
              {t('student.dob')}
            </List.Item>
            <List.Item extra={student?.user?.email ?? '—'}>{t('common.email')}</List.Item>
          </List>
        </>
      )}
    </AppLayout>
  )
}
