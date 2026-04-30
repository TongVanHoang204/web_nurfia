/**
 * Maps notification `type` → { icon name, accent color }.
 * Add new types here without touching any other component.
 */

export type NotificationIconConfig = {
  icon: string; // lucide icon name (lowercase kebab)
  color: string; // CSS custom property or hex
};

const TYPE_CONFIG: Record<string, NotificationIconConfig> = {
  ORDER: { icon: 'shopping-bag', color: '#3b82f6' },
  PAYMENT: { icon: 'credit-card', color: '#10b981' },
  SYSTEM: { icon: 'settings', color: '#8b5cf6' },
  PROMO: { icon: 'tag', color: '#f59e0b' },
  REVIEW: { icon: 'star', color: '#f97316' },
  INFO: { icon: 'info', color: '#6b7280' },
};

const DEFAULT: NotificationIconConfig = { icon: 'bell', color: '#6b7280' };

export const getNotificationIconConfig = (type: string): NotificationIconConfig =>
  TYPE_CONFIG[type?.toUpperCase?.()] ?? DEFAULT;
