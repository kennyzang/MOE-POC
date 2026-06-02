import { useState } from 'react'
import {
  Card, Table, Tag, Typography, Space, Button, Select, DatePicker,
  Row, Col, Tabs, Statistic, Divider, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface McReportRow {
  id: string
  name: string
  staffId: string
  designation: string
  department: string
  staffType: string
  startDate: string
  endDate: string
  daysRequested: number
  status: string
  documentUrl?: string
}

interface AllLeaveRow {
  id: string
  name: string
  staffId: string
  department: string
  leaveType: string
  startDate: string
  endDate: string
  daysRequested: number
  status: string
}

const STATUS_COLOR: Record<string, string> = {
  HOD_APPROVED:       'processing',
  PRINCIPAL_APPROVED: 'success',
  PENDING:            'default',
}

const LEAVE_TYPE_COLOR: Record<string, string> = {
  ANNUAL:        'blue',
  MEDICAL:       'red',
  MATERNITY:     'pink',
  PATERNITY:     'purple',
  UNPAID:        'default',
  HAJJ:          'gold',
  COMPASSIONATE: 'orange',
  EMERGENCY:     'volcano',
}

const LeaveReportsPage = () => {
  const { t } = useTranslation()

  const today = dayjs()
  const [mcDateRange, setMcDateRange]         = useState<[string, string]>([today.startOf('month').format('YYYY-MM-DD'), today.format('YYYY-MM-DD')])
  const [mcDept, setMcDept]                   = useState<string | undefined>()
  const [allLeaveDateRange, setAllLeaveDateRange] = useState<[string, string]>([today.startOf('month').format('YYYY-MM-DD'), today.format('YYYY-MM-DD')])
  const [allLeaveDept, setAllLeaveDept]       = useState<string | undefined>()
  const [allLeaveType, setAllLeaveType]       = useState<string | undefined>()

  // MC Report
  const { data: mcData, isLoading: mcLoading, refetch: refetchMc } = useQuery<{ data: McReportRow[]; total: number }>({
    queryKey: ['report-mc', mcDateRange, mcDept],
    queryFn: async () => {
      const { data } = await api.get('/leave/reports/on-mc', {
        params: { dateFrom: mcDateRange[0], dateTo: mcDateRange[1], ...(mcDept ? { dept: mcDept } : {}) },
      })
      return data
    },
  })

  // All Leave Report
  const { data: allLeaveData, isLoading: allLeaveLoading, refetch: refetchAll } = useQuery<{ data: AllLeaveRow[]; total: number }>({
    queryKey: ['report-all-leave', allLeaveDateRange, allLeaveDept, allLeaveType],
    queryFn: async () => {
      const { data } = await api.get('/leave/reports/all-leave', {
        params: {
          dateFrom: allLeaveDateRange[0],
          dateTo:   allLeaveDateRange[1],
          ...(allLeaveDept  ? { dept:      allLeaveDept  } : {}),
          ...(allLeaveType  ? { leaveType: allLeaveType  } : {}),
        },
      })
      return data
    },
  })

  const handleExport = (reportType: 'mc' | 'all-leave', format: 'csv') => {
    const rows = reportType === 'mc' ? mcData?.data ?? [] : allLeaveData?.data ?? []
    if (rows.length === 0) { message.warning(t('reports.noDataToExport', 'No data to export')); return }

    const headers = reportType === 'mc'
      ? ['Name', 'Staff ID', 'Designation', 'Department', 'Staff Type', 'Start Date', 'End Date', 'Days', 'Status']
      : ['Name', 'Staff ID', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status']

    const csvRows = (rows as (McReportRow & AllLeaveRow)[]).map(r =>
      reportType === 'mc'
        ? [r.name, r.staffId, r.designation, r.department, r.staffType,
           new Date(r.startDate).toLocaleDateString(), new Date(r.endDate).toLocaleDateString(), r.daysRequested, r.status]
        : [r.name, r.staffId, r.department, r.leaveType,
           new Date(r.startDate).toLocaleDateString(), new Date(r.endDate).toLocaleDateString(), r.daysRequested, r.status]
    )

    const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${reportType === 'mc' ? 'mc-leave' : 'all-leave'}-report-${today.format('YYYYMMDD')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success(t('reports.exported', 'Report exported'))
  }

  // MC columns
  const mcColumns: ColumnsType<McReportRow> = [
    { title: t('reports.name', 'Name'),       dataIndex: 'name',         render: v => <Text strong>{v}</Text> },
    { title: t('reports.staffId', 'Staff ID'), dataIndex: 'staffId',      width: 100 },
    { title: t('reports.designation', 'Designation'), dataIndex: 'designation', width: 130 },
    { title: t('reports.department', 'Dept'),  dataIndex: 'department',   width: 120 },
    { title: t('reports.staffType', 'Type'),   dataIndex: 'staffType',    width: 110, render: v => <Tag>{v}</Tag> },
    {
      title: t('reports.mcStartDate', 'Start'),
      dataIndex: 'startDate',
      width: 100,
      render: v => new Date(v).toLocaleDateString(),
    },
    {
      title: t('reports.mcEndDate', 'End'),
      dataIndex: 'endDate',
      width: 100,
      render: v => new Date(v).toLocaleDateString(),
    },
    { title: t('reports.days', 'Days'), dataIndex: 'daysRequested', width: 60 },
    {
      title: t('reports.status', 'Status'),
      dataIndex: 'status',
      width: 140,
      render: s => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: t('reports.mcDoc', 'MC Doc'),
      dataIndex: 'documentUrl',
      width: 80,
      render: url => url
        ? <Button size="small" type="link">{t('reports.view', 'View')}</Button>
        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
  ]

  // All-leave columns
  const allLeaveColumns: ColumnsType<AllLeaveRow> = [
    { title: t('reports.name', 'Name'),       dataIndex: 'name',         render: v => <Text strong>{v}</Text> },
    { title: t('reports.staffId', 'Staff ID'), dataIndex: 'staffId',      width: 100 },
    { title: t('reports.department', 'Dept'),  dataIndex: 'department',   width: 120 },
    {
      title: t('reports.leaveType', 'Leave Type'),
      dataIndex: 'leaveType',
      width: 130,
      render: lt => <Tag color={LEAVE_TYPE_COLOR[lt] ?? 'default'}>{lt}</Tag>,
    },
    {
      title: t('reports.startDate', 'Start'),
      dataIndex: 'startDate',
      width: 100,
      render: v => new Date(v).toLocaleDateString(),
    },
    {
      title: t('reports.endDate', 'End'),
      dataIndex: 'endDate',
      width: 100,
      render: v => new Date(v).toLocaleDateString(),
    },
    { title: t('reports.days', 'Days'), dataIndex: 'daysRequested', width: 60 },
    {
      title: t('reports.status', 'Status'),
      dataIndex: 'status',
      width: 140,
      render: s => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s.replace(/_/g, ' ')}</Tag>,
    },
  ]

  return (
    <div>
      <Row align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space align="center" size={8}>
            <FileText size={22} />
            <Title level={4} style={{ margin: 0 }}>{t('leave.leaveReports', 'Leave Reports')}</Title>
          </Space>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="mc"
        items={[
          {
            key: 'mc',
            label: t('reports.mcReport', 'Medical Leave (MC) Report'),
            children: (
              <>
                {/* Filters */}
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Space wrap>
                    <RangePicker
                      defaultValue={[dayjs(mcDateRange[0]), dayjs(mcDateRange[1])]}
                      onChange={vals => {
                        if (vals?.[0] && vals?.[1]) {
                          setMcDateRange([vals[0].format('YYYY-MM-DD'), vals[1].format('YYYY-MM-DD')])
                        }
                      }}
                      format="DD MMM YYYY"
                    />
                    <Select
                      allowClear
                      placeholder={t('reports.filterDept', 'All Departments')}
                      style={{ width: 180 }}
                      onChange={setMcDept}
                      options={[
                        { value: 'Science',     label: 'Science' },
                        { value: 'Mathematics', label: 'Mathematics' },
                        { value: 'English',     label: 'English' },
                        { value: 'Bahasa Melayu', label: 'Bahasa Melayu' },
                        { value: 'Islamic Studies', label: 'Islamic Studies' },
                        { value: 'Physical Education', label: 'Physical Education' },
                      ]}
                    />
                    <Button icon={<RefreshCw size={14} />} onClick={() => refetchMc()}>
                      {t('common.refresh', 'Refresh')}
                    </Button>
                    <Button
                      icon={<Download size={14} />}
                      onClick={() => handleExport('mc', 'csv')}
                    >
                      {t('reports.exportCSV', 'Export CSV')}
                    </Button>
                  </Space>
                </Card>

                {/* Summary Stats */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={t('reports.totalOnMC', 'Total on MC')}
                        value={mcData?.total ?? 0}
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={t('reports.teaching', 'Teaching Staff')}
                        value={(mcData?.data ?? []).filter(r => r.staffType === 'TEACHING').length}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={t('reports.nonTeaching', 'Non-Teaching')}
                        value={(mcData?.data ?? []).filter(r => r.staffType !== 'TEACHING').length}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={t('reports.totalDays', 'Total Days')}
                        value={(mcData?.data ?? []).reduce((sum, r) => sum + r.daysRequested, 0)}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card>
                  <Table<McReportRow>
                    rowKey="id"
                    columns={mcColumns}
                    dataSource={mcData?.data ?? []}
                    loading={mcLoading}
                    pagination={{ pageSize: 15, showSizeChanger: true }}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: t('reports.noMcLeave', 'No staff on medical leave in this period') }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'all',
            label: t('reports.allLeaveReport', 'All Leave Report'),
            children: (
              <>
                {/* Filters */}
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Space wrap>
                    <RangePicker
                      defaultValue={[dayjs(allLeaveDateRange[0]), dayjs(allLeaveDateRange[1])]}
                      onChange={vals => {
                        if (vals?.[0] && vals?.[1]) {
                          setAllLeaveDateRange([vals[0].format('YYYY-MM-DD'), vals[1].format('YYYY-MM-DD')])
                        }
                      }}
                      format="DD MMM YYYY"
                    />
                    <Select
                      allowClear
                      placeholder={t('reports.allLeaveTypes', 'All Leave Types')}
                      style={{ width: 160 }}
                      onChange={setAllLeaveType}
                      options={[
                        'ANNUAL', 'MEDICAL', 'MATERNITY', 'PATERNITY',
                        'UNPAID', 'HAJJ', 'COMPASSIONATE', 'EMERGENCY',
                      ].map(lt => ({ value: lt, label: lt }))}
                    />
                    <Select
                      allowClear
                      placeholder={t('reports.filterDept', 'All Departments')}
                      style={{ width: 180 }}
                      onChange={setAllLeaveDept}
                      options={[
                        { value: 'Science',     label: 'Science' },
                        { value: 'Mathematics', label: 'Mathematics' },
                        { value: 'English',     label: 'English' },
                        { value: 'Bahasa Melayu', label: 'Bahasa Melayu' },
                      ]}
                    />
                    <Button icon={<RefreshCw size={14} />} onClick={() => refetchAll()}>
                      {t('common.refresh', 'Refresh')}
                    </Button>
                    <Button
                      icon={<Download size={14} />}
                      onClick={() => handleExport('all-leave', 'csv')}
                    >
                      {t('reports.exportCSV', 'Export CSV')}
                    </Button>
                  </Space>
                </Card>

                {/* Leave Type Breakdown */}
                {allLeaveData && allLeaveData.data.length > 0 && (
                  <Card size="small" style={{ marginBottom: 16 }}>
                    <Text strong style={{ marginRight: 12 }}>{t('reports.breakdown', 'Breakdown:')}</Text>
                    {Object.entries(LEAVE_TYPE_COLOR).map(([type, color]) => {
                      const count = allLeaveData.data.filter(r => r.leaveType === type).length
                      if (count === 0) return null
                      return (
                        <Tag key={type} color={color} style={{ marginBottom: 4 }}>
                          {type}: {count}
                        </Tag>
                      )
                    })}
                    <Divider type="vertical" />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('reports.totalEntries', 'Total: {{count}} entries', { count: allLeaveData.total })}
                    </Text>
                  </Card>
                )}

                <Card>
                  <Table<AllLeaveRow>
                    rowKey="id"
                    columns={allLeaveColumns}
                    dataSource={allLeaveData?.data ?? []}
                    loading={allLeaveLoading}
                    pagination={{ pageSize: 15, showSizeChanger: true }}
                    scroll={{ x: 800 }}
                    locale={{ emptyText: t('reports.noLeave', 'No leave records in this period') }}
                  />
                </Card>
              </>
            ),
          },
        ]}
      />
    </div>
  )
}

export default LeaveReportsPage
