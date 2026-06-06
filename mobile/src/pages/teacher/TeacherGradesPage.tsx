import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  SpinLoading, Card, Tag, Button, Input, Toast, Selector,
  Popup, DotLoading,
} from 'antd-mobile'
import { ChevronRight, FileText, Save } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, CourseAssignment, GradeItem, Grade, Enrollment } from '@/types'

interface StudentEnrollment extends Enrollment {
  student: {
    id: string
    userId: string
    studentId: string
    user: { displayName: string }
  }
}

const GRADE_TYPE_OPTIONS = [
  { label: 'Quiz', value: 'quiz' },
  { label: 'Assignment', value: 'assignment' },
  { label: 'Exam', value: 'exam' },
  { label: 'Project', value: 'project' },
]

/* ────── Course List (default view) ────── */

function CourseList({ onSelect }: { onSelect: (courseId: string) => void }) {
  const { t } = useTranslation()

  const { data: teacher, isLoading } = useQuery({
    queryKey: ['teacher-me'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ courseAssignments: CourseAssignment[] }>>('/teachers/me')
      return data.data
    },
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <SpinLoading style={{ '--size': '32px' } as React.CSSProperties} color="primary" />
      </div>
    )
  }

  const assignments = teacher?.courseAssignments ?? []

  if (assignments.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#86909c', padding: 60, fontSize: 14 }}>
        {t('teacher.noClasses')}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 15, marginBottom: 10, padding: '0 4px' }}>
        <FileText size={16} color="#165DFF" />
        <span>{t('teacher.selectCourse')}</span>
      </div>
      {assignments.map(a => (
        <Card
          key={a.id}
          style={{ marginBottom: 10, borderRadius: 14 }}
          onClick={() => onSelect(a.courseId)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{a.course?.name}</div>
              <Tag color="primary" fill="outline" style={{ marginTop: 4, fontSize: 11 }}>{a.course?.code}</Tag>
            </div>
            <ChevronRight size={16} color="#c0c4cc" />
          </div>
          {a.schedule && (
            <div style={{ fontSize: 12, color: '#86909c', marginTop: 6 }}>
              {a.schedule}
            </div>
          )}
        </Card>
      ))}
    </>
  )
}

/* ────── Grade Items List for a course ────── */

