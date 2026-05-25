import { Typography } from 'antd'
import { useTranslation } from 'react-i18next'

const AttendanceTrackingPage = () => {
  const { t } = useTranslation()
  return (
    <div>
      <Typography.Title level={4}>AttendanceTrackingPage</Typography.Title>
      <Typography.Text type="secondary">Under development</Typography.Text>
    </div>
  )
}

export default AttendanceTrackingPage
