import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Tag, Button, Steps, Input } from 'antd-mobile'
import { ClipboardList, Plus, FileText, Eye, CheckCircle2, Clock, XCircle } from 'lucide-react'
import dayjs from 'dayjs'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'

interface Application {
  id: string
  applicationNumber: string
  applicantName: string
  gradeApplied: string
  status: string
  eligibilityScore: number | null
  submittedAt: string | null
  createdAt: string
  hasSiblingPriority: boolean
}

const STATUS_CONFIG: Record<string, { color: string; labelKey: string; icon: React.ElementType }> = {
  DRAFT: { color: '#86909c', labelKey: 'Draft', icon: FileText },
  SUBMITTED: { color: '#165DFF', labelKey: 'parent.submitted', icon: Clock },
  UNDER_REVIEW: { color: '#FAAD14', labelKey: 'parent.underReview', icon: Eye },
  APPROVED: { color: '#00B42A', labelKey: 'parent.approved', icon: CheckCircle2 },
  REJECTED: { color: '#F53F3F', labelKey: 'parent.rejected', icon: XCircle },
}

export default function ParentApplyPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: applications = [], isLoading, refetch } = useQuery({
    queryKey: ['parent-applications'],
    queryFn: async () => {
      const { data } = await api.get('/parent/applications')
      return data.data as Application[]
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const { data } = await api.post('/parent/applications', formData)
      return data
    },
    onSuccess: () => {
      setShowForm(false)
      void queryClient.invalidateQueries({ queryKey: ['parent-applications'] })
    },
  })

  // Simple form state
  const [form, setForm] = useState({
    applicantName: '',
    gradeApplied: '',
    icNumber: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
  })

  const handleSubmit = () => {
    submitMutation.mutate(form)
  }

  return (
    <AppLayout title={t('parent.application')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {/* New Application FAB */}
        <button
          onClick={() => setShowForm(true)}
          style={{
            position: 'fixed', right: 16, bottom: 80,
            width: 48, height: 48, borderRadius: 24,
            background: '#165DFF', color: 'white', border: 'none',
            boxShadow: '0 4px 12px rgba(22,93,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 90,
          }}
          aria-label={t('parent.newApplication')}
        >
          <Plus size={22} />
        </button>

        {/* New Application Modal */}
        {showForm && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }} onClick={() => setShowForm(false)}>
            <div
              style={{
                background: 'white', borderRadius: '16px 16px 0 0',
                padding: '20px 16px 32px', width: '100%', maxWidth: 480,
                maxHeight: '85vh', overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>
                {t('parent.newApplication')}
              </div>

              <Steps current={0} direction="horizontal" style={{ margin: '16px 0' }}>
                <Steps.Step title="Info" description="" />
                <Steps.Step title="Submit" description="" />
              </Steps>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>
                    Child's Name *
                  </label>
                  <Input
                    placeholder="Full name"
                    value={form.applicantName}
                    onChange={(val) => setForm(f => ({ ...f, applicantName: val }))}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>
                    Grade Applied *
                  </label>
                  <Input
                    placeholder="e.g., Year 7"
                    value={form.gradeApplied}
                    onChange={(val) => setForm(f => ({ ...f, gradeApplied: val }))}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>
                    IC Number
                  </label>
                  <Input
                    placeholder="IC / Passport"
                    value={form.icNumber}
                    onChange={(val) => setForm(f => ({ ...f, icNumber: val }))}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>
                    Guardian Name *
                  </label>
                  <Input
                    placeholder="Guardian full name"
                    value={form.guardianName}
                    onChange={(val) => setForm(f => ({ ...f, guardianName: val }))}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>
                    Phone *
                  </label>
                  <Input
                    placeholder="+673 XXX XXXX"
                    value={form.guardianPhone}
                    onChange={(val) => setForm(f => ({ ...f, guardianPhone: val }))}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>
                    Email
                  </label>
                  <Input
                    placeholder="email@example.com"
                    type="email"
                    value={form.guardianEmail}
                    onChange={(val) => setForm(f => ({ ...f, guardianEmail: val }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button block fill="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  block
                  fill="solid"
                  color="primary"
                  onClick={handleSubmit}
                  disabled={!form.applicantName || !form.gradeApplied || !form.guardianName || !form.guardianPhone || submitMutation.isPending}
                >
                  {submitMutation.isPending ? 'Submitting...' : t('parent.submit')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Application List */}
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <Skeleton animated style={{ height: 14, width: '45%', marginBottom: 8 }} />
                <Skeleton animated style={{ height: 12, width: '65%', marginBottom: 10 }} />
                <Skeleton animated style={{ height: 20, width: '40%' }} />
              </div>
            ))}
          </>
        ) : applications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <ClipboardList size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>{t('parent.noApplications')}</div>
            <p style={{ fontSize: 12, color: '#c9cdd4', marginTop: 6 }}>Tap + to create a new application</p>
          </div>
        ) : (
          applications.map(app => {
            const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.DRAFT
            const StatusIcon = cfg.icon

            return (
              <div key={app.id} style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1d1d1f' }}>
                      {app.applicantName || 'New Application'}
                    </div>
                    <div style={{ fontSize: 11, color: '#86909c', marginTop: 2 }}>
                      #{app.applicationNumber} · {app.gradeApplied}
                    </div>
                  </div>
                  <Tag fill="solid" color={cfg.color} style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
                    {t(cfg.labelKey)}
                  </Tag>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 10, paddingTop: 8, borderTop: '1px solid #f5f5f5',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#86909c' }}>
                    <StatusIcon size={11} color={cfg.color} />
                    {app.createdAt ? dayjs(app.createdAt).format('DD MMM YYYY') : '-'}
                  </div>

                  {app.eligibilityScore != null && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#165DFF' }}>
                      Score: {app.eligibilityScore}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}

        <div style={{ height: 24 }} />
      </PullToRefresh>
    </AppLayout>
  )
}
