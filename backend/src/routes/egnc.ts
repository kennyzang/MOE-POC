import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'
import { DEMO_CONFIG } from '../config/demo'

const router = Router()

// ─── Static system definitions ────────────────────────────────────────────────

const SYSTEMS = [
  {
    key: 'BRUNEI_ID',
    name: 'Brunei Digital ID',
    description: 'National digital identity verification for students and staff aged 12+',
    endpoint: '/api/brunei-id/verify-citizen',
    icon: 'shield',
    uptime: 99.97,
  },
  {
    key: 'EGNC',
    name: 'EGNC / IDPM',
    description: 'Government identity provider and staff records management (EGNC SSO)',
    endpoint: '/api/egnc/sync-staff-records',
    icon: 'building',
    uptime: 99.85,
  },
  {
    key: 'NIH',
    name: 'NIH Data Hub',
    description: 'National Information Hub — inter-agency data exchange over TLS 1.3 / OAuth 2.0',
    endpoint: '/api/nih/push-attendance-stats',
    icon: 'database',
    uptime: 99.91,
  },
  {
    key: 'SSM',
    name: 'SSM (HR System)',
    description: 'Bidirectional leave balance and staff profile sync with the civil service HR system',
    endpoint: '/api/ssm/sync-leave-balances',
    icon: 'users',
    uptime: 99.78,
  },
  {
    key: 'KOHA',
    name: 'KOHA Library System',
    description: 'National library catalogue synchronisation via Z39.50 protocol',
    endpoint: '/api/koha/z3950/sync-catalogue',
    icon: 'book',
    uptime: 98.64,
  },
]

// ─── GET /egnc/services ───────────────────────────────────────────────────────

router.get(
  '/services',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (_req: AuthRequest, res: Response) => {
    try {
      // Pull last sync time for each system from IntegrationLog
      const latestLogs = await Promise.all(
        SYSTEMS.map(s =>
          prisma.integrationLog.findFirst({
            where: { system: s.key },
            orderBy: { createdAt: 'desc' },
          })
        )
      )

      const data = SYSTEMS.map((sys, i) => ({
        key: sys.key,
        name: sys.name,
        description: sys.description,
        endpoint: sys.endpoint,
        icon: sys.icon,
        status: 'connected' as const,
        uptimePercent: sys.uptime,
        lastSyncAt: latestLogs[i]?.createdAt ?? null,
      }))

      res.json({ success: true, data })
    } catch (error) {
      console.error('Error fetching EGNC services:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── GET /egnc/logs ───────────────────────────────────────────────────────────

router.get(
  '/logs',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const logs = await prisma.integrationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      res.json({ success: true, data: logs })
    } catch (error) {
      console.error('Error fetching integration logs:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

// ─── POST /egnc/:system/sync ──────────────────────────────────────────────────

router.post(
  '/:system/sync',
  authenticate,
  requireRole('admin', 'manager', 'principal'),
  async (req: AuthRequest, res: Response) => {
    const system = req.params.system as string
    const validSystem = SYSTEMS.find(s => s.key === system.toUpperCase())
    if (!validSystem) {
      res.status(400).json({ success: false, message: `Unknown system: ${system}` })
      return
    }

    // Simulate integration delay
    await new Promise(resolve => setTimeout(resolve, DEMO_CONFIG.integrationSyncDelayMs))

    // Fabricate plausible sync results per system
    const syncResults: Record<string, object> = {
      BRUNEI_ID: { verified: 3456, newLinks: 12, expired: 3, timestamp: new Date().toISOString() },
      EGNC: { staffSynced: 48, updatedProfiles: 7, errors: 0, timestamp: new Date().toISOString() },
      NIH: { attendanceRecordsPushed: 3201, schoolId: req.user!.schoolId, timestamp: new Date().toISOString() },
      SSM: { leaveBalancesSynced: 48, pendingRequests: 2, timestamp: new Date().toISOString() },
      KOHA: { catalogueItems: 2847, newTitles: 34, updatedHoldings: 120, timestamp: new Date().toISOString() },
    }

    const payloadSize = 1000 + Math.floor(Math.random() * 49000)
    const log = await prisma.integrationLog.create({
      data: {
        system: validSystem.key,
        endpoint: validSystem.endpoint,
        payloadSize,
        status: 'success',
        triggeredBy: req.user!.userId,
      },
    })

    res.json({
      success: true,
      data: {
        logId: log.id,
        system: validSystem.key,
        systemName: validSystem.name,
        syncedAt: log.createdAt,
        result: syncResults[validSystem.key] ?? {},
      },
    })
  }
)

export default router
