import { NavBar } from 'antd-mobile'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from 'react-i18next'
import NotificationBell from './NotificationBell'

interface NavHeaderProps {
  title: string
  showBack?: boolean
  showLogout?: boolean
}

export default function NavHeader({ title, showBack = false, showLogout = false }: NavHeaderProps) {
  const navigate = useNavigate()
  const clearAuth = useAuthStore(s => s.clearAuth)
  const { t } = useTranslation()

  const handleLogout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <NavBar
      onBack={showBack ? () => navigate(-1) : undefined}
      back={showBack ? t('common.back') : null}
      right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NotificationBell />
          {showLogout && (
            <span
              onClick={handleLogout}
              style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', paddingLeft: 4 }}
              title={t('common.logout')}
            >
              <LogOut size={18} />
            </span>
          )}
        </div>
      }
      style={{
        '--height': '45px',
        '--border-bottom': '1px solid rgba(255,255,255,0.2)',
        '--padding-right': '4px',
        background: 'linear-gradient(135deg, #165DFF 0%, #0E42D2 100%)',
        color: 'white',
        fontWeight: 600,
      } as React.CSSProperties}
    >
      {title}
    </NavBar>
  )
}
