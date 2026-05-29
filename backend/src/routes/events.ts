import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

const router = Router()

// In-memory set of active SSE clients per topic
const clients = new Map<string, Set<Response>>()

function getClients(topic: string): Set<Response> {
  if (!clients.has(topic)) clients.set(topic, new Set())
  return clients.get(topic)!
}

/**
 * Broadcast a message to all clients subscribed to a topic.
 * Called from other routes after state changes.
 */
export function broadcast(topic: string, event: string, data: unknown) {
  const subs = clients.get(topic)
  if (!subs || subs.size === 0) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of subs) {
    try {
      res.write(payload)
    } catch {
      subs.delete(res)
    }
  }
}

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
