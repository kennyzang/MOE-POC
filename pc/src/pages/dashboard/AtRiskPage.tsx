import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  Select,
  Table,
  Tag,
  Typography,
  Button,
  Spin,
  Empty,
  Progress,
  Tooltip,
  Badge,
} from 'antd'
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
  RefreshCw,
  UserCheck,
} from 'lucide-react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useTranslation } from 'react-i18next'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography

const GRADE_LEVELS = [
  'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11',
]

interface StudentRisk {
  studentId: string
  studentDbId: string
  name: string
  gradeLevel: string
  className: string
  attendanceRate: number
  gradesTrend: 'declining' | 'flat' | 'improving'
  recentAvgScore: number
  riskScore: number
  riskLevel: 'HIGH' | 'MONITOR' | 'OK'
  confidence: number
  counselorNotified: boolean
  weeklyAttendance: number[]
  weeklyScores: number[]
}

const RiskBadge = ({ level }: { level: StudentRisk['riskLevel'] }) => {
  const { t } = useTranslation()
  const config = {
    HIGH:    { color: '#f53f3f', bg: '#fff1f0', label: t('atRisk.highRisk') },
    MONITOR: { color: '#ff7d00', bg: '#fff7e6', label: t('atRisk.monitor') },
    OK:      { color: '#00b42a', bg: '#f0fff4', label: t('atRisk.ok') },
  }[level]

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: config.bg, color: config.color,
      fontWeight: 600, fontSize: 12,
      padding: '2px 8px', borderRadius: 12,
      border: `1px solid ${config.color}30`,
    }}>
      {level === 'HIGH' && <AlertTriangle size={11} />}
      {config.label}
    </span>
  )
}

const TrendIcon = ({ trend }: { trend: StudentRisk['gradesTrend'] }) => {
  if (trend === 'declining') return <TrendingDown size={14} color="#f53f3f" />
  if (trend === 'improving') return <TrendingUp size={14} color="#00b42a" />
  return <Minus size={14} color="#86909c" />
}