function GradeItemsList({ courseId, onAddItem, onEnterGrades }: {
  courseId: string
  onAddItem: () => void
  onEnterGrades: (itemId: string) => void
}) {
  const { t } = useTranslation()

  const { data: items, isLoading } = useQuery({
    queryKey: ['grade-items', courseId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<GradeItem[]>>('/grade-items', { params: { courseId } })
      return data.data
    },
    enabled: !!courseId,
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <DotLoading color="primary" />
      </div>
    )
  }

  const list = items ?? []

  return (
    <>
      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#f0f5ff', borderRadius: 10, padding: '10px 14px',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 13, color: '#165DFF', fontWeight: 600 }}>
          <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {list.length} {t('teacher.gradeItems', 'Grade Items')}
        </div>
        <Button size="mini" color="primary" fill="outline" onClick={onAddItem}>
          + {t('teacher.addGradeItem', 'Add Item')}
        </Button>
      </div>

      {list.length === 0 ? (
        <Card style={{ borderRadius: 14 }}>
          <div style={{ textAlign: 'center', color: '#86909c', padding: 20, fontSize: 13 }}>
            {t('teacher.noGradeItems', 'No grade items yet. Create your first quiz or assignment.')}
          </div>
        </Card>
      ) : (
        list.map(item => (
          <Card key={item.id} style={{ marginBottom: 10, borderRadius: 14 }}>
            <div
              style={{ cursor: 'pointer' }}
              onClick={() => onEnterGrades(item.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Tag
                  color={
                    item.type === 'exam' ? 'danger' :
                    item.type === 'quiz' ? 'warning' :
                    item.type === 'project' ? 'success' : 'primary'
                  }
                  style={{ fontSize: 10 }}
                >
                  {item.type}
                </Tag>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{item.name}</span>
                <span style={{ fontSize: 12, color: '#86909c' }}>/{item.maxScore}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#86909c' }}>
                <span>{(item.weight * 100).toFixed(0)}% weight</span>
                {item.dueDate && <span>Due: {dayjs(item.dueDate).format('DD/MM/YY')}</span>}
              </div>
            </div>
          </Card>
        ))
      )}
    </>
  )
}

/* ────── Enter Grades for a specific grade item ────── */

function GradeEntryPanel({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [scores, setScores] = useState<Record<string, string>>({})

  const { data: item } = useQuery({
    queryKey: ['grade-item', itemId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<GradeItem>>(`/grade-items/${itemId}`)
      return data.data
    },
    enabled: !!itemId,
  })

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments-for-grading', item?.courseId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<StudentEnrollment[]>>('/enrollments', {
        params: { courseId: item?.courseId, status: 'enrolled' },
      })
      return data.data
    },
    enabled: !!item?.courseId,
  })

  // Pre-fill existing grades
  const { data: existingGrades } = useQuery({
    queryKey: ['grades', itemId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Grade[]>>('/grades', { params: { gradeItemId: itemId } })
      return data.data
    },
    enabled: !!itemId,
  })

  // Initialize scores from existing grades when they load
  React.useEffect(() => {
    if (existingGrades) {
      const initial: Record<string, string> = {}
      for (const g of existingGrades) {
        if (g.score !== null) initial[g.studentId] = String(g.score)
      }
      setScores(prev => ({ ...initial, ...prev }))
    }
  }, [existingGrades])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(scores).map(([studentId, scoreStr]) => ({
        studentId,
        gradeItemId: itemId,
        score: scoreStr ? Number(scoreStr) : null,
      }))
      const { data } = await api.post('/grades/batch', { entries })
      return data
    },
    onSuccess: () => {
      Toast.show({ content: t('teacher.gradesSaved', 'Grades saved successfully'), icon: 'success' })
      qc.invalidateQueries({ queryKey: ['grades', itemId] })
      onClose()
    },
    onError: () => {
      Toast.show({ content: t('common.saveFailed', 'Save failed'), icon: 'fail' })
    },
  })

  const maxScore = item?.maxScore ?? 100

  return (
    <Popup
      visible
      onMaskClick={onClose}
      onClose={onClose}
      bodyStyle={{
        height: '85vh',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      position="bottom"
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid #f0f0f0',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{item?.name}</div>
          <div style={{ fontSize: 12, color: '#86909c' }}>Max: {maxScore} points</div>
        </div>
        <Button
          size="small"
          color="primary"
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          <Save size={14} style={{ verticalAlign: 'middle', marginRight: 2 }} />
          {t('common.save', 'Save')}
        </Button>
      </div>

      {/* Student list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <DotLoading color="primary" />
          </div>
        ) : !enrollments || enrollments.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#86909c', padding: 40, fontSize: 13 }}>
            {t('teacher.noStudents', 'No enrolled students')}
          </div>
        ) : (
          enrollments.map(enrollment => (
            <div
              key={enrollment.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderBottom: '1px solid #f5f5f5',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: '#f0f5ff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#165dff',
                flexShrink: 0,
              }}>
                {enrollment.student?.user?.displayName?.charAt(0) ?? '?'}
              </div>

              {/* Name + ID */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {enrollment.student?.user?.displayName ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: '#86909c' }}>{enrollment.student?.studentId}</div>
              </div>

              {/* Score input */}
              <Input
                type="number"
                placeholder={`0-${maxScore}`}
                value={scores[enrollment.studentId] ?? ''}
                onChange={v => setScores(prev => ({ ...prev, [enrollment.studentId]: v }))}
                style={{
                  width: 70, textAlign: 'center',
                  '--font-size': '14px',
                  '--text-align': 'center',
                } as React.CSSProperties}
              />
            </div>
          ))
        )}
      </div>
    </Popup>
  )
}

