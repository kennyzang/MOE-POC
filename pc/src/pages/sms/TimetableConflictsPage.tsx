import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle, User, DoorOpen, BookOpen,
  RefreshCw, CheckCircle2, UserCheck, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import api from '@/lib/api'
import styles from './TimetableConflictsPage.module.css'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

interface ConflictSlot {
  id: string
  courseName: string
  teacherName: string
  gradeLevel: string
  className: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  room: string | null
}

interface Conflict {
  type: 'teacher' | 'room' | 'class'
  message: string
  slotA: ConflictSlot
  slotB: ConflictSlot
}

interface ConflictSummary {
  totalSlots: number
  totalConflicts: number
  teacherConflicts: number
  roomConflicts: number
  classConflicts: number
}

interface ScanResult {
  semester: string
  summary: ConflictSummary
  conflicts: Conflict[]
}

interface OnLeaveTeacher {
  leaveId: string
  teacherId: string
  teacherName: string
  leaveType: string
  startDate: string
  endDate: string
  daysRemaining: number
  affectedSlots: Array<{
    slotId: string
    courseName: string
    dayOfWeek: number
    startTime: string
    endTime: string
    room: string | null
    gradeLevel: string
    className: string | null
  }>
}

interface SubSuggestion {
  teacherId: string
  userId: string
  displayName: string
  email: string | null
  designation: string | null
  department: string | null
  slotsToday: number
  todaySlots: Array<{ courseName: string; startTime: string; endTime: string }>
}

type ConflictTypeFilter = 'all' | 'teacher' | 'room' | 'class'

const CONFLICT_META = {
  teacher: { label: 'Teacher Double-Booked', icon: User, color: '#ef4444', bg: '#fee2e2' },
  room: { label: 'Room Double-Booked', icon: DoorOpen, color: '#f59e0b', bg: '#fef3c7' },
  class: { label: 'Class Double-Scheduled', icon: BookOpen, color: '#8b5cf6', bg: '#f5f3ff' },
}

