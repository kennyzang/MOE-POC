import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag } from 'antd-mobile'
import { Megaphone, Pin, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, Announcement } from '@/types'

export default function AnnouncementsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['announcements-list'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Announcement[]>>('/announcements')
      return data.data ?? []
    },
  })

  // Pinned first, then sorted by date descending
  const sorted = [...(data ?? [])].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })

  return (
    <AppLayout title={t('announcements.title')} showBack>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, padding: 14,
                marginBottom: 8,
              }}>
                <Skeleton animated style={{ height: 16, width: '65%', marginBottom: 8, borderRadius: 4 }} />
                <Skeleton animated style={{ height: 12, width: '100%', marginBottom: 4, borderRadius: 4 }} />
                <Skeleton animated style={{ height: 12, width: '80%', borderRadius: 4 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <Skeleton animated style={{ height: 11, width: '30%', borderRadius: 4 }} />
                  <Skeleton animated style={{ height: 11, width: '20%', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </>
        ) : sorted.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px', color: '#86909c',
          }}>
            <Megaphone size={48} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14 }}>{t('announcements.noAnnouncements')}</div>
          </div>
        ) : (
          sorted.map(anno => (
            <div
              key={anno.id}
              className={`anno-card ${
                anno.priority === 'urgent' ? 'anno-card-urgent' :
                anno.isPinned ? 'anno-card-pinned' : ''
              }`}
              onClick={() => navigate(`/announcement/detail?id=${anno.id}`)}
            >
              {/* Tags row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                {anno.isPinned && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Pin size={11} color="#FF7D00" />
                    <span style={{ fontSize: 11, color: '#FF7D00', fontWeight: 600 }}>
                      {t('announcements.pinned')}
                    </span>
                  </span>
                )}
                {anno.priority === 'urgent' && (
                  <Tag color="danger" fill="outline" style={{ fontSize: 10, padding: '0 5px', '--border-radius': '4px' } as React.CSSProperties}>
                    {t('announcements.urgent')}
                  </Tag>
                )}
                {anno.priority === 'high' && (
                  <Tag color="warning" fill="outline" style={{ fontSize: 10, padding: '0 5px', '--border-radius': '4px' } as React.CSSProperties}>
                    {t('announcements.high')}
                  </Tag>
                )}
              </div>

              {/* Title + chevron */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div className="anno-card-title" style={{ flex: 1, margin: 0 }}>
                  {anno.title}
                </div>
                <ChevronRight size={15} color="#c9cdd4" style={{ flexShrink: 0, marginTop: 2 }} />
              </div>

              {/* Content preview */}
              <div className="anno-card-content" style={{ marginTop: 5 }}>
                {anno.content}
              </div>

              {/* Footer */}
              <div className="anno-card-footer" style={{ marginTop: 8 }}>
                <span>{anno.author?.displayName ?? 'Admin'}</span>
                <span>{dayjs(anno.publishedAt).format('DD MMM YYYY')}</span>
              </div>
            </div>
          ))
        )}
      </PullToRefresh>
    </AppLayout>
  )
}
