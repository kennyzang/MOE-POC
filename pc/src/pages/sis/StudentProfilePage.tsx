import { Card, Descriptions, Avatar, Tag, Spin, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { User } from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { User as UserType } from '../../types'

const { Title } = Typography

const StudentProfilePage = () => {
  const { t } = useTranslation()
  const { user: authUser } = useAuthStore()

  const { data: me, isLoading } = useQuery({
    queryKey: ['auth-me', authUser?.id],
    queryFn: async () => {
      const { data } = await api.get('/auth/me')
      return data.data as UserType
    },
    enabled: !!authUser,
    // Fall back to the cached auth user if the request fails
    placeholderData: authUser ?? undefined,
  })

  const profile = me ?? authUser

  if (isLoading && !profile) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const initials = profile?.displayName
    ? profile.displayName.charAt(0).toUpperCase()
    : '?'

  return (
    <div style={{ maxWidth: 720 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        {t('studentPortal.profile')}
      </Title>

      <Card style={{ borderRadius: 10 }}>
        {/* Avatar Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 32,
            padding: '16px 0',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Avatar
            size={72}
            style={{
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              fontSize: 28,
              fontWeight: 700,
              flexShrink: 0,
            }}
            icon={!initials || initials === '?' ? <User size={36} /> : undefined}
          >
            {initials !== '?' ? initials : undefined}
          </Avatar>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {profile?.displayName}
            </Typography.Title>
            <Tag color="blue" style={{ marginTop: 6 }}>
              {t(`roles.${profile?.role ?? 'student'}`)}
            </Tag>
          </div>
        </div>

        {/* Details */}
        <Descriptions column={1} labelStyle={{ fontWeight: 600, width: 160 }}>
          <Descriptions.Item label={t('common.name')}>
            {profile?.displayName ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('auth.username')}>
            {profile?.username ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.email')}>
            {profile?.email ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.status')}>
            <Tag color="success">Active</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Semester">
            2026-S1
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}

export default StudentProfilePage
