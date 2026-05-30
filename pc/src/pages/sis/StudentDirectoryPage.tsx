import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  Input,
  Select,
  Tag,
  Card,
  Space,
  Row,
  Col,
  Typography,
  Button,
  Tooltip,
  Progress,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, Eye } from 'lucide-react'
import api from '../../lib/api'
import type { Student } from '../../types'

const STANDING_CONFIG: Record<string, { color: string; label: string }> = {
  GOOD_STANDING: { color: 'success', label: 'Good Standing' },
  ACADEMIC_WATCH: { color: 'warning', label: 'Academic Watch' },
  PROBATION:      { color: 'error',   label: 'Probation' },
  AT_RISK:        { color: 'error',   label: 'At Risk' },
}

const { Title } = Typography

const STATUS_TAG_COLORS: Record<string, string> = {
  enrolled: 'green',
  pending: 'orange',
  graduated: 'blue',
}

const GRADE_LEVELS = [
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Year 5',
  'Year 6',
  'Year 7',
  'Year 8',
  'Year 9',
  'Year 10',
  'Year 11',
]

const StudentDirectoryPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [gradeLevel, setGradeLevel] = useState<string>('')
  const [className, setClassName] = useState<string>('')
  const [status, setStatus] = useState<string>('')

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', search, gradeLevel, className, status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (gradeLevel) params.set('gradeLevel', gradeLevel)
      if (className) params.set('className', className)
      if (status) params.set('status', status)
      const { data } = await api.get(`/students?${params}`)
      return data.data as Student[]
    },
  })

  // Derive unique class names from data for the class filter
  const classOptions = Array.from(
    new Set(students.map((s) => s.className).filter(Boolean))
  ).sort()

  // Class capacity data for selected grade level
  const { data: rosterData } = useQuery<Array<{ className: string; enrolled: number; capacity: number; percentage: number; colour: string }>>({
    queryKey: ['class-roster', gradeLevel],
    queryFn: async () => {
      if (!gradeLevel) return []
      const res = await api.get(`/admissions/class-roster/${encodeURIComponent(gradeLevel)}`)
      return res.data.data ?? []
    },
    enabled: !!gradeLevel,
  })

  const handleView = (student: Student) => {
    navigate(`/sis/students/${student.id}`)
  }

  const columns: ColumnsType<Student> = [
    {
      title: t('students.studentId'),
      dataIndex: 'studentId',
      key: 'studentId',
      width: 140,
    },
    {
      title: t('common.name'),
      key: 'name',
      render: (_, record) => record.user?.displayName ?? '-',
    },
    {
      title: t('students.gradeLevel'),
      dataIndex: 'gradeLevel',
      key: 'gradeLevel',
      width: 120,
    },
    {
      title: t('students.className'),
      dataIndex: 'className',
      key: 'className',
      width: 100,
    },
    {
      title: t('students.gender'),
      dataIndex: 'gender',
      key: 'gender',
      width: 100,
      render: (val: string) =>
        val === 'male' ? t('students.male') : val === 'female' ? t('students.female') : val ?? '-',
    },
    {
      title: t('common.status'),
      dataIndex: 'enrollmentStatus',
      key: 'enrollmentStatus',
      width: 120,
      render: (val: string) => (
        <Tag color={STATUS_TAG_COLORS[val] ?? 'default'}>
          {t(`students.${val}` as never, val)}
        </Tag>
      ),
    },
    {
      title: 'Academic Standing',
      dataIndex: 'academicStanding',
      key: 'academicStanding',
      width: 150,
      render: (val: string) => {
        const cfg = STANDING_CONFIG[val] ?? STANDING_CONFIG.GOOD_STANDING
        if (val === 'GOOD_STANDING' || !val) return null
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
      filters: [
        { text: 'Academic Watch', value: 'ACADEMIC_WATCH' },
        { text: 'Probation', value: 'PROBATION' },
      ],
      onFilter: (value, record) => (record as any).academicStanding === value,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      render: (_, record) => (
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

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <Users size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('students.title')}
            </Title>
            <Tag>{t('common.total')}: {students.length}</Tag>
          </Space>
        </Col>
      </Row>

      {/* Class Capacity Panel — shows when a grade is selected */}
      {gradeLevel && rosterData && rosterData.length > 0 && (
        <Card size="small" style={{ marginBottom: 12, background: '#f9fafb' }}>
          <Space size={6} wrap>
            <Typography.Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>Class Capacity:</Typography.Text>
            {rosterData.map(r => (
              <Tooltip key={r.className} title={`${r.enrolled}/${r.capacity} students enrolled`}>
                <Tag
                  color={r.colour === 'red' ? 'error' : r.colour === 'orange' ? 'warning' : 'success'}
                  style={{ cursor: 'pointer', fontWeight: r.colour !== 'green' ? 700 : 400 }}
                  onClick={() => setClassName(r.className)}
                >
                  {r.className} {r.enrolled}/{r.capacity}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        </Card>
      )}

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
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
              placeholder={t('students.gradeLevel')}
              allowClear
              style={{ width: '100%' }}
              value={gradeLevel || undefined}
              onChange={(val) => setGradeLevel(val ?? '')}
              options={GRADE_LEVELS.map((g) => ({ label: g, value: g }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t('students.className')}
              allowClear
              style={{ width: '100%' }}
              value={className || undefined}
              onChange={(val) => setClassName(val ?? '')}
              options={classOptions.map((c) => ({ label: c, value: c }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t('students.enrollmentStatus')}
              allowClear
              style={{ width: '100%' }}
              value={status || undefined}
              onChange={(val) => setStatus(val ?? '')}
              options={[
                { label: t('students.enrolled'), value: 'enrolled' },
                { label: t('students.pending'), value: 'pending' },
                { label: t('students.graduated'), value: 'graduated' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table<Student>
          rowKey="id"
          columns={columns}
          dataSource={students}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>

    </div>
  )
}

export default StudentDirectoryPage
