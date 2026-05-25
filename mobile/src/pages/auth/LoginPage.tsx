import { useState } from 'react'
import { Form, Input, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'
import api from '@/lib/api'
import type { LoginResponse } from '@/types'

type Language = 'en' | 'zh' | 'ms'

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const { language, setLanguage } = useLanguageStore()
  const [loading, setLoading] = useState(false)

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', values)
      if (data.success) {
        setAuth(data.user, data.token)
        const roleHome: Record<string, string> = {
          parent: '/parent/home',
          student: '/student/home',
          teacher: '/teacher/home',
        }
        navigate(roleHome[data.user.role] ?? '/', { replace: true })
      }
    } catch {
      Toast.show({ content: t('auth.loginError'), icon: 'fail', duration: 2000 })
    } finally {
      setLoading(false)
    }
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
      {/* Language switcher */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', gap: 8 }}>
        {langs.map(l => (
          <button
            key={l.code}
            onClick={() => { setLanguage(l.code); void i18n.changeLanguage(l.code) }}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: language === l.code ? 700 : 400,
              background: language === l.code ? 'white' : 'rgba(255,255,255,0.3)',
              color: language === l.code ? '#165DFF' : 'white',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '20px 20px 36px', color: 'white' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 36,
        }}>
          🎓
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 0.5 }}>{t('auth.loginTitle')}</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>{t('auth.loginSubtitle')}</div>
      </div>

      {/* Form card */}
      <div style={{
        flex: 1,
        background: '#f5f5f5',
        borderRadius: '24px 24px 0 0',
        padding: '28px 20px 40px',
      }}>
        <Form
          onFinish={values => void handleLogin(values as { username: string; password: string })}
          footer={
            <Button
              block
              type="submit"
              color="primary"
              size="large"
              loading={loading}
              style={{ borderRadius: 12, height: 48, fontSize: 16, fontWeight: 600, marginTop: 8 }}
            >
              {t('auth.loginButton')}
            </Button>
          }
        >
          <div style={{
            background: 'white',
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
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

        <div style={{ textAlign: 'center', marginTop: 24, color: '#86909c', fontSize: 12 }}>
          MOE SERPS v0.1 · Ministry of Education, Brunei
        </div>
      </div>
    </div>
  )
}
