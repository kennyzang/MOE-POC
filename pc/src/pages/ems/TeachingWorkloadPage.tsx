import { useState, useMemo } from 'react'
import {
  Table, Select, Tag, Card, Space, Row, Col, Typography,
  Button, Tooltip, Empty, Spin,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, LayoutGrid, List, ArrowLeft } from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

interface SlotData {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  gradeLevel: string
  className: string | null
  room: string | null
  semester: string
  course: { id: string; code: string; name: string; creditHours: number }
  teacher: { department: string | null; user: { displayName: string } }
  teacherId: string
}

interface TeacherSummary {
  teacherId: string
  teacherName: string
  department: string
  totalPeriods: number
  subjects: string[]
}

const COURSE_COLORS = [
  '#165DFF', '#722ED1', '#FA8C16', '#52C41A',
  '#13C2C2', '#F5222D', '#EB2F96', '#1890FF',
]

const TeachingWorkloadPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isTeacher = user?.role === 'teacher'

  const [selectedTeacherId, setSelectedTeacherId] = useState<string | undefined>(undefined)
  const [semesterFilter, setSemesterFilter] = useState<string | undefined>(undefined)
  const [viewMode, setViewMode] = useState<'summary' | 'timetable'>('summary')

  // Summary query (no teacher selected)
  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['workload-summary', semesterFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (semesterFilter) params.set('semester', semesterFilter)
      const { data } = await api.get(`/courses/workload-timetable?${params}`)
      return data.data as TeacherSummary[]
    },
    enabled: viewMode === 'summary' && !isTeacher,
  })

  // Timetable query (teacher selected or is teacher)
  const { data: timetableData, isLoading: loadingTimetable } = useQuery({
    queryKey: ['workload-timetable', selectedTeacherId, semesterFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedTeacherId) params.set('teacherId', selectedTeacherId)
      if (semesterFilter) params.set('semester', semesterFilter)
      const { data } = await api.get(`/courses/workload-timetable?${params}`)
      return data.data as SlotData[]
    },
    enabled: viewMode === 'timetable' || isTeacher,
  })

  const teacherOptions = useMemo(() => (summaryData ?? []).map(t => ({ label: t.teacherName, value: t.teacherId })), [summaryData])

  // Build unique time periods from slots
  const timePeriods = useMemo(() => {
    if (!timetableData) return []
    const times = [...new Set(timetableData.map(s => s.startTime))].sort()
    return times
  }, [timetableData])

  // Color map per course
  const courseColorMap = useMemo(() => {
    if (!timetableData) return {}
    const ids = [...new Set(timetableData.map(s => s.course.id))]
    const map: Record<string, string> = {}
    ids.forEach((id, i) => { map[id] = COURSE_COLORS[i % COURSE_COLORS.length]! })
    return map
  }, [timetableData])

  // Build slot lookup: dayOfWeek → startTime → slot
  const slotLookup = useMemo(() => {
    const lookup: Record<number, Record<string, SlotData>> = {}
    if (!timetableData) return lookup
    for (const slot of timetableData) {
      if (!lookup[slot.dayOfWeek]) lookup[slot.dayOfWeek] = {}
      lookup[slot.dayOfWeek]![slot.startTime] = slot
    }
    return lookup
  }, [timetableData])

  // Summary table columns
  const summaryColumns: ColumnsType<TeacherSummary> = [
    {
      title: 'Teacher',
      dataIndex: 'teacherName',
      key: 'teacherName',
      render: (name: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.department}</Text>
        </Space>
      ),
    },
    {
      title: 'Periods / Week',
      dataIndex: 'totalPeriods',
      key: 'totalPeriods',
      width: 130,
      align: 'center',
      sorter: (a, b) => b.totalPeriods - a.totalPeriods,
      render: (n: number) => (
        <Tag color={n >= 20 ? 'red' : n >= 15 ? 'orange' : 'blue'} style={{ fontWeight: 700, fontSize: 14 }}>
          {n}
        </Tag>
      ),
    },
    {
      title: 'Subjects Taught',
      dataIndex: 'subjects',
      key: 'subjects',
      render: (subjects: string[]) => (
        <Space wrap>
          {subjects.map(s => <Tag key={s}>{s}</Tag>)}
        </Space>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 120,
      render: (_: unknown, record) => (
        <Tooltip title="View timetable">
          <Button
            size="small"
            icon={<LayoutGrid size={13} />}
            onClick={() => { setSelectedTeacherId(record.teacherId); setViewMode('timetable') }}
          >
            Timetable
          </Button>
        </Tooltip>
      ),
    },
  ]

  // Timetable grid: rows are time periods, columns are days
  const timetableColumns: ColumnsType<{ startTime: string }> = [
    {
      title: 'Period',
      dataIndex: 'startTime',
      key: 'time',
      width: 90,
      fixed: 'left',
      render: (t: string) => {
        // Find end time from any slot with this startTime
        const slot = timetableData?.find(s => s.startTime === t)
        return (
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {t}{slot ? `–${slot.endTime}` : ''}
          </Text>
        )
      },
    },
    ...([0, 1, 2, 3, 4] as const).map(day => ({
      title: <Text strong style={{ fontSize: 13 }}>{DAY_SHORT[day]}</Text>,
      key: `day-${day}`,
      width: 160,
      render: (_: unknown, record: { startTime: string }) => {
        const slot = slotLookup[day]?.[record.startTime]
        if (!slot) return <div style={{ minHeight: 52, background: '#fafafa', borderRadius: 4 }} />
        const color = courseColorMap[slot.course.id] ?? '#8c8c8c'
        return (
          <div style={{
            background: `${color}15`,
            border: `1px solid ${color}40`,
            borderLeft: `4px solid ${color}`,
            borderRadius: 4,
            padding: '6px 8px',
            minHeight: 52,
          }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1d2129', lineHeight: 1.3 }}>{slot.course.name}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              {slot.gradeLevel}{slot.className ? ` · ${slot.className}` : ''}
              {slot.room ? ` · ${slot.room}` : ''}
            </div>
          </div>
        )
      },
    })),
  ]

  const timetableTeacherName = timetableData?.[0]?.teacher?.user?.displayName

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <BookOpen size={22} />
            <Title level={4} style={{ margin: 0 }}>{t('workload.title', 'Teaching Workload')}</Title>
          </Space>
        </Col>
        {!isTeacher && viewMode === 'summary' && (
          <Col>
            <Button
              icon={<LayoutGrid size={14} />}
              onClick={() => setViewMode('timetable')}
              disabled={!selectedTeacherId}
            >
              View Timetable
            </Button>
          </Col>
        )}
        {viewMode === 'timetable' && !isTeacher && (
          <Col>
            <Button icon={<List size={14} />} onClick={() => { setViewMode('summary'); setSelectedTeacherId(undefined) }}>
              <ArrowLeft size={13} style={{ marginRight: 4 }} />
              Back to Overview
            </Button>
          </Col>
        )}
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {!isTeacher && viewMode === 'summary' && (
            <Col xs={24} sm={12} md={8}>
              <Select
                placeholder="Filter by teacher"
                allowClear
                style={{ width: '100%' }}
                value={selectedTeacherId}
                onChange={v => setSelectedTeacherId(v)}
                options={teacherOptions}
              />
            </Col>
          )}
          {!isTeacher && viewMode === 'timetable' && (
            <Col xs={24} sm={12} md={8}>
              <Select
                placeholder="Select teacher"
                allowClear
                style={{ width: '100%' }}
                value={selectedTeacherId}
                onChange={v => setSelectedTeacherId(v)}
                options={teacherOptions}
                loading={loadingSummary}
              />
            </Col>
          )}
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="All semesters"
              allowClear
              style={{ width: '100%' }}
              value={semesterFilter}
              onChange={v => setSemesterFilter(v)}
              options={[
                { label: '2026-S1', value: '2026-S1' },
                { label: '2026-S2', value: '2026-S2' },
                { label: '2025-S2', value: '2025-S2' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* SUMMARY VIEW */}
      {(viewMode === 'summary' && !isTeacher) && (
        <Card>
          {loadingSummary ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin />
            </div>
          ) : !summaryData || summaryData.length === 0 ? (
            <Empty description="No workload data found" />
          ) : (
            <Table<TeacherSummary>
              rowKey="teacherId"
              columns={summaryColumns}
              dataSource={summaryData}
              pagination={false}
              size="small"
            />
          )}
        </Card>
      )}

      {/* TIMETABLE VIEW */}
      {(viewMode === 'timetable' || isTeacher) && (
        <Card
          title={
            timetableTeacherName
              ? <Space><LayoutGrid size={16} /><span>Timetable — {timetableTeacherName}</span></Space>
              : <Space><LayoutGrid size={16} /><span>Select a teacher to view their timetable</span></Space>
          }
        >
          {loadingTimetable ? (
            <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
          ) : !timetableData || (timetableData.length === 0 && selectedTeacherId) ? (
            <Empty description="No timetable slots found for this teacher" />
          ) : !selectedTeacherId && !isTeacher ? (
            <Empty description="Select a teacher from the filter above" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <>
              {/* Legend */}
              {timetableData && timetableData.length > 0 && (
                <Space wrap style={{ marginBottom: 12 }}>
                  {[...new Map(timetableData.map(s => [s.course.id, s.course])).values()].map(c => (
                    <Tag
                      key={c.id}
                      style={{
                        background: `${courseColorMap[c.id]}15`,
                        borderColor: `${courseColorMap[c.id]}60`,
                        color: courseColorMap[c.id],
                      }}
                    >
                      {c.name}
                    </Tag>
                  ))}
                </Space>
              )}
              <div style={{ overflowX: 'auto' }}>
                <Table<{ startTime: string }>
                  rowKey="startTime"
                  columns={timetableColumns}
                  dataSource={timePeriods.map(t => ({ startTime: t }))}
                  pagination={false}
                  size="small"
                  bordered
                  scroll={{ x: 900 }}
                />
              </div>
              {/* Summary row */}
              {timetableData && timetableData.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
                  {([0, 1, 2, 3, 4] as const).map(day => {
                    const count = timetableData.filter(s => s.dayOfWeek === day).length
                    return (
                      <div key={day} style={{ textAlign: 'center', minWidth: 60 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>{DAYS[day]}</Text>
                        <div style={{ fontWeight: 700, color: count === 0 ? '#d9d9d9' : '#1677ff' }}>{count}p</div>
                      </div>
                    )
                  })}
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Total: </Text>
                    <Text strong>{timetableData.length} periods / week</Text>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  )
}

export default TeachingWorkloadPage
