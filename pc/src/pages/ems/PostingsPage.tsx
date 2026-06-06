import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Tag, Typography, Space, Button, Modal, Form, Input, DatePicker, Select, Checkbox, message } from 'antd'
import { Briefcase, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Text } = Typography

interface PostingRecord {
  id: string
  teacherId: string
  teacherName: string
  schoolName: string
  position: string
  department: string | null
  startDate: string
  endDate: string | null
  isCurrent: boolean
  notes: string | null
}

interface TeacherOption {
  id: string
  displayName: string
}

const PostingsPage = () => {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [filterTeacher, setFilterTeacher] = useState<string | undefined>()
  const [form] = Form.useForm()

  const canWrite = ['admin', 'manager', 'principal'].includes(user?.role ?? '')

  const { data: postings = [], isLoading } = useQuery<PostingRecord[]>({
    queryKey: ['postings', filterTeacher],
    queryFn: async () => {
      const { data } = await api.get('/postings', { params: filterTeacher ? { teacherId: filterTeacher } : {} })
      return data.data
    },
  })

  const { data: teachers = [] } = useQuery<TeacherOption[]>({
    queryKey: ['teachers-simple'],
    queryFn: async () => {
      const { data } = await api.get('/ems/teachers')
      return (data.data ?? []).map((t: any) => ({ id: t.id, displayName: t.displayName ?? t.name }))
    },
    enabled: canWrite,
  })

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate ? values.endDate.toISOString() : undefined,
        isCurrent: values.isCurrent ?? false,
      }
      const { data } = await api.post('/postings', payload)
      return data
    },
    onSuccess: () => {
      message.success('Posting record created')
      qc.invalidateQueries({ queryKey: ['postings'] })
      setModalOpen(false)
      form.resetFields()
    },
    onError: () => message.error('Failed to create posting record'),
  })

  const columns = [
    {
      title: 'Teacher',
      key: 'teacher',
      render: (_: unknown, r: PostingRecord) => <Text strong>{r.teacherName}</Text>,
    },
    {
      title: 'School',
      dataIndex: 'schoolName',
      key: 'schoolName',
    },
    {
      title: 'Position',
      key: 'position',
      render: (_: unknown, r: PostingRecord) => (
        <div>
          <div>{r.position}</div>
          {r.department && <Text type="secondary" style={{ fontSize: 12 }}>{r.department}</Text>}
        </div>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (v: string) => dayjs(v).format('D MMM YYYY'),
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (v: string | null) => v ? dayjs(v).format('D MMM YYYY') : <Text type="secondary">Present</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, r: PostingRecord) => (
        <Tag color={r.isCurrent ? 'green' : 'default'}>{r.isCurrent ? 'Current' : 'Past'}</Tag>
      ),
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      render: (v: string | null) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : null,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Briefcase size={22} style={{ color: '#165DFF' }} />
            <Typography.Title level={3} style={{ margin: 0 }}>Teacher Postings History</Typography.Title>
          </Space>
          {canWrite && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
              Add Posting Record
            </Button>
          )}
        </Space>
      </Card>

      <Card
        extra={
          <Select
            placeholder="Filter by teacher"
            allowClear
            value={filterTeacher}
            onChange={setFilterTeacher}
            options={teachers.map(t => ({ value: t.id, label: t.displayName }))}
            style={{ width: 220 }}
          />
        }
        title={<Space><Briefcase size={16} /> Posting Records</Space>}
      >
        <Table<PostingRecord>
          rowKey="id"
          loading={isLoading}
          dataSource={postings}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="Add Posting Record"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
      >
        <Form form={form} layout="vertical" onFinish={v => createMutation.mutate(v)}>
          <Form.Item name="teacherId" label="Teacher" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select teacher"
              options={teachers.map(t => ({ value: t.id, label: t.displayName }))}
              filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="schoolName" label="School Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="position" label="Position" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department" label="Department">
            <Input />
          </Form.Item>
          <Form.Item name="startDate" label="Start Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endDate" label="End Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isCurrent" valuePropName="checked">
            <Checkbox>Current posting</Checkbox>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PostingsPage
