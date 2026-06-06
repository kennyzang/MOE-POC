import { create } from 'zustand'
import api from '@/lib/api'
import type { Notification, ApiResponse } from '@/types'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  startPolling: () => () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get<ApiResponse<Notification[]>>('/notifications')
      set({ notifications: data.data ?? [], loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get<{ count: number }>('/notifications/unread-count')
      set({ unreadCount: data.count })
    } catch {
      // silently fail for polling
    }
  },

  markAsRead: async (id: string) => {
    const prev = get()
    set({
      notifications: prev.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    })
    try {
      await api.patch(`/notifications/${id}/read`)
    } catch {
      // revert on failure
      set({ notifications: prev.notifications, unreadCount: prev.unreadCount })
    }
  },

  markAllAsRead: async () => {
    const prev = get()
    set({
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    })
    try {
      await api.patch('/notifications/read-all')
    } catch {
      set({ notifications: prev.notifications, unreadCount: prev.unreadCount })
    }
  },

  startPolling: () => {
    get().fetchUnreadCount()
    const interval = setInterval(() => get().fetchUnreadCount(), 30_000)
    return () => clearInterval(interval)
  },
}))
