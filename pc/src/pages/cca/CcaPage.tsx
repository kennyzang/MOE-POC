import { useState } from 'react'
import {
  Card, Row, Col, Button, Tag, Typography, Space, Modal, Form, Input, Select,
  InputNumber, Drawer, Table, message, Badge, Alert, Statistic,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, Plus, Users, MapPin, Clock, Loader } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const { Title, Text } = Typography

interface CcaActivity {
  id: string
  name: string
  category: string
  description: string | null
  schedule: string | null
  venue: string | null
  teacherName: string | null
  capacity: number
  enrolled: number
  status: string
}

interface Member {
  id: string
  studentId: string
  student: { user: { displayName: string }; gradeLevel: string | null; className: string | null }
}

const CATEGORY_COLOR: Record<string, string> = {
  sports: 'blue', arts: 'purple', academic: 'green', community: 'orange', other: 'default',
}

const CATEGORY_ICON: Record<string, string> = {
  sports: '⚽', arts: '🎨', academic: '📚', community: '🤝', other: '⭐',
}

const CcaPage = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const isStaff = ['admin', 'manager', 'teacher', 'hod', 'principal'].includes(user?.role ?? '')
  const isStudent = user?.role === 'student'

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCca, setSelectedCca] = useState<CcaActivity | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [form] = Form.useForm()

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['cca-activities'],
    queryFn: async () => {
      const { data } = await api.get('/cca')
      return data.data as CcaActivity[]
    },
  })

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ['my-cca'],
    queryFn: async () => {
      if (!isStudent) return []
      const { data } = await api.get('/cca/student/me')
      return data.data as Array<{ ccaId: string }>
    },
    enabled: isStudent,
  })

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['cca-members', selectedCca?.id],
    queryFn: async () => {
      if (!selectedCca) return []
      const { data } = await api.get(`/cca/${selectedCca.id}/members`)
      return data.data as Member[]
    },
    enabled: !!selectedCca && membersOpen,
  })

  const enrolledIds = new Set(myEnrollments.map((e) => e.ccaId))

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      await api.post('/cca', values)
    },
    onSuccess: () => {
      message.success('Activity created')
      setCreateOpen(false)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['cca-activities'] })
    },
  })

  const enrollMutation = useMutation({
    mutationFn: async (ccaId: string) => {
      await api.post(`/cca/${ccaId}/enroll`)
    },
    onSuccess: () => {
      message.success('Enrolled successfully!')
      void queryClient.invalidateQueries({ queryKey: ['cca-activities'] })
      void queryClient.invalidateQueries({ queryKey: ['my-cca'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      message.error(msg ?? 'Could not enroll')
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: async ({ ccaId, studentId }: { ccaId: string; studentId: string }) => {
      await api.delete(`/cca/${ccaId}/enroll/${studentId}`)
    },
    onSuccess: () => {
      message.success('Withdrawn')
      void queryClient.invalidateQueries({ queryKey: ['cca-activities'] })
      void queryClient.invalidateQueries({ queryKey: ['my-cca'] })
    },
  })

  const memberColumns: ColumnsType<Member> = [
    {
      title: 'Student',
      render: (_, r) => (
        <div>
          <Text>{r.student.user.displayName}</Text>
          <div style={{ fontSize: 12, color: '#888' }}>{r.student.gradeLevel} {r.student.className}</div>
        </div>
      ),
    },
  ]

  if (isStudent) {
    // Student view: simple enrollment UI
    const myActivities = activities.filter((a) => enrolledIds.has(a.id))
    const available = activities.filter((a) => !enrolledIds.has(a.id))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <Space>
            <Award size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Co-Curricular Activities</Title>
          </Space>
        </Card>

        {myActivities.length > 0 && (
          <Card title={<Space><Badge status="success" />My Activities</Space>}>
            <Row gutter={[12, 12]}>
              {myActivities.map((a) => (
                <Col xs={24} sm={12} md={8} key={a.id}>
                  <Card size="small" style={{ borderLeft: '4px solid #52c41a' }}>
                    <div style={{ fontWeight: 600 }}>{CATEGORY_ICON[a.category] ?? '⭐'} {a.name}</div>
                    {a.schedule && <div style={{ fontSize: 12, color: '#888' }}><Clock size={10} /> {a.schedule}</div>}
                    {a.venue && <div style={{ fontSize: 12, color: '#888' }}><MapPin size={10} /> {a.venue}</div>}
                    <Tag color={CATEGORY_COLOR[a.category]} style={{ marginTop: 4 }}>{a.category}</Tag>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        <Card title="Available Activities">
          {available.length === 0 ? (
            <Alert type="info" showIcon message="You are enrolled in all available activities, or no activities are currently open." />
          ) : (
            <Row gutter={[12, 12]}>
              {available.map((a) => (
                <Col xs={24} sm={12} md={8} key={a.id}>
                  <Card
                    size="small"
                    actions={[
                      a.enrolled < a.capacity ? (
                        <Button
                          type="primary"
                          size="small"
                          loading={enrollMutation.isPending}
                          onClick={() => enrollMutation.mutate(a.id)}
                        >
                          Enroll
                        </Button>
                      ) : (
                        <Tag color="red">Full</Tag>
                      ),
                    ]}
                  >
                    <div style={{ fontWeight: 600 }}>{CATEGORY_ICON[a.category] ?? '⭐'} {a.name}</div>
                    {a.description && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{a.description}</div>}
                    {a.schedule && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}><Clock size={10} /> {a.schedule}</div>}
                    {a.venue && <div style={{ fontSize: 12, color: '#888' }}><MapPin size={10} /> {a.venue}</div>}
                    {a.teacherName && <div style={{ fontSize: 12, color: '#888' }}>Teacher: {a.teacherName}</div>}
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      <Tag color={CATEGORY_COLOR[a.category]}>{a.category}</Tag>
                      <Tag color={a.enrolled >= a.capacity ? 'red' : 'green'}>
                        {a.enrolled}/{a.capacity} enrolled
                      </Tag>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      </div>
    )
  }

  // Staff / Admin view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Award size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Co-Curricular Activities</Title>
          </Space>
          {isStaff && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Create Activity
            </Button>
          )}
        </div>
      </Card>

      <Row gutter={[12, 12]}>
        {isLoading ? null : activities.map((a) => (
          <Col xs={24} sm={12} md={8} key={a.id}>
            <Card
              size="small"
              actions={[
                <Button
                  key="members"
                  type="link"
                  icon={<Users size={12} />}
                  onClick={() => { setSelectedCca(a); setMembersOpen(true) }}
                >
                  {a.enrolled} members
                </Button>,
              ]}
            >
              <div style={{ fontWeight: 600, fontSize: 15 }}>{CATEGORY_ICON[a.category] ?? '⭐'} {a.name}</div>
              {a.description && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{a.description}</div>}
              <Space wrap style={{ marginTop: 8 }}>
                <Tag color={CATEGORY_COLOR[a.category]}>{a.category}</Tag>
                <Tag color={a.enrolled >= a.capacity ? 'red' : 'green'}>{a.enrolled}/{a.capacity}</Tag>
              </Space>
              {a.schedule && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}><Clock size={10} /> {a.schedule}</div>}
              {a.venue && <div style={{ fontSize: 12, color: '#888' }}><MapPin size={10} /> {a.venue}</div>}
              {a.teacherName && <div style={{ fontSize: 12, color: '#888' }}>In Charge: {a.teacherName}</div>}
            </Card>
          </Col>
        ))}
      </Row>

      {/* Create Modal */}
      <Modal
        title="Create CCA Activity"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.validateFields().then((v) => createMutation.mutate(v))}
        confirmLoading={createMutation.isPending}
        okText="Create"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Activity Name" rules={[{ required: true }]}>
            <Input placeholder="Basketball Club" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'sports', label: '⚽ Sports' },
                  { value: 'arts', label: '🎨 Arts' },
                  { value: 'academic', label: '📚 Academic' },
                  { value: 'community', label: '🤝 Community Service' },
                  { value: 'other', label: '⭐ Other' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="capacity" label="Capacity" initialValue={30}>
                <InputNumber min={1} max={200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="schedule" label="Schedule">
            <Input placeholder="Every Tuesday & Thursday 3–5 pm" />
          </Form.Item>
          <Form.Item name="venue" label="Venue">
            <Input placeholder="School Hall / Sports Court" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Brief description of the activity..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Members Drawer */}
      <Drawer
        title={selectedCca ? `${selectedCca.name} — Members (${selectedCca.enrolled}/${selectedCca.capacity})` : 'Members'}
        open={membersOpen}
        onClose={() => { setMembersOpen(false); setSelectedCca(null) }}
        width={400}
      >
        <Table
          columns={memberColumns}
          dataSource={members}
          rowKey="id"
          loading={membersLoading}
          size="small"
          pagination={false}
          locale={{ emptyText: 'No members enrolled yet.' }}
        />
      </Drawer>
    </div>
  )
}

export default CcaPage
