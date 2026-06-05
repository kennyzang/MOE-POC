import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'

export interface AuthRequest extends Request {
  user?: {
    userId: string
    role: string
    username: string
    schoolId: string | null
    systemAdmin: boolean
  }
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' })
    return
  }
  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

export const requireRole =
  (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden' })
      return
    }
    next()
  }

/** Returns a Prisma where-clause fragment scoping to the user's school.
 *  System admins (schoolId=null, systemAdmin=true) see all schools. */
export function schoolFilter(req: AuthRequest): { schoolId?: string } {
  if (req.user?.systemAdmin || !req.user?.schoolId) return {}
  return { schoolId: req.user.schoolId }
}
