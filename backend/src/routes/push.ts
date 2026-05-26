import { Router, Response } from 'express'
import { authenticate, type AuthRequest } from '../middleware/auth'
import {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushToUser,
} from '../services/pushService'

const router = Router()

// GET /vapid-key — public VAPID key for the client to subscribe
router.get('/vapid-key', async (_req, res: Response) => {
  try {
    const publicKey = await getVapidPublicKey()
    res.json({ success: true, data: { publicKey } })
  } catch (err) {
    console.error('GET /push/vapid-key error:', err)
    res.status(500).json({ success: false, message: 'Failed to fetch VAPID key' })
  }
})

// POST /subscribe — save a push subscription for the authenticated user
router.post('/subscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint, keys } = req.body as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ success: false, message: 'Invalid subscription object' })
      return
    }
    await saveSubscription(req.user!.userId, { endpoint, keys })
    res.status(201).json({ success: true, message: 'Subscribed' })
  } catch (err) {
    console.error('POST /push/subscribe error:', err)
    res.status(500).json({ success: false, message: 'Failed to save subscription' })
  }
})

// DELETE /unsubscribe — remove a push subscription
router.delete('/unsubscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body as { endpoint: string }
    if (!endpoint) {
      res.status(400).json({ success: false, message: 'Missing endpoint' })
      return
    }
    await removeSubscription(endpoint)
    res.json({ success: true, message: 'Unsubscribed' })
  } catch (err) {
    console.error('DELETE /push/unsubscribe error:', err)
    res.status(500).json({ success: false, message: 'Failed to remove subscription' })
  }
})

// POST /send-test — send a test push to the authenticated user (demo helper)
router.post('/send-test', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await sendPushToUser(req.user!.userId, {
      title: 'MOE SERPS',
      body: 'Push notifications are working! 🎉',
      url: '/',
    })
    res.json({ success: true, message: 'Test push sent' })
  } catch (err) {
    console.error('POST /push/send-test error:', err)
    res.status(500).json({ success: false, message: 'Failed to send test push' })
  }
})

export default router
