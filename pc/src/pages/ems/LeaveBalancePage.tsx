import { useState } from 'react'
import {
  Card, Row, Col, Typography, Space, Button, Badge, Tag, Progress,
  Tooltip, Spin, message, Divider,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Calendar, Clock, AlertCircle, CheckCircle, Plus,
} from 'lucide-react'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import LeaveApplicationModal from './LeaveApplicationModal'
import styles from './LeaveBalancePage.module.css'

const { Title, Text } = Typography

interface BalanceEntry {
  available: number
  total: number
}

interface LeaveBalanceData {
  teacherId: string
  balances: Record<string, BalanceEntry>
  ssmSyncedAt: string | null
  isStale: boolean
  leaveBalanceYear: string
}

const LEAVE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  ANNUAL:        { label: 'Annual Leave',        color: '#1677ff', icon: '📅' },
  MEDICAL:       { label: 'Medical Leave',        color: '#f5222d', icon: '🏥' },
  MATERNITY:     { label: 'Maternity Leave',      color: '#eb2f96', icon: '👶' },
  PATERNITY:     { label: 'Paternity Leave',      color: '#722ed1', icon: '👨' },
  UNPAID:        { label: 'Unpaid Leave',         color: '#8c8c8c', icon: '💼' },
  HAJJ:          { label: 'Hajj Leave',           color: '#d4b106', icon: '🕌' },
  COMPASSIONATE: { label: 'Compassionate Leave',  color: '#fa8c16', icon: '❤️' },
}

function formatSyncTime(ssmSyncedAt: string | null): string {
  if (!ssmSyncedAt) return 'Never synced'
  const diff = Date.now() - new Date(ssmSyncedAt).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (mins > 0) return `${mins} minute${mins > 1 ? 's' : ''} ago`
  return 'Just now'
}

