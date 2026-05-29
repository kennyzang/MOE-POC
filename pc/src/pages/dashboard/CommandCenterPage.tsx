import { useState, useEffect, useRef } from 'react'
import { Card, Row, Col, Typography, Statistic, Spin, Alert, Tag, Button, Space, Tooltip, Modal, message } from 'antd'
import {
  Users,
  ClipboardList,
  CalendarCheck,
  UserCheck,
  GraduationCap,
  AlertTriangle,
  CalendarRange,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import styles from './CommandCenterPage.module.css'

const { Title, Text } = Typography

interface CommandCenterData {
  totalEnrolment: number
  pendingApplications: number
  attendanceRate: number
  attendanceBreakdown: { present: number; late: number; absent: number }
  activeStaff: number
  teachersCpdAboveTarget: number
  studentsAtRisk: number
  timetableHealth: number
  facilityUtilization: number
  lastUpdated: string
}

interface KpiWidget {
  key: keyof Omit<CommandCenterData, 'attendanceBreakdown' | 'lastUpdated'>
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
  bg: string
  format?: 'number' | 'percent'
  suffix?: string
  warningThreshold?: number  // value below which shows amber warning
  criticalThreshold?: number // value below which shows red warning
}

const WIDGETS: KpiWidget[] = [
  {
    key: 'totalEnrolment',
    label: 'commandCenter.totalEnrolment',
    icon: Users,
    color: '#1F2D3D',
    bg: '#EBF1F7',
    format: 'number',
  },
  {
    key: 'pendingApplications',
    label: 'commandCenter.pendingApplications',
    icon: ClipboardList,
    color: '#2E5A8E',
    bg: '#E8F0FA',
    format: 'number',
  },
  {
    key: 'attendanceRate',
    label: 'commandCenter.attendanceRate',
    icon: CalendarCheck,
    color: '#1A6B3A',
    bg: '#D4EDDA',
    format: 'percent',
    suffix: '%',
    warningThreshold: 90,
    criticalThreshold: 85,
  },
  {
    key: 'activeStaff',
    label: 'commandCenter.activeStaff',
    icon: UserCheck,
    color: '#5A3E00',
    bg: '#FFF3CD',
    format: 'number',
  },
  {
    key: 'teachersCpdAboveTarget',
    label: 'commandCenter.teachersCpdAboveTarget',
    icon: GraduationCap,
    color: '#1F2D3D',
    bg: '#EBF1F7',
    format: 'percent',
    suffix: '%',
    warningThreshold: 80,
    criticalThreshold: 60,
  },
  {
    key: 'studentsAtRisk',
    label: 'commandCenter.studentsAtRisk',
    icon: AlertTriangle,
    color: '#8B1A1A',
    bg: '#FDECEA',
    format: 'number',
  },
  {
    key: 'timetableHealth',
    label: 'commandCenter.timetableHealth',
    icon: CalendarRange,
    color: '#1A6B3A',
    bg: '#D4EDDA',
    format: 'percent',
    suffix: '%',
    warningThreshold: 90,
  },
  {
    key: 'facilityUtilization',
    label: 'commandCenter.facilityUtilization',
    icon: Building2,
    color: '#2E5A8E',
    bg: '#E8F0FA',
    format: 'percent',
    suffix: '%',
  },
]

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  if (delta > 0) return <span style={{ color: '#1A6B3A', fontSize: 13 }}><TrendingUp size={13} /> +{delta}</span>
  if (delta < 0) return <span style={{ color: '#8B1A1A', fontSize: 13 }}><TrendingDown size={13} /> {delta}</span>
  return <span style={{ color: '#888', fontSize: 13 }}><Minus size={13} /> 0</span>
}

