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
  fetchNotifications: (page?: number) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  initSocket: (_userId: number) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  page: 1,
  totalPages: 1,
  isLoading: false,
  isInitialized: false,

  fetchNotifications: async (page = 1) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/notifications?page=${page}&limit=20`);
      const result = data.data;
      set((state) => ({
        notifications: page === 1 ? result.notifications : [...state.notifications, ...result.notifications],
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

  initSocket: (_userId: number) => {
    if (get().isInitialized) return;

    // connectSocket() ensures the socket is created AND connected
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

    // Avoid registering duplicate listeners across React strict-mode remounts
    socket.off('new_notification', handleNewNotification);
    socket.on('new_notification', handleNewNotification);

    set({ isInitialized: true });
  },
}));
