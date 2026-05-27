import { useEffect, useState } from 'react'
import { Card, Form, Input, Button, Space, Typography, Divider, message, Tabs, Switch, Select, Slider, InputNumber, Row, Col } from 'antd'
import { Settings, Mail, Send, Bot, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'

const { Title, Text } = Typography

interface SmtpConfig {
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_pass: string
  smtp_from: string
}

interface AiConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  enabled: boolean
}

// ─── SMTP Tab ────────────────────────────────────────────────────

function SmtpTab() {
  const { t } = useTranslation()
  const [form] = Form.useForm<SmtpConfig>()
  const [testEmailValue, setTestEmailValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    api
      .get<{ success: boolean; data: SmtpConfig }>('/config/smtp')
      .then(res => form.setFieldsValue(res.data.data))
      .catch(() => {})
  }, [form])

  const handleSave = async (values: SmtpConfig) => {
    setSaving(true)
    try {
      await api.put('/config/smtp', values)
      message.success(t('settings.saveSuccess'))
    } catch {
      message.error(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await api.post<{ success: boolean; message: string }>('/config/smtp/test', {
        testEmail: testEmailValue || undefined,
      })
      if (res.data.success) {
        message.success(res.data.message || t('settings.testSuccess'))
      } else {
        message.error(t('settings.testFailed'))
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      message.error(msg || t('settings.testFailed'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <Space align="center" style={{ marginBottom: 4 }}>
        <Mail size={16} color="var(--color-primary)" />
        <Text strong style={{ fontSize: 15 }}>{t('settings.emailConfig')}</Text>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
        {t('settings.emailConfigDesc')}
      </Text>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          label={t('settings.smtpHost')}
          name="smtp_host"
          rules={[{ required: true, message: t('common.required') }]}
        >
          <Input placeholder="smtp.office365.com" />
        </Form.Item>

        <Form.Item
          label={t('settings.smtpPort')}
          name="smtp_port"
          rules={[{ required: true, message: t('common.required') }]}
        >
          <Input placeholder="587" style={{ width: 120 }} />
        </Form.Item>

        <Form.Item
          label={t('settings.smtpUser')}
          name="smtp_user"
          rules={[{ required: true, message: t('common.required') }]}
        >
          <Input placeholder="sender@example.com" />
        </Form.Item>

        <Form.Item
          label={t('settings.smtpPass')}
          name="smtp_pass"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>{t('settings.leaveBlankPassword')}</Text>}
        >
          <Input.Password placeholder="••••••••" />
        </Form.Item>

        <Form.Item label={t('settings.smtpFrom')} name="smtp_from">
          <Input placeholder="MOE SERPS <sender@example.com>" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={saving}>
            {t('settings.saveConfig')}
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      <Space align="center" style={{ marginBottom: 12 }}>
        <Send size={16} color="var(--color-primary)" />
        <Text strong>{t('settings.testEmail')}</Text>
      </Space>
      <Space>
        <Input
          placeholder={t('settings.testEmailPlaceholder')}
          value={testEmailValue}
          onChange={e => setTestEmailValue(e.target.value)}
          style={{ width: 280 }}
        />
        <Button icon={<Send size={14} />} onClick={handleTest} loading={testing}>
          {t('settings.testEmail')}
        </Button>
      </Space>
    </>
  )
}

// ─── AI Tab ──────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai',    label: 'OpenAI (GPT)' },
  { value: 'custom',    label: 'Custom / OpenAI-compatible (Ollama, DeepSeek, ...)' },
]

function AiTab() {
  const { t } = useTranslation()
  const [form] = Form.useForm<AiConfig>()
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [temperature, setTemperature] = useState(0.7)

  useEffect(() => {
    api
      .get<{ success: boolean; data: AiConfig }>('/ai/config')
      .then(res => {
        const cfg = res.data.data
        form.setFieldsValue({ ...cfg, apiKey: '' }) // never pre-fill key
        setEnabled(cfg.enabled)
        setTemperature(cfg.temperature ?? 0.7)
      })
      .catch(() => {})
  }, [form])

  const handleSave = async (values: AiConfig) => {
    setSaving(true)
    try {
      const payload: Partial<AiConfig> = {
        provider:     values.provider,
        model:        values.model,
        baseUrl:      values.baseUrl,
        temperature,
        maxTokens:    values.maxTokens,
        systemPrompt: values.systemPrompt,
        enabled,
      }
      if (values.apiKey) payload.apiKey = values.apiKey
      await api.put('/ai/config', payload)
      message.success(t('settings.aiSaveSuccess'))
    } catch {
      message.error(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await api.post<{ success: boolean; message: string }>('/ai/config/test', {})
      if (res.data.success) {
        message.success(`${t('settings.aiTestSuccess')}: ${res.data.message}`)
      } else {
        message.error(res.data.message || t('settings.aiTestFailed'))
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      message.error(msg || t('settings.aiTestFailed'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <Space align="center" style={{ marginBottom: 4 }}>
        <Bot size={16} color="var(--color-primary)" />
        <Text strong style={{ fontSize: 15 }}>{t('settings.aiConfig')}</Text>
      </Space>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
        {t('settings.aiConfigDesc')}
      </Text>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{ provider: 'custom', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', maxTokens: 2048 }}
      >
        {/* Enable toggle */}
        <Form.Item label={t('settings.aiEnabled')} style={{ marginBottom: 20 }}>
          <Space>
            <Switch
              checked={enabled}
              onChange={setEnabled}
              checkedChildren="ON"
              unCheckedChildren="OFF"
            />
            <Text type="secondary" style={{ fontSize: 13 }}>
              {enabled ? t('settings.aiEnabledLabel') : t('settings.aiDisabledLabel')}
            </Text>
          </Space>
        </Form.Item>

        {/* Provider + API Key */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label={t('settings.aiProvider')} name="provider" rules={[{ required: true }]}>
              <Select options={PROVIDER_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t('settings.aiApiKey')}
              name="apiKey"
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{t('settings.aiLeaveBlankKey')}</Text>}
            >
              <Input.Password placeholder={t('settings.aiApiKeyPlaceholder')} />
            </Form.Item>
          </Col>
        </Row>

        {/* Model + Base URL */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label={t('settings.aiModel')} name="model" rules={[{ required: true }]}>
              <Input placeholder="deepseek-chat" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t('settings.aiBaseUrl')}
              name="baseUrl"
              extra={<Text type="secondary" style={{ fontSize: 12 }}>{t('settings.aiBaseUrlPlaceholder')}</Text>}
            >
              <Input placeholder="https://api.deepseek.com/v1" />
            </Form.Item>
          </Col>
        </Row>

        {/* Temperature + Max Tokens */}
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              label={
                <Space size={6}>
                  <span>{t('settings.aiTemperature')}</span>
                  <Text style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{temperature}</Text>
                </Space>
              }
            >
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={setTemperature}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.aiTemperatureHint')}</Text>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label={t('settings.aiMaxTokens')} name="maxTokens">
              <InputNumber min={256} max={8192} step={256} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {/* System Prompt */}
        <Form.Item label={t('settings.aiSystemPrompt')} name="systemPrompt">
          <Input.TextArea
            rows={4}
            placeholder={t('settings.aiSystemPromptPlaceholder')}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              {t('settings.saveConfig')}
            </Button>
            <Button icon={<Zap size={14} />} onClick={handleTest} loading={testing}>
              {t('settings.aiTestConnection')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </>
  )
}

// ─── Main Page ───────────────────────────────────────────────────

const SettingsPage = () => {
  const { t } = useTranslation()

  const items = [
    {
      key: 'email',
      label: (
        <Space size={6}>
          <Mail size={14} />
          {t('settings.emailConfig')}
        </Space>
      ),
      children: <SmtpTab />,
    },
    {
      key: 'ai',
      label: (
        <Space size={6}>
          <Bot size={14} />
          {t('settings.aiConfig')}
        </Space>
      ),
      children: <AiTab />,
    },
  ]

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0' }}>
      <Space align="center" style={{ marginBottom: 24 }}>
        <Settings size={22} color="var(--color-primary)" />
        <Title level={4} style={{ margin: 0 }}>
          {t('settings.title')}
        </Title>
      </Space>

      <Card>
        <Tabs items={items} />
      </Card>
    </div>
  )
}

export default SettingsPage
