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
  Popover,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Award, Paperclip } from 'lucide-react'
import api from '../../lib/api'
import type { Certification, Teacher } from '../../types'
import FileUploader from '../../components/FileUploader'
import FileList from '../../components/FileList'

const { Title } = Typography

const STATUS_TAG_COLORS: Record<string, string> = {
  active: 'green',
  expired: 'red',
  expiring: 'orange',
}

const CertificationsPage = () => {
  const { t } = useTranslation()
  const [teacherId, setTeacherId] = useState<string>('')

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data } = await api.get('/teachers')
      return data.data as Teacher[]
    },
  })

  const { data: certifications = [], isLoading } = useQuery({
    queryKey: ['certifications', teacherId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (teacherId) params.set('teacherId', teacherId)
      const { data } = await api.get(`/certifications?${params}`)
      return data.data as Certification[]
    },
  })

  const getStatus = (cert: Certification): string => {
    if (cert.status === 'expired') return 'expired'
    if (cert.status === 'active' && cert.expiryDate) {
      const expiry = new Date(cert.expiryDate)
      const now = new Date()
      const sixMonths = new Date()
      sixMonths.setMonth(sixMonths.getMonth() + 6)
      if (expiry <= now) return 'expired'
      if (expiry <= sixMonths) return 'expiring'
    }
    return cert.status
  }

  const columns: ColumnsType<Certification> = [
    {
      title: t('certifications.certName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('courses.teacher'),
      key: 'teacher',
      render: (_, record) => record.teacher?.user?.displayName ?? '-',
    },
    {
      title: t('certifications.issuedBy'),
      dataIndex: 'issuedBy',
      key: 'issuedBy',
    },
    {
      title: t('certifications.issuedDate'),
      dataIndex: 'issuedDate',
      key: 'issuedDate',
      width: 130,
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : '-'),
    },
    {
      title: t('certifications.expiryDate'),
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      width: 130,
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : '-'),
    },
    {
      title: t('certifications.certStatus'),
      key: 'status',
      width: 140,
      render: (_, record) => {
        const s = getStatus(record)
        return (
          <Tag color={STATUS_TAG_COLORS[s] ?? 'default'}>
            {t(`certifications.${s === 'expiring' ? 'expiringSoon' : s}` as never, s)}
          </Tag>
        )
      },
    },
    {
      title: 'Documents',
      key: 'documents',
      width: 200,
      render: (_, record) => (
        <Popover
          trigger="click"
          title="Certification Documents"
          content={
            <div style={{ width: 320 }}>
              <div style={{ marginBottom: 8 }}>
                <FileUploader entityType="certification" entityId={record.id} accept=".pdf,.jpg,.jpeg,.png" label="Attach Document" />
              </div>
              <FileList entityType="certification" entityId={record.id} canDelete />
            </div>
          }
        >
          <Space style={{ cursor: 'pointer', color: '#1677ff', fontSize: 13 }}>
            <Paperclip size={13} />
            Files
          </Space>
        </Popover>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <Award size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('certifications.title')}
            </Title>
            <Tag>{t('common.total')}: {certifications.length}</Tag>
          </Space>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t('certifications.allTeachers')}
              allowClear
              style={{ width: '100%' }}
              value={teacherId || undefined}
              onChange={(val) => setTeacherId(val ?? '')}
              options={teachers.map((tc) => ({
                label: tc.user?.displayName ?? tc.staffId,
                value: tc.id,
              }))}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table<Certification>
          rowKey="id"
          columns={columns}
          dataSource={certifications}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>
    </div>
  )
}

export default CertificationsPage
