import { useState } from 'react'
import {
  Card, Row, Col, Table, Tag, Button, Modal, Form, Input, Select,
  DatePicker, Statistic, Space, Typography, Popconfirm, Spin, Empty,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Award, Plus, Pencil, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography
const { TextArea } = Input

// ─── Types ────────────────────────────────────────────────────────

interface AwardRecord {
  id: string
  teacherId: string
  teacherName: string
  department: string | null
  title: string
  category: string
  description: string | null
  awardedDate: string
  awardedBy: string | null
  badgeColor: string
}

interface AwardStats {
  total: number
  thisYear: number
  byCategory: { category: string; count: number }[]
  topRecipients: { teacherId: string; teacherName: string; count: number }[]
}

interface TeacherOption {
  id: string
  displayName: string
  staffId: string
}

// ─── Helpers ─────────────────────────────────────────────────────

const CATEGORIES = ['EXCELLENCE', 'SERVICE', 'INNOVATION', 'LEADERSHIP', 'COMMUNITY', 'OTHER']
const BADGE_COLORS: Record<string, string> = {
  gold: '#faad14', silver: '#8c8c8c', bronze: '#d46b08',
  blue: '#1677ff', green: '#52c41a', purple: '#722ed1',
}
const CATEGORY_COLORS: Record<string, string> = {
  EXCELLENCE: '#faad14', SERVICE: '#1677ff', INNOVATION: '#52c41a',
  LEADERSHIP: '#722ed1', COMMUNITY: '#13c2c2', OTHER: '#8c8c8c',
}

function AwardBadge({ color, title }: { color: string; title: string }) {
  return (
    <Space size={6}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: BADGE_COLORS[color] ?? '#8c8c8c',
        flexShrink: 0, border: '2px solid rgba(0,0,0,.08)',
      }} />
      <Text>{title}</Text>
    </Space>
  )
}

// ─── Award form modal ─────────────────────────────────────────────

function AwardFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean; onClose: () => void; editing: AwardRecord | null
}) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: teachers = [] } = useQuery<TeacherOption[]>({
    queryKey: ['teacherOptions'],
    queryFn: async () => {
      const r = await api.get('/teachers?limit=200')
      return (r.data.data ?? []).map((t: { id: string; user?: { displayName?: string }; staffId: string }) => ({
        id: t.id,
        displayName: t.user?.displayName ?? 'Unknown',
        staffId: t.staffId,
      }))
    },
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = {
        ...values,
        awardedDate: (values.awardedDate as dayjs.Dayjs).toISOString(),
      }
      if (editing) return api.put(`/awards/${editing.id}`, payload)
      return api.post('/awards', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staffAwards'] })
      qc.invalidateQueries({ queryKey: ['awardStats'] })
      onClose()
      form.resetFields()
    },
  })

  const initialValues = editing
    ? {
        ...editing,
        awardedDate: dayjs(editing.awardedDate),
        teacherId: editing.teacherId,
      }
    : { category: 'EXCELLENCE', badgeColor: 'gold' }

  return (
    <Modal
      open={open}
      onCancel={() => { onClose(); form.resetFields() }}
      title={
        <Space>
          <Award size={16} />
          {editing ? t('awards.editAward', 'Edit Award') : t('awards.addAward', 'Add Award')}
        </Space>
      }
      footer={null}
      width={520}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={v => mutation.mutate(v as Record<string, unknown>)}
        style={{ marginTop: 16 }}
      >
        {!editing && (
          <Form.Item name="teacherId" label={t('awards.teacher', 'Teacher')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={teachers.map(t => ({ value: t.id, label: `${t.displayName} (${t.staffId})` }))}
              placeholder={t('awards.selectTeacher', 'Select teacher...')}
            />
          </Form.Item>
        )}

        <Form.Item name="title" label={t('awards.title', 'Award Title')} rules={[{ required: true }]}>
          <Input maxLength={120} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="category" label={t('awards.category', 'Category')} rules={[{ required: true }]}>
              <Select>
                {CATEGORIES.map(c => (
                  <Select.Option key={c} value={c}>
                    <Tag color={CATEGORY_COLORS[c]} style={{ marginRight: 4 }}>{c}</Tag>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="badgeColor" label={t('awards.badgeColor', 'Badge')} rules={[{ required: true }]}>
              <Select>
                {Object.keys(BADGE_COLORS).map(c => (
                  <Select.Option key={c} value={c}>
                    <Space size={6}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: BADGE_COLORS[c], display: 'inline-block' }} />
                      {c}
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="awardedDate" label={t('awards.date', 'Awarded Date')} rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="awardedBy" label={t('awards.awardedBy', 'Awarded By')}>
              <Input placeholder="MOE Brunei" maxLength={100} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label={t('awards.description', 'Description (optional)')}>
          <TextArea rows={2} maxLength={300} showCount />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => { onClose(); form.resetFields() }}>{t('common.cancel', 'Cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              {editing ? t('common.save', 'Save') : t('awards.add', 'Add Award')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────

export default function StaffAwardsPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const role = user?.role ?? ''
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AwardRecord | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()

  const canManage = ['admin', 'manager', 'principal', 'hod'].includes(role)
  const canDelete = ['admin', 'manager'].includes(role)

  const { data: awards = [], isLoading } = useQuery<AwardRecord[]>({
    queryKey: ['staffAwards', categoryFilter],
    queryFn: async () => {
      const params = categoryFilter ? `?category=${categoryFilter}` : ''
      const r = await api.get(`/awards${params}`)
      return r.data.data as AwardRecord[]
    },
  })

  const { data: stats } = useQuery<AwardStats>({
    queryKey: ['awardStats'],
    queryFn: async () => {
      const r = await api.get('/awards/stats')
      return r.data.data as AwardStats
    },
    enabled: canManage,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/awards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staffAwards'] })
      qc.invalidateQueries({ queryKey: ['awardStats'] })
    },
  })

  const columns: ColumnsType<AwardRecord> = [
    {
      title: t('awards.award', 'Award'),
      key: 'award',
      render: (_, r) => <AwardBadge color={r.badgeColor} title={r.title} />,
    },
    {
      title: t('common.teacher', 'Teacher'),
      key: 'teacher',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.teacherName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.department ?? '—'}</Text>
        </Space>
      ),
    },
    {
      title: t('awards.category', 'Category'),
      dataIndex: 'category',
      key: 'category',
      render: v => <Tag color={CATEGORY_COLORS[v] ?? 'default'}>{v}</Tag>,
      filters: CATEGORIES.map(c => ({ text: c, value: c })),
      onFilter: (v, r) => r.category === v,
    },
    {
      title: t('awards.date', 'Date'),
      dataIndex: 'awardedDate',
      key: 'awardedDate',
      render: v => dayjs(v).format('D MMM YYYY'),
      sorter: (a, b) => new Date(a.awardedDate).getTime() - new Date(b.awardedDate).getTime(),
    },
    { title: t('awards.awardedBy', 'By'), dataIndex: 'awardedBy', key: 'awardedBy', render: v => v ?? '—' },
    ...(canManage ? [{
      title: t('common.actions', 'Actions'),
      key: 'actions',
      width: 100,
      render: (_: unknown, r: AwardRecord) => (
        <Space>
          <Button
            size="small" icon={<Pencil size={12} />}
            onClick={() => { setEditing(r); setModalOpen(true) }}
          />
          {canDelete && (
            <Popconfirm
              title={t('awards.deleteConfirm', 'Delete this award?')}
              onConfirm={() => deleteMutation.mutate(r.id)}
              okText={t('common.yes', 'Yes')}
              cancelText={t('common.no', 'No')}
            >
              <Button size="small" danger icon={<Trash2 size={12} />} loading={deleteMutation.isPending} />
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ]

  const chartData = (stats?.byCategory ?? []).map(c => ({
    name: c.category,
    count: c.count,
    fill: CATEGORY_COLORS[c.category] ?? '#8c8c8c',
  }))

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <Award size={20} />
            <Title level={4} style={{ margin: 0 }}>{t('awards.title_page', 'Awards & Recognition')}</Title>
          </Space>
        </Col>
        {canManage && (
          <Col>
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => { setEditing(null); setModalOpen(true) }}
            >
              {t('awards.add', 'Add Award')}
            </Button>
          </Col>
        )}
      </Row>

      {/* Stats + Chart */}
      {canManage && stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8} md={4}>
            <Card bordered={false} style={{ borderRadius: 12, background: '#fffbe6' }}>
              <Statistic
                title={t('awards.totalAwards', 'Total Awards')}
                value={stats.total}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Card bordered={false} style={{ borderRadius: 12, background: '#f6ffed' }}>
              <Statistic
                title={t('awards.thisYear', 'This Year')}
                value={stats.thisYear}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card
              bordered={false}
              style={{ borderRadius: 12 }}
              title={t('awards.byCategory', 'By Category')}
              size="small"
            >
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={chartData} barSize={20}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Text type="secondary">{t('common.noData', 'No data')}</Text>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* Awards table */}
      <Card
        bordered={false}
        style={{ borderRadius: 12 }}
        extra={
          <Select
            allowClear
            placeholder={t('awards.filterCategory', 'All Categories')}
            style={{ width: 160 }}
            value={categoryFilter}
            onChange={v => setCategoryFilter(v)}
          >
            {CATEGORIES.map(c => (
              <Select.Option key={c} value={c}>{c}</Select.Option>
            ))}
          </Select>
        }
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : awards.length === 0 ? (
          <Empty description={t('awards.noAwards', 'No awards recorded yet')} />
        ) : (
          <Table
            columns={columns}
            dataSource={awards}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 15 }}
            scroll={{ x: 700 }}
          />
        )}
      </Card>

      <AwardFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />
    </div>
  )
}
