import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Space, Divider, Tooltip, Select, Modal, Spin, Tag } from 'antd'
import { Lock, User, Globe, Shield, Building2, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'
import { ROLE_HOME } from '@/layouts/Sidebar'
import { LANGUAGES, type Language } from '@/lib/i18n'
import api from '@/lib/api'
import type { LoginRequest, LoginResponse } from '@/types'

const { Title, Text } = Typography

const DEMO_ACCOUNTS = [
  // ── System ──────────────────────────────────────────────────────────
  { username: 'sysadmin',        label: 'System Admin',     password: 'sysadmin123',  color: '#434343', bg: '#F5F5F5',  school: null,   authority: null },
  // ── SMHK — MOE Secondary ────────────────────────────────────────────
  { username: 'admin',           label: 'Admin',            password: 'admin123',     color: '#722ED1', bg: '#F9F0FF',  school: 'SMHK', authority: 'MOE' },
  { username: 'principal',       label: 'Principal',        password: 'principal123', color: '#096DD9', bg: '#E6F4FF',  school: 'SMHK', authority: 'MOE' },
  { username: 'hod01',           label: 'HOD',              password: 'hod123',       color: '#531DAB', bg: '#F9F0FF',  school: 'SMHK', authority: 'MOE' },
  { username: 'farah',           label: 'Counselor',        password: 'Demo@2026',    color: '#D46B08', bg: '#FFF7E6',  school: 'SMHK', authority: 'MOE' },
  { username: 'teacher01',       label: 'Form Teacher',     password: 'teacher123',   color: '#FA8C16', bg: '#FFF7E6',  school: 'SMHK', authority: 'MOE' },
  { username: 'adam',            label: 'Yr 7 Student',     password: 'Demo@2026',    color: '#52C41A', bg: '#F6FFED',  school: 'SMHK', authority: 'MOE' },
  { username: 'parent.siti',     label: "Parent (SMHK)",    password: 'Demo@2026',    color: '#EB2F96', bg: '#FFF0F6',  school: 'SMHK', authority: 'MOE' },
  // ── SRPB — MOE Primary ──────────────────────────────────────────────
  { username: 'admin.srpb',      label: 'Primary Admin',    password: 'Demo@2026',    color: '#0958D9', bg: '#E6F4FF',  school: 'SRPB', authority: 'MOE' },
  { username: 'principal.srpb',  label: 'Primary Principal',password: 'Demo@2026',    color: '#003EB3', bg: '#F0F5FF',  school: 'SRPB', authority: 'MOE' },
  { username: 'teacher.srpb2',   label: 'Primary Teacher',  password: 'Demo@2026',    color: '#1677FF', bg: '#E6F4FF',  school: 'SRPB', authority: 'MOE' },
  { username: 'parent.srpb',     label: 'Primary Parent',   password: 'Demo@2026',    color: '#C41D7F', bg: '#FFF0F6',  school: 'SRPB', authority: 'MOE' },
  // ── SMAB — MORA Secondary ───────────────────────────────────────────
  { username: 'admin.smab',      label: 'MORA Admin',       password: 'Demo@2026',    color: '#874D00', bg: '#FFF7E6',  school: 'SMAB', authority: 'MORA' },
  { username: 'principal.smab',  label: 'MORA Principal',   password: 'Demo@2026',    color: '#AD4E00', bg: '#FFF2E8',  school: 'SMAB', authority: 'MORA' },
  { username: 'teacher.smab1',   label: 'MORA Teacher',     password: 'Demo@2026',    color: '#D46B08', bg: '#FFF7E6',  school: 'SMAB', authority: 'MORA' },
  // ── ISB — Private ───────────────────────────────────────────────────
  { username: 'admin.isb',       label: 'Private Admin',    password: 'Demo@2026',    color: '#531DAB', bg: '#F9F0FF',  school: 'ISB',  authority: 'PRIVATE' },
  { username: 'teacher.isb1',    label: 'Intl Teacher',     password: 'Demo@2026',    color: '#391085', bg: '#EFE6FF',  school: 'ISB',  authority: 'PRIVATE' },
]

const AUTHORITY_COLOR: Record<string, string> = {
  MOE: '#165DFF', MORA: '#d48806', PRIVATE: '#722ED1',
}

// ─── SSO Consent Modal ────────────────────────────────────────────────────────

interface SsoConsentModalProps {
  provider: 'BRUNEI_ID' | 'EGNC_IDPM' | null
  onConfirm: (provider: 'BRUNEI_ID' | 'EGNC_IDPM') => void
  onCancel: () => void
  loading: boolean
}

const SSO_PROVIDER_CONFIG = {
  BRUNEI_ID: {
    name: 'Brunei Digital ID',
    url: 'id.gov.bn',
    color: '#FDB913',
    bgColor: '#FFF8E6',
    borderColor: '#FDB913',
    icon: <Shield size={32} style={{ color: '#CC8800' }} />,
    tagColor: 'gold',
  },
  EGNC_IDPM: {
    name: 'EGNC / IDPM',
    url: 'egnc.gov.bn',
    color: '#165DFF',
    bgColor: '#E6F0FF',
    borderColor: '#165DFF',
    icon: <Building2 size={32} style={{ color: '#165DFF' }} />,
    tagColor: 'blue',
  },
}

// SSO demo accounts — which mock user logs in per provider
const SSO_DEMO_ACCOUNTS = {
  BRUNEI_ID: [
    { username: 'admin', label: 'Admin (SMHK)' },
    { username: 'principal', label: 'Principal (SMHK)' },
    { username: 'teacher01', label: 'Teacher (SMHK)' },
    { username: 'adam', label: 'Student (SMHK)' },
  ],
  EGNC_IDPM: [
    { username: 'admin', label: 'Admin (SMHK)' },
    { username: 'principal', label: 'Principal (SMHK)' },
    { username: 'hod01', label: 'HOD (SMHK)' },
    { username: 'farah', label: 'Counselor (SMHK)' },
  ],
}

function SsoConsentModal({ provider, onConfirm, onCancel, loading }: SsoConsentModalProps) {
  const { t } = useTranslation()
  const [selectedUser, setSelectedUser] = useState<string>('')
  const cfg = provider ? SSO_PROVIDER_CONFIG[provider] : null
  const accounts = provider ? SSO_DEMO_ACCOUNTS[provider] : []

  // Auto-select first account when modal opens
  const defaultUser = accounts[0]?.username ?? ''

  return (
    <Modal
      open={provider !== null}
      onCancel={onCancel}
      footer={null}
      width={400}
      closable={!loading}
      maskClosable={!loading}
      title={null}
    >
      {cfg && (
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          {/* Provider branding */}
          <div
            style={{
              background: cfg.bgColor,
              border: `2px solid ${cfg.borderColor}`,
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 20,
            }}
          >
            <div style={{ marginBottom: 12 }}>{cfg.icon}</div>
            <Tag color={cfg.tagColor} style={{ marginBottom: 8 }}>{cfg.url}</Tag>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{cfg.name}</div>
            <div style={{ fontSize: 13, color: '#555' }}>
              {t('auth.ssoConsentMessage', { app: 'MOE SERPS' })}
            </div>
          </div>

          {/* Demo account picker */}
          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>
              {t('auth.ssoSelectDemoAccount')}
            </div>
            <Select
              style={{ width: '100%' }}
              defaultValue={defaultUser}
              onChange={val => setSelectedUser(val)}
              options={accounts.map(a => ({ value: a.username, label: a.label }))}
            />
          </div>

          {loading ? (
            <div style={{ padding: '16px 0' }}>
              <Spin size="default" />
              <div style={{ marginTop: 12, color: '#8c8c8c', fontSize: 13 }}>
                {t('auth.ssoRedirecting', { provider: cfg.name })}
              </div>
            </div>
          ) : (
            <Space style={{ width: '100%', justifyContent: 'center' }} size={12}>
              <Button onClick={onCancel}>{t('common.cancel')}</Button>
              <Button
                type="primary"
                icon={<CheckCircle size={14} />}
                onClick={() => onConfirm(provider!)}
                style={{ background: cfg.color, borderColor: cfg.color }}
              >
                {t('auth.ssoAllow', { provider: cfg.name })}
              </Button>
            </Space>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─── Main Login Page ──────────────────────────────────────────────────────────

const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const { language, setLanguage } = useLanguageStore()
  const [loading, setLoading] = useState(false)
  const [quickLoading, setQuickLoading] = useState<string | null>(null)
  const [ssoProvider, setSsoProvider] = useState<'BRUNEI_ID' | 'EGNC_IDPM' | null>(null)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoSelectedUser, setSsoSelectedUser] = useState<string>('')

  const doLogin = async (username: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { username, password })
    if (data.success) {
      setAuth(data.user, data.token)
      navigate(ROLE_HOME[data.user.role] ?? '/dashboard', { replace: true })
    }
  }

  const handleSsoConfirm = async (provider: 'BRUNEI_ID' | 'EGNC_IDPM') => {
    const accounts = SSO_DEMO_ACCOUNTS[provider]
    const username = ssoSelectedUser || accounts[0]?.username || 'admin'
    const endpoint = provider === 'BRUNEI_ID' ? '/auth/brunei-id/callback' : '/auth/egnc-idpm/callback'

    setSsoLoading(true)
    try {
      const { data } = await api.post<LoginResponse>(endpoint, { mockUsername: username })
      if (data.success) {
        setSsoProvider(null)
        setSsoLoading(false)
        setAuth(data.user, data.token)
        navigate(ROLE_HOME[data.user.role] ?? '/dashboard', { replace: true })
      }
    } catch {
      setSsoLoading(false)
      message.error(t('auth.loginError'))
    }
  }

  const onFinish = async (values: LoginRequest) => {
    setLoading(true)
    try {
      await doLogin(values.username, values.password)
    } catch {
      message.error(t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  const onQuickLogin = async (username: string, password: string) => {
    setQuickLoading(username)
    try {
      await doLogin(username, password)
    } catch {
      message.error(t('auth.loginError'))
    } finally {
      setQuickLoading(null)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #165DFF 0%, #0040C1 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: 440,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Select
                value={language}
                onChange={(val: Language) => setLanguage(val)}
                size="small"
                style={{ width: 130 }}
                suffixIcon={<Globe size={13} />}
                options={LANGUAGES.map(l => ({ value: l.code, label: l.nativeLabel }))}
              />
            </div>
            <div style={{ textAlign: 'center' }}>
              <Title level={3} style={{ marginBottom: 4 }}>
                {t('auth.loginTitle')}
              </Title>
              <Text type="secondary">{t('auth.loginSubtitle')}</Text>
            </div>
          </div>

          <Form
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: t('auth.username') }]}
            >
              <Input
                prefix={<User size={16} />}
                placeholder={t('auth.username')}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: t('auth.password') }]}
            >
              <Input.Password
                prefix={<Lock size={16} />}
                placeholder={t('auth.password')}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
              >
                {t('auth.loginButton')}
              </Button>
            </Form.Item>
          </Form>

          {/* ── SSO Buttons ── */}
          <Divider style={{ margin: '4px 0', fontSize: 12, color: '#bfbfbf' }}>
            {t('auth.orSignInWith')}
          </Divider>

          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Button
              block
              size="middle"
              icon={<Shield size={15} style={{ color: '#CC8800' }} />}
              onClick={() => { setSsoSelectedUser(''); setSsoProvider('BRUNEI_ID') }}
              style={{ borderColor: '#FDB913', color: '#7A5800', background: '#FFFBE6', fontWeight: 500 }}
            >
              {t('auth.signInWithBruneiId')}
            </Button>
            <Button
              block
              size="middle"
              icon={<Building2 size={15} style={{ color: '#165DFF' }} />}
              onClick={() => { setSsoSelectedUser(''); setSsoProvider('EGNC_IDPM') }}
              style={{ borderColor: '#165DFF', color: '#165DFF', background: '#E6F0FF', fontWeight: 500 }}
            >
              {t('auth.signInWithEgnc')}
            </Button>
          </Space>

          <Divider style={{ margin: '4px 0', fontSize: 12, color: '#bfbfbf' }}>
            Quick Access
          </Divider>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DEMO_ACCOUNTS.map(account => (
              <Tooltip key={account.username} title={`${account.username}${account.school ? ` · ${account.school}` : ''}`} placement="top">
                <Button
                  size="small"
                  loading={quickLoading === account.username}
                  disabled={quickLoading !== null && quickLoading !== account.username}
                  onClick={() => void onQuickLogin(account.username, account.password)}
                  style={{
                    color: account.color,
                    background: account.bg,
                    borderColor: account.color,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 'auto',
                    padding: '3px 8px',
                  }}
                >
                  <span style={{ lineHeight: 1.3 }}>{account.label}</span>
                  {account.authority && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      background: AUTHORITY_COLOR[account.authority] ?? '#888',
                      color: '#fff',
                      borderRadius: 3,
                      padding: '0 3px',
                      letterSpacing: 0.2,
                      lineHeight: 1.5,
                    }}>
                      {account.authority === 'PRIVATE' ? 'PVT' : account.authority}
                    </span>
                  )}
                </Button>
              </Tooltip>
            ))}
          </div>
        </Space>
      </Card>

      <SsoConsentModal
        provider={ssoProvider}
        loading={ssoLoading}
        onConfirm={provider => void handleSsoConfirm(provider)}
        onCancel={() => { if (!ssoLoading) setSsoProvider(null) }}
      />
    </div>
  )
}

export default LoginPage
