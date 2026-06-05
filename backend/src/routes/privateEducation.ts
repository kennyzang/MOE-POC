import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { writeAudit } from '../lib/audit'

const router = Router()

// ────────────────────────────────────────────────────────────────────────────
// Private Education (DPE) Oversight
//
// Scope: PRIVATE schools only. The Dept of Private Education (DPE) officer
// role (`priv_ed_officer`) has read access to private-school operational
// data and write access to licensing, inspections, and compliance circulars.
//
// System admins also have full access.
//
// ITT mapping: SMS-DeptOfPrivateEducation-01 .. -09
// ────────────────────────────────────────────────────────────────────────────

const DPE_ROLES = ['admin', 'priv_ed_officer'] as const

function computeLicenseStatus(expiryDate: Date, currentStatus: string): string {
  // Don't recompute terminal states
  if (currentStatus === 'SUSPENDED' || currentStatus === 'REVOKED') return currentStatus

  const now = new Date()
  const msPerDay = 1000 * 60 * 60 * 24
  const daysToExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / msPerDay)

  if (daysToExpiry < 0) return 'EXPIRED'
  if (daysToExpiry <= 90) return 'EXPIRING_SOON'
  return 'ACTIVE'
}

// ─── Dashboard KPIs ────────────────────────────────────────────────────────

