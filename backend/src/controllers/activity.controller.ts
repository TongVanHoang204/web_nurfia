import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { AuthRequest } from '../middlewares/auth.js';
import { logActivity } from '../services/activity.service.js';

const parsePositiveInt = (value: unknown, fallback: number, max = 100) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const parseDateOrNull = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toObject = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const toBooleanOrUndefined = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
};

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toIntegerOrNullOrUndefined = (value: unknown): number | null | undefined => {
  if (value === null) return null;
  const parsed = toNumberOrUndefined(value);
  if (parsed === undefined || !Number.isInteger(parsed)) return undefined;
  return parsed;
};

const toStringOrNullOrUndefined = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return undefined;
};

const toDateOrUndefined = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

const extractPrefixedSnapshot = (source: Record<string, unknown>) => {
  const snapshot: Record<string, unknown> = {};
  const prefixes = ['previous', 'before', 'old', 'prev'];

  Object.entries(source).forEach(([key, value]) => {
    const lower = key.toLowerCase();
    const matched = prefixes.find((prefix) => lower.startsWith(prefix));
    if (!matched) return;

    let remainder = key.slice(matched.length);
    if (!remainder) return;
    remainder = remainder.replace(/^_+/, '');
    if (!remainder) return;

    const normalizedField = remainder.charAt(0).toLowerCase() + remainder.slice(1);
    snapshot[normalizedField] = value;
  });

  return snapshot;
};

const resolveRollbackSnapshot = (details: unknown): Record<string, unknown> | null => {
  const root = toObject(details);
  if (!root) return null;

  const directCandidates = ['previous', 'before', 'old', 'from', 'beforeState', 'previousState', 'previousData', 'beforeData'];
  for (const key of directCandidates) {
    const candidate = toObject(root[key]);
    if (candidate && Object.keys(candidate).length) return candidate;
  }

  const directPrefixed = extractPrefixedSnapshot(root);

  const changes = toObject(root.changes);
  if (changes) {
    for (const key of directCandidates) {
      const candidate = toObject(changes[key]);
      if (candidate && Object.keys(candidate).length) return candidate;
    }

    const changePrefixed = extractPrefixedSnapshot(changes);
    const merged = { ...changePrefixed, ...directPrefixed };
    if (Object.keys(merged).length) return merged;
  }

  if (Object.keys(directPrefixed).length) return directPrefixed;
  return null;
};

