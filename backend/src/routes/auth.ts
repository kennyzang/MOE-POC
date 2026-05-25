import { Router } from 'express'
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

  const user = await prisma.user.findUnique({ where: { username } })
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
  })

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
    },
  })
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
    },
  })
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' })
    return
  }
  res.json({ success: true, user })
})

export default router
