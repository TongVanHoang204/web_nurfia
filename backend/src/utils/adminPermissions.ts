export const ADMIN_PERMISSIONS = [
  'MANAGE_BANNERS',
  'MANAGE_PRODUCTS',
  'MANAGE_INVENTORY',
  'MANAGE_CATEGORIES',
  'MANAGE_ORDERS',
  'MANAGE_CUSTOMERS',
  'MANAGE_REVIEWS',
  'MANAGE_STAFF',
  'VIEW_REPORTS',
  'MANAGE_COUPONS',
  'MANAGE_SHIPPING',
  'MANAGE_BLOG',
  'MANAGE_CONTACTS',
  'VIEW_ACTIVITY_LOGS',
  'MANAGE_SETTINGS',
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

export const STAFF_DEFAULT_PERMISSIONS: AdminPermission[] = [
  'MANAGE_ORDERS',
  'MANAGE_CUSTOMERS',
  'MANAGE_CONTACTS',
  'MANAGE_REVIEWS',
];

export const MANAGER_DEFAULT_PERMISSIONS: AdminPermission[] = [
  'MANAGE_BANNERS',
  'MANAGE_PRODUCTS',
  'MANAGE_INVENTORY',
  'MANAGE_CATEGORIES',
  'MANAGE_ORDERS',
  'MANAGE_CUSTOMERS',
  'MANAGE_REVIEWS',
  'VIEW_REPORTS',
  'MANAGE_COUPONS',
  'MANAGE_SHIPPING',
  'MANAGE_BLOG',
  'MANAGE_CONTACTS',
  'VIEW_ACTIVITY_LOGS',
];

export const ROLE_PERMISSION_DEFAULTS: Record<'STAFF' | 'MANAGER', AdminPermission[]> = {
  STAFF: STAFF_DEFAULT_PERMISSIONS,
  MANAGER: MANAGER_DEFAULT_PERMISSIONS,
};

const LEGACY_PERMISSION_ALIASES: Record<string, AdminPermission[]> = {
  MANAGE_PRODUCTS: ['MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'MANAGE_CATEGORIES', 'MANAGE_REVIEWS'],
  MANAGE_ORDERS: ['MANAGE_ORDERS', 'VIEW_REPORTS'],
  MANAGE_USERS: ['MANAGE_CUSTOMERS', 'MANAGE_STAFF', 'MANAGE_CONTACTS', 'VIEW_ACTIVITY_LOGS'],
  MANAGE_SETTINGS: ['MANAGE_SETTINGS', 'MANAGE_SHIPPING', 'MANAGE_COUPONS'],
  MANAGE_BLOG: ['MANAGE_BLOG', 'MANAGE_BANNERS'],
};

const isAdminPermission = (value: string): value is AdminPermission =>
  (ADMIN_PERMISSIONS as readonly string[]).includes(value);

export const normalizeAdminPermissions = (value: unknown): AdminPermission[] => {
  if (!Array.isArray(value)) return [];

  const normalized = new Set<AdminPermission>();
  for (const item of value) {
    const permission = String(item || '').trim().toUpperCase();
    if (!permission) continue;

    if (isAdminPermission(permission)) {
      normalized.add(permission);
      continue;
    }

    LEGACY_PERMISSION_ALIASES[permission]?.forEach((alias) => normalized.add(alias));
  }

  return Array.from(normalized);
};

// Legacy Admins keep their existing full access until Owner explicitly configures them.
export const resolveAdminPermissions = (user: { role: string; isOwner?: boolean; adminPermissionsRestricted?: boolean; permissions?: unknown }): AdminPermission[] => {
  if (user.role === 'OWNER' || (user.role === 'ADMIN' && (user.isOwner || user.adminPermissionsRestricted !== true))) return [...ADMIN_PERMISSIONS];
  return normalizeAdminPermissions(user.permissions);
};
