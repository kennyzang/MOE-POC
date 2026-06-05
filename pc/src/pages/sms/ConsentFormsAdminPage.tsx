import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileCheck, Plus, X, Check, BarChart2, Clock, ChevronDown, Trash2,
  Send, AlertTriangle, CheckCircle2, Users,
} from 'lucide-react'
import api from '@/lib/api'
import styles from './ConsentFormsAdminPage.module.css'

interface ConsentFormAdmin {
  id: string
  title: string
  description: string
  type: string
  status: string
  dueDate: string | null
  targetGradeLevel: string | null
  createdAt: string
  _count: { recipients: number }
  acknowledgedCount: number
}

interface ReportData {
  form: ConsentFormAdmin
  summary: { total: number; acknowledged: number; pending: number; rate: number }
  recipients: Array<{
    recipientId: string
    parentName: string
    parentEmail: string
    studentName: string
    gradeLevel: string
    className: string
    acknowledgedAt: string | null
    acknowledgmentNote: string | null
  }>
}

const FORM_TYPES = [
  { value: 'FIELD_TRIP', label: 'Field Trip' },
  { value: 'PHOTO_RELEASE', label: 'Photo Release' },
  { value: 'POLICY_ACKNOWLEDGMENT', label: 'Policy Acknowledgment' },
  { value: 'OTHER', label: 'Other' },
]

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: '#f1f5f9', color: '#64748b' },
  ACTIVE: { bg: '#dbeafe', color: '#1d4ed8' },
  CLOSED: { bg: '#f0fdf4', color: '#166534' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface CreateModalProps {
  onClose: () => void
  onCreate: (form: ConsentFormAdmin) => void
}

function CreateModal({ onClose, onCreate }: CreateModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('OTHER')
  const [dueDate, setDueDate] = useState('')
  const [targetGradeLevel, setTargetGradeLevel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await api.post('/communications/consent-forms', {
        title: title.trim(),
        description: description.trim(),
        type,
        dueDate: dueDate || undefined,
        targetGradeLevel: targetGradeLevel || undefined,
      })
      onCreate(res.data.data)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create form')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Create Consent Form</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && <div className={styles.errorBox}><AlertTriangle size={14} /> {error}</div>}

            <label className={styles.fieldLabel}>
              Title <span className={styles.required}>*</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Field Trip to National Museum — Permission Slip"
                className={styles.input}
                required
              />
            </label>

            <label className={styles.fieldLabel}>
              Description <span className={styles.required}>*</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what parents are consenting to, event details, dates, etc."
                rows={5}
                className={styles.input}
                required
              />
            </label>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>
                Form Type
                <select value={type} onChange={(e) => setType(e.target.value)} className={styles.input}>
                  {FORM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldLabel}>
                Due Date (optional)
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={styles.input}
                />
              </label>
            </div>

            <label className={styles.fieldLabel}>
              Target Grade Level (optional — leave blank for all grades)
              <input
                type="text"
                value={targetGradeLevel}
                onChange={(e) => setTargetGradeLevel(e.target.value)}
                placeholder="e.g., Year 7"
                className={styles.input}
              />
            </label>

            <div className={styles.noteBox}>
              <AlertTriangle size={14} />
              Form will be saved as <strong>Draft</strong>. Publish it afterwards to send to parents.
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Creating…' : 'Create Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ReportModalProps {
  reportData: ReportData
  onClose: () => void
}

function ReportModal({ reportData, onClose }: ReportModalProps) {
  const { form, summary, recipients } = reportData
  const [showPending, setShowPending] = useState(false)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.reportModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Acknowledgment Report</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className={styles.modalBody}>
          <h3 className={styles.reportFormTitle}>{form.title}</h3>

          {/* Summary cards */}
          <div className={styles.reportSummary}>
            <div className={styles.reportStat}>
              <span className={styles.reportStatNum}>{summary.total}</span>
              <span className={styles.reportStatLabel}>Total</span>
            </div>
            <div className={styles.reportStat}>
              <span className={`${styles.reportStatNum} ${styles.ackNum}`}>{summary.acknowledged}</span>
              <span className={styles.reportStatLabel}>Acknowledged</span>
            </div>
            <div className={styles.reportStat}>
              <span className={`${styles.reportStatNum} ${styles.pendNum}`}>{summary.pending}</span>
              <span className={styles.reportStatLabel}>Pending</span>
            </div>
            <div className={styles.reportStat}>
              <div className={styles.rateCircle}>
                <svg viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="#10b981" strokeWidth="3"
                    strokeDasharray={`${summary.rate} ${100 - summary.rate}`}
                    strokeDashoffset="25"
                    strokeLinecap="round"
                  />
                </svg>
                <span className={styles.rateLabel}>{summary.rate}%</span>
              </div>
              <span className={styles.reportStatLabel}>Rate</span>
            </div>
          </div>

          {/* Toggle */}
          <div className={styles.toggleRow}>
            <button
              className={`${styles.toggleBtn} ${!showPending ? styles.toggleActive : ''}`}
              onClick={() => setShowPending(false)}
            >
              <CheckCircle2 size={14} /> Acknowledged ({summary.acknowledged})
            </button>
            <button
              className={`${styles.toggleBtn} ${showPending ? styles.toggleActive : ''}`}
              onClick={() => setShowPending(true)}
            >
              <Clock size={14} /> Pending ({summary.pending})
            </button>
          </div>

          {/* Recipients table */}
          <div className={styles.recipientsTable}>
            {recipients
              .filter((r) => showPending ? r.acknowledgedAt === null : r.acknowledgedAt !== null)
              .map((r) => (
                <div key={r.recipientId} className={styles.recipientRow}>
                  <div className={styles.recipientInfo}>
                    <div className={styles.recipientName}>{r.parentName}</div>
                    <div className={styles.recipientMeta}>
                      {r.studentName} · {r.gradeLevel} {r.className}
                    </div>
                    {r.parentEmail && (
                      <div className={styles.recipientEmail}>{r.parentEmail}</div>
                    )}
                  </div>
                  <div>
                    {r.acknowledgedAt ? (
                      <div className={styles.ackStatus}>
                        <Check size={14} /> {formatDate(r.acknowledgedAt)}
                        {r.acknowledgmentNote && (
                          <div className={styles.noteChip} title={r.acknowledgmentNote}>Note</div>
                        )}
                      </div>
                    ) : (
                      <div className={styles.pendingStatus}><Clock size={14} /> Pending</div>
                    )}
                  </div>
                </div>
              ))}
            {recipients.filter((r) => showPending ? r.acknowledgedAt === null : r.acknowledgedAt !== null).length === 0 && (
              <div className={styles.emptyRecipients}>No recipients in this category</div>
            )}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function ConsentFormsAdminPage() {
  const { t } = useTranslation()
  const [forms, setForms] = useState<ConsentFormAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchForms()
  }, [])

  async function fetchForms() {
    try {
      const res = await api.get('/communications/consent-forms')
      setForms(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handlePublish(formId: string) {
    setPublishing(formId)
    try {
      await api.patch(`/communications/consent-forms/${formId}/publish`)
      setForms((prev) => prev.map((f) => f.id === formId ? { ...f, status: 'ACTIVE' } : f))
    } finally {
      setPublishing(null)
    }
  }

  async function handleClose(formId: string) {
    try {
      await api.patch(`/communications/consent-forms/${formId}/close`)
      setForms((prev) => prev.map((f) => f.id === formId ? { ...f, status: 'CLOSED' } : f))
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDelete(formId: string) {
    if (!confirm('Delete this form? This cannot be undone.')) return
    setDeleting(formId)
    try {
      await api.delete(`/communications/consent-forms/${formId}`)
      setForms((prev) => prev.filter((f) => f.id !== formId))
    } finally {
      setDeleting(null)
    }
  }

  async function loadReport(formId: string) {
    try {
      const res = await api.get(`/communications/consent-forms/${formId}/report`)
      setReportData(res.data.data)
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = forms.filter((f) => statusFilter === 'all' ? true : f.status === statusFilter)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><FileCheck size={26} /></div>
          <div>
            <h1 className={styles.title}>{t('admin.consentForms', { defaultValue: 'Consent Forms Management' })}</h1>
            <p className={styles.subtitle}>Create, publish and track parent acknowledgment forms</p>
          </div>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Form
        </button>
      </header>

      {/* Stats row */}
      {forms.length > 0 && (
        <div className={styles.statsRow}>
          {[
            { label: 'Total', value: forms.length, color: '' },
            { label: 'Draft', value: forms.filter((f) => f.status === 'DRAFT').length, color: '#64748b' },
            { label: 'Active', value: forms.filter((f) => f.status === 'ACTIVE').length, color: '#1d4ed8' },
            { label: 'Closed', value: forms.filter((f) => f.status === 'CLOSED').length, color: '#166534' },
          ].map((s) => (
            <button
              key={s.label}
              className={`${styles.statCard} ${statusFilter === (s.label === 'Total' ? 'all' : s.label.toUpperCase()) ? styles.statCardActive : ''}`}
              onClick={() => setStatusFilter(s.label === 'Total' ? 'all' : s.label.toUpperCase())}
            >
              <span className={styles.statNum} style={{ color: s.color || undefined }}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <FileCheck size={48} />
          <p>{statusFilter === 'all' ? 'No consent forms yet. Create your first one.' : `No ${statusFilter.toLowerCase()} forms.`}</p>
          {statusFilter === 'all' && (
            <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Create Form
            </button>
          )}
        </div>
      ) : (
        <div className={styles.formsList}>
          {filtered.map((form) => {
            const statusStyle = STATUS_COLORS[form.status] ?? STATUS_COLORS['DRAFT']
            const ackRate = form._count.recipients > 0
              ? Math.round((form.acknowledgedCount / form._count.recipients) * 100)
              : 0
            return (
              <div key={form.id} className={styles.formCard}>
                <div className={styles.formCardTop}>
                  <div className={styles.formMeta}>
                    <span
                      className={styles.statusBadge}
                      style={{ background: statusStyle.bg, color: statusStyle.color }}
                    >
                      {form.status}
                    </span>
                    <span className={styles.typeBadge}>{FORM_TYPES.find((t) => t.value === form.type)?.label ?? form.type}</span>
                    {form.targetGradeLevel && (
                      <span className={styles.gradeBadge}>{form.targetGradeLevel}</span>
                    )}
                  </div>
                  <div className={styles.formDate}>Created {formatDate(form.createdAt)}</div>
                </div>

                <h3 className={styles.formTitle}>{form.title}</h3>
                <p className={styles.formDesc}>{form.description.slice(0, 140)}{form.description.length > 140 ? '…' : ''}</p>

                <div className={styles.formBottom}>
                  {/* Progress bar */}
                  {form.status !== 'DRAFT' && form._count.recipients > 0 && (
                    <div className={styles.progressArea}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${ackRate}%` }} />
                      </div>
                      <span className={styles.progressLabel}>
                        <Users size={12} /> {form.acknowledgedCount}/{form._count.recipients} acknowledged ({ackRate}%)
                      </span>
                    </div>
                  )}
                  {form.dueDate && (
                    <span className={styles.dueChip}>
                      <Clock size={12} /> Due {formatDate(form.dueDate)}
                    </span>
                  )}

                  {/* Actions */}
                  <div className={styles.actions}>
                    {form.status !== 'DRAFT' && (
                      <button
                        className={styles.reportBtn}
                        onClick={() => loadReport(form.id)}
                      >
                        <BarChart2 size={14} /> Report
                      </button>
                    )}
                    {form.status === 'DRAFT' && (
                      <>
                        <button
                          className={styles.publishBtn}
                          disabled={publishing === form.id}
                          onClick={() => handlePublish(form.id)}
                        >
                          <Send size={14} /> {publishing === form.id ? 'Publishing…' : 'Publish'}
                        </button>
                        <button
                          className={styles.deleteBtn}
                          disabled={deleting === form.id}
                          onClick={() => handleDelete(form.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    {form.status === 'ACTIVE' && (
                      <button
                        className={styles.closeFormBtn}
                        onClick={() => handleClose(form.id)}
                      >
                        <Check size={14} /> Close
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(newForm) => {
            setForms((prev) => [{ ...newForm, _count: { recipients: 0 }, acknowledgedCount: 0 }, ...prev])
            setShowCreate(false)
          }}
        />
      )}

      {reportData && (
        <ReportModal
          reportData={reportData}
          onClose={() => setReportData(null)}
        />
      )}
    </div>
  )
}
