import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { USER_SELECT_NAME } from '../lib/querySelects'
import { validateTransition, EXAM_TRANSITIONS, EXAM_CANDIDATE_TRANSITIONS } from '../lib/transitions'

const router = Router()

const VALID_EXAM_TYPES = ['PSR', 'O_LEVEL', 'A_LEVEL', 'IGCSE']

// GET /exams — list exams for current school
router.get('/', authenticate, requireRole('admin', 'manager', 'principal', 'hod', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const { examType, year, status } = req.query as { examType?: string; year?: string; status?: string }
    const schoolId = req.user!.schoolId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (schoolId) where.schoolId = schoolId
    if (examType) where.examType = examType
    if (year) where.year = parseInt(year)
    if (status) where.status = status

    const exams = await prisma.exam.findMany({
      where,
      include: { _count: { select: { candidates: true } } },
      orderBy: [{ year: 'desc' }, { examDate: 'desc' }],
    })

    const data = exams.map(e => ({ ...e, candidateCount: e._count.candidates }))
    res.json({ success: true, data })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /exams/:id — exam detail + candidate count
router.get('/:id', authenticate, requireRole('admin', 'manager', 'principal', 'hod', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const exam = await prisma.exam.findUnique({ where: { id } })
    if (!exam) { res.status(404).json({ success: false, message: 'Exam not found' }); return }
    const candidateCount = await prisma.examCandidate.count({ where: { examId: id } })
    res.json({ success: true, data: { ...exam, candidateCount } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /exams — create exam
router.post('/', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const { examType, year, examDate, venue } = req.body
    if (!VALID_EXAM_TYPES.includes(examType)) {
      res.status(400).json({ success: false, message: `examType must be one of: ${VALID_EXAM_TYPES.join(', ')}` })
      return
    }
    const schoolId = req.user!.schoolId ?? req.body.schoolId
    if (!schoolId) { res.status(400).json({ success: false, message: 'schoolId is required' }); return }

    const exam = await prisma.exam.create({
      data: { schoolId, examType, year: parseInt(year), examDate: new Date(examDate), venue },
    })
    res.status(201).json({ success: true, data: exam })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PUT /exams/:id — update venue, date, status
router.put('/:id', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const existing = await prisma.exam.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Exam not found' }); return }

    const { venue, examDate, status, examType, year } = req.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (venue !== undefined) data.venue = venue
    if (examDate !== undefined) data.examDate = new Date(examDate)
    if (status !== undefined) {
      const transitionResult = validateTransition(EXAM_TRANSITIONS, existing.status, status)
      if (!transitionResult.ok) {
        res.status(400).json({ success: false, message: transitionResult.reason }); return
      }
      data.status = status
    }
    if (examType !== undefined) {
      if (!VALID_EXAM_TYPES.includes(examType)) {
        res.status(400).json({ success: false, message: `examType must be one of: ${VALID_EXAM_TYPES.join(', ')}` })
        return
      }
      data.examType = examType
    }
    if (year !== undefined) data.year = parseInt(year)

    const exam = await prisma.exam.update({ where: { id }, data })
    res.json({ success: true, data: exam })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /exams/:id — delete exam (cascade deletes candidates)
router.delete('/:id', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const existing = await prisma.exam.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Exam not found' }); return }

    await prisma.examCandidate.deleteMany({ where: { examId: id } })
    await prisma.exam.delete({ where: { id } })
    res.json({ success: true, message: 'Exam deleted' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /exams/:id/candidates — list all candidates with student info
router.get('/:id/candidates', authenticate, requireRole('admin', 'manager', 'principal', 'hod', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params['id'] as string
    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) { res.status(404).json({ success: false, message: 'Exam not found' }); return }

    const { subjectCode } = req.query as { subjectCode?: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { examId }
    if (subjectCode) where.subjectCode = subjectCode

    const candidates = await prisma.examCandidate.findMany({
      where,
      include: {
        student: {
          select: { studentId: true, icNumber: true, gradeLevel: true, className: true, user: { select: USER_SELECT_NAME } },
        },
      },
      orderBy: [{ subjectCode: 'asc' }, { seatNumber: 'asc' }],
    })

    const data = candidates.map(c => ({
      id: c.id,
      examId: c.examId,
      studentId: c.studentId,
      subjectCode: c.subjectCode,
      seatNumber: c.seatNumber,
      status: c.status,
      studentName: c.student.user.displayName,
      studentCode: c.student.studentId,
      icNumber: c.student.icNumber,
      gradeLevel: c.student.gradeLevel,
      className: c.student.className,
    }))

    res.json({ success: true, data })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /exams/:id/candidates — add by class or individual
router.post('/:id/candidates', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params['id'] as string
    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) { res.status(404).json({ success: false, message: 'Exam not found' }); return }

    const { mode } = req.body

    if (mode === 'class') {
      const { gradeLevel, className, subjects } = req.body as { gradeLevel: string; className?: string; subjects: string[] }
      if (!gradeLevel || !subjects?.length) {
        res.status(400).json({ success: false, message: 'gradeLevel and subjects are required for class mode' })
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const studentWhere: any = { gradeLevel }
      if (className) studentWhere.className = className
      if (exam.schoolId) studentWhere.schoolId = exam.schoolId

      const students = await prisma.student.findMany({ where: studentWhere, select: { id: true } })
      if (!students.length) {
        res.status(400).json({ success: false, message: 'No students found for the specified grade/class' })
        return
      }

      let added = 0
      for (const student of students) {
        for (const subjectCode of subjects) {
          const exists = await prisma.examCandidate.findUnique({
            where: { examId_studentId_subjectCode: { examId, studentId: student.id, subjectCode } },
          })
          if (!exists) {
            await prisma.examCandidate.create({ data: { examId, studentId: student.id, subjectCode } })
            added++
          }
        }
      }
      const total = students.length * subjects.length

      res.status(201).json({ success: true, message: `Added ${added} candidates (${total - added} duplicates skipped)` })
    } else if (mode === 'individual') {
      const { studentId, subjectCode } = req.body as { studentId: string; subjectCode: string }
      if (!studentId || !subjectCode) {
        res.status(400).json({ success: false, message: 'studentId and subjectCode are required for individual mode' })
        return
      }

      const student = await prisma.student.findUnique({ where: { id: studentId } })
      if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return }

      const existing = await prisma.examCandidate.findUnique({
        where: { examId_studentId_subjectCode: { examId, studentId, subjectCode } },
      })
      if (existing) {
        res.status(409).json({ success: false, message: 'This student is already registered for this subject' })
        return
      }

      const candidate = await prisma.examCandidate.create({
        data: { examId, studentId, subjectCode },
      })
      res.status(201).json({ success: true, data: candidate })
    } else {
      res.status(400).json({ success: false, message: 'mode must be "class" or "individual"' })
    }
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /exams/:id/candidates/:candidateId — remove one candidate
router.delete('/:id/candidates/:candidateId', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params['id'] as string
    const candidateId = req.params['candidateId'] as string
    const candidate = await prisma.examCandidate.findUnique({ where: { id: candidateId } })
    if (!candidate || candidate.examId !== examId) {
      res.status(404).json({ success: false, message: 'Candidate not found' })
      return
    }
    await prisma.examCandidate.delete({ where: { id: candidateId } })
    res.json({ success: true, message: 'Candidate removed' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /exams/:id/generate-seating — assign seat numbers
router.post('/:id/generate-seating', authenticate, requireRole('admin', 'manager', 'principal'), async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params['id'] as string
    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) { res.status(404).json({ success: false, message: 'Exam not found' }); return }

    const candidates = await prisma.examCandidate.findMany({
      where: { examId },
      orderBy: [{ studentId: 'asc' }, { subjectCode: 'asc' }],
    })

    if (!candidates.length) {
      res.status(400).json({ success: false, message: 'No candidates registered for this exam' })
      return
    }

    // Artificial 1.5s delay (demo pacing)
    await new Promise(r => setTimeout(r, 1500))

    await Promise.all(
      candidates.map((c, idx) => {
        const seat = `A${String(idx + 1).padStart(3, '0')}`
        return prisma.examCandidate.update({ where: { id: c.id }, data: { seatNumber: seat } })
      })
    )

    const updated = await prisma.examCandidate.findMany({
      where: { examId },
      include: { student: { select: { user: { select: USER_SELECT_NAME }, studentId: true, icNumber: true, className: true } } },
      orderBy: { seatNumber: 'asc' },
    })

    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /exams/:id/seating-plan — candidates sorted by seatNumber
router.get('/:id/seating-plan', authenticate, requireRole('admin', 'manager', 'principal', 'hod', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params['id'] as string
    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (!exam) { res.status(404).json({ success: false, message: 'Exam not found' }); return }

    const candidates = await prisma.examCandidate.findMany({
      where: { examId, NOT: { seatNumber: null } },
      include: {
        student: {
          select: { studentId: true, icNumber: true, className: true, user: { select: USER_SELECT_NAME } },
        },
      },
      orderBy: { seatNumber: 'asc' },
    })

    const data = candidates.map(c => ({
      id: c.id,
      seatNumber: c.seatNumber,
      subjectCode: c.subjectCode,
      studentName: c.student.user.displayName,
      studentCode: c.student.studentId,
      icNumber: c.student.icNumber,
      className: c.student.className,
    }))

    res.json({ success: true, data })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PATCH /exams/:id/candidates/:candidateId — update status (attendance marking)
router.patch('/:id/candidates/:candidateId', authenticate, requireRole('admin', 'manager', 'principal', 'teacher'), async (req: AuthRequest, res: Response) => {
  try {
    const examId = req.params['id'] as string
    const candidateId = req.params['candidateId'] as string
    const candidate = await prisma.examCandidate.findUnique({ where: { id: candidateId } })
    if (!candidate || candidate.examId !== examId) {
      res.status(404).json({ success: false, message: 'Candidate not found' })
      return
    }

    const { status } = req.body as { status: string }
    const valid = ['registered', 'present', 'absent']
    if (!valid.includes(status)) {
      res.status(400).json({ success: false, message: `status must be one of: ${valid.join(', ')}` })
      return
    }

    const transitionResult = validateTransition(EXAM_CANDIDATE_TRANSITIONS, candidate.status, status)
    if (!transitionResult.ok) {
      res.status(400).json({ success: false, message: transitionResult.reason }); return
    }

    const updated = await prisma.examCandidate.update({
      where: { id: candidateId },
      data: { status },
    })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