router.get('/dashboard', authenticate, requireRole(...DPE_ROLES), async (_req: AuthRequest, res: Response) => {
  try {
    const privateSchools = await prisma.school.findMany({
      where: { authority: 'PRIVATE' },
      include: { licenses: true, inspections: true, privEdProfile: true },
    })

    const now = new Date()
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

    let totalSchools = privateSchools.length
    let activeLicenses = 0
    let expiringSoon = 0
    let expired = 0
    let suspended = 0
    let overdueFollowUps = 0
    let openFindings = 0
    let totalStudentCapacity = 0

    const schoolsByDistrict: Record<string, number> = {}
    const schoolsByStatus: Record<string, number> = {
      ACTIVE: 0,
      EXPIRING_SOON: 0,
      EXPIRED: 0,
      SUSPENDED: 0,
      REVOKED: 0,
      UNLICENSED: 0,
    }

    for (const school of privateSchools) {
      totalStudentCapacity += school.privEdProfile?.studentCapacity ?? 0
      const district = school.privEdProfile?.district ?? 'Unknown'
      schoolsByDistrict[district] = (schoolsByDistrict[district] || 0) + 1

      const latestLicense = school.licenses
        .slice()
        .sort((a, b) => b.expiryDate.getTime() - a.expiryDate.getTime())[0]

      if (!latestLicense) {
        schoolsByStatus.UNLICENSED++
      } else {
        const computed = computeLicenseStatus(latestLicense.expiryDate, latestLicense.status)
        schoolsByStatus[computed] = (schoolsByStatus[computed] || 0) + 1
        if (computed === 'ACTIVE') activeLicenses++
        if (computed === 'EXPIRING_SOON') expiringSoon++
        if (computed === 'EXPIRED') expired++
        if (computed === 'SUSPENDED') suspended++
      }

      for (const insp of school.inspections) {
        if (!insp.resolved && insp.followUpDueDate && insp.followUpDueDate < now) {
          overdueFollowUps++
        }
        if (!insp.resolved) {
          try {
            const findings = JSON.parse(insp.findings || '[]') as Array<{ severity?: string }>
            openFindings += findings.length
          } catch { /* ignore malformed */ }
        }
      }
    }

    res.json({
      success: true,
      data: {
        kpis: {
          totalSchools,
          activeLicenses,
          expiringSoon,
          expired,
          suspended,
          overdueFollowUps,
          openFindings,
          totalStudentCapacity,
        },
        schoolsByStatus,
        schoolsByDistrict,
        snapshot: now.toISOString(),
        ninetyDayWindow: ninetyDays.toISOString(),
      },
    })
  } catch (err) {
    console.error('GET /private-ed/dashboard error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Schools list (with computed license badge) ────────────────────────────

router.get('/schools', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { district, status, search } = req.query as { district?: string; status?: string; search?: string }

    const schools = await prisma.school.findMany({
      where: { authority: 'PRIVATE' },
      include: {
        licenses: { orderBy: { expiryDate: 'desc' } },
        privEdProfile: true,
        inspections: { orderBy: { inspectionDate: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    })

    const rows = schools
      .map((s) => {
        const latestLicense = s.licenses[0]
        const computedStatus = latestLicense
          ? computeLicenseStatus(latestLicense.expiryDate, latestLicense.status)
          : 'UNLICENSED'

        return {
          id: s.id,
          name: s.name,
          code: s.code,
          schoolType: s.schoolType,
          district: s.privEdProfile?.district ?? null,
          curriculumModel: s.privEdProfile?.curriculumModel ?? null,
          studentCapacity: s.privEdProfile?.studentCapacity ?? 0,
          registrationNo: s.privEdProfile?.registrationNo ?? null,
          ownerOrganisation: s.privEdProfile?.ownerOrganisation ?? null,
          licenseStatus: computedStatus,
          licenseNumber: latestLicense?.licenseNumber ?? null,
          licenseExpiry: latestLicense?.expiryDate ?? null,
          lastInspectionDate: s.inspections[0]?.inspectionDate ?? null,
          lastInspectionRating: s.inspections[0]?.rating ?? null,
        }
      })
      .filter((r) => !district || r.district === district)
      .filter((r) => !status || r.licenseStatus === status)
      .filter((r) =>
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.registrationNo?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )

    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('GET /private-ed/schools error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Single school oversight detail ────────────────────────────────────────

router.get('/schools/:id', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const school = await prisma.school.findFirst({
      where: { id, authority: 'PRIVATE' },
      include: {
        privEdProfile: true,
        licenses: { orderBy: { expiryDate: 'desc' }, include: { renewals: { orderBy: { renewedAt: 'desc' } } } },
        inspections: { orderBy: { inspectionDate: 'desc' } },
        circularTargets: {
          include: { circular: true },
          orderBy: { circular: { effectiveDate: 'desc' } },
        },
      },
    })

    if (!school) {
      res.status(404).json({ success: false, message: 'Private school not found' })
      return
    }

    const [studentCount, teacherCount] = await Promise.all([
      prisma.student.count({ where: { schoolId: id, enrollmentStatus: 'enrolled' } }),
      prisma.teacher.count({ where: { schoolId: id } }),
    ])

    const licensesWithStatus = school.licenses.map((l) => ({
      ...l,
      authorisedLevels: JSON.parse(l.authorisedLevels || '[]'),
      computedStatus: computeLicenseStatus(l.expiryDate, l.status),
    }))

    const inspectionsParsed = school.inspections.map((i) => ({
      ...i,
      findings: JSON.parse(i.findings || '[]'),
    }))

    res.json({
      success: true,
      data: {
        id: school.id,
        name: school.name,
        code: school.code,
        schoolType: school.schoolType,
        address: school.address,
        phone: school.phone,
        principal: school.principal,
        establishedYear: school.establishedYear,
        profile: school.privEdProfile,
        licenses: licensesWithStatus,
        inspections: inspectionsParsed,
        circulars: school.circularTargets.map((ct) => ({
          targetId: ct.id,
          circularId: ct.circular.id,
          circularNumber: ct.circular.circularNumber,
          title: ct.circular.title,
          effectiveDate: ct.circular.effectiveDate,
          acknowledgementDueDate: ct.circular.acknowledgementDueDate,
          acknowledgedAt: ct.acknowledgedAt,
        })),
        counts: { studentCount, teacherCount },
      },
    })
  } catch (err) {
    console.error('GET /private-ed/schools/:id error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Licenses ──────────────────────────────────────────────────────────────

router.post('/licenses', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { schoolId, licenseNumber, issuedDate, expiryDate, authorisedLevels, conditions, documentPath } = req.body
    if (!schoolId || !licenseNumber || !issuedDate || !expiryDate) {
      res.status(400).json({ success: false, message: 'schoolId, licenseNumber, issuedDate, expiryDate required' })
      return
    }

    const license = await prisma.schoolLicense.create({
      data: {
        schoolId,
        licenseNumber,
        issuedDate: new Date(issuedDate),
        expiryDate: new Date(expiryDate),
        status: 'ACTIVE',
        authorisedLevels: JSON.stringify(authorisedLevels ?? []),
        conditions: conditions ?? null,
        documentPath: documentPath ?? null,
        issuedByUserId: req.user!.userId,
      },
    })

    await writeAudit({
      actorUserId: req.user!.userId,
      action: 'PRIV_ED_LICENSE_ISSUED',
      entityType: 'SchoolLicense',
      entityId: license.id,
      details: { schoolId, licenseNumber, expiryDate },
    })

    res.status(201).json({ success: true, data: license })
  } catch (err) {
    console.error('POST /private-ed/licenses error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.post('/licenses/:id/renew', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { newExpiryDate, notes } = req.body
    if (!newExpiryDate) {
      res.status(400).json({ success: false, message: 'newExpiryDate required' })
      return
    }

    const license = await prisma.schoolLicense.findUnique({ where: { id } })
    if (!license) { res.status(404).json({ success: false, message: 'License not found' }); return }

    const previousExpiry = license.expiryDate
    const newExp = new Date(newExpiryDate)

    const [updated, renewal] = await prisma.$transaction([
      prisma.schoolLicense.update({
        where: { id },
        data: { expiryDate: newExp, status: 'ACTIVE', updatedAt: new Date() },
      }),
      prisma.licenseRenewal.create({
        data: {
          licenseId: id,
          previousExpiry,
          newExpiry: newExp,
          renewedByUserId: req.user!.userId,
          notes: notes ?? null,
        },
      }),
    ])

    await writeAudit({
      actorUserId: req.user!.userId,
      action: 'PRIV_ED_LICENSE_RENEWED',
      entityType: 'SchoolLicense',
      entityId: id,
      details: { previousExpiry, newExpiry: newExp, renewalId: renewal.id },
    })

    res.json({ success: true, data: { license: updated, renewal } })
  } catch (err) {
    console.error('POST /private-ed/licenses/:id/renew error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.post('/licenses/:id/suspend', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { reason } = req.body

    const license = await prisma.schoolLicense.update({
      where: { id },
      data: { status: 'SUSPENDED', conditions: reason ?? null, updatedAt: new Date() },
    })

    await writeAudit({
      actorUserId: req.user!.userId,
      action: 'PRIV_ED_LICENSE_SUSPENDED',
      entityType: 'SchoolLicense',
      entityId: id,
      details: { reason },
    })

    res.json({ success: true, data: license })
  } catch (err) {
    console.error('POST /private-ed/licenses/:id/suspend error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Inspections ───────────────────────────────────────────────────────────

router.post('/inspections', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { schoolId, inspectionDate, inspectionType, rating, findings, followUpDueDate, notes, reportPath } = req.body
    if (!schoolId || !inspectionDate || !inspectionType) {
      res.status(400).json({ success: false, message: 'schoolId, inspectionDate, inspectionType required' })
      return
    }

    const inspection = await prisma.schoolInspection.create({
      data: {
        schoolId,
        inspectionDate: new Date(inspectionDate),
        inspectorUserId: req.user!.userId,
        inspectionType,
        rating: rating ?? null,
        findings: JSON.stringify(findings ?? []),
        followUpDueDate: followUpDueDate ? new Date(followUpDueDate) : null,
        notes: notes ?? null,
        reportPath: reportPath ?? null,
      },
    })

    await writeAudit({
      actorUserId: req.user!.userId,
      action: 'PRIV_ED_INSPECTION_RECORDED',
      entityType: 'SchoolInspection',
      entityId: inspection.id,
      details: { schoolId, inspectionType, rating },
    })

    res.status(201).json({ success: true, data: inspection })
  } catch (err) {
    console.error('POST /private-ed/inspections error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.post('/inspections/:id/resolve', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const { resolutionNotes } = req.body

    const updated = await prisma.schoolInspection.update({
      where: { id },
      data: { resolved: true, resolvedAt: new Date(), notes: resolutionNotes ?? null },
    })

    await writeAudit({
      actorUserId: req.user!.userId,
      action: 'PRIV_ED_INSPECTION_RESOLVED',
      entityType: 'SchoolInspection',
      entityId: id,
      details: { resolutionNotes },
    })

    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('POST /private-ed/inspections/:id/resolve error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Compliance Circulars ──────────────────────────────────────────────────

router.get('/circulars', authenticate, requireRole(...DPE_ROLES), async (_req: AuthRequest, res: Response) => {
  try {
    const circulars = await prisma.complianceCircular.findMany({
      orderBy: { effectiveDate: 'desc' },
      include: { targets: { include: { school: { select: { id: true, name: true, code: true } } } } },
    })

    const rows = circulars.map((c) => ({
      id: c.id,
      circularNumber: c.circularNumber,
      title: c.title,
      effectiveDate: c.effectiveDate,
      acknowledgementDueDate: c.acknowledgementDueDate,
      targetScope: c.targetScope,
      targetDistrict: c.targetDistrict,
      totalTargets: c.targets.length,
      acknowledged: c.targets.filter((t) => t.acknowledgedAt).length,
      pending: c.targets.filter((t) => !t.acknowledgedAt).length,
    }))

    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('GET /private-ed/circulars error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.get('/circulars/:id', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const circular = await prisma.complianceCircular.findUnique({
      where: { id },
      include: { targets: { include: { school: { select: { id: true, name: true, code: true } } } } },
    })
    if (!circular) { res.status(404).json({ success: false, message: 'Circular not found' }); return }
    res.json({ success: true, data: circular })
  } catch (err) {
    console.error('GET /private-ed/circulars/:id error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.post('/circulars', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const { circularNumber, title, bodyMarkdown, effectiveDate, acknowledgementDueDate, targetScope, targetDistrict, targetSchoolIds } = req.body
    if (!circularNumber || !title || !bodyMarkdown || !effectiveDate || !targetScope) {
      res.status(400).json({ success: false, message: 'circularNumber, title, bodyMarkdown, effectiveDate, targetScope required' })
      return
    }

    // Determine target schools
    let schools: { id: string }[] = []
    if (targetScope === 'ALL_PRIVATE') {
      schools = await prisma.school.findMany({ where: { authority: 'PRIVATE' }, select: { id: true } })
    } else if (targetScope === 'BY_DISTRICT' && targetDistrict) {
      const profiles = await prisma.privateSchoolProfile.findMany({
        where: { district: targetDistrict },
        select: { schoolId: true },
      })
      schools = profiles.map((p) => ({ id: p.schoolId }))
    } else if (targetScope === 'SPECIFIC' && Array.isArray(targetSchoolIds)) {
      schools = targetSchoolIds.map((id: string) => ({ id }))
    }

    const circular = await prisma.complianceCircular.create({
      data: {
        circularNumber,
        title,
        bodyMarkdown,
        effectiveDate: new Date(effectiveDate),
        acknowledgementDueDate: acknowledgementDueDate ? new Date(acknowledgementDueDate) : null,
        targetScope,
        targetDistrict: targetDistrict ?? null,
        issuedByUserId: req.user!.userId,
        targets: {
          create: schools.map((s) => ({ schoolId: s.id })),
        },
      },
      include: { targets: true },
    })

    await writeAudit({
      actorUserId: req.user!.userId,
      action: 'PRIV_ED_CIRCULAR_ISSUED',
      entityType: 'ComplianceCircular',
      entityId: circular.id,
      details: { circularNumber, targetScope, targetCount: schools.length },
    })

    res.status(201).json({ success: true, data: circular })
  } catch (err) {
    console.error('POST /private-ed/circulars error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── School Profile (DPE-managed metadata) ────────────────────────────────

router.patch('/schools/:id/profile', authenticate, requireRole(...DPE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params['id'] as string
    const data = req.body as Partial<{
      registrationNo: string
      ownerOrganisation: string
      ownerContactName: string
      ownerContactPhone: string
      ownerContactEmail: string
      district: string
      curriculumModel: string
      studentCapacity: number
      feeRangeBnd: string
      notes: string
    }>

    const existing = await prisma.privateSchoolProfile.findUnique({ where: { schoolId: id } })

    const profile = existing
      ? await prisma.privateSchoolProfile.update({ where: { schoolId: id }, data })
      : await prisma.privateSchoolProfile.create({
          data: {
            schoolId: id,
            registrationNo: data.registrationNo ?? `DPE/${new Date().getFullYear()}/${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
            ownerOrganisation: data.ownerOrganisation ?? 'Unknown',
            district: data.district ?? 'Brunei-Muara',
            curriculumModel: data.curriculumModel ?? 'National',
            studentCapacity: data.studentCapacity ?? 0,
            ownerContactName: data.ownerContactName ?? null,
            ownerContactPhone: data.ownerContactPhone ?? null,
            ownerContactEmail: data.ownerContactEmail ?? null,
            feeRangeBnd: data.feeRangeBnd ?? null,
            notes: data.notes ?? null,
          },
        })

    await writeAudit({
      actorUserId: req.user!.userId,
      action: existing ? 'PRIV_ED_PROFILE_UPDATED' : 'PRIV_ED_PROFILE_CREATED',
      entityType: 'PrivateSchoolProfile',
      entityId: profile.id,
      details: { schoolId: id },
    })

    res.json({ success: true, data: profile })
  } catch (err) {
    console.error('PATCH /private-ed/schools/:id/profile error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ─── Audit trail (DPE-scoped) ──────────────────────────────────────────────

router.get('/audit', authenticate, requireRole(...DPE_ROLES), async (_req: AuthRequest, res: Response) => {
  try {
    const events = await prisma.auditEvent.findMany({
      where: { action: { startsWith: 'PRIV_ED_' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    res.json({ success: true, data: events })
  } catch (err) {
    console.error('GET /private-ed/audit error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

export default router
