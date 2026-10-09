import { ShoppingBag, CreditCard, Settings, Tag, Star, Info, Bell, ArrowUpRight, Package, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNotificationIconConfig } from './useNotificationIcon';
import type { Notification } from '../../stores/notificationStore';
import { useAuthStore } from '../../stores/authStore';
import { notificationDestination } from '../../utils/notificationDestination';
const ICON_MAP: Record<string, React.ElementType> = { 'shopping-bag': ShoppingBag, 'credit-card': CreditCard, settings: Settings, tag: Tag, star: Star, info: Info, bell: Bell, package: Package, mail: Mail };
export function NotificationItem({ notification, onRead, onSelect }: { notification: Notification; onRead: (id: number) => void; onSelect?: () => void }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { icon, color } = getNotificationIconConfig(notification.type);
  const Icon = ICON_MAP[icon] ?? Bell;
  const destination = notificationDestination(notification, user);
  const date = new Date(notification.createdAt);
  const difference = Math.round((date.getTime() - Date.now()) / 60000);
  const relative = new Intl.RelativeTimeFormat(i18n.language.startsWith('vi') ? 'vi' : 'en', { numeric: 'auto' });
  const time = !Number.isFinite(difference) ? '' : Math.abs(difference) < 60 ? relative.format(difference, 'minute') : Math.abs(difference) < 1440 ? relative.format(Math.round(difference / 60), 'hour') : Math.abs(difference) < 10080 ? relative.format(Math.round(difference / 1440), 'day') : date.toLocaleDateString(i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US');
  const select = () => { if (!notification.isRead) onRead(notification.id); onSelect?.(); };
  const content = <>
    <div className="notif-icon-wrap" style={{ background: `${color}18`, color }}><Icon size={19} /></div>
    <div className="notif-item-content"><div className="notif-item-header"><h4 className="notif-item-title">{t(notification.title)}</h4>{!notification.isRead && <span className="notif-unread-dot" aria-hidden="true" />}</div>
      <p className="notif-item-message">{notification.message}</p><time className="notif-item-time" dateTime={notification.createdAt}>{time}</time>
    </div>{destination && <ArrowUpRight size={15} className="notif-open-arrow" aria-hidden="true" />}
  </>;
  const className = `notif-item${!notification.isRead ? ' is-unread' : ''}`;
  return destination ? <Link to={destination} className={className} onClick={select} aria-label={t(notification.title)}>{content}</Link> : <button type="button" className={className} onClick={select} aria-label={t(notification.title)}>{content}</button>;
}
