import { useNavigate } from 'react-router-dom'
import { Layout, Dropdown, Avatar, Space, Select } from 'antd'
import { LogOut, User, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'
import { LANGUAGES, type Language } from '@/lib/i18n'
import NotificationBell from '@/components/NotificationBell'

const { Header } = Layout

const Navbar = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const { language, setLanguage } = useLanguageStore()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const dropdownItems = {
    items: [
      {
        key: 'role',
        label: t(`roles.${user?.role ?? 'student'}`),
        disabled: true,
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        label: t('common.logout'),
        icon: <LogOut size={14} />,
        danger: true,
        onClick: handleLogout,
      },
    ],
  }

  return (
    <Header
      style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: 56,
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 99,
      }}
    >
      <Space size={16}>
        <Select
          value={language}
          onChange={(val: Language) => setLanguage(val)}
          style={{ width: 130 }}
          size="small"
          suffixIcon={<Globe size={14} />}
          options={LANGUAGES.map(l => ({
            value: l.code,
            label: l.nativeLabel,
          }))}
        />
        <NotificationBell />
        <Dropdown menu={dropdownItems} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar
              size={32}
              icon={<User size={16} />}
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
            <span style={{ fontWeight: 500 }}>{user?.displayName}</span>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  )
}

export default Navbar
