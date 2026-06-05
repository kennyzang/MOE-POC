import { useState } from 'react'
import { Card, Typography, Space, Tag, Alert, Spin, Empty, Badge, Collapse } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bell, Pin } from 'lucide-react'
import dayjs from 'dayjs'
import api from '@/lib/api'

const { Title, Text } = Typography

interface Announcement {
  id: string
  title: string
  content: string
  priority: string
  isPinned: boolean
  publishedAt: string
  expiresAt: string | null
  gradeLevel: string | null
  author: { displayName: string; role: string }
}

const PRIORITY_COLOR: Record<string, string> = {
  normal: 'default',
  high: 'orange',
  urgent: 'red',
}

const StudentAnnouncementsPage = () => {
  const { t } = useTranslation()

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['student-announcements'],
    queryFn: async () => {
      const { data } = await api.get('/announcements')
      return data.data as Announcement[]
    },
  })

  const urgent = announcements.filter((a) => a.priority === 'urgent')
  const pinned = announcements.filter((a) => a.isPinned && a.priority !== 'urgent')
  const rest = announcements.filter((a) => !a.isPinned && a.priority !== 'urgent')

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <Space>
          <Bell size={22} style={{ color: '#165DFF' }} />
          <Title level={4} style={{ margin: 0 }}>Announcements</Title>
          {announcements.length > 0 && <Badge count={announcements.length} color="#165DFF" />}
        </Space>
      </Card>

      {/* Urgent alerts shown at top */}
      {urgent.map((a) => (
        <Alert
          key={a.id}
          type="error"
          showIcon
          icon={<Bell size={16} />}
          message={<Text strong>{a.title}</Text>}
          description={
            <div>
              <div style={{ marginBottom: 4 }}>{a.content}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {a.author.displayName} · {dayjs(a.publishedAt).format('DD/MM/YYYY HH:mm')}
              </Text>
            </div>
          }
        />
      ))}

      {/* Pinned */}
      {pinned.map((a) => (
        <Card
          key={a.id}
          size="small"
          style={{ borderLeft: '4px solid #fa8c16' }}
          extra={
            <Space>
              <Tag color="orange" icon={<Pin size={10} />}>Pinned</Tag>
              {a.priority !== 'normal' && <Tag color={PRIORITY_COLOR[a.priority]}>{a.priority.toUpperCase()}</Tag>}
            </Space>
          }
          title={<Text strong>{a.title}</Text>}
        >
          <div style={{ whiteSpace: 'pre-line' }}>{a.content}</div>
          <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
            {a.author.displayName} · {dayjs(a.publishedAt).format('DD/MM/YYYY')}
            {a.expiresAt && ` · Expires ${dayjs(a.expiresAt).format('DD/MM/YYYY')}`}
          </div>
        </Card>
      ))}

      {/* Regular announcements */}
      {rest.length === 0 && pinned.length === 0 && urgent.length === 0 ? (
        <Card>
          <Empty description="No announcements at this time." imageStyle={{ height: 60 }} />
        </Card>
      ) : (
        rest.length > 0 && (
          <Card>
            <Collapse
              ghost
              items={rest.map((a) => ({
                key: a.id,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Text strong>{a.title}</Text>
                    <Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(a.publishedAt).format('DD/MM/YYYY')}</Text>
                      {a.gradeLevel && <Tag color="blue" style={{ fontSize: 11 }}>{a.gradeLevel}</Tag>}
                    </Space>
                  </div>
                ),
                children: (
                  <div>
                    <div style={{ whiteSpace: 'pre-line', marginBottom: 8 }}>{a.content}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Posted by {a.author.displayName}
                      {a.expiresAt && ` · Expires ${dayjs(a.expiresAt).format('DD/MM/YYYY')}`}
                    </Text>
                  </div>
                ),
              }))}
            />
          </Card>
        )
      )}
    </div>
  )
}

export default StudentAnnouncementsPage
