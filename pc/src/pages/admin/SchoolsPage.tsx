import { Card, Row, Col, Tag, Statistic, Typography, Space, Spin, Empty, Badge } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { School, Users, GraduationCap } from 'lucide-react'
import api from '@/lib/api'
import { AUTHORITY_META, SCHOOL_TYPE_LABEL } from '@/hooks/useSchoolConfig'
import type { SchoolConfig } from '@/types'

const { Title, Text } = Typography

interface SchoolWithCounts extends SchoolConfig {
  studentCount: number
  teacherCount: number
  address?: string
  phone?: string
  principal?: string
  establishedYear?: number
}

const SchoolsPage = () => {
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['all-schools'],
    queryFn: async () => {
      const { data } = await api.get('/schools')
      return data.data as SchoolWithCounts[]
    },
  })

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  const grouped: Record<string, SchoolWithCounts[]> = {}
  for (const s of schools) {
    if (!grouped[s.authority]) grouped[s.authority] = []
    grouped[s.authority].push(s)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <Space>
          <School size={22} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>All Schools</Title>
          <Tag>{schools.length} schools</Tag>
        </Space>
      </Card>

      {schools.length === 0 ? (
        <Card><Empty description="No schools found." /></Card>
      ) : (
        Object.entries(grouped).map(([authority, schoolList]) => {
          const meta = AUTHORITY_META[authority] ?? { label: authority, color: '#888' }
          return (
            <div key={authority}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 4, height: 20, borderRadius: 2, background: meta.color }} />
                <Text strong style={{ fontSize: 15, color: meta.color }}>{meta.label}</Text>
                <Tag color={meta.color} style={{ marginLeft: 4 }}>{schoolList.length}</Tag>
              </div>
              <Row gutter={[16, 16]}>
                {schoolList.map((school) => (
                  <Col xs={24} sm={12} md={8} key={school.id}>
                    <Card
                      style={{ borderTop: `3px solid ${meta.color}` }}
                      size="small"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <Text strong style={{ fontSize: 14 }}>{school.name}</Text>
                          <div>
                            <Tag color="default" style={{ fontSize: 11, marginTop: 2 }}>{school.code}</Tag>
                            <Tag color={meta.color} style={{ fontSize: 11 }}>{authority}</Tag>
                          </div>
                        </div>
                      </div>

                      <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>
                        {SCHOOL_TYPE_LABEL[school.schoolType] ?? school.schoolType}
                        {school.establishedYear && ` · Est. ${school.establishedYear}`}
                      </div>

                      {school.principal && (
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>
                          Principal: {school.principal}
                        </div>
                      )}

                      <Row gutter={12} style={{ marginBottom: 8 }}>
                        <Col span={12}>
                          <Statistic
                            title={<span style={{ fontSize: 11 }}>Students</span>}
                            value={school.studentCount}
                            prefix={<Users size={12} />}
                            valueStyle={{ fontSize: 18 }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title={<span style={{ fontSize: 11 }}>Teachers</span>}
                            value={school.teacherCount}
                            prefix={<GraduationCap size={12} />}
                            valueStyle={{ fontSize: 18 }}
                          />
                        </Col>
                      </Row>

                      <div style={{ fontSize: 11, color: '#888' }}>
                        <div style={{ fontWeight: 500, marginBottom: 2 }}>Grade Levels:</div>
                        <Space size={2} wrap>
                          {school.gradeLevels.map((g) => (
                            <Tag key={g} style={{ fontSize: 10, margin: 1 }}>{g}</Tag>
                          ))}
                        </Space>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          )
        })
      )}
    </div>
  )
}

export default SchoolsPage
