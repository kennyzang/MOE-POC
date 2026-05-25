import { Card, Select, Statistic, Alert, Typography, Space, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import api from '../../lib/api'

const { Title, Text } = Typography

interface ChildInfo {
  id: string
  studentId: string
  gradeLevel: string
  className: string
  user: { displayName: string }
  gpa: number
  gradeAverage: number
  attendanceRate: number
}

interface DashboardStats {
  children: ChildInfo[]
}

const ParentGradesPage = () => {
  const { t } = useTranslation()
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>(undefined)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['parent-dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      const result = data.data as DashboardStats
      if (result.children?.length > 0 && !selectedChildId) {
        setSelectedChildId(result.children[0].id)
      }
      return result
    },
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const children = stats?.children ?? []
  const selectedChild = children.find((c) => c.id === selectedChildId) ?? children[0]

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Space align="center">
          <GraduationCap size={24} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>
            {t('parentPortal.childGrades')}
          </Title>
        </Space>
      </Card>

      {children.length > 1 && (
        <Card style={{ marginBottom: 16 }}>
          <Space align="center">
            <Text>{t('parentPortal.selectChild')}:</Text>
            <Select
              value={selectedChildId}
              onChange={setSelectedChildId}
              style={{ minWidth: 200 }}
              options={children.map((c) => ({
                value: c.id,
                label: c.user.displayName,
              }))}
            />
          </Space>
        </Card>
      )}

      {selectedChild && (
        <>
          <Card
            title={
              <Space>
                <GraduationCap size={16} style={{ color: '#165DFF' }} />
                <span>
                  {selectedChild.user.displayName} — {selectedChild.gradeLevel}{' '}
                  {selectedChild.className}
                </span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Statistic
              title={t('parentPortal.gradeOverview')}
              value={selectedChild.gradeAverage}
              suffix="%"
              precision={1}
              valueStyle={{
                fontSize: 48,
                color:
                  selectedChild.gradeAverage >= 75
                    ? '#52c41a'
                    : selectedChild.gradeAverage >= 50
                      ? '#faad14'
                      : '#ff4d4f',
              }}
            />
          </Card>

          <Alert
            type="info"
            showIcon
            message={t('parentPortal.gradeOverview')}
            description="For detailed grade breakdown, contact the school office."
          />
        </>
      )}

      {children.length === 0 && (
        <Card>
          <Text type="secondary">{t('common.noData')}</Text>
        </Card>
      )}
    </div>
  )
}

export default ParentGradesPage
