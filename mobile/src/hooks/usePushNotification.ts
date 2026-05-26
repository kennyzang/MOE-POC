import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

interface UsePushNotificationReturn {
  permission: PermissionState
  isSubscribed: boolean
  isLoading: boolean
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
  sendTest: () => Promise<void>
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

export function usePushNotification(): UsePushNotificationReturn {
  const [permission, setPermission] = useState<PermissionState>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check current state on mount
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported')
      return
    }

    setPermission(Notification.permission as PermissionState)

    // Check if already subscribed
    navigator.serviceWorker.ready.then(registration => {
      registration.pushManager.getSubscription().then(sub => {
        setIsSubscribed(!!sub)
      })
    }).catch(() => {
      // Service worker not ready yet
    })
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false
    }

    setIsLoading(true)
    try {
      // Request permission
      const perm = await Notification.requestPermission()
      setPermission(perm as PermissionState)
      if (perm !== 'granted') return false

      // Fetch VAPID public key
      const { data: keyData } = await api.get<{ success: boolean; data: { publicKey: string } }>('/push/vapid-key')
      const vapidKey = keyData.data.publicKey

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const subJson = subscription.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      // Send subscription to backend
      await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      })

      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('[Push] Subscribe error:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await api.delete('/push/unsubscribe', { data: { endpoint: subscription.endpoint } })
        await subscription.unsubscribe()
        setIsSubscribed(false)
      }
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const sendTest = useCallback(async (): Promise<void> => {
    try {
      await api.post('/push/send-test', {})
    } catch (err) {
      console.error('[Push] Send test error:', err)
    }
  }, [])

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe, sendTest }
}
