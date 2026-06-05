import { useState } from 'react'
import {
  Card, Row, Col, Statistic, Typography, Tag, Button, Form, Input, Select,
  Space, Descriptions, Table, message, Spin,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, Check, X, School, Users, GraduationCap, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { AUTHORITY_META } from '../../hooks/useSchoolConfig'

const { Title, Text } = Typography
const { Option } = Select

interface SchoolData {
  id: string
  name: string
  code: string
  authority: string
  schoolType: string
  address: string | null
  phone: string | null
  principal: string | null
  establishedYear: number | null
  motto: string | null
}

interface SchoolStats {
  studentCount: number
  teachingStaffCount: number
  nonTeachingStaffCount: number
  facilityCount: number
}

interface Facility {
  id: string
  name: string
  type: string
  capacity: number | null
  location: string | null
  status: string
}

const SCHOOL_TYPES = ['primary', 'secondary', 'pre_university', 'vocational', 'religious_primary', 'religious_secondary', 'combined']

const FACILITY_STATUS_COLORS: Record<string, string> = {
  available: 'green',
  occupied: 'orange',
  maintenance: 'red',
}

export default function SchoolProfilePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [editMode, setEditMode] = useState(false)
  const [form] = Form.useForm()

  const schoolId = user?.schoolId

  const { data: school, isLoading } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: async () => {
      const { data } = await api.get<{ data: SchoolData }>(`/schools/${schoolId}`)
      return data.data
    },
    enabled: !!schoolId,
  })

  const { data: stats } = useQuery({
    queryKey: ['school-stats', schoolId],
    queryFn: async () => {
      const { data } = await api.get<{ data: SchoolStats }>(`/schools/${schoolId}/stats`)
      return data.data
    },
    enabled: !!schoolId,
  })

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Facility[] }>('/facilities')
      return data.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.put(`/schools/${schoolId}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school', schoolId] })
      message.success(t('schoolProfile.saved'))
      setEditMode(false)
    },
    onError: () => message.error(t('common.error')),
  })

  const handleEdit = () => {
    if (!school) return
    form.setFieldsValue({
      name: school.name,
      address: school.address ?? '',
      phone: school.phone ?? '',
      principal: school.principal ?? '',
      motto: school.motto ?? '',
      schoolType: school.schoolType,
    })
    setEditMode(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    updateMutation.mutate(values)
  }

  const facilityColumns: ColumnsType<Facility> = [
    { title: t('resources.facilityName'), dataIndex: 'name', ellipsis: true },
    { title: t('resources.type'), dataIndex: 'type', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('resources.capacity'), dataIndex: 'capacity', width: 90, render: (v: number | null) => v ?? '—' },
    { title: t('resources.location'), dataIndex: 'location', render: (v: string | null) => v ?? '—' },
    {
      title: t('common.status'), dataIndex: 'status', width: 130,
      render: (v: string) => (
        <Tag color={FACILITY_STATUS_COLORS[v] ?? 'default'}>
          {t(`resources.${v === 'maintenance' ? 'maintenance' : v}`, { defaultValue: v })}
        </Tag>
      ),
    },
    {
      title: '',
      width: 80,
      render: () => (
        <Button size="small" type="link" onClick={() => navigate('/sms/resources')}>
          {t('schoolProfile.bookLink')}
        </Button>
      ),
    },
  ]

  if (isLoading || !school) {
    return <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>
  }

  const authorityMeta = AUTHORITY_META[school.authority] ?? { color: '#888', label: school.authority }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <School size={26} color="#1677ff" />
        <Title level={3} style={{ margin: 0 }}>{school.name}</Title>
        <Tag color={authorityMeta.color} style={{ fontSize: 12, fontWeight: 600 }}>{school.authority}</Tag>
        <Tag>{school.code}</Tag>
      </div>

      {/* Stats row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t('schoolProfile.totalStudents')}
              value={stats?.studentCount ?? '—'}
              prefix={<Users size={16} style={{ marginRight: 4 }} />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t('schoolProfile.teachingStaff')}
              value={stats?.teachingStaffCount ?? '—'}
              prefix={<GraduationCap size={16} style={{ marginRight: 4 }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t('schoolProfile.supportStaff')}
              value={stats?.nonTeachingStaffCount ?? '—'}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title={t('schoolProfile.facilities')}
              value={stats?.facilityCount ?? facilities.length}
              prefix={<Building2 size={16} style={{ marginRight: 4 }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* School Info Card */}
      <Card
        title={t('schoolProfile.schoolInfo')}
        style={{ marginBottom: 24 }}
        extra={
          !editMode ? (
            <Button icon={<Edit2 size={14} />} size="small" onClick={handleEdit}>
              {t('common.edit')}
            </Button>
          ) : (
            <Space>
              <Button size="small" icon={<X size={14} />} onClick={() => setEditMode(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" size="small" icon={<Check size={14} />} onClick={handleSave} loading={updateMutation.isPending}>
                {t('common.save')}
              </Button>
            </Space>
          )
        }
      >
        {editMode ? (
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="name" label={t('schoolProfile.name')} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="principal" label={t('schoolProfile.principal')}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="address" label={t('common.address')}>
              <Input.TextArea rows={2} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="phone" label={t('common.phone')}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="schoolType" label={t('schoolProfile.schoolType')}>
                  <Select>
                    {SCHOOL_TYPES.map(st => (
                      <Option key={st} value={st}>{t(`schoolProfile.type_${st}`, { defaultValue: st })}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="motto" label={t('schoolProfile.motto')}>
              <Input placeholder={t('schoolProfile.mottoPlaceholder')} />
            </Form.Item>
          </Form>
        ) : (
          <Descriptions column={2} size="small">
            <Descriptions.Item label={t('schoolProfile.principal')}>
              {school.principal ?? <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label={t('schoolProfile.schoolType')}>
              {t(`schoolProfile.type_${school.schoolType}`, { defaultValue: school.schoolType })}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.address')} span={2}>
              {school.address ?? <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.phone')}>
              {school.phone ?? <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label={t('schoolProfile.established')}>
              {school.establishedYear ?? <Text type="secondary">—</Text>}
            </Descriptions.Item>
            <Descriptions.Item label={t('schoolProfile.motto')} span={2}>
              {school.motto
                ? <Text italic>"{school.motto}"</Text>
                : <Text type="secondary">—</Text>}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      {/* Facilities Card */}
      <Card title={t('schoolProfile.facilitiesCard')}>
        <Table<Facility>
          dataSource={facilities}
          columns={facilityColumns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Card>
    </div>
  )
}
