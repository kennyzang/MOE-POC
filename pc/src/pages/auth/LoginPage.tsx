import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message, Space, Divider, Tooltip } from 'antd'
import { Lock, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { ROLE_HOME } from '@/layouts/Sidebar'
import api from '@/lib/api'
import type { LoginRequest, LoginResponse } from '@/types'

const { Title, Text } = Typography

const DEMO_ACCOUNTS = [
  { username: 'admin',     label: 'Admin',       password: 'admin123',    color: '#722ED1', bg: '#F9F0FF' },
  { username: 'principal', label: 'Principal',   password: 'principal123', color: '#096DD9', bg: '#E6F4FF' },
  { username: 'hod01',     label: 'HOD',         password: 'hod123',      color: '#531DAB', bg: '#F9F0FF' },
  { username: 'manager',   label: 'Manager',     password: 'Demo@2026',   color: '#1677FF', bg: '#E6F4FF' },
  { username: 'drsiti',    label: 'Teacher',     password: 'Demo@2026',   color: '#FA8C16', bg: '#FFF7E6' },
  { username: 'adam',      label: 'Student',     password: 'Demo@2026',   color: '#52C41A', bg: '#F6FFED' },
  { username: 'fatimah',   label: 'Parent',      password: 'Demo@2026',   color: '#EB2F96', bg: '#FFF0F6' },
  { username: 'finance',   label: 'Finance',     password: 'finance123',  color: '#13C2C2', bg: '#E6FFFB' },
]

const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [quickLoading, setQuickLoading] = useState<string | null>(null)

  const doLogin = async (username: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { username, password })
    if (data.success) {
      setAuth(data.user, data.token)
      navigate(ROLE_HOME[data.user.role] ?? '/dashboard', { replace: true })
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

          <Divider style={{ margin: '4px 0', fontSize: 12, color: '#bfbfbf' }}>
            Demo Accounts
          </Divider>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DEMO_ACCOUNTS.map(account => (
              <Tooltip key={account.username} title={account.username} placement="top">
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
                  }}
                >
                  {account.label}
                </Button>
              </Tooltip>
            ))}
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default LoginPage
