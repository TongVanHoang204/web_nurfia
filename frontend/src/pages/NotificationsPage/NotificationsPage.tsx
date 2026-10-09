import { notificationDestination } from '../../utils/notificationDestination';
import { translateUi, getLocale } from '../../i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bell, CheckCheck, Filter, Search } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore, } from '../../stores/notificationStore';
import { getNotificationIconConfig } from '../../components/Notifications';
import './NotificationsPage.css';

type NotificationFilter = 'ALL' | 'UNREAD' | 'READ';

const formatNotificationDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(getLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};


export default function NotificationsPage() {
  useTranslation();
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
            <h1>{translateUi("Notifications")}</h1>
            <p>{translateUi("Track order updates, payment events, promotions, and account messages.")}</p>
          </div>
          <button
            type="button"
            className="notifications-primary-action"
            onClick={markAllAsRead}
            disabled={!unreadCount || isLoading}
          >
            <CheckCheck size={16} />{translateUi("Mark all read")}</button>
        </header>

        <section className="notifications-toolbar" aria-label={translateUi("Notification filters")}>
          <div className="notifications-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={translateUi("Search notifications")}
              aria-label={translateUi("Search notifications")}
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
                {item === 'ALL' ? translateUi("All") : item === 'UNREAD' ? translateUi("Unread ({{value1}})", { value1: unreadCount }) : translateUi("Read")}
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
              <h2>{hasNotifications ? translateUi("No matching notifications") : translateUi("No notifications yet")}</h2>
              <p>{hasNotifications ? translateUi("Try another search term or filter.") : translateUi("New order and account updates will appear here.")}</p>
            </div>
          ) : (
            <div className="notifications-page-list">
              {filteredNotifications.map((notification) => {
                const { color } = getNotificationIconConfig(notification.type);
                const target = notificationDestination(notification, user);
                const content = (
                  <>
                    <div className="notifications-page-icon" style={{ background: `${color}18`, color }}>
                      <Bell size={17} />
                    </div>
                    <div className="notifications-page-copy">
                      <div className="notifications-page-item-head">
                        <strong>{translateUi(notification.title)}</strong>
                        {!notification.isRead && <span>{translateUi("Unread")}</span>}
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
              <span>{translateUi("Page")}{page} {translateUi("of")} {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => fetchNotifications(page + 1, true)}
                disabled={!hasMore || isLoading}
              >
                {isLoading ? translateUi("Loading...") : hasMore ? translateUi("Load more") : translateUi("All caught up")}
              </button>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}
