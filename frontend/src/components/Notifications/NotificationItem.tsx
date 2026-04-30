import {
  ShoppingBag, CreditCard, Settings, Tag, Star, Info, Bell,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getNotificationIconConfig } from './useNotificationIcon';
import type { Notification } from '../../stores/notificationStore';

const ICON_MAP: Record<string, React.ElementType> = {
  'shopping-bag': ShoppingBag,
  'credit-card': CreditCard,
  'settings': Settings,
  'tag': Tag,
  'star': Star,
  'info': Info,
  'bell': Bell,
};

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: number) => void;
}

/** Formats a date string as relative time (e.g. "5 phút trước") */
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const { icon, color } = getNotificationIconConfig(notification.type);
  const IconComponent = ICON_MAP[icon] ?? Bell;

  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
  };

  const inner = (
    <div
      className={`notif-item${!notification.isRead ? ' is-unread' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={notification.title}
    >
      {/* Icon avatar */}
      <div
        className="notif-icon-wrap"
        style={{ background: `${color}18`, color }}
      >
        <IconComponent size={17} />
      </div>

      {/* Content */}
      <div className="notif-item-content">
        <div className="notif-item-header">
          <h4 className="notif-item-title">{notification.title}</h4>
          {!notification.isRead && <span className="notif-unread-dot" aria-hidden />}
        </div>
        <p className="notif-item-message">{notification.message}</p>
        <span className="notif-item-time">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </div>
    </div>
  );

  // If there's a link, wrap in a Link for SPA navigation
  if (notification.link) {
    const adminOrderMatch = notification.link.match(/^\/admin\/orders\/(\d+)$/);
    const userOrderMatch = notification.link.match(/^\/order(?:s)?\/(\d+)$/);
    
    const sanitizedLink = adminOrderMatch 
      ? `/admin/orders?orderId=${adminOrderMatch[1]}` 
      : userOrderMatch
      ? `/order-confirmation/${userOrderMatch[1]}`
      : notification.link;

    return (
      <Link
        to={sanitizedLink}
        className={`notif-item${!notification.isRead ? ' is-unread' : ''}`}
        onClick={handleClick}
        aria-label={notification.title}
      >
        <div
          className="notif-icon-wrap"
          style={{ background: `${color}18`, color }}
        >
          <IconComponent size={17} />
        </div>
        <div className="notif-item-content">
          <div className="notif-item-header">
            <h4 className="notif-item-title">{notification.title}</h4>
            {!notification.isRead && <span className="notif-unread-dot" aria-hidden />}
          </div>
          <p className="notif-item-message">{notification.message}</p>
          <span className="notif-item-time">
            {formatRelativeTime(notification.createdAt)}
          </span>
        </div>
      </Link>
    );
  }

  return inner;
}
