import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag } from 'antd-mobile'
import { FileText, BookOpen, Printer } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'

interface GradeItem {
  id: string
  name: string
  type: string
  maxScore: number
  weight: number
  score: number | null
  letterGrade: string | null
  percentage: number | null
}

interface CourseGrade {
  courseId: string
  courseCode: string
  courseName: string
  gradeLevel: string | null
  courseAverage: number | null
  gradeItems: GradeItem[]
}

const LETTER_COLOR: Record<string, string> = {
  A: '#00B42A', B: '#165DFF', C: '#FAAD14', D: '#FF7D00', F: '#F53F3F',
}

const SEMESTERS = ['2026-S1', '2026-S2', '2025-S1', '2025-S2']

export default function StudentReportCardPage() {
  const { t } = useTranslation()
  const [semester, setSemester] = useState(SEMESTERS[0])

  const { data: grades = [], isLoading, refetch } = useQuery({
    queryKey: ['student-report-card', semester],
    queryFn: async () => {
      const { data } = await api.get(`/students/me/report-card?semester=${semester}`)
      return data.data as CourseGrade[]
    },
  })

  // Calculate overall GPA across all courses
  const overallGpa = grades.length > 0
    ? grades.reduce((sum, c) => sum + (c.courseAverage ?? 0), 0) / grades.length
    : 0

  const handlePrint = () => {
    window.print()
  }

  return (
    <AppLayout title={t('student.reportCard')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Semester selector + Print */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10, gap: 8,
        }}>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              border: '1px solid #e5e5e5', fontSize: 13, color: '#333',
              background: 'white',
            }}
          >
            {SEMESTERS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 12px', borderRadius: 8,
              border: '1px solid #e5e5e5', background: 'white',
              fontSize: 12, color: '#666', cursor: 'pointer',
            }}
          >
            <Printer size={14} /> {t('student.printReportCard')}
          </button>
        </div>

        {/* Overall GPA Card */}
        {!isLoading && grades.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #165DFF 0%, #4080ff 100%)',
            borderRadius: 12, padding: '16px', marginBottom: 12,
            color: 'white',
          }}>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>{t('student.overallGpa')}</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{overallGpa.toFixed(2)}</div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
              {grades.length} {t('student.courses').toLowerCase()} · {semester}
            </div>
          </div>
        )}

        {/* Course Grades */}
        {isLoading ? (
          <>
            {[1, 2].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <Skeleton animated style={{ height: 14, width: '45%', marginBottom: 10 }} />
                {[1, 2, 3].map(j => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Skeleton animated style={{ height: 12, width: '35%' }} />
                    <Skeleton animated style={{ height: 12, width: '25%' }} />
                  </div>
                ))}
              </div>
            ))}
          </>
        ) : grades.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <FileText size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>No report card data available</div>
          </div>
        ) : (
          grades.map(course => (
            <div key={course.courseId} className="report-course-card" style={{
              background: 'white', borderRadius: 12, padding: '14px',
              marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              {/* Course Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingBottom: 10, borderBottom: '1px solid #f0f0f0', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BookOpen size={15} color="#165DFF" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1d1d1f' }}>
                      {course.courseCode} {course.courseName}
                    </div>
                    {course.gradeLevel && (
                      <div style={{ fontSize: 11, color: '#86909c' }}>{course.gradeLevel}</div>
                    )}
                  </div>
                </div>
                {course.courseAverage != null && (
                  <div style={{
                    fontSize: 18, fontWeight: 700, color: course.courseAverage >= 70 ? '#00B42A' :
                      course.courseAverage >= 50 ? '#FAAD14' : '#F53F3F',
                  }}>
                    {course.courseAverage.toFixed(1)}%
                  </div>
                )}
              </div>

              {/* Grade Items */}
              {course.gradeItems.map(item => (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: item.id !== course.gradeItems[course.gradeItems.length - 1]?.id
                    ? '1px solid #fafafa' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#333' }}>
                      {item.name}
                      <span style={{ fontSize: 10, color: '#bbb', marginLeft: 4 }}>
                        ({(item.weight * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      {t('student.maxScore')}: {item.maxScore}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.score != null && (
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                        {item.score}/{item.maxScore}
                      </span>
                    )}
                    {item.letterGrade && (
                      <Tag
                        fill="solid"
                        color={LETTER_COLOR[item.letterGrade] ?? 'default'}
                        style={{ fontSize: 11, fontWeight: 700 }}
                      >
                        {item.letterGrade}
                      </Tag>
                    )}
                    {item.percentage != null && (
                      <span style={{ fontSize: 11, color: '#86909c', width: 40, textAlign: 'right' }}>
                        {item.percentage.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        <div style={{ height: 24 }} />
      </PullToRefresh>
    </AppLayout>
  )
}
