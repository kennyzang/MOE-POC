import { Router, type Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { authenticate, type AuthRequest } from '../middleware/auth'

const router = Router()

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ success: false, message: 'Username and password required' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { school: { select: { id: true, name: true, code: true, authority: true, schoolType: true, gradeLevels: true, programmes: true, classLetters: true } } },
  })
  if (!user || user.status !== 'active') {
    res.status(401).json({ success: false, message: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ success: false, message: 'Invalid credentials' })
    return
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    username: user.username,
    schoolId: user.schoolId,
    systemAdmin: user.systemAdmin,
  })

  // Parse school grade levels
  const school = user.school
    ? {
        ...user.school,
        gradeLevels: JSON.parse(user.school.gradeLevels) as string[],
        programmes: JSON.parse(user.school.programmes) as string[],
        classLetters: JSON.parse(user.school.classLetters) as string[],
      }
    : null

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      schoolId: user.schoolId,
      systemAdmin: user.systemAdmin,
      school,
    },
  })
})

// ─── Mock SSO Callbacks (SIM-IL) ─────────────────────────────────────────────
// These simulate the redirect-back from a government SSO provider.
// In production these would validate a real signed JWT from the IdP.

async function buildSsoResponse(username: string, provider: string, res: Response) {
  const user = await prisma.user.findFirst({
    where: { username, status: 'active' },
    include: {
      school: {
        select: { id: true, name: true, code: true, authority: true, schoolType: true, gradeLevels: true, programmes: true, classLetters: true },
      },
    },
  })

  if (!user) {
    res.status(404).json({ success: false, message: `Demo account '${username}' not found` })
    return
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    username: user.username,
    schoolId: user.schoolId,
    systemAdmin: user.systemAdmin,
  })

  const school = user.school
    ? {
        ...user.school,
        gradeLevels: JSON.parse(user.school.gradeLevels) as string[],
        programmes: JSON.parse(user.school.programmes) as string[],
        classLetters: JSON.parse(user.school.classLetters) as string[],
      }
    : null

  res.json({
    success: true,
    token,
    ssoProvider: provider,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      schoolId: user.schoolId,
      systemAdmin: user.systemAdmin,
      school,
    },
  })
}

// POST /auth/brunei-id/callback
// Body: { mockUsername: string }
router.post('/brunei-id/callback', async (req, res) => {
  const { mockUsername } = req.body
  if (!mockUsername) {
    res.status(400).json({ success: false, message: 'mockUsername required' })
    return
  }
  await buildSsoResponse(mockUsername, 'BRUNEI_ID', res)
})

// POST /auth/egnc-idpm/callback
// Body: { mockUsername: string }
router.post('/egnc-idpm/callback', async (req, res) => {
  const { mockUsername } = req.body
  if (!mockUsername) {
    res.status(400).json({ success: false, message: 'mockUsername required' })
    return
  }
  await buildSsoResponse(mockUsername, 'EGNC_IDPM', res)
})

// GET /auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      avatar: true,
      schoolId: true,
      systemAdmin: true,
      school: { select: { id: true, name: true, code: true, authority: true, schoolType: true, gradeLevels: true, programmes: true, classLetters: true } },
    },
  })
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' })
    return
  }

  const school = user.school
    ? {
        ...user.school,
        gradeLevels: JSON.parse(user.school.gradeLevels) as string[],
        programmes: JSON.parse(user.school.programmes) as string[],
        classLetters: JSON.parse(user.school.classLetters) as string[],
      }
    : null

  res.json({ success: true, user: { ...user, school } })
})

export default router
