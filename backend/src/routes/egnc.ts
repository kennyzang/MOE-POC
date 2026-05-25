import { Router, Response } from 'express'
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth'

const router = Router()

const MOCK_SERVICES = [
  {
    name: 'Student Registry Sync',
    status: 'connected',
    lastSync: '2026-05-25T06:00:00Z',
    description: 'Synchronize student records with national registry',
  },
  {
    name: 'Teacher Certification Verification',
    status: 'connected',
    lastSync: '2026-05-24T12:00:00Z',
    description: 'Verify teacher qualifications against MOE database',
  },
  {
    name: 'Curriculum Standards API',
    status: 'connected',
    lastSync: '2026-05-23T00:00:00Z',
    description: 'Access national curriculum framework and standards',
  },
  {
    name: 'National Assessment Portal',
    status: 'disconnected',
    lastSync: null,
    description: 'Submit and retrieve national examination results',
  },
  {
    name: 'School Infrastructure Database',
    status: 'maintenance',
    lastSync: '2026-05-20T18:00:00Z',
    description: 'Report facility conditions and maintenance requests',
  },
]

// GET /egnc/services — return mock government service integrations
router.get(
  '/services',
  authenticate,
  requireRole('admin', 'manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true, data: MOCK_SERVICES })
    } catch (error) {
      console.error('Error fetching EGNC services:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
)

export default router
