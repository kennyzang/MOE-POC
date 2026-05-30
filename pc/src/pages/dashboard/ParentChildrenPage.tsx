import { useState } from 'react'
import {
  Card, Row, Col, Statistic, Button, Space, Typography, Spin, Empty,
  Tag, Modal, List, Badge,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users, Phone, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'

const { Title, Text } = Typography

interface Teacher {
  courseId: string
  courseName: string
  teacherName: string
  teacherEmail: string
}

interface ChildInfo {
  id: string
  studentId: string
  gradeLevel: string
  className: string
  user: { displayName: string }
  gpa: number
  gradeAverage: number
  attendanceRate: number
  riskBand: string
  riskScore: number | null
  recentAbsences: number
  teachers: Teacher[]
}

interface DashboardStats {
  children: ChildInfo[]
}

const RISK_COLOR: Record<string, string> = { HIGH_RISK: 'red', MEDIUM_RISK: 'orange', LOW_RISK: 'green' }
const RISK_LABEL: Record<string, string> = { HIGH_RISK: 'High Risk', MEDIUM_RISK: 'Monitor', LOW_RISK: 'Good Standing' }

const ParentChildrenPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [contactChild, setContactChild] = useState<ChildInfo | null>(null)

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
                extra={
                  <Tag color={RISK_COLOR[child.riskBand] ?? 'default'} style={{ fontSize: 11 }}>
                    {RISK_LABEL[child.riskBand] ?? child.riskBand}
                  </Tag>
                }
                style={{ height: '100%' }}
              >
                <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('students.gradeLevel')}
                    </Text>
                    <div><Text strong>{child.gradeLevel}</Text></div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('students.className')}
                    </Text>
                    <div><Text strong>{child.className}</Text></div>
                  </Col>
                </Row>

                <Row gutter={[12, 12]} style={{ marginBottom: 8 }}>
                  <Col span={12}>
                    <Statistic
                      title={t('dashboard.attendanceRate')}
                      value={child.attendanceRate}
                      suffix="%"
                      precision={1}
                      styles={{
                        content: {
                          fontSize: 20,
                          color:
                            child.attendanceRate >= 80
                              ? '#52c41a'
                              : child.attendanceRate >= 60
                                ? '#faad14'
                                : '#ff4d4f',
                        },
                      }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title={t('parentPortal.gradeOverview')}
                      value={child.gradeAverage}
                      suffix="%"
                      precision={1}
                      styles={{ content: { fontSize: 20, color: '#165DFF' } }}
                    />
                  </Col>
                </Row>

                {/* Recent absences indicator */}
                {child.recentAbsences > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: child.recentAbsences >= 3 ? '#fff2f0' : '#fff7e6',
                      borderRadius: 6,
                      padding: '6px 10px',
                      marginBottom: 12,
                    }}
                  >
                    <AlertTriangle size={13} color={child.recentAbsences >= 3 ? '#f5222d' : '#fa8c16'} />
                    <Text style={{ fontSize: 12, color: child.recentAbsences >= 3 ? '#f5222d' : '#fa8c16' }}>
                      {child.recentAbsences} {t('parentPortal.recentAbsences', { defaultValue: 'absence(s) in last 14 days' })}
                    </Text>
                  </div>
                )}

                <Space style={{ width: '100%' }} direction="vertical">
                  <Button type="primary" block onClick={() => navigate(`/parent/grades?child=${child.id}`)}>
                    {t('parentPortal.viewGrades')}
                  </Button>
                  <Button block onClick={() => navigate('/parent/attendance')}>
                    {t('parentPortal.viewAttendance')}
                  </Button>
                  <Button
                    block
                    icon={<Phone size={14} />}
                    onClick={() => setContactChild(child)}
                  >
                    {t('parentPortal.contactTeacher', { defaultValue: 'Contact Teachers' })}
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Contact Teachers Modal */}
      <Modal
        title={
          <Space>
            <Phone size={16} />
            {t('parentPortal.contactTeacherTitle', { name: contactChild?.user.displayName ?? '', defaultValue: `Teachers for ${contactChild?.user.displayName ?? ''}` })}
          </Space>
        }
        open={!!contactChild}
        onCancel={() => setContactChild(null)}
        footer={null}
        width={480}
      >
        {contactChild && (
          <List
            dataSource={contactChild.teachers}
            locale={{ emptyText: t('common.noData') }}
            renderItem={(teacher) => (
              <List.Item>
                <div style={{ width: '100%' }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{teacher.teacherName}</div>
                  <div style={{ fontSize: 11, color: '#86909c' }}>{teacher.courseName}</div>
                  {teacher.teacherEmail && (
                    <div style={{ fontSize: 12, color: '#165DFF', marginTop: 2 }}>
                      <a href={`mailto:${teacher.teacherEmail}`}>{teacher.teacherEmail}</a>
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  )
}

export default ParentChildrenPage
