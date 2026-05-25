import { useState, useMemo, useCallback } from 'react'
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
  InputNumber,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Save } from 'lucide-react'
import api from '../../lib/api'
import type { Course, Enrollment, Grade, GradeItem } from '../../types'

const { Title } = Typography

/** Compute letter grade from percentage */
const getLetterGrade = (pct: number): string => {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

const LETTER_COLORS: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'volcano',
  F: 'red',
}

interface StudentRow {
  key: string
  studentId: string
  studentName: string
  scores: Record<string, number | undefined> // gradeItemId -> score
}

const GradeManagementPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>()
  const [editedScores, setEditedScores] = useState<
    Record<string, Record<string, number | undefined>>
  >({})

  // Fetch courses for selector
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await api.get('/courses')
      return data.data as Course[]
    },
  })

  // Fetch enrollments for selected course
  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', selectedCourseId],
    queryFn: async () => {
      const { data } = await api.get(`/enrollments?courseId=${selectedCourseId}`)
      return data.data as Enrollment[]
    },
    enabled: !!selectedCourseId,
  })

  // Fetch grades for selected course
  const {
    data: grades = [],
    isLoading: gradesLoading,
  } = useQuery({
    queryKey: ['grades', selectedCourseId],
    queryFn: async () => {
      const { data } = await api.get(`/grades?courseId=${selectedCourseId}`)
      return data.data as Grade[]
    },
    enabled: !!selectedCourseId,
  })

  // Derive unique grade items from grades data
  const gradeItems = useMemo(() => {
    const map = new Map<string, GradeItem>()
    grades.forEach((g) => {
      if (g.gradeItem && !map.has(g.gradeItem.id)) {
        map.set(g.gradeItem.id, g.gradeItem)
      }
    })
    return Array.from(map.values())
  }, [grades])

  // Build student rows from enrollments + grades
  const studentRows = useMemo<StudentRow[]>(() => {
    return enrollments.map((en) => {
      const name = en.student?.user?.displayName ?? '-'
      const scores: Record<string, number | undefined> = {}
      grades
        .filter((g) => g.studentId === en.studentId)
        .forEach((g) => {
          scores[g.gradeItemId] = g.score
        })
      return {
        key: en.studentId,
        studentId: en.studentId,
        studentName: name,
        scores,
      }
    })
  }, [enrollments, grades])

  // Get the effective score (edited or original)
  const getScore = useCallback(
    (studentId: string, gradeItemId: string, originalScore?: number) => {
      return editedScores[studentId]?.[gradeItemId] ?? originalScore
    },
    [editedScores]
  )

  // Handle score change
  const handleScoreChange = useCallback(
    (studentId: string, gradeItemId: string, value: number | null) => {
      setEditedScores((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [gradeItemId]: value ?? undefined,
        },
      }))
    },
    []
  )

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (
      payload: { studentId: string; gradeItemId: string; score: number }[]
    ) => {
      await Promise.all(
        payload.map((p) => api.post('/grades', p))
      )
    },
    onSuccess: () => {
      message.success(t('grades.gradesSaved'))
      setEditedScores({})
      queryClient.invalidateQueries({ queryKey: ['grades', selectedCourseId] })
    },
    onError: () => {
      message.error(t('common.error'))
    },
  })

  const handleSave = () => {
    const payload: { studentId: string; gradeItemId: string; score: number }[] = []
    Object.entries(editedScores).forEach(([studentId, items]) => {
      Object.entries(items).forEach(([gradeItemId, score]) => {
        if (score !== undefined) {
          payload.push({ studentId, gradeItemId, score })
        }
      })
    })
    if (payload.length === 0) return
    saveMutation.mutate(payload)
  }

  const hasEdits = Object.keys(editedScores).some((sid) =>
    Object.values(editedScores[sid]).some((v) => v !== undefined)
  )

  // Build table columns
  const columns = useMemo<ColumnsType<StudentRow>>(() => {
    const cols: ColumnsType<StudentRow> = [
      {
        title: t('common.name'),
        dataIndex: 'studentName',
        key: 'studentName',
        fixed: 'left',
        width: 180,
      },
    ]

    // One column per grade item
    gradeItems.forEach((gi) => {
      cols.push({
        title: (
          <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
            <span>{gi.name}</span>
            <span style={{ fontSize: 11, color: '#888' }}>
              {t('grades.maxScore')}: {gi.maxScore} | {t('grades.weight')}: {gi.weight}%
            </span>
          </Space>
        ),
        key: gi.id,
        width: 150,
        align: 'center',
        render: (_, record) => {
          const original = record.scores[gi.id]
          const current = getScore(record.studentId, gi.id, original)
          return (
            <InputNumber
              size="small"
              min={0}
              max={gi.maxScore}
              value={current}
              style={{ width: 80 }}
              onChange={(val) => handleScoreChange(record.studentId, gi.id, val)}
            />
          )
        },
      })
    })

    // Weighted average column
    if (gradeItems.length > 0) {
      cols.push({
        title: t('grades.weightedAvg'),
        key: 'weightedAvg',
        width: 140,
        align: 'center',
        fixed: 'right',
        render: (_, record) => {
          let totalWeight = 0
          let weightedSum = 0
          let hasAny = false

          gradeItems.forEach((gi) => {
            const score = getScore(record.studentId, gi.id, record.scores[gi.id])
            if (score !== undefined && gi.maxScore > 0) {
              const pct = (score / gi.maxScore) * 100
              weightedSum += pct * gi.weight
              totalWeight += gi.weight
              hasAny = true
            }
          })

          if (!hasAny) return '-'
          const avg = totalWeight > 0 ? weightedSum / totalWeight : 0
          const letter = getLetterGrade(avg)

          return (
            <Space>
              <span>{avg.toFixed(1)}%</span>
              <Tag color={LETTER_COLORS[letter] ?? 'default'}>{letter}</Tag>
            </Space>
          )
        },
      })
    }

    return cols
  }, [gradeItems, getScore, handleScoreChange, t])

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <ClipboardCheck size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('grades.title')}
            </Title>
          </Space>
        </Col>
        <Col>
          {selectedCourseId && hasEdits && (
            <Button
              type="primary"
              icon={<Save size={16} />}
              loading={saveMutation.isPending}
              onClick={handleSave}
            >
              {t('grades.saveGrades')}
            </Button>
          )}
        </Col>
      </Row>

      {/* Course selector */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t('grades.selectCourse')}
              style={{ width: '100%' }}
              allowClear
              value={selectedCourseId}
              onChange={(val) => {
                setSelectedCourseId(val)
                setEditedScores({})
              }}
              options={courses.map((c) => ({
                label: `${c.code} - ${c.name}`,
                value: c.id,
              }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ??
                false
              }
            />
          </Col>
        </Row>
      </Card>

      {/* Grade table */}
      <Card>
        {!selectedCourseId ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            {t('grades.selectCourse')}
          </div>
        ) : gradeItems.length === 0 && !gradesLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            {t('grades.noGradeItems')}
          </div>
        ) : (
          <Table<StudentRow>
            rowKey="key"
            columns={columns}
            dataSource={studentRows}
            loading={gradesLoading}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('common.noData') }}
          />
        )}
      </Card>
    </div>
  )
}

export default GradeManagementPage
