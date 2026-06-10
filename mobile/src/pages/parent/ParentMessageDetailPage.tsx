import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Skeleton, Toast } from 'antd-mobile'
import { Send } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, MessageThread } from '@/types'

export default function ParentMessageDetailPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const threadId = searchParams.get('id')
  const user = useAuthStore(s => s.user)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: thread, isLoading } = useQuery({
    queryKey: ['message-thread', threadId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MessageThread>>(`/messages/threads/${threadId}`)
      return data.data
    },
    enabled: !!threadId,
  })

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [isLoading, thread?.messages?.length])

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      await api.post(`/messages/threads/${threadId}/reply`, { content })
    },
    onSuccess: () => {
      setInput('')
      queryClient.invalidateQueries({ queryKey: ['message-thread', threadId] })
      queryClient.invalidateQueries({ queryKey: ['message-threads'] })
    },
    onError: () => {
      Toast.show({ icon: 'fail', content: t('messages.sendError') })
    },
  })

  const handleSend = () => {
    const text = input.trim()
    if (!text || sendMutation.isPending) return
    sendMutation.mutate(text)
  }

  const otherName = user?.role === 'parent' ? thread?.teacherName : thread?.parentName
  const messages = thread?.messages ?? []

  return (
    <AppLayout title={otherName ?? t('messages.detail')} showBack>
      {/* Full height layout — position absolute to escape page-content padding */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        top: 45, // NavHeader height
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        paddingBottom: 50, // keep above tab bar
      }}>
        {/* Message scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: i % 2 === 1 ? 'flex-end' : 'flex-start',
                }}>
                  <Skeleton animated style={{
                    height: 44, borderRadius: 12,
                    width: `${45 + i * 10}%`,
                  }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Thread subject header */}
              {thread?.subject && (
                <div style={{
                  textAlign: 'center', fontSize: 12, color: '#86909c',
                  margin: '0 0 14px', padding: '6px 16px',
                  background: 'white', borderRadius: 8,
                  border: '1px solid #f0f0f0',
                }}>
                  <span style={{ fontWeight: 600 }}>{t('messages.subject')}: </span>
                  {thread.subject}
                </div>
              )}

              {messages.map((msg, idx) => {
                const isMe = msg.sender?.id === user?.id
                const prevMsg = idx > 0 ? messages[idx - 1] : null
                const showDate = !prevMsg ||
                  !dayjs(msg.createdAt).isSame(dayjs(prevMsg.createdAt), 'day')

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div style={{
                        textAlign: 'center', fontSize: 11, color: '#c9cdd4',
                        margin: '10px 0 8px',
                      }}>
                        {dayjs(msg.createdAt).format('DD MMM YYYY')}
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 8,
                    }}>
                      <div style={{
                        maxWidth: '76%',
                        background: isMe ? '#165DFF' : 'white',
                        color: isMe ? 'white' : '#1d1d1f',
                        borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                        padding: '9px 13px',
                        fontSize: 14,
                        lineHeight: 1.5,
                        boxShadow: isMe
                          ? '0 2px 8px rgba(22,93,255,0.25)'
                          : '0 1px 4px rgba(0,0,0,0.07)',
                        border: isMe ? 'none' : '1px solid #f0f0f0',
                      }}>
                        {!isMe && (
                          <div style={{
                            fontSize: 11, fontWeight: 600,
                            color: '#86909c', marginBottom: 3,
                          }}>
                            {msg.sender?.displayName}
                          </div>
                        )}
                        <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                        <div style={{
                          fontSize: 10,
                          color: isMe ? 'rgba(255,255,255,0.65)' : '#c9cdd4',
                          marginTop: 4, textAlign: 'right',
                        }}>
                          {dayjs(msg.createdAt).format('HH:mm')}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input bar — fixed at bottom */}
        <div style={{
          background: 'white',
          borderTop: '1px solid #f0f0f0',
          padding: '8px 12px',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={t('messages.inputPlaceholder')}
            style={{
              flex: 1, border: '1px solid #e5e5e5', borderRadius: 22,
              padding: '9px 16px', fontSize: 14, outline: 'none',
              background: '#fafafa', color: '#1d1d1f',
            }}
            disabled={sendMutation.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            style={{
              width: 38, height: 38, borderRadius: 19, flexShrink: 0,
              background: input.trim() && !sendMutation.isPending ? '#165DFF' : '#e5e5e5',
              border: 'none', cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            <Send size={16} color={input.trim() && !sendMutation.isPending ? 'white' : '#c9cdd4'} />
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
