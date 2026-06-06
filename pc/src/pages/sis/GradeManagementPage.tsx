import { useState, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Table, Select, Tag, Card, Space, Row, Col, Typography, Button, InputNumber,
  message, Tooltip, Tabs, Alert, Progress, Modal, Upload, Divider, Statistic, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck, Save, ExternalLink, FileDown, Upload as UploadIcon, TrendingUp,
  TrendingDown, Minus, BookOpen, Users, BarChart2, History, AlertTriangle,
} from 'lucide-react'
import api from '../../lib/api'
import { downloadFile } from '../../lib/download'
import type { Course, Enrollment, Grade, GradeItem } from '../../types'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography

const getLetterGrade = (pct: number): string => {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

const LETTER_COLORS: Record<string, string> = { A: 'green', B: 'blue', C: 'orange', D: 'volcano', F: 'red' }
const STANDING_COLORS: Record<string, string> = {
  GOOD_STANDING: 'success', ACADEMIC_WATCH: 'warning', PROBATION: 'error', AT_RISK: 'error',
}

interface StudentRow {
  key: string
  studentId: string
  studentName: string
  scores: Record<string, number | undefined>
}

interface HistoryRow {
  studentId: string
  studentName: string
  academicStanding: string
  gradeAverage: number | null
  grades: { itemName: string; score: number | null; maxScore: number; gradedAt: string | null }[]
}

const GradeManagementPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canEdit = ['admin', 'manager', 'teacher', 'hod'].includes(user?.role ?? '')

  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>()
  const [editedScores, setEditedScores] = useState<Record<string, Record<string, number | undefined>>>({})
  const [activeTab, setActiveTab] = useState('entry')
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [importing, setImporting] = useState(false)

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data } = await api.get('/courses')
      return data.data as Course[]
    },
  })

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', selectedCourseId],
    queryFn: async () => {
      const { data } = await api.get(`/enrollments?courseId=${selectedCourseId}`)
      return data.data as Enrollment[]
    },
    enabled: !!selectedCourseId,
  })

  const { data: grades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ['grades', selectedCourseId],
    queryFn: async () => {
      const { data } = await api.get(`/grades?courseId=${selectedCourseId}`)
      return data.data as Grade[]
    },
    enabled: !!selectedCourseId,
  })

  const gradeItems = useMemo(() => {
    const map = new Map<string, GradeItem>()
    grades.forEach((g) => {
      if (g.gradeItem && !map.has(g.gradeItem.id)) map.set(g.gradeItem.id, g.gradeItem)
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [grades])

  const studentRows = useMemo<StudentRow[]>(() => {
    return enrollments.map((en) => {
      const scores: Record<string, number | undefined> = {}
      grades.filter((g) => g.studentId === en.studentId).forEach((g) => { scores[g.gradeItemId] = g.score })
      return {
        key: en.studentId,
        studentId: en.studentId,
        studentName: en.student?.user?.displayName ?? '-',
        scores,
      }
    })
  }, [enrollments, grades])

  const historyRows = useMemo<HistoryRow[]>(() => {
    return enrollments.map((en) => {
      const studentGrades = grades.filter(g => g.studentId === en.studentId)
      let totalWeight = 0, weightedSum = 0
      studentGrades.forEach(g => {
        const gi = gradeItems.find(gi => gi.id === g.gradeItemId)
        if (gi && g.score !== null && g.score !== undefined && gi.maxScore > 0) {
          weightedSum += (g.score / gi.maxScore) * 100 * gi.weight
          totalWeight += gi.weight
        }
      })
      const avg = totalWeight > 0 ? weightedSum / totalWeight : null

      let standing = 'GOOD_STANDING'
      if (avg !== null) {
        if (avg < 40) standing = 'AT_RISK'
        else if (avg < 55) standing = 'PROBATION'
        else if (avg < 70) standing = 'ACADEMIC_WATCH'
      }

      return {
        studentId: en.studentId,
        studentName: en.student?.user?.displayName ?? '-',
        academicStanding: standing,
        gradeAverage: avg !== null ? Math.round(avg * 10) / 10 : null,
        grades: gradeItems.map(gi => {
          const g = studentGrades.find(g => g.gradeItemId === gi.id)
          return { itemName: gi.name, score: g?.score ?? null, maxScore: gi.maxScore, gradedAt: (g as any)?.gradedAt ?? null }
        }),
      }
    })
  }, [enrollments, grades, gradeItems])

  // Course stats
  const courseStats = useMemo(() => {
    if (historyRows.length === 0) return null
    const withGrades = historyRows.filter(r => r.gradeAverage !== null)
    if (withGrades.length === 0) return null
    const avg = withGrades.reduce((s, r) => s + (r.gradeAverage ?? 0), 0) / withGrades.length
    const passing = withGrades.filter(r => (r.gradeAverage ?? 0) >= 60).length
    const atRisk = historyRows.filter(r => r.academicStanding === 'AT_RISK' || r.academicStanding === 'PROBATION').length
    return { avg: Math.round(avg * 10) / 10, passing, total: withGrades.length, atRisk }
  }, [historyRows])

  const getScore = useCallback(
    (studentId: string, gradeItemId: string, originalScore?: number) =>
      editedScores[studentId]?.[gradeItemId] ?? originalScore,
    [editedScores]
  )

  const handleScoreChange = useCallback(
    (studentId: string, gradeItemId: string, value: number | null) => {
      setEditedScores((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], [gradeItemId]: value ?? undefined },
      }))
    },
    []
  )

  const saveMutation = useMutation({
    mutationFn: async (payload: { studentId: string; gradeItemId: string; score: number }[]) => {
      await Promise.all(payload.map((p) => api.post('/grades', p)))
    },
    onSuccess: () => {
      message.success('Grades saved')
      setEditedScores({})
      void queryClient.invalidateQueries({ queryKey: ['grades', selectedCourseId] })
    },
    onError: () => message.error(t('common.error')),
  })

  const handleSave = () => {
    const payload: { studentId: string; gradeItemId: string; score: number }[] = []
    Object.entries(editedScores).forEach(([studentId, items]) => {
      Object.entries(items).forEach(([gradeItemId, score]) => {
        if (score !== undefined) payload.push({ studentId, gradeItemId, score })
      })
    })
    if (payload.length === 0) return
    saveMutation.mutate(payload)
  }

  const handleImport = async () => {
    if (!selectedCourseId || !fileList[0]?.originFileObj) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', fileList[0].originFileObj)
      const { data } = await api.post(`/grades/import/${selectedCourseId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const result = data.data as { upserted: number; skipped: number; errors: string[] }
      if (result.errors?.length) {
        message.warning(`Imported ${result.upserted} scores. ${result.errors.length} errors: ${result.errors[0]}`)
      } else {
        message.success(`Successfully imported ${result.upserted} grade scores (${result.skipped} rows skipped).`)
      }
      setImportModalOpen(false)
      setFileList([])
      void queryClient.invalidateQueries({ queryKey: ['grades', selectedCourseId] })
    } catch {
      message.error('Import failed. Please check the file format and try again.')
    } finally {
      setImporting(false)
    }
  }

  const hasEdits = Object.keys(editedScores).some((sid) =>
    Object.values(editedScores[sid]).some((v) => v !== undefined)
  )

  const selectedCourse = courses.find(c => c.id === selectedCourseId)

  // Entry table columns
  const entryColumns = useMemo<ColumnsType<StudentRow>>(() => {
    const cols: ColumnsType<StudentRow> = [
      {
        title: 'Student',
        dataIndex: 'studentName',
        key: 'studentName',
        fixed: 'left',
        width: 200,
        render: (name: string, record: StudentRow) => (
          <Link to={`/sis/students/${record.studentId}`} style={{ fontWeight: 500 }}>{name}</Link>
        ),
      },
    ]

    gradeItems.forEach((gi) => {
      cols.push({
        title: (
          <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{gi.name}</span>
            <span style={{ fontSize: 10, color: '#8c8c8c' }}>/{gi.maxScore} · wt {gi.weight}%</span>
          </Space>
        ),
        key: gi.id,
        width: 130,
        align: 'center',
        render: (_, record) => {
          const original = record.scores[gi.id]
          const current = getScore(record.studentId, gi.id, original)
          const isEdited = editedScores[record.studentId]?.[gi.id] !== undefined
          const pct = current !== undefined ? (current / gi.maxScore) * 100 : null
          return (
            <Space direction="vertical" size={0}>
              <InputNumber
                size="small"
                min={0}
                max={gi.maxScore}
                value={current}
                style={{ width: 75, borderColor: isEdited ? '#1677ff' : undefined }}
                disabled={!canEdit}
                onChange={(val) => canEdit && handleScoreChange(record.studentId, gi.id, val)}
              />
              {pct !== null && (
                <Text style={{ fontSize: 10, color: pct >= 70 ? '#52c41a' : pct >= 60 ? '#fa8c16' : '#f5222d' }}>
                  {pct.toFixed(0)}%
                </Text>
              )}
            </Space>
          )
        },
      })
    })

    if (gradeItems.length > 0) {
      cols.push({
        title: 'Weighted Avg',
        key: 'weightedAvg',
        width: 120,
        align: 'center',
        fixed: 'right',
        render: (_, record) => {
          let totalWeight = 0, weightedSum = 0, hasAny = false
          gradeItems.forEach((gi) => {
            const score = getScore(record.studentId, gi.id, record.scores[gi.id])
            if (score !== undefined && gi.maxScore > 0) {
              weightedSum += (score / gi.maxScore) * 100 * gi.weight
              totalWeight += gi.weight
              hasAny = true
            }
          })
          if (!hasAny) return <Text type="secondary">—</Text>
          const avg = totalWeight > 0 ? weightedSum / totalWeight : 0
          const letter = getLetterGrade(avg)
          return (
            <Space direction="vertical" size={0} style={{ textAlign: 'center' }}>
              <Text strong style={{ fontSize: 15 }}>{avg.toFixed(1)}%</Text>
              <Tag color={LETTER_COLORS[letter] ?? 'default'} style={{ margin: 0 }}>{letter}</Tag>
            </Space>
          )
        },
      })
    }

    return cols
  }, [gradeItems, getScore, handleScoreChange, editedScores, canEdit])

  // History table columns
  const historyColumns: ColumnsType<HistoryRow> = [
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (name: string, r: HistoryRow) => (
        <div
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/sis/students/${r.studentId}`)}
        >
          <Text strong style={{ color: '#1677ff' }}>{name}</Text>
        </div>
      ),
    },
    {
      title: 'Academic Standing',
      dataIndex: 'academicStanding',
      key: 'standing',
      width: 160,
      render: (s: string) => (
        <Tag color={STANDING_COLORS[s] ?? 'default'}>{s.replace(/_/g, ' ')}</Tag>
      ),
    },
    {
      title: 'Class Avg',
      dataIndex: 'gradeAverage',
      key: 'avg',
      width: 120,
      render: (v: number | null) => {
        if (v === null) return <Text type="secondary">—</Text>
        return (
          <Space>
            <Text strong style={{ color: v >= 70 ? '#52c41a' : v >= 60 ? '#fa8c16' : '#f5222d' }}>{v}%</Text>
            <Tag color={LETTER_COLORS[getLetterGrade(v)] ?? 'default'}>{getLetterGrade(v)}</Tag>
          </Space>
        )
      },
    },
    ...gradeItems.map(gi => ({
      title: gi.name,
      key: `hist_${gi.id}`,
      width: 110,
      align: 'center' as const,
      render: (_: unknown, r: HistoryRow) => {
        const g = r.grades.find(g => g.itemName === gi.name)
        if (!g || g.score === null) return <Text type="secondary">—</Text>
        const pct = (g.score / g.maxScore) * 100
        return (
          <Tooltip title={g.gradedAt ? `Graded: ${new Date(g.gradedAt).toLocaleDateString()}` : ''}>
            <Space direction="vertical" size={0} style={{ textAlign: 'center' }}>
              <Text style={{ fontSize: 13 }}>{g.score}/{g.maxScore}</Text>
              <Progress
                percent={Math.round(pct)}
                size="small"
                showInfo={false}
                strokeColor={pct >= 70 ? '#52c41a' : pct >= 60 ? '#fa8c16' : '#f5222d'}
                style={{ width: 70, margin: 0 }}
              />
            </Space>
          </Tooltip>
        )
      },
    })),
  ]

  return (
    <div>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <ClipboardCheck size={22} />
            <Title level={4} style={{ margin: 0 }}>Grade Management</Title>
          </Space>
        </Col>
        <Col>
          <Space wrap>
            {selectedCourseId && (
              <Tooltip title="View full course detail">
                <Link to={`/sms/courses/${selectedCourseId}`}>
                  <Button icon={<ExternalLink size={14} />} size="small">Course</Button>
                </Link>
              </Tooltip>
            )}
            {selectedCourseId && canEdit && (
              <Button
                icon={<FileDown size={14} />}
                size="small"
                onClick={() => downloadFile(`/grades/template/${selectedCourseId}`)}
              >
                Download Template
              </Button>
            )}
            {selectedCourseId && (
              <Button
                icon={<FileDown size={14} />}
                size="small"
                onClick={() => downloadFile(`/grades/report/${selectedCourseId}`)}
              >
                Download Report
              </Button>
            )}
            {selectedCourseId && canEdit && (
              <Button
                icon={<UploadIcon size={14} />}
                size="small"
                onClick={() => setImportModalOpen(true)}
              >
                Import Excel
              </Button>
            )}
            {hasEdits && canEdit && (
              <Button
                type="primary"
                icon={<Save size={16} />}
                loading={saveMutation.isPending}
                onClick={handleSave}
              >
                Save Grades
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* Course selector + stats */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Select a course to manage grades"
              style={{ width: '100%' }}
              allowClear
              value={selectedCourseId}
              onChange={(val) => { setSelectedCourseId(val); setEditedScores({}) }}
              options={courses.map((c) => ({ label: `${c.code} — ${c.name}`, value: c.id }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
            />
          </Col>
          {courseStats && (
            <>
              <Col>
                <Statistic title="Class Average" value={courseStats.avg} suffix="%" valueStyle={{ fontSize: 18, color: courseStats.avg >= 70 ? '#52c41a' : '#fa8c16' }} />
              </Col>
              <Col>
                <Statistic title="Passing" value={`${courseStats.passing}/${courseStats.total}`} valueStyle={{ fontSize: 18, color: '#1677ff' }} />
              </Col>
              <Col>
                <Statistic title="At Risk" value={courseStats.atRisk} prefix={courseStats.atRisk > 0 ? <AlertTriangle size={14} /> : undefined} valueStyle={{ fontSize: 18, color: courseStats.atRisk > 0 ? '#f5222d' : '#52c41a' }} />
              </Col>
            </>
          )}
        </Row>
        {selectedCourse && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <BookOpen size={12} style={{ marginRight: 4 }} />
              {selectedCourse.name} · {enrollments.length} enrolled · {gradeItems.length} grade items
              {canEdit && gradeItems.length === 0 && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="info"
                  showIcon
                  message="No grade items found. Go to the course page to create Quiz, Assignment, Exam items first."
                  action={
                    <Link to={`/sms/courses/${selectedCourseId}`}>
                      <Button size="small" type="link">Set up course →</Button>
                    </Link>
                  }
                />
              )}
            </Text>
          </div>
        )}
      </Card>

      {/* Tabs: Grade Entry | Grade History */}
      {selectedCourseId ? (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'entry',
              label: <Space size={6}><ClipboardCheck size={14} />Grade Entry</Space>,
              children: (
                <Card>
                  {gradeItems.length === 0 && !gradesLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                      No grade items configured for this course. Create grade items from the course detail page.
                    </div>
                  ) : (
                    <Table<StudentRow>
                      rowKey="key"
                      columns={entryColumns}
                      dataSource={studentRows}
                      loading={gradesLoading}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      locale={{ emptyText: 'No students enrolled in this course.' }}
                      rowClassName={(record) => {
                        const hasEdited = Object.values(editedScores[record.studentId] ?? {}).some(v => v !== undefined)
                        return hasEdited ? 'ant-table-row-selected' : ''
                      }}
                    />
                  )}
                </Card>
              ),
            },
            {
              key: 'history',
              label: <Space size={6}><History size={14} />Grade History & Standing</Space>,
              children: (
                <Card>
                  <Alert
                    type="info"
                    showIcon
                    message="Academic standing is computed from the weighted average of all grade items. GOOD STANDING ≥70%, ACADEMIC WATCH ≥55%, PROBATION ≥40%, AT RISK <40%."
                    style={{ marginBottom: 16 }}
                  />
                  <Table<HistoryRow>
                    rowKey="studentId"
                    columns={historyColumns}
                    dataSource={historyRows}
                    loading={gradesLoading}
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: 'No students enrolled.' }}
                  />
                </Card>
              ),
            },
          ]}
        />
      ) : (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            <BarChart2 size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <div style={{ fontSize: 15 }}>Select a course above to view and manage grades</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>
              Grades entered here are immediately visible to students and parents, and update academic standing.
            </div>
          </div>
        </Card>
      )}

      {/* Import Modal */}
      <Modal
        title={<Space><UploadIcon size={16} /> Import Grades from Excel</Space>}
        open={importModalOpen}
        onCancel={() => { setImportModalOpen(false); setFileList([]) }}
        onOk={handleImport}
        okText="Import"
        confirmLoading={importing}
        okButtonProps={{ disabled: fileList.length === 0 }}
        width={560}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Use the template format"
          description={
            <span>
              Download the <Button type="link" size="small" style={{ padding: 0 }} onClick={() => downloadFile(`/grades/template/${selectedCourseId}`)}>grade template</Button> first, fill in scores for each student, then upload here. Column headers must match exactly.
            </span>
          }
        />
        <Upload.Dragger
          accept=".xlsx,.xls,.csv"
          maxCount={1}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: fl }) => setFileList(fl)}
        >
          <p style={{ fontSize: 24, color: '#1677ff' }}>📊</p>
          <p>Click or drag an Excel (.xlsx) or CSV file here</p>
          <p style={{ fontSize: 12, color: '#888' }}>Max 5 MB · .xlsx, .xls, .csv</p>
        </Upload.Dragger>
      </Modal>
    </div>
  )
}

export default GradeManagementPage
