import { useState } from 'react'
import {
  Card, Row, Col, Typography, Space, Table, Tag, Badge, Button, DatePicker,
  Statistic, Spin, Modal, List, Alert,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  Users, UserCheck, Clock, UserX, CalendarOff,
  AlertTriangle, ChevronRight, Play,
} from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'

const { Title, Text } = Typography

// ─── Types ────────────────────────────────────────────────────────

interface SummaryData {
  totalStaff: number
  present: number
  late: number
  absent: number
  onLeave: number
  byDepartment: { dept: string; present: number; late: number; absent: number }[]
}

interface TeacherRecord {
  id: string
  teacherId: string
  teacherName: string
  department: string
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  checkInAt: string | null
  checkOutAt: string | null
  lateMinutes: number
}

interface Anomaly {
  teacherId: string
  teacherName: string
  ruleTriggered: 'FREQUENT_ABSENCE' | 'FREQUENT_LATENESS' | 'CONSECUTIVE_ABSENCE'
  count: number
  threshold: number
}

// ─── Stat card ────────────────────────────────────────────────────

function StatCard({
  title, value, icon, color, onClick, active,
}: {
  title: string; value: number; icon: React.ReactNode
  color: string; onClick: () => void; active: boolean
}) {
  return (
    <Card
      bordered={false}
      style={{
        borderRadius: 12,
        cursor: 'pointer',
        border: active ? `2px solid ${color}` : '2px solid transparent',
        background: active ? `${color}12` : undefined,
        transition: 'all 0.2s',
      }}
      onClick={onClick}
    >
      <Statistic
        title={<Space>{icon}<span>{title}</span></Space>}
        value={value}
        valueStyle={{ color }}
      />
    </Card>
  )
}

// ─── Anomaly badge ────────────────────────────────────────────────

const anomalyBadge: Record<Anomaly['ruleTriggered'], { color: string; label: string }> = {
  FREQUENT_ABSENCE: { color: 'red', label: 'Frequent Absence' },
  FREQUENT_LATENESS: { color: 'orange', label: 'Frequent Lateness' },
  CONSECUTIVE_ABSENCE: { color: 'red', label: 'Consecutive Absence' },
}

// ─── Department table ─────────────────────────────────────────────

function DeptBreakdownTable({
  data, onDeptClick,
}: {
  data: SummaryData['byDepartment']
  onDeptClick: (dept: string) => void
}) {
  const columns: ColumnsType<(typeof data)[number]> = [
    {
      title: 'Department', dataIndex: 'dept', key: 'dept', width: 180,
      render: (v: string) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => onDeptClick(v)}>{v}</Button>
      ),
    },
    { title: 'Present', dataIndex: 'present', key: 'present', render: v => <Text style={{ color: '#52c41a' }}>{v}</Text> },
    { title: 'Late', dataIndex: 'late', key: 'late', render: v => <Text style={{ color: '#faad14' }}>{v}</Text> },
    { title: 'Absent', dataIndex: 'absent', key: 'absent', render: v => <Text style={{ color: '#ff4d4f' }}>{v}</Text> },
  ]
  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="dept"
      size="small"
      pagination={false}
      onRow={row => ({ onClick: () => onDeptClick(row.dept), style: { cursor: 'pointer' } })}
    />
  )
}

// ─── Teacher list modal ───────────────────────────────────────────

function TeacherListModal({
  open, onClose, records, filter, title, onViewTeacher,
}: {
  open: boolean; onClose: () => void
  records: TeacherRecord[]; filter: string | null
  title: string
  onViewTeacher: (teacherId: string) => void
}) {
  const filtered = filter ? records.filter(r => r.status === filter) : records
  const columns: ColumnsType<TeacherRecord> = [
    {
      title: 'Name', dataIndex: 'teacherName', key: 'teacherName',
      render: (v: string, row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => onViewTeacher(row.teacherId)}>{v}</Button>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: s => {
        const color = s === 'PRESENT' ? 'success' : s === 'LATE' ? 'warning' : 'error'
        return <Tag color={color}>{s}</Tag>
      },
    },
    {
      title: 'Check In', dataIndex: 'checkInAt', key: 'checkInAt',
      render: v => v ? new Date(v).toLocaleTimeString('en-BN', { hour: '2-digit', minute: '2-digit' }) : '—',
    },
    {
      title: 'Late (min)', dataIndex: 'lateMinutes', key: 'lateMinutes',
      render: v => v > 0 ? <Text type="warning">{v}</Text> : '—',
    },
  ]
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={title}
      width={720}
    >
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10 }}
        onRow={row => ({ onClick: () => onViewTeacher(row.teacherId), style: { cursor: 'pointer' } })}
      />
    </Modal>
  )
}