// Need to import React for useEffect above
import React from 'react'

/* ────── Add Grade Item Modal ────── */

function AddItemModal({ visible, courseId, onClose, onSuccess }: {
  visible: boolean
  courseId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState<string[]>(['quiz'])
  const [maxScore, setMaxScore] = useState('100')
  const [weight, setWeight] = useState('10')

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/grade-items', {
        courseId,
        name,
        type: type[0],
        maxScore: Number(maxScore),
        weight: Number(weight) / 100,
      })
      return data
    },
    onSuccess: () => {
      Toast.show({ icon: 'success', content: t('teacher.gradeItemCreated', 'Grade item created') })
      qc.invalidateQueries({ queryKey: ['grade-items', courseId] })
      setName('')
      setType(['quiz'])
      setMaxScore('100')
      setWeight('10')
      onSuccess()
      onClose()
    },
    onError: () => {
      Toast.show({ icon: 'fail', content: t('common.createFailed', 'Creation failed') })
    },
  })

  if (!visible) return null

  return (
    <Popup
      visible
      onMaskClick={onClose}
      onClose={onClose}
      bodyStyle={{
        maxHeight: '80vh',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflowY: 'auto',
      }}
      position="bottom"
    >
      <div style={{ padding: '16px 20px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>
          {t('teacher.addGradeItem', 'Add Grade Item')}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('common.name', 'Name')}</div>
          <Input
            placeholder={t('teacher.quizNamePlaceholder', 'e.g. Quiz 1 - Algebra')}
            value={name}
            onChange={setName}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('teacher.type', 'Type')}</div>
          <Selector
            options={GRADE_TYPE_OPTIONS}
            value={type}
            onChange={setType}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('teacher.maxScore', 'Max Score')}</div>
            <Input
              type="number"
              placeholder="100"
              value={maxScore}
              onChange={setMaxScore}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('teacher.weight', 'Weight %')}</div>
            <Input
              type="number"
              placeholder="10"
              value={weight}
              onChange={setWeight}
            />
          </div>
        </div>

        <Button
          block
          color="primary"
          size="large"
          loading={createMutation.isPending}
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {t('common.create', 'Create')}
        </Button>
      </div>
    </Popup>
  )
}

/* ────── Main Component ────── */

export default function TeacherGradesPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const courseIdParam = searchParams.get('courseId')

  const [selectedCourseId, setSelectedCourseId] = useState(courseIdParam ?? '')
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const handleSelectCourse = (cid: string) => {
    setSelectedCourseId(cid)
    setSearchParams({ courseId: cid }, { replace: true })
  }

  const handleBackToList = () => {
    setSelectedCourseId('')
    setSearchParams({}, { replace: true })
  }

  return (
    <AppLayout title={t('teacher.grades', 'Grades')} showLogout>
      {!selectedCourseId ? (
        /* Step 1: Select course */
        <CourseList onSelect={handleSelectCourse} />
      ) : activeItemId ? (
        /* Step 3: Enter grades */
        <GradeEntryPanel
          itemId={activeItemId}
          onClose={() => setActiveItemId(null)}
        />
      ) : (
        /* Step 2: View grade items for course */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button
              onClick={handleBackToList}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#165DFF', fontSize: 13, fontWeight: 600, padding: 0,
                display: 'flex', alignItems: 'center', gap: 2,
              }}
            >
              &larr; {t('common.back', 'Back')}
            </button>
          </div>
          <GradeItemsList
            courseId={selectedCourseId}
            onAddItem={() => setShowAddModal(true)}
            onEnterGrades={setActiveItemId}
          />
          <AddItemModal
            visible={showAddModal}
            courseId={selectedCourseId}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {}}
          />
        </>
      )}
    </AppLayout>
  )
}
