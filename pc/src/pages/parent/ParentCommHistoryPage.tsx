import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  History, MessageSquare, Megaphone, FileCheck, Calendar,
  Search, Filter, User,
} from 'lucide-react'
import api from '@/lib/api'
import styles from './ParentCommHistoryPage.module.css'

interface CommEvent {
  id: string
  eventType: 'message' | 'announcement' | 'consent' | 'meeting'
  title: string
  summary: string
  timestamp: string
  studentId: string | null
  studentName?: string
  meta?: Record<string, unknown>
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  message: { label: 'Message', icon: MessageSquare, color: '#3b82f6', bg: '#eff6ff' },
  announcement: { label: 'Announcement', icon: Megaphone, color: '#8b5cf6', bg: '#f5f3ff' },
  consent: { label: 'Consent Form', icon: FileCheck, color: '#10b981', bg: '#f0fdf4' },
  meeting: { label: 'Meeting', icon: Calendar, color: '#f59e0b', bg: '#fffbeb' },
}

function formatRelative(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'Just now'
}

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ParentCommHistoryPage() {
  const { t } = useTranslation()
  const [events, setEvents] = useState<CommEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchHistory()
  }, [typeFilter, debouncedSearch])

  async function fetchHistory() {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (typeFilter !== 'all') params['type'] = typeFilter
      if (debouncedSearch) params['search'] = debouncedSearch
      const res = await api.get('/communications/history', { params })
      setEvents(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Group events by date
  const grouped = events.reduce<Record<string, CommEvent[]>>((acc, e) => {
    const dateKey = new Date(e.timestamp).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(e)
    return acc
  }, {})

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIcon}><History size={28} /></div>
        <div>
          <h1 className={styles.title}>{t('parent.commHistory', { defaultValue: 'Communication History' })}</h1>
          <p className={styles.subtitle}>All school-parent communications for your children</p>
        </div>
      </header>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search messages, announcements, forms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.typeFilters}>
          <Filter size={14} />
          {['all', 'message', 'announcement', 'consent', 'meeting'].map((t) => (
            <button
              key={t}
              className={`${styles.typeBtn} ${typeFilter === t ? styles.typeBtnActive : ''}`}
              style={
                typeFilter === t && t !== 'all'
                  ? { background: TYPE_CONFIG[t]?.bg, color: TYPE_CONFIG[t]?.color, borderColor: TYPE_CONFIG[t]?.color }
                  : {}
              }
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? 'All' : TYPE_CONFIG[t]?.label ?? t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingArea}>
          <div className={styles.spinner} />
        </div>
      ) : events.length === 0 ? (
        <div className={styles.empty}>
          <History size={48} />
          <p>No communications found</p>
          {(search || typeFilter !== 'all') && (
            <button className={styles.clearBtn} onClick={() => { setSearch(''); setTypeFilter('all') }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={styles.timeline}>
          {Object.entries(grouped).map(([dateKey, dayEvents]) => (
            <div key={dateKey} className={styles.dayGroup}>
              <div className={styles.dayHeader}>{dateKey}</div>
              <div className={styles.dayEvents}>
                {dayEvents.map((event) => {
                  const config = TYPE_CONFIG[event.eventType] ?? TYPE_CONFIG['message']
                  const Icon = config.icon
                  return (
                    <div key={event.id} className={styles.eventCard}>
                      <div
                        className={styles.eventIcon}
                        style={{ background: config.bg, color: config.color }}
                      >
                        <Icon size={18} />
                      </div>
                      <div className={styles.eventBody}>
                        <div className={styles.eventHeader}>
                          <div className={styles.eventTitle}>{event.title}</div>
                          <div className={styles.eventTime} title={formatDateTime(event.timestamp)}>
                            {formatRelative(event.timestamp)}
                          </div>
                        </div>
                        <p className={styles.eventSummary}>{event.summary}</p>
                        <div className={styles.eventFooter}>
                          <span
                            className={styles.eventTypeBadge}
                            style={{ background: config.bg, color: config.color }}
                          >
                            {config.label}
                          </span>
                          {event.studentName && (
                            <span className={styles.studentChip}>
                              <User size={11} /> {event.studentName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