// ─── Main component ───────────────────────────────────────────────

export default function StaffAttendanceDashboard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const role = user?.role ?? ''

  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [teacherModalOpen, setTeacherModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('Staff')
  const [deptFilter, setDeptFilter] = useState<string | null>(null)

  const dateStr = selectedDate.format('YYYY-MM-DD')

  // Summary
  const { data: summary, isLoading: sumLoading } = useQuery<SummaryData>({
    queryKey: ['staffAttendanceSummary', dateStr],
    queryFn: async () => {
      const endpoint = role === 'hod' ? `/staff-attendance/department-summary?date=${dateStr}` : `/staff-attendance/school-summary?date=${dateStr}`
      const r = await api.get(endpoint)
      return r.data.data as SummaryData
    },
    enabled: ['admin', 'manager', 'principal', 'hod'].includes(role),
  })

  // Daily records for teacher list modal (admin/manager/principal)
  const { data: dailyData } = useQuery<{ records: TeacherRecord[] }>({
    queryKey: ['staffDailyRecords', dateStr],
    queryFn: async () => {
      const r = await api.get(`/staff-attendance/daily-records?date=${dateStr}`)
      return r.data.data as { records: TeacherRecord[] }
    },
    enabled: teacherModalOpen && role !== 'hod',
  })

  // Dept records for HOD or dept-filtered modal
  const { data: deptData } = useQuery<{ records: TeacherRecord[] }>({
    queryKey: ['staffDeptDetail', dateStr, deptFilter],
    queryFn: async () => {
      const deptParam = deptFilter ? `&dept=${encodeURIComponent(deptFilter)}` : ''
      const r = await api.get(`/staff-attendance/department-summary?date=${dateStr}${deptParam}`)
      return r.data.data as { records: TeacherRecord[] }
    },
    enabled: teacherModalOpen && (role === 'hod' || deptFilter !== null),
  })

  // Anomalies
  const { data: anomalies, isLoading: anomLoading } = useQuery<Anomaly[]>({
    queryKey: ['staffAttendanceAnomalies'],
    queryFn: async () => {
      const r = await api.get('/staff-attendance/anomalies')
      return r.data.data as Anomaly[]
    },
    enabled: ['admin', 'manager', 'principal', 'hod'].includes(role),
  })

  // Daily close
  const dailyCloseMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post('/staff-attendance/run-daily-close', {})
      return r.data
    },
    onSuccess: (d) => {
      Modal.success({ title: 'Daily Close Complete', content: `${d.data.markedAbsent} staff marked absent.` })
      qc.invalidateQueries({ queryKey: ['staffAttendanceSummary'] })
    },
  })

  const chartData = (summary?.byDepartment ?? []).map(d => ({
    dept: d.dept,
    Present: d.present,
    Late: d.late,
    Absent: d.absent,
  }))

  const openStatModal = (filter: string | null, label: string) => {
    setActiveFilter(filter)
    setDeptFilter(null)
    setModalTitle(`Staff — ${label}`)
    setTeacherModalOpen(true)
  }

  const openDeptModal = (dept: string) => {
    setActiveFilter(null)
    setDeptFilter(dept)
    setModalTitle(`Department: ${dept}`)
    setTeacherModalOpen(true)
  }

  const handleViewTeacher = (teacherId: string) => {
    setTeacherModalOpen(false)
    navigate(`/attendance/staff/${teacherId}`)
  }

  // Determine which records to show in modal
  const modalRecords: TeacherRecord[] = (() => {
    if (deptFilter !== null) return deptData?.records ?? []
    if (role === 'hod') return deptData?.records ?? []
    return dailyData?.records ?? []
  })()

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <Users size={20} />
            <Title level={4} style={{ margin: 0 }}>{t('attendance.staffDashboard', 'Staff Attendance Dashboard')}</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <DatePicker
              value={selectedDate}
              onChange={d => d && setSelectedDate(d)}
              allowClear={false}
            />
            {['admin', 'manager'].includes(role) && (
              <Button
                icon={<Play size={14} />}
                onClick={() => Modal.confirm({
                  title: 'Run Daily Close',
                  content: 'Mark all unchecked staff as ABSENT?',
                  onOk: () => dailyCloseMutation.mutate(),
                })}
                loading={dailyCloseMutation.isPending}
              >
                {t('attendance.dailyClose', 'Daily Close')}
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {sumLoading ? (
        <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* Stat cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={8} md={4}>
              <StatCard
                title={t('attendance.totalStaff', 'Total Staff')}
                value={summary?.totalStaff ?? 0}
                icon={<Users size={14} />}
                color="#1677ff"
                onClick={() => openStatModal(null, 'All')}
                active={teacherModalOpen && activeFilter === null && deptFilter === null}
              />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <StatCard
                title={t('attendance.present', 'Present')}
                value={summary?.present ?? 0}
                icon={<UserCheck size={14} />}
                color="#52c41a"
                onClick={() => openStatModal('PRESENT', 'Present')}
                active={activeFilter === 'PRESENT'}
              />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <StatCard
                title={t('attendance.late', 'Late')}
                value={summary?.late ?? 0}
                icon={<Clock size={14} />}
                color="#faad14"
                onClick={() => openStatModal('LATE', 'Late')}
                active={activeFilter === 'LATE'}
              />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <StatCard
                title={t('attendance.absent', 'Absent')}
                value={summary?.absent ?? 0}
                icon={<UserX size={14} />}
                color="#ff4d4f"
                onClick={() => openStatModal('ABSENT', 'Absent')}
                active={activeFilter === 'ABSENT'}
              />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <StatCard
                title={t('attendance.onLeave', 'On Leave')}
                value={summary?.onLeave ?? 0}
                icon={<CalendarOff size={14} />}
                color="#722ed1"
                onClick={() => openStatModal('ON_LEAVE', 'On Leave')}
                active={activeFilter === 'ON_LEAVE'}
              />
            </Col>
          </Row>

          {/* Chart + dept table */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} md={14}>
              <Card
                title={t('attendance.deptBreakdown', 'Department Breakdown')}
                bordered={false}
                style={{ borderRadius: 12 }}
                extra={<Text type="secondary" style={{ fontSize: 12 }}>Click a bar to drill down</Text>}
              >
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={chartData}
                      barSize={16}
                      onClick={e => {
                        if (e?.activeLabel) openDeptModal(e.activeLabel as string)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <XAxis dataKey="dept" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Present" fill="#52c41a" />
                      <Bar dataKey="Late" fill="#faad14" />
                      <Bar dataKey="Absent" fill="#ff4d4f" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Text type="secondary">{t('common.noData', 'No data for selected date')}</Text>
                )}
              </Card>
            </Col>
            <Col xs={24} md={10}>
              <Card
                title={t('attendance.byDepartment', 'By Department')}
                bordered={false}
                style={{ borderRadius: 12 }}
                extra={<Text type="secondary" style={{ fontSize: 12 }}>Click a row to drill down</Text>}
              >
                <DeptBreakdownTable data={summary?.byDepartment ?? []} onDeptClick={openDeptModal} />
              </Card>
            </Col>
          </Row>

          {/* Anomaly widget */}
          <Card
            title={
              <Space>
                <AlertTriangle size={16} style={{ color: '#ff4d4f' }} />
                <span>{t('attendance.anomalies', 'Attendance Anomalies')}</span>
                {anomalies && anomalies.length > 0 && (
                  <Badge count={anomalies.length} style={{ backgroundColor: '#ff4d4f' }} />
                )}
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            {anomLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : (anomalies?.length ?? 0) === 0 ? (
              <Alert
                type="success"
                message={t('attendance.noAnomalies', 'No anomalies detected — all staff attendance looks good.')}
                showIcon
              />
            ) : (
              <List
                dataSource={anomalies}
                renderItem={item => {
                  const badge = anomalyBadge[item.ruleTriggered]
                  return (
                    <List.Item
                      extra={
                        <Button
                          size="small"
                          type="link"
                          icon={<ChevronRight size={14} />}
                          onClick={() => navigate(`/attendance/staff/${item.teacherId}`)}
                        >
                          View
                        </Button>
                      }
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{item.teacherName}</Text>
                            <Tag color={badge.color}>{badge.label}</Tag>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.count} occurrences — threshold {item.threshold}
                          </Text>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
            )}
          </Card>
        </>
      )}

      {/* Teacher detail modal */}
      <TeacherListModal
        open={teacherModalOpen}
        onClose={() => setTeacherModalOpen(false)}
        records={modalRecords}
        filter={deptFilter !== null ? null : activeFilter}
        title={modalTitle}
        onViewTeacher={handleViewTeacher}
      />
    </div>
  )
}
