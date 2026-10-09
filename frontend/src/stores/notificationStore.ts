import { create } from 'zustand';
import api from '../api/client';
import { connectSocket } from '../services/socket';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  isInitialized: boolean;
  fetchNotifications: (page?: number, append?: boolean) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  deleteNotifications: (ids: number[]) => Promise<void>;
  initSocket: (userId: number, onOrderStatusChanged?: (payload: any) => void) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  page: 1,
  totalPages: 1,
  isLoading: false,
  isInitialized: false,

  fetchNotifications: async (page = 1, append = false) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/notifications?page=${page}&limit=20`);
      const result = data.data;
      set((state) => ({
        notifications: append ? [...new Map([...state.notifications, ...result.notifications].map((n: Notification) => [n.id, n])).values()] : result.notifications,
        unreadCount: result.unreadCount,
        page: result.page,
        totalPages: result.totalPages,
      }));
    } catch (err) {
      console.error('[NotificationStore] Failed to fetch notifications:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      set((state) => {
        const notif = state.notifications.find((n) => n.id === id);
        if (notif && !notif.isRead) {
          return {
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, isRead: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        }
        return state;
      });
    } catch (err) {
      console.error('[NotificationStore] Failed to mark notification as read:', err);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error('[NotificationStore] Failed to mark all notifications as read:', err);
    }
  },

  deleteNotification: async (id: number) => {
    try {
      await api.delete(`/notifications/${id}`);
      set((state) => {
        const removed = state.notifications.find((n) => n.id === id);
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount: removed && !removed.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        };
      });
    } catch (err) {
      console.error('[NotificationStore] Failed to delete notification:', err);
      throw err;
    }
  },

  deleteNotifications: async (ids: number[]) => {
    const uniqueIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) return;

    try {
      await api.delete('/notifications', { data: { ids: uniqueIds } });
      const idSet = new Set(uniqueIds);
      set((state) => {
        const removedUnreadCount = state.notifications.filter((n) => idSet.has(n.id) && !n.isRead).length;
        return {
          notifications: state.notifications.filter((n) => !idSet.has(n.id)),
          unreadCount: Math.max(0, state.unreadCount - removedUnreadCount),
        };
      });
    } catch (err) {
      console.error('[NotificationStore] Failed to delete notifications:', err);
      throw err;
    }
  },

  initSocket: (_userId: number, onOrderStatusChanged?: (payload: any) => void) => {
    if (get().isInitialized) return;

    const socket = connectSocket();
    if (!socket) {
      console.warn('[NotificationStore] Socket unavailable, skipping listener setup.');
      return;
    }

    const handleNewNotification = (notification: Notification) => {
      set((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));
    };

    socket.off('new_notification', handleNewNotification);
    socket.on('new_notification', handleNewNotification);

    // Listen for order status changes in real-time
    if (onOrderStatusChanged) {
      socket.off('order-status-changed', onOrderStatusChanged);
      socket.on('order-status-changed', onOrderStatusChanged);
    }

    set({ isInitialized: true });
  },
}));
