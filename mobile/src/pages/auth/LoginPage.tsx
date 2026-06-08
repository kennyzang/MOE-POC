import { useState } from 'react'
import { Form, Input, Button, Toast, Popup, Tag, Dialog } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'
import api from '@/lib/api'
import type { LoginResponse } from '@/types'

type Language = 'en' | 'zh' | 'ms'
type Authority = 'MOE' | 'MORA' | 'PRIVATE' | null

const DEMO_ACCOUNTS = [
  { username: 'teacher01',  label: 'Form Teacher',    labelZh: '班主任',        labelMs: 'Guru Tingkatan', password: 'teacher123', school: 'SMHK', authority: 'MOE' as Authority },
  { username: 'student001', label: 'Year 7 Student',  labelZh: '七年级学生',    labelMs: 'Pelajar Tahun 7',password: 'student123', school: 'SMHK', authority: 'MOE' as Authority },
  { username: 'parent01',   label: 'Parent',          labelZh: '家长',          labelMs: 'Ibu Bapa',      password: 'parent123',  school: 'SMHK', authority: 'MOE' as Authority },
]

const AUTHORITY_COLOR: Record<string, string> = {
  MOE: '#165DFF', MORA: '#d48806', PRIVATE: '#722ED1',
}

const AUTHORITY_BG: Record<string, string> = {
  MOE: '#E6F0FF', MORA: '#FFF7E6', PRIVATE: '#F9F0FF',
}

