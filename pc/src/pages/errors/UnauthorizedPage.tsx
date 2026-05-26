import { Button, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'

const { Title, Paragraph } = Typography

export default function UnauthorizedPage() {
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
          background: 'linear-gradient(135deg, #fff7e6 0%, #fff3cd 100%)',
          borderRadius: '50%',
          width: 120,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 32,
        }}
      >
        <ShieldAlert size={56} color="#fa8c16" strokeWidth={1.5} />
      </div>

      <Title level={2} style={{ color: '#1d2129', marginBottom: 8 }}>
        {t('errors.unauthorizedTitle')}
      </Title>
      <Paragraph style={{ color: '#86909c', fontSize: 15, maxWidth: 400, marginBottom: 32 }}>
        {t('errors.unauthorizedDesc')}
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
