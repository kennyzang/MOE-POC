import { useNavigate } from 'react-router-dom'
import { Typography, Space, Button, Alert, Card } from 'antd'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const { Title, Paragraph, Text } = Typography

const TimetableConflictsPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div>
      <Space align="center" size={8} style={{ marginBottom: 24 }}>
        <ShieldCheck size={22} />
        <Title level={4} style={{ margin: 0 }}>{t('conflicts.title', 'Conflict Prevention')}</Title>
      </Space>

      <Card style={{ maxWidth: 640 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="success"
            showIcon
            message={t('conflicts.hardBlockTitle', 'Conflicts are prevented at creation')}
            description={t('conflicts.hardBlockDesc',
              'All scheduling constraints are enforced when adding or moving lessons. ' +
              'If a proposed slot would create a teacher double-booking (TT-01), a room clash (TT-02), ' +
              'or a class double-schedule (TT-03), the system blocks the action immediately with a clear error message.'
            )}
          />

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('conflicts.whatIsChecked', 'What is checked on every slot add or move:')}
            </Text>
            <Space direction="vertical" size={4}>
              <Text>
                <Text strong>TT-01</Text> — {t('conflicts.tt01', 'Teacher double-booking: same teacher assigned to two overlapping slots')}
              </Text>
              <Text>
                <Text strong>TT-02</Text> — {t('conflicts.tt02', 'Room clash: same room booked for two overlapping slots')}
              </Text>
              <Text>
                <Text strong>TT-03</Text> — {t('conflicts.tt03', 'Class double-schedule: same class has two lessons at overlapping times')}
              </Text>
            </Space>
          </div>

          <Alert
            type="info"
            showIcon
            message={t('conflicts.leaveCoverageNote', 'Leave coverage & substitute assignment')}
            description={t('conflicts.leaveCoverageDesc',
              'When a teacher is on approved leave, their timetable slots need a substitute. ' +
              'You can find and assign substitutes from the Leave Management page under EMS.'
            )}
          />

          <Button
            type="primary" ghost
            icon={<ExternalLink size={14} />}
            onClick={() => navigate('/ems/leave')}
          >
            {t('conflicts.goToLeave', 'Go to Leave Management')}
          </Button>
        </Space>
      </Card>
    </div>
  )
}

export default TimetableConflictsPage
