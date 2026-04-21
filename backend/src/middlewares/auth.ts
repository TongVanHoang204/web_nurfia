import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../models/prisma.js';
import { AppError } from './errorHandler.js';

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

type AdminPermission = typeof ADMIN_PERMISSIONS[number];

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

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  userPermissions?: AdminPermission[];
}

const getTokenFromRequest = (req: AuthRequest) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = req.cookies?.[config.jwt.cookieName];
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
  const isStreamRequest = req.method === 'GET' && req.path.endsWith('/stream');

  return bearerToken || cookieToken || (isStreamRequest ? queryToken : null);
};

// Verify JWT token and attach user info to request
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next(new AppError('Authentication required. Please log in.', 401));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: number; role: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, permissions: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return next(new AppError('User account not found or deactivated.', 401));
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.userPermissions = normalizeAdminPermissions(user.permissions);
    next();
  } catch {
    return next(new AppError('Invalid or expired authentication token.', 401));
  }
};

// Require admin role
export const requireAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.userRole !== 'ADMIN') {
    return next(new AppError('Admin access required.', 403));
  }
  next();
};

export const requireAdminAccess = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.userRole !== 'ADMIN' && req.userRole !== 'STAFF' && req.userRole !== 'MANAGER') {
    return next(new AppError('Admin panel access required.', 403));
  }
  next();
};

export const requireCustomer = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.userRole !== 'CUSTOMER') {
    return next(new AppError('Only customer accounts can place orders.', 403));
  }
  next();
};

export const requirePermission = (...permissions: AdminPermission[]) => (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.userRole === 'ADMIN') {
    next();
    return;
  }

  if (req.userRole !== 'STAFF' && req.userRole !== 'MANAGER') {
    return next(new AppError('Admin panel access required.', 403));
  }

  const userPermissions = req.userPermissions || [];
  const hasPermission = permissions.some((permission) => userPermissions.includes(permission));
  if (!hasPermission) {
    return next(new AppError('You do not have permission to access this admin module.', 403));
  }

  next();
};

// Optional auth — attaches user info if token present, but does not block
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = getTokenFromRequest(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: number; role: string };
      req.userId = decoded.userId;
      req.userRole = decoded.role;
    } catch {
      // Token invalid — proceed as unauthenticated
    }
  }
  next();
};
