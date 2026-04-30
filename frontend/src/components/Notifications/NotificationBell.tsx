import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuthStore } from '../../stores/authStore';
import { NotificationDropdown } from './NotificationDropdown';
import './notifications.css';

/**
 * Smart container: owns open/close state and wires store actions to
 * the dumb <NotificationDropdown />. Drop this anywhere in the UI.
 */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { isAuthenticated, user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    page,
    totalPages,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    initSocket,
  } = useNotificationStore();

  // Fetch + connect socket on auth
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchNotifications();
      initSocket(user.id);
    }
  }, [isAuthenticated, user, fetchNotifications, initSocket]);

  // Click-outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isAuthenticated) return null;

  const handleLoadMore = () => {
    if (page < totalPages && !isLoading) {
      fetchNotifications(page + 1);
    }
  };

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      {/* Trigger button — reuses global .action-btn from Header.css */}
      <button
        className="action-btn notif-trigger-btn notification-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open notifications"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="cart-count" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          page={page}
          totalPages={totalPages}
          isLoading={isLoading}
          onRead={markAsRead}
          onMarkAllRead={markAllAsRead}
          onLoadMore={handleLoadMore}
        />
      )}
    </div>
  );
}