const pickRollbackDataForEntity = (entityType: string, snapshot: Record<string, unknown>) => {
  const type = String(entityType || '').toUpperCase();

  if (type === 'PRODUCT') {
    const data: Record<string, unknown> = {};
    const name = toStringOrNullOrUndefined(snapshot.name);
    const sku = toStringOrNullOrUndefined(snapshot.sku);
    const price = toNumberOrUndefined(snapshot.price);
    const salePrice = snapshot.salePrice === null ? null : toNumberOrUndefined(snapshot.salePrice);
    const stock = toIntegerOrNullOrUndefined(snapshot.stock);
    const isActive = toBooleanOrUndefined(snapshot.isActive);

    if (name !== undefined && name !== null) data.name = name;
    if (sku !== undefined && sku !== null) data.sku = sku;
    if (price !== undefined) data.price = price;
    if (salePrice !== undefined) data.salePrice = salePrice;
    if (stock !== undefined && stock !== null) data.stock = stock;
    if (isActive !== undefined) data.isActive = isActive;

    return { model: 'product', data };
  }

  if (type === 'CATEGORY') {
    const data: Record<string, unknown> = {};
    const name = toStringOrNullOrUndefined(snapshot.name);
    const slug = toStringOrNullOrUndefined(snapshot.slug);
    const parentId = toIntegerOrNullOrUndefined(snapshot.parentId);
    const sortOrder = toIntegerOrNullOrUndefined(snapshot.sortOrder);
    const isActive = toBooleanOrUndefined(snapshot.isActive);

    if (name !== undefined && name !== null) data.name = name;
    if (slug !== undefined && slug !== null) data.slug = slug;
    if (parentId !== undefined) data.parentId = parentId;
    if (sortOrder !== undefined && sortOrder !== null) data.sortOrder = sortOrder;
    if (isActive !== undefined) data.isActive = isActive;

    return { model: 'category', data };
  }

  if (type === 'COUPON') {
    const data: Record<string, unknown> = {};
    const code = toStringOrNullOrUndefined(snapshot.code);
    const couponType = typeof snapshot.type === 'string' ? snapshot.type.toUpperCase() : undefined;
    const value = toNumberOrUndefined(snapshot.value);
    const minOrderValue = snapshot.minOrderValue === null ? null : toNumberOrUndefined(snapshot.minOrderValue);
    const maxDiscount = snapshot.maxDiscount === null ? null : toNumberOrUndefined(snapshot.maxDiscount);
    const usageLimit = snapshot.usageLimit === null ? null : toIntegerOrNullOrUndefined(snapshot.usageLimit);
    const startDate = toDateOrUndefined(snapshot.startDate);
    const endDate = toDateOrUndefined(snapshot.endDate);
    const isActive = toBooleanOrUndefined(snapshot.isActive);

    if (code !== undefined && code !== null) data.code = code;
    if (couponType === 'PERCENTAGE' || couponType === 'FIXED_AMOUNT') data.type = couponType;
    if (value !== undefined) data.value = value;
    if (minOrderValue !== undefined) data.minOrderValue = minOrderValue;
    if (maxDiscount !== undefined) data.maxDiscount = maxDiscount;
    if (usageLimit !== undefined) data.usageLimit = usageLimit;
    if (startDate !== undefined) data.startDate = startDate;
    if (endDate !== undefined) data.endDate = endDate;
    if (isActive !== undefined) data.isActive = isActive;

    return { model: 'coupon', data };
  }

  if (type === 'SHIPPING_METHOD') {
    const data: Record<string, unknown> = {};
    const name = toStringOrNullOrUndefined(snapshot.name);
    const description = toStringOrNullOrUndefined(snapshot.description);
    const isActive = toBooleanOrUndefined(snapshot.isActive);

    if (name !== undefined && name !== null) data.name = name;
    if (description !== undefined) data.description = description;
    if (isActive !== undefined) data.isActive = isActive;

    return { model: 'shippingMethod', data };
  }

  if (type === 'BLOG_POST') {
    const data: Record<string, unknown> = {};
    const title = toStringOrNullOrUndefined(snapshot.title);
    const slug = toStringOrNullOrUndefined(snapshot.slug);
    const excerpt = toStringOrNullOrUndefined(snapshot.excerpt);
    const content = toStringOrNullOrUndefined(snapshot.content);
    const image = toStringOrNullOrUndefined(snapshot.image);
    const author = toStringOrNullOrUndefined(snapshot.author);
    const category = toStringOrNullOrUndefined(snapshot.category);
    const isPublished = toBooleanOrUndefined(snapshot.isPublished);

    if (title !== undefined && title !== null) data.title = title;
    if (slug !== undefined && slug !== null) data.slug = slug;
    if (excerpt !== undefined) data.excerpt = excerpt;
    if (content !== undefined) data.content = content;
    if (image !== undefined) data.image = image;
    if (author !== undefined && author !== null) data.author = author;
    if (category !== undefined) data.category = category;
    if (isPublished !== undefined) data.isPublished = isPublished;

    return { model: 'blogPost', data };
  }

  if (type === 'ORDER') {
    const data: Record<string, unknown> = {};
    const status = typeof snapshot.status === 'string' ? snapshot.status.toUpperCase() : undefined;
    const paymentStatus = typeof snapshot.paymentStatus === 'string' ? snapshot.paymentStatus.toUpperCase() : undefined;

    if (['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'].includes(String(status))) data.status = status;
    if (['UNPAID', 'PAID', 'REFUNDED'].includes(String(paymentStatus))) data.paymentStatus = paymentStatus;

    return { model: 'order', data };
  }

  return { model: 'unsupported', data: {} };
};

