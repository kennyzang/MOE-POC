import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Input, Select, Tag, Card, Space, Row, Col, Typography, Button, Segmented,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Search, Eye, AlertTriangle } from 'lucide-react'
import api from '../../lib/api'
import type { Teacher, ApiResponse } from '../../types'
import type { ColumnsType } from 'antd/es/table'

const STAFF_TYPE_LABELS: Record<string, string> = {
  TEACHING: 'Teaching',
  ADMINISTRATIVE: 'Administrative',
  SUPPORT: 'Support',
  SECURITY: 'Security',
}

const TeacherDirectoryPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState<string | undefined>(undefined)
  const [staffTypeSegment, setStaffTypeSegment] = useState<'all' | 'teaching' | 'support'>('all')

  const staffTypeParam =
    staffTypeSegment === 'teaching' ? 'TEACHING' :
    staffTypeSegment === 'support' ? 'ADMINISTRATIVE,SUPPORT,SECURITY' :
    undefined

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers', search, department, staffTypeParam],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (department) params.department = department
      if (staffTypeParam) params.staffType = staffTypeParam
      const res = await api.get<ApiResponse<Teacher[]>>('/teachers', { params })
      return res.data.data
    },
  })

  const departmentOptions = useMemo(() => {
    const deps = new Set<string>()
    teachers.forEach((t) => { if (t.department) deps.add(t.department) })
    return Array.from(deps).map((d) => ({ label: d, value: d }))
  }, [teachers])

  const isAdminSupport = staffTypeSegment === 'support'

  const columns: ColumnsType<Teacher> = [
    { title: t('teachers.staffId'), dataIndex: 'staffId', key: 'staffId', width: 120 },
    {
      title: t('common.name'),
      key: 'name',
      render: (_, record) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/ems/teachers/${record.id}`)}>
          {record.user?.displayName ?? '-'}
        </Button>
      ),
    },
    { title: t('teachers.designation'), dataIndex: 'designation', render: (v) => v || '-' },
    { title: t('teachers.department'), dataIndex: 'department', render: (v) => v || '-' },
    // Show "Role/Function" for Admin & Support; "Subjects" for Teaching / All
    ...(isAdminSupport ? [
      {
        title: t('ems.roleFunction'),
        key: 'roleFunction',
        width: 140,
        render: (_: unknown, record: Teacher) => (
          <Tag>{STAFF_TYPE_LABELS[(record as any).staffType ?? 'TEACHING']}</Tag>
        ),
      },
    ] : [
      { title: t('teachers.subjects'), dataIndex: 'subjects', render: (v: string) => v || '-' },
    ]) as ColumnsType<Teacher>,
    {
      title: t('common.status'), dataIndex: 'status', width: 100,
      render: (s: string) => (
        <Tag color={s === 'active' ? 'green' : 'red'}>
          {s === 'active' ? t('courses.active') : t('courses.inactive')}
        </Tag>
      ),
    },
    {
      title: t('ems.employmentStatus'), dataIndex: 'employmentStatus', width: 130,
      render: (val: string) => {
        const colorMap: Record<string, string> = { active: 'green', onLeave: 'orange', inTraining: 'blue' }
        const labelKey: Record<string, string> = { active: 'ems.active', onLeave: 'ems.onLeave', inTraining: 'ems.inTraining' }
        return <Tag color={colorMap[val] ?? 'default'}>{t(labelKey[val] ?? val)}</Tag>
      },
    },
    // CPD hours only for teaching staff
    ...(!isAdminSupport ? [{
      title: t('ems.cpdHours'), key: 'cpd', width: 110,
      render: (_: unknown, record: Teacher) => {
        const hours = record.cpdHours ?? 0
        const target = record.cpdTarget ?? 20
        return (
          <Space size={4}>
            <span>{`${hours}/${target}h`}</span>
            {hours < target && <AlertTriangle size={14} color="#fa8c16" />}
          </Space>
        )
      },
    }] as ColumnsType<Teacher> : []),
    {
      title: t('common.actions'), key: 'actions', width: 90,
      render: (_, record) => (
        <Button type="link" icon={<Eye size={16} />} onClick={() => navigate(`/ems/teachers/${record.id}`)}>
          {t('common.view')}
        </Button>
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
            <Segmented
              value={staffTypeSegment}
              onChange={v => setStaffTypeSegment(v as 'all' | 'teaching' | 'support')}
              options={[
                { label: t('ems.allStaff'), value: 'all' },
                { label: t('ems.teachingStaff'), value: 'teaching' },
                { label: t('ems.adminAndSupport'), value: 'support' },
              ]}
            />
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
          onRow={(record) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(`/ems/teachers/${record.id}`) })}
        />
      </Card>
    </div>
  )
}

export default TeacherDirectoryPage
