import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import prisma from '../lib/prisma'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
    ]
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`))
    }
  },
})

// POST /files/upload
router.post('/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }

    const { entityType, entityId, description } = req.body

    const attachment = await prisma.fileAttachment.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        entityType: entityType ?? 'other',
        entityId: entityId ?? null,
        uploadedBy: req.user!.userId,
        description: description ?? null,
      },
    })

    res.json({
      success: true,
      data: {
        id: attachment.id,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        entityType: attachment.entityType,
        entityId: attachment.entityId,
        description: attachment.description,
        createdAt: attachment.createdAt,
        downloadUrl: `/api/v1/files/${attachment.id}/download`,
      },
    })
  } catch (err) {
    // clean up uploaded file on error
    if (req.file) fs.unlink(req.file.path, () => {})
    console.error('File upload error:', err)
    res.status(500).json({ success: false, message: 'Upload failed' })
  }
})

// GET /files  — list by entityType + entityId
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entityType = req.query.entityType as string | undefined
    const entityId = req.query.entityId as string | undefined

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId

    const files = await prisma.fileAttachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      success: true,
      data: files.map(f => ({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
        entityType: f.entityType,
        entityId: f.entityId,
        description: f.description,
        createdAt: f.createdAt,
        downloadUrl: `/api/v1/files/${f.id}/download`,
      })),
    })
  } catch (err) {
    console.error('List files error:', err)
    res.status(500).json({ success: false, message: 'Failed to list files' })
  }
})

// GET /files/:id/download
router.get('/:id/download', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const file = await prisma.fileAttachment.findUnique({ where: { id: String(req.params.id) } })
    if (!file) { res.status(404).json({ success: false, message: 'File not found' }); return }

    const filePath = path.join(UPLOADS_DIR, file.filename)
    if (!fs.existsSync(filePath)) { res.status(404).json({ success: false, message: 'File missing on disk' }); return }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`)
    res.setHeader('Content-Type', file.mimeType)
    res.sendFile(filePath)
  } catch (err) {
    console.error('Download error:', err)
    res.status(500).json({ success: false, message: 'Download failed' })
  }
})