function SubstituteModal({
  slot,
  onClose,
  onAssigned,
}: {
  slot: { slotId: string; teacherName: string; courseName: string; dayOfWeek: number; startTime: string; endTime: string }
  onClose: () => void
  onAssigned: () => void
}) {
  const [suggestions, setSuggestions] = useState<SubSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)

  useEffect(() => {
    api
      .get('/conflicts/substitute-suggestions', {
        params: {
          teacherId: slot.slotId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      })
      .then((r) => setSuggestions(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [slot.slotId, slot.dayOfWeek, slot.startTime, slot.endTime])

  async function assignSub(substituteTeacherId: string) {
    setAssigning(substituteTeacherId)
    try {
      await api.patch('/conflicts/assign-substitute', {
        slotId: slot.slotId,
        substituteTeacherId,
      })
      onAssigned()
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Assign Substitute</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.subContext}>
            <div className={styles.subContextLabel}>Covering for:</div>
            <div className={styles.subContextValue}><strong>{slot.teacherName}</strong> — {slot.courseName}</div>
            <div className={styles.subContextTime}>{DAYS[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}</div>
          </div>

          {loading ? (
            <div className={styles.subLoading}><div className={styles.spinner} /></div>
          ) : suggestions.length === 0 ? (
            <div className={styles.noSub}>No available teachers found for this time slot.</div>
          ) : (
            <div className={styles.suggestionList}>
              <p className={styles.suggestionHint}>Available teachers — fewer periods today listed first:</p>
              {suggestions.map((s) => (
                <div key={s.teacherId} className={styles.suggestionCard}>
                  <div className={styles.subAvatar}>
                    {s.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.subInfo}>
                    <div className={styles.subName}>{s.displayName}</div>
                    {s.designation && <div className={styles.subDesig}>{s.designation}</div>}
                    <div className={styles.subSlots}>
                      {s.slotsToday === 0
                        ? 'Free all day'
                        : `${s.slotsToday} period(s) today: ${s.todaySlots.map((sl) => sl.startTime).join(', ')}`}
                    </div>
                  </div>
                  <button
                    className={styles.assignBtn}
                    disabled={assigning === s.teacherId}
                    onClick={() => assignSub(s.teacherId)}
                  >
                    {assigning === s.teacherId ? <RefreshCw size={14} className={styles.spin} /> : <UserCheck size={14} />}
                    Assign
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function TimetableConflictsPage() {
  const { t } = useTranslation()
  const [semester, setSemester] = useState('2026-S1')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [onLeave, setOnLeave] = useState<OnLeaveTeacher[]>([])
  const [scanning, setScanning] = useState(false)
  const [typeFilter, setTypeFilter] = useState<ConflictTypeFilter>('all')
  const [subModal, setSubModal] = useState<{
    slotId: string; teacherName: string; courseName: string;
    dayOfWeek: number; startTime: string; endTime: string
  } | null>(null)
  const [expandedLeave, setExpandedLeave] = useState<string | null>(null)

  useEffect(() => {
    fetchOnLeave()
  }, [semester])

  async function fetchOnLeave() {
    try {
      const res = await api.get('/conflicts/teacher-on-leave', { params: { semester } })
      setOnLeave(res.data.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function runScan() {
    setScanning(true)
    try {
      const res = await api.get('/conflicts/scan', { params: { semester } })
      setScanResult(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setScanning(false)
    }
  }

  const filteredConflicts = scanResult?.conflicts.filter((c) =>
    typeFilter === 'all' ? true : c.type === typeFilter
  ) ?? []

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><AlertTriangle size={26} /></div>
          <div>
            <h1 className={styles.title}>{t('admin.timetableConflicts', { defaultValue: 'Timetable Conflict Detection' })}</h1>
            <p className={styles.subtitle}>Detect teacher, room and class scheduling conflicts; assign substitute teachers</p>
          </div>
        </div>
        <div className={styles.headerControls}>
          <select
            className={styles.semesterSelect}
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          >
            {['2026-S1', '2026-S2', '2025-S2'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            className={styles.scanBtn}
            disabled={scanning}
            onClick={runScan}
          >
            {scanning ? <><RefreshCw size={16} className={styles.spin} /> Scanning…</> : <><AlertTriangle size={16} /> Scan for Conflicts</>}
          </button>
        </div>
      </header>

      {/* Scan results */}
      {scanResult && (
        <>
          {/* Summary bar */}
          <div className={styles.summaryBar}>
            <div className={`${styles.summaryCard} ${scanResult.summary.totalConflicts === 0 ? styles.allClear : ''}`}>
              {scanResult.summary.totalConflicts === 0 ? (
                <><CheckCircle2 size={20} color="#10b981" /><span className={styles.allClearText}>No conflicts detected in {scanResult.summary.totalSlots} slots</span></>
              ) : (
                <><AlertTriangle size={20} color="#ef4444" /><span><strong>{scanResult.summary.totalConflicts}</strong> conflict(s) found in {scanResult.summary.totalSlots} slots</span></>
              )}
            </div>
            {scanResult.summary.totalConflicts > 0 && (
              <div className={styles.conflictCounts}>
                <button
                  className={`${styles.countChip} ${typeFilter === 'all' ? styles.countChipActive : ''}`}
                  style={{ background: typeFilter === 'all' ? '#f1f5f9' : undefined }}
                  onClick={() => setTypeFilter('all')}
                >
                  All ({scanResult.summary.totalConflicts})
                </button>
                <button
                  className={`${styles.countChip} ${typeFilter === 'teacher' ? styles.countChipActive : ''}`}
                  style={{ color: '#ef4444', background: typeFilter === 'teacher' ? '#fee2e2' : undefined }}
                  onClick={() => setTypeFilter('teacher')}
                >
                  <User size={12} /> Teacher ({scanResult.summary.teacherConflicts})
                </button>
                <button
                  className={`${styles.countChip} ${typeFilter === 'room' ? styles.countChipActive : ''}`}
                  style={{ color: '#f59e0b', background: typeFilter === 'room' ? '#fef3c7' : undefined }}
                  onClick={() => setTypeFilter('room')}
                >
                  <DoorOpen size={12} /> Room ({scanResult.summary.roomConflicts})
                </button>
                <button
                  className={`${styles.countChip} ${typeFilter === 'class' ? styles.countChipActive : ''}`}
                  style={{ color: '#8b5cf6', background: typeFilter === 'class' ? '#f5f3ff' : undefined }}
                  onClick={() => setTypeFilter('class')}
                >
                  <BookOpen size={12} /> Class ({scanResult.summary.classConflicts})
                </button>
              </div>
            )}
          </div>

          {/* Conflict list */}
          {filteredConflicts.length > 0 && (
            <div className={styles.conflictList}>
              {filteredConflicts.map((c, idx) => {
                const meta = CONFLICT_META[c.type]
                const Icon = meta.icon
                return (
                  <div key={idx} className={styles.conflictCard} style={{ borderLeftColor: meta.color }}>
                    <div className={styles.conflictHeader}>
                      <div className={styles.conflictTypeBadge} style={{ background: meta.bg, color: meta.color }}>
                        <Icon size={14} /> {meta.label}
                      </div>
                      <span className={styles.conflictDay}>{DAYS[c.slotA.dayOfWeek]} {c.slotA.startTime}–{c.slotA.endTime}</span>
                    </div>
                    <p className={styles.conflictMessage}>{c.message}</p>
                    <div className={styles.slotPair}>
                      {[c.slotA, c.slotB].map((slot, si) => (
                        <div key={si} className={styles.slotBox}>
                          <div className={styles.slotCourse}>{slot.courseName}</div>
                          <div className={styles.slotMeta}>
                            <span>{slot.teacherName}</span>
                            {slot.room && <span>· {slot.room}</span>}
                            <span>· {slot.gradeLevel} {slot.className}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {!scanResult && (
        <div className={styles.preScan}>
          <AlertTriangle size={40} color="#94a3b8" />
          <p>Click "Scan for Conflicts" to check all timetable slots for scheduling issues.</p>
        </div>
      )}

      {/* TT-04: Teachers on Leave with affected slots */}
      <section className={styles.onLeaveSection}>
        <h2 className={styles.sectionTitle}>
          <User size={18} /> Teachers on Approved Leave — Substitute Coverage (TT-04)
        </h2>

        {onLeave.length === 0 ? (
          <div className={styles.emptyLeave}>
            <CheckCircle2 size={32} color="#10b981" />
            <p>No teachers on approved leave in the next 14 days</p>
          </div>
        ) : (
          <div className={styles.leaveList}>
            {onLeave.map((teacher) => (
              <div key={teacher.leaveId} className={styles.leaveCard}>
                <div
                  className={styles.leaveCardHeader}
                  onClick={() => setExpandedLeave(expandedLeave === teacher.leaveId ? null : teacher.leaveId)}
                >
                  <div className={styles.leaveTeacherInfo}>
                    <div className={styles.leaveAvatar}>{teacher.teacherName.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className={styles.leaveTeacherName}>{teacher.teacherName}</div>
                      <div className={styles.leaveMeta}>
                        <span className={styles.leaveTypeBadge}>{teacher.leaveType.replace('_', ' ')}</span>
                        <span className={styles.leaveDates}>
                          {new Date(teacher.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
                          {new Date(teacher.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className={styles.daysLeft}>{teacher.daysRemaining}d remaining</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.leaveRight}>
                    <span className={styles.affectedCount}>{teacher.affectedSlots.length} affected slot(s)</span>
                    {expandedLeave === teacher.leaveId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expandedLeave === teacher.leaveId && (
                  <div className={styles.affectedSlots}>
                    {teacher.affectedSlots.length === 0 ? (
                      <p className={styles.noSlots}>No timetable slots found for this semester.</p>
                    ) : (
                      teacher.affectedSlots.map((slot) => (
                        <div key={slot.slotId} className={styles.affectedSlot}>
                          <div className={styles.slotInfo}>
                            <span className={styles.slotDay}>{DAYS[slot.dayOfWeek]}</span>
                            <span className={styles.slotTime}>{slot.startTime}–{slot.endTime}</span>
                            <span className={styles.slotCourse}>{slot.courseName}</span>
                            <span className={styles.slotClass}>{slot.gradeLevel} {slot.className}</span>
                            {slot.room && <span className={styles.slotRoom}>{slot.room}</span>}
                          </div>
                          <button
                            className={styles.subBtn}
                            onClick={() =>
                              setSubModal({
                                slotId: slot.slotId,
                                teacherName: teacher.teacherName,
                                courseName: slot.courseName,
                                dayOfWeek: slot.dayOfWeek,
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                              })
                            }
                          >
                            <UserCheck size={14} /> Find Substitute
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {subModal && (
        <SubstituteModal
          slot={subModal}
          onClose={() => setSubModal(null)}
          onAssigned={() => {
            setSubModal(null)
            fetchOnLeave()
            if (scanResult) runScan()
          }}
        />
      )}
    </div>
  )
}
