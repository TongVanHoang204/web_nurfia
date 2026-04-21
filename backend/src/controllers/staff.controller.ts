import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ADMIN_PERMISSIONS, AuthRequest, normalizeAdminPermissions, ROLE_PERMISSION_DEFAULTS } from '../middlewares/auth.js';
import { logActivity } from '../services/activity.service.js';

const SALT_ROUNDS = 12;
const STAFF_ROLES = ['STAFF', 'MANAGER'] as const;
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

  throw new AppError('Role must be either STAFF or MANAGER.', 400);
};

export const staffController = {
  getStaffs: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim().toUpperCase();
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
        prisma.user.count({ where: { role: 'ADMIN' as any } }),
      ]);

      res.status(200).json({
        success: true,
        data: staffs.map((staff) => ({
          ...staff,
          permissions: normalizeAdminPermissions(staff.permissions),
        })),
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
      const normalizedPermissions = hasExplicitPermissions
        ? normalizeAdminPermissions(permissions)
        : ROLE_PERMISSION_DEFAULTS[role];

      if (hasExplicitPermissions && normalizedPermissions.length !== permissions.length) {
        throw new AppError(`Invalid staff permissions. Allowed values: ${ADMIN_PERMISSIONS.join(', ')}.`, 400);
      }

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
        where: {
          id,
          OR: STAFF_ROLES.map((role) => ({ role: role as any })),
        },
        select: {
          id: true,
          role: true,
          fullName: true,
          permissions: true,
          isActive: true,
        }
      });

      if (!existingStaff) {
        throw new AppError('Staff member not found.', 404);
      }

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
        const normalizedPermissions = normalizeAdminPermissions(permissions);
        if (normalizedPermissions.length !== permissions.length) {
          throw new AppError(`Invalid staff permissions. Allowed values: ${ADMIN_PERMISSIONS.join(', ')}.`, 400);
        }
        updateData.permissions = normalizedPermissions;
      } else if (nextRole !== existingStaff.role) {
        updateData.permissions = ROLE_PERMISSION_DEFAULTS[nextRole];
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

      const staff = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          permissions: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'STAFF', staff.id, {
          previous: existingStaff,
          current: {
            role: staff.role,
            fullName: staff.fullName,
            permissions: staff.permissions,
            isActive: staff.isActive,
          }
        }, req.ip);
      }

      res.status(200).json({ success: true, data: staff });
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
        where: {
          id,
          OR: STAFF_ROLES.map((role) => ({ role: role as any })),
        },
        select: { id: true, username: true, email: true }
      });

      if (!existingStaff) {
        throw new AppError('Staff member not found.', 404);
      }

      await prisma.user.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'STAFF', id, existingStaff, req.ip);
      }

      res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
      next(error);
    }
  }
};