export default function CommandCenterPage() {
  const { t } = useTranslation()
  const authToken = useAuthStore(s => s.token)
  const [liveData, setLiveData] = useState<CommandCenterData | null>(null)
  const [sseConnected, setSseConnected] = useState(false)
  const [resetting, setResetting] = useState(false)
  const sseRef = useRef<EventSource | null>(null)

  const handleDemoReset = () => {
    Modal.confirm({
      title: t('commandCenter.demoReset'),
      content: t('commandCenter.demoResetConfirm'),
      okText: t('commandCenter.demoReset'),
      okType: 'danger',
      onOk: async () => {
        setResetting(true)
        try {
          await api.post('/admin/demo-reset')
          setLiveData(null)
          message.success(t('commandCenter.demoResetSuccess'))
          refetch()
        } catch {
          message.error(t('commandCenter.demoResetError'))
        } finally {
          setResetting(false)
        }
      },
    })
  }

  const { data, isLoading, error, refetch } = useQuery<CommandCenterData>({
    queryKey: ['command-center'],
    queryFn: async () => {
      const res = await api.get('/dashboard/command-center')
      return res.data.data as CommandCenterData
    },
    refetchInterval: 30000,
    staleTime: 10000,
  })

  const display = liveData ?? data

  // SSE subscription for live updates
  useEffect(() => {
    const token = authToken
    if (!token) return

    const base = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1'
    const url = `${base}/events/stream?topics=dashboard`

    try {
      const es = new EventSource(`${url}&token=${token}`)
      sseRef.current = es

      es.onopen = () => setSseConnected(true)
      es.onerror = () => setSseConnected(false)

      // Listen for each widget's event
      const handleDashboardEvent = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data)
          setLiveData((prev) => {
            const base = prev ?? data
            if (!base) return prev
            return { ...base, ...payload }
          })
        } catch {
          /* ignore */
        }
      }

      const topics = [
        'dashboard.enrolment.changed',
        'dashboard.applications.changed',
        'dashboard.attendance.changed',
        'dashboard.staff.changed',
        'dashboard.cpd.changed',
        'dashboard.risk.changed',
        'dashboard.timetable.changed',
        'dashboard.facility.changed',
      ]
      topics.forEach((topic) => es.addEventListener(topic, handleDashboardEvent))

      return () => {
        topics.forEach((topic) => es.removeEventListener(topic, handleDashboardEvent))
        es.close()
        sseRef.current = null
      }
    } catch {
      return undefined
    }
  }, [data, authToken])

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return <Alert type="error" message={t('common.error')} description={String(error)} />
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {t('nav.commandCenter')}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('commandCenter.subtitle', { school: 'Sekolah Menengah Berakas (SMB-001)' })}
          </Text>
        </div>
        <Space>
          {sseConnected && (
            <Tag color="success" style={{ fontSize: 12 }}>
              ● {t('commandCenter.liveUpdates')}
            </Tag>
          )}
          <Button icon={<RefreshCw size={14} />} size="small" onClick={() => refetch()}>
            {t('common.refresh')}
          </Button>
          <Button
            icon={<RotateCcw size={14} />}
            size="small"
            danger
            loading={resetting}
            onClick={handleDemoReset}
          >
            {t('commandCenter.demoReset')}
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {display?.lastUpdated ? new Date(display.lastUpdated).toLocaleTimeString() : ''}
          </Text>
        </Space>
      </div>

      {/* 8 KPI Widgets — 4 × 2 grid */}
      <Row gutter={[16, 16]}>
        {WIDGETS.map((widget) => {
          const IconComp = widget.icon
          const rawValue = display?.[widget.key] as number | undefined
          const value = rawValue ?? 0
          const isWarning = widget.warningThreshold !== undefined && value < widget.warningThreshold
          const isCritical = widget.criticalThreshold !== undefined && value < widget.criticalThreshold
          const cardBorderColor = isCritical ? '#F5222D' : isWarning ? '#FA8C16' : undefined

          return (
            <Col xs={24} sm={12} lg={6} key={widget.key}>
              <Card
                className={styles.kpiCard}
                style={{ borderTop: cardBorderColor ? `3px solid ${cardBorderColor}` : `3px solid ${widget.color}` }}
                bodyStyle={{ padding: 20 }}
              >
                <div className={styles.kpiHeader}>
                  <div className={styles.kpiIconWrap} style={{ background: widget.bg }}>
                    <IconComp size={20} style={{ color: widget.color }} />
                  </div>
                  {(isWarning || isCritical) && (
                    <Tooltip title={isCritical ? t('commandCenter.criticalLevel') : t('commandCenter.warningLevel')}>
                      <AlertTriangle size={16} color={isCritical ? '#F5222D' : '#FA8C16'} />
                    </Tooltip>
                  )}
                </div>

                <div className={styles.kpiValue}>
                  <Statistic
                    value={value}
                    suffix={widget.suffix}
                    precision={widget.format === 'percent' ? 1 : 0}
                    valueStyle={{ fontSize: 32, fontWeight: 700, color: widget.color }}
                  />
                </div>

                <div className={styles.kpiLabel}>
                  <Text style={{ fontSize: 13, color: '#555' }}>
                    {t(widget.label, { defaultValue: widget.label.split('.').pop() })}
                  </Text>
                </div>

                {/* Special breakdowns */}
                {widget.key === 'attendanceRate' && display?.attendanceBreakdown && (
                  <div className={styles.kpiBreakdown}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      P:{display.attendanceBreakdown.present} · L:{display.attendanceBreakdown.late} · A:{display.attendanceBreakdown.absent}
                    </Text>
                  </div>
                )}
              </Card>
            </Col>
          )
        })}
      </Row>

      {/* Spec notice — BEFORE values */}
      {display && (
        <Card
          size="small"
          style={{ marginTop: 16, borderLeft: '4px solid #2E5A8E', background: '#F0F7FF' }}
        >
          <Text style={{ fontSize: 12, color: '#1F2D3D' }}>
            <strong>{t('commandCenter.beforeValues', { defaultValue: 'Current values' })}:</strong>{' '}
            {t('commandCenter.beforeValuesDesc', {
              defaultValue: `Enrolment ${display.totalEnrolment.toLocaleString()} · Pending apps ${display.pendingApplications} · Attendance ${display.attendanceRate}% · At-risk ${display.studentsAtRisk}`,
              enrolment: display.totalEnrolment.toLocaleString(),
              apps: display.pendingApplications,
              attendance: display.attendanceRate,
              atRisk: display.studentsAtRisk,
            })}
          </Text>
        </Card>
      )}
    </div>
  )
}
