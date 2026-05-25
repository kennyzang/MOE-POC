import { Typography } from 'antd'
import { useTranslation } from 'react-i18next'

const StudentGradesPage = () => {
  const { t } = useTranslation()
  return (
    <div>
      <Typography.Title level={4}>StudentGradesPage</Typography.Title>
      <Typography.Text type="secondary">Under development</Typography.Text>
    </div>
  )
}

export default StudentGradesPage
