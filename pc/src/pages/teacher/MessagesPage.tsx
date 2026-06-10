import { useState } from 'react'
import {
  Card, List, Typography, Space, Badge, Input, Button, Avatar, Spin, Empty, Popconfirm, message,
  Modal, Form, Select,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, Trash2, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface Thread {
  id: string
  subject: string
  parentUserId: string
  teacherUserId: string
  studentId: string | null
  parentName: string
  teacherName: string
  unreadCount: number
  updatedAt: string
  messages: Array<{
    id: string
    content: string
    createdAt: string
    sender: { displayName: string }
  }>
}

interface MessageItem {
  id: string
  senderId: string
  content: string
  readAt: string | null
  createdAt: string
  sender: { id: string; displayName: string; role: string }
}

interface ThreadDetail {
  id: string
  subject: string
  parentUserId: string
  messages: MessageItem[]
}

interface TeacherContact {
  userId: string
  name: string
  type: 'parent' | 'student'
  studentName?: string
}

const TeacherMessagesPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeForm] = Form.useForm()

  const { data: contacts = [] } = useQuery({
    queryKey: ['teacher-contacts'],
    queryFn: async () => {
      const { data } = await api.get('/messages/teacher-contacts')
      return data.data as TeacherContact[]
    },
    enabled: composeOpen,
  })

  const composeMutation = useMutation({
    mutationFn: async (values: { parentUserId: string; subject: string; firstMessage: string }) => {
      await api.post('/messages/threads', values)
    },
    onSuccess: () => {
      message.success(t('messages.sent', 'Message sent'))
      setComposeOpen(false)
      composeForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['message-threads'] })
    },
    onError: () => message.error(t('messages.sendError', 'Failed to send message')),
  })

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['message-threads'],
    queryFn: async () => {
      const { data } = await api.get('/messages/threads')
      return data.data as Thread[]
    },
    refetchInterval: 15000,
  })

  const { data: threadDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['thread-detail', selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return null
      const { data } = await api.get(`/messages/threads/${selectedThreadId}`)
      return data.data as ThreadDetail
    },
    enabled: !!selectedThreadId,
    refetchInterval: 10000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (threadId: string) => {
      await api.delete(`/messages/threads/${threadId}`)
    },
    onSuccess: () => {
      message.success('Thread deleted')
      void queryClient.invalidateQueries({ queryKey: ['message-threads'] }).then(() => setSelectedThreadId(null))
    },
    onError: () => message.error('Failed to delete thread'),
  })

  const replyMutation = useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; content: string }) => {
      await api.post(`/messages/threads/${threadId}/reply`, { content })
    },
    onSuccess: () => {
      setReplyText('')
      void queryClient.invalidateQueries({ queryKey: ['thread-detail', selectedThreadId] })
      void queryClient.invalidateQueries({ queryKey: ['message-threads'] })
    },
  })

  const handleSend = () => {
    if (!replyText.trim() || !selectedThreadId) return
    replyMutation.mutate({ threadId: selectedThreadId, content: replyText.trim() })
  }

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
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setComposeOpen(true)}
          >
            {t('messages.newMessage', 'New Message')}
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
              <Empty description="No messages yet" imageStyle={{ height: 40 }} />
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
                      <Text strong style={{ fontSize: 13 }}>{thread.parentName}</Text>
                      <Space size={4}>
                        {thread.unreadCount > 0 && <Badge count={thread.unreadCount} size="small" />}
                        <Popconfirm
                          title="Delete this thread?"
                          description="All messages in this conversation will be permanently deleted."
                          onConfirm={() => deleteMutation.mutate(thread.id)}
                          okText="Delete"
                          cancelText="Cancel"
                          okButtonProps={{ danger: true }}
                        >
                          <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                            <Trash2
                              size={13}
                              style={{ color: '#ff4d4f', cursor: 'pointer', flexShrink: 0, opacity: 0.6 }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                            />
                          </span>
                        </Popconfirm>
                      </Space>
                    </div>
                    <div style={{ fontSize: 12, color: '#165DFF', fontWeight: 500, marginTop: 2 }}>
                      {thread.subject}
                    </div>
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
              <Empty description="Select a conversation to read" imageStyle={{ height: 60 }} />
            </div>
          ) : detailLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Spin />
            </div>
          ) : threadDetail ? (
            <>
              {/* Header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                <Text strong style={{ fontSize: 14 }}>{selectedThread?.subject}</Text>
                <div style={{ fontSize: 12, color: '#888' }}>with {selectedThread?.parentName}</div>
              </div>

              {/* Messages */}
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

              {/* Reply box */}
              <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
                <Input.TextArea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a reply..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                />
                <Button
                  type="primary"
                  icon={<Send size={14} />}
                  onClick={handleSend}
                  loading={replyMutation.isPending}
                  disabled={!replyText.trim()}
                >
                  Send
                </Button>
              </div>
            </>
          ) : null}
        </Card>
      </div>
      <Modal
        title={t('messages.newMessage', 'New Message')}
        open={composeOpen}
        onCancel={() => { setComposeOpen(false); composeForm.resetFields() }}
        onOk={() => composeForm.submit()}
        okText={t('messages.send', 'Send')}
        confirmLoading={composeMutation.isPending}
        width={520}
      >
        <Form
          form={composeForm}
          layout="vertical"
          onFinish={(values) => composeMutation.mutate(values as { parentUserId: string; subject: string; firstMessage: string })}
          style={{ marginTop: 12 }}
        >
          <Form.Item
            name="parentUserId"
            label={t('messages.recipient', 'Recipient')}
            rules={[{ required: true, message: t('messages.recipientRequired', 'Please select a recipient') }]}
          >
            <Select
              showSearch
              placeholder={t('messages.selectRecipient', 'Select parent or student')}
              optionFilterProp="label"
              options={contacts.map((c) => ({
                value: c.userId,
                label: c.type === 'parent'
                  ? `${c.name} (${t('messages.parentOf', 'Parent of')} ${c.studentName ?? ''})`
                  : `${c.name} (${t('role.student', 'Student')})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="subject"
            label={t('messages.subject', 'Subject')}
            rules={[{ required: true, message: t('messages.subjectRequired', 'Please enter a subject') }]}
          >
            <Input placeholder={t('messages.subjectPlaceholder', 'e.g. About homework assignment')} />
          </Form.Item>
          <Form.Item
            name="firstMessage"
            label={t('messages.message', 'Message')}
            rules={[{ required: true, message: t('messages.messageRequired', 'Please enter a message') }]}
          >
            <Input.TextArea
              rows={4}
              placeholder={t('messages.inputPlaceholder', 'Type your message...')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TeacherMessagesPage
