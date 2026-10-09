import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ADMIN_PERMISSIONS, AuthRequest, normalizeAdminPermissions, ROLE_PERMISSION_DEFAULTS } from '../middlewares/auth.js';
import { logActivity } from '../services/activity.service.js';
import { notifySessionsRevoked } from '../services/session.service.js';
import { assertTeamManagement, publicTeamMember, TEAM_ROLES } from '../utils/teamAccess.js';

const SALT_ROUNDS = 12;
const STAFF_ROLES = ['STAFF', 'MANAGER', 'ADMIN'] as const;
const STAFF_MANAGEMENT_ROLES = ['STAFF', 'MANAGER', 'ADMIN'] as const;

type StaffRole = (typeof STAFF_ROLES)[number];

const parseStaffRole = (value: unknown, fallback: StaffRole = 'STAFF'): StaffRole => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }

  const normalized = String(value).trim().toUpperCase();
  if ((STAFF_ROLES as readonly string[]).includes(normalized)) {
    return normalized as StaffRole;
  }

  throw new AppError('Role must be STAFF, MANAGER or ADMIN.', 400);
};

const safeSnapshot = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(['username', 'email', 'fullName', 'role', 'permissions', 'isActive']
    .filter(key => key in source).map(key => [key, source[key]]));
};

