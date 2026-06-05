import { useState } from 'react'
import {
  Card, Row, Col, Typography, Tag, Space, Table, Tooltip, Button, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Globe, Shield, Building2, Database, Users, BookOpen, RefreshCw,
  CheckCircle, Activity,
} from 'lucide-react'
import api from '../../lib/api'

const { Title, Text } = Typography

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntegrationService {
  key: string
  name: string
  description: string
  endpoint: string
  icon: string
  status: 'connected'
  uptimePercent: number
  lastSyncAt: string | null
}

interface IntegrationLog {
  id: string
  system: string
  endpoint: string
  payloadSize: number
  status: 'success' | 'error'
  triggeredBy: string | null
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SYSTEM_ICONS: Record<string, React.ReactNode> = {
  shield:   <Shield   size={22} style={{ color: '#165DFF' }} />,
  building: <Building2 size={22} style={{ color: '#165DFF' }} />,
  database: <Database  size={22} style={{ color: '#165DFF' }} />,
  users:    <Users     size={22} style={{ color: '#165DFF' }} />,
  book:     <BookOpen  size={22} style={{ color: '#165DFF' }} />,
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(2)} MB`
}

// ─── Component ───────────────────────────────────────────────────────────────

const EgncIntegrationPage = () => {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})

  const { data: services = [] } = useQuery<IntegrationService[]>({
    queryKey: ['egnc-services'],
    queryFn: async () => {
      const { data } = await api.get('/egnc/services')
      return data.data
    },
    refetchInterval: 30000,
  })

  const { data: logs = [] } = useQuery<IntegrationLog[]>({
    queryKey: ['egnc-logs'],
    queryFn: async () => {
      const { data } = await api.get('/egnc/logs')
      return data.data
    },
    refetchInterval: 10000,
  })

  const handleSync = async (systemKey: string, systemName: string) => {
    setSyncing(prev => ({ ...prev, [systemKey]: true }))
    try {
      const { data } = await api.post(`/egnc/${systemKey}/sync`)
      message.success(
        t('egnc.syncSuccess', { system: systemName, count: Object.values(data.data.result)[0] ?? 0 })
      )
      qc.invalidateQueries({ queryKey: ['egnc-logs'] })
      qc.invalidateQueries({ queryKey: ['egnc-services'] })
    } catch {
      message.error(t('egnc.syncError', { system: systemName }))
    } finally {
      setSyncing(prev => ({ ...prev, [systemKey]: false }))
    }
  }

  const logColumns: ColumnsType<IntegrationLog> = [
    {
      title: t('egnc.time'),
      dataIndex: 'createdAt',
      width: 130,
      render: (v: string) => (
        <Tooltip title={new Date(v).toLocaleString()}>
          <Text style={{ fontSize: 12 }}>{relativeTime(v)}</Text>
        </Tooltip>
      ),
    },
    {
      title: t('egnc.system'),
      dataIndex: 'system',
      width: 120,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('egnc.endpoint'),
      dataIndex: 'endpoint',
      ellipsis: true,
      render: (v: string) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</Text>,
    },
    {
      title: t('egnc.payload'),
      dataIndex: 'payloadSize',
      width: 90,
      align: 'right',
      render: (v: number) => <Text style={{ fontSize: 12 }}>{formatBytes(v)}</Text>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 80,
      render: (v: string) => (
        <Tag color={v === 'success' ? 'green' : 'red'}>
          {v === 'success' ? t('common.success') : t('common.error')}
        </Tag>
      ),
    },
    {
      title: t('egnc.triggeredBy'),
      dataIndex: 'triggeredBy',
      width: 100,
      render: (v: string | null) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{v === 'system' ? 'System' : (v ? 'Manual' : '—')}</Text>
      ),
    },
  ]

  return (
    <div>
      {/* ── Header ── */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 8 }}>
        <Col>
          <Space align="center" size={8}>
            <Globe size={22} />
            <Title level={4} style={{ margin: 0 }}>{t('egnc.integrationConsole')}</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <CheckCircle size={14} style={{ color: '#52c41a' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>{t('egnc.allSystemsOperational')}</Text>
          </Space>
        </Col>
      </Row>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        {t('egnc.consoleDescription')}
      </Text>

      {/* ── System Cards ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {services.map(svc => (
          <Col xs={24} md={12} key={svc.key}>
            <Card
              size="small"
              title={
                <Space>
                  {SYSTEM_ICONS[svc.icon] ?? <Globe size={22} />}
                  <span style={{ fontWeight: 600 }}>{svc.name}</span>
                </Space>
              }
              extra={
                <Tag icon={<CheckCircle size={11} />} color="success">
                  {t('egnc.connected')}
                </Tag>
              }
              actions={[
                <Button
                  key="sync"
                  type="link"
                  size="small"
                  icon={<RefreshCw size={13} />}
                  loading={syncing[svc.key]}
                  onClick={() => void handleSync(svc.key, svc.name)}
                  style={{ fontSize: 12 }}
                >
                  {t('egnc.triggerSync')}
                </Button>,
              ]}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{svc.description}</Text>
                <Row justify="space-between" style={{ marginTop: 8 }}>
                  <Col>
                    <Space size={4}>
                      <Activity size={12} style={{ color: '#52c41a' }} />
                      <Text style={{ fontSize: 12 }}>{t('egnc.uptime')}: {svc.uptimePercent}%</Text>
                    </Space>
                  </Col>
                  <Col>
                    <Tooltip title={svc.lastSyncAt ? new Date(svc.lastSyncAt).toLocaleString() : '—'}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t('egnc.lastSync')}: {relativeTime(svc.lastSyncAt)}
                      </Text>
                    </Tooltip>
                  </Col>
                </Row>
                <Text style={{ fontSize: 11, fontFamily: 'monospace', color: '#8c8c8c' }}>
                  {svc.endpoint}
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Recent Activity Log ── */}
      <Card
        title={
          <Space>
            <Database size={16} />
            <span>{t('egnc.recentActivity')}</span>
            <Tag color="default">{logs.length}</Tag>
          </Space>
        }
        extra={
          <Button
            size="small"
            icon={<RefreshCw size={13} />}
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['egnc-logs'] })
              qc.invalidateQueries({ queryKey: ['egnc-services'] })
            }}
          >
            {t('common.refresh')}
          </Button>
        }
      >
        <Table
          dataSource={logs}
          columns={logColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 15, size: 'small' }}
          scroll={{ x: 700 }}
        />
      </Card>
    </div>
  )
}

export default EgncIntegrationPage
