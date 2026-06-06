import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { send } from '../services/notificationService'
import { sendPushToUser } from '../services/pushService'
import { recalcStudentRisk } from './ai'
import { broadcast } from './events'
import * as XLSX from 'xlsx'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// Helper: get student IDs the current user can access
async function getAccessibleStudentIds(user: AuthRequest['user']): Promise<string[] | null> {
  if (!user) return []
  if (user.role === 'student') {
    const student = await prisma.student.findUnique({ where: { userId: user.userId } })
    return student ? [student.id] : []
  }
  if (user.role === 'parent') {
    const parent = await prisma.parent.findUnique({
      where: { userId: user.userId },
      include: { childLinks: true },
    })
    return parent ? parent.childLinks.map((l) => l.studentId) : []
  }
  return null // null = no restriction
}

// Helper: get course IDs a teacher is assigned to
async function getTeacherCourseIds(userId: string): Promise<string[]> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: { courseAssignments: true },
  })
  return teacher ? teacher.courseAssignments.map((a) => a.courseId) : []
}

// GET / — list grades
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, studentId } = req.query as { courseId?: string; studentId?: string }
    // Student and parent roles can query without params (scoped server-side)
    const isPortalRole = req.user!.role === 'student' || req.user!.role === 'parent'
    if (!isPortalRole && !courseId && !studentId) {
      res.status(400).json({ success: false, message: 'courseId or studentId query param is required' })
      return
    }

    const where: any = {}

    // Filter by courseId via gradeItem
    if (courseId) {
      where.gradeItem = { courseId }
    }
    if (studentId) {
      where.studentId = studentId
    }

    // Role-based filtering
    const accessibleIds = await getAccessibleStudentIds(req.user)
    if (accessibleIds !== null) {
      if (accessibleIds.length === 0) {
        res.json({ success: true, data: [] })
        return
      }
      where.studentId = accessibleIds.length === 1 ? accessibleIds[0] : { in: accessibleIds }
    }

    if (req.user!.role === 'teacher') {
      const courseIds = await getTeacherCourseIds(req.user!.userId)
      where.gradeItem = { courseId: { in: courseIds }, ...(courseId ? { courseId } : {}) }
    }

    const grades = await prisma.grade.findMany({
      where,
      include: {
        gradeItem: {
          include: { course: { select: { id: true, code: true, name: true } } },
        },
        student: { include: { user: { select: { id: true, displayName: true, username: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: grades })
  } catch (error) {
    console.error('GET /grades error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST / — create/upsert a grade
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, gradeItemId, score, letterGrade, remarks } = req.body
      if (!studentId || !gradeItemId) {
        res.status(400).json({ success: false, message: 'studentId and gradeItemId are required' })
        return
      }

      // Capture previous score for drop detection before upsert
      const previousGrade = await prisma.grade.findUnique({
        where: { studentId_gradeItemId: { studentId, gradeItemId } },
        include: { gradeItem: true },
      })
      const previousScore = previousGrade?.score ?? null

      const grade = await prisma.grade.upsert({
        where: { studentId_gradeItemId: { studentId, gradeItemId } },
        create: { studentId, gradeItemId, score, letterGrade, remarks, gradedAt: new Date() },
        update: { score, letterGrade, remarks, gradedAt: new Date() },
        include: { gradeItem: { include: { course: { select: { name: true } } } } },
      })

      // Notify student and parents with in-app + Web Push
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { id: true, displayName: true } },
          parentLinks: { include: { parent: { include: { user: { select: { id: true } } } } } },
        },
      })

      if (student) {
        const itemName = grade.gradeItem?.name ?? 'an assessment'
        const courseName = (grade.gradeItem as any)?.course?.name ?? itemName
        const maxScore = grade.gradeItem?.maxScore ?? 100
        const parentUserIds = student.parentLinks.map(l => l.parent.user.id)
        const notifyIds = [student.userId, ...parentUserIds]

        // In-app notifications for everyone
        await Promise.all(
          notifyIds.map(uid =>
            send({
              userId: uid,
              title: 'Grade Published',
              message: `${student.user.displayName}'s ${itemName} grade: ${score ?? '—'} / ${maxScore}.`,
              type: 'info',
            }),
          ),
        )

        // Web Push to parents (matches demo: parent phone receives push immediately)
        await Promise.all(
          parentUserIds.map(uid =>
            sendPushToUser(uid, {
              title: 'Grade Published',
              body: `${student.user.displayName}'s ${courseName} grade is now available: ${score ?? '—'} / ${maxScore}.`,
              url: '/parent/grades',
            }).catch(err => console.error('[Push] Grade push failed:', err)),
          ),
        )

        // Grade drop detection: if new score drops ≥15 percentage points vs previous → counselor pre-alert
        if (score !== null && score !== undefined && previousScore !== null) {
          const prevPct = (previousScore / maxScore) * 100
          const newPct = ((score as number) / maxScore) * 100
          const dropPct = prevPct - newPct

          if (dropPct >= 15) {
            // Open counselor pre-alert (not full case — just a warning notification)
            const counselorUser = await prisma.user.findFirst({ where: { role: 'counselor' } })
            if (counselorUser) {
              await send({
                userId: counselorUser.id,
                title: 'Grade Drop Alert',
                message: `${student.user.displayName}'s ${itemName} dropped ${dropPct.toFixed(1)}% (${previousScore.toFixed(0)} → ${(score as number).toFixed(0)} / ${maxScore}). Consider early intervention.`,
                type: 'warning',
              })
            }
            // Also notify principal
            const principals = await prisma.user.findMany({ where: { role: 'principal' }, select: { id: true } })
            await Promise.all(
              principals.map(p =>
                send({
                  userId: p.id,
                  title: 'Significant Grade Drop',
                  message: `${student.user.displayName} dropped ${dropPct.toFixed(1)}% on ${itemName}. Risk model recalculating.`,
                  type: 'warning',
                }),
              ),
            )
            // SSE broadcast so Command Center / risk dashboard refreshes
            broadcast('dashboard', 'dashboard.risk.changed', { studentId, trigger: 'GRADE_DROP' })
          }
        }

        // Trigger risk recalculation (fire-and-forget, completes within ~1.5s)
        recalcStudentRisk(studentId, 'GRADE_PUBLISHED').catch(err =>
          console.error('[Risk] recalc failed after grade save:', err),
        )
      }

      res.json({ success: true, data: grade })
    } catch (error) {
      console.error('POST /grades error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// PATCH /:id — update a grade
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string
      const { score, letterGrade, remarks } = req.body

      const grade = await prisma.grade.update({
        where: { id },
        data: {
          ...(score !== undefined && { score }),
          ...(letterGrade !== undefined && { letterGrade }),
          ...(remarks !== undefined && { remarks }),
          gradedAt: new Date(),
        },
        include: { gradeItem: true },
      })

      res.json({ success: true, data: grade })
    } catch (error) {
      console.error('PATCH /grades/:id error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },
)

// GET /grades/template/:courseId — download blank Excel grade template
router.get('/template/:courseId', authenticate, requireRole('admin', 'manager', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params as { courseId: string }
    const [course, gradeItems, enrollments] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId }, select: { code: true, name: true } }),
      prisma.gradeItem.findMany({ where: { courseId }, orderBy: { name: 'asc' } }),
      prisma.enrollment.findMany({
        where: { courseId, status: 'enrolled' },
        include: { student: { include: { user: { select: { displayName: true } } } } },
        orderBy: { student: { user: { displayName: 'asc' } } },
      }),
    ])
    if (!course) { res.status(404).json({ success: false, message: 'Course not found' }); return }

    const headers = ['Student Name', 'Student ID', ...gradeItems.map(gi => `${gi.name} (max ${gi.maxScore})`)]
    const rows = enrollments.map(en => [
      en.student?.user?.displayName ?? '',
      en.studentId,
      ...gradeItems.map(() => ''),
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [{ wch: 28 }, { wch: 16 }, ...gradeItems.map(() => ({ wch: 20 }))]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${course.code} Grades`)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Disposition', `attachment; filename="grade_template_${course.code}.xlsx"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  } catch (error) {
    console.error('GET /grades/template error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /grades/report/:courseId — download grade report as Excel
router.get('/report/:courseId', authenticate, requireRole('admin', 'manager', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params as { courseId: string }
    const [course, gradeItems, enrollments, grades] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId }, select: { code: true, name: true } }),
      prisma.gradeItem.findMany({ where: { courseId }, orderBy: { name: 'asc' } }),
      prisma.enrollment.findMany({
        where: { courseId, status: 'enrolled' },
        include: { student: { include: { user: { select: { displayName: true } } } } },
        orderBy: { student: { user: { displayName: 'asc' } } },
      }),
      prisma.grade.findMany({ where: { gradeItem: { courseId } }, include: { gradeItem: true } }),
    ])
    if (!course) { res.status(404).json({ success: false, message: 'Course not found' }); return }

    const gradeMap = new Map<string, number>()
    grades.forEach(g => gradeMap.set(`${g.studentId}:${g.gradeItemId}`, g.score ?? 0))

    const getLetterGrade = (pct: number) => pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F'

    const headers = ['Student Name', 'Student ID', ...gradeItems.map(gi => `${gi.name} (/${gi.maxScore})`), 'Average %', 'Letter Grade']
    const rows = enrollments.map(en => {
      const scores: (string | number)[] = gradeItems.map(gi => gradeMap.get(`${en.studentId}:${gi.id}`) ?? '')
      let totalWeight = 0, weightedSum = 0, hasAny = false
      gradeItems.forEach((gi, i) => {
        const s = scores[i]
        if (s !== '' && gi.maxScore > 0) {
          weightedSum += ((s as number) / gi.maxScore) * 100 * gi.weight
          totalWeight += gi.weight
          hasAny = true
        }
      })
      const avg = hasAny && totalWeight > 0 ? weightedSum / totalWeight : null
      return [en.student?.user?.displayName ?? '', en.studentId, ...scores, avg !== null ? Math.round(avg * 10) / 10 : '', avg !== null ? getLetterGrade(avg) : '']
    })

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [{ wch: 28 }, { wch: 16 }, ...gradeItems.map(() => ({ wch: 18 })), { wch: 12 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${course.code} Report`)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Disposition', `attachment; filename="grade_report_${course.code}.xlsx"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  } catch (error) {
    console.error('GET /grades/report error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /grades/import/:courseId — bulk import from Excel/CSV
router.post('/import/:courseId', authenticate, requireRole('admin', 'manager', 'teacher'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.params as { courseId: string }
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: '' })

    if (rows.length === 0) { res.status(400).json({ success: false, message: 'File is empty or unreadable' }); return }

    const gradeItems = await prisma.gradeItem.findMany({ where: { courseId } })
    if (gradeItems.length === 0) { res.status(400).json({ success: false, message: 'No grade items found for this course' }); return }

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId, status: 'enrolled' },
      select: { studentId: true },
    })
    const validStudentIds = new Set(enrollments.map(e => e.studentId))

    let upserted = 0, skipped = 0
    const errors: string[] = []

    for (const row of rows) {
      const studentId = String(row['Student ID'] ?? '').trim()
      if (!studentId || !validStudentIds.has(studentId)) { skipped++; continue }

      for (const gi of gradeItems) {
        const colName = gradeItems.find(g => g.id === gi.id) ? `${gi.name} (max ${gi.maxScore})` : gi.name
        const rawVal = row[colName] ?? row[gi.name] ?? ''
        if (rawVal === '' || rawVal === null || rawVal === undefined) continue
        const score = Number(rawVal)
        if (isNaN(score) || score < 0 || score > gi.maxScore) {
          errors.push(`${studentId}: "${gi.name}" value "${rawVal}" is invalid`)
          continue
        }
        await prisma.grade.upsert({
          where: { studentId_gradeItemId: { studentId, gradeItemId: gi.id } },
          create: { studentId, gradeItemId: gi.id, score, gradedAt: new Date() },
          update: { score, gradedAt: new Date() },
        })
        upserted++
      }
    }

    res.json({ success: true, data: { upserted, skipped, errors: errors.slice(0, 10) } })
  } catch (error) {
    console.error('POST /grades/import error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