export const staffController = {
  getStaffs: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim().toUpperCase();
      const roleFilter = String(req.query.role || 'ALL').trim().toUpperCase();
      const sort = String(req.query.sort || 'NEWEST').trim().toUpperCase();
      const skip = (page - 1) * limit;

      const staffRoleWhere: Record<string, unknown> = {
        OR: STAFF_MANAGEMENT_ROLES.map((role) => ({ role })),
      };

      const andClauses: Record<string, unknown>[] = [staffRoleWhere];

      if (status === 'ACTIVE') {
        andClauses.push({ isActive: true });
      }
      if (status === 'INACTIVE') {
        andClauses.push({ isActive: false });
      }
      if (STAFF_MANAGEMENT_ROLES.includes(roleFilter as any)) {
        andClauses.push({ role: roleFilter as any, ...(roleFilter === 'ADMIN' ? { isOwner: false } : {}) });
      }
      if (roleFilter === 'OWNER') {
        andClauses.push({ role: 'ADMIN', isOwner: true });
      }

      if (search) {
        andClauses.push({
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        });
      }

      const where: Record<string, unknown> = andClauses.length > 1 ? { AND: andClauses } : staffRoleWhere;

      const orderBy =
        sort === 'OLDEST' ? { createdAt: 'asc' as const }
          : sort === 'NAME_ASC' ? { fullName: 'asc' as const }
            : sort === 'NAME_DESC' ? { fullName: 'desc' as const }
              : sort === 'UPDATED_DESC' ? { updatedAt: 'desc' as const }
                : { createdAt: 'desc' as const };

      const [staffs, total, totalStaff, activeStaff, inactiveStaff, staffCount, managerCount, adminCount] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
            isOwner: true,
          adminPermissionsRestricted: true,
            permissions: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          }
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: staffRoleWhere }),
        prisma.user.count({ where: { ...staffRoleWhere, isActive: true } }),
        prisma.user.count({ where: { ...staffRoleWhere, isActive: false } }),
        prisma.user.count({ where: { role: 'STAFF' as any } }),
        prisma.user.count({ where: { role: 'MANAGER' as any } }),
        prisma.user.count({ where: { role: 'ADMIN', isOwner: false } }),
      ]);

      res.status(200).json({
        success: true,
        data: staffs.map(publicTeamMember),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalStaff,
          activeStaff,
          inactiveStaff,
          staffCount,
          managerCount,
          adminCount,
        },
      });
    } catch (error) {
      next(error);
    }
  },
  createStaff: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username, email, password, fullName, permissions, isActive } = req.body;
      const role = parseStaffRole(req.body?.role, 'STAFF');

      if (!username?.trim() || !email?.trim() || !password?.trim() || !fullName?.trim()) {
        throw new AppError('Username, email, password, and full name are required.', 400);
      }
      if (/\s/.test(String(password))) {
        throw new AppError('Password cannot contain spaces.', 400);
      }
      if (String(password).length < 6) {
        throw new AppError('Password must be at least 6 characters long.', 400);
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedUsername = String(username).trim();
      const hasExplicitPermissions = Array.isArray(permissions);
      if (hasExplicitPermissions && new Set(permissions).size !== permissions.length) {
        throw new AppError('Phát hiện quyền trùng lặp.', 400);
      }
      const normalizedPermissions = hasExplicitPermissions
        ? normalizeAdminPermissions(permissions)
        : role === 'ADMIN' ? [...ADMIN_PERMISSIONS] : ROLE_PERMISSION_DEFAULTS[role];

      if (hasExplicitPermissions && normalizedPermissions.length !== permissions.length) {
        throw new AppError(`Invalid staff permissions. Allowed values: ${ADMIN_PERMISSIONS.join(', ')}.`, 400);
      }

      assertTeamManagement(req, undefined, role, normalizedPermissions);

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            { username: normalizedUsername },
          ]
        }
      });

      if (existingUser?.email === normalizedEmail) {
        throw new AppError('Email is already in use.', 409);
      }
      if (existingUser?.username === normalizedUsername) {
        throw new AppError('Username is already in use.', 409);
      }

      const staff = await prisma.user.create({
        data: {
          username: normalizedUsername,
          email: normalizedEmail,
          password: await bcrypt.hash(String(password), SALT_ROUNDS),
          fullName: String(fullName).trim(),
          role: role as any,
          permissions: normalizedPermissions,
          adminPermissionsRestricted: role === 'ADMIN',
          isActive: isActive ?? true,
        },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          permissions: true,
          isActive: true,
          createdAt: true,
        }
      });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'STAFF', staff.id, {
          username: staff.username,
          email: staff.email,
          permissions: staff.permissions,
        }, req.ip);
      }

      res.status(201).json({ success: true, data: staff });
    } catch (error) {
      next(error);
    }
  },
  updateStaff: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        throw new AppError('Invalid staff ID.', 400);
      }

      const existingStaff = await prisma.user.findFirst({
        where: { id },
        select: {
          id: true,
          role: true,
          isOwner: true,
          adminPermissionsRestricted: true,
          username: true,
          email: true,
          fullName: true,
          permissions: true,
          isActive: true,
        }
      });

      if (!existingStaff || !STAFF_MANAGEMENT_ROLES.includes(existingStaff.role as any)) {
        throw new AppError('Staff member not found.', 404);
      }
      assertTeamManagement(req, existingStaff);

      const { fullName, permissions, isActive, password } = req.body;
      const updateData: Record<string, unknown> = {};
      const nextRole = parseStaffRole(req.body?.role, existingStaff.role as StaffRole);

      if (typeof fullName === 'string') {
        if (!fullName.trim()) {
          throw new AppError('Full name cannot be empty.', 400);
        }
        updateData.fullName = fullName.trim();
      }
      if (permissions !== undefined) {
        if (!Array.isArray(permissions)) {
          throw new AppError('Permissions must be an array.', 400);
        }
        if (new Set(permissions).size !== permissions.length) {
          throw new AppError('Phát hiện quyền trùng lặp.', 400);
        }
        const normalizedPermissions = normalizeAdminPermissions(permissions);
        if (normalizedPermissions.length !== permissions.length) {
          throw new AppError(`Invalid staff permissions. Allowed values: ${ADMIN_PERMISSIONS.join(', ')}.`, 400);
        }
        updateData.permissions = normalizedPermissions;
      } else if (nextRole !== existingStaff.role) {
        updateData.permissions = nextRole === 'ADMIN' ? [...ADMIN_PERMISSIONS] : ROLE_PERMISSION_DEFAULTS[nextRole];
      }
      if (typeof isActive === 'boolean') {
        updateData.isActive = isActive;
      }
      if (nextRole !== existingStaff.role) {
        updateData.role = nextRole as any;
      }
      if (typeof password === 'string' && password.trim()) {
        if (/\s/.test(password)) {
          throw new AppError('Password cannot contain spaces.', 400);
        }
        if (password.length < 6) {
          throw new AppError('Password must be at least 6 characters long.', 400);
        }
        updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
      }

      assertTeamManagement(req, existingStaff, nextRole, updateData.permissions as string[] | undefined);
      if (nextRole === 'ADMIN' && updateData.permissions !== undefined) updateData.adminPermissionsRestricted = true;
      const permissionsChanged = updateData.permissions !== undefined
        && JSON.stringify([...(updateData.permissions as string[])].sort()) !== JSON.stringify(publicTeamMember(existingStaff).permissions.sort());
      const revokeSessions = (updateData.adminPermissionsRestricted === true && !existingStaff.adminPermissionsRestricted) || Boolean(updateData.password) || nextRole !== existingStaff.role || permissionsChanged
        || (typeof isActive === 'boolean' && isActive !== existingStaff.isActive);
      if (revokeSessions) updateData.tokenVersion = { increment: 1 };

      const staff = await prisma.user.update({
        where: { id, isOwner: false, role: existingStaff.role },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          isOwner: true,
          adminPermissionsRestricted: true,
          permissions: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      if (revokeSessions) notifySessionsRevoked(id);

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'STAFF', staff.id, {
          previous: publicTeamMember(existingStaff),
          passwordChanged: Boolean(updateData.password),
          current: {
            role: staff.role,
            fullName: staff.fullName,
            permissions: publicTeamMember(staff).permissions,
            isActive: staff.isActive,
          }
        }, req.ip);
      }

      res.status(200).json({ success: true, data: publicTeamMember(staff) });
    } catch (error) {
      next(error);
    }
  },
  deleteStaff: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        throw new AppError('Invalid staff ID.', 400);
      }
      if (req.userId === id) {
        throw new AppError('You cannot delete your own account.', 400);
      }

      const existingStaff = await prisma.user.findFirst({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          isOwner: true,
          adminPermissionsRestricted: true,
          permissions: true,
          isActive: true,
        }
      });

      if (!existingStaff || !STAFF_MANAGEMENT_ROLES.includes(existingStaff.role as any)) {
        throw new AppError('Staff member not found.', 404);
      }
      assertTeamManagement(req, existingStaff);

      await prisma.user.delete({ where: { id, isOwner: false, role: existingStaff.role } });
      notifySessionsRevoked(id);

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'STAFF', id, publicTeamMember(existingStaff), req.ip);
      }

      res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
      next(error);
    }
  },
  getStaffHistory: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isOwner: true } });
      if (!target || !(TEAM_ROLES as readonly string[]).includes(publicTeamMember(target).role)) {
        throw new AppError('Staff member not found.', 404);
      }
      const logs = await prisma.activityLog.findMany({
        where: { entityId: id, entityType: { in: ['STAFF', 'ROLE'] } },
        orderBy: { createdAt: 'desc' }, take: 50,
        select: { id: true, action: true, createdAt: true, details: true, user: { select: { id: true, fullName: true, username: true } } },
      });
      res.json({ success: true, data: logs.map(log => {
        const details = log.details && typeof log.details === 'object' && !Array.isArray(log.details)
          ? log.details as Record<string, unknown> : {};
        return { id: log.id, action: log.action, createdAt: log.createdAt, user: log.user, details: {
          previous: safeSnapshot(details.previous), current: safeSnapshot(details.current || details),
          passwordChanged: details.passwordChanged === true,
        } };
      }) });
    } catch (error) { next(error); }
  },
};
