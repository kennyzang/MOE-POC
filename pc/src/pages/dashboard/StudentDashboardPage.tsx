import { Typography } from 'antd'
import { useTranslation } from 'react-i18next'

const StudentDashboardPage = () => {
  const { t } = useTranslation()
  return (
    <div>
      <Typography.Title level={4}>StudentDashboardPage</Typography.Title>
      <Typography.Text type="secondary">Under development</Typography.Text>
    </div>
  )
}

export default StudentDashboardPage
