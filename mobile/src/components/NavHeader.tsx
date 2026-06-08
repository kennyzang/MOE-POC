import { useState } from 'react'
import { NavBar, Popup } from 'antd-mobile'
import { LogOut, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'
import { useTranslation } from 'react-i18next'
import NotificationBell from './NotificationBell'

interface NavHeaderProps {
  title: string
  showBack?: boolean
  showLogout?: boolean
}

const LANG_OPTIONS = [
  { code: 'en' as const, label: 'English', native: 'English' },
  { code: 'zh' as const, label: '中文', native: 'Chinese' },
  { code: 'ms' as const, label: 'Melayu', native: 'Bahasa Melayu' },
]

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  principal: 'Principal',
  hod: 'Head of Department',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  finance: 'Finance Officer',
  admissions: 'Admissions Officer',
  manager: 'Manager',
}

export default function NavHeader({ title, showBack = false, showLogout = false }: NavHeaderProps) {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const { language, setLanguage } = useLanguageStore()
  const { t, i18n } = useTranslation()
  const [menuVisible, setMenuVisible] = useState(false)

  const handleLogout = () => {
    setMenuVisible(false)
    clearAuth()
    navigate('/login', { replace: true })
  }

  const handleLangChange = (code: typeof LANG_OPTIONS[0]['code']) => {
    setLanguage(code)
    void i18n.changeLanguage(code)
  }

  const initials = user?.displayName
    ? user.displayName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?'

  return (
    <>
      <NavBar
        onBack={showBack ? () => navigate(-1) : undefined}
        back={showBack ? t('common.back') : null}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: -4 }}>
            <NotificationBell />
            {showLogout && (
              <button
                onClick={() => setMenuVisible(true)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)',
                  border: '1.5px solid rgba(255,255,255,0.6)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 4,
                  letterSpacing: -0.5,
                }}
              >
                {initials}
              </button>
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

      <Popup
        visible={menuVisible}
        onMaskClick={() => setMenuVisible(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: '20px 0 32px',
        }}
      >
        {/* User info */}
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'linear-gradient(135deg, #165DFF, #0E42D2)',
              color: 'white', fontWeight: 700, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1d2129' }}>
                {user?.displayName}
              </div>
              <div style={{ fontSize: 12, color: '#86909c', marginTop: 1 }}>
                {ROLE_LABEL[user?.role ?? ''] ?? user?.role?.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Language switcher */}
        <div style={{ padding: '12px 20px 4px' }}>
          <div style={{ fontSize: 11, color: '#86909c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            {t('common.language')}
          </div>
          {LANG_OPTIONS.map(opt => (
            <div
              key={opt.code}
              onClick={() => handleLangChange(opt.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 4px',
                cursor: 'pointer',
                borderBottom: '1px solid #f5f5f5',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontWeight: language === opt.code ? 700 : 400, color: language === opt.code ? '#165DFF' : '#1d2129', fontSize: 14 }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 13, color: '#86909c' }}>{opt.native}</span>
              </div>
              {language === opt.code && <Check size={16} color="#165DFF" />}
            </div>
          ))}
        </div>

        {/* Sign out */}
        <div style={{ padding: '8px 20px 0' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#ff4d4f',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <LogOut size={16} />
            {t('common.signOut')}
          </button>
        </div>
      </Popup>
    </>
  )
}
