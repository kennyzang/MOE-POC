import { useEffect, useState } from 'react'
import { Badge, Popover, Button, List, Typography, Space, Tag } from 'antd'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/stores/notificationStore'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Text } = Typography

const typeColor: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  error: 'red',
}

const NotificationBell = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    startPolling,
  } = useNotificationStore()

  useEffect(() => {
    const stop = startPolling()
    return stop
  }, [startPolling])

  const handleOpen = (visible: boolean) => {
    setOpen(visible)
    if (visible) fetchNotifications()
  }

  const content = (
    <div style={{ width: 360 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 12,
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 4,
        }}
      >
        <Text strong>{t('notifications.title')}</Text>
        {unreadCount > 0 && (
          <Button size="small" type="link" onClick={() => markAllAsRead()}>
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      <List
        loading={loading}
        dataSource={notifications}
        locale={{ emptyText: t('notifications.noNotifications') }}
        style={{ maxHeight: 420, overflowY: 'auto' }}
        renderItem={item => (
          <List.Item
            style={{
              background: item.read ? 'transparent' : '#e6f4ff',
              padding: '10px 8px',
              borderRadius: 6,
              cursor: item.link ? 'pointer' : item.read ? 'default' : 'pointer',
              marginBottom: 2,
              border: 'none',
            }}
            onClick={() => {
              if (!item.read) markAsRead(item.id)
              if (item.link) {
                setOpen(false)
                navigate(item.link)
              }
            }}
          >
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Space align="center">
                <Tag color={typeColor[item.type] ?? 'blue'} style={{ margin: 0 }}>
                  {item.type}
                </Tag>
                <Text strong style={{ fontSize: 13 }}>
                  {item.title}
                </Text>
                {!item.read && <Badge color="blue" />}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.message}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(item.createdAt).fromNow()}
              </Text>
            </Space>
          </List.Item>
        )}
      />
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpen}
      placement="bottomRight"
      arrow={false}
      overlayInnerStyle={{ padding: '12px 16px', width: 392 }}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<Bell size={18} />}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </Badge>
    </Popover>
  )
}

export default NotificationBell
