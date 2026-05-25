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
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  message,
  Tabs,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CalendarPlus } from 'lucide-react'
import api from '../../lib/api'
import type { Facility, FacilityBooking } from '../../types'

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

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  cancelled: 'red',
}

const FACILITY_TYPES = ['classroom', 'lab', 'hall', 'sports', 'office']
const FACILITY_STATUSES = ['available', 'occupied', 'maintenance']

const TIME_SLOT_OPTIONS = [
  { label: '08:00', value: '08:00' },
  { label: '09:00', value: '09:00' },
  { label: '09:30', value: '09:30' },
  { label: '10:00', value: '10:00' },
  { label: '11:00', value: '11:00' },
  { label: '11:30', value: '11:30' },
  { label: '12:00', value: '12:00' },
  { label: '13:00', value: '13:00' },
  { label: '14:00', value: '14:00' },
  { label: '14:30', value: '14:30' },
  { label: '15:00', value: '15:00' },
  { label: '16:00', value: '16:00' },
]

const SchoolResourcesPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['facility-bookings'],
    queryFn: async () => {
      const { data } = await api.get('/sms/facilities/bookings')
      return data.data as FacilityBooking[]
    },
  })

  const openBookingModal = (facility: Facility) => {
    setSelectedFacility(facility)
    form.resetFields()
    setBookingModalOpen(true)
  }

  const handleBook = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        facilityId: selectedFacility!.id,
        purpose: values.purpose,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime,
        endTime: values.endTime,
      }
      const { data } = await api.post('/sms/facilities/book', payload)
      if (data.success) {
        message.success(t('sms.bookingSuccess'))
        queryClient.invalidateQueries({ queryKey: ['facility-bookings'] })
        setBookingModalOpen(false)
        form.resetFields()
      } else {
        message.error(data.message ?? t('sms.bookingFailed'))
      }
    } catch {
      // form validation error
    } finally {
      setSubmitting(false)
    }
  }

  const facilityColumns: ColumnsType<Facility> = [
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
    {
      title: t('common.actions'),
      key: 'actions',
      width: 140,
      render: (_: unknown, record: Facility) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<CalendarPlus size={13} />}
          onClick={() => openBookingModal(record)}
        >
          {t('sms.bookFacility')}
        </Button>
      ),
    },
  ]

  const bookingColumns: ColumnsType<FacilityBooking> = [
    {
      title: t('sms.facilityName'),
      key: 'facility',
      render: (_: unknown, record: FacilityBooking) => record.facility?.name ?? record.facilityId,
    },
    {
      title: t('sms.bookingPurpose'),
      dataIndex: 'purpose',
      key: 'purpose',
    },
    {
      title: t('sms.bookingDate'),
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (val: string) => new Date(val).toLocaleDateString(),
    },
    {
      title: t('sms.bookingStartTime'),
      dataIndex: 'startTime',
      key: 'startTime',
      width: 100,
    },
    {
      title: t('sms.bookingEndTime'),
      dataIndex: 'endTime',
      key: 'endTime',
      width: 100,
    },
    {
      title: t('sms.bookingStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (val: string) => (
        <Tag color={BOOKING_STATUS_COLORS[val] ?? 'default'}>
          {t(`sms.${val}` as never, val)}
        </Tag>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'facilities',
      label: t('resources.title'),
      children: (
        <>
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

          <Card>
            <Table<Facility>
              rowKey="id"
              columns={facilityColumns}
              dataSource={facilities}
              loading={isLoading}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
              locale={{ emptyText: t('common.noData') }}
            />
          </Card>
        </>
      ),
    },
    {
      key: 'bookings',
      label: t('sms.facilityBookings'),
      children: (
        <Card>
          <Table<FacilityBooking>
            rowKey="id"
            columns={bookingColumns}
            dataSource={bookings}
            loading={bookingsLoading}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
            locale={{ emptyText: t('common.noData') }}
          />
        </Card>
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

      <Tabs items={tabItems} />

      {/* Book Facility Modal */}
      <Modal
        open={bookingModalOpen}
        title={`${t('sms.bookFacility')}${selectedFacility ? ` — ${selectedFacility.name}` : ''}`}
        onCancel={() => {
          form.resetFields()
          setBookingModalOpen(false)
        }}
        onOk={handleBook}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="purpose"
            label={t('sms.bookingPurpose')}
            rules={[{ required: true }]}
          >
            <Input placeholder={t('sms.bookingPurpose')} />
          </Form.Item>
          <Form.Item
            name="date"
            label={t('sms.bookingDate')}
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="startTime"
                label={t('sms.bookingStartTime')}
                rules={[{ required: true }]}
              >
                <Select options={TIME_SLOT_OPTIONS} placeholder={t('sms.bookingStartTime')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endTime"
                label={t('sms.bookingEndTime')}
                rules={[{ required: true }]}
              >
                <Select options={TIME_SLOT_OPTIONS} placeholder={t('sms.bookingEndTime')} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default SchoolResourcesPage
