import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Badge, Popup, Form, Input, TextArea, Button, Toast, Selector } from 'antd-mobile'
import { MessageSquare, ChevronRight, Plus, RefreshCw } from 'lucide-react'
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

interface Teacher {
  teacherId: string
  teacherUserId: string
  teacherName: string
  courses: string[]
}

function ComposePopup({ visible, onClose, onSent }: {
  visible: boolean
  onClose: () => void
  onSent: () => void
}) {
  const { t } = useTranslation()
  const [teacherUserId, setTeacherUserId] = useState('')
  const [subject, setSubject] = useState('')
  const [firstMessage, setFirstMessage] = useState('')

  const { data: teachers = [] } = useQuery({
    queryKey: ['parent-teachers'],
    queryFn: async () => {
      const { data } = await api.get('/parent/meetings/teachers')
      return data.data as Teacher[]
    },
    enabled: visible,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/messages/threads', { teacherUserId, subject, firstMessage })
    },
    onSuccess: () => {
      Toast.show({ icon: 'success', content: t('messages.sent', 'Message sent') })
      setTeacherUserId('')
      setSubject('')
      setFirstMessage('')
      onSent()
    },
    onError: () => {
      Toast.show({ icon: 'fail', content: t('messages.sendError') })
    },
  })

  const canSubmit = !!teacherUserId && !!subject.trim() && !!firstMessage.trim()

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      onClose={onClose}
      bodyStyle={{
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: '20px 16px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}
      position="bottom"
    >
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
        {t('messages.newMessage', 'New Message')}
      </div>

      <Form layout="vertical">
        <Form.Item label={t('messages.teacher', 'Teacher')} style={{ marginBottom: 12 }}>
          <Selector
            options={teachers.map(tc => ({
              label: tc.teacherName + (tc.courses.length ? ` (${tc.courses.slice(0, 2).join(', ')})` : ''),
              value: tc.teacherUserId,
            }))}
            value={teacherUserId ? [teacherUserId] : []}
            onChange={(v) => setTeacherUserId(v[0] ?? '')}
            style={{ '--border-radius': '8px', '--padding': '6px 12px' } as React.CSSProperties}
          />
        </Form.Item>

        <Form.Item label={t('messages.subject', 'Subject')} style={{ marginBottom: 12 }}>
          <Input
            value={subject}
            onChange={setSubject}
            placeholder={t('messages.subjectPlaceholder', 'e.g. About homework assignment')}
            style={{ '--border-radius': '8px', '--font-size': '14px' } as React.CSSProperties}
          />
        </Form.Item>

        <Form.Item label={t('messages.message', 'Message')} style={{ marginBottom: 16 }}>
          <TextArea
            value={firstMessage}
            onChange={setFirstMessage}
            placeholder={t('messages.inputPlaceholder', 'Type your message...')}
            rows={4}
            style={{ '--border-radius': '8px', '--font-size': '14px' } as React.CSSProperties}
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            block
            onClick={onClose}
            style={{ flex: 1 }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            block
            color="primary"
            disabled={!canSubmit}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            style={{ flex: 2 }}
          >
            {t('messages.send', 'Send')}
          </Button>
        </div>
      </Form>
    </Popup>
  )
}

export default function ParentMessagesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const [composeOpen, setComposeOpen] = useState(false)

  const { data, isLoading, refetch, isError, error } = useQuery({
    queryKey: ['message-threads'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MessageThread[]>>('/messages/threads')
      return data.data ?? []
    },
    refetchOnMount: true,
    refetchOnFocus: true,
    staleTime: 0,
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
        ) : isError ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#86909c' }}>
            <div style={{ fontSize: 14, color: '#f53f3f', marginBottom: 12 }}>Failed to load messages</div>
            <Button size="small" color="primary" onClick={() => refetch()}><RefreshCw size={14} /> Retry</Button>
          </div>
        ) : threads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#86909c' }}>
            <MessageSquare size={48} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14 }}>{t('messages.noMessages')}</div>
            <div style={{ fontSize: 12, color: '#c9cdd4', marginTop: 4 }}>
              {t('messages.tapToCompose', 'Tap + to message a teacher')}
            </div>
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

      {/* Floating compose button */}
      <button
        onClick={() => setComposeOpen(true)}
        aria-label={t('messages.newMessage', 'New Message')}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(56px + env(safe-area-inset-bottom) + 16px)',
          width: 52,
          height: 52,
          borderRadius: 26,
          background: '#165DFF',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(22,93,255,0.4)',
          zIndex: 100,
        }}
      >
        <Plus size={24} color="white" />
      </button>

      <ComposePopup
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => {
          setComposeOpen(false)
          void queryClient.invalidateQueries({ queryKey: ['message-threads'] })
        }}
      />
    </AppLayout>
  )
}
