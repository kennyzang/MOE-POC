import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { sendMany } from '../services/notificationService'

const router = Router()

// ─── Helpers ─────────────────────────────────────────────────────

async function getChildStudentIds(userId: string): Promise<string[]> {
  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: { childLinks: { select: { studentId: true } } },
  })
  return parent?.childLinks.map((l) => l.studentId) ?? []
}

// ─── CM-01: Contact Directory ─────────────────────────────────────
// GET /communications/contact-directory
// Returns role-based school staff contacts visible to parent/all roles

router.get('/contact-directory', authenticate, requireRole('parent', 'teacher', 'hod', 'admin', 'manager', 'principal', 'counselor'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const role = req.user!.role

    // Determine schoolId context
    let schoolId: string | null = null
    if (role === 'parent') {
      const childIds = await getChildStudentIds(userId)
      if (childIds.length > 0) {
        const student = await prisma.student.findFirst({ where: { id: { in: childIds } }, select: { schoolId: true } })
        schoolId = student?.schoolId ?? null
      }
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } })
      schoolId = user?.schoolId ?? null
    }

    // Fetch staff by role groups
    const staffRoles = ['admin', 'principal', 'counselor', 'teacher', 'admissions', 'manager', 'hod']
    const whereClause = schoolId
      ? { role: { in: staffRoles }, schoolId, status: 'active' }
      : { role: { in: staffRoles }, status: 'active' }

    const staffUsers = await prisma.user.findMany({
      where: whereClause,
      select: { id: true, displayName: true, role: true, email: true, avatar: true, schoolId: true },
    })

    // Enrich teachers with designation
    const teacherUserIds = staffUsers.filter((u) => u.role === 'teacher' || u.role === 'hod').map((u) => u.id)
    const teachers = teacherUserIds.length
      ? await prisma.teacher.findMany({
          where: { userId: { in: teacherUserIds } },
          select: { userId: true, designation: true, department: true, staffType: true },
        })
      : []
    const teacherMap = new Map(teachers.map((t) => [t.userId, t]))

    const directory = staffUsers.map((u) => ({
      userId: u.id,
      displayName: u.displayName,
      role: u.role,
      email: u.email,
      avatar: u.avatar,
      designation: teacherMap.get(u.id)?.designation ?? null,
      department: teacherMap.get(u.id)?.department ?? null,
    }))

    // Group by role category
    const grouped = {
      principals: directory.filter((d) => d.role === 'principal'),
      admins: directory.filter((d) => ['admin', 'manager', 'admissions'].includes(d.role)),
      counselors: directory.filter((d) => d.role === 'counselor'),
      teachers: directory.filter((d) => ['teacher', 'hod'].includes(d.role)),
    }

    res.json({ success: true, data: grouped })
  } catch (error) {
    console.error('GET /communications/contact-directory error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── CM-02: Class Teacher Visibility ─────────────────────────────
// GET /communications/class-teachers
// Returns assigned class teacher for each of the parent's children

router.get('/class-teachers', authenticate, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const childIds = await getChildStudentIds(userId)
    if (childIds.length === 0) {
      res.json({ success: true, data: [] })
      return
    }

    const students = await prisma.student.findMany({
      where: { id: { in: childIds } },
      include: { user: { select: { displayName: true } } },
    })

    const result: Array<{
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
    }> = []

    for (const student of students) {
      let classTeacherInfo = null

      if (student.gradeLevel && student.className) {
        // Look up ClassRoster formTeacherId
        const roster = await prisma.classRoster.findFirst({
          where: {
            gradeLevel: student.gradeLevel,
            className: student.className,
            schoolId: student.schoolId ?? undefined,
          },
          orderBy: { academicYear: 'desc' },
        })

        if (roster?.formTeacherId) {
          const teacher = await prisma.teacher.findUnique({
            where: { id: roster.formTeacherId },
            include: { user: { select: { id: true, displayName: true, email: true, avatar: true } } },
          })

          if (teacher) {
            classTeacherInfo = {
              userId: teacher.user.id,
              teacherId: teacher.id,
              displayName: teacher.user.displayName,
              email: teacher.user.email,
              avatar: teacher.user.avatar,
              designation: teacher.designation,
              department: teacher.department,
            }
          }
        }
      }

      result.push({
        studentId: student.id,
        studentName: student.user.displayName,
        gradeLevel: student.gradeLevel,
        className: student.className,
        classTeacher: classTeacherInfo,
      })
    }

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('GET /communications/class-teachers error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── CM-03: Consent Forms (Admin) ─────────────────────────────────

// POST /communications/consent-forms — admin creates a consent form
router.post('/consent-forms', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      title, description, type, dueDate,
      targetGradeLevel, targetStudentIds,
    } = req.body as {
      title: string
      description: string
      type?: string
      dueDate?: string
      targetGradeLevel?: string
      targetStudentIds?: string[]
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { schoolId: true } })

    const form = await prisma.consentForm.create({
      data: {
        title,
        description,
        type: type ?? 'OTHER',
        schoolId: user?.schoolId ?? null,
        createdById: req.user!.userId,
        dueDate: dueDate ? new Date(dueDate) : null,
        targetGradeLevel: targetGradeLevel ?? null,
        targetStudentIds: targetStudentIds ? JSON.stringify(targetStudentIds) : null,
      },
    })

    res.status(201).json({ success: true, data: form })
  } catch (error) {
    console.error('POST /communications/consent-forms error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /communications/consent-forms/:id/publish — admin activates a form and sends to parents
router.patch('/consent-forms/:id/publish', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const form = await prisma.consentForm.findUnique({ where: { id } })
    if (!form) { res.status(404).json({ success: false, message: 'Form not found' }); return }
    if (form.status !== 'DRAFT') { res.status(400).json({ success: false, message: 'Form is not in DRAFT status' }); return }

    // Determine which students to target
    let studentIds: string[] = []
    if (form.targetStudentIds) {
      studentIds = JSON.parse(form.targetStudentIds) as string[]
    } else {
      // All enrolled students in school (optionally filtered by grade)
      const where: { enrollmentStatus: string; schoolId?: string; gradeLevel?: string } = {
        enrollmentStatus: 'enrolled',
      }
      if (form.schoolId) where.schoolId = form.schoolId
      if (form.targetGradeLevel) where.gradeLevel = form.targetGradeLevel

      const students = await prisma.student.findMany({ where, select: { id: true } })
      studentIds = students.map((s) => s.id)
    }

    // Get parent-student links
    const parentLinks = await prisma.parentStudent.findMany({
      where: { studentId: { in: studentIds } },
      select: { parentId: true, studentId: true },
    })

    // Resolve parentId → parent.userId
    const parentIds = [...new Set(parentLinks.map((l) => l.parentId))]
    const parents = await prisma.parent.findMany({
      where: { id: { in: parentIds } },
      select: { id: true, userId: true },
    })
    const parentUserMap = new Map(parents.map((p) => [p.id, p.userId]))

    // Create recipients (deduplicate per form+parent+student)
    const recipientData = parentLinks
      .map((l) => ({
        formId: id,
        parentUserId: parentUserMap.get(l.parentId) ?? '',
        studentId: l.studentId,
      }))
      .filter((r) => r.parentUserId !== '')

    // Upsert recipients
    for (const r of recipientData) {
      await prisma.consentFormRecipient.upsert({
        where: { formId_parentUserId_studentId: { formId: r.formId, parentUserId: r.parentUserId, studentId: r.studentId } },
        create: r,
        update: {},
      })
    }

    // Activate form
    const updated = await prisma.consentForm.update({
      where: { id },
      data: { status: 'ACTIVE' },
    })

    // Notify parents
    const parentUserIds = [...new Set(recipientData.map((r) => r.parentUserId))]
    if (parentUserIds.length > 0) {
      await sendMany(parentUserIds, {
        title: 'New Form Requires Your Acknowledgment',
        message: `"${form.title}" — please review and acknowledge in the parent portal.`,
        type: 'info',
        link: '/parent/consent-forms',
      })
    }

    res.json({ success: true, data: { ...updated, recipientCount: recipientData.length } })
  } catch (error) {
    console.error('PATCH /communications/consent-forms/:id/publish error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /communications/consent-forms/:id/close — admin closes a form
router.patch('/consent-forms/:id/close', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const updated = await prisma.consentForm.update({
      where: { id },
      data: { status: 'CLOSED' },
    })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /communications/consent-forms — list forms
// Admin: all forms for their school; Parent: only ACTIVE forms assigned to them
router.get('/consent-forms', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const role = req.user!.role

    if (role === 'parent') {
      const recipients = await prisma.consentFormRecipient.findMany({
        where: { parentUserId: userId },
        include: {
          form: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      // Get student names
      const studentIds = [...new Set(recipients.map((r) => r.studentId))]
      const students = await prisma.student.findMany({
        where: { id: { in: studentIds } },
        include: { user: { select: { displayName: true } } },
      })
      const studentMap = new Map(students.map((s) => [s.id, s.user.displayName]))

      const data = recipients.map((r) => ({
        recipientId: r.id,
        formId: r.form.id,
        title: r.form.title,
        description: r.form.description,
        type: r.form.type,
        status: r.form.status,
        dueDate: r.form.dueDate,
        acknowledgedAt: r.acknowledgedAt,
        acknowledgmentNote: r.acknowledgmentNote,
        studentId: r.studentId,
        studentName: studentMap.get(r.studentId) ?? '',
      }))

      res.json({ success: true, data })
    } else if (['admin', 'manager', 'principal'].includes(role)) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } })
      const forms = await prisma.consentForm.findMany({
        where: user?.schoolId ? { schoolId: user.schoolId } : {},
        include: {
          _count: { select: { recipients: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      const enriched = await Promise.all(
        forms.map(async (f) => {
          const acknowledgedCount = await prisma.consentFormRecipient.count({
            where: { formId: f.id, acknowledgedAt: { not: null } },
          })
          return { ...f, acknowledgedCount }
        })
      )

      res.json({ success: true, data: enriched })
    } else {
      res.status(403).json({ success: false, message: 'Access denied' })
    }
  } catch (error) {
    console.error('GET /communications/consent-forms error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /communications/consent-forms/:id — form details
router.get('/consent-forms/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const form = await prisma.consentForm.findUnique({
      where: { id },
      include: { recipients: true },
    })
    if (!form) { res.status(404).json({ success: false, message: 'Form not found' }); return }
    res.json({ success: true, data: form })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /communications/consent-forms/:id/acknowledge — parent acknowledges a form
router.post('/consent-forms/:id/acknowledge', authenticate, requireRole('parent'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { studentId, acknowledgmentNote } = req.body as { studentId: string; acknowledgmentNote?: string }
    const userId = req.user!.userId

    const recipient = await prisma.consentFormRecipient.findFirst({
      where: { formId: id, parentUserId: userId, studentId },
    })
    if (!recipient) { res.status(404).json({ success: false, message: 'You are not a recipient of this form' }); return }
    if (recipient.acknowledgedAt) { res.status(400).json({ success: false, message: 'Already acknowledged' }); return }

    const updated = await prisma.consentFormRecipient.update({
      where: { id: recipient.id },
      data: { acknowledgedAt: new Date(), acknowledgmentNote: acknowledgmentNote ?? null },
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('POST /communications/consent-forms/:id/acknowledge error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /communications/consent-forms/:id/report — admin acknowledgment status report
router.get('/consent-forms/:id/report', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const form = await prisma.consentForm.findUnique({ where: { id } })
    if (!form) { res.status(404).json({ success: false, message: 'Form not found' }); return }

    const recipients = await prisma.consentFormRecipient.findMany({
      where: { formId: id },
      orderBy: { createdAt: 'asc' },
    })

    // Enrich with parent + student info
    const parentUserIds = [...new Set(recipients.map((r) => r.parentUserId))]
    const studentIds = [...new Set(recipients.map((r) => r.studentId))]

    const [parentUsers, students] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: parentUserIds } }, select: { id: true, displayName: true, email: true } }),
      prisma.student.findMany({
        where: { id: { in: studentIds } },
        include: { user: { select: { displayName: true } } },
      }),
    ])

    const parentMap = new Map(parentUsers.map((u) => [u.id, u]))
    const studentMap = new Map(students.map((s) => [s.id, { name: s.user.displayName, gradeLevel: s.gradeLevel, className: s.className }]))

    const data = recipients.map((r) => ({
      recipientId: r.id,
      parentUserId: r.parentUserId,
      parentName: parentMap.get(r.parentUserId)?.displayName ?? '',
      parentEmail: parentMap.get(r.parentUserId)?.email ?? '',
      studentId: r.studentId,
      studentName: studentMap.get(r.studentId)?.name ?? '',
      gradeLevel: studentMap.get(r.studentId)?.gradeLevel ?? '',
      className: studentMap.get(r.studentId)?.className ?? '',
      acknowledgedAt: r.acknowledgedAt,
      acknowledgmentNote: r.acknowledgmentNote,
    }))

    const total = data.length
    const acknowledged = data.filter((d) => d.acknowledgedAt !== null).length
    const pending = total - acknowledged

    res.json({
      success: true,
      data: {
        form,
        summary: { total, acknowledged, pending, rate: total > 0 ? Math.round((acknowledged / total) * 100) : 0 },
        recipients: data,
      },
    })
  } catch (error) {
    console.error('GET /communications/consent-forms/:id/report error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── CM-04: Communication History Log ────────────────────────────
// GET /communications/history?studentId=&type=&search=
// Parent: own history; Admin/Principal: all or by studentId

router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const role = req.user!.role
    const { studentId, type, search } = req.query as { studentId?: string; type?: string; search?: string }

    let parentUserId = userId
    let targetStudentIds: string[] = []

    if (role === 'parent') {
      const childIds = await getChildStudentIds(userId)
      targetStudentIds = studentId && childIds.includes(studentId) ? [studentId] : childIds
    } else if (['admin', 'manager', 'principal'].includes(role)) {
      if (studentId) {
        targetStudentIds = [studentId]
        // Resolve parentUserId from student's parent link
        const link = await prisma.parentStudent.findFirst({ where: { studentId } })
        if (link) {
          const parent = await prisma.parent.findUnique({ where: { id: link.parentId }, select: { userId: true } })
          if (parent) parentUserId = parent.userId
        }
      } else {
        const allStudents = await prisma.student.findMany({ select: { id: true } })
        targetStudentIds = allStudents.map((s) => s.id)
      }
    } else {
      res.status(403).json({ success: false, message: 'Access denied' }); return
    }

    const events: Array<{
      id: string
      eventType: string
      title: string
      summary: string
      timestamp: Date
      studentId: string | null
      studentName?: string
      meta?: Record<string, unknown>
    }> = []

    // 1. Messages (threads involving this parent)
    if (!type || type === 'message') {
      const threads = await prisma.messageThread.findMany({
        where: {
          OR: [
            { parentUserId: parentUserId },
            ...(role !== 'parent' && studentId ? [{ studentId }] : []),
          ],
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 1 },
        },
      })
      for (const t of threads) {
        const firstMsg = t.messages[0]
        const snippet = firstMsg ? firstMsg.content.slice(0, 100) : ''
        events.push({
          id: `msg-${t.id}`,
          eventType: 'message',
          title: `Message: ${t.subject}`,
          summary: snippet ? `"${snippet}${snippet.length === 100 ? '…' : ''}"` : 'No messages yet',
          timestamp: t.createdAt,
          studentId: t.studentId,
          meta: { threadId: t.id, subject: t.subject },
        })
      }
    }

    // 2. Announcements (visible to parents)
    if (!type || type === 'announcement') {
      const announcements = await prisma.announcement.findMany({
        where: {
          targetAudience: { in: ['all', 'parents'] },
        },
        include: { author: { select: { displayName: true } } },
        orderBy: { publishedAt: 'desc' },
        take: 20,
      })
      for (const a of announcements) {
        events.push({
          id: `ann-${a.id}`,
          eventType: 'announcement',
          title: a.title,
          summary: a.content.slice(0, 150),
          timestamp: a.publishedAt,
          studentId: null,
          meta: { author: a.author.displayName, priority: a.priority },
        })
      }
    }

    // 3. Consent form assignments
    if (!type || type === 'consent') {
      const consentRecipients = await prisma.consentFormRecipient.findMany({
        where: {
          parentUserId: role === 'parent' ? userId : undefined,
          studentId: targetStudentIds.length > 0 ? { in: targetStudentIds } : undefined,
        },
        include: { form: true },
        orderBy: { createdAt: 'desc' },
      })
      for (const r of consentRecipients) {
        events.push({
          id: `consent-${r.id}`,
          eventType: 'consent',
          title: `Consent Form: ${r.form.title}`,
          summary: r.acknowledgedAt
            ? `Acknowledged on ${r.acknowledgedAt.toLocaleDateString()}`
            : `Pending acknowledgment${r.form.dueDate ? ` — due ${r.form.dueDate.toLocaleDateString()}` : ''}`,
          timestamp: r.createdAt,
          studentId: r.studentId,
          meta: { formId: r.form.id, formType: r.form.type, acknowledged: !!r.acknowledgedAt },
        })
      }
    }

    // 4. Parent-Teacher Meetings
    if (!type || type === 'meeting') {
      const meetings = await prisma.parentTeacherMeeting.findMany({
        where: {
          parentUserId: role === 'parent' ? userId : undefined,
          studentId: targetStudentIds.length > 0 ? { in: targetStudentIds } : undefined,
        },
        include: {
          teacher: { include: { user: { select: { displayName: true } } } },
          student: { include: { user: { select: { displayName: true } } } },
        },
        orderBy: { meetingDate: 'desc' },
      })
      for (const m of meetings) {
        events.push({
          id: `meeting-${m.id}`,
          eventType: 'meeting',
          title: `Meeting with ${m.teacher.user.displayName}`,
          summary: `${m.status} — ${m.meetingDate.toLocaleDateString()} ${m.startTime}–${m.endTime}${m.purpose ? ` | ${m.purpose}` : ''}`,
          timestamp: m.createdAt,
          studentId: m.studentId,
          studentName: m.student.user.displayName,
          meta: { status: m.status, teacherName: m.teacher.user.displayName },
        })
      }
    }

    // Enrich with student names
    const allStudentIds = [...new Set(events.map((e) => e.studentId).filter(Boolean))] as string[]
    if (allStudentIds.length > 0) {
      const students = await prisma.student.findMany({
        where: { id: { in: allStudentIds } },
        include: { user: { select: { displayName: true } } },
      })
      const sMap = new Map(students.map((s) => [s.id, s.user.displayName]))
      for (const e of events) {
        if (e.studentId && !e.studentName) {
          e.studentName = sMap.get(e.studentId) ?? ''
        }
      }
    }

    // Filter by search
    let filtered = events
    if (search) {
      const q = search.toLowerCase()
      filtered = events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          (e.studentName ?? '').toLowerCase().includes(q),
      )
    }

    // Sort by timestamp desc
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    res.json({ success: true, data: filtered, total: filtered.length })
  } catch (error) {
    console.error('GET /communications/history error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /communications/consent-forms/:id — DELETE (admin)
router.delete('/consent-forms/:id', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const form = await prisma.consentForm.findUnique({ where: { id } })
    if (!form) { res.status(404).json({ success: false, message: 'Form not found' }); return }
    if (form.status === 'ACTIVE') { res.status(400).json({ success: false, message: 'Cannot delete an active form. Close it first.' }); return }
    await prisma.consentForm.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
