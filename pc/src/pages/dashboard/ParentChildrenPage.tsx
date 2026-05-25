import { Card, Row, Col, Statistic, Button, Space, Typography, Spin, Empty } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
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

const ParentChildrenPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['parent-dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      return data.data as DashboardStats
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

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Space align="center">
          <Users size={24} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>
            {t('parentPortal.myChildren')}
          </Title>
        </Space>
      </Card>

      {children.length === 0 ? (
        <Card>
          <Empty description={<Text type="secondary">{t('common.noData')}</Text>} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {children.map((child) => (
            <Col key={child.id} xs={24} sm={12} lg={8}>
              <Card
                title={
                  <Space>
                    <Users size={16} style={{ color: '#165DFF' }} />
                    <span>{child.user.displayName}</span>
                  </Space>
                }
                style={{ height: '100%' }}
              >
                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('students.gradeLevel')}
                    </Text>
                    <div>
                      <Text strong>{child.gradeLevel}</Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('students.className')}
                    </Text>
                    <div>
                      <Text strong>{child.className}</Text>
                    </div>
                  </Col>
                </Row>

                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col span={12}>
                    <Statistic
                      title={t('dashboard.attendanceRate')}
                      value={child.attendanceRate}
                      suffix="%"
                      precision={1}
                      valueStyle={{
                        fontSize: 22,
                        color:
                          child.attendanceRate >= 80
                            ? '#52c41a'
                            : child.attendanceRate >= 60
                              ? '#faad14'
                              : '#ff4d4f',
                      }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title={t('parentPortal.gradeOverview')}
                      value={child.gradeAverage}
                      suffix="%"
                      precision={1}
                      valueStyle={{ fontSize: 22, color: '#165DFF' }}
                    />
                  </Col>
                </Row>

                <Space style={{ width: '100%' }} direction="vertical">
                  <Button
                    type="primary"
                    block
                    onClick={() => navigate('/parent/grades')}
                  >
                    {t('parentPortal.viewGrades')}
                  </Button>
                  <Button
                    block
                    onClick={() => navigate('/parent/attendance')}
                  >
                    {t('parentPortal.viewAttendance')}
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}

export default ParentChildrenPage
