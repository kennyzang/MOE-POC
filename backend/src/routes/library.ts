import { Router, Response } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const FINE_PER_DAY = 0.10

const VALID_CATEGORIES = new Set([
  'Fiction', 'Non-Fiction', 'Reference', 'Textbook',
  'Science', 'History', 'Mathematics', 'Language', 'Arts', 'General',
])

function computeOverdueDays(dueDate: Date, returnedAt: Date | null): number {
  const end = returnedAt ?? new Date()
  const diff = end.getTime() - dueDate.getTime()
  return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0
}

// ─── Books ────────────────────────────────────────────────────────────────────

// GET /library/books
router.get('/books', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, category, available } = req.query as { search?: string; category?: string; available?: string }
    const schoolId = req.user!.schoolId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (schoolId) where.schoolId = schoolId
    if (category) where.category = category
    if (available === 'true') where.availableCopies = { gt: 0 }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { author: { contains: search } },
      ]
    }

    const books = await prisma.libraryBook.findMany({
      where,
      orderBy: { title: 'asc' },
    })
    res.json({ success: true, data: books })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /library/books/:id — detail + active loan/hold counts
router.get('/books/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const book = await prisma.libraryBook.findUnique({ where: { id } })
    if (!book) { res.status(404).json({ success: false, message: 'Book not found' }); return }

    const activeLoans = await prisma.libraryLoan.count({ where: { bookId: id, returnedAt: null } })
    const activeHolds = await prisma.libraryHold.count({ where: { bookId: id, status: { not: 'cancelled' } } })

    res.json({ success: true, data: { ...book, activeLoans, activeHolds } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /library/books — add book (admin/manager)
router.post('/books', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { isbn, title, author, category, totalCopies, kohaId } = req.body
    const schoolId = req.user!.schoolId ?? req.body.schoolId
    const copies = parseInt(totalCopies) || 1

    const book = await prisma.libraryBook.create({
      data: {
        schoolId: schoolId ?? '',
        isbn,
        title,
        author,
        category: category ?? 'General',
        totalCopies: copies,
        availableCopies: copies,
        kohaId,
      },
    })
    res.status(201).json({ success: true, data: book })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /library/books/import — batch import from Excel (admin/manager)
router.post('/books/import', authenticate, requireRole('admin', 'manager'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }

    const schoolId = req.user!.schoolId ?? ''
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) { res.status(400).json({ success: false, message: 'Excel file has no sheets' }); return }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    let imported = 0
    const errors: Array<{ row: number; reason: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const rowNum = i + 2  // 1-indexed, row 1 is header

      const title = String(row['title'] ?? row['Title'] ?? '').trim()
      const author = String(row['author'] ?? row['Author'] ?? '').trim()
      const category = String(row['category'] ?? row['Category'] ?? 'General').trim()
      const totalCopies = parseInt(String(row['totalCopies'] ?? row['Total Copies'] ?? '1'))
      const isbn = String(row['isbn'] ?? row['ISBN'] ?? '').trim() || undefined
      const kohaId = String(row['kohaId'] ?? row['Koha ID'] ?? '').trim() || undefined

      if (!title) { errors.push({ row: rowNum, reason: 'Title is required' }); continue }
      if (!author) { errors.push({ row: rowNum, reason: 'Author is required' }); continue }
      if (!VALID_CATEGORIES.has(category)) {
        errors.push({ row: rowNum, reason: `Invalid category "${category}". Must be one of: ${[...VALID_CATEGORIES].join(', ')}` }); continue
      }
      if (isNaN(totalCopies) || totalCopies < 1) {
        errors.push({ row: rowNum, reason: 'totalCopies must be a positive number' }); continue
      }

      await prisma.libraryBook.create({
        data: { schoolId, isbn, title, author, category, totalCopies, availableCopies: totalCopies, kohaId },
      })
      imported++
    }

    res.json({ success: true, data: { imported, skipped: errors.length, errors } })
  } catch (err) {
    console.error('POST /library/books/import error:', err)
    res.status(500).json({ success: false, message: 'Import failed' })
  }
})

// PUT /library/books/:id
router.put('/books/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const book = await prisma.libraryBook.findUnique({ where: { id } })
    if (!book) { res.status(404).json({ success: false, message: 'Book not found' }); return }

    const { isbn, title, author, category, totalCopies, kohaId } = req.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (isbn !== undefined) data.isbn = isbn
    if (title !== undefined) data.title = title
    if (author !== undefined) data.author = author
    if (category !== undefined) data.category = category
    if (kohaId !== undefined) data.kohaId = kohaId
    if (totalCopies !== undefined) {
      const newTotal = parseInt(totalCopies)
      const activeLoans = await prisma.libraryLoan.count({ where: { bookId: id, returnedAt: null } })
      const delta = newTotal - book.totalCopies
      const newAvailable = Math.max(activeLoans === 0 ? 0 : book.availableCopies, book.availableCopies + delta)
      data.totalCopies = newTotal
      data.availableCopies = Math.max(activeLoans, Math.min(newTotal, newAvailable))
    }

    const updated = await prisma.libraryBook.update({ where: { id }, data })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// DELETE /library/books/:id — only if no active loans
router.delete('/books/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const book = await prisma.libraryBook.findUnique({ where: { id } })
    if (!book) { res.status(404).json({ success: false, message: 'Book not found' }); return }

    const activeLoans = await prisma.libraryLoan.count({ where: { bookId: id, returnedAt: null } })
    if (activeLoans > 0) {
      res.status(409).json({ success: false, message: `Cannot delete: ${activeLoans} active loan(s) exist` })
      return
    }

    await prisma.libraryHold.deleteMany({ where: { bookId: id } })
    await prisma.libraryLoan.deleteMany({ where: { bookId: id } })
    await prisma.libraryBook.delete({ where: { id } })
    res.json({ success: true, message: 'Book deleted' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Loans ────────────────────────────────────────────────────────────────────

// POST /library/books/:id/borrow
router.post('/books/:id/borrow', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bookId = req.params['id'] as string
    const { studentId, dueDays } = req.body

    const book = await prisma.libraryBook.findUnique({ where: { id: bookId } })
    if (!book) { res.status(404).json({ success: false, message: 'Book not found' }); return }

    if (book.availableCopies <= 0) {
      res.status(409).json({ success: false, message: 'No copies available — place a hold instead' })
      return
    }

    const activeLoan = await prisma.libraryLoan.findFirst({
      where: { bookId, studentId, returnedAt: null },
    })
    if (activeLoan) {
      res.status(409).json({ success: false, message: 'Student already has an active loan for this book' })
      return
    }

    const days = parseInt(dueDays) || 14
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + days)

    const [loan] = await prisma.$transaction([
      prisma.libraryLoan.create({ data: { bookId, studentId, dueDate } }),
      prisma.libraryBook.update({ where: { id: bookId }, data: { availableCopies: { decrement: 1 } } }),
    ])

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { displayName: true } } },
    })

    res.status(201).json({
      success: true,
      data: { ...loan, studentName: student?.user.displayName, bookTitle: book.title },
    })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /library/loans — active loans
router.get('/loans', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { overdue } = req.query as { overdue?: string }
    const schoolId = req.user!.schoolId

    const loans = await prisma.libraryLoan.findMany({
      where: { returnedAt: null },
      include: {
        book: { select: { title: true, schoolId: true } },
        student: { select: { className: true, user: { select: { displayName: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    })

    const now = new Date()
    let data = loans
      .filter(l => !schoolId || l.book.schoolId === schoolId)
      .map(l => {
        const overdueDays = computeOverdueDays(l.dueDate, null)
        const isOverdue = l.dueDate < now
        return {
          id: l.id,
          bookId: l.bookId,
          studentId: l.studentId,
          bookTitle: l.book.title,
          studentName: l.student.user.displayName,
          className: l.student.className,
          borrowedAt: l.borrowedAt,
          dueDate: l.dueDate,
          isOverdue,
          overdueDays,
          fineAmount: isOverdue ? parseFloat((overdueDays * FINE_PER_DAY).toFixed(2)) : 0,
        }
      })

    if (overdue === 'true') data = data.filter(l => l.isOverdue)

    res.json({ success: true, data })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /library/loans/:id
router.get('/loans/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const loan = await prisma.libraryLoan.findUnique({
      where: { id },
      include: {
        book: true,
        student: { include: { user: { select: { displayName: true } } } },
      },
    })
    if (!loan) { res.status(404).json({ success: false, message: 'Loan not found' }); return }
    const overdueDays = computeOverdueDays(loan.dueDate, loan.returnedAt)
    res.json({ success: true, data: { ...loan, overdueDays, fineAmount: loan.returnedAt ? loan.fineAmount : parseFloat((overdueDays * FINE_PER_DAY).toFixed(2)) } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /library/loans/:id/return
router.post('/loans/:id/return', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const loan = await prisma.libraryLoan.findUnique({ where: { id } })
    if (!loan) { res.status(404).json({ success: false, message: 'Loan not found' }); return }
    if (loan.returnedAt) { res.status(409).json({ success: false, message: 'Book already returned' }); return }

    const now = new Date()
    const overdueDays = computeOverdueDays(loan.dueDate, now)
    const fineAmount = parseFloat((overdueDays * FINE_PER_DAY).toFixed(2))

    const updated = await prisma.libraryLoan.update({
      where: { id },
      data: { returnedAt: now, fineAmount },
    })

    await prisma.libraryBook.update({
      where: { id: loan.bookId },
      data: { availableCopies: { increment: 1 } },
    })

    // Promote first waiting hold to "ready"
    const firstHold = await prisma.libraryHold.findFirst({
      where: { bookId: loan.bookId, status: 'waiting' },
      orderBy: { requestedAt: 'asc' },
    })
    if (firstHold) {
      await prisma.libraryHold.update({ where: { id: firstHold.id }, data: { status: 'ready' } })
    }

    res.json({ success: true, data: { ...updated, overdueDays, fineAmount } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Holds ────────────────────────────────────────────────────────────────────

// POST /library/books/:id/hold
router.post('/books/:id/hold', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bookId = req.params['id'] as string
    const { studentId } = req.body

    const book = await prisma.libraryBook.findUnique({ where: { id: bookId } })
    if (!book) { res.status(404).json({ success: false, message: 'Book not found' }); return }

    if (book.availableCopies > 0) {
      res.status(400).json({ success: false, message: 'Copies are available — borrow directly instead' })
      return
    }

    const hold = await prisma.libraryHold.create({
      data: { bookId, studentId, status: 'waiting' },
    })
    res.status(201).json({ success: true, data: hold })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// GET /library/holds
router.get('/holds', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user!.schoolId
    const holds = await prisma.libraryHold.findMany({
      where: { status: { not: 'cancelled' } },
      include: {
        book: { select: { title: true, schoolId: true } },
        student: { select: { user: { select: { displayName: true } } } },
      },
      orderBy: { requestedAt: 'asc' },
    })

    const data = holds
      .filter(h => !schoolId || h.book.schoolId === schoolId)
      .map(h => ({
        id: h.id,
        bookId: h.bookId,
        studentId: h.studentId,
        bookTitle: h.book.title,
        studentName: h.student.user.displayName,
        requestedAt: h.requestedAt,
        status: h.status,
      }))

    res.json({ success: true, data })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// PUT /library/holds/:id
router.put('/holds/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const hold = await prisma.libraryHold.findUnique({ where: { id } })
    if (!hold) { res.status(404).json({ success: false, message: 'Hold not found' }); return }

    const { status } = req.body as { status: string }
    const valid = ['waiting', 'ready', 'cancelled']
    if (!valid.includes(status)) {
      res.status(400).json({ success: false, message: `status must be one of: ${valid.join(', ')}` })
      return
    }

    const updated = await prisma.libraryHold.update({ where: { id }, data: { status } })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Fines ────────────────────────────────────────────────────────────────────

// GET /library/fines — loans with fineAmount > 0
router.get('/fines', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user!.schoolId

    // Already-returned loans with stored fineAmount > 0
    const returnedFines = await prisma.libraryLoan.findMany({
      where: { returnedAt: { not: null }, fineAmount: { gt: 0 } },
      include: {
        book: { select: { title: true, schoolId: true } },
        student: { select: { user: { select: { displayName: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    })

    // Active overdue loans — compute fine on the fly
    const overdueActive = await prisma.libraryLoan.findMany({
      where: { returnedAt: null, dueDate: { lt: new Date() } },
      include: {
        book: { select: { title: true, schoolId: true } },
        student: { select: { user: { select: { displayName: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    })

    const now = new Date()
    const allFines = [
      ...returnedFines
        .filter(l => !schoolId || l.book.schoolId === schoolId)
        .map(l => ({
          id: l.id,
          bookTitle: l.book.title,
          studentName: l.student.user.displayName,
          dueDate: l.dueDate,
          returnedAt: l.returnedAt,
          overdueDays: computeOverdueDays(l.dueDate, l.returnedAt),
          fineAmount: l.fineAmount,
          paid: l.fineAmount === 0,
        })),
      ...overdueActive
        .filter(l => !schoolId || l.book.schoolId === schoolId)
        .map(l => {
          const days = computeOverdueDays(l.dueDate, null)
          return {
            id: l.id,
            bookTitle: l.book.title,
            studentName: l.student.user.displayName,
            dueDate: l.dueDate,
            returnedAt: null,
            overdueDays: days,
            fineAmount: parseFloat((days * FINE_PER_DAY).toFixed(2)),
            paid: false,
          }
        }),
    ].filter(f => f.fineAmount > 0)

    // Sort by dueDate ascending, then by fine amount desc
    allFines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

    // De-duplicate (active overdue loans don't overlap with returned)
    const seen = new Set<string>()
    const deduplicated = allFines.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true })

    void now // suppress unused warning
    res.json({ success: true, data: deduplicated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// POST /library/fines/:loanId/pay
router.post('/fines/:loanId/pay', authenticate, requireRole('admin', 'manager', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    const loanId = req.params['loanId'] as string
    const loan = await prisma.libraryLoan.findUnique({ where: { id: loanId } })
    if (!loan) { res.status(404).json({ success: false, message: 'Loan not found' }); return }

    await prisma.libraryLoan.update({ where: { id: loanId }, data: { fineAmount: 0 } })

    await prisma.auditEvent.create({
      data: {
        actorUserId: req.user!.userId,
        action: 'LIBRARY_FINE_PAID',
        entityType: 'LibraryLoan',
        entityId: loanId,
        details: JSON.stringify({ originalFine: loan.fineAmount }),
      },
    })

    res.json({ success: true, message: 'Fine cleared' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