export const activityController = {
  getLogs: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parsePositiveInt(req.query.page, 1, 100000);
      const limit = parsePositiveInt(req.query.limit, 20, 100);
      const skip = (page - 1) * limit;
      const sort = String(req.query.sort || 'NEWEST').toUpperCase() === 'OLDEST' ? 'asc' : 'desc';
      const keyword = String(req.query.search || '').trim();
      const action = String(req.query.action || '').trim();
      const entityType = String(req.query.entityType || '').trim();
      const entityId = req.query.entityId ? Number.parseInt(String(req.query.entityId), 10) : null;

      const startDate = parseDateOrNull(req.query.startDate);
      const endDate = parseDateOrNull(req.query.endDate);

      const where: Prisma.ActivityLogWhereInput = {};

      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (entityId && !Number.isNaN(entityId)) where.entityId = entityId;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          where.createdAt.lte = endOfDay;
        }
      }

      if (keyword) {
        where.OR = [
          { action: { contains: keyword, mode: 'insensitive' } },
          { entityType: { contains: keyword, mode: 'insensitive' } },
          { ipAddress: { contains: keyword, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { fullName: { contains: keyword, mode: 'insensitive' } },
                { email: { contains: keyword, mode: 'insensitive' } },
              ],
            },
          },
        ];
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [logs, filteredTotal, totalLogs, todayLogs, uniqueUsers, actions, entityTypes] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: sort },
          skip,
          take: limit,
        }),
        prisma.activityLog.count({ where }),
        prisma.activityLog.count(),
        prisma.activityLog.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.activityLog.findMany({
          distinct: ['userId'],
          select: { userId: true },
        }),
        prisma.activityLog.findMany({
          distinct: ['action'],
          select: { action: true },
          orderBy: { action: 'asc' },
        }),
        prisma.activityLog.findMany({
          distinct: ['entityType'],
          select: { entityType: true },
          orderBy: { entityType: 'asc' },
        }),
      ]);

      res.json({
        success: true,
        data: logs,
        stats: {
          totalLogs,
          todayLogs,
          uniqueUsers: uniqueUsers.length,
          filteredLogs: filteredTotal,
        },
        filters: {
          actions: actions.map((item) => item.action),
          entityTypes: entityTypes.map((item) => item.entityType),
        },
        pagination: {
          page,
          limit,
          total: filteredTotal,
          totalPages: Math.max(1, Math.ceil(filteredTotal / limit)),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  rollbackLog: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parsePositiveInt(req.params.id, 0, 1000000);
      if (!id) {
        throw new AppError('Invalid activity log ID.', 400);
      }

      const log = await prisma.activityLog.findUnique({ where: { id } });
      if (!log) {
        throw new AppError('Activity log not found.', 404);
      }

      if (String(log.action).toUpperCase() !== 'UPDATE') {
        throw new AppError('Only UPDATE activity logs can be rolled back.', 400);
      }

      if (!log.entityId) {
        throw new AppError('Rollback requires an entity ID.', 400);
      }

      const snapshot = resolveRollbackSnapshot(log.details);
      if (!snapshot || !Object.keys(snapshot).length) {
        throw new AppError('No previous data available for rollback on this log.', 400);
      }

      const rollbackTarget = pickRollbackDataForEntity(log.entityType, snapshot);
      if (rollbackTarget.model === 'unsupported') {
        throw new AppError(`Rollback is not supported for entity type ${log.entityType}.`, 400);
      }

      if (!Object.keys(rollbackTarget.data).length) {
        throw new AppError('No valid fields found to restore from activity details.', 400);
      }

      let result: unknown;
      if (rollbackTarget.model === 'product') {
        result = await prisma.product.update({ where: { id: log.entityId }, data: rollbackTarget.data });
      } else if (rollbackTarget.model === 'category') {
        result = await prisma.category.update({ where: { id: log.entityId }, data: rollbackTarget.data });
      } else if (rollbackTarget.model === 'coupon') {
        result = await prisma.coupon.update({ where: { id: log.entityId }, data: rollbackTarget.data });
      } else if (rollbackTarget.model === 'shippingMethod') {
        result = await prisma.shippingMethod.update({ where: { id: log.entityId }, data: rollbackTarget.data });
      } else if (rollbackTarget.model === 'blogPost') {
        result = await prisma.blogPost.update({ where: { id: log.entityId }, data: rollbackTarget.data });
      } else if (rollbackTarget.model === 'order') {
        result = await prisma.order.update({ where: { id: log.entityId }, data: rollbackTarget.data });
      } else {
        throw new AppError('Unsupported rollback target.', 400);
      }

      if (req.userId) {
        await logActivity(req.userId, 'ROLLBACK', log.entityType, log.entityId, {
          sourceActivityId: log.id,
          restoredFields: Object.keys(rollbackTarget.data),
          previousSnapshot: snapshot,
        }, req.ip);
      }

      res.json({
        success: true,
        message: 'Rollback completed successfully.',
        data: {
          logId: log.id,
          entityType: log.entityType,
          entityId: log.entityId,
          restoredFields: Object.keys(rollbackTarget.data),
          entity: result,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        next(new AppError('Target entity no longer exists, rollback cannot be applied.', 404));
        return;
      }
      next(err);
    }
  },
};