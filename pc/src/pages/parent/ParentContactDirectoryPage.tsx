import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users, Mail, MessageSquare, Phone, BookOpen,
  ShieldCheck, User, GraduationCap, ChevronRight,
} from 'lucide-react'
import api from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import styles from './ParentContactDirectoryPage.module.css'

interface StaffEntry {
  userId: string
  displayName: string
  role: string
  email: string | null
  avatar: string | null
  designation: string | null
  department: string | null
}

interface DirectoryData {
  principals: StaffEntry[]
  admins: StaffEntry[]
  counselors: StaffEntry[]
  teachers: StaffEntry[]
}

interface ClassTeacherEntry {
  studentId: string
  studentName: string
  gradeLevel: string | null
  className: string | null
  classTeacher: {
    userId: string
    teacherId: string
    displayName: string
    email: string | null
    avatar: string | null
    designation: string | null
    department: string | null
  } | null
}

function RoleIcon({ role }: { role: string }) {
  switch (role) {
    case 'principal': return <ShieldCheck size={18} />
    case 'counselor': return <User size={18} />
    case 'teacher': case 'hod': return <GraduationCap size={18} />
    default: return <Users size={18} />
  }
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    principal: 'Principal',
    admin: 'Admin Officer',
    manager: 'Manager',
    admissions: 'Admissions Officer',
    counselor: 'Counselor',
    teacher: 'Teacher',
    hod: 'Head of Department',
  }
  return map[role] ?? role
}

function StaffCard({ staff, onMessage }: { staff: StaffEntry; onMessage: (userId: string) => void }) {
  return (
    <div className={styles.staffCard}>
      <div className={styles.staffAvatar}>
        {staff.avatar ? (
          <img src={staff.avatar} alt={staff.displayName} />
        ) : (
          <span>{staff.displayName.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className={styles.staffInfo}>
        <div className={styles.staffName}>{staff.displayName}</div>
        <div className={styles.staffRole}>
          <RoleIcon role={staff.role} />
          <span>{roleBadge(staff.role)}</span>
        </div>
        {staff.designation && <div className={styles.staffDesignation}>{staff.designation}</div>}
        {staff.department && <div className={styles.staffDept}>{staff.department}</div>}
        {staff.email && (
          <a className={styles.staffEmail} href={`mailto:${staff.email}`}>
            <Mail size={13} /> {staff.email}
          </a>
        )}
      </div>
      <button
        className={styles.messageBtn}
        onClick={() => onMessage(staff.userId)}
        title="Send message"
      >
        <MessageSquare size={16} /> Message
      </button>
    </div>
  )
}

function DirectorySection({ title, icon: Icon, entries, onMessage }: {
  title: string
  icon: React.ElementType
  entries: StaffEntry[]
  onMessage: (userId: string) => void
}) {
  if (entries.length === 0) return null
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <Icon size={18} /> {title}
      </h3>
      <div className={styles.staffGrid}>
        {entries.map((s) => (
          <StaffCard key={s.userId} staff={s} onMessage={onMessage} />
        ))}
      </div>
    </section>
  )
}

export default function ParentContactDirectoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [directory, setDirectory] = useState<DirectoryData | null>(null)
  const [classTeachers, setClassTeachers] = useState<ClassTeacherEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/communications/contact-directory'),
      api.get('/communications/class-teachers'),
    ])
      .then(([dirRes, ctRes]) => {
        setDirectory(dirRes.data.data)
        setClassTeachers(ctRes.data.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleMessage = (teacherUserId: string) => {
    navigate(`/parent/communications?tab=messages&openThread=${teacherUserId}`)
  }

  if (loading) {
    return <div className={styles.loading}><div className={styles.spinner} /></div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIcon}><BookOpen size={28} /></div>
        <div>
          <h1 className={styles.title}>{t('parent.contactDirectory', { defaultValue: 'School Contact Directory' })}</h1>
          <p className={styles.subtitle}>Find and message staff at your child&apos;s school</p>
        </div>
      </header>

      {/* CM-02 — Class Teacher Highlight */}
      {classTeachers.length > 0 && (
        <section className={styles.classTeacherSection}>
          <h3 className={styles.sectionTitle}>
            <GraduationCap size={18} /> Your Child&apos;s Class Teacher
          </h3>
          <div className={styles.classTeacherCards}>
            {classTeachers.map((ct) => (
              <div key={ct.studentId} className={styles.classTeacherCard}>
                <div className={styles.childBadge}>
                  {ct.studentName}
                  {ct.gradeLevel && ct.className && (
                    <span className={styles.classBadge}>{ct.gradeLevel} — {ct.className}</span>
                  )}
                </div>

                {ct.classTeacher ? (
                  <div className={styles.ctTeacherRow}>
                    <div className={styles.staffAvatar}>
                      {ct.classTeacher.avatar ? (
                        <img src={ct.classTeacher.avatar} alt={ct.classTeacher.displayName} />
                      ) : (
                        <span>{ct.classTeacher.displayName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className={styles.ctTeacherInfo}>
                      <div className={styles.staffName}>{ct.classTeacher.displayName}</div>
                      {ct.classTeacher.designation && (
                        <div className={styles.staffDesignation}>{ct.classTeacher.designation}</div>
                      )}
                      {ct.classTeacher.email && (
                        <a className={styles.staffEmail} href={`mailto:${ct.classTeacher.email}`}>
                          <Mail size={13} /> {ct.classTeacher.email}
                        </a>
                      )}
                    </div>
                    <button
                      className={`${styles.messageBtn} ${styles.messageBtnPrimary}`}
                      onClick={() => handleMessage(ct.classTeacher!.userId)}
                    >
                      <MessageSquare size={16} /> Message <ChevronRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className={styles.noTeacher}>No class teacher assigned yet</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CM-01 — Full Contact Directory */}
      {directory && (
        <>
          <DirectorySection
            title="School Leadership"
            icon={ShieldCheck}
            entries={directory.principals}
            onMessage={handleMessage}
          />
          <DirectorySection
            title="Administrative Staff"
            icon={Users}
            entries={directory.admins}
            onMessage={handleMessage}
          />
          <DirectorySection
            title="Counselors"
            icon={User}
            entries={directory.counselors}
            onMessage={handleMessage}
          />
          <DirectorySection
            title="Teachers"
            icon={GraduationCap}
            entries={directory.teachers}
            onMessage={handleMessage}
          />
        </>
      )}

      {directory &&
        directory.principals.length === 0 &&
        directory.admins.length === 0 &&
        directory.counselors.length === 0 &&
        directory.teachers.length === 0 && (
          <div className={styles.empty}>
            <Phone size={40} />
            <p>No staff contacts available yet</p>
          </div>
        )}
    </div>
  )
}