function maskPassword(pw: string) {
  return pw
}

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const { language, setLanguage } = useLanguageStore()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [demoPopupVisible, setDemoPopupVisible] = useState(false)
  const [ssoProvider, setSsoProvider] = useState<'BRUNEI_ID' | 'EGNC_IDPM' | null>(null)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoSelectedUser, setSsoSelectedUser] = useState('')

  const doLogin = async (username: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { username, password })
    if (data.success) {
      setAuth(data.user, data.token)
      const roleHome: Record<string, string> = {
        admin: '/teacher/home', manager: '/teacher/home',
        teacher: '/teacher/home', student: '/student/home', parent: '/parent/home',
        finance: '/teacher/home', admissions: '/teacher/home',
      }
      navigate(roleHome[data.user.role] ?? '/student/home', { replace: true })
    } else {
      throw new Error((data as any).message || 'Invalid credentials')
    }
  }

  const handleSsoConfirm = async (provider: 'BRUNEI_ID' | 'EGNC_IDPM') => {
    const accounts = provider === 'BRUNEI_ID'
      ? ['admin', 'principal', 'teacher01', 'adam']
      : ['admin', 'principal', 'hod01', 'farah']
    const username = ssoSelectedUser || accounts[0] || 'admin'
    const endpoint = provider === 'BRUNEI_ID' ? '/auth/brunei-id/callback' : '/auth/egnc-idpm/callback'

    setSsoLoading(true)
    try {
      const { data } = await api.post<LoginResponse>(endpoint, { mockUsername: username })
      if (data.success) {
        setSsoProvider(null)
        setSsoLoading(false)
        setAuth(data.user, data.token)
        const roleHome: Record<string, string> = {
          admin: '/teacher/home', manager: '/teacher/home',
          teacher: '/teacher/home', student: '/student/home', parent: '/parent/home',
        }
        navigate(roleHome[data.user.role] ?? '/student/home', { replace: true })
      }
    } catch {
      setSsoLoading(false)
      Toast.show({ content: t('auth.loginError'), icon: 'fail', duration: 2000 })
    }
  }

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await doLogin(values.username, values.password)
    } catch {
      Toast.show({ content: t('auth.loginError'), icon: 'fail', duration: 2000 })
    } finally {
      setLoading(false)
    }
  }

  const handleFillAccount = (account: typeof DEMO_ACCOUNTS[0]) => {
    form.setFieldsValue({ username: account.username, password: account.password })
    setDemoPopupVisible(false)
    Toast.show({ content: t('auth.accountFilled'), icon: 'success', duration: 1000 })
  }

  const getLabel = (account: typeof DEMO_ACCOUNTS[0]) => {
    if (language === 'zh') return account.labelZh
    if (language === 'ms') return account.labelMs
    return account.label
  }

  const langs: { code: Language; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'zh', label: '中' },
    { code: 'ms', label: 'MS' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #165DFF 0%, #0E42D2 40%, #f5f5f5 40%)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Spacer — language switcher moved into form card */}
      <div style={{ height: 20 }} />

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '12px 20px 24px', color: 'white' }}>
        <div style={{
          width: 60, height: 60, borderRadius: 18,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 10px',
          fontSize: 30,
        }}>
          🎓
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0.5 }}>{t('auth.loginTitle')}</div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{t('auth.loginSubtitle')}</div>
      </div>

      {/* Form card */}
      <div style={{
        flex: 1,
        background: '#f5f5f5',
        borderRadius: '24px 24px 0 0',
        padding: '20px 20px 24px',
      }}>
        {/* Language switcher — UNISSA style inside card */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 4,
          marginBottom: 16,
        }}>
          {langs.map(l => (
            <button
              key={l.code}
              onClick={() => { setLanguage(l.code); void i18n.changeLanguage(l.code) }}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: language === l.code ? '1.5px solid #165DFF' : '1.5px solid transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: language === l.code ? 700 : 400,
                background: 'transparent',
                color: language === l.code ? '#165DFF' : '#86909c',
                transition: 'all 0.15s',
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        <Form
          form={form}
          onFinish={values => void onFinish(values as { username: string; password: string })}
          footer={
            <Button
              block
              type="submit"
              color="primary"
              size="large"
              loading={loading}
              style={{ borderRadius: 12, height: 44, fontSize: 16, fontWeight: 600, marginTop: 4 }}
            >
              {t('auth.loginButton')}
            </Button>
          }
        >
          <div style={{
            background: 'white',
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <Form.Item
              name="username"
              rules={[{ required: true, message: `${t('auth.username')} is required` }]}
              style={{ '--border-bottom': '1px solid #f0f0f0' } as React.CSSProperties}
            >
              <Input placeholder={t('auth.username')} clearable />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: `${t('auth.password')} is required` }]}
            >
              <Input type="password" placeholder={t('auth.password')} />
            </Form.Item>
          </div>
        </Form>

        {/* SSO Buttons */}
        <div style={{ marginTop: 14 }}>
          <div style={{
            textAlign: 'center', fontSize: 11, color: '#86909c',
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
            <span>{t('auth.orSignInWith')}</span>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setSsoSelectedUser(''); setSsoProvider('BRUNEI_ID') }}
              style={{
                flex: 1,
                padding: '10px 6px',
                borderRadius: 10,
                border: '1.5px solid #FDB913',
                background: '#FFFBE6',
                color: '#7A5800',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              🛡️ {t('auth.signInWithBruneiId')}
            </button>

            <button
              onClick={() => { setSsoSelectedUser(''); setSsoProvider('EGNC_IDPM') }}
              style={{
                flex: 1,
                padding: '10px 6px',
                borderRadius: 10,
                border: '1.5px solid #165DFF',
                background: '#E6F0FF',
                color: '#165DFF',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              🏛️ {t('auth.signInWithEgnc')}
            </button>
          </div>
        </div>

        {/* Demo Accounts Toggle */}
        <div style={{ marginTop: 14 }}>
          <div style={{
            textAlign: 'center', fontSize: 11, color: '#86909c',
            marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
            <span>{t('auth.quickAccess')}</span>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
          </div>

          <button
            onClick={() => setDemoPopupVisible(true)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              border: '1.5px dashed #d9d9d9',
              background: 'white',
              color: '#8c8c8c',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            🔑 {t('auth.showDemoAccounts')}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12, color: '#86909c', fontSize: 10 }}>
          MOE SERPS v1.0 · Ministry of Education, Brunei
        </div>
      </div>

      {/* Demo Accounts Popup */}
      <Popup
        visible={demoPopupVisible}
        onMaskClick={() => setDemoPopupVisible(false)}
        position='bottom'
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '70vh',
          padding: '16px 0 24px',
        }}
      >
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}>
            <span style={{ fontWeight: 600, fontSize: 16 }}>🔑 {t('auth.demoAccounts')}</span>
            <button
              onClick={() => setDemoPopupVisible(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer',
                color: '#8c8c8c',
                padding: '4px',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
            {t('auth.clickToFill')}
          </div>
        </div>

        {/* Account List */}
        <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingLeft: 16, paddingRight: 16 }}>
          {DEMO_ACCOUNTS.map((account, idx) => (
            <div
              key={account.username}
              onClick={() => handleFillAccount(account)}
              style={{
                padding: '12px 16px',
                borderBottom: idx < DEMO_ACCOUNTS.length - 1 ? '1px solid #f5f5f5' : 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f8ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#262626' }}>
                      {getLabel(account)}
                    </span>
                    {account.authority && (
                      <Tag
                        style={{
                          fontSize: 10,
                          lineHeight: '16px',
                          padding: '0 4px',
                          margin: 0,
                          border: 'none',
                          color: AUTHORITY_COLOR[account.authority],
                          background: AUTHORITY_BG[account.authority],
                          fontWeight: 700,
                        }}
                      >
                        {account.authority === 'PRIVATE' ? 'PVT' : account.authority}
                      </Tag>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span style={{ color: '#595959', fontFamily: 'monospace' }}>{account.username}</span>
                    <span style={{ color: '#8c8c8c', fontFamily: 'monospace' }}>{maskPassword(account.password)}</span>
                  </div>
                </div>
                <div style={{ color: '#bfbfbf', fontSize: 16 }}>›</div>
              </div>
            </div>
          ))}
        </div>
      </Popup>

      {/* SSO Consent Modal */}
      {/* @ts-ignore - antd-mobile Dialog accepts children at runtime */}
      <Dialog
        visible={ssoProvider !== null}
        title={null}
        closeOnAction
        onClose={() => { if (!ssoLoading) setSsoProvider(null) }}
        actions={[
          {
            key: 'cancel',
            text: t('common.cancel'),
            onClick: () => { if (!ssoLoading) setSsoProvider(null) },
          },
          {
            key: 'confirm',
            text: ssoProvider === 'BRUNEI_ID'
              ? t('auth.ssoAllow', { provider: 'Brunei Digital ID' })
              : t('auth.ssoAllow', { provider: 'EGNC / IDPM' }),
            bold: true,
            onClick: () => { if (ssoProvider) handleSsoConfirm(ssoProvider) },
          },
        ]}
      >
        {ssoProvider && (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{
              background: ssoProvider === 'BRUNEI_ID' ? '#FFF8E6' : '#E6F0FF',
              border: `2px solid ${ssoProvider === 'BRUNEI_ID' ? '#FDB913' : '#165DFF'}`,
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {ssoProvider === 'BRUNEI_ID' ? '🛡️' : '🏛️'}
              </div>
              <Tag color={ssoProvider === 'BRUNEI_ID' ? 'gold' : 'blue'} style={{ marginBottom: 8 }}>
                {ssoProvider === 'BRUNEI_ID' ? 'id.gov.bn' : 'egnc.gov.bn'}
              </Tag>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                {ssoProvider === 'BRUNEI_ID' ? 'Brunei Digital ID' : 'EGNC / IDPM'}
              </div>
              <div style={{ fontSize: 13, color: '#555' }}>
                {t('auth.ssoConsentMessage', { app: 'MOE SERPS' })}
              </div>
            </div>

            {!ssoLoading && (
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>
                  {t('auth.ssoSelectDemoAccount')}
                </div>
                <select
                  value={ssoSelectedUser || (ssoProvider === 'BRUNEI_ID' ? 'admin' : 'admin')}
                  onChange={e => setSsoSelectedUser(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #d9d9d9',
                    fontSize: 14,
                  }}
                >
                  {(ssoProvider === 'BRUNEI_ID'
                    ? [
                        { username: 'admin', label: 'Admin (SMHK)' },
                        { username: 'principal', label: 'Principal (SMHK)' },
                        { username: 'teacher01', label: 'Teacher (SMHK)' },
                        { username: 'adam', label: 'Student (SMHK)' },
                      ]
                    : [
                        { username: 'admin', label: 'Admin (SMHK)' },
                        { username: 'principal', label: 'Principal (SMHK)' },
                        { username: 'hod01', label: 'HOD (SMHK)' },
                        { username: 'farah', label: 'Counselor (SMHK)' },
                      ]
                  ).map(opt => (
                    <option key={opt.username} value={opt.username}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {ssoLoading && (
              <div style={{ padding: '16px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <div style={{ color: '#8c8c8c', fontSize: 13 }}>
                  {t('auth.ssoRedirecting', {
                    provider: ssoProvider === 'BRUNEI_ID' ? 'Brunei Digital ID' : 'EGNC / IDPM',
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
