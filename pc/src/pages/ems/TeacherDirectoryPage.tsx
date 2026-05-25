import { useState, useMemo } from 'react'
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
  Tabs,
  Typography,
  Button,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Search, Eye } from 'lucide-react'
import api from '../../lib/api'
import type { Teacher, ApiResponse, Certification, CourseAssignment } from '../../types'
import type { ColumnsType } from 'antd/es/table'

const TeacherDirectoryPage = () => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState<string | undefined>(undefined)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)

  // Fetch teacher list
  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers', search, department],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (department) params.department = department
      const res = await api.get<ApiResponse<Teacher[]>>('/teachers', { params })
      return res.data.data
    },
  })

  // Fetch selected teacher detail (with certifications & course assignments)
  const { data: teacherDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['teacher', selectedTeacherId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Teacher>>(`/teachers/${selectedTeacherId}`)
      return res.data.data
    },
    enabled: !!selectedTeacherId,
  })

  // Extract unique departments from teacher data
  const departmentOptions = useMemo(() => {
    const deps = new Set<string>()
    teachers.forEach((t) => {
      if (t.department) deps.add(t.department)
    })
    return Array.from(deps).map((d) => ({ label: d, value: d }))
  }, [teachers])

  const handleView = (record: Teacher) => {
    setSelectedTeacherId(record.id)
    setDetailOpen(true)
  }

  const handleCloseDetail = () => {
    setDetailOpen(false)
    setSelectedTeacherId(null)
  }

  const columns: ColumnsType<Teacher> = [
    {
      title: t('teachers.staffId'),
      dataIndex: 'staffId',
      key: 'staffId',
      width: 120,
    },
    {
      title: t('common.name'),
      key: 'name',
      render: (_: unknown, record: Teacher) => record.user?.displayName ?? '-',
    },
    {
      title: t('teachers.designation'),
      dataIndex: 'designation',
      key: 'designation',
      render: (val: string) => val || '-',
    },
    {
      title: t('teachers.department'),
      dataIndex: 'department',
      key: 'department',
      render: (val: string) => val || '-',
    },
    {
      title: t('teachers.subjects'),
      dataIndex: 'subjects',
      key: 'subjects',
      render: (val: string) => val || '-',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? t('courses.active') : t('courses.inactive')}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Teacher) => (
        <Button
          type="link"
          icon={<Eye size={16} />}
          onClick={() => handleView(record)}
        >
          {t('common.view')}
        </Button>
      ),
    },
  ]

  // Certifications columns for detail modal
  const certColumns: ColumnsType<Certification> = [
    {
      title: t('certifications.certName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('certifications.issuedBy'),
      dataIndex: 'issuedBy',
      key: 'issuedBy',
      render: (val: string) => val || '-',
    },
    {
      title: t('certifications.issuedDate'),
      dataIndex: 'issuedDate',
      key: 'issuedDate',
      render: (val: string) => (val ? val.slice(0, 10) : '-'),
    },
    {
      title: t('certifications.expiryDate'),
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (val: string) => (val ? val.slice(0, 10) : '-'),
    },
    {
      title: t('certifications.certStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          expired: 'red',
          expiring_soon: 'orange',
        }
        const labelMap: Record<string, string> = {
          active: t('certifications.active'),
          expired: t('certifications.expired'),
          expiring_soon: t('certifications.expiringSoon'),
        }
        return <Tag color={colorMap[status] || 'default'}>{labelMap[status] || status}</Tag>
      },
    },
  ]

  // Course assignment columns for detail modal
  const assignmentColumns: ColumnsType<CourseAssignment> = [
    {
      title: t('courses.courseName'),
      key: 'courseName',
      render: (_: unknown, record: CourseAssignment) => record.course?.name ?? '-',
    },
    {
      title: t('courses.semester'),
      dataIndex: 'semester',
      key: 'semester',
      render: (val: string) => val || '-',
    },
    {
      title: t('courses.schedule'),
      dataIndex: 'schedule',
      key: 'schedule',
      render: (val: string) => val || '-',
    },
  ]

  const detailTabs = [
    {
      key: 'info',
      label: t('students.personalInfo'),
      children: teacherDetail ? (
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label={t('teachers.staffId')}>
            {teacherDetail.staffId}
          </Descriptions.Item>
          <Descriptions.Item label={t('teachers.designation')}>
            {teacherDetail.designation || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('teachers.department')}>
            {teacherDetail.department || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('teachers.qualification')}>
            {teacherDetail.qualification || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('teachers.joinDate')}>
            {teacherDetail.joinDate ? teacherDetail.joinDate.slice(0, 10) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.email')}>
            {teacherDetail.user?.email || '-'}
          </Descriptions.Item>
        </Descriptions>
      ) : null,
    },
    {
      key: 'certifications',
      label: t('certifications.title'),
      children: (
        <Table
          dataSource={teacherDetail?.certifications ?? []}
          columns={certColumns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: t('common.noData') }}
        />
      ),
    },
    {
      key: 'assignments',
      label: t('teachers.courseAssignments'),
      children: (
        <Table
          dataSource={teacherDetail?.courseAssignments ?? []}
          columns={assignmentColumns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: t('common.noData') }}
        />
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            <GraduationCap size={24} />
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('teachers.title')}
            </Typography.Title>
            <Tag>{`${t('common.total')}: ${teachers.length}`}</Tag>
          </Space>
        </Col>
        <Col>
          <Space>
            <Input.Search
              placeholder={t('common.search')}
              prefix={<Search size={16} />}
              allowClear
              onSearch={(val) => setSearch(val)}
              style={{ width: 240 }}
            />
            <Select
              placeholder={t('teachers.allDepartments')}
              allowClear
              options={departmentOptions}
              onChange={(val) => setDepartment(val)}
              style={{ width: 180 }}
            />
          </Space>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={teachers}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>

      <Modal
        open={detailOpen}
        onCancel={handleCloseDetail}
        title={
          <Space>
            <GraduationCap size={20} />
            <span>
              {t('teachers.teacherDetail')} - {teacherDetail?.user?.displayName ?? ''}
            </span>
          </Space>
        }
        footer={null}
        width={720}
        destroyOnClose
      >
        <Tabs items={detailTabs} defaultActiveKey="info" />
      </Modal>
    </div>
  )
}

export default TeacherDirectoryPage
