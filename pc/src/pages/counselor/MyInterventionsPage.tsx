import { useState } from 'react'
import {
  Card, Table, Tag, Button, Space, Typography, Input, Form, Modal, Descriptions, message,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, CheckCheck } from 'lucide-react'
import dayjs from 'dayjs'
import api from '@/lib/api'

const { Title, Text } = Typography
const { TextArea } = Input

interface Intervention {
  id: string
  title: string
  description: string | null
  category: string | null
  dueDate: string | null
  status: string
  resultNotes: string | null
  closedAt: string | null
  createdAt: string
  caseId: string
  studentName: string
  caseStatus: string
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'default',
  IN_PROGRESS: 'processing',
  DONE: 'success',
}

const MyInterventionsPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedItem, setSelectedItem] = useState<Intervention | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const { data: items, isLoading } = useQuery({
    queryKey: ['my-interventions'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Intervention[] }>(
        '/counselor/my-interventions',
      )
      return data.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, resultNotes }: { id: string; status?: string; resultNotes?: string }) =>
      (await api.patch(`/counselor/interventions/${id}`, { status, resultNotes })).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-interventions'] })
      message.success('Intervention updated')
      setModalOpen(false)
      setSelectedItem(null)
    },
    onError: () => message.error('Failed to update'),
  })

  const openUpdateModal = (item: Intervention) => {
    setSelectedItem(item)
    form.setFieldsValue({ resultNotes: item.resultNotes ?? '' })
    setModalOpen(true)
  }

  const handleMarkInProgress = (item: Intervention) => {
    updateMutation.mutate({ id: item.id, status: 'IN_PROGRESS' })
  }

  const handleSubmitResult = (vals: { resultNotes: string }) => {
    if (!selectedItem) return
    updateMutation.mutate({
      id: selectedItem.id,
      status: 'DONE',
      resultNotes: vals.resultNotes,
    })
  }

  const pending = items?.filter((i) => i.status !== 'DONE') ?? []
  const completed = items?.filter((i) => i.status === 'DONE') ?? []

  const columns = [
    {
      title: 'Intervention',
      dataIndex: 'title',
      render: (title: string, row: Intervention) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{title}</Text>
          {row.category && (
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Category: {row.category}</div>
          )}
          {row.description && (
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{row.description}</div>
          )}
          {row.resultNotes && (
            <div style={{ fontSize: 11, color: '#52c41a', marginTop: 2, fontStyle: 'italic' }}>
              Result: {row.resultNotes}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Student',
      dataIndex: 'studentName',
      width: 160,
      render: (name: string) => <Text style={{ fontSize: 13 }}>{name}</Text>,
    },
    {
      title: 'Due',
      dataIndex: 'dueDate',
      width: 110,
      render: (v: string | null, row: Intervention) => {
        if (!v) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        const overdue = dayjs(v).isBefore(dayjs()) && row.status !== 'DONE'
        return (
          <Text type={overdue ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
            {dayjs(v).format('DD MMM YYYY')}
          </Text>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s: string) => (
        <Tag color={STATUS_COLOR[s]} style={{ fontSize: 11 }}>
          {s.replace('_', ' ')}
        </Tag>
      ),
    },
    {
      title: '',
      width: 180,
      render: (_: unknown, row: Intervention) =>
        row.status !== 'DONE' ? (
          <Space size={4}>
            {row.status === 'OPEN' && (
              <Button
                size="small"
                onClick={() => handleMarkInProgress(row)}
                loading={updateMutation.isPending}
              >
                Start
              </Button>
            )}
            <Button
              size="small"
              type="primary"
              icon={<CheckCheck size={12} />}
              onClick={() => openUpdateModal(row)}
            >
              Submit Result
            </Button>
          </Space>
        ) : (
          <Button size="small" type="link" onClick={() => openUpdateModal(row)}>
            View result
          </Button>
        ),
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <ClipboardList size={16} />
          <Title level={4} style={{ margin: 0 }}>
            {t('counselor.myInterventions', { defaultValue: 'My Assigned Interventions' })}
          </Title>
        </Space>
        <div style={{ marginTop: 4, color: '#8c8c8c', fontSize: 13 }}>
          Interventions assigned to you by the counseling team. Update your progress and submit results here.
        </div>
      </Card>

      {pending.length > 0 && (
        <Card
          style={{ marginBottom: 16 }}
          title={<Space><Tag color="orange">Pending</Tag><Text>{pending.length} open</Text></Space>}
          size="small"
        >
          <Table
            dataSource={pending}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={false}
            size="middle"
          />
        </Card>
      )}

      {completed.length > 0 && (
        <Card
          title={<Space><Tag color="success">Completed</Tag><Text>{completed.length} done</Text></Space>}
          size="small"
        >
          <Table
            dataSource={completed}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            size="middle"
          />
        </Card>
      )}

      {!isLoading && !items?.length && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
            <ClipboardList size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div>No interventions assigned to you yet.</div>
          </div>
        </Card>
      )}

      {/* Update / result modal */}
      <Modal
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setSelectedItem(null) }}
        title={selectedItem?.status === 'DONE' ? 'Intervention Result' : 'Submit Intervention Result'}
        footer={
          selectedItem?.status !== 'DONE' ? (
            <Space>
              <Button onClick={() => { setModalOpen(false); setSelectedItem(null) }}>Cancel</Button>
              <Button
                type="primary"
                icon={<CheckCheck size={13} />}
                loading={updateMutation.isPending}
                onClick={() => form.submit()}
              >
                Mark Done & Submit
              </Button>
            </Space>
          ) : (
            <Button onClick={() => { setModalOpen(false); setSelectedItem(null) }}>Close</Button>
          )
        }
        destroyOnClose
      >
        {selectedItem && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Intervention">{selectedItem.title}</Descriptions.Item>
              <Descriptions.Item label="Student">{selectedItem.studentName}</Descriptions.Item>
              {selectedItem.category && (
                <Descriptions.Item label="Category">{selectedItem.category}</Descriptions.Item>
              )}
              {selectedItem.description && (
                <Descriptions.Item label="Instructions">{selectedItem.description}</Descriptions.Item>
              )}
              {selectedItem.dueDate && (
                <Descriptions.Item label="Due date">
                  {dayjs(selectedItem.dueDate).format('DD MMM YYYY')}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLOR[selectedItem.status]}>{selectedItem.status.replace('_', ' ')}</Tag>
              </Descriptions.Item>
            </Descriptions>

            {selectedItem.status !== 'DONE' ? (
              <Form form={form} layout="vertical" onFinish={handleSubmitResult}>
                <Form.Item
                  name="resultNotes"
                  label="Result / what was done"
                  rules={[{ required: true, message: 'Please describe what you did' }]}
                >
                  <TextArea
                    rows={4}
                    placeholder="Describe what actions you took, the outcome, and any follow-up needed."
                  />
                </Form.Item>
              </Form>
            ) : (
              selectedItem.resultNotes && (
                <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <Text strong style={{ fontSize: 12 }}>Result: </Text>
                  <Text style={{ fontSize: 12 }}>{selectedItem.resultNotes}</Text>
                  {selectedItem.closedAt && (
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                      Completed {dayjs(selectedItem.closedAt).format('DD MMM YYYY')}
                    </div>
                  )}
                </Card>
              )
            )}
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default MyInterventionsPage
