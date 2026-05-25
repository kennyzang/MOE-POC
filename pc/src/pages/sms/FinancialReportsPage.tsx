import { Typography } from 'antd'
import { useTranslation } from 'react-i18next'

const FinancialReportsPage = () => {
  const { t } = useTranslation()
  return (
    <div>
      <Typography.Title level={4}>FinancialReportsPage</Typography.Title>
      <Typography.Text type="secondary">Under development</Typography.Text>
    </div>
  )
}

export default FinancialReportsPage
