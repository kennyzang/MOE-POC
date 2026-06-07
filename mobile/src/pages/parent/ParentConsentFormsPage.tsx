import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag, Dialog, Toast, Tabs } from 'antd-mobile'
import { FileCheck, Clock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'

interface ConsentFormItem {
  recipientId: string
  formId: string
  title: string
  description: string
  type: string
  status: string
  dueDate: string | null
  acknowledgedAt: string | null
  acknowledgmentNote: string | null
  studentId: string
  studentName: string
}

const TYPE_LABELS: Record<string, { labelKey: string; color: string }> = {
  FIELD_TRIP: { labelKey: 'parent.consentForms', color: '#f59e0b' },
  PHOTO_RELEASE: { labelKey: 'Photo Release', color: '#8b5cf6' },
  POLICY_ACKNOWLEDGMENT: { labelKey: 'Policy Ack', color: '#3b82f6' },
  OTHER: { labelKey: 'General', color: '#6b7280' },
}

export default function ParentConsentFormsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: forms = [], isLoading, refetch } = useQuery({
    queryKey: ['parent-consent-forms'],
    queryFn: async () => {
      const { data } = await api.get('/parent/consent-forms')
      return data.data as ConsentFormItem[]
    },
  })

  let filtered = forms
  if (activeTab === 'pending') {
    filtered = filtered.filter((f) => f.status !== 'ACKNOWLEDGED')
  }

  const pendingCount = forms.filter((f) => f.status !== 'ACKNOWLEDGED').length

  const ackMutation = useMutation({
    mutationFn: async (formId: string) => {
      const { data } = await api.post(`/parent/consent-forms/${formId}/acknowledge`, {})
      return data
    },
    onSuccess: () => {
      setExpandedId(null)
      Toast.show({ icon: 'success', content: t('parent.acknowledged') })
      void queryClient.invalidateQueries({ queryKey: ['parent-consent-forms'] })
    },
    onError: () => {
      Toast.show({ icon: 'fail', content: 'Failed to acknowledge' })
    },
  })

  const isOverdue = (dueDate: string | null): boolean =>
    !!dueDate && new Date(dueDate) < new Date()

  return (
    <AppLayout title={t('parent.consentForms')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* Filter Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as typeof activeTab)}
          style={{ '--title-font-size': '13px' } as React.CSSProperties}
        >
          <Tabs.Tab key="pending" title={`${t('parent.pendingAck')} (${pendingCount})`} />
          <Tabs.Tab key="all" title={`All (${forms.length})`} />
        </Tabs>

        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <Skeleton animated style={{ height: 14, width: '55%', marginBottom: 8 }} />
                <Skeleton animated style={{ height: 12, width: '75%', marginBottom: 10 }} />
                <Skeleton animated style={{ height: 20, width: '50%' }} />
              </div>
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <FileCheck size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>{activeTab === 'pending' ? t('parent.noConsentForms') : t('parent.noConsentForms')}</div>
          </div>
        ) : (
          filtered.map(form => {
            const typeCfg = TYPE_LABELS[form.type] ?? TYPE_LABELS.OTHER
            const overdue = isOverdue(form.dueDate)
            const isAcked = form.status === 'ACKNOWLEDGED'
            const expanded = expandedId === form.formId

            return (
              <div key={form.formId} className="consent-card" style={{
                background: 'white', borderRadius: 12,
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                borderLeft: overdue && !isAcked ? '3px solid #F53F3F' :
                  isAcked ? '3px solid #00B42A' : '3px solid transparent',
                overflow: 'hidden',
              }}>
                {/* Card Header - clickable */}
                <div
                  onClick={() => setExpandedId(expanded ? null : form.formId)}
                  style={{ padding: '14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13, color: '#1d1d1f',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {form.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#86909c', marginTop: 2 }}>
                        {form.studentName} · {typeCfg.labelKey}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      {isAcked ? (
                        <Tag fill="solid" color="success" style={{ fontSize: 10 }}>{t('parent.acknowledged')}</Tag>
                      ) : (
                        <Tag fill={overdue ? 'solid' : 'outline'} color={overdue ? 'danger' : 'warning'} style={{ fontSize: 10 }}>
                          {overdue ? t('parent.overdue') : t('parent.pendingAck')}
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 8, fontSize: 11, color: '#86909c',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} />
                      {form.dueDate ? dayjs(form.dueDate).format('DD MMM YYYY') : '-'}
                    </span>
                    <span>{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
                  </div>
                </div>

                {/* Expanded content */}
                {expanded && (
                  <div style={{
                    borderTop: '1px solid #f5f5f5',
                    padding: '12px 14px',
                    background: '#fafafa',
                  }}>
                    <p style={{ fontSize: 12, color: '#4c4f54', lineHeight: 1.6, margin: '0 0 10px' }}>
                      {form.description || t('parent.noConsentForms')}
                    </p>

                    {!isAcked && (
                      <button
                        onClick={() => {
                          Dialog.confirm({
                            content: `${t('parent.acknowledge')} "${form.title}"?`,
                            confirmText: t('parent.acknowledge'),
                            onConfirm: () => void ackMutation.mutate(form.formId),
                          })
                        }}
                        disabled={ackMutation.isPending}
                        style={{
                          width: '100%', padding: '9px', borderRadius: 8,
                          background: '#165DFF', color: 'white', border: 'none',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          opacity: ackMutation.isPending ? 0.7 : 1,
                        }}
                      >
                        {ackMutation.isPending ? '...' : t('parent.acknowledge')}
                      </button>
                    )}

                    {isAcked && form.acknowledgedAt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#00B42A' }}>
                        <CheckCircle2 size={12} />
                        {t('parent.acknowledged')} · {dayjs(form.acknowledgedAt).format('DD MMM YYYY HH:mm')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        <div style={{ height: 24 }} />
      </PullToRefresh>
    </AppLayout>
  )
}
