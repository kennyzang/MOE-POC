import webpush from 'web-push'
import prisma from '../lib/prisma'

let _vapidKeysReady = false

/**
 * Lazily initialise VAPID keys: load from SystemConfig or generate once and persist.
 */
async function ensureVapidKeys(): Promise<void> {
  if (_vapidKeysReady) return

  let pubRow = await prisma.systemConfig.findUnique({ where: { key: 'VAPID_PUBLIC_KEY' } })
  let priRow = await prisma.systemConfig.findUnique({ where: { key: 'VAPID_PRIVATE_KEY' } })

  if (!pubRow || !priRow) {
    const keys = webpush.generateVAPIDKeys()
    pubRow = await prisma.systemConfig.upsert({
      where: { key: 'VAPID_PUBLIC_KEY' },
      create: { key: 'VAPID_PUBLIC_KEY', value: keys.publicKey, description: 'VAPID public key for Web Push' },
      update: { value: keys.publicKey },
    })
    priRow = await prisma.systemConfig.upsert({
      where: { key: 'VAPID_PRIVATE_KEY' },
      create: { key: 'VAPID_PRIVATE_KEY', value: keys.privateKey, description: 'VAPID private key for Web Push' },
      update: { value: keys.privateKey },
    })
    console.log('[Push] Generated new VAPID keypair and stored in SystemConfig')
  }

  webpush.setVapidDetails(
    'mailto:admin@moe.edu.bn',
    pubRow.value,
    priRow.value
  )
  _vapidKeysReady = true
}

export async function getVapidPublicKey(): Promise<string> {
  await ensureVapidKeys()
  const row = await prisma.systemConfig.findUnique({ where: { key: 'VAPID_PUBLIC_KEY' } })
  return row!.value
}

/**
 * Save or update a push subscription for a user.
 */
export async function saveSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  await ensureVapidKeys()
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  })
}

/**
 * Remove a push subscription by endpoint.
 */
export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
}

/**
 * Send a push notification to all subscriptions for a given user.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; icon?: string; url?: string }
): Promise<void> {
  await ensureVapidKeys()
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subscriptions.length === 0) return

  const payloadStr = JSON.stringify(payload)
  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      )
    )
  )

  // Clean up expired/invalid subscriptions
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { endpoint: subscriptions[i].endpoint } })
      }
    }
  }
}

/**
 * Send push notifications to all parents of a student.
 */
export async function sendPushToParentsOfStudent(
  studentId: string,
  payload: { title: string; body: string; icon?: string; url?: string }
): Promise<void> {
  const parentLinks = await prisma.parentStudent.findMany({
    where: { studentId },
    include: { parent: { include: { user: true } } },
  })

  await Promise.allSettled(
    parentLinks.map(link => sendPushToUser(link.parent.userId, payload))
  )
}
