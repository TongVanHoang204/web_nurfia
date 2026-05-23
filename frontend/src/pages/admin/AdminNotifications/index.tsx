import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Search, Inbox, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { useNotificationStore, type Notification } from '../../../stores/notificationStore';
import { useUIStore } from '../../../stores/uiStore';
import { getNotificationIconConfig } from '../../../components/Notifications';
import './AdminNotifications.css';

type NotificationFilter = 'ALL' | 'UNREAD' | 'READ';

const getPageNumbers = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages: number[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push(-1);
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push(-2);
  pages.push(totalPages);

  return pages;
};

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
    deleteNotification,
    deleteNotifications,
    initSocket,
  } = useNotificationStore();
  const { addToast, openConfirm } = useUIStore();

  const [filter, setFilter] = useState<NotificationFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

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

  useEffect(() => {
    const visibleIds = new Set(filteredNotifications.map((notification) => notification.id));
    setSelectedIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [filteredNotifications]);

  const filteredIds = filteredNotifications.map((notification) => notification.id);
  const selectedSet = new Set(selectedIds);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id));

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id]
    ));
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds(allFilteredSelected ? [] : filteredIds);
  };

  const handleDeleteOne = (notification: Notification) => {
    openConfirm({
      title: 'Delete Notification',
      message: `Delete "${notification.title}"?`,
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteNotification(notification.id);
          setSelectedIds((prev) => prev.filter((id) => id !== notification.id));
          addToast('Notification deleted', 'success');
        } catch {
          addToast('Failed to delete notification', 'error');
        }
      },
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;

    openConfirm({
      title: 'Delete Notifications',
      message: `Delete ${selectedIds.length} selected notification${selectedIds.length === 1 ? '' : 's'}?`,
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteNotifications(selectedIds);
          setSelectedIds([]);
          addToast('Selected notifications deleted', 'success');
        } catch {
          addToast('Failed to delete selected notifications', 'error');
        }
      },
    });
  };

  const pageNumbers = useMemo(() => getPageNumbers(page, Math.max(totalPages, 1)), [page, totalPages]);
  const hasNotifications = notifications.length > 0;
  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page || isLoading) return;
    setSelectedIds([]);
    fetchNotifications(nextPage);
  };

  return (
    <div className="admin-notifications-page">
      <header className="admin-notifications-header">
        <div>
          <h1>System Alerts</h1>
          <p>Manage your notifications, order updates, and system alerts.</p>
        </div>
        <div className="admin-notifications-header-actions">
        {selectedIds.length > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-sm admin-notifications-danger-btn"
            onClick={handleDeleteSelected}
            disabled={isLoading}
          >
            <Trash2 size={14} />
            Delete selected ({selectedIds.length})
          </button>
        )}
        {unreadCount > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={markAllAsRead}
            disabled={isLoading}
          >
            <CheckCheck size={14} />
            Mark all as read
          </button>
        )}
        </div>
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
            <div className="admin-notifications-bulk-row">
              <label>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  disabled={filteredNotifications.length === 0}
                />
                Select all shown
              </label>
              <span>{filteredNotifications.length} shown</span>
            </div>
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

              return (
                <article key={notification.id} className={itemClass}>
                  <label className="admin-notifications-select" aria-label={`Select ${notification.title}`}>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(notification.id)}
                      onChange={() => toggleSelected(notification.id)}
                    />
                  </label>
                  {target ? (
                  <Link
                    to={target}
                    className="admin-notifications-main-action"
                    onClick={() => isUnread && markAsRead(notification.id)}
                  >
                    {itemContent}
                  </Link>
                  ) : (
                    <button
                      type="button"
                      className="admin-notifications-main-action"
                      onClick={() => isUnread && markAsRead(notification.id)}
                    >
                      {itemContent}
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-notifications-delete"
                    aria-label={`Delete ${notification.title}`}
                    title={`Delete ${notification.title}`}
                    onClick={() => handleDeleteOne(notification)}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {hasNotifications && totalPages > 1 && (
          <div className="admin-notifications-footer">
            <span className="admin-notifications-pagination-text">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="admin-notifications-page-btn"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </button>
            <div className="admin-notifications-page-numbers">
              {pageNumbers.map((pageNumber) => (
                pageNumber < 0 ? (
                  <span key={pageNumber} className="admin-notifications-page-ellipsis">...</span>
                ) : (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`admin-notifications-page-btn ${pageNumber === page ? 'is-active' : ''}`}
                    onClick={() => goToPage(pageNumber)}
                    disabled={isLoading}
                    aria-current={pageNumber === page ? 'page' : undefined}
                  >
                    {pageNumber}
                  </button>
                )
              ))}
            </div>
            <button
              type="button"
              className="admin-notifications-page-btn"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || isLoading}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
