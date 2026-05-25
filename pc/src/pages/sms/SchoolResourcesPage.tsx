import { useState } from 'react'
import {
  Table,
  Select,
  Tag,
  Card,
  Space,
  Row,
  Col,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import api from '../../lib/api'
import type { Facility } from '../../types'

const { Title } = Typography

const STATUS_TAG_COLORS: Record<string, string> = {
  available: 'green',
  occupied: 'blue',
  maintenance: 'orange',
}

const TYPE_TAG_COLORS: Record<string, string> = {
  classroom: 'cyan',
  lab: 'purple',
  hall: 'geekblue',
  sports: 'lime',
  office: 'gold',
}

const FACILITY_TYPES = ['classroom', 'lab', 'hall', 'sports', 'office']
const FACILITY_STATUSES = ['available', 'occupied', 'maintenance']

const SchoolResourcesPage = () => {
  const { t } = useTranslation()
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['facilities', typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await api.get(`/facilities?${params}`)
      return data.data as Facility[]
    },
  })

  const columns: ColumnsType<Facility> = [
    {
      title: t('resources.facilityName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('resources.type'),
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (val: string) => (
        <Tag color={TYPE_TAG_COLORS[val] ?? 'default'}>
          {t(`resources.${val}` as never, val)}
        </Tag>
      ),
    },
    {
      title: t('resources.capacity'),
      dataIndex: 'capacity',
      key: 'capacity',
      width: 100,
      align: 'center',
      render: (val: number | null) => val ?? '-',
    },
    {
      title: t('resources.location'),
      dataIndex: 'location',
      key: 'location',
      width: 180,
    },
    {
      title: t('resources.facilityStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (val: string) => (
        <Tag color={STATUS_TAG_COLORS[val] ?? 'default'}>
          {t(`resources.${val}` as never, val)}
        </Tag>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <Building2 size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('resources.title')}
            </Title>
            <Tag>{t('common.total')}: {facilities.length}</Tag>
          </Space>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t('resources.allTypes')}
              allowClear
              style={{ width: '100%' }}
              value={typeFilter || undefined}
              onChange={(val) => setTypeFilter(val ?? '')}
              options={FACILITY_TYPES.map((ft) => ({
                label: t(`resources.${ft}` as never, ft),
                value: ft,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t('resources.allStatus')}
              allowClear
              style={{ width: '100%' }}
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val ?? '')}
              options={FACILITY_STATUSES.map((fs) => ({
                label: t(`resources.${fs}` as never, fs),
                value: fs,
              }))}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table<Facility>
          rowKey="id"
          columns={columns}
          dataSource={facilities}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>
    </div>
  )
}

export default SchoolResourcesPage
