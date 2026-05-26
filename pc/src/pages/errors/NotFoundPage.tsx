import { Button, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileQuestion } from 'lucide-react'

const { Title, Paragraph } = Typography

export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center',
        padding: '40px 24px',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f9ff 100%)',
          borderRadius: '50%',
          width: 120,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 32,
        }}
      >
        <FileQuestion size={56} color="#165DFF" strokeWidth={1.5} />
      </div>

      <Title level={2} style={{ color: '#1d2129', marginBottom: 8 }}>
        {t('errors.notFoundTitle')}
      </Title>
      <Paragraph style={{ color: '#86909c', fontSize: 15, maxWidth: 400, marginBottom: 32 }}>
        {t('errors.notFoundDesc')}
      </Paragraph>

      <div style={{ display: 'flex', gap: 12 }}>
        <Button onClick={() => navigate(-1)}>
          {t('errors.goBack')}
        </Button>
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          {t('errors.goHome')}
        </Button>
      </div>
    </div>
  )
}
