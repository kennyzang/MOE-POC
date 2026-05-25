import { useState, useMemo } from 'react'
import {
  Table,
  Select,
  Tag,
  Card,
  Space,
  Row,
  Col,
  Typography,
  Statistic,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Clock } from 'lucide-react'
import api from '../../lib/api'
import type { Course, CourseAssignment } from '../../types'

const { Title } = Typography

interface WorkloadRow {
  id: string
  teacherName: string
  teacherId: string
  courseName: string
  courseCode: string
  semester: string
  schedule: string
  creditHours: number
}

const TeachingWorkloadPage = () => {
  const { t } = useTranslation()
  const [teacherFilter, setTeacherFilter] = useState<string>('')
  const [semesterFilter, setSemesterFilter] = useState<string>('')

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses-workload'],
    queryFn: async () => {
      const { data } = await api.get('/courses')
      return data.data as Course[]
    },
  })

  // Flatten course assignments into workload rows
  const workloadRows = useMemo(() => {
    const rows: WorkloadRow[] = []
    courses.forEach((course) => {
      if (course.assignments && course.assignments.length > 0) {
        course.assignments.forEach((a: CourseAssignment) => {
          rows.push({
            id: a.id,
            teacherName: a.teacher?.user?.displayName ?? '-',
            teacherId: a.teacherId,
            courseName: course.name,
            courseCode: course.code,
            semester: a.semester ?? '-',
            schedule: a.schedule ?? '-',
            creditHours: course.creditHours,
          })
        })
      }
    })
    return rows
  }, [courses])

  // Derive filter options
  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>()
    workloadRows.forEach((r) => map.set(r.teacherId, r.teacherName))
    return Array.from(map.entries()).map(([value, label]) => ({ label, value }))
  }, [workloadRows])

  const semesterOptions = useMemo(() => {
    const set = new Set(workloadRows.map((r) => r.semester).filter((s) => s !== '-'))
    return Array.from(set).sort().map((s) => ({ label: s, value: s }))
  }, [workloadRows])

  // Apply filters
  const filteredRows = useMemo(() => {
    return workloadRows.filter((r) => {
      if (teacherFilter && r.teacherId !== teacherFilter) return false
      if (semesterFilter && r.semester !== semesterFilter) return false
      return true
    })
  }, [workloadRows, teacherFilter, semesterFilter])

  // Stats for filtered teacher(s)
  const stats = useMemo(() => {
    const teacherMap = new Map<string, { courses: number; hours: number }>()
    filteredRows.forEach((r) => {
      const existing = teacherMap.get(r.teacherId) ?? { courses: 0, hours: 0 }
      existing.courses += 1
      existing.hours += r.creditHours
      teacherMap.set(r.teacherId, existing)
    })
    let totalCourses = 0
    let totalHours = 0
    teacherMap.forEach((v) => {
      totalCourses += v.courses
      totalHours += v.hours
    })
    return { totalCourses, totalHours, teacherCount: teacherMap.size }
  }, [filteredRows])

  const columns: ColumnsType<WorkloadRow> = [
    {
      title: t('courses.teacher'),
      dataIndex: 'teacherName',
      key: 'teacherName',
    },
    {
      title: t('courses.courseName'),
      key: 'courseName',
      render: (_, record) => (
        <Space>
          <Tag>{record.courseCode}</Tag>
          {record.courseName}
        </Space>
      ),
    },
    {
      title: t('courses.semester'),
      dataIndex: 'semester',
      key: 'semester',
      width: 140,
    },
    {
      title: t('courses.schedule'),
      dataIndex: 'schedule',
      key: 'schedule',
      width: 200,
    },
    {
      title: t('courses.creditHours'),
      dataIndex: 'creditHours',
      key: 'creditHours',
      width: 120,
      align: 'center',
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
              {t('workload.title')}
            </Title>
          </Space>
        </Col>
      </Row>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t('workload.totalCourses')}
              value={stats.totalCourses}
              prefix={<BookOpen size={16} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title={t('workload.totalHours')}
              value={stats.totalHours}
              prefix={<Clock size={16} />}
            />
          </Card>
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
              value={teacherFilter || undefined}
              onChange={(val) => setTeacherFilter(val ?? '')}
              options={teacherOptions}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t('workload.allSemesters')}
              allowClear
              style={{ width: '100%' }}
              value={semesterFilter || undefined}
              onChange={(val) => setSemesterFilter(val ?? '')}
              options={semesterOptions}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table<WorkloadRow>
          rowKey="id"
          columns={columns}
          dataSource={filteredRows}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${t('common.total')}: ${total}` }}
          locale={{ emptyText: t('common.noData') }}
        />
      </Card>
    </div>
  )
}

export default TeachingWorkloadPage
