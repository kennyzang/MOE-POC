import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Badge } from 'antd-mobile'
import { MessageSquare, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, MessageThread } from '@/types'

dayjs.extend(relativeTime)

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase()
}

const AVATAR_COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#722ED1', '#F53F3F']
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function ParentMessagesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['message-threads'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MessageThread[]>>('/messages/threads')
      return data.data ?? []
    },
  })

  const threads = data ?? []

  return (
    <AppLayout title={t('messages.title')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 8,
              }}>
                <Skeleton animated style={{ width: 46, height: 46, borderRadius: 23, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <Skeleton animated style={{ height: 14, width: '55%', marginBottom: 7, borderRadius: 4 }} />
                  <Skeleton animated style={{ height: 12, width: '85%', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </>
        ) : threads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#86909c' }}>
            <MessageSquare size={48} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14 }}>{t('messages.noMessages')}</div>
          </div>
        ) : (
          threads.map(thread => {
            const otherName = user?.role === 'parent' ? thread.teacherName : thread.parentName
            const lastMsg = thread.messages?.[thread.messages.length - 1]
            const hasUnread = (thread.unreadCount ?? 0) > 0
            const color = avatarColor(otherName ?? 'T')

            return (
              <div
                key={thread.id}
                className="msg-thread-card"
                style={{ background: hasUnread ? '#EFF6FF' : 'white' }}
                onClick={() => navigate(`/parent/messages/detail?id=${thread.id}`)}
              >
                {/* Avatar */}
                <div style={{
                  width: 46, height: 46, borderRadius: 23, flexShrink: 0,
                  background: color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 16,
                }}>
                  {getInitials(otherName ?? 'T')}
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: hasUnread ? 700 : 600, fontSize: 14, color: '#1d1d1f' }}>
                      {otherName ?? t('messages.teacher')}
                    </span>
                    <span style={{ fontSize: 11, color: '#c9cdd4', flexShrink: 0, marginLeft: 8 }}>
                      {thread.updatedAt ? dayjs(thread.updatedAt).fromNow() : ''}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 13, color: hasUnread ? '#4c4f54' : '#86909c',
                    fontWeight: hasUnread ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {thread.subject}
                  </div>
                  {lastMsg && (
                    <div style={{
                      fontSize: 12, color: '#86909c', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {lastMsg.content}
                    </div>
                  )}
                </div>

                {/* Unread badge + chevron */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  {hasUnread && (
                    <Badge
                      content={thread.unreadCount! > 99 ? '99+' : String(thread.unreadCount)}
                      style={{ '--right': '0', '--top': '0' } as React.CSSProperties}
                    />
                  )}
                  <ChevronRight size={16} color="#c9cdd4" />
                </div>
              </div>
            )
          })
        )}
      </PullToRefresh>
    </AppLayout>
  )
}
