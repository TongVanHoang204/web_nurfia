import { getLocale, translateUi } from '../../../i18n';
export type TeamRole = 'STAFF' | 'MANAGER' | 'ADMIN';
export type TeamUser = { id: number; role: string; permissions?: string[] };
export type StaffMember = TeamUser & { username: string; fullName: string; email: string; permissions: string[]; isActive: boolean; createdAt: string; updatedAt: string };
export type StaffForm = { username: string; email: string; fullName: string; password: string; role: TeamRole; permissions: string[]; isActive: boolean };
export type StaffHistory = { id: number; action: string; createdAt: string; user: { fullName: string; username: string }; details: { previous: Record<string, unknown> | null; current: Record<string, unknown> | null; passwordChanged: boolean } };

export const PERMISSIONS = [
  { value: 'MANAGE_PRODUCTS', label: 'Products', group: 'Catalog', description: 'Products, brands and attributes' },
  { value: 'MANAGE_INVENTORY', label: 'Inventory', group: 'Catalog', description: 'Stock and inventory history' },
  { value: 'MANAGE_CATEGORIES', label: 'Categories', group: 'Catalog', description: 'Product categories' },
  { value: 'MANAGE_ORDERS', label: 'Orders', group: 'Sales', description: 'Orders and fulfillment' },
  { value: 'MANAGE_CUSTOMERS', label: 'Customers', group: 'Sales', description: 'Customer accounts' },
  { value: 'MANAGE_COUPONS', label: 'Coupons', group: 'Sales', description: 'Discount codes' },
  { value: 'MANAGE_SHIPPING', label: 'Shipping', group: 'Sales', description: 'Delivery methods' },
  { value: 'VIEW_REPORTS', label: 'Reports', group: 'Sales', description: 'Reports and charts' },
  { value: 'MANAGE_BANNERS', label: 'Banners & Popups', group: 'Content', description: 'Storefront campaigns' },
  { value: 'MANAGE_BLOG', label: 'Blog Posts', group: 'Content', description: 'Blog content' },
  { value: 'MANAGE_REVIEWS', label: 'Reviews', group: 'Support', description: 'Product reviews' },
  { value: 'MANAGE_CONTACTS', label: 'Contacts', group: 'Support', description: 'Messages and replies' },
  { value: 'VIEW_ACTIVITY_LOGS', label: 'Activity Logs', group: 'Administration', description: 'Admin audit history' },
  { value: 'MANAGE_STAFF', label: 'Staff Management', group: 'Administration', description: 'Accounts below your authority' },
  { value: 'MANAGE_SETTINGS', label: 'Settings', group: 'Administration', description: 'Site settings' },
];
export const ROLE_DEFAULTS: Record<TeamRole, string[]> = {
  STAFF: ['MANAGE_ORDERS', 'MANAGE_CUSTOMERS', 'MANAGE_CONTACTS', 'MANAGE_REVIEWS'],
  MANAGER: PERMISSIONS.map(p => p.value).filter(p => !['MANAGE_STAFF', 'MANAGE_SETTINGS'].includes(p)),
  ADMIN: PERMISSIONS.map(p => p.value),
};
export const PRESETS = [
  { label: 'Sales', description: 'Orders, customers and delivery', permissions: ['MANAGE_ORDERS', 'MANAGE_CUSTOMERS', 'MANAGE_COUPONS', 'MANAGE_SHIPPING'] },
  { label: 'Catalog', description: 'Products and stock', permissions: ['MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'MANAGE_CATEGORIES'] },
  { label: 'Content', description: 'Blog and campaigns', permissions: ['MANAGE_BLOG', 'MANAGE_BANNERS'] },
  { label: 'Customer Support', description: 'Messages and reviews', permissions: ['MANAGE_CONTACTS', 'MANAGE_REVIEWS'] },
];
export const ROLE_RANK: Record<string, number> = { OWNER: 4, ADMIN: 3, MANAGER: 2, STAFF: 1 };
export const fullAccess = (role: string) => role === 'OWNER';
export const canManageMember = (actor: TeamUser | null, member: StaffMember) => Boolean(actor
  && actor.id !== member.id && member.role !== 'OWNER'
  && (ROLE_RANK[actor.role] || 0) > (ROLE_RANK[member.role] || 0)
  && (fullAccess(actor.role) || actor.permissions?.includes('MANAGE_STAFF')));
export const assignableRoles = (actor: TeamUser | null): TeamRole[] => actor
  && (fullAccess(actor.role) || actor.permissions?.includes('MANAGE_STAFF'))
  ? (['STAFF', 'MANAGER', 'ADMIN'] as TeamRole[]).filter(role => ROLE_RANK[role] < (ROLE_RANK[actor.role] || 0)) : [];
export const canAssignPermission = (actor: TeamUser, permission: string) => fullAccess(actor.role) || actor.permissions?.includes(permission) === true;
export const permissionLabel = (value: string) => translateUi(PERMISSIONS.find(p => p.value === value)?.label || value);
export const formatDate = (value: string) => new Date(value).toLocaleDateString(getLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