const LeaveBalancePage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [selectedLeaveType, setSelectedLeaveType] = useState<string | undefined>()

  const isTeacher = user?.role === 'teacher'

  const { data: balanceData, isLoading } = useQuery<LeaveBalanceData>({
    queryKey: ['leave-balances'],
    queryFn: async () => {
      const { data } = await api.get('/leave/balances')
      return data.data
    },
    refetchInterval: 30000,
    enabled: !!user,
  })

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/leave/ssm-refresh')
      return data
    },
    onSuccess: () => {
      message.success(t('leave.ssmRefreshSuccess', 'SSM data refreshed successfully'))
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] })
    },
    onError: () => message.error(t('leave.ssmRefreshError', 'Failed to refresh SSM data')),
  })

  const handleApply = (leaveType?: string) => {
    setSelectedLeaveType(leaveType)
    setApplyModalOpen(true)
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const syncedAt = balanceData?.ssmSyncedAt ?? null
  const isStale  = balanceData?.isStale ?? true

  return (
    <div className={styles.page}>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 20 }}>
        <Col>
          <Space align="center" size={10}>
            <Calendar size={22} />
            <Title level={4} style={{ margin: 0 }}>
              {t('leave.myLeaveBalance', 'My Leave Balance')}
            </Title>
            <Tag color="blue">{balanceData?.leaveBalanceYear ?? '2025/2026'}</Tag>
          </Space>
        </Col>
        <Col>
          <Space>
            {isTeacher && (
              <Button
                type="primary"
                icon={<Plus size={15} />}
                onClick={() => handleApply()}
              >
                {t('leave.applyForLeave', 'Apply for Leave')}
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* SSM Sync Badge */}
      <Card
        size="small"
        className={styles.ssmBadge}
        style={{ marginBottom: 20, background: isStale ? '#fff7e6' : '#f6ffed', borderColor: isStale ? '#ffd591' : '#b7eb8f' }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Space size={8}>
              {isStale ? (
                <AlertCircle size={16} color="#fa8c16" />
              ) : (
                <CheckCircle size={16} color="#52c41a" />
              )}
              <Text style={{ fontSize: 13 }}>
                {t('leave.ssmSource', 'Data sourced from SSM')}
                {' · '}
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {syncedAt
                    ? t('leave.syncedAgo', 'Synced {{time}}', { time: formatSyncTime(syncedAt) })
                    : t('leave.neverSynced', 'Never synced')}
                </Text>
              </Text>
              {isStale && (
                <Tag color="warning" style={{ fontSize: 11 }}>
                  {t('leave.stale', 'Stale')}
                </Tag>
              )}
            </Space>
          </Col>
          {isTeacher && (
            <Col>
              <Tooltip title={t('leave.refreshFromSSM', 'Refresh from SSM')}>
                <Button
                  size="small"
                  icon={<RefreshCw size={13} />}
                  loading={refreshMutation.isPending}
                  onClick={() => refreshMutation.mutate()}
                >
                  {t('leave.refresh', 'Refresh from SSM')}
                </Button>
              </Tooltip>
            </Col>
          )}
        </Row>
      </Card>

      {/* Balance Cards */}
      <Row gutter={[16, 16]}>
        {Object.entries(LEAVE_TYPE_CONFIG).map(([type, config]) => {
          const entry = balanceData?.balances?.[type]
          const available = entry?.available ?? 0
          const total     = entry?.total ?? 1
          const pct       = Math.round((available / total) * 100)
          const isLow     = available <= Math.floor(total * 0.2)

          return (
            <Col key={type} xs={24} sm={12} lg={8} xl={6}>
              <Card
                className={styles.balanceCard}
                hoverable={isTeacher}
                onClick={isTeacher ? () => handleApply(type) : undefined}
                style={{ borderTop: `3px solid ${config.color}` }}
              >
                <div className={styles.cardHeader}>
                  <Text strong style={{ fontSize: 14 }}>
                    {t(`leaveType.${type}`, config.label)}
                  </Text>
                  {isLow && available > 0 && (
                    <Badge
                      count={t('leave.lowBalance', 'Low')}
                      style={{ backgroundColor: '#fa8c16', fontSize: 10 }}
                    />
                  )}
                  {available === 0 && (
                    <Badge
                      count={t('leave.exhausted', 'Exhausted')}
                      style={{ backgroundColor: '#ff4d4f', fontSize: 10 }}
                    />
                  )}
                </div>

                <div className={styles.balanceNumbers}>
                  <span
                    className={styles.availableCount}
                    style={{ color: available === 0 ? '#ff4d4f' : isLow ? '#fa8c16' : config.color }}
                  >
                    {available}
                  </span>
                  <span className={styles.totalCount}>/ {total} {t('leave.days', 'days')}</span>
                </div>

                <Progress
                  percent={pct}
                  showInfo={false}
                  strokeColor={available === 0 ? '#ff4d4f' : isLow ? '#fa8c16' : config.color}
                  trailColor="#f0f0f0"
                  size="small"
                  style={{ marginTop: 8 }}
                />

                <div className={styles.cardFooter}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <Clock size={10} style={{ marginRight: 3 }} />
                    {t('leave.usedDays', '{{used}} days used', { used: total - available })}
                  </Text>
                  {isTeacher && (
                    <Text
                      style={{ fontSize: 11, color: config.color, cursor: 'pointer' }}
                    >
                      {t('leave.applyNow', 'Apply →')}
                    </Text>
                  )}
                </div>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Divider style={{ margin: '24px 0 16px' }} />

      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('leave.weekendNote', 'Leave duration is calculated in working days. Brunei weekends (Friday & Saturday) and public holidays are excluded.')}
      </Text>

      {/* Apply Modal */}
      {isTeacher && (
        <LeaveApplicationModal
          open={applyModalOpen}
          defaultLeaveType={selectedLeaveType}
          balances={balanceData?.balances}
          onClose={() => { setApplyModalOpen(false); setSelectedLeaveType(undefined) }}
          onSuccess={() => {
            setApplyModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['leave-balances'] })
            queryClient.invalidateQueries({ queryKey: ['leave-applications'] })
          }}
        />
      )}
    </div>
  )
}

export default LeaveBalancePage
