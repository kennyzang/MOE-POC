import { Card, Table, Tag, Spin, Typography, Row, Col, Statistic, Progress } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Award, BookOpen } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import type { StudentDashboardStats } from '../../types'

const { Title, Text } = Typography

interface CourseRef {
  id: string
  code: string
  name: string
}

interface GradeItemRef {
  id: string
  courseId: string
  name: string
  type: string
  maxScore: number
  weight: number
  dueDate?: string
  course?: CourseRef
}

interface GradeRecord {
  id: string
  studentId: string
  gradeItemId: string
  score?: number | null
  letterGrade?: string | null
  remarks?: string | null
  gradedAt?: string
  gradeItem: GradeItemRef
}

interface CourseGradeGroup {
  courseId: string
  courseName: string
  courseCode: string
  grades: GradeRecord[]
  weightedAvg: number
}

const TYPE_COLOR: Record<string, string> = {
  exam: 'red',
  quiz: 'orange',
  assignment: 'blue',
  project: 'green',
}

const GPA_COLOR = (gpa: number) => {
  if (gpa >= 3.5) return '#52c41a'
  if (gpa >= 2.5) return '#fa8c16'
  return '#f5222d'
}

function calcCourseAvg(grades: GradeRecord[]): number {
  let totalWeight = 0
  let weightedSum = 0
  for (const g of grades) {
    if (g.score == null) continue
    const pct = g.score / g.gradeItem.maxScore
    weightedSum += pct * g.gradeItem.weight
    totalWeight += g.gradeItem.weight
  }
  if (totalWeight === 0) return 0
  return Math.round((weightedSum / totalWeight) * 10000) / 100
}

function groupByCourse(grades: GradeRecord[]): CourseGradeGroup[] {
  const map = new Map<string, CourseGradeGroup>()
  for (const g of grades) {
    const course = g.gradeItem.course
    if (!course) continue
    if (!map.has(course.id)) {
      map.set(course.id, {
        courseId: course.id,
        courseName: course.name,
        courseCode: course.code,
        grades: [],
        weightedAvg: 0,
      })
    }
    map.get(course.id)!.grades.push(g)
  }
  for (const group of map.values()) {
    group.weightedAvg = calcCourseAvg(group.grades)
  }
  return [...map.values()]
}

const StudentGradesPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data: stats } = useQuery({
    queryKey: ['student-dashboard-stats', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      return data.data as StudentDashboardStats
    },
    enabled: !!user,
  })

  const { data: grades, isLoading } = useQuery({
    queryKey: ['student-grades', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/grades')
      return data.data as GradeRecord[]
    },
    enabled: !!user,
  })

  const gpa = stats?.gpa ?? 0
  const gpaColor = GPA_COLOR(gpa)
  const courseGroups = grades ? groupByCourse(grades) : []

  const columns: ColumnsType<GradeRecord> = [
    {
      title: t('grades.gradeItem'),
      dataIndex: ['gradeItem', 'name'],
      key: 'name',
    },
    {
      title: t('grades.gradeItem'),
      key: 'type',
      dataIndex: ['gradeItem', 'type'],
      width: 110,
      render: (type: string) => (
        <Tag color={TYPE_COLOR[type] ?? 'default'}>
          {t(`grades.${type}` as never, type)}
        </Tag>
      ),
    },
    {
      title: t('grades.score'),
      key: 'score',
      width: 120,
      render: (_: unknown, record: GradeRecord) =>
        record.score != null
          ? `${record.score} / ${record.gradeItem.maxScore}`
          : '—',
    },
    {
      title: t('grades.percentage'),
      key: 'pct',
      width: 160,
      render: (_: unknown, record: GradeRecord) => {
        if (record.score == null) return <Text type="secondary">—</Text>
        const pct = Math.round((record.score / record.gradeItem.maxScore) * 100)
        return (
          <Progress
            percent={pct}
            size="small"
            strokeColor={pct >= 75 ? '#52c41a' : pct >= 50 ? '#faad14' : '#ff4d4f'}
          />
        )
      },
    },
    {
      title: t('grades.weight'),
      dataIndex: ['gradeItem', 'weight'],
      key: 'weight',
      width: 90,
      align: 'center',
      render: (w: number) => `${w}%`,
    },
    {
      title: t('grades.letterGrade'),
      dataIndex: 'letterGrade',
      key: 'letterGrade',
      width: 80,
      align: 'center',
      render: (v?: string | null) => v ?? '—',
    },
  ]

  // Fix duplicate title — rename type column
  const fixedColumns = columns.map((col, i) =>
    i === 1 ? { ...col, title: t('common.status') } : col
  )

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Title level={4} style={{ marginBottom: 0 }}>
        {t('nav.studentGrades')}
      </Title>

      {/* Summary cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={t('studentPortal.overallGpa')}
              value={gpa}
              precision={2}
              suffix="/ 4.00"
              prefix={<Award size={20} color={gpaColor} style={{ marginRight: 6 }} />}
              valueStyle={{ color: gpaColor, fontWeight: 700, fontSize: 36 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic
              title={t('dashboard.enrolledCourses')}
              value={courseGroups.length || (stats?.enrolledCourses ?? 0)}
              prefix={<BookOpen size={20} color="#1677ff" style={{ marginRight: 6 }} />}
              valueStyle={{ color: '#1677ff', fontWeight: 700, fontSize: 36 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Per-course grade tables */}
      {courseGroups.length === 0 ? (
        <Card style={{ borderRadius: 10 }}>
          <Text type="secondary">{t('grades.noGradeItems')}</Text>
        </Card>
      ) : (
        courseGroups.map((group) => {
          const avgColor = group.weightedAvg >= 75 ? '#52c41a' : group.weightedAvg >= 50 ? '#faad14' : '#ff4d4f'
          return (
            <Card
              key={group.courseId}
              style={{ borderRadius: 10 }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    <Tag color="blue" style={{ marginRight: 8 }}>{group.courseCode}</Tag>
                    {group.courseName}
                  </span>
                  <span style={{ fontWeight: 700, color: avgColor, fontSize: 15 }}>
                    {t('grades.weightedAvg')}: {group.weightedAvg.toFixed(1)}%
                  </span>
                </div>
              }
            >
              <Table
                columns={fixedColumns}
                dataSource={group.grades}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: t('grades.noGradeItems') }}
              />
            </Card>
          )
        })
      )}
    </div>
  )
}

export default StudentGradesPage
