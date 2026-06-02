import { useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Typography, Modal, Form, Input, Select,
  DatePicker, Switch, message, Row, Col,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Plus, Pin, Trash2 } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import api from '@/lib/api'

const { Title, Text } = Typography

interface Announcement {
  id: string
  title: string
  content: string
  priority: string
  isPinned: boolean
  targetAudience: string
  gradeLevel: string | null
  publishedAt: string
  expiresAt: string | null
  author: { displayName: string; role: string }
}

const PRIORITY_COLOR: Record<string, string> = { normal: 'default', high: 'orange', urgent: 'red' }
const GRADE_LEVELS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12']

const AnnouncementsAdminPage = () => {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<Announcement | null>(null)
  const [form] = Form.useForm()

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data } = await api.get('/announcements')
      return data.data as Announcement[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = {
        ...values,
        publishedAt: values.publishedAt ? (values.publishedAt as dayjs.Dayjs).toISOString() : undefined,
        expiresAt: values.expiresAt ? (values.expiresAt as dayjs.Dayjs).toISOString() : undefined,
      }
      await api.post('/announcements', payload)
    },
    onSuccess: () => {
      message.success('Announcement posted')
      setCreateOpen(false)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      await api.patch(`/announcements/${id}`, values)
    },
    onSuccess: () => {
      message.success('Updated')
      setEditItem(null)
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/announcements/${id}`)
    },
    onSuccess: () => {
      message.success('Deleted')
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })
    },
  })

  const togglePin = (a: Announcement) => {
    updateMutation.mutate({ id: a.id, values: { isPinned: !a.isPinned } })
  }

  const columns: ColumnsType<Announcement> = [
    {
      title: 'Title',
      key: 'title',
      render: (_, r) => (
        <div>
          <Space>
            {r.isPinned && <Pin size={12} color="#fa8c16" />}
            <Text strong>{r.title}</Text>
          </Space>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{r.content.slice(0, 80)}{r.content.length > 80 ? '…' : ''}</div>
        </div>
      ),
    },
    {
      title: 'Audience',
      key: 'audience',
      render: (_, r) => (
        <Space>
          <Tag>{r.targetAudience}</Tag>
          {r.gradeLevel && <Tag color="blue">{r.gradeLevel}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (p: string) => <Tag color={PRIORITY_COLOR[p]}>{p.toUpperCase()}</Tag>,
    },
    {
      title: 'Published',
      key: 'pub',
      render: (_, r) => (
        <div>
          <div>{dayjs(r.publishedAt).format('DD/MM/YYYY')}</div>
          {r.expiresAt && <div style={{ fontSize: 11, color: '#888' }}>Expires {dayjs(r.expiresAt).format('DD/MM/YYYY')}</div>}
        </div>
      ),
    },
    {
      title: 'Author',
      key: 'author',
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.author.displayName}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<Pin size={12} />}
            onClick={() => togglePin(r)}
            type={r.isPinned ? 'primary' : 'default'}
          >
            {r.isPinned ? 'Unpin' : 'Pin'}
          </Button>
          <Button
            size="small"
            danger
            icon={<Trash2 size={12} />}
            onClick={() => {
              Modal.confirm({
                title: 'Delete this announcement?',
                onOk: () => deleteMutation.mutate(r.id),
              })
            }}
          />
        </Space>
      ),
    },
  ]

  const announcementForm = (
    <Form form={form} layout="vertical">
      <Form.Item name="title" label="Title" rules={[{ required: true }]}>
        <Input placeholder="Sports Day Schedule" />
      </Form.Item>
      <Form.Item name="content" label="Content" rules={[{ required: true }]}>
        <Input.TextArea rows={5} placeholder="Announcement details..." />
      </Form.Item>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="targetAudience" label="Target Audience" initialValue="all">
            <Select options={[
              { value: 'all', label: 'Everyone' },
              { value: 'students', label: 'Students Only' },
              { value: 'parents', label: 'Parents Only' },
              { value: 'teachers', label: 'Teachers Only' },
            ]} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="gradeLevel" label="Grade Level (optional)">
            <Select
              allowClear
              placeholder="All grades"
              options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item name="priority" label="Priority" initialValue="normal">
            <Select options={[
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="publishedAt" label="Publish Date">
            <DatePicker style={{ width: '100%' }} showTime format="DD/MM/YYYY HH:mm" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="expiresAt" label="Expiry Date">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="isPinned" label="Pin to top" valuePropName="checked" initialValue={false}>
        <Switch />
      </Form.Item>
    </Form>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Bell size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Announcements</Title>
          </Space>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            New Announcement
          </Button>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={announcements}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          locale={{ emptyText: 'No announcements yet.' }}
        />
      </Card>

      <Modal
        title={<Space><Bell size={16} /> New Announcement</Space>}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.validateFields().then((v) => createMutation.mutate(v))}
        confirmLoading={createMutation.isPending}
        okText="Post"
        width={600}
      >
        {announcementForm}
      </Modal>
    </div>
  )
}

export default AnnouncementsAdminPage
