import { Card, Typography, Space, Tag, Timeline, Statistic, Row, Col, Select, Spin, Empty } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Award, ShieldAlert, AlertTriangle } from 'lucide-react'
import dayjs from 'dayjs'
import api from '@/lib/api'

const { Title, Text } = Typography

interface BehaviorRecord {
  id: string
  type: string
  category: string
  points: number
  description: string
  actionTaken: string | null
  severity: string | null
  date: string
  recordedBy: { displayName: string; role: string }
}

interface BehaviorData {
  records: BehaviorRecord[]
  netPoints: number
  merits: number
  demerits: number
}

const CATEGORY_LABEL: Record<string, string> = {
  academic: 'Academic',
  conduct: 'Conduct',
  attendance: 'Attendance',
  achievement: 'Achievement',
  other: 'Other',
}

const StudentBehaviorPage = () => {
  const { t } = useTranslation()
  const [typeFilter, setTypeFilter] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['student-behavior'],
    queryFn: async () => {
      const { data } = await api.get('/students/me/behavior')
      return data.data as BehaviorData
    },
  })

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  const records = data?.records ?? []
  const filtered = typeFilter ? records.filter((r) => r.type === typeFilter) : records

  const getIcon = (type: string) => {
    if (type === 'merit') return <Award size={14} color="#52c41a" />
    if (type === 'demerit') return <AlertTriangle size={14} color="#f5222d" />
    return <ShieldAlert size={14} color="#888" />
  }

  const getColor = (type: string) => {
    if (type === 'merit') return 'green'
    if (type === 'demerit') return 'red'
    return 'default'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <Space>
          <Award size={22} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>Merit & Conduct Record</Title>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Net Merit Points"
              value={data?.netPoints ?? 0}
              prefix={<Award size={16} />}
              styles={{ content: { color: (data?.netPoints ?? 0) >= 0 ? '#52c41a' : '#f5222d' } }}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Merits Earned" value={data?.merits ?? 0} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Demerits" value={data?.demerits ?? 0} styles={{ content: { color: data?.demerits ? '#f5222d' : undefined } }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Record Timeline"
        extra={
          <Select
            value={typeFilter || undefined}
            placeholder="Filter by type"
            allowClear
            onChange={(v) => setTypeFilter(v ?? '')}
            style={{ width: 160 }}
            options={[
              { value: 'merit', label: '🏅 Merits' },
              { value: 'demerit', label: '⚠️ Demerits' },
              { value: 'incident', label: '📋 Incidents' },
            ]}
          />
        }
      >
        {filtered.length === 0 ? (
          <Empty description="No records found." imageStyle={{ height: 60 }} />
        ) : (
          <Timeline
            items={filtered.map((r) => ({
              dot: getIcon(r.type),
              color: getColor(r.type),
              children: (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <Tag color={getColor(r.type)}>
                      {r.type === 'merit' ? '🏅' : r.type === 'demerit' ? '⚠️' : '📋'} {r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                    </Tag>
                    <Tag>{CATEGORY_LABEL[r.category] ?? r.category}</Tag>
                    {r.points !== 0 && (
                      <Tag color={r.points > 0 ? 'green' : 'red'}>
                        {r.points > 0 ? `+${r.points}` : r.points} pts
                      </Tag>
                    )}
                    {r.severity && <Tag color={r.severity === 'major' ? 'red' : r.severity === 'moderate' ? 'orange' : 'default'}>{r.severity}</Tag>}
                  </div>
                  <Text>{r.description}</Text>
                  {r.actionTaken && (
                    <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                      Action: {r.actionTaken}
                    </div>
                  )}
                  <div style={{ color: '#bbb', fontSize: 11, marginTop: 4 }}>
                    {dayjs(r.date).format('DD/MM/YYYY')} · by {r.recordedBy.displayName}
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  )
}

export default StudentBehaviorPage