const StudentChart = ({ student }: { student: StudentRisk }) => {
  const { t } = useTranslation()
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']
  const data = weeks.map((week, i) => ({
    week,
    attendance: student.weeklyAttendance[i] ?? null,
    score: i < student.weeklyScores.length ? student.weeklyScores[i < student.weeklyScores.length ? i : student.weeklyScores.length - 1] : null,
  })).filter(d => d.attendance !== null)

  return (
    <div style={{ padding: '12px 24px 12px 0' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>{t('atRisk.trendChart')}</Text>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <RechartTooltip
            formatter={(value, name) => [`${value as number}%`, (name as string) === 'attendance' ? 'Attendance' : 'Score']}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="attendance" fill="#165DFF" fillOpacity={0.2} stroke="#165DFF" name="Attendance" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#f53f3f"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Score"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

const AtRiskPage = () => {
  const { t } = useTranslation()
  const [selectedGrade, setSelectedGrade] = useState<string>('Year 7')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const {
    data: riskData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['atRisk', selectedGrade],
    queryFn: async () => {
      const res = await api.get(`/ai/risk-report/${encodeURIComponent(selectedGrade)}`)
      return (res.data.data ?? []) as StudentRisk[]
    },
    enabled: !!selectedGrade,
  })

  const students = riskData ?? []
  const highCount = students.filter(s => s.riskLevel === 'HIGH').length
  const monitorCount = students.filter(s => s.riskLevel === 'MONITOR').length

  // Pre-sorted by riskScore desc for stable ranking
  const rankedStudents = [...students].sort((a, b) => b.riskScore - a.riskScore)
  const rankMap = new Map(rankedStudents.map((s, i) => [s.studentDbId, i + 1]))

  const columns: ColumnsType<StudentRisk> = [
    {
      title: t('atRisk.rank'),
      key: 'rank',
      width: 64,
      render: (_: unknown, record: StudentRisk) => (
        <Text strong style={{ color: rankMap.get(record.studentDbId) === 1 ? '#f53f3f' : undefined }}>
          #{rankMap.get(record.studentDbId)}
        </Text>
      ),
    },
    {
      title: t('atRisk.student'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div>
          <Link to={`/sis/students/${record.studentDbId}`}>
            <Text strong style={{ color: '#1677ff' }}>{name}</Text>
          </Link>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.studentId} · {record.className}
          </Text>
        </div>
      ),
    },
    {
      title: t('atRisk.attendance'),
      dataIndex: 'attendanceRate',
      key: 'attendanceRate',
      width: 130,
      sorter: (a, b) => a.attendanceRate - b.attendanceRate,
      render: (rate: number) => (
        <div>
          <Text style={{ color: rate < 60 ? '#f53f3f' : rate < 75 ? '#ff7d00' : '#00b42a', fontWeight: 600 }}>
            {rate}%
          </Text>
          <Progress
            percent={rate}
            size="small"
            showInfo={false}
            strokeColor={rate < 60 ? '#f53f3f' : rate < 75 ? '#ff7d00' : '#00b42a'}
            style={{ marginTop: 2, marginBottom: 0 }}
          />
        </div>
      ),
    },
    {
      title: t('atRisk.gradeTrend'),
      dataIndex: 'gradesTrend',
      key: 'gradesTrend',
      width: 120,
      render: (trend: StudentRisk['gradesTrend'], record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendIcon trend={trend} />
          <div>
            <Text style={{ fontSize: 12, display: 'block', textTransform: 'capitalize' }}>{trend}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>avg {record.recentAvgScore}%</Text>
          </div>
        </div>
      ),
    },
    {
      title: t('atRisk.riskLevel'),
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 130,
      filters: [
        { text: 'HIGH', value: 'HIGH' },
        { text: 'MONITOR', value: 'MONITOR' },
        { text: 'OK', value: 'OK' },
      ],
      onFilter: (value, record) => record.riskLevel === value,
      sorter: (a, b) => {
        const order = { HIGH: 2, MONITOR: 1, OK: 0 }
        return order[a.riskLevel] - order[b.riskLevel]
      },
      defaultSortOrder: 'descend',
      render: (level: StudentRisk['riskLevel']) => <RiskBadge level={level} />,
    },
    {
      title: t('atRisk.confidence'),
      dataIndex: 'confidence',
      key: 'confidence',
      width: 110,
      render: (confidence: number) => (
        <Tooltip title={t('atRisk.confidenceTip')}>
          <Text style={{ fontSize: 13 }}>{confidence}%</Text>
        </Tooltip>
      ),
    },
    {
      title: t('common.status'),
      key: 'status',
      width: 150,
      render: (_: unknown, record: StudentRisk) => (
        record.counselorNotified
          ? (
            <Tag icon={<UserCheck size={11} style={{ marginRight: 4 }} />} color="orange" style={{ fontSize: 11 }}>
              {t('atRisk.counselorNotified')}
            </Tag>
          )
          : (
            <Tag color="default" style={{ fontSize: 11 }}>–</Tag>
          )
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <AlertTriangle size={18} style={{ marginRight: 8, verticalAlign: 'middle', color: '#f53f3f' }} />
            {t('nav.atRisk')}
          </Title>
          <Text type="secondary">{t('atRisk.subtitle')}</Text>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Select
            value={selectedGrade}
            onChange={setSelectedGrade}
            style={{ width: 140 }}
            options={GRADE_LEVELS.map(g => ({ value: g, label: g }))}
          />
          <Button
            icon={<RefreshCw size={14} />}
            onClick={() => refetch()}
            loading={isFetching}
          >
            {t('atRisk.refresh')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <Card size="small" style={{ flex: 1, border: '1px solid #ffa39e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={20} color="#f53f3f" />
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f53f3f', lineHeight: 1 }}>{highCount}</div>
              <div style={{ fontSize: 12, color: '#86909c' }}>{t('atRisk.highRisk')}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, border: '1px solid #ffd591' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={20} color="#ff7d00" />
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#ff7d00', lineHeight: 1 }}>{monitorCount}</div>
              <div style={{ fontSize: 12, color: '#86909c' }}>{t('atRisk.monitor')}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1, border: '1px solid #b7eb8f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={20} color="#00b42a" />
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#00b42a', lineHeight: 1 }}>
                {students.length - highCount - monitorCount}
              </div>
              <div style={{ fontSize: 12, color: '#86909c' }}>{t('atRisk.ok')}</div>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ flex: 1 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{students.length}</div>
            <div style={{ fontSize: 12, color: '#86909c' }}>{t('atRisk.totalIn', { grade: selectedGrade })}</div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card bodyStyle={{ padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin size="large" tip={t('atRisk.analysing')} />
          </div>
        ) : students.length === 0 ? (
          <Empty
            description={t('atRisk.noStudents', { grade: selectedGrade })}
            style={{ padding: 40 }}
          />
        ) : (
          <Table
            dataSource={students}
            columns={columns}
            rowKey="studentDbId"
            pagination={false}
            size="middle"
            rowClassName={(record) => {
              if (record.riskLevel === 'HIGH') return 'ant-table-row-danger'
              return ''
            }}
            expandable={{
              expandedRowKeys: expandedRow ? [expandedRow] : [],
              onExpand: (expanded, record) => {
                setExpandedRow(expanded ? record.studentDbId : null)
              },
              expandedRowRender: (record) => <StudentChart student={record} />,
              rowExpandable: () => true,
              expandRowByClick: false,
            }}
            style={{ borderRadius: 0 }}
          />
        )}
      </Card>

      {/* Legend */}
      <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 12, color: '#86909c' }}>
        <span>{t('atRisk.factorTitle')}</span>
        <span>• {t('atRisk.factorAtt60')}</span>
        <span>• {t('atRisk.factorAtt75')}</span>
        <span>• {t('atRisk.factorDeclining')}</span>
        <span>• {t('atRisk.factorLowScore')}</span>
        <span>• {t('atRisk.factorThreshold')}</span>
      </div>

      <style>{`
        .ant-table-row-danger > td {
          background: #fff8f8 !important;
        }
      `}</style>
    </div>
  )
}

export default AtRiskPage
