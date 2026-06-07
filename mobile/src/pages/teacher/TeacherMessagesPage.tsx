import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  PullToRefresh, Skeleton, Badge, Toast, Input, Button,
  DotLoading, NavBar,
} from 'antd-mobile'
import { MessageSquare, Send, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, MessageThread, DirectMessage } from '@/types'

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

/* ────── Thread List View ────── */

function ThreadListView({ onSelectThread }: { onSelectThread: (id: string) => void }) {
  const { t } = useTranslation()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['message-threads'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MessageThread[]>>('/messages/threads')
      return data.data ?? []
    },
  })

  const threads = data ?? []
  const totalUnread = threads.reduce((sum, th) => sum + (th.unreadCount ?? 0), 0)

  return (
    <AppLayout title={t('teacher.messages', 'Messages')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Summary bar */}
        {threads.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#f0f5ff', borderRadius: 10, padding: '10px 14px',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 13, color: '#4c4f54' }}>
              {t('messages.title')}: {threads.length}
            </span>
            {totalUnread > 0 && (
              <Badge content={totalUnread > 99 ? '99+' : String(totalUnread)} />
            )}
          </div>
        )}

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
            <div style={{ fontSize: 14 }}>{t('teacher.noMessages')}</div>
            <div style={{ fontSize: 12, color: '#c9cdd4', marginTop: 4 }}>
              Messages from parents will appear here
            </div>
          </div>
        ) : (
          threads.map(thread => {
            const otherName = thread.parentName
            const lastMsg = thread.messages?.[thread.messages.length - 1]
            const hasUnread = (thread.unreadCount ?? 0) > 0
            const color = avatarColor(otherName ?? 'P')

            return (
              <div
                key={thread.id}
                className="msg-thread-card"
                style={{ background: hasUnread ? '#EFF6FF' : 'white' }}
                onClick={() => onSelectThread(thread.id)}
              >
                {/* Avatar */}
                <div style={{
                  width: 46, height: 46, borderRadius: 23, flexShrink: 0,
                  background: color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 16,
                }}>
                  {getInitials(otherName ?? 'P')}
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: hasUnread ? 700 : 600, fontSize: 14, color: '#1d1d1f' }}>
                      {otherName ?? t('messages.parent')}
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

/* ────── Thread Detail View (chat bubble) ────── */

interface ThreadDetailData {
  id: string
  subject: string
  parentName: string
  parentUserId: string
  messages: DirectMessage[]
}

function ThreadDetailView({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [replyText, setReplyText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['thread-detail', threadId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<ThreadDetailData>>(`/messages/threads/${threadId}`)
      return data.data
    },
    enabled: !!threadId,
  })

  const replyMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/messages/threads/${threadId}/reply`, { content: replyText.trim() })
    },
    onSuccess: () => {
      Toast.show({ icon: 'success', content: t('teacher.sent', 'Sent') })
      setReplyText('')
      qc.invalidateQueries({ queryKey: ['thread-detail', threadId] })
      qc.invalidateQueries({ queryKey: ['message-threads'] })
    },
    onError: () => {
      Toast.show({ icon: 'fail', content: t('messages.sendError') })
    },
  })

  const handleSend = () => {
    if (!replyText.trim()) return
    replyMutation.mutate()
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#f5f6fa',
    }}>
      {/* Nav bar */}
      <NavBar
        onBack={onBack}
        style={{
          background: 'white', borderBottom: '1px solid #f0f0f0',
          position: 'sticky', top: 0, zIndex: 10,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {detail?.subject ?? t('teacher.messageDetail')}
        </div>
        {detail?.parentName && (
          <span style={{ fontSize: 12, color: '#86909c', marginLeft: 6 }}>
            · {detail.parentName}
          </span>
        )}
      </NavBar>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <DotLoading color="primary" />
          </div>
        ) : !detail?.messages || detail.messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#86909c' }}>
            <MessageSquare size={36} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 8px' }} />
            {t('messages.noMessages')}
          </div>
        ) : (
          <>
            {detail.messages.map(msg => {
              const isMe = msg.senderId === user?.id
              return (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                  marginBottom: 10,
                }}>
                  {!isMe && (
                    <div style={{
                      width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                      background: avatarColor(detail.parentName ?? 'P'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 600, fontSize: 12, marginRight: 8, alignSelf: 'flex-end',
                    }}>
                      {getInitials(detail.parentName ?? 'P')}
                    </div>
                  )}
                  <div style={{
                    maxWidth: '72%',
                    background: isMe ? '#165DFF' : 'white',
                    color: isMe ? 'white' : '#1d1d1f',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    padding: '9px 13px',
                    fontSize: 14,
                    lineHeight: 1.45,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>
                  {isMe && (
                    <div style={{
                      fontSize: 10, color: '#c9cdd4', marginLeft: 6, alignSelf: 'flex-end', flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      {dayjs(msg.createdAt).format('HH:mm')}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef as React.RefObject<HTMLDivElement>} />
          </>
        )}
      </div>

      {/* Reply input bar */}
      <div style={{
        background: 'white',
        padding: '10px 12px',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
      }}>
        <Input
          value={replyText}
          onChange={setReplyText}
          placeholder={t('teacher.replyPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          style={{
            flex: 1,
            '--font-size': '14px',
            '--border-radius': '20px',
          } as React.CSSProperties}
        />
        <Button
          color="primary"
          size="small"
          shape="rounded"
          loading={replyMutation.isPending}
          disabled={!replyText.trim()}
          onClick={handleSend}
          style={{ flexShrink: 0 }}
        >
          <Send size={15} />
        </Button>
      </div>
    </div>
  )
}

/* ────── Main Component ────── */

export default function TeacherMessagesPage() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  if (activeThreadId) {
    return (
      <ThreadDetailView
        threadId={activeThreadId}
        onBack={() => setActiveThreadId(null)}
      />
    )
  }

  return <ThreadListView onSelectThread={setActiveThreadId} />
}
