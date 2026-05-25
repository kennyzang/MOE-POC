import { useState } from 'react'
import {
  Table,
  Input,
  Select,
  Tag,
  Modal,
  Descriptions,
  Card,
  Space,
  Row,
  Col,
  Button,
  Statistic,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Search, Eye, CheckCircle, XCircle } from 'lucide-react'
import api from '../../lib/api'
import type { Admission } from '../../types'

const STATUS_TAG_COLORS: Record<string, string> = {
  pending: 'orange',
  under_review: 'blue',
  accepted: 'green',
  rejected: 'red',
}

const AdmissionsPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [actionType, setActionType] = useState<'accepted' | 'rejected' | null>(null)
  const [remarks, setRemarks] = useState('')

  const { data: admissions = [], isLoading } = useQuery({
    queryKey: ['admissions', search, status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const { data } = await api.get(`/admissions?${params}`)
      return data.data as Admission[]
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string
      body: { status: string; remarks: string }
    }) => {
      const { data } = await api.patch(`/admissions/${id}`, body)
      return data
    },
    onSuccess: () => {
      message.success(t('common.success'))
      queryClient.invalidateQueries({ queryKey: ['admissions'] })
      setActionType(null)
      setRemarks('')
      setDetailOpen(false)
      setSelectedAdmission(null)
    },
    onError: () => {
      message.error(t('common.error'))
    },
  })

  // Compute stats from data
  const totalCount = admissions.length
  const pendingCount = admissions.filter(
    (a) => a.status === 'pending' || a.status === 'under_review'
  ).length
  const acceptedCount = admissions.filter((a) => a.status === 'accepted').length
  const rejectedCount = admissions.filter((a) => a.status === 'rejected').length

  const handleReview = (admission: Admission) => {
    setSelectedAdmission(admission)
    setDetailOpen(true)
    setActionType(null)
    setRemarks('')
  }

  const handleConfirmAction = () => {
    if (!selectedAdmission || !actionType) return
    updateMutation.mutate({
      id: selectedAdmission.id,
      body: { status: actionType, remarks },
    })
  }

  const statusLabel = (val: string) => {
    const keyMap: Record<string, string> = {
      pending: 'admissions.statusPending',
      under_review: 'admissions.statusUnderReview',
      accepted: 'admissions.statusAccepted',
      rejected: 'admissions.statusRejected',
    }
    return t(keyMap[val] ?? val)
  }

  const columns: ColumnsType<Admission> = [
    {
      title: t('admissions.applicantName'),
      dataIndex: 'applicantName',
      key: 'applicantName',
    },
    {
      title: t('students.gender'),
      dataIndex: 'gender',
      key: 'gender',
      width: 100,
      render: (val: string) =>
        val === 'male'
          ? t('students.male')
          : val === 'female'
            ? t('students.female')
            : val ?? '-',
    },
    {
      title: t('admissions.gradeApplied'),
      dataIndex: 'gradeApplied',
      key: 'gradeApplied',
      width: 130,
    },
    {
      title: t('admissions.previousSchool'),
      dataIndex: 'previousSchool',
      key: 'previousSchool',
    },
    {
      title: t('admissions.submittedAt'),
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 140,
      render: (val: string) => (val ? new Date(val).toLocaleDateString() : '-'),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (val: string) => (
        <Tag color={STATUS_TAG_COLORS[val] ?? 'default'}>{statusLabel(val)}</Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<Eye size={16} />}
          onClick={() => handleReview(record)}
        >
          {t('admissions.review')}
        </Button>
      ),
    },
  ]

  const canDecide =
    selectedAdmission?.status === 'pending' ||
    selectedAdmission?.status === 'under_review'

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <ClipboardList size={22} />
            <Card.Meta
              title={
                <span style={{ fontSize: 20, fontWeight: 600 }}>
                  {t('admissions.title')}
                </span>
              }
            />
          </Space>
        </Col>
      </Row>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title={t('admissions.totalApplications')} value={totalCount} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('admissions.pendingReview')}
              value={pendingCount}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('admissions.accepted')}
              value={acceptedCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('admissions.rejected')}
              value={rejectedCount}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <Input.Search
              placeholder={t('common.search')}
              prefix={<Search size={14} />}
              allowClear
              onSearch={(val) => setSearch(val)}
              onChange={(e) => {
                if (!e.target.value) setSearch('')
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t('admissions.allStatus')}
              allowClear
              style={{ width: '100%' }}
              value={status || undefined}
              onChange={(val) => setStatus(val ?? '')}
              options={[
                { label: t('admissions.statusPending'), value: 'pending' },
                { label: t('admissions.statusUnderReview'), value: 'under_review' },
                { label: t('admissions.statusAccepted'), value: 'accepted' },
                { label: t('admissions.statusRejected'), value: 'rejected' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table<Admission>
          rowKey="id"
          columns={columns}
          dataSource={admissions}
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${t('common.total')}: ${total}`,
          }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>

      {/* Review Modal */}
      <Modal
        title={t('admissions.reviewApplication')}
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false)
          setActionType(null)
          setRemarks('')
        }}
        footer={null}
        width={680}
      >
        {selectedAdmission && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label={t('admissions.applicantName')}>
                {selectedAdmission.applicantName}
              </Descriptions.Item>
              <Descriptions.Item label={t('students.dateOfBirth')}>
                {selectedAdmission.dateOfBirth
                  ? new Date(selectedAdmission.dateOfBirth).toLocaleDateString()
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('students.gender')}>
                {selectedAdmission.gender === 'male'
                  ? t('students.male')
                  : selectedAdmission.gender === 'female'
                    ? t('students.female')
                    : selectedAdmission.gender ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('students.nationality')}>
                {selectedAdmission.nationality ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.parentName')}>
                {selectedAdmission.parentName ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.parentPhone')}>
                {selectedAdmission.parentPhone ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.parentEmail')} span={2}>
                {selectedAdmission.parentEmail ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.gradeApplied')}>
                {selectedAdmission.gradeApplied}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.previousSchool')}>
                {selectedAdmission.previousSchool ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admissions.submittedAt')}>
                {new Date(selectedAdmission.submittedAt).toLocaleDateString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={STATUS_TAG_COLORS[selectedAdmission.status] ?? 'default'}>
                  {statusLabel(selectedAdmission.status)}
                </Tag>
              </Descriptions.Item>
              {selectedAdmission.remarks && (
                <Descriptions.Item label={t('admissions.remarks')} span={2}>
                  {selectedAdmission.remarks}
                </Descriptions.Item>
              )}
              {selectedAdmission.decidedAt && (
                <Descriptions.Item label={t('admissions.decidedAt')} span={2}>
                  {new Date(selectedAdmission.decidedAt).toLocaleDateString()}
                </Descriptions.Item>
              )}
            </Descriptions>

            {canDecide && !actionType && (
              <Space style={{ width: '100%', justifyContent: 'center' }}>
                <Button
                  type="primary"
                  icon={<CheckCircle size={16} />}
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                  onClick={() => setActionType('accepted')}
                >
                  {t('admissions.accept')}
                </Button>
                <Button
                  danger
                  icon={<XCircle size={16} />}
                  onClick={() => setActionType('rejected')}
                >
                  {t('admissions.reject')}
                </Button>
              </Space>
            )}

            {actionType && (
              <Card
                size="small"
                title={
                  actionType === 'accepted'
                    ? t('admissions.accept')
                    : t('admissions.reject')
                }
                style={{ marginTop: 16 }}
              >
                <Input.TextArea
                  rows={3}
                  placeholder={t('admissions.remarks')}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <Space>
                  <Button
                    type="primary"
                    loading={updateMutation.isPending}
                    onClick={handleConfirmAction}
                    danger={actionType === 'rejected'}
                  >
                    {t('common.confirm')}
                  </Button>
                  <Button onClick={() => setActionType(null)}>
                    {t('common.cancel')}
                  </Button>
                </Space>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AdmissionsPage
