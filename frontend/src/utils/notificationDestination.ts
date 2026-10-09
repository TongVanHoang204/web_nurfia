import type { Notification } from '../stores/notificationStore';
import { hasFullAdminAccess, hasAdminAccess } from './teamAccess';
const MODULE_PERMISSIONS: Record<string, string> = { orders: 'MANAGE_ORDERS', products: 'MANAGE_PRODUCTS', inventory: 'MANAGE_INVENTORY', contacts: 'MANAGE_CONTACTS', reviews: 'MANAGE_REVIEWS', customers: 'MANAGE_CUSTOMERS', settings: 'MANAGE_SETTINGS', staffs: 'MANAGE_STAFF', coupons: 'MANAGE_COUPONS' };
export function notificationDestination(notification: Pick<Notification, 'link' | 'type' | 'message'>, user?: { role?: string; permissions?: string[] } | null): string | null {
  const link = notification.link;
  if (!link || !link.startsWith('/') || link.startsWith('//') || /[\\\u0000-\u001f]/.test(link)) return null;
  let url: URL;
  try { url = new URL(link, 'https://nurfia.invalid'); } catch { return null; }
  if (url.origin !== 'https://nurfia.invalid') return null;
  if (url.pathname.startsWith('/admin')) {
    const module = url.pathname.split('/')[2];
    if (!hasAdminAccess(user?.role)) return null;
    if (module && module !== 'notifications' && !hasFullAdminAccess(user?.role) && (!MODULE_PERMISSIONS[module] || !user?.permissions?.includes(MODULE_PERMISSIONS[module]))) return null;
  }
  const entity = url.pathname.match(/^\/admin\/(orders|products|contacts)\/(\d+)$/);
  const names: Record<string, string> = { orders: 'order', products: 'product', contacts: 'contact' };
  if (entity) { url.pathname = `/admin/${entity[1]}`; url.searchParams.set(`${names[entity[1]]}Id`, entity[2]); }
  const order = url.pathname.match(/^\/orders?\/(\d+)$/);
  if (order) url.pathname = `/order-confirmation/${order[1]}`;
  if (url.pathname === '/admin/inventory' && !url.search && notification.type === 'LOW_STOCK') {
    const sku = notification.message.match(/^([^\s]+) - /)?.[1];
    if (sku) url.searchParams.set('sku', sku);
  }
  return url.pathname + url.search + url.hash;
}
