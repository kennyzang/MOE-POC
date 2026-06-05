import { useState } from 'react'
import {
  Tabs,
  Table,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Select,
  DatePicker,
  Space,
  Tag,
  Progress,
  Alert,
  Spin,
  Typography,
  Divider,
  Input,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import {
  FileBarChart2,
  Users,
  GraduationCap,
  Building2,
  Download,
  RefreshCw,
  UserCheck,
  School,
} from 'lucide-react'
import api from '../../lib/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

// ─── CSV export helper ─────────────────────────────────────────────
function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const rows = [keys.join(','), ...data.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Pie-like bar breakdown ────────────────────────────────────────
function BreakdownBars({ data, colorMap }: { data: Record<string, number>; colorMap?: Record<string, string> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  if (total === 0) return <Text type="secondary">No data</Text>
  const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#722ED1', '#f5222d', '#13c2c2', '#eb2f96']
  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      {Object.entries(data).map(([label, count], i) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
            <Text style={{ fontSize: 12 }}>{label}</Text>
            <Text style={{ fontSize: 12 }}>{count} ({Math.round((count / total) * 100)}%)</Text>
          </div>
          <Progress
            percent={Math.round((count / total) * 100)}
            strokeColor={colorMap?.[label] || COLORS[i % COLORS.length]}
            showInfo={false}
            size="small"
          />
        </div>
      ))}
    </Space>
  )
}

export default function ManagementReportsPage() {
  const [activeTab, setActiveTab] = useState('staff-mc')

  // ── Staff MC filters ──────────────────────────────────────────
  const [mcDates, setMcDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [mcDept, setMcDept] = useState('')

  const mcQuery = useQuery({
    queryKey: ['report-mc', mcDates, mcDept],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (mcDates) { params.set('dateFrom', mcDates[0].toISOString()); params.set('dateTo', mcDates[1].toISOString()) }
      if (mcDept) params.set('department', mcDept)
      const { data } = await api.get(`/reports/staff/mc?${params}`)
      return data
    },
    enabled: activeTab === 'staff-mc',
  })

  // ── All Leave filters ─────────────────────────────────────────
  const [leaveDates, setLeaveDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [leaveType, setLeaveType] = useState('')
  const [leaveDept, setLeaveDept] = useState('')

  const leaveQuery = useQuery({
    queryKey: ['report-leave', leaveDates, leaveType, leaveDept],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (leaveDates) { params.set('dateFrom', leaveDates[0].toISOString()); params.set('dateTo', leaveDates[1].toISOString()) }
      if (leaveType) params.set('leaveType', leaveType)
      if (leaveDept) params.set('department', leaveDept)
      const { data } = await api.get(`/reports/staff/leave?${params}`)
      return data
    },
    enabled: activeTab === 'staff-leave',
  })

  // ── Staff Demographics ────────────────────────────────────────
  const staffDemographicsQuery = useQuery({
    queryKey: ['report-staff-demo'],
    queryFn: async () => { const { data } = await api.get('/reports/staff/demographics'); return data },
    enabled: activeTab === 'staff-demographics',
  })

  // ── Financial Aid filters ─────────────────────────────────────
  const [aidType, setAidType] = useState('')
  const financialAidQuery = useQuery({
    queryKey: ['report-financial-aid', aidType],
    queryFn: async () => {
      const params = aidType ? `?aidType=${aidType}` : ''
      const { data } = await api.get(`/reports/students/financial-aid${params}`)
      return data
    },
    enabled: activeTab === 'financial-aid',
  })

  // ── Hostel ────────────────────────────────────────────────────
  const [hostelFilter, setHostelFilter] = useState('')
  const hostelQuery = useQuery({
    queryKey: ['report-hostel', hostelFilter],
    queryFn: async () => {
      const params = hostelFilter ? `?hostelName=${hostelFilter}` : ''
      const { data } = await api.get(`/reports/students/hostel${params}`)
      return data
    },
    enabled: activeTab === 'hostel',
  })

  // ── Bus ───────────────────────────────────────────────────────
  const [routeFilter, setRouteFilter] = useState('')
  const busQuery = useQuery({
    queryKey: ['report-bus', routeFilter],
    queryFn: async () => {
      const params = routeFilter ? `?route=${routeFilter}` : ''
      const { data } = await api.get(`/reports/students/bus${params}`)
      return data
    },
    enabled: activeTab === 'bus',
  })

  // ── Student Demographics ──────────────────────────────────────
  const studentDemographicsQuery = useQuery({
    queryKey: ['report-student-demo'],
    queryFn: async () => { const { data } = await api.get('/reports/students/demographics'); return data },
    enabled: activeTab === 'student-demographics',
  })

  // ── School Profile ────────────────────────────────────────────
  const schoolProfileQuery = useQuery({
    queryKey: ['report-school-profile'],
    queryFn: async () => { const { data } = await api.get('/reports/school/profile-summary'); return data },
    enabled: activeTab === 'school-profile',
  })

  // ── Attendance Summary ────────────────────────────────────────
  const [attMonth, setAttMonth] = useState(dayjs())
  const attendanceSummaryQuery = useQuery({
    queryKey: ['report-attendance', attMonth.month(), attMonth.year()],
    queryFn: async () => {
      const { data } = await api.get(`/reports/school/attendance-summary?month=${attMonth.month() + 1}&year=${attMonth.year()}`)
      return data
    },
    enabled: activeTab === 'attendance-summary',
  })

  // ── Facility Utilization ──────────────────────────────────────
  const [facilityType, setFacilityType] = useState('')
  const facilityQuery = useQuery({
    queryKey: ['report-facility', facilityType],
    queryFn: async () => {
      const params = facilityType ? `?type=${facilityType}` : ''
      const { data } = await api.get(`/reports/school/facility-utilization${params}`)
      return data
    },
    enabled: activeTab === 'facility',
  })

  // ─── Column definitions ────────────────────────────────────────
  const mcColumns: ColumnsType<any> = [
    { title: 'Name', dataIndex: 'teacherName', key: 'teacherName' },
    { title: 'Staff ID', dataIndex: 'staffId', key: 'staffId', width: 110 },
    { title: 'Position', dataIndex: 'position', key: 'position' },
    { title: 'Department', dataIndex: 'department', key: 'department' },
    { title: 'Type', dataIndex: 'staffType', key: 'staffType', width: 120, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'MC Start', dataIndex: 'mcStartDate', key: 'mcStartDate', width: 110, render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'MC End', dataIndex: 'mcEndDate', key: 'mcEndDate', width: 110, render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Days', dataIndex: 'duration', key: 'duration', width: 70 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 130, render: (v: string) => <Tag color={v.includes('APPROVED') ? 'green' : 'orange'}>{v.replace(/_/g, ' ')}</Tag> },
  ]

  const leaveColumns: ColumnsType<any> = [
    { title: 'Name', dataIndex: 'teacherName', key: 'teacherName' },
    { title: 'Staff ID', dataIndex: 'staffId', key: 'staffId', width: 110 },
    { title: 'Department', dataIndex: 'department', key: 'department' },
    { title: 'Leave Type', dataIndex: 'leaveType', key: 'leaveType', width: 140, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Start', dataIndex: 'startDate', key: 'startDate', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'End', dataIndex: 'endDate', key: 'endDate', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Days', dataIndex: 'duration', key: 'duration', width: 70 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 150, render: (v: string) => <Tag color={v.includes('APPROVED') ? 'green' : v === 'REJECTED' ? 'red' : 'orange'}>{v.replace(/_/g, ' ')}</Tag> },
  ]

  const financialAidColumns: ColumnsType<any> = [
    { title: 'Student Name', dataIndex: 'studentName', key: 'studentName' },
    { title: 'Student ID', dataIndex: 'studentId', key: 'studentId', width: 110 },
    { title: 'Class', dataIndex: 'className', key: 'className', width: 90 },
    { title: 'Aid Type', dataIndex: 'aidType', key: 'aidType', width: 150, render: (v: string) => <Tag color="gold">{v.replace(/_/g, ' ')}</Tag> },
    { title: 'Amount (BND)', dataIndex: 'amount', key: 'amount', width: 130, render: (v: number) => v ? `$${v.toFixed(2)}` : '—' },
    { title: 'Start Date', dataIndex: 'startDate', key: 'startDate', width: 110, render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'End Date', dataIndex: 'endDate', key: 'endDate', width: 110, render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Status', dataIndex: 'eligibilityStatus', key: 'eligibilityStatus', width: 100, render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag> },
  ]

  const hostelColumns: ColumnsType<any> = [
    { title: 'Student Name', dataIndex: 'studentName', key: 'studentName' },
    { title: 'Class', dataIndex: 'className', key: 'className', width: 90 },
    { title: 'Hostel', dataIndex: 'hostelName', key: 'hostelName' },
    { title: 'Room', dataIndex: 'roomNumber', key: 'roomNumber', width: 90 },
    { title: 'Check-In', dataIndex: 'checkInDate', key: 'checkInDate', width: 110, render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Emergency Contact', dataIndex: 'emergencyContact', key: 'emergencyContact' },
    { title: 'Semester', dataIndex: 'semester', key: 'semester', width: 110 },
  ]

  const busColumns: ColumnsType<any> = [
    { title: 'Student Name', dataIndex: 'studentName', key: 'studentName' },
    { title: 'Class', dataIndex: 'className', key: 'className', width: 90 },
    { title: 'Route', dataIndex: 'busRoute', key: 'busRoute' },
    { title: 'Bus No.', dataIndex: 'busNumber', key: 'busNumber', width: 100 },
    { title: 'Provider', dataIndex: 'provider', key: 'provider' },
    { title: 'Pick-Up', dataIndex: 'pickupPoint', key: 'pickupPoint' },
    { title: 'Drop-Off', dataIndex: 'dropoffPoint', key: 'dropoffPoint' },
  ]

  const facilityColumns: ColumnsType<any> = [
    { title: 'Facility', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 100 },
    { title: 'Capacity', dataIndex: 'capacity', key: 'capacity', width: 90 },
    { title: 'Location', dataIndex: 'location', key: 'location' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <Tag color={v === 'available' ? 'green' : v === 'maintenance' ? 'orange' : 'blue'}>{v}</Tag> },
    { title: 'Bookings (30d)', dataIndex: 'bookingsLast30d', key: 'bookingsLast30d', width: 120 },
    { title: 'Utilization', dataIndex: 'utilizationPct', key: 'utilizationPct', width: 130, render: (v: number) => <Progress percent={v} size="small" strokeColor={v > 80 ? '#f5222d' : v > 50 ? '#fa8c16' : '#52c41a'} /> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <FileBarChart2 size={22} />
        <Title level={4} style={{ margin: 0 }}>Management Dashboard Reports</Title>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          // ── RP-01: MC Report ──────────────────────────────────
          {
            key: 'staff-mc',
            label: <Space><UserCheck size={14} />MC Report</Space>,
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <div>
                    <Title level={5} style={{ margin: 0 }}>RP-01 — Staff Currently on Medical Leave</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>Real-time view of all staff on MC (approved or HOD-approved)</Text>
                  </div>
                  <Space wrap>
                    <RangePicker size="small" onChange={(v) => setMcDates(v as any)} />
                    <Input.Search size="small" placeholder="Filter by department" allowClear onSearch={setMcDept} style={{ width: 180 }} />
                    <Button size="small" icon={<Download size={13} />} onClick={() => exportCSV(mcQuery.data?.data || [], 'mc-report.csv')}>Export CSV</Button>
                    <Button size="small" icon={<RefreshCw size={13} />} loading={mcQuery.isFetching} onClick={() => mcQuery.refetch()}>Refresh</Button>
                  </Space>
                </div>
                {mcQuery.data && (
                  <Row gutter={16} style={{ marginBottom: 12 }}>
                    <Col><Statistic title="Total on MC" value={mcQuery.data.meta?.total ?? 0} valueStyle={{ color: '#f5222d' }} /></Col>
                  </Row>
                )}
                <Table rowKey="id" columns={mcColumns} dataSource={mcQuery.data?.data || []} loading={mcQuery.isLoading} pagination={{ pageSize: 15 }} size="small" />
              </Card>
            ),
          },
          // ── RP-02: Leave Report ───────────────────────────────
          {
            key: 'staff-leave',
            label: <Space><Users size={14} />All Leave</Space>,
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <div>
                    <Title level={5} style={{ margin: 0 }}>RP-02 — Teachers on Leave & Unpaid Leave</Title>
                  </div>
                  <Space wrap>
                    <RangePicker size="small" onChange={(v) => setLeaveDates(v as any)} />
                    <Select size="small" placeholder="Leave type" allowClear style={{ width: 160 }} onChange={setLeaveType}>
                      {['ANNUAL', 'MEDICAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'HAJJ', 'COMPASSIONATE'].map(t =>
                        <Option key={t} value={t}>{t}</Option>
                      )}
                    </Select>
                    <Input.Search size="small" placeholder="Department" allowClear onSearch={setLeaveDept} style={{ width: 160 }} />
                    <Button size="small" icon={<Download size={13} />} onClick={() => exportCSV(leaveQuery.data?.data || [], 'leave-report.csv')}>Export CSV</Button>
                  </Space>
                </div>
                {leaveQuery.data?.meta && (
                  <Row gutter={16} style={{ marginBottom: 12 }}>
                    <Col><Statistic title="Total Records" value={leaveQuery.data.meta.total} /></Col>
                    {Object.entries(leaveQuery.data.meta.byType || {}).slice(0, 4).map(([k, v]) => (
                      <Col key={k}><Statistic title={k} value={v as number} /></Col>
                    ))}
                  </Row>
                )}
                <Table rowKey="id" columns={leaveColumns} dataSource={leaveQuery.data?.data || []} loading={leaveQuery.isLoading} pagination={{ pageSize: 15 }} size="small" />
              </Card>
            ),
          },
          // ── RP-03: Staff Demographics ─────────────────────────
          {
            key: 'staff-demographics',
            label: <Space><Users size={14} />Staff Demographics</Space>,
            children: (
              <Card>
                <Title level={5} style={{ margin: '0 0 16px' }}>RP-03 — Staff Demographics Summary</Title>
                {staffDemographicsQuery.isLoading ? <Spin /> : staffDemographicsQuery.data?.data ? (
                  <Row gutter={[16, 16]}>
                    <Col xs={24}>
                      <Statistic title="Total Active Staff" value={staffDemographicsQuery.data.data.total} />
                      <Divider />
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" title="By Staff Type">
                        <BreakdownBars data={staffDemographicsQuery.data.data.byStaffType} />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" title="By Qualification">
                        <BreakdownBars data={staffDemographicsQuery.data.data.byQualification} />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" title="By Age Group">
                        <BreakdownBars data={staffDemographicsQuery.data.data.ageGroups} />
                      </Card>
                    </Col>
                  </Row>
                ) : <Alert type="info" message="No data available." />}
              </Card>
            ),
          },
          // ── RP-04: Financial Aid ──────────────────────────────
          {
            key: 'financial-aid',
            label: <Space><GraduationCap size={14} />Financial Aid</Space>,
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <div>
                    <Title level={5} style={{ margin: 0 }}>RP-04 — Students Receiving Financial Aid</Title>
                  </div>
                  <Space>
                    <Select size="small" placeholder="Aid type" allowClear style={{ width: 160 }} onChange={setAidType}>
                      {['SCHOLARSHIP', 'BURSARY', 'MEAL_SUBSIDY', 'BOOK_ALLOWANCE', 'OTHER'].map(t =>
                        <Option key={t} value={t}>{t.replace(/_/g, ' ')}</Option>
                      )}
                    </Select>
                    <Button size="small" icon={<Download size={13} />} onClick={() => exportCSV(financialAidQuery.data?.data || [], 'financial-aid.csv')}>Export CSV</Button>
                  </Space>
                </div>
                {financialAidQuery.data?.meta && (
                  <Row gutter={16} style={{ marginBottom: 12 }}>
                    <Col><Statistic title="Total Recipients" value={financialAidQuery.data.meta.total} /></Col>
                    <Col><Statistic title="Total Aid (BND)" value={financialAidQuery.data.meta.totalAmount?.toFixed(2)} prefix="$" /></Col>
                  </Row>
                )}
                <Table rowKey="id" columns={financialAidColumns} dataSource={financialAidQuery.data?.data || []} loading={financialAidQuery.isLoading} pagination={{ pageSize: 15 }} size="small" />
              </Card>
            ),
          },
          // ── RP-05: Hostel ─────────────────────────────────────
          {
            key: 'hostel',
            label: <Space><Building2 size={14} />Hostel</Space>,
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <div>
                    <Title level={5} style={{ margin: 0 }}>RP-05 — Students Living in Hostel</Title>
                  </div>
                  <Space>
                    <Input.Search size="small" placeholder="Filter by hostel name" allowClear onSearch={setHostelFilter} style={{ width: 200 }} />
                    <Button size="small" icon={<Download size={13} />} onClick={() => exportCSV(hostelQuery.data?.data || [], 'hostel-report.csv')}>Export CSV</Button>
                  </Space>
                </div>
                {hostelQuery.data?.meta && (
                  <Row gutter={16} style={{ marginBottom: 12 }}>
                    <Col><Statistic title="Total Hostel Students" value={hostelQuery.data.meta.total} /></Col>
                    {Object.entries(hostelQuery.data.meta.byHostel || {}).map(([k, v]) => (
                      <Col key={k}><Statistic title={k} value={v as number} /></Col>
                    ))}
                  </Row>
                )}
                <Table rowKey="id" columns={hostelColumns} dataSource={hostelQuery.data?.data || []} loading={hostelQuery.isLoading} pagination={{ pageSize: 15 }} size="small" />
              </Card>
            ),
          },
          // ── RP-06: Bus ────────────────────────────────────────
          {
            key: 'bus',
            label: <Space><Building2 size={14} />School Bus</Space>,
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <div>
                    <Title level={5} style={{ margin: 0 }}>RP-06 — Students Using School Bus</Title>
                  </div>
                  <Space>
                    <Input.Search size="small" placeholder="Filter by route" allowClear onSearch={setRouteFilter} style={{ width: 180 }} />
                    <Button size="small" icon={<Download size={13} />} onClick={() => exportCSV(busQuery.data?.data || [], 'bus-report.csv')}>Export CSV</Button>
                  </Space>
                </div>
                {busQuery.data?.meta && (
                  <Row gutter={16} style={{ marginBottom: 12 }}>
                    <Col><Statistic title="Total Bus Students" value={busQuery.data.meta.total} /></Col>
                    {Object.entries(busQuery.data.meta.byRoute || {}).slice(0, 3).map(([k, v]) => (
                      <Col key={k}><Statistic title={k} value={v as number} /></Col>
                    ))}
                  </Row>
                )}
                <Table rowKey="id" columns={busColumns} dataSource={busQuery.data?.data || []} loading={busQuery.isLoading} pagination={{ pageSize: 15 }} size="small" />
              </Card>
            ),
          },
          // ── RP-07: Student Demographics ───────────────────────
          {
            key: 'student-demographics',
            label: <Space><GraduationCap size={14} />Student Demo</Space>,
            children: (
              <Card>
                <Title level={5} style={{ margin: '0 0 16px' }}>RP-07 — Student Demographics Summary</Title>
                {studentDemographicsQuery.isLoading ? <Spin /> : studentDemographicsQuery.data?.data ? (
                  <Row gutter={[16, 16]}>
                    <Col xs={24}>
                      <Row gutter={16}>
                        <Col><Statistic title="Total Enrolled" value={studentDemographicsQuery.data.data.total} /></Col>
                        <Col><Statistic title="SEN Students" value={studentDemographicsQuery.data.data.senCount} valueStyle={{ color: '#722ED1' }} /></Col>
                      </Row>
                      <Divider />
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" title="By Gender">
                        <BreakdownBars data={studentDemographicsQuery.data.data.byGender} />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" title="By Nationality">
                        <BreakdownBars data={studentDemographicsQuery.data.data.byNationality} />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" title="By Grade Level">
                        <BreakdownBars data={studentDemographicsQuery.data.data.byGrade} />
                      </Card>
                    </Col>
                  </Row>
                ) : <Alert type="info" message="No data available." />}
              </Card>
            ),
          },
          // ── RP-08: School Profile ─────────────────────────────
          {
            key: 'school-profile',
            label: <Space><School size={14} />School Profile</Space>,
            children: (
              <Card>
                <Title level={5} style={{ margin: '0 0 16px' }}>RP-08 — School Profile Summary</Title>
                {schoolProfileQuery.isLoading ? <Spin /> : (
                  <Row gutter={[16, 16]}>
                    {(schoolProfileQuery.data?.data || []).map((s: any) => (
                      <Col xs={24} key={s.id}>
                        <Card size="small" title={<Space><Building2 size={14} />{s.name} <Tag color="blue">{s.code}</Tag><Tag>{s.schoolType}</Tag><Tag color="purple">{s.authority}</Tag></Space>}>
                          <Row gutter={[16, 8]}>
                            <Col xs={12} md={4}><Statistic title="Students" value={s.totalStudents} /></Col>
                            <Col xs={12} md={4}><Statistic title="Teaching Staff" value={s.totalTeachingStaff} /></Col>
                            <Col xs={12} md={4}><Statistic title="Non-Teaching" value={s.totalNonTeachingStaff} /></Col>
                            <Col xs={12} md={4}><Statistic title="Facilities" value={s.totalFacilities} /></Col>
                            <Col xs={24} md={8}>
                              <Text type="secondary" style={{ fontSize: 12 }}>Principal: </Text><Text>{s.principal}</Text><br />
                              <Text type="secondary" style={{ fontSize: 12 }}>Address: </Text><Text>{s.address}</Text><br />
                              {s.motto && <><Text type="secondary" style={{ fontSize: 12 }}>Motto: </Text><Text italic>{s.motto}</Text></>}
                            </Col>
                          </Row>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </Card>
            ),
          },
          // ── RP-09: Attendance Summary ─────────────────────────
          {
            key: 'attendance-summary',
            label: <Space><UserCheck size={14} />Attendance</Space>,
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>RP-09 — Monthly Attendance Summary</Title>
                  <DatePicker picker="month" size="small" value={attMonth} onChange={(v) => v && setAttMonth(v)} />
                </div>
                {attendanceSummaryQuery.isLoading ? <Spin /> : attendanceSummaryQuery.data?.data ? (() => {
                  const d = attendanceSummaryQuery.data.data
                  return (
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={12}>
                        <Card size="small" title="Student Attendance">
                          <Row gutter={8}>
                            <Col span={8}><Statistic title="Total Records" value={d.students.total} /></Col>
                            <Col span={8}><Statistic title="Present" value={d.students.present} valueStyle={{ color: '#52c41a' }} /></Col>
                            <Col span={8}><Statistic title="Absent" value={d.students.absent} valueStyle={{ color: '#f5222d' }} /></Col>
                          </Row>
                          <div style={{ marginTop: 12 }}>
                            <Text>Attendance Rate</Text>
                            <Progress percent={d.students.rate} strokeColor={d.students.rate >= 90 ? '#52c41a' : d.students.rate >= 75 ? '#fa8c16' : '#f5222d'} />
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} md={12}>
                        <Card size="small" title="Staff Attendance">
                          <Row gutter={8}>
                            <Col span={8}><Statistic title="Total Records" value={d.staff.total} /></Col>
                            <Col span={8}><Statistic title="Present" value={d.staff.present} valueStyle={{ color: '#52c41a' }} /></Col>
                            <Col span={8}><Statistic title="Absent" value={d.staff.absent} valueStyle={{ color: '#f5222d' }} /></Col>
                          </Row>
                          <div style={{ marginTop: 12 }}>
                            <Text>Attendance Rate</Text>
                            <Progress percent={d.staff.rate} strokeColor={d.staff.rate >= 90 ? '#52c41a' : d.staff.rate >= 75 ? '#fa8c16' : '#f5222d'} />
                          </div>
                        </Card>
                      </Col>
                      {Object.keys(d.staff.byDepartment || {}).length > 0 && (
                        <Col xs={24}>
                          <Card size="small" title="Staff by Department">
                            <Table
                              size="small"
                              rowKey={(r) => r.dept}
                              dataSource={Object.entries(d.staff.byDepartment).map(([dept, v]: any) => ({ dept, ...v }))}
                              columns={[
                                { title: 'Department', dataIndex: 'dept', key: 'dept' },
                                { title: 'Present', dataIndex: 'present', key: 'present', width: 90 },
                                { title: 'Late', dataIndex: 'late', key: 'late', width: 90 },
                                { title: 'Absent', dataIndex: 'absent', key: 'absent', width: 90 },
                              ]}
                              pagination={false}
                            />
                          </Card>
                        </Col>
                      )}
                    </Row>
                  )
                })() : <Alert type="info" message="No data for selected period." />}
              </Card>
            ),
          },
          // ── RP-10: Facility Utilization ───────────────────────
          {
            key: 'facility',
            label: <Space><Building2 size={14} />Facilities</Space>,
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>RP-10 — Facility Utilization Report</Title>
                  <Space>
                    <Select size="small" placeholder="Facility type" allowClear style={{ width: 140 }} onChange={setFacilityType}>
                      {['classroom', 'lab', 'hall', 'sports', 'office'].map(t => <Option key={t} value={t}>{t}</Option>)}
                    </Select>
                    <Button size="small" icon={<Download size={13} />} onClick={() => exportCSV(facilityQuery.data?.data || [], 'facility-report.csv')}>Export CSV</Button>
                  </Space>
                </div>
                <Table rowKey="id" columns={facilityColumns} dataSource={facilityQuery.data?.data || []} loading={facilityQuery.isLoading} pagination={{ pageSize: 15 }} size="small" />
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}
