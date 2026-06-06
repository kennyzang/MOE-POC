import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SpinLoading, List, Tag, Modal, TextArea, Button, Toast, Selector } from 'antd-mobile'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'
import type { ApiResponse, AttendanceRecord } from '@/types'

const statusColor: Record<string, string> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'default',
}

const REASON_OPTIONS = [
  { label: 'Sick', value: 'Sick' },
  { label: 'Personal', value: 'Personal' },
  { label: 'Unexplained', value: 'Unexplained' },
  { label: 'Other', value: 'Other' },
]

export default function ParentAttendancePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [reasonModal, setReasonModal] = useState<{ open: boolean; record: AttendanceRecord | null }>({
    open: false,
    record: null,
  })
  const [selectedReason, setSelectedReason] = useState<string[]>([])
  const [noteText, setNoteText] = useState('')

  const { data: records, isLoading } = useQuery({
    queryKey: ['parent-attendance'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttendanceRecord[]>>('/attendance/records')
      return data.data
    },
  })

  const submitReason = useMutation({
    mutationFn: async ({ recordId, absenceReason, parentNote }: { recordId: string; absenceReason: string; parentNote: string }) => {
      const { data } = await api.patch(`/attendance/records/${recordId}/reason`, { absenceReason, parentNote })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-attendance'] })
      Toast.show({ content: 'Reason submitted. Teacher has been notified.', icon: 'success' })
      setReasonModal({ open: false, record: null })
      setSelectedReason([])
      setNoteText('')
    },
    onError: () => {
      Toast.show({ content: 'Failed to submit reason. Please try again.', icon: 'fail' })
    },
  })

  const openReasonModal = (record: AttendanceRecord) => {
    setSelectedReason(record.absenceReason ? [record.absenceReason] : [])
    setNoteText(record.parentNote ?? '')
    setReasonModal({ open: true, record })
  }

  const handleSubmit = () => {
    if (!reasonModal.record) return
    if (selectedReason.length === 0) {
      Toast.show({ content: 'Please select a reason', icon: 'fail' })
      return
    }
    submitReason.mutate({
      recordId: reasonModal.record.id,
      absenceReason: selectedReason[0],
      parentNote: noteText.trim(),
    })
  }

  const totalSessions = records?.length ?? 0
  const presentCount = records?.filter(r => r.status === 'present' || r.status === 'late').length ?? 0
  const rate = totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(1) : '0.0'

  return (
    <AppLayout title={t('parent.childAttendance')} showLogout>
      {/* Summary */}
      <div className="stats-row" style={{ marginBottom: 12 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22 }}>{totalSessions}</div>
          <div className="stat-label">{t('common.total')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22, color: '#00B42A' }}>{presentCount}</div>
          <div className="stat-label">{t('attendance.present')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22, color: '#165DFF' }}>{rate}%</div>
          <div className="stat-label">{t('parent.attendanceRate')}</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading style={{ '--size': '40px' } as React.CSSProperties} color="primary" />
        </div>
      ) : !records || records.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86909c', padding: 40 }}>{t('common.noData')}</div>
      ) : (
        <List style={{ borderRadius: 12, overflow: 'hidden' }}>
          {records.map(record => {
            const isAbsent = record.status === 'absent'
            const hasReason = !!record.absenceReason
            return (
              <List.Item
                key={record.id}
                prefix={
                  <Tag color={statusColor[record.status] ?? 'default'} style={{ fontSize: 11 }}>
                    {t(`attendance.${record.status}`)}
                  </Tag>
                }
                extra={
                  <span style={{ fontSize: 11, color: '#86909c', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {record.session?.date ? dayjs(record.session.date).format('DD/MM') : ''}
                  </span>
                }
              >
                <div style={{ width: '100%' }}>
                  {/* Row 1: session topic/course */}
                  <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#1d2129',
                    marginBottom: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {record.session?.topic ?? record.session?.course?.name ?? '—'}
                  </div>
                  {/* Row 2: sub-info + actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 11, color: '#86909c' }}>
                      {record.session?.course?.code ?? ''}
                    </span>
                    {hasReason && (
                      <>
                        <span style={{ fontSize: 11, color: '#86909c' }}>·</span>
                        <span style={{
                          fontSize: 11,
                          color: '#FF7D00',
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {record.absenceReason}
                        </span>
                      </>
                    )}
                    {hasReason && record.parentNote && (
                      <span style={{
                        fontSize: 11,
                        color: '#86909c',
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        "{record.parentNote}"
                      </span>
                    )}
                    {isAbsent && !hasReason && (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#165DFF',
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        onClick={() => openReasonModal(record)}
                      >
                        → {t('parent.giveReason')}
                      </span>
                    )}
                  </div>
                </div>
              </List.Item>
            )
          })}
        </List>
      )}

      {/* Absence Reason Modal */}
      <Modal
        visible={reasonModal.open}
        title="Submit Absence Reason"
        closeOnMaskClick
        onClose={() => setReasonModal({ open: false, record: null })}
        content={
          <div style={{ paddingTop: 8 }}>
            <div style={{ marginBottom: 12, color: '#86909c', fontSize: 14 }}>
              {reasonModal.record?.session?.course?.name} —{' '}
              {reasonModal.record?.session?.date ? dayjs(reasonModal.record.session.date).format('DD MMM YYYY') : ''}
            </div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Reason</div>
            <Selector
              columns={2}
              options={REASON_OPTIONS}
              value={selectedReason}
              onChange={v => setSelectedReason(v)}
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Note (optional)</div>
            <TextArea
              placeholder="e.g. fever since last night, will resume tomorrow"
              value={noteText}
              onChange={v => setNoteText(v)}
              rows={3}
              style={{ marginBottom: 16, '--font-size': '14px' } as React.CSSProperties}
            />
            <Button
              block
              color="primary"
              loading={submitReason.isPending}
              onClick={handleSubmit}
            >
              Submit Reason
            </Button>
          </div>
        }
        actions={[]}
      />
    </AppLayout>
  )
}
