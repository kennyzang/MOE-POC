import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Table,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  InputNumber,
  Button,
  Space,
  Popconfirm,
  message,
  Card,
  Row,
  Col,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Edit2, Trash2, Search, Eye } from 'lucide-react'
import api from '../../lib/api'
import type { Course } from '../../types'
import { useAuthStore } from '../../stores/authStore'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'

const { Title } = Typography
const { TextArea } = Input

const STATUS_TAG_COLORS: Record<string, string> = {
  active: 'green',
  inactive: 'red',
}

interface CourseFormValues {
  code: string
  name: string
  description?: string
  gradeLevel?: string
  creditHours: number
  status: string
}

const CourseManagementPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { gradeLevels } = useSchoolConfig()
  const canManage = ['admin', 'manager'].includes(user?.role ?? '')
  const [form] = Form.useForm<CourseFormValues>()

  const [search, setSearch] = useState('')
  const [gradeLevel, setGradeLevel] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', search, gradeLevel, status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (gradeLevel) params.set('gradeLevel', gradeLevel)
      if (status) params.set('status', status)
      const { data } = await api.get(`/courses?${params}`)
      return data.data as Course[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (values: CourseFormValues) => api.post('/courses', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      message.success(t('common.createSuccess'))
      setModalOpen(false)
    },
    onError: () => {
      message.error(t('common.createError'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<CourseFormValues> }) =>
      api.patch(`/courses/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      message.success(t('common.updateSuccess'))
      setModalOpen(false)
    },
    onError: () => {
      message.error(t('common.updateError'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/courses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      message.success(t('common.deleteSuccess'))
    },
    onError: () => {
      message.error(t('courses.deleteErrorHasEnrollments'))
    },
  })

  const handleAdd = () => {
    setEditingCourse(null)
    form.resetFields()
    form.setFieldsValue({ status: 'active', creditHours: 3 })
    setModalOpen(true)
  }

  const handleEdit = (course: Course) => {
    setEditingCourse(course)
    form.setFieldsValue({
      code: course.code,
      name: course.name,
      description: course.description ?? '',
      gradeLevel: course.gradeLevel ?? undefined,
      creditHours: course.creditHours,
      status: course.status,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingCourse) {
        updateMutation.mutate({ id: editingCourse.id, values })
      } else {
        createMutation.mutate(values)
      }
    } catch {
      // validation errors shown inline
    }
  }

  const columns: ColumnsType<Course> = [
    {
      title: t('courses.code'),
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: t('courses.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('courses.gradeLevel'),
      dataIndex: 'gradeLevel',
      key: 'gradeLevel',
      width: 120,
    },
    {
      title: t('courses.creditHours'),
      dataIndex: 'creditHours',
      key: 'creditHours',
      width: 120,
      align: 'center',
    },
    {
      title: t('courses.teachers'),
      key: 'teachers',
      width: 200,
      render: (_, record) => {
        const teachers =
          record.assignments
            ?.map((a) => a.teacher?.user?.displayName)
            .filter(Boolean) ?? []
        return teachers.length > 0 ? teachers.join(', ') : '-'
      },
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: string) => (
        <Tag color={STATUS_TAG_COLORS[val] ?? 'default'}>
          {t(`courses.${val}` as never, val)}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Link to={`/sms/courses/${record.id}`}>
            <Button type="link" size="small" icon={<Eye size={14} />}>
              {t('common.view')}
            </Button>
          </Link>
          {canManage && (
            <Button
              type="link"
              size="small"
              icon={<Edit2 size={14} />}
              onClick={() => handleEdit(record)}
            >
              {t('common.edit')}
            </Button>
          )}
          {canManage && (
            <Popconfirm
              title={t('courses.deleteConfirm')}
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" size="small" danger icon={<Trash2 size={14} />}>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <BookOpen size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('courses.title')}
            </Title>
            <Tag>
              {t('common.total')}: {courses.length}
            </Tag>
          </Space>
        </Col>
        {canManage && (
          <Col>
            <Button type="primary" icon={<Plus size={16} />} onClick={handleAdd}>
              {t('courses.addCourse')}
            </Button>
          </Col>
        )}
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
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t('courses.gradeLevel')}
              allowClear
              style={{ width: '100%' }}
              value={gradeLevel || undefined}
              onChange={(val) => setGradeLevel(val ?? '')}
              options={gradeLevels.map((g) => ({ label: g, value: g }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t('common.status')}
              allowClear
              style={{ width: '100%' }}
              value={status || undefined}
              onChange={(val) => setStatus(val ?? '')}
              options={[
                { label: t('courses.active'), value: 'active' },
                { label: t('courses.inactive'), value: 'inactive' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table<Course>
          rowKey="id"
          columns={columns}
          dataSource={courses}
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${t('common.total')}: ${total}`,
          }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingCourse ? t('courses.editCourse') : t('courses.addCourse')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label={t('courses.code')}
            rules={[{ required: true, message: t('courses.codeRequired') }]}
          >
            <Input disabled={!!editingCourse} placeholder={t('courses.codePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="name"
            label={t('courses.name')}
            rules={[{ required: true, message: t('courses.nameRequired') }]}
          >
            <Input placeholder={t('courses.namePlaceholder')} />
          </Form.Item>

          <Form.Item name="description" label={t('courses.description')}>
            <TextArea rows={3} placeholder={t('courses.descriptionPlaceholder')} />
          </Form.Item>

          <Form.Item name="gradeLevel" label={t('courses.gradeLevel')}>
            <Select
              placeholder={t('courses.gradeLevelPlaceholder')}
              allowClear
              options={gradeLevels.map((g) => ({ label: g, value: g }))}
            />
          </Form.Item>

          <Form.Item
            name="creditHours"
            label={t('courses.creditHours')}
            rules={[{ required: true, message: t('courses.creditHoursRequired') }]}
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="status"
            label={t('common.status')}
            rules={[{ required: true, message: t('courses.statusRequired') }]}
          >
            <Select
              options={[
                { label: t('courses.active'), value: 'active' },
                { label: t('courses.inactive'), value: 'inactive' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CourseManagementPage
