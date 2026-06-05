import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { broadcast, getClients } from '../lib/sse'

// Re-export broadcast so existing route imports (`from './events'`) keep working.
export { broadcast }

const router = Router()

/**
 * GET /api/v1/events/stream?topics=dashboard,notifications&token=<jwt>
 * Server-Sent Events endpoint. Auth via query param token (browsers can't set
 * Authorization header for EventSource).
 */
router.get('/stream', (req: Request, res: Response) => {
  // Authenticate via query token
  const token = req.query.token as string
  if (!token) {
    res.status(401).json({ success: false, message: 'Missing token' })
    return
  }
  const secret = process.env.JWT_SECRET ?? 'dev-secret'
  try {
    jwt.verify(token, secret)
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' })
    return
  }

  const topics = ((req.query.topics as string) ?? 'dashboard').split(',').map(t => t.trim()).filter(Boolean)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ topics, ts: new Date().toISOString() })}\n\n`)

  // Register this client for each topic
  for (const topic of topics) {
    getClients(topic).add(res)
  }

  // Keepalive ping every 25 seconds
  const ping = setInterval(() => {
    try {
      res.write(`: ping\n\n`)
    } catch {
      clearInterval(ping)
    }
  }, 25000)

  req.on('close', () => {
    clearInterval(ping)
    for (const topic of topics) {
      getClients(topic).delete(res)
    }
  })
})

export default router
