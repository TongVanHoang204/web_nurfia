import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bell, CheckCheck, Filter, Search } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore, type Notification } from '../../stores/notificationStore';
import { getNotificationIconConfig } from '../../components/Notifications';
import './NotificationsPage.css';

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

export default function NotificationsPage() {
  const { isAuthenticated, isHydrating, user } = useAuthStore();
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

  if (isHydrating) {
    return <div className="notifications-page-loader"><div className="spinner" /></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/notifications" replace />;
  }

  const hasMore = page < totalPages;
  const hasNotifications = notifications.length > 0;

  return (
    <div className="notifications-page">
      <div className="container notifications-container">
        <header className="notifications-page-header">
          <div>
            <h1>Notifications</h1>
            <p>Track order updates, payment events, promotions, and account messages.</p>
          </div>
          <button
            type="button"
            className="notifications-primary-action"
            onClick={markAllAsRead}
            disabled={!unreadCount || isLoading}
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        </header>

        <section className="notifications-toolbar" aria-label="Notification filters">
          <div className="notifications-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notifications"
              aria-label="Search notifications"
            />
          </div>

          <div className="notifications-filter-group">
            <Filter size={15} />
            {(['ALL', 'UNREAD', 'READ'] as NotificationFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'is-active' : ''}
                onClick={() => setFilter(item)}
              >
                {item === 'ALL' ? 'All' : item === 'UNREAD' ? `Unread (${unreadCount})` : 'Read'}
              </button>
            ))}
          </div>
        </section>

        <section className="notifications-list-panel">
          {!hasNotifications && isLoading ? (
            <div className="notifications-page-loader"><div className="spinner" /></div>
          ) : filteredNotifications.length === 0 ? (
            <div className="notifications-empty-panel">
              <Bell size={34} />
              <h2>{hasNotifications ? 'No matching notifications' : 'No notifications yet'}</h2>
              <p>{hasNotifications ? 'Try another search term or filter.' : 'New order and account updates will appear here.'}</p>
            </div>
          ) : (
            <div className="notifications-page-list">
              {filteredNotifications.map((notification) => {
                const { color } = getNotificationIconConfig(notification.type);
                const target = getNotificationTarget(notification);
                const content = (
                  <>
                    <div className="notifications-page-icon" style={{ background: `${color}18`, color }}>
                      <Bell size={17} />
                    </div>
                    <div className="notifications-page-copy">
                      <div className="notifications-page-item-head">
                        <strong>{notification.title}</strong>
                        {!notification.isRead && <span>Unread</span>}
                      </div>
                      <p>{notification.message}</p>
                      <small>{formatNotificationDate(notification.createdAt)}</small>
                    </div>
                  </>
                );

                if (target) {
                  return (
                    <Link
                      key={notification.id}
                      to={target}
                      className={`notifications-page-item${notification.isRead ? '' : ' is-unread'}`}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={`notifications-page-item${notification.isRead ? '' : ' is-unread'}`}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          )}

          {hasNotifications && (
            <footer className="notifications-page-footer">
              <span>
                Page {page} of {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => fetchNotifications(page + 1)}
                disabled={!hasMore || isLoading}
              >
                {isLoading ? 'Loading...' : hasMore ? 'Load more' : 'All caught up'}
              </button>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}
