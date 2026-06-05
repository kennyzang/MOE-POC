import { useState } from 'react'
import { Card, Typography, Space, Tag, Timeline, Statistic, Row, Col, Select, Spin, Empty } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Award, AlertTriangle, ShieldAlert } from 'lucide-react'
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
  parentNotified: boolean
  date: string
  student: { user: { displayName: string } }
  recordedBy: { displayName: string; role: string }
}

const ParentBehaviorPage = () => {
  const [childFilter, setChildFilter] = useState<string>('')

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['parent-behavior'],
    queryFn: async () => {
      const { data } = await api.get('/parent/behavior')
      return data.data as BehaviorRecord[]
    },
  })

  const children = [...new Map(records.map((r) => [r.student.user.displayName, r.student.user.displayName])).entries()]
    .map(([name]) => ({ name }))

  const filtered = childFilter ? records.filter((r) => r.student.user.displayName === childFilter) : records

  const merits = filtered.filter((r) => r.type === 'merit').reduce((s, r) => s + r.points, 0)
  const demerits = filtered.filter((r) => r.type === 'demerit').reduce((s, r) => s + Math.abs(r.points), 0)

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ShieldAlert size={22} style={{ color: '#165DFF' }} />
            <Title level={4} style={{ margin: 0 }}>Conduct Records</Title>
          </Space>
          {children.length > 1 && (
            <Select
              placeholder="All children"
              allowClear
              value={childFilter || undefined}
              onChange={(v) => setChildFilter(v ?? '')}
              options={children.map((c) => ({ value: c.name, label: c.name }))}
              style={{ width: 200 }}
            />
          )}
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Net Points" value={merits - demerits}
              styles={{ content: { color: merits - demerits >= 0 ? '#52c41a' : '#f5222d' } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Merits" value={merits} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Demerits" value={demerits} styles={{ content: { color: demerits > 0 ? '#f5222d' : undefined } }} />
          </Card>
        </Col>
      </Row>

      <Card title="Behavior Timeline">
        {filtered.length === 0 ? (
          <Empty description="No conduct records found." imageStyle={{ height: 60 }} />
        ) : (
          <Timeline
            items={filtered.map((r) => ({
              dot: getIcon(r.type),
              color: getColor(r.type),
              children: (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4, alignItems: 'center' }}>
                    {children.length > 1 && <Tag color="blue">{r.student.user.displayName}</Tag>}
                    <Tag color={getColor(r.type)}>
                      {r.type === 'merit' ? '🏅' : r.type === 'demerit' ? '⚠️' : '📋'} {r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                    </Tag>
                    <Tag>{r.category}</Tag>
                    {r.points !== 0 && (
                      <Tag color={r.points > 0 ? 'green' : 'red'}>{r.points > 0 ? `+${r.points}` : r.points} pts</Tag>
                    )}
                    {r.severity && <Tag color={r.severity === 'major' ? 'red' : r.severity === 'moderate' ? 'orange' : 'default'}>{r.severity}</Tag>}
                    {r.parentNotified && <Tag color="cyan">Parent Notified ✓</Tag>}
                  </div>
                  <Text>{r.description}</Text>
                  {r.actionTaken && <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Action: {r.actionTaken}</div>}
                  <div style={{ color: '#bbb', fontSize: 11, marginTop: 4 }}>
                    {dayjs(r.date).format('DD/MM/YYYY')} · Recorded by {r.recordedBy.displayName}
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

export default ParentBehaviorPage
