import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Toast } from 'antd-mobile'
import { Bell, BellOff, X } from 'lucide-react'
import { usePushNotification } from '@/hooks/usePushNotification'

const DISMISS_KEY = 'push_banner_dismissed'

interface PushNotificationBannerProps {
  /** Only show for these roles (if empty, show for all) */
  roles?: string[]
  userRole?: string
  /** Show test send button (for demo) */
  showTest?: boolean
}

export default function PushNotificationBanner({
  roles,
  userRole,
  showTest = false,
}: PushNotificationBannerProps) {
  const { t } = useTranslation()
  const { permission, isSubscribed, isLoading, subscribe, unsubscribe, sendTest } = usePushNotification()
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1' }
    catch { return false }
  })

  // Persist dismiss to localStorage
  useEffect(() => {
    try {
      if (dismissed) localStorage.setItem(DISMISS_KEY, '1')
      else localStorage.removeItem(DISMISS_KEY)
    } catch { /* ignore */ }
  }, [dismissed])

  // Skip if unsupported
  if (permission === 'unsupported') return null

  // Skip if role filter set and user role doesn't match
  if (roles && userRole && !roles.includes(userRole)) return null

  // Skip if dismissed by user (persisted across sessions)
  if (dismissed) return null

  // If already subscribed, show minimal status + controls
  if (isSubscribed) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f9ff 100%)',
          border: '1px solid #91caff',
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Bell size={16} color="#165DFF" />
        <span style={{ flex: 1, fontSize: 13, color: '#165DFF' }}>{t('push.enabled')}</span>
        {showTest && (
          <Button
            size="mini"
            color="primary"
            fill="outline"
            loading={isLoading}
            onClick={async () => {
              await sendTest()
              Toast.show({ content: 'Test push sent!', position: 'top' })
            }}
            style={{ fontSize: 11 }}
          >
            {t('push.testBtn')}
          </Button>
        )}
        <Button
          size="mini"
          color="default"
          fill="none"
          loading={isLoading}
          onClick={async () => {
            await unsubscribe()
            Toast.show({ content: t('push.disableBtn'), position: 'top' })
          }}
          style={{ padding: '0 4px' }}
        >
          <BellOff size={14} color="#86909c" />
        </Button>
      </div>
    )
  }

  // If permission denied, show info
  if (permission === 'denied') {
    return (
      <div
        style={{
          background: '#fff7e6',
          border: '1px solid #ffd591',
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 12,
          fontSize: 12,
          color: '#874d00',
        }}
      >
        {t('push.denied')}
      </div>
    )
  }

  // Default: show enable banner (compact)
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)',
        border: '1px solid #adc6ff',
        borderRadius: 10,
        padding: '8px 12px',
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Bell size={16} color="#165DFF" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, color: '#1d2129' }}>
        {t('push.enableTitle')}
      </span>
      {showTest && (
        <Button
          size="mini"
          color="primary"
          fill="outline"
          loading={isLoading}
          onClick={async () => {
            await sendTest()
            Toast.show({ content: 'Test push sent!', position: 'top' })
          }}
          style={{ fontSize: 10 }}
        >
          Test
        </Button>
      )}
      <Button
        color="primary"
        size="mini"
        loading={isLoading}
        onClick={async () => {
          const ok = await subscribe()
          if (ok) Toast.show({ content: t('push.enabled'), icon: 'success', position: 'top' })
        }}
        style={{ fontSize: 11, padding: '0 8px', height: 26 }}
      >
        {t('push.enableBtn')}
      </Button>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={14} color="#86909c" />
      </button>
    </div>
  )
}
