import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

const CONDITIONS = ['Good', 'Fair', 'Poor', 'Condemned']
const MAINTENANCE_TYPES = ['Repair', 'Service', 'Inspection', 'Disposal']

/** Generate assetTag: first 3 chars of category name (uppercase) + year + 4-digit seq */
async function generateAssetTag(categoryName: string): Promise<string> {
  const prefix = categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X')
  const year = new Date().getFullYear()
  const count = await prisma.asset.count()
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`
}

// ─── Categories ───────────────────────────────────────────────────────────────

router.get('/categories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user!.schoolId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (schoolId) where.schoolId = schoolId

    const categories = await prisma.assetCategory.findMany({
      where,
      include: { _count: { select: { assets: true } } },
      orderBy: { name: 'asc' },
    })

    const data = categories.map(c => ({ ...c, assetCount: c._count.assets }))
    res.json({ success: true, data })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.post('/categories', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body
    const schoolId = req.user!.schoolId ?? req.body.schoolId

    const category = await prisma.assetCategory.create({
      data: { name, description, schoolId },
    })
    res.status(201).json({ success: true, data: category })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Category name already exists' })
    } else {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
})

router.put('/categories/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const existing = await prisma.assetCategory.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Category not found' }); return }

    const { name, description } = req.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description

    const updated = await prisma.assetCategory.update({ where: { id }, data })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.delete('/categories/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const existing = await prisma.assetCategory.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Category not found' }); return }

    const assetCount = await prisma.asset.count({ where: { categoryId: id } })
    if (assetCount > 0) {
      res.status(409).json({ success: false, message: `Cannot delete: ${assetCount} asset(s) in this category` })
      return
    }

    await prisma.assetCategory.delete({ where: { id } })
    res.json({ success: true, message: 'Category deleted' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Assets ───────────────────────────────────────────────────────────────────

router.get('/assets', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId, condition, location, search } = req.query as Record<string, string | undefined>
    const schoolId = req.user!.schoolId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (schoolId) where.schoolId = schoolId
    if (categoryId) where.categoryId = categoryId
    if (condition) where.condition = condition
    if (location) where.location = { contains: location }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { assetTag: { contains: search } },
      ]
    }

    const assets = await prisma.asset.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const data = assets.map(a => ({ ...a, categoryName: a.category.name }))
    res.json({ success: true, data })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.get('/assets/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        maintenanceLogs: { orderBy: { date: 'desc' } },
      },
    })
    if (!asset) { res.status(404).json({ success: false, message: 'Asset not found' }); return }
    res.json({ success: true, data: { ...asset, categoryName: asset.category.name } })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.post('/assets', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { assetTag, name, categoryId, location, condition, purchaseDate, value, notes } = req.body
    const schoolId = req.user!.schoolId ?? req.body.schoolId

    const category = await prisma.assetCategory.findUnique({ where: { id: categoryId } })
    if (!category) { res.status(404).json({ success: false, message: 'Category not found' }); return }

    const tag = assetTag?.trim() || await generateAssetTag(category.name)

    const asset = await prisma.asset.create({
      data: {
        assetTag: tag,
        name,
        categoryId,
        schoolId,
        location,
        condition: condition ?? 'Good',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        value: value ? parseFloat(value) : undefined,
        notes,
      },
    })
    res.status(201).json({ success: true, data: asset })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Asset tag already exists' })
    } else {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
})

router.put('/assets/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const existing = await prisma.asset.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Asset not found' }); return }

    const { assetTag, name, categoryId, location, condition, purchaseDate, value, notes } = req.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (assetTag !== undefined) data.assetTag = assetTag
    if (name !== undefined) data.name = name
    if (categoryId !== undefined) data.categoryId = categoryId
    if (location !== undefined) data.location = location
    if (condition !== undefined) {
      if (!CONDITIONS.includes(condition)) {
        res.status(400).json({ success: false, message: `condition must be one of: ${CONDITIONS.join(', ')}` })
        return
      }
      data.condition = condition
    }
    if (purchaseDate !== undefined) data.purchaseDate = purchaseDate ? new Date(purchaseDate) : null
    if (value !== undefined) data.value = value !== null ? parseFloat(value) : null
    if (notes !== undefined) data.notes = notes

    const updated = await prisma.asset.update({ where: { id }, data })
    res.json({ success: true, data: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.delete('/assets/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const existing = await prisma.asset.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Asset not found' }); return }

    await prisma.assetMaintenanceLog.deleteMany({ where: { assetId: id } })
    await prisma.asset.delete({ where: { id } })
    res.json({ success: true, message: 'Asset deleted' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Maintenance Logs ─────────────────────────────────────────────────────────

router.post('/assets/:id/maintenance', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const assetId = req.params['id'] as string
    const asset = await prisma.asset.findUnique({ where: { id: assetId } })
    if (!asset) { res.status(404).json({ success: false, message: 'Asset not found' }); return }

    const { date, type, cost, conductedBy, notes } = req.body
    if (!MAINTENANCE_TYPES.includes(type)) {
      res.status(400).json({ success: false, message: `type must be one of: ${MAINTENANCE_TYPES.join(', ')}` })
      return
    }

    const log = await prisma.assetMaintenanceLog.create({
      data: {
        assetId,
        date: new Date(date),
        type,
        cost: cost ? parseFloat(cost) : undefined,
        conductedBy,
        notes,
      },
    })

    // Disposal → mark asset as Condemned
    if (type === 'Disposal' && asset.condition !== 'Condemned') {
      await prisma.asset.update({ where: { id: assetId }, data: { condition: 'Condemned' } })
    }

    res.status(201).json({ success: true, data: log })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.delete('/maintenance/:id', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const existing = await prisma.assetMaintenanceLog.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ success: false, message: 'Maintenance log not found' }); return }

    await prisma.assetMaintenanceLog.delete({ where: { id } })
    res.json({ success: true, message: 'Maintenance log deleted' })
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
