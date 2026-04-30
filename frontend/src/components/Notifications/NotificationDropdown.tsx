import { CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Notification } from '../../stores/notificationStore';
import { NotificationItem } from './NotificationItem';
import { NotificationEmpty } from './NotificationEmpty';

interface NotificationDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  viewAllLink?: string;
  onRead: (id: number) => void;
  onMarkAllRead: () => void;
  onLoadMore: () => void;
}

/**
 * Pure presentational dropdown — owns no state or side-effects.
 * Can be mounted anywhere: header, mobile sidebar, admin panel, etc.
 */
export function NotificationDropdown({
  notifications,
  unreadCount,
  page,
  totalPages,
  isLoading,
  viewAllLink = '/notifications',
  onRead,
  onMarkAllRead,
  onLoadMore,
}: NotificationDropdownProps) {
  return (
    <div className="notif-dropdown" role="dialog" aria-label="Notifications">
      {/* Header */}
      <div className="notif-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 className="notif-header-title">Notifications</h3>
          {unreadCount > 0 && (
            <span className="notif-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            className="notif-mark-all-btn"
            onClick={onMarkAllRead}
            aria-label="Mark all as read"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="notif-list">
        {notifications.length === 0 ? (
          <NotificationEmpty />
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={onRead} />
          ))
        )}
      </div>

      {/* Load more footer */}
      {notifications.length > 0 && (
        <div className="notif-footer">
          <Link to={viewAllLink} className="notif-view-all-link">
            View all notifications
          </Link>
          <button
            className="notif-load-more-btn"
            onClick={onLoadMore}
            disabled={isLoading || page >= totalPages}
          >
            {isLoading
              ? 'Loading...'
              : page >= totalPages
              ? 'All caught up'
              : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
