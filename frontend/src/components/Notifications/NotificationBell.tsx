import { translateUi } from '../../i18n';
import { useTranslation } from 'react-i18next';
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
  useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') { setIsOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [isOpen]);

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
      fetchNotifications(page + 1, true);
    }
  };

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      {/* Trigger button — reuses global .action-btn from Header.css */}
      {isOpen ? (
        <button
          className="action-btn notif-trigger-btn notification-btn"
          ref={triggerRef}
          onClick={() => setIsOpen(false)}
          aria-label={translateUi("Close notifications")}
          aria-haspopup="dialog"
          aria-expanded="true"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="notif-count" aria-label={translateUi("{{value1}} unread notifications", { value1: unreadCount })}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          className="action-btn notif-trigger-btn notification-btn"
          ref={triggerRef}
          onClick={() => setIsOpen(true)}
          aria-label={translateUi("Open notifications")}
          aria-haspopup="dialog"
          aria-expanded="false"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="notif-count" aria-label={translateUi("{{value1}} unread notifications", { value1: unreadCount })}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          page={page}
          totalPages={totalPages}
          isLoading={isLoading}
          viewAllLink={['OWNER', 'ADMIN', 'STAFF', 'MANAGER'].includes(user?.role || '') ? '/admin/notifications' : '/notifications'}
          onRead={markAsRead}
          onMarkAllRead={markAllAsRead}
          onLoadMore={handleLoadMore}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
