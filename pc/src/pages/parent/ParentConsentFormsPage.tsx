import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileCheck, Clock, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import api from '@/lib/api'
import styles from './ParentConsentFormsPage.module.css'

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

const TYPE_LABELS: Record<string, string> = {
  FIELD_TRIP: 'Field Trip',
  PHOTO_RELEASE: 'Photo Release',
  POLICY_ACKNOWLEDGMENT: 'Policy Acknowledgment',
  OTHER: 'General',
}

const TYPE_COLORS: Record<string, string> = {
  FIELD_TRIP: '#f59e0b',
  PHOTO_RELEASE: '#8b5cf6',
  POLICY_ACKNOWLEDGMENT: '#3b82f6',
  OTHER: '#6b7280',
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AcknowledgeModal({
  form,
  onClose,
  onConfirm,
}: {
  form: ConsentFormItem
  onClose: () => void
  onConfirm: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Acknowledge Form</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.modalBody}>
          <div
            className={styles.formTypeBadge}
            style={{ background: `${TYPE_COLORS[form.type] ?? '#6b7280'}20`, color: TYPE_COLORS[form.type] ?? '#6b7280' }}
          >
            {TYPE_LABELS[form.type] ?? form.type}
          </div>
          <h3 className={styles.modalTitle}>{form.title}</h3>
          <div className={styles.modalStudentBadge}>For: {form.studentName}</div>

          <div className={`${styles.descriptionBox} ${expanded ? styles.expanded : ''}`}>
            {form.description}
          </div>
          <button
            className={styles.expandBtn}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Read full description</>}
          </button>

          {form.dueDate && (
            <div className={`${styles.dueNotice} ${isOverdue(form.dueDate) ? styles.overdue : ''}`}>
              <Clock size={14} />
              {isOverdue(form.dueDate) ? 'Overdue: ' : 'Due: '}
              {formatDate(form.dueDate)}
            </div>
          )}

          <label className={styles.noteLabel}>
            Optional note (e.g., "I have reviewed this form")
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              className={styles.noteInput}
            />
          </label>

          <div className={styles.confirmBox}>
            <CheckCircle2 size={18} color="#10b981" />
            <span>
              By clicking <strong>Acknowledge</strong>, I confirm that I have read and understood the above
              content on behalf of <strong>{form.studentName}</strong>.
            </span>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.confirmBtn}
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true)
              await onConfirm(note)
            }}
          >
            {submitting ? 'Acknowledging…' : 'Acknowledge'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ParentConsentFormsPage() {
  const { t } = useTranslation()
  const [forms, setForms] = useState<ConsentFormItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState<ConsentFormItem | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

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

  async function handleAcknowledge(note: string) {
    if (!acknowledging) return
    try {
      await api.post(`/communications/consent-forms/${acknowledging.formId}/acknowledge`, {
        studentId: acknowledging.studentId,
        acknowledgmentNote: note || undefined,
      })
      setForms((prev) =>
        prev.map((f) =>
          f.recipientId === acknowledging.recipientId
            ? { ...f, acknowledgedAt: new Date().toISOString(), acknowledgmentNote: note }
            : f,
        ),
      )
    } finally {
      setAcknowledging(null)
    }
  }

  const filtered = forms.filter((f) => {
    if (filter === 'pending') return !f.acknowledgedAt
    if (filter === 'done') return !!f.acknowledgedAt
    return true
  })

  const pendingCount = forms.filter((f) => !f.acknowledgedAt).length
  const overdueCount = forms.filter((f) => !f.acknowledgedAt && isOverdue(f.dueDate)).length

  if (loading) {
    return <div className={styles.loading}><div className={styles.spinner} /></div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIcon}><FileCheck size={28} /></div>
        <div>
          <h1 className={styles.title}>{t('parent.consentForms', { defaultValue: 'Consent & Acknowledgment Forms' })}</h1>
          <p className={styles.subtitle}>Review and acknowledge forms sent by the school</p>
        </div>
      </header>

      {/* Summary bar */}
      {forms.length > 0 && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryNum}>{forms.length}</span>
            <span className={styles.summaryLabel}>Total Forms</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={`${styles.summaryNum} ${pendingCount > 0 ? styles.pendingNum : ''}`}>{pendingCount}</span>
            <span className={styles.summaryLabel}>Pending</span>
          </div>
          {overdueCount > 0 && (
            <div className={styles.summaryItem}>
              <span className={`${styles.summaryNum} ${styles.overdueNum}`}>{overdueCount}</span>
              <span className={styles.summaryLabel}>Overdue</span>
            </div>
          )}
          <div className={styles.summaryItem}>
            <span className={`${styles.summaryNum} ${styles.doneNum}`}>{forms.length - pendingCount}</span>
            <span className={styles.summaryLabel}>Acknowledged</span>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className={styles.tabs}>
        {(['all', 'pending', 'done'] as const).map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${filter === tab ? styles.tabActive : ''}`}
            onClick={() => setFilter(tab)}
          >
            {tab === 'all' ? 'All' : tab === 'pending' ? 'Pending' : 'Acknowledged'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <CheckCircle2 size={48} color="#10b981" />
          <p>{filter === 'pending' ? 'No pending forms — all caught up!' : 'No forms to show'}</p>
        </div>
      ) : (
        <div className={styles.formsList}>
          {filtered.map((form) => {
            const overdue = !form.acknowledgedAt && isOverdue(form.dueDate)
            return (
              <div
                key={form.recipientId}
                className={`${styles.formCard} ${form.acknowledgedAt ? styles.formCardDone : ''} ${overdue ? styles.formCardOverdue : ''}`}
              >
                <div className={styles.formCardLeft}>
                  <div
                    className={styles.typeBadge}
                    style={{ background: `${TYPE_COLORS[form.type] ?? '#6b7280'}15`, color: TYPE_COLORS[form.type] ?? '#6b7280' }}
                  >
                    {TYPE_LABELS[form.type] ?? form.type}
                  </div>
                  <h3 className={styles.formTitle}>{form.title}</h3>
                  <div className={styles.formMeta}>
                    <span className={styles.studentChip}>{form.studentName}</span>
                    {form.dueDate && (
                      <span className={`${styles.dueChip} ${overdue ? styles.dueChipOverdue : ''}`}>
                        {overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                        {overdue ? 'Overdue: ' : 'Due: '}{formatDate(form.dueDate)}
                      </span>
                    )}
                  </div>
                  <p className={styles.formDesc}>{form.description.slice(0, 120)}{form.description.length > 120 ? '…' : ''}</p>
                </div>

                <div className={styles.formCardRight}>
                  {form.acknowledgedAt ? (
                    <div className={styles.acknowledgedBadge}>
                      <CheckCircle2 size={16} />
                      <span>Acknowledged</span>
                      <span className={styles.ackDate}>{formatDate(form.acknowledgedAt)}</span>
                    </div>
                  ) : (
                    <button
                      className={styles.acknowledgeBtn}
                      onClick={() => setAcknowledging(form)}
                    >
                      <FileCheck size={15} /> Acknowledge
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {acknowledging && (
        <AcknowledgeModal
          form={acknowledging}
          onClose={() => setAcknowledging(null)}
          onConfirm={handleAcknowledge}
        />
      )}
    </div>
  )
}
