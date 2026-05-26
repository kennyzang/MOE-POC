import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const { t } = useTranslation()
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      style={{
        background: '#fff3cd',
        borderBottom: '1px solid #ffc107',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: '#664d03',
      }}
    >
      <WifiOff size={16} />
      <span>{t('push.offlineBanner')}</span>
    </div>
  )
}
