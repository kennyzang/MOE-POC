import { useState } from 'react'
import {
  Card, List, Typography, Space, Badge, Input, Button, Avatar, Modal, Form,
  Select, Spin, Empty, Popconfirm, message,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, Plus, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface Thread {
  id: string
  subject: string
  parentUserId: string
  teacherUserId: string
  parentName: string
  teacherName: string
  unreadCount: number
  updatedAt: string
  messages: Array<{ content: string; sender: { displayName: string } }>
}

interface ThreadDetail {
  id: string
  subject: string
  parentUserId: string
  messages: Array<{
    id: string
    senderId: string
    content: string
    readAt: string | null
    createdAt: string
    sender: { id: string; displayName: string; role: string }
  }>
}

interface Teacher {
  teacherId: string
  teacherUserId: string
  teacherName: string
  teacherEmail: string
  courses: string[]
}

const ParentMessagesPage = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const [form] = Form.useForm()

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['parent-message-threads'],
    queryFn: async () => {
      const { data } = await api.get('/messages/threads')
      return data.data as Thread[]
    },
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ['parent-teachers'],
    queryFn: async () => {
      const { data } = await api.get('/parent/meetings/teachers')
      return data.data as Teacher[]
    },
  })

  const { data: threadDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['parent-thread-detail', selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return null
      const { data } = await api.get(`/messages/threads/${selectedThreadId}`)
      return data.data as ThreadDetail
    },
    enabled: !!selectedThreadId,
    refetchInterval: 10000,
  })

  const createMutation = useMutation({
    mutationFn: async (values: { teacherUserId: string; subject: string; firstMessage: string }) => {
      await api.post('/messages/threads', values)
    },
    onSuccess: () => {
      message.success('Message sent')
      setNewThreadOpen(false)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['parent-message-threads'] })
    },
  })

  const replyMutation = useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; content: string }) => {
      await api.post(`/messages/threads/${threadId}/reply`, { content })
    },
    onSuccess: () => {
      setReplyText('')
      void queryClient.invalidateQueries({ queryKey: ['parent-thread-detail', selectedThreadId] })
      void queryClient.invalidateQueries({ queryKey: ['parent-message-threads'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (threadId: string) => {
      await api.delete(`/messages/threads/${threadId}`)
    },
    onSuccess: () => {
      message.success('Thread deleted')
      void queryClient.invalidateQueries({ queryKey: ['parent-message-threads'] }).then(() => {
        // Clear selection if the deleted thread was selected
        setSelectedThreadId(null)
      })
    },
    onError: () => message.error('Failed to delete thread'),
  })

  const selectedThread = threads.find((t) => t.id === selectedThreadId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <MessageSquare size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Messages</Title>
            {threads.reduce((s, t) => s + t.unreadCount, 0) > 0 && (
              <Badge count={threads.reduce((s, t) => s + t.unreadCount, 0)} />
            )}
          </Space>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setNewThreadOpen(true)}>
            New Message
          </Button>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 220px)', minHeight: 400 }}>
        {/* Thread list */}
        <Card style={{ width: 300, flexShrink: 0, overflowY: 'auto' }} bodyStyle={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : threads.length === 0 ? (
            <div style={{ padding: 24 }}>
              <Empty description="No messages yet. Click 'New Message' to contact a teacher." imageStyle={{ height: 40 }} />
            </div>
          ) : (
            <List
              dataSource={threads}
              renderItem={(thread) => (
                <List.Item
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: selectedThreadId === thread.id ? '#f0f5ff' : undefined,
                    borderLeft: selectedThreadId === thread.id ? '3px solid #165DFF' : '3px solid transparent',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>{thread.teacherName}</Text>
                      <Space size={4}>
                        {thread.unreadCount > 0 && <Badge count={thread.unreadCount} size="small" />}
                        <Popconfirm
                          title="Delete this thread?"
                          description="This will permanently delete all messages in this conversation."
                          onConfirm={() => deleteMutation.mutate(thread.id)}
                          okText="Delete"
                          cancelText="Cancel"
                          okButtonProps={{ danger: true }}
                        >
                          <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                            <Trash2
                              size={13}
                              style={{ color: '#bfbfbf', cursor: 'pointer', flexShrink: 0 }}
                            />
                          </span>
                        </Popconfirm>
                      </Space>
                    </div>
                    <div style={{ fontSize: 12, color: '#165DFF', fontWeight: 500, marginTop: 2 }}>{thread.subject}</div>
                    {thread.messages[0] && (
                      <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                        {thread.messages[0].sender.displayName}: {thread.messages[0].content}
                      </Text>
                    )}
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
                      {dayjs(thread.updatedAt).fromNow()}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* Thread detail */}
        <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
          {!selectedThreadId ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
              <Empty description="Select a conversation" imageStyle={{ height: 60 }} />
            </div>
          ) : detailLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin /></div>
          ) : threadDetail ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                <Text strong style={{ fontSize: 14 }}>{selectedThread?.subject}</Text>
                <div style={{ fontSize: 12, color: '#888' }}>with {selectedThread?.teacherName}</div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {threadDetail.messages.map((msg) => {
                  const isMe = msg.sender.id === user?.id
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      {!isMe && (
                        <Avatar size="small" style={{ background: '#165DFF', marginRight: 8, flexShrink: 0 }}>
                          {msg.sender.displayName.charAt(0)}
                        </Avatar>
                      )}
                      <div style={{ maxWidth: '70%' }}>
                        <div
                          style={{
                            background: isMe ? '#165DFF' : '#f5f5f5',
                            color: isMe ? '#fff' : '#333',
                            borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                            padding: '8px 12px',
                            fontSize: 13,
                          }}
                        >
                          {msg.content}
                        </div>
                        <div style={{ fontSize: 11, color: '#bbb', marginTop: 2, textAlign: isMe ? 'right' : 'left' }}>
                          {dayjs(msg.createdAt).format('DD/MM HH:mm')}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
                <Input.TextArea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a message..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (replyText.trim() && selectedThreadId) {
                        replyMutation.mutate({ threadId: selectedThreadId, content: replyText.trim() })
                      }
                    }
                  }}
                />
                <Button
                  type="primary"
                  icon={<Send size={14} />}
                  loading={replyMutation.isPending}
                  disabled={!replyText.trim()}
                  onClick={() => {
                    if (replyText.trim() && selectedThreadId) {
                      replyMutation.mutate({ threadId: selectedThreadId, content: replyText.trim() })
                    }
                  }}
                >
                  Send
                </Button>
              </div>
            </>
          ) : null}
        </Card>
      </div>

      {/* New Thread Modal */}
      <Modal
        title={<Space><MessageSquare size={16} /> New Message to Teacher</Space>}
        open={newThreadOpen}
        onCancel={() => { setNewThreadOpen(false); form.resetFields() }}
        onOk={() => form.validateFields().then((v) => createMutation.mutate(v))}
        confirmLoading={createMutation.isPending}
        okText="Send"
        width={480}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="teacherUserId" label="Teacher" rules={[{ required: true }]}>
            <Select
              placeholder="Select a teacher"
              options={teachers.map((t) => ({
                value: t.teacherUserId,
                label: `${t.teacherName} (${t.courses.join(', ')})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
            <Input placeholder="About Ahmad's homework..." />
          </Form.Item>
          <Form.Item name="firstMessage" label="Message" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="Type your message here..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ParentMessagesPage
