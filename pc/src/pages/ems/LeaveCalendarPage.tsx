import { useState } from 'react'
import {
  Card, Typography, Space, Badge, Tag, Popover, Calendar, List, Avatar, Empty, Row, Col,
} from 'antd'
import type { Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Users } from 'lucide-react'
import api from '../../lib/api'

const { Title, Text } = Typography

interface LeaveEntry {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  daysRequested: number
  teacher: { user: { displayName: string } }
}

const LEAVE_TYPE_COLOR: Record<string, string> = {
  ANNUAL:        'blue',
  MEDICAL:       'red',
  MATERNITY:     'pink',
  PATERNITY:     'purple',
  UNPAID:        'default',
  HAJJ:          'gold',
  COMPASSIONATE: 'orange',
  EMERGENCY:     'volcano',
}

function isBetween(date: Dayjs, start: string, end: string): boolean {
  const d     = date.valueOf()
  const s     = new Date(start).setHours(0, 0, 0, 0)
  const e     = new Date(end).setHours(23, 59, 59, 999)
  return d >= s && d <= e
}

const LeaveCalendarPage = () => {
  const { t } = useTranslation()
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  })

  const { data: leaves = [], isLoading } = useQuery<LeaveEntry[]>({
    queryKey: ['leave-calendar', viewMonth.year, viewMonth.month],
    queryFn: async () => {
      const start = new Date(viewMonth.year, viewMonth.month, 1)
      const end   = new Date(viewMonth.year, viewMonth.month + 1, 0)
      const { data } = await api.get('/leave/calendar', {
        params: {
          start: start.toISOString().slice(0, 10),
          end:   end.toISOString().slice(0, 10),
        },
      })
      return data.data as LeaveEntry[]
    },
  })

  const getLeavesForDate = (date: Dayjs): LeaveEntry[] =>
    leaves.filter(l => isBetween(date, l.startDate, l.endDate))

  const cellRender = (date: Dayjs) => {
    const dayLeaves = getLeavesForDate(date)
    if (dayLeaves.length === 0) return null

    return (
      <div style={{ overflow: 'hidden' }}>
        {dayLeaves.slice(0, 2).map(l => (
          <Badge
            key={l.id}
            color={LEAVE_TYPE_COLOR[l.leaveType] ?? 'default'}
            text={
              <Text style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 70, display: 'inline-block' }}>
                {l.teacher.user.displayName.split(' ')[0]}
              </Text>
            }
            style={{ display: 'block', lineHeight: '16px' }}
          />
        ))}
        {dayLeaves.length > 2 && (
          <Text type="secondary" style={{ fontSize: 10 }}>+{dayLeaves.length - 2} more</Text>
        )}
      </div>
    )
  }

  const selectedDateLeaves = selectedDate ? getLeavesForDate(selectedDate) : []

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center" size={8}>
            <CalendarDays size={22} />
            <Title level={4} style={{ margin: 0 }}>{t('leave.schoolLeaveCalendar', 'School Leave Calendar')}</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            {Object.entries(LEAVE_TYPE_COLOR).slice(0, 4).map(([type, color]) => (
              <Tag key={type} color={color} style={{ fontSize: 11 }}>
                {t(`leaveType.${type}`, type)}
              </Tag>
            ))}
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <Card loading={isLoading}>
            <Calendar
              cellRender={cellRender}
              onSelect={(date, info) => {
                if (info.source === 'date') setSelectedDate(date)
              }}
              onPanelChange={(value) => {
                setViewMonth({ year: value.year(), month: value.month() })
                setSelectedDate(null)
              }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card
            title={
              <Space>
                <Users size={16} />
                {selectedDate
                  ? t('leave.onLeaveOn', 'On Leave — {{date}}', { date: selectedDate.format('D MMM YYYY') })
                  : t('leave.selectDate', 'Select a date to see staff')}
              </Space>
            }
            style={{ minHeight: 200 }}
          >
            {!selectedDate ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('leave.clickDate', 'Click a date on the calendar')} />
            ) : selectedDateLeaves.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('leave.noLeaveOnDate', 'No staff on leave this day')} />
            ) : (
              <List
                dataSource={selectedDateLeaves}
                renderItem={item => (
                  <List.Item key={item.id}>
                    <List.Item.Meta
                      avatar={
                        <Avatar style={{ backgroundColor: '#1677ff', fontSize: 13 }}>
                          {item.teacher.user.displayName.charAt(0)}
                        </Avatar>
                      }
                      title={item.teacher.user.displayName}
                      description={
                        <Space size={4}>
                          <Tag color={LEAVE_TYPE_COLOR[item.leaveType] ?? 'default'} style={{ fontSize: 10 }}>
                            {t(`leaveType.${item.leaveType}`, item.leaveType)}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {item.daysRequested}d · {new Date(item.startDate).toLocaleDateString()} – {new Date(item.endDate).toLocaleDateString()}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          {/* Summary for current month */}
          <Card
            size="small"
            title={t('leave.monthSummary', 'Month Summary')}
            style={{ marginTop: 12 }}
          >
            {Object.entries(LEAVE_TYPE_COLOR).map(([type, color]) => {
              const count = leaves.filter(l => l.leaveType === type).length
              if (count === 0) return null
              return (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Tag color={color} style={{ fontSize: 11 }}>{t(`leaveType.${type}`, type)}</Tag>
                  <Text strong>{count}</Text>
                </div>
              )
            })}
            {leaves.length === 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>{t('leave.noApprovedLeaves', 'No approved leaves this month')}</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default LeaveCalendarPage
