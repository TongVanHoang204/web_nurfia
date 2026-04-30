/**
 * Public API for the Notification component system.
 * Import from here — not from individual files — to keep
 * paths stable across refactors.
 *
 * @example
 * import NotificationBell from '@/components/Notifications';
 * import { NotificationDropdown, NotificationItem } from '@/components/Notifications';
 */

export { default } from './NotificationBell';
export { NotificationDropdown } from './NotificationDropdown';
export { NotificationItem } from './NotificationItem';
export { NotificationEmpty } from './NotificationEmpty';
export { getNotificationIconConfig } from './useNotificationIcon';
export type { NotificationIconConfig } from './useNotificationIcon';
