import { Request, Response, NextFunction } from 'express';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';
import { getAuthenticatedUser } from '../services/session.service.js';
import { hasFullAdminAccess, TEAM_ROLES } from '../utils/teamAccess.js';

import { normalizeAdminPermissions, type AdminPermission } from '../utils/adminPermissions.js';
export * from '../utils/adminPermissions.js';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  userPermissions?: AdminPermission[];
  tokenVersion?: number;
  tokenExpiresAt?: number;
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
    const user = await getAuthenticatedUser(token);

    req.userId = user.id;
    req.userRole = user.role;
    req.userPermissions = normalizeAdminPermissions(user.permissions);
    req.tokenVersion = user.tokenVersion;
    req.tokenExpiresAt = user.tokenExpiresAt;
    next();
  } catch (error) {
    return next(error);
  }
};

// Require admin role
export const requireAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.userRole !== 'OWNER' && req.userRole !== 'ADMIN') {
    return next(new AppError('Admin access required.', 403));
  }
  next();
};

export const requireAdminAccess = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (!(TEAM_ROLES as readonly string[]).includes(req.userRole || '')) {
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
  if (hasFullAdminAccess(req.userRole)) {
    next();
    return;
  }

  if (req.userRole !== 'ADMIN' && req.userRole !== 'STAFF' && req.userRole !== 'MANAGER') {
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
      const user = await getAuthenticatedUser(token);
      req.userId = user.id;
      req.userRole = user.role;
      req.tokenVersion = user.tokenVersion;
      req.tokenExpiresAt = user.tokenExpiresAt;
    } catch {
      // Token invalid — proceed as unauthenticated
    }
  }
  next();
};
