import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, Row, Col, Statistic, Tag, Typography, Spin, Empty, Table, Space, Input, Select, Tooltip, Alert } from 'antd'
import {
  Landmark, ShieldAlert, CalendarClock, AlertTriangle, Building2, Users,
  CheckCircle2, FileWarning, Search,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import api from '@/lib/api'

const { Title, Text } = Typography

interface DashboardData {
  kpis: {
    totalSchools: number
    activeLicenses: number
    expiringSoon: number
    expired: number
    suspended: number
    overdueFollowUps: number
    openFindings: number
    totalStudentCapacity: number
  }
  schoolsByStatus: Record<string, number>
  schoolsByDistrict: Record<string, number>
  snapshot: string
}

interface SchoolRow {
  id: string
  name: string
  code: string
  schoolType: string
  district: string | null
  curriculumModel: string | null
  studentCapacity: number
  registrationNo: string | null
  ownerOrganisation: string | null
  licenseStatus: string
  licenseNumber: string | null
  licenseExpiry: string | null
  lastInspectionDate: string | null
  lastInspectionRating: string | null
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  ACTIVE:         { color: '#52c41a', label: 'Active' },
  EXPIRING_SOON:  { color: '#faad14', label: 'Expiring soon' },
  EXPIRED:        { color: '#ff4d4f', label: 'Expired' },
  SUSPENDED:      { color: '#cf1322', label: 'Suspended' },
  REVOKED:        { color: '#820014', label: 'Revoked' },
  UNLICENSED:     { color: '#8c8c8c', label: 'Unlicensed' },
}

const RATING_COLOR: Record<string, string> = {
  EXCELLENT: '#52c41a',
  GOOD: '#73d13d',
  SATISFACTORY: '#faad14',
  NEEDS_IMPROVEMENT: '#fa8c16',
  UNSATISFACTORY: '#ff4d4f',
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

const PrivateEdDashboardPage = () => {
  const navigate = useNavigate()
  const [districtFilter, setDistrictFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['priv-ed-dashboard'],
    queryFn: async () => (await api.get('/private-ed/dashboard')).data.data,
  })

  const { data: schools = [], isLoading: schoolsLoading } = useQuery<SchoolRow[]>({
    queryKey: ['priv-ed-schools', districtFilter, statusFilter, search],
    queryFn: async () => {
      const { data } = await api.get('/private-ed/schools', {
        params: {
          ...(districtFilter ? { district: districtFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(search ? { search } : {}),
        },
      })
      return data.data
    },
  })

  const districtOptions = useMemo(() => {
    if (!dashboard) return []
    return Object.keys(dashboard.schoolsByDistrict).map((d) => ({ value: d, label: d }))
  }, [dashboard])

  if (dashLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!dashboard) return <Empty description="No data" />

  const k = dashboard.kpis
  const hasCritical = k.suspended > 0 || k.expired > 0 || k.overdueFollowUps > 0

  const columns = [
    {
      title: 'School',
      key: 'school',
      render: (_: unknown, r: SchoolRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.code} · {r.registrationNo ?? 'No reg.'}</div>
        </div>
      ),
    },
    {
      title: 'District',
      dataIndex: 'district',
      key: 'district',
      width: 130,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Curriculum',
      dataIndex: 'curriculumModel',
      key: 'curriculumModel',
      width: 110,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Capacity',
      dataIndex: 'studentCapacity',
      key: 'studentCapacity',
      width: 90,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: 'License',
      key: 'license',
      width: 180,
      render: (_: unknown, r: SchoolRow) => {
        const meta = STATUS_META[r.licenseStatus] ?? STATUS_META.UNLICENSED
        const days = daysUntil(r.licenseExpiry)
        return (
          <div>
            <Tag color={meta.color} style={{ marginBottom: 2 }}>{meta.label}</Tag>
            {r.licenseExpiry && (
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                {days !== null && days < 0
                  ? `Expired ${-days}d ago`
                  : days !== null
                    ? `Expires in ${days}d`
                    : ''}
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Last inspection',
      key: 'inspection',
      width: 170,
      render: (_: unknown, r: SchoolRow) => {
        if (!r.lastInspectionDate) return <Text type="secondary">Never</Text>
        const date = new Date(r.lastInspectionDate).toLocaleDateString()
        const color = r.lastInspectionRating ? RATING_COLOR[r.lastInspectionRating] : '#8c8c8c'
        return (
          <div>
            <div style={{ fontSize: 12 }}>{date}</div>
            {r.lastInspectionRating && (
              <Tag color={color} style={{ fontSize: 11, marginTop: 2 }}>
                {r.lastInspectionRating.replace(/_/g, ' ')}
              </Tag>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space size={12}>
            <Landmark size={26} style={{ color: '#165DFF' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>Private Education Oversight</Title>
              <Text type="secondary">
                Department of Private Education (DPE) · {dashboard.kpis.totalSchools} institutions ·
                snapshot {new Date(dashboard.snapshot).toLocaleString()}
              </Text>
            </div>
          </Space>
          <Tag color="blue" style={{ fontSize: 12, padding: '4px 10px' }}>
            Brunei Darussalam · MOE
          </Tag>
        </Space>
      </Card>

      {hasCritical && (
        <Alert
          type="error"
          showIcon
          icon={<ShieldAlert size={16} />}
          message="Critical compliance actions outstanding"
          description={
            <Space split="·">
              {k.suspended > 0 && <Text>{k.suspended} suspended license(s)</Text>}
              {k.expired > 0 && <Text>{k.expired} expired license(s)</Text>}
              {k.overdueFollowUps > 0 && <Text>{k.overdueFollowUps} overdue inspection follow-up(s)</Text>}
            </Space>
          }
        />
      )}

      {/* KPI tiles */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => { setStatusFilter(undefined); setSearch('') }}>
            <Statistic
              title={<Space size={6}><Building2 size={14} /> Total private schools</Space>}
              value={k.totalSchools}
              valueStyle={{ color: '#165DFF' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => setStatusFilter('ACTIVE')}>
            <Statistic
              title={<Space size={6}><CheckCircle2 size={14} /> Active licenses</Space>}
              value={k.activeLicenses}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => setStatusFilter('EXPIRING_SOON')}>
            <Statistic
              title={<Space size={6}><CalendarClock size={14} /> Expiring in 90 days</Space>}
              value={k.expiringSoon}
              valueStyle={{ color: k.expiringSoon > 0 ? '#faad14' : '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Tooltip title="Click to view suspended or expired licenses">
            <Card hoverable onClick={() => setStatusFilter('SUSPENDED')} style={k.suspended + k.expired > 0 ? { borderColor: '#ff4d4f' } : undefined}>
              <Statistic
                title={<Space size={6}><AlertTriangle size={14} /> Suspended / Expired</Space>}
                value={k.suspended + k.expired}
                valueStyle={{ color: (k.suspended + k.expired) > 0 ? '#ff4d4f' : '#8c8c8c' }}
              />
            </Card>
          </Tooltip>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={<Space size={6}><FileWarning size={14} /> Open inspection findings</Space>}
              value={k.openFindings}
              valueStyle={{ color: k.openFindings > 0 ? '#fa8c16' : '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={<Space size={6}><AlertTriangle size={14} /> Overdue follow-ups</Space>}
              value={k.overdueFollowUps}
              valueStyle={{ color: k.overdueFollowUps > 0 ? '#ff4d4f' : '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={<Space size={6}><Users size={14} /> Total student capacity</Space>}
              value={k.totalStudentCapacity}
              valueStyle={{ color: '#165DFF' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 6 }}>Schools by district</div>
            <Space wrap size={6}>
              {Object.entries(dashboard.schoolsByDistrict).map(([d, n]) => (
                <Tag key={d}>{d}: {n}</Tag>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* School table */}
      <Card
        title={<Space><Building2 size={16} /> Private schools</Space>}
        extra={
          <Space>
            <Input
              prefix={<Search size={14} />}
              placeholder="Search name or registration no."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 260 }}
            />
            <Select
              placeholder="All districts"
              allowClear
              value={districtFilter}
              onChange={setDistrictFilter}
              options={districtOptions}
              style={{ width: 160 }}
            />
            <Select
              placeholder="All statuses"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))}
              style={{ width: 160 }}
            />
          </Space>
        }
      >
        <Table<SchoolRow>
          rowKey="id"
          loading={schoolsLoading}
          dataSource={schools}
          columns={columns}
          pagination={{ pageSize: 20 }}
          onRow={(r) => ({
            onClick: () => navigate(`/private-ed/schools/${r.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  )
}

export default PrivateEdDashboardPage
