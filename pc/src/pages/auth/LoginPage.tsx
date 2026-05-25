import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Space } from 'antd'
import { Lock, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { ROLE_HOME } from '@/layouts/Sidebar'
import api from '@/lib/api'
import type { LoginRequest, LoginResponse } from '@/types'

const { Title, Text } = Typography

const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: LoginRequest) => {
    setLoading(true)
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', values)
      if (data.success) {
        setAuth(data.user, data.token)
        const home = ROLE_HOME[data.user.role] ?? '/dashboard'
        navigate(home, { replace: true })
      }
    } catch {
      message.error(t('auth.loginError'))
    } finally {
      setLoading(false)
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
          width: 420,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ marginBottom: 4 }}>
              {t('auth.loginTitle')}
            </Title>
            <Text type="secondary">{t('auth.loginSubtitle')}</Text>
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

          <div
            style={{
              background: '#f7f8fa',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 12,
              color: '#86909c',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Demo Accounts</div>
            <div>admin / Demo@2026 — System Admin</div>
            <div>manager / Demo@2026 — School Manager</div>
            <div>drsiti / Demo@2026 — Teacher</div>
            <div>adam / Demo@2026 — Student</div>
            <div>fatimah / Demo@2026 — Parent</div>
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default LoginPage
