import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { SpinLoading, Tag } from 'antd-mobile'
import { User } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Announcement } from '@/types'

export default function AnnouncementDetailPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const annoId = searchParams.get('id')

  const { data: announcement, isLoading } = useQuery({
    queryKey: ['announcement', annoId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Announcement[]>>('/announcements')
      return data.data?.find(a => a.id === annoId) ?? null
    },
    enabled: !!annoId,
  })

  if (isLoading) {
    return (
      <AppLayout title={t('announcements.detail')} showBack>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <SpinLoading style={{ '--size': '32px' } as React.CSSProperties} color="primary" />
        </div>
      </AppLayout>
    )
  }

  if (!announcement) {
    return (
      <AppLayout title={t('announcements.detail')} showBack>
        <div style={{
          textAlign: 'center', color: '#86909c', padding: 60,
          background: 'white', borderRadius: 12,
        }}>
          {t('common.noData')}
        </div>
      </AppLayout>
    )
  }

  const priorityColors: Record<string, string> = {
    normal: 'default',
    high: 'warning',
    urgent: 'danger',
  }

  return (
    <AppLayout title={t('announcements.detail')} showBack>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 20,
      }}>
        {/* Priority + Pinned Badges */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {announcement.isPinned && (
            <Tag color="warning" fill="outline" style={{ fontSize: 11 }}>
              📌 {t('announcements.pinned')}
            </Tag>
          )}
          {announcement.priority !== 'normal' && (
            <Tag color={priorityColors[announcement.priority]} fill="outline" style={{ fontSize: 11 }}>
              {announcement.priority === 'urgent' ? '🔴' : '🟡'} {t(`announcements.${announcement.priority}`)}
            </Tag>
          )}
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#1d1d1f',
          marginBottom: 12,
          lineHeight: 1.3,
        }}>
          {announcement.title}
        </h2>

        {/* Content */}
        <div style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: '#4c4f54',
          whiteSpace: 'pre-wrap',
          marginBottom: 20,
        }}>
          {announcement.content}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #f0f0f0',
          paddingTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#86909c',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <User size={14} />
            <span>{t('announcements.publishedBy')}: {announcement.author?.displayName ?? 'Admin'}</span>
          </div>
          <span>{dayjs(announcement.publishedAt).format('DD MMM YYYY')}</span>
        </div>
      </div>
    </AppLayout>
  )
}
