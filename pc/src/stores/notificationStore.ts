import { create } from 'zustand'
import api from '@/lib/api'

interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  startPolling: () => () => void
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true })
    try {
      const res = await api.get<{ success: boolean; data: Notification[] }>('/notifications')
      set({ notifications: res.data.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await api.get<{ success: boolean; data: { count: number } }>(
        '/notifications/unread-count',
      )
      set({ unreadCount: res.data.data.count })
    } catch {
      // silently ignore polling errors
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      set(state => ({
        notifications: state.notifications.map(n => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch {
      // ignore
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/notifications/read-all')
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      }))
    } catch {
      // ignore
    }
  },

  startPolling: () => {
    const { fetchUnreadCount } = get()
    fetchUnreadCount()
    const intervalId = setInterval(fetchUnreadCount, 30_000)
    return () => clearInterval(intervalId)
  },
}))
