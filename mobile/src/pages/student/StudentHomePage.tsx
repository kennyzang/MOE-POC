import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag, Tabs } from 'antd-mobile'
import { BookOpen, CalendarCheck, Award, Megaphone, Pin, ShieldAlert, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { ApiResponse, StudentDashboardStats, Announcement } from '@/types'

const typeColor: Record<string, string> = {
  exam: 'danger',
  quiz: 'warning',
  assignment: 'primary',
  project: 'success',
}

export default function StudentHomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [assessTab, setAssessTab] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<StudentDashboardStats>>('/dashboard/stats')
      return data.data
    },
  })

  const { data: announcements } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Announcement[]>>('/announcements')
      return data.data ?? []
    },
  })

  const latestAnnos = (announcements ?? []).slice(0, 3)

  return (
    <AppLayout title={t('student.title')} showLogout>
      <div className="welcome-card">
        <div className="welcome-name">
          {t('student.welcome')}, {user?.displayName?.split(' ')[0]}
        </div>
        <div className="welcome-sub">{user?.displayName}</div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : (
        <>
          <div className="stats-row" style={{ marginBottom: 12 }}>
            <div className="stat-card">
              <BookOpen size={18} color="#165DFF" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22 }}>{data?.enrolledCourses ?? 0}</div>
              <div className="stat-label">{t('student.enrolledCourses')}</div>
            </div>
            <div className="stat-card">
              <CalendarCheck size={18} color="#00B42A" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22, color: '#00B42A' }}>
                {(data?.attendanceRate ?? 0).toFixed(1)}%
              </div>
              <div className="stat-label">{t('student.attendanceRate')}</div>
            </div>
            <div className="stat-card">
              <Award size={18} color="#FF7D00" style={{ margin: '0 auto 4px' }} />
              <div className="stat-value" style={{ fontSize: 22, color: '#FF7D00' }}>
                {(data?.gpa ?? 0).toFixed(2)}
              </div>
              <div className="stat-label">{t('student.gpa')}</div>
            </div>
          </div>

          {/* Quick Access */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div
              onClick={() => navigate('/student/behavior')}
              style={{
                background: 'white', borderRadius: 12, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <ShieldAlert size={20} color="#FF7D00" />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1d2129' }}>
                {t('student.behavior')}
              </span>
            </div>
            <div
              onClick={() => navigate('/student/report-card')}
              style={{
                background: 'white', borderRadius: 12, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <FileText size={20} color="#722ED1" />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1d2129' }}>
                {t('student.reportCard')}
              </span>
            </div>
          </div>

          <div className="section-title">{t('student.upcomingAssessments')}</div>

          {/* Assessment type tabs */}
          <Tabs
            activeKey={assessTab}
            onChange={setAssessTab}
            style={{ '--active-line-color': '#165DFF', '--active-title-color': '#165DFF', marginBottom: 8 } as React.CSSProperties}
          >
            {[
              { key: 'all',        title: t('student.allTypes') },
              { key: 'exam',       title: t('student.examType') },
              { key: 'quiz',       title: t('student.quizType') },
              { key: 'assignment', title: t('student.assignmentType') },
            ].map(tab => (
              <Tabs.Tab key={tab.key} title={tab.title} />
            ))}
          </Tabs>

          {(() => {
            const items = (data?.upcomingItems ?? []).filter(
              item => assessTab === 'all' || item.type === assessTab
            )
            if (!items.length) {
              return (
                <div style={{
                  textAlign: 'center', color: '#86909c', padding: 20,
                  background: 'white', borderRadius: 12,
                }}>
                  {t('student.noUpcoming')}
                </div>
              )
            }
            return (
              <List style={{ borderRadius: 12, overflow: 'hidden' }}>
                {items.map(item => (
                  <List.Item
                    key={item.id}
                    prefix={
                      <Tag color={typeColor[item.type] ?? 'default'} style={{ fontSize: 11 }}>
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </Tag>
                    }
                    description={item.course?.name ?? ''}
                    extra={
                      <span style={{ fontSize: 12, color: '#86909c' }}>
                        {item.dueDate ? dayjs(item.dueDate).format('DD/MM') : ''}
                      </span>
                    }
                  >
                    {item.name}
                  </List.Item>
                ))}
              </List>
            )
          })()}

          {/* Announcements Section */}
          {latestAnnos.length > 0 && (
            <>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Megaphone size={16} color="#165DFF" />
                  {t('announcements.title')}
                </span>
                <span
                  onClick={() => navigate('/student/announcements')}
                  style={{ fontSize: 12, color: '#165DFF', cursor: 'pointer', fontWeight: 500 }}
                >
                  {t('announcements.viewAll')}
                </span>
              </div>
              {latestAnnos.map(anno => (
                <div
                  key={anno.id}
                  className={`anno-card ${anno.priority === 'urgent' ? 'anno-card-urgent' : anno.isPinned ? 'anno-card-pinned' : ''}`}
                  onClick={() => navigate(`/announcement/detail?id=${anno.id}`)}
                >
                  <div className="anno-card-title">
                    {anno.isPinned && <Pin size={12} color="#FF7D00" />}
                    {anno.priority === 'urgent' && (
                      <Tag color="danger" fill="outline" style={{ fontSize: 10, padding: '0 4px' }}>
                        {t('announcements.urgent')}
                      </Tag>
                    )}
                    {anno.title}
                  </div>
                  <div className="anno-card-content">{anno.content}</div>
                  <div className="anno-card-footer">
                    <span>{dayjs(anno.publishedAt).format('DD MMM')}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </AppLayout>
  )
}