// GET /files/:id/view — serve inline for browser preview (images, PDFs)
router.get('/:id/view', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const file = await prisma.fileAttachment.findUnique({ where: { id: String(req.params.id) } })
    if (!file) { res.status(404).json({ success: false, message: 'File not found' }); return }

    const filePath = path.join(UPLOADS_DIR, file.filename)
    if (!fs.existsSync(filePath)) { res.status(404).json({ success: false, message: 'File missing on disk' }); return }

    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`)
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.sendFile(filePath)
  } catch (err) {
    console.error('View error:', err)
    res.status(500).json({ success: false, message: 'Preview failed' })
  }
})

// DELETE /files/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const file = await prisma.fileAttachment.findUnique({ where: { id: String(req.params.id) } })
    if (!file) { res.status(404).json({ success: false, message: 'File not found' }); return }

    const { role, userId } = req.user!
    const isOwner = file.uploadedBy === userId
    const isAdmin = ['admin', 'manager'].includes(role)
    if (!isOwner && !isAdmin) { res.status(403).json({ success: false, message: 'Forbidden' }); return }

    // delete from disk
    const filePath = path.join(UPLOADS_DIR, file.filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    await prisma.fileAttachment.delete({ where: { id: String(req.params.id) } })
    res.json({ success: true, message: 'Deleted' })
  } catch (err) {
    console.error('Delete file error:', err)
    res.status(500).json({ success: false, message: 'Delete failed' })
  }
})

// GET /files/grade-template/:courseId  — download CSV grade entry template
router.get('/grade-template/:courseId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const course: any = await prisma.course.findUnique({
      where: { id: String(req.params.courseId) },
      include: {
        gradeItems: { orderBy: { createdAt: 'asc' } },
        enrollments: {
          include: { student: { include: { user: { select: { displayName: true } } } } },
        },
      },
    })

    if (!course) { res.status(404).json({ success: false, message: 'Course not found' }); return }

    const headers: string[] = ['Student ID', 'Student Name', ...course.gradeItems.map((gi: any) => `${gi.name} (max ${gi.maxScore})`)]
    const rows: string[][] = course.enrollments.map((e: any) => [
      e.student.studentId,
      e.student.user.displayName,
      ...course.gradeItems.map(() => ''),
    ])

    const toRow = (r: string[]) => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    const csv = [headers, ...rows].map(toRow).join('\r\n')

    res.setHeader('Content-Disposition', `attachment; filename="grade-template-${course.code}.csv"`)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.send('﻿' + csv) // UTF-8 BOM for Excel compatibility
  } catch (err) {
    console.error('Grade template error:', err)
    res.status(500).json({ success: false, message: 'Failed to generate template' })
  }
})

// GET /files/grade-report/:courseId  — download CSV grade report
router.get('/grade-report/:courseId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const course: any = await prisma.course.findUnique({
      where: { id: String(req.params.courseId) },
      include: {
        gradeItems: { orderBy: { createdAt: 'asc' } },
        enrollments: {
          include: {
            student: {
              include: {
                user: { select: { displayName: true } },
                grades: { include: { gradeItem: true } },
              },
            },
          },
        },
      },
    })
    if (!course) { res.status(404).json({ success: false, message: 'Course not found' }); return }

    const headers: string[] = ['Student ID', 'Student Name', ...course.gradeItems.map((gi: any) => gi.name), 'Weighted Average', 'Grade']

    const rows: string[][] = course.enrollments.map((e: any) => {
      const gradeMap: Record<string, number> = {}
      e.student.grades.forEach((g: any) => { gradeMap[g.gradeItemId] = g.score })

      let weightedSum = 0; let totalWeight = 0
      course.gradeItems.forEach((gi: any) => {
        if (gradeMap[gi.id] !== undefined) {
          weightedSum += (gradeMap[gi.id] / gi.maxScore) * 100 * gi.weight
          totalWeight += gi.weight
        }
      })
      const avg = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0
      const grade = avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : avg >= 60 ? 'D' : 'F'

      return [
        e.student.studentId,
        e.student.user.displayName,
        ...course.gradeItems.map((gi: any) => gradeMap[gi.id]?.toString() ?? ''),
        avg.toFixed(1) + '%',
        grade,
      ]
    })

    const toRow = (r: string[]) => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    const csv = [headers, ...rows].map(toRow).join('\r\n')

    res.setHeader('Content-Disposition', `attachment; filename="grade-report-${course.code}.csv"`)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.send('﻿' + csv)
  } catch (err) {
    console.error('Grade report error:', err)
    res.status(500).json({ success: false, message: 'Failed to generate report' })
  }
})

// GET /files/invoice/:invoiceId  — download fee invoice as HTML
router.get('/invoice/:invoiceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoice: any = await prisma.feeInvoice.findUnique({
      where: { id: String(req.params.invoiceId) },
      include: { student: { include: { user: { select: { displayName: true, email: true } } } } },
    })
    if (!invoice) { res.status(404).json({ success: false, message: 'Invoice not found' }); return }

    const statusLabel = invoice.status === 'paid' ? 'PAID' : invoice.status === 'overdue' ? 'OVERDUE' : 'UNPAID'
    const statusColor = invoice.status === 'paid' ? '#52c41a' : invoice.status === 'overdue' ? '#ff4d4f' : '#fa8c16'

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Invoice ${invoice.invoiceNumber ?? invoice.id}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #165dff; padding-bottom: 20px; margin-bottom: 30px; }
  .logo { font-size: 22px; font-weight: bold; color: #165dff; }
  .logo small { display: block; font-size: 13px; font-weight: normal; color: #555; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { margin: 0; font-size: 28px; color: #165dff; }
  .status-badge { display: inline-block; padding: 4px 14px; border-radius: 4px; font-weight: bold; font-size: 14px; color: white; background: ${statusColor}; }
  .section { margin-bottom: 24px; }
  .section h3 { color: #165dff; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f5ff; color: #165dff; text-align: left; padding: 10px 12px; font-size: 13px; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
  .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #165dff; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">MOE SERPS<small>Ministry of Education, Brunei Darussalam</small></div>
  <div class="invoice-title">
    <h1>FEE INVOICE</h1>
    <div>${invoice.invoiceNumber ?? invoice.id}</div>
    <div style="margin-top:8px"><span class="status-badge">${statusLabel}</span></div>
  </div>
</div>

<div class="section">
  <h3>Student</h3>
  <table><tr><td><strong>${invoice.student.user.displayName}</strong></td><td>${invoice.student.studentId}</td></tr></table>
</div>

<div class="section">
  <h3>Invoice Details</h3>
  <table>
    <tr><th>Description</th><th>Semester</th><th>Due Date</th><th>Amount</th></tr>
    <tr>
      <td>${invoice.description ?? 'School Fee'}</td>
      <td>${invoice.semester ?? '—'}</td>
      <td>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : '—'}</td>
      <td>BND ${invoice.amount.toFixed(2)}</td>
    </tr>
    <tr class="total-row"><td colspan="3">Total</td><td>BND ${invoice.amount.toFixed(2)}</td></tr>
  </table>
</div>

${invoice.paidAt ? `<div class="section"><h3>Payment</h3><table><tr><td>Paid on</td><td>${new Date(invoice.paidAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr></table></div>` : ''}

<div class="footer">
  Generated by MOE SERPS — School Enterprise Resource Planning System<br>
  ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
</div>
<script>window.onload = () => window.print()</script>
</body></html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (err) {
    console.error('Invoice download error:', err)
    res.status(500).json({ success: false, message: 'Failed to generate invoice' })
  }
})

export default router
