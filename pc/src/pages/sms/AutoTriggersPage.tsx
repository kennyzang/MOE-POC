import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell, Play, RefreshCw, Clock, CheckCircle2, AlertTriangle,
  XCircle, Users, TrendingDown, Receipt, GraduationCap,
  FileText, Package, Wrench, Zap,
} from 'lucide-react'
import api from '@/lib/api'
import styles from './AutoTriggersPage.module.css'

interface TriggerStatus {
  lastRun: string | null
  lastSent: number
  lastAffected: number
  lastStatus: string
  lastSummary: string
}

interface TriggerLog {
  id: string
  triggerType: string
  ranAt: string
  notificationsSent: number
  affectedCount: number
  status: string
  summary: string | null
}

type TriggerKey =
  | 'STUDENT_ABSENCE'
  | 'GRADE_DROP'
  | 'FEE_OVERDUE'
  | 'CPD_DEADLINE'
  | 'EXAM_REGISTRATION'
  | 'LOW_STOCK'
  | 'MAINTENANCE_DUE'

const TRIGGER_META: Record<TriggerKey, { label: string; description: string; icon: React.ElementType; color: string; bg: string; requirement: string }> = {
  STUDENT_ABSENCE: {
    label: 'Student Absenteeism',
    description: 'Alerts class teacher and parents when a student is absent 3+ consecutive days without excuse.',
    icon: Users,
    color: '#ef4444',
    bg: '#fee2e2',
    requirement: 'NF-01',
  },
  GRADE_DROP: {
    label: 'Grade Drop',
    description: 'Alerts class teacher and parents when a student\'s grades drop ≥20% versus the previous period.',
    icon: TrendingDown,
    color: '#f59e0b',
    bg: '#fef3c7',
    requirement: 'NF-02',
  },
  FEE_OVERDUE: {
    label: 'Fee Overdue',
    description: 'Sends escalating reminders to parents at 30, 60, and 90 days overdue. Admin flagged at 90 days.',
    icon: Receipt,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    requirement: 'NF-03',
  },
  CPD_DEADLINE: {
    label: 'CPD Deadline Reminder',
    description: 'Reminds enrolled educators when a CPD workshop starts within 3 days.',
    icon: GraduationCap,
    color: '#3b82f6',
    bg: '#eff6ff',
    requirement: 'NF-04',
  },
  EXAM_REGISTRATION: {
    label: 'Exam Registration Reminder',
    description: 'Alerts admin when students are unregistered for exams within 7 days.',
    icon: FileText,
    color: '#10b981',
    bg: '#f0fdf4',
    requirement: 'NF-05',
  },
  LOW_STOCK: {
    label: 'Low Stock Alert',
    description: 'Alerts admin when any stock item falls at or below its minimum quantity threshold.',
    icon: Package,
    color: '#f97316',
    bg: '#fff7ed',
    requirement: 'NF-06',
  },
  MAINTENANCE_DUE: {
    label: 'Maintenance Due',
    description: 'Alerts admin about assets that haven\'t had maintenance in 6+ months or never.',
    icon: Wrench,
    color: '#64748b',
    bg: '#f1f5f9',
    requirement: 'NF-07',
  },
}

function relativeTime(ts: string | null): string {
  if (!ts) return 'Never'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'Just now'
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') return <span className={`${styles.statusBadge} ${styles.success}`}><CheckCircle2 size={12} /> success</span>
  if (status === 'error') return <span className={`${styles.statusBadge} ${styles.error}`}><XCircle size={12} /> error</span>
  if (status === 'partial') return <span className={`${styles.statusBadge} ${styles.partial}`}><AlertTriangle size={12} /> partial</span>
  return <span className={`${styles.statusBadge} ${styles.never}`}><Clock size={12} /> never run</span>
}

