import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PullToRefresh, Skeleton, Collapse } from 'antd-mobile'
import { Users, Mail, BookOpen, ShieldCheck, User, GraduationCap, ChevronRight } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import api from '@/lib/api'

interface StaffEntry {
  userId: string
  displayName: string
  role: string
  email: string | null
  avatar: string | null
  designation: string | null
  department: string | null
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
    case 'PRINCIPAL': return <ShieldCheck size={16} color="#e74c3c" />
    case 'ADMIN': return <User size={16} color="#3498db" />
    case 'COUNSELOR': return <GraduationCap size={16} color="#9b59b6" />
    default: return <BookOpen size={16} color="#27ae60" />
  }
}

export default function ParentContactDirectoryPage() {
  const { t } = useTranslation()

  const { data: directory, isLoading, refetch } = useQuery({
    queryKey: ['parent-contact-directory'],
    queryFn: async () => {
      const { data } = await api.get('/parent/contact-directory')
      return data.data as {
        principals: StaffEntry[]
        admins: StaffEntry[]
        counselors: StaffEntry[]
        teachers: StaffEntry[]
        classTeachers: ClassTeacherEntry[]
      }
    },
  })

  const sections = [
    ...(directory?.principals?.length ? [{ key: 'principals', title: t('parent.principals'), items: directory.principals }] : []),
    ...(directory?.admins?.length ? [{ key: 'admins', title: t('parent.administrators'), items: directory.admins }] : []),
    ...(directory?.counselors?.length ? [{ key: 'counselors', title: t('parent.counselors'), items: directory.counselors }] : []),
    ...(directory?.teachers?.length ? [{ key: 'teachers', title: t('parent.teachers'), items: directory.teachers }] : []),
    ...(directory?.classTeachers?.length ? [{
      key: 'classTeachers',
      title: t('parent.classTeacher'),
      items: directory.classTeachers.map(ct => ({
        ...ct.classTeacher!,
        displayName: ct.studentName + (ct.className ? ` (${ct.className})` : ''),
        _isClassTeacher: true,
      })),
    }] : []),
  ]

  return (
    <AppLayout title={t('parent.contactDirectory')} showLogout>
      <PullToRefresh onRefresh={async () => { await refetch() }}>
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                background: 'white', borderRadius: 12, padding: '14px',
                marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <Skeleton animated style={{ height: 14, width: '40%', marginBottom: 8 }} />
                <Skeleton animated style={{ height: 36, width: '100%' }} />
              </div>
            ))}
          </>
        ) : !sections.length ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#86909c' }}>
            <Users size={40} color="#c9cdd4" style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14 }}>{t('parent.noContacts')}</div>
          </div>
        ) : (
          <Collapse defaultActiveKey={['principals']}>
            {sections.map(section => (
              <Collapse.Panel
                key={section.key}
                title={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <Users size={14} color="#165DFF" />
                    {section.title} ({section.items.length})
                  </span>
                }
              >
                {section.items.map((item: any) => (
                  <div key={item.userId || item.teacherId || item.studentId} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid #f5f5f5',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 20,
                        background: '#E6F4FF', color: '#165DFF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, flexShrink: 0,
                      }}>
                        {!(item as any)._isClassTeacher ? RoleIcon({ role: item.role }) : <BookOpen size={15} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: '#1d1d1f' }}>
                          {item.displayName}
                        </div>
                        {(item.designation || item.department) && (
                          <div style={{ fontSize: 10, color: '#86909c' }}>
                            [item.designation || item.department]
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {item.email && (
                        <a href={`mailto:${item.email}`} style={{
                          width: 32, height: 32, borderRadius: 16,
                          background: '#E6F4FF', color: '#165DFF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          textDecoration: 'none',
                        }}
                        aria-label="Email"
                        >
                          <Mail size={13} />
                        </a>
                      )}
                      <ChevronRight size={14} color="#c9cdd4" />
                    </div>
                  </div>
                ))}
              </Collapse.Panel>
            ))}
          </Collapse>
        )}

        <div style={{ height: 24 }} />
      </PullToRefresh>
    </AppLayout>
  )
}
