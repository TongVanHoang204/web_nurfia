import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Search, Inbox } from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { useNotificationStore, type Notification } from '../../../stores/notificationStore';
import { getNotificationIconConfig } from '../../../components/Notifications';
import './AdminNotifications.css';

type NotificationFilter = 'ALL' | 'UNREAD' | 'READ';

const formatNotificationDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getNotificationTarget = (notification: Notification) => {
  const link = String(notification.link || '').trim();
  if (!link) return '';
  if (link.startsWith('http://') || link.startsWith('https://')) return '';
  
  const adminOrderMatch = link.match(/^\/admin\/orders\/(\d+)$/);
  if (adminOrderMatch) {
    return `/admin/orders?orderId=${adminOrderMatch[1]}`;
  }

  return link.startsWith('/') ? link : `/${link}`;
};

export default function AdminNotifications() {
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

  const [filter, setFilter] = useState<NotificationFilter>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    fetchNotifications(1);
    initSocket(user.id);
  }, [fetchNotifications, initSocket, isAuthenticated, user]);

  const filteredNotifications = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return notifications.filter((notification) => {
      if (filter === 'UNREAD' && notification.isRead) return false;
      if (filter === 'READ' && !notification.isRead) return false;
      if (!keyword) return true;

      return [
        notification.title,
        notification.message,
        notification.type,
      ].some((value) => String(value || '').toLowerCase().includes(keyword));
    });
  }, [filter, notifications, search]);

  const hasMore = page < totalPages;
  const hasNotifications = notifications.length > 0;

  return (
    <div className="admin-notifications-page">
      <header className="admin-notifications-header">
        <div>
          <h1>System Alerts</h1>
          <p>Manage your notifications, order updates, and system alerts.</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={markAllAsRead}
            disabled={isLoading}
          >
            <CheckCheck size={14} style={{ marginRight: '8px' }} />
            Mark all as read
          </button>
        )}
      </header>

      <div className="admin-notifications-toolbar">
        <div className="admin-notifications-filters">
          <button 
            className={`admin-filter-tab ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            All Notifications
          </button>
          <button 
            className={`admin-filter-tab ${filter === 'UNREAD' ? 'active' : ''}`}
            onClick={() => setFilter('UNREAD')}
          >
            Unread ({unreadCount})
          </button>
          <button 
            className={`admin-filter-tab ${filter === 'READ' ? 'active' : ''}`}
            onClick={() => setFilter('READ')}
          >
            Read
          </button>
        </div>

        <div className="admin-notifications-search">
          <Search size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts..."
            title="Search alerts"
          />
        </div>
      </div>

      <div className="admin-notifications-content">
        {!hasNotifications && isLoading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : filteredNotifications.length === 0 ? (
          <div className="admin-empty-notifications">
            <Inbox size={48} strokeWidth={1} color="var(--color-text-muted)" />
            <h3>No notifications found</h3>
            <p>You're all caught up! New alerts will appear here.</p>
          </div>
        ) : (
          <div className="admin-notifications-list">
            {filteredNotifications.map((notification) => {
              const { color } = getNotificationIconConfig(notification.type);
              const target = getNotificationTarget(notification);
              const isUnread = !notification.isRead;
              
              const itemContent = (
                <>
                  <div className="admin-notifications-icon-wrap" style={{ color }}>
                    <Bell size={20} strokeWidth={1.5} />
                  </div>
                  <div className="admin-notifications-copy">
                    <div className="admin-notifications-item-meta">
                      <strong>{notification.title}</strong>
                      <span className="admin-notifications-time">
                        {formatNotificationDate(notification.createdAt)}
                      </span>
                    </div>
                    <p>{notification.message}</p>
                    {isUnread && <div className="admin-notifications-unread-dot" />}
                  </div>
                </>
              );

              const itemClass = `admin-notifications-item ${isUnread ? 'is-unread' : ''}`;

              if (target) {
                return (
                  <Link
                    key={notification.id}
                    to={target}
                    className={itemClass}
                    onClick={() => isUnread && markAsRead(notification.id)}
                  >
                    {itemContent}
                  </Link>
                );
              }

              return (
                <button
                  key={notification.id}
                  type="button"
                  className={itemClass}
                  onClick={() => isUnread && markAsRead(notification.id)}
                >
                  {itemContent}
                </button>
              );
            })}
          </div>
        )}

        {hasNotifications && hasMore && (
          <div className="admin-notifications-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fetchNotifications(page + 1)}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load Older Notifications'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
