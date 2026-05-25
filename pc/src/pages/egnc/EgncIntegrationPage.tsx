import { Card, Row, Col, Typography, Tag, Space, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Globe,
  Database,
  Shield,
  BookOpen,
  ClipboardCheck,
  Building2,
} from 'lucide-react'
import api from '../../lib/api'

const { Title, Text } = Typography

interface EgncService {
  name: string
  status: 'connected' | 'disconnected' | 'maintenance'
  lastSync: string | null
  description: string
}

const STATUS_CONFIG: Record<string, { color: string; key: string }> = {
  connected: { color: 'green', key: 'egnc.connected' },
  disconnected: { color: 'red', key: 'egnc.disconnected' },
  maintenance: { color: 'orange', key: 'egnc.underMaintenance' },
}

const SERVICE_ICONS: Record<number, React.ReactNode> = {
  0: <Database size={20} style={{ color: '#165DFF' }} />,
  1: <Shield size={20} style={{ color: '#165DFF' }} />,
  2: <BookOpen size={20} style={{ color: '#165DFF' }} />,
  3: <ClipboardCheck size={20} style={{ color: '#165DFF' }} />,
  4: <Building2 size={20} style={{ color: '#165DFF' }} />,
}

const EgncIntegrationPage = () => {
  const { t } = useTranslation()

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['egnc-services'],
    queryFn: async () => {
      const { data } = await api.get('/egnc/services')
      return data.data as EgncService[]
    },
  })

  const formatSyncTime = (lastSync: string | null) => {
    if (!lastSync) return t('common.noData')
    return new Date(lastSync).toLocaleString()
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <Row align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Space align="center" size={8}>
            <Globe size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('egnc.title')}
            </Title>
          </Space>
        </Col>
      </Row>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        {t('egnc.description')}
      </Text>

      {/* Service Cards Grid */}
      <Row gutter={[16, 16]}>
        {services.map((service, index) => {
          const statusCfg = STATUS_CONFIG[service.status] ?? {
            color: 'default',
            key: service.status,
          }
          return (
            <Col xs={24} md={12} key={service.name}>
              <Card
                title={
                  <Space>
                    {SERVICE_ICONS[index % 5]}
                    <span>{service.name}</span>
                  </Space>
                }
                extra={
                  <Tag color={statusCfg.color}>{t(statusCfg.key as never)}</Tag>
                }
              >
                <Text type="secondary">
                  {t('egnc.lastSync')}: {formatSyncTime(service.lastSync)}
                </Text>
                <br />
                <Text style={{ marginTop: 8, display: 'inline-block' }}>
                  {service.description}
                </Text>
              </Card>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}

export default EgncIntegrationPage