export default function AutoTriggersPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Record<TriggerKey, TriggerStatus> | null>(null)
  const [logs, setLogs] = useState<TriggerLog[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<TriggerKey | 'ALL' | null>(null)
  const [lastRunResult, setLastRunResult] = useState<{ type: string; summary: string; sent: number } | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    try {
      const [statusRes, logsRes] = await Promise.all([
        api.get('/triggers/status'),
        api.get('/triggers/logs'),
      ])
      setStatus(statusRes.data.data)
      setLogs(logsRes.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function runTrigger(type: TriggerKey) {
    setRunning(type)
    try {
      const res = await api.post(`/triggers/run/${type}`)
      const r = res.data.data
      setLastRunResult({ type, summary: r.summary, sent: r.notificationsSent })
      await fetchAll()
    } catch {
      setLastRunResult({ type, summary: 'Trigger failed — check server logs', sent: 0 })
    } finally {
      setRunning(null)
    }
  }

  async function runAll() {
    setRunning('ALL')
    try {
      const res = await api.post('/triggers/run-all')
      setLastRunResult({ type: 'ALL', summary: `All triggers ran. ${res.data.data.totalNotificationsSent} total notifications sent.`, sent: res.data.data.totalNotificationsSent })
      await fetchAll()
    } catch {
      setLastRunResult({ type: 'ALL', summary: 'Run-all failed — check server logs', sent: 0 })
    } finally {
      setRunning(null)
    }
  }

  if (loading) {
    return <div className={styles.loading}><div className={styles.spinner} /></div>
  }

  const triggerKeys = Object.keys(TRIGGER_META) as TriggerKey[]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Bell size={26} /></div>
          <div>
            <h1 className={styles.title}>{t('admin.autoTriggers', { defaultValue: 'Notification Auto-Triggers' })}</h1>
            <p className={styles.subtitle}>Run condition checks and send automated alerts to relevant users</p>
          </div>
        </div>
        <button
          className={styles.runAllBtn}
          disabled={running !== null}
          onClick={runAll}
        >
          {running === 'ALL' ? (
            <><RefreshCw size={16} className={styles.spin} /> Running…</>
          ) : (
            <><Zap size={16} /> Run All Triggers</>
          )}
        </button>
      </header>

      {/* Last run result banner */}
      {lastRunResult && (
        <div className={`${styles.resultBanner} ${lastRunResult.sent > 0 ? styles.resultGood : styles.resultNone}`}>
          <CheckCircle2 size={16} />
          <span>{lastRunResult.summary}</span>
          <button className={styles.dismissBtn} onClick={() => setLastRunResult(null)}>×</button>
        </div>
      )}

      {/* Trigger cards */}
      <div className={styles.triggerGrid}>
        {triggerKeys.map((key) => {
          const meta = TRIGGER_META[key]
          const st = status?.[key]
          const Icon = meta.icon
          const isRunning = running === key
          return (
            <div key={key} className={styles.triggerCard}>
              <div className={styles.triggerCardTop}>
                <div className={styles.triggerIcon} style={{ background: meta.bg, color: meta.color }}>
                  <Icon size={22} />
                </div>
                <div className={styles.reqBadge}>{meta.requirement}</div>
              </div>

              <h3 className={styles.triggerName}>{meta.label}</h3>
              <p className={styles.triggerDesc}>{meta.description}</p>

              <div className={styles.triggerStats}>
                <div className={styles.statItem}>
                  <span className={styles.statVal}>{st?.lastAffected ?? 0}</span>
                  <span className={styles.statLbl}>affected</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statVal}>{st?.lastSent ?? 0}</span>
                  <span className={styles.statLbl}>notified</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statVal}>{relativeTime(st?.lastRun ?? null)}</span>
                  <span className={styles.statLbl}>last run</span>
                </div>
              </div>

              {st && <StatusBadge status={st.lastStatus} />}
              {st?.lastSummary && st.lastStatus !== 'never' && (
                <p className={styles.lastSummary}>{st.lastSummary}</p>
              )}

              <button
                className={styles.runBtn}
                style={{ background: meta.color }}
                disabled={running !== null}
                onClick={() => runTrigger(key)}
              >
                {isRunning ? (
                  <><RefreshCw size={14} className={styles.spin} /> Running…</>
                ) : (
                  <><Play size={14} /> Run Now</>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Recent trigger logs */}
      {logs.length > 0 && (
        <section className={styles.logsSection}>
          <h2 className={styles.logsTitle}><Clock size={16} /> Recent Run History</h2>
          <div className={styles.logsTable}>
            <div className={styles.logsHeader}>
              <span>Trigger</span>
              <span>Run At</span>
              <span>Affected</span>
              <span>Sent</span>
              <span>Status</span>
            </div>
            {logs.map((log) => {
              const meta = TRIGGER_META[log.triggerType as TriggerKey]
              return (
                <div key={log.id} className={styles.logRow}>
                  <span className={styles.logType}>
                    {meta ? meta.label : log.triggerType}
                  </span>
                  <span className={styles.logTime}>
                    {new Date(log.ranAt).toLocaleString('en-GB', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span>{log.affectedCount}</span>
                  <span>{log.notificationsSent}</span>
                  <span><StatusBadge status={log.status} /></span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
