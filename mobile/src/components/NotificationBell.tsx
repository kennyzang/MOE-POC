import { useEffect, useState } from 'react'
import { Badge, Popup } from 'antd-mobile'
import { Bell, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/stores/notificationStore'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { Notification } from '@/types'

dayjs.extend(relativeTime)

const typeIcons: Record<string, { icon: typeof Bell; color: string }> = {
  info:    { icon: Info,           color: '#165DFF' },
  warning: { icon: AlertTriangle,  color: '#FF7D00' },
  success: { icon: CheckCircle2,   color: '#00B42A' },
  error:   { icon: XCircle,        color: '#F53F3F' },
}

export default function NotificationBell() {
  const { t } = useTranslation()
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    startPolling,
  } = useNotificationStore()

  const [popupOpen, setPopupOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const stop = startPolling()
    return stop
  }, [startPolling])

  const handleOpen = () => {
    setPopupOpen(true)
    fetchNotifications()
  }

  const handleClose = () => {
    setPopupOpen(false)
  }

  const handleItemClick = (item: Notification) => {
    if (!item.read) {
      markAsRead(item.id)
    }
    if (item.link) {
      setPopupOpen(false)
      navigate(item.link)
    }
  }

  const handleMarkAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    markAllAsRead()
  }

  const hasUnread = unreadCount > 0

  return (
    <>
      <button className="notif-bell-btn" onClick={handleOpen}>
        <Badge content={hasUnread ? (unreadCount > 99 ? '99+' : unreadCount) : undefined}>
          <Bell size={18} />
        </Badge>
      </button>

      <Popup
        visible={popupOpen}
        onMaskClick={handleClose}
        onClose={handleClose}
        bodyStyle={{
          height: '70vh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: 'hidden',
        }}
        position="bottom"
      >
        {/* Header */}
        <div className="notif-header">
          <span style={{ fontSize: 16, fontWeight: 600 }}>{t('notifications.title')}</span>
          {hasUnread && (
            <span
              onClick={handleMarkAll}
              style={{ fontSize: 13, color: '#165DFF', cursor: 'pointer' }}
            >
              {t('notifications.markAllRead')}
            </span>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#86909c', padding: '40px 20px' }}>
              <Bell size={36} color="#c9cdd4" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14 }}>{t('notifications.empty')}</div>
            </div>
          ) : (
            notifications.map(item => {
              const typeCfg = typeIcons[item.type] ?? typeIcons.info
              const IconComp = typeCfg.icon
              return (
                <div
                  key={item.id}
                  className={`notif-item ${!item.read ? 'notif-item-unread' : ''}`}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="notif-icon">
                    <IconComp size={18} color={typeCfg.color} />
                  </div>
                  <div className="notif-content">
                    <div className="notif-title">{item.title}</div>
                    <div className="notif-message">{item.message}</div>
                    <div className="notif-time">{dayjs(item.createdAt).fromNow()}</div>
                  </div>
                  {!item.read && (
                    <div style={{
                      width: 8, height: 8, borderRadius: 4,
                      background: '#165DFF', flexShrink: 0, marginTop: 6,
                    }} />
                  )}
                </div>
              )
            })
          )}
        </div>
      </Popup>
    </>
  )
}
