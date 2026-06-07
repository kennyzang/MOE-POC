import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Space, Divider, Select, Modal, Spin, Tag } from 'antd'
import { Lock, User, Globe, Shield, Building2, CheckCircle, KeyRound, ChevronRight } from 'lucide-react'
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
  { username: 'sysadmin',        label: 'System Admin',      password: 'sysadmin123',  school: null,   authority: null },
  // ── SMHK — MOE Secondary ────────────────────────────────────────────
  { username: 'admin',           label: 'Admin',              password: 'admin123',     school: 'SMHK', authority: 'MOE' },
  { username: 'principal',       label: 'Principal',          password: 'principal123', school: 'SMHK', authority: 'MOE' },
  { username: 'hod01',           label: 'HOD',                password: 'hod123',       school: 'SMHK', authority: 'MOE' },
  { username: 'farah',           label: 'Counselor',          password: 'Demo@2026',    school: 'SMHK', authority: 'MOE' },
  { username: 'teacher01',       label: 'Form Teacher',       password: 'teacher123',   school: 'SMHK', authority: 'MOE' },
  { username: 'student001',      label: 'Yr 7 Student (Ahmad)', password: 'student123',  school: 'SMHK', authority: 'MOE' },
  { username: 'adam',            label: 'Yr 7 Student',       password: 'Demo@2026',    school: 'SMHK', authority: 'MOE' },
  { username: 'parent.siti',     label: 'Parent (SMHK)',      password: 'Demo@2026',    school: 'SMHK', authority: 'MOE' },
  // ── SMHK — Additional Student (Yr 10) ───────────────────────────────
  { username: 'nadia_y10',       label: 'Yr 10 Student',      password: 'Demo@2026',    school: 'SMHK', authority: 'MOE' },
  // ── SRPB — MOE Primary ──────────────────────────────────────────────
  { username: 'admin.srpb',      label: 'Primary Admin',      password: 'Demo@2026',    school: 'SRPB', authority: 'MOE' },
  { username: 'principal.srpb',  label: 'Primary Principal',  password: 'Demo@2026',    school: 'SRPB', authority: 'MOE' },
  { username: 'teacher.srpb2',   label: 'Primary Teacher',    password: 'Demo@2026',    school: 'SRPB', authority: 'MOE' },
  { username: 'parent.srpb',     label: 'Primary Parent',     password: 'Demo@2026',    school: 'SRPB', authority: 'MOE' },
  // ── SMAB — MORA Secondary ───────────────────────────────────────────
  { username: 'admin.smab',      label: 'MORA Admin',         password: 'Demo@2026',    school: 'SMAB', authority: 'MORA' },
  { username: 'principal.smab',  label: 'MORA Principal',     password: 'Demo@2026',    school: 'SMAB', authority: 'MORA' },
  { username: 'teacher.smab1',   label: 'MORA Teacher',       password: 'Demo@2026',    school: 'SMAB', authority: 'MORA' },
  // ── ISB — Private ───────────────────────────────────────────────────
  { username: 'admin.isb',       label: 'Private Admin',      password: 'Demo@2026',    school: 'ISB',  authority: 'PRIVATE' },
  { username: 'teacher.isb1',    label: 'Intl Teacher',       password: 'Demo@2026',    school: 'ISB',  authority: 'PRIVATE' },
]

const AUTHORITY_COLOR: Record<string, string> = {
  MOE: '#165DFF', MORA: '#d48806', PRIVATE: '#722ED1',
}

const AUTHORITY_BG: Record<string, string> = {
  MOE: '#E6F0FF', MORA: '#FFF7E6', PRIVATE: '#F9F0FF',
}

function maskPassword(pw: string) {
  return pw.length <= 4 ? '••••' : pw.slice(0, 6) + '…'
}

// ─── Demo Accounts Panel ──────────────────────────────────────────────────────

interface DemoAccountsPanelProps {
  onFill: (username: string, password: string) => void
  onClose: () => void
}

function DemoAccountsPanel({ onFill, onClose }: DemoAccountsPanelProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <Card
      style={{
        width: 320,
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        alignSelf: 'flex-start',
      }}
      styles={{ body: { padding: '16px 0 8px' } }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 10px' }}>
        <Space size={6}>
          <KeyRound size={15} style={{ color: '#8c8c8c' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Demo Accounts</span>
        </Space>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#8c8c8c', padding: '2px 4px', borderRadius: 4,
            display: 'flex', alignItems: 'center',
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div style={{ padding: '0 16px 8px', fontSize: 11, color: '#aaa' }}>
        — click row to fill
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        padding: '4px 16px',
        borderTop: '1px solid #f0f0f0',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa',
      }}>
        {['Role', 'Username', 'Password'].map(h => (
          <span key={h} style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500 }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {DEMO_ACCOUNTS.map(acc => (
          <div
            key={acc.username}
            onClick={() => onFill(acc.username, acc.password)}
            onMouseEnter={() => setHovered(acc.username)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              padding: '7px 16px',
              cursor: 'pointer',
              background: hovered === acc.username ? '#f5f8ff' : 'transparent',
              borderBottom: '1px solid #f5f5f5',
              alignItems: 'center',
              transition: 'background 0.15s',
            }}
          >
            {/* Role column */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#262626' }}>{acc.label}</span>
              {acc.authority && (
                <Tag
                  style={{
                    fontSize: 9,
                    lineHeight: '14px',
                    padding: '0 4px',
                    margin: 0,
                    border: 'none',
                    color: AUTHORITY_COLOR[acc.authority],
                    background: AUTHORITY_BG[acc.authority] ?? '#f0f0f0',
                    fontWeight: 700,
                  }}
                >
                  {acc.authority === 'PRIVATE' ? 'PVT' : acc.authority}
                </Tag>
              )}
            </div>
            {/* Username column */}
            <span style={{ fontSize: 12, color: '#595959', fontFamily: 'monospace' }}>
              {acc.username}
            </span>
            {/* Password column */}
            <span style={{ fontSize: 12, color: '#8c8c8c', fontFamily: 'monospace' }}>
              {maskPassword(acc.password)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
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
      mask={{ closable: !loading }}
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
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [ssoProvider, setSsoProvider] = useState<'BRUNEI_ID' | 'EGNC_IDPM' | null>(null)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoSelectedUser, setSsoSelectedUser] = useState<string>('')
  const [panelOpen, setPanelOpen] = useState(true)

  const doLogin = async (username: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { username, password })
    if (data.success) {
      setAuth(data.user, data.token)
      navigate(ROLE_HOME[data.user.role] ?? '/dashboard', { replace: true })
    } else {
      throw new Error((data as any).message || 'Invalid credentials')
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

  const handleFill = (username: string, password: string) => {
    form.setFieldsValue({ username, password })
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* ── Login Card ── */}
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
              form={form}
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

            {/* ── Demo Accounts toggle (when panel is closed) ── */}
            {!panelOpen && (
              <>
                <Divider style={{ margin: '4px 0', fontSize: 12, color: '#bfbfbf' }}>
                  Quick Access
                </Divider>
                <Button
                  block
                  size="small"
                  icon={<KeyRound size={13} />}
                  onClick={() => setPanelOpen(true)}
                  style={{ color: '#8c8c8c', borderStyle: 'dashed' }}
                >
                  Show Demo Accounts
                </Button>
              </>
            )}
          </Space>
        </Card>

        {/* ── Demo Accounts Panel ── */}
        {panelOpen && (
          <DemoAccountsPanel
            onFill={handleFill}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </div>

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
