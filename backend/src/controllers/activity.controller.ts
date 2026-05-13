import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  normalizeAdminPermissions,
  ROLE_PERMISSION_DEFAULTS,
  type AuthRequest,
} from '../middlewares/auth.js';
import { logActivity } from '../services/activity.service.js';

const SALT_ROUNDS = 10;
const STAFF_ROLES = ['STAFF', 'MANAGER'] as const;

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

const isStaffRole = (value: unknown): value is typeof STAFF_ROLES[number] =>
  (STAFF_ROLES as readonly string[]).includes(String(value || '').toUpperCase());

const DELETE_ROLLBACK_MODELS = new Set([
  'user',
  'product',
  'category',
  'brand',
  'productAttribute',
  'productAttributeValue',
  'coupon',
  'shippingMethod',
  'blogPost',
  'banner',
  'productReview',
  'contactMessage',
]);

const isSupportedDeleteRollbackModel = (model: string) => DELETE_ROLLBACK_MODELS.has(model);

const requireRollbackFields = (data: Record<string, unknown>, fields: string[]) => {
  const missing = fields.filter((field) => data[field] === undefined || data[field] === null || data[field] === '');
  if (missing.length) {
    throw new AppError(`Rollback snapshot is missing required field(s): ${missing.join(', ')}.`, 400);
  }
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
    const slug = toStringOrNullOrUndefined(snapshot.slug);
    const sku = toStringOrNullOrUndefined(snapshot.sku);
    const shortDescription = toStringOrNullOrUndefined(snapshot.shortDescription);
    const description = toStringOrNullOrUndefined(snapshot.description);
    const price = toNumberOrUndefined(snapshot.price);
    const salePrice = snapshot.salePrice === null ? null : toNumberOrUndefined(snapshot.salePrice);
    const costPrice = snapshot.costPrice === null ? null : toNumberOrUndefined(snapshot.costPrice);
    const stock = toIntegerOrNullOrUndefined(snapshot.stock);
    const lowStockThreshold = toIntegerOrNullOrUndefined(snapshot.lowStockThreshold);
    const categoryId = toIntegerOrNullOrUndefined(snapshot.categoryId);
    const brandId = toIntegerOrNullOrUndefined(snapshot.brandId);
    const isFeatured = toBooleanOrUndefined(snapshot.isFeatured);
    const isActive = toBooleanOrUndefined(snapshot.isActive);
    const weight = snapshot.weight === null ? null : toNumberOrUndefined(snapshot.weight);

    if (name !== undefined && name !== null) data.name = name;
    if (slug !== undefined && slug !== null) data.slug = slug;
    if (sku !== undefined && sku !== null) data.sku = sku;
    if (shortDescription !== undefined) data.shortDescription = shortDescription;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price;
    if (salePrice !== undefined) data.salePrice = salePrice;
    if (costPrice !== undefined) data.costPrice = costPrice;
    if (stock !== undefined && stock !== null) data.stock = stock;
    if (lowStockThreshold !== undefined && lowStockThreshold !== null) data.lowStockThreshold = lowStockThreshold;
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (brandId !== undefined) data.brandId = brandId;
    if (isFeatured !== undefined) data.isFeatured = isFeatured;
    if (isActive !== undefined) data.isActive = isActive;
    if (weight !== undefined) data.weight = weight;

    return { model: 'product', data };
  }

  if (type === 'CATEGORY') {
    const data: Record<string, unknown> = {};
    const name = toStringOrNullOrUndefined(snapshot.name);
    const slug = toStringOrNullOrUndefined(snapshot.slug);
    const description = toStringOrNullOrUndefined(snapshot.description);
    const image = toStringOrNullOrUndefined(snapshot.image);
    const parentId = toIntegerOrNullOrUndefined(snapshot.parentId);
    const sortOrder = toIntegerOrNullOrUndefined(snapshot.sortOrder);
    const isActive = toBooleanOrUndefined(snapshot.isActive);

    if (name !== undefined && name !== null) data.name = name;
    if (slug !== undefined && slug !== null) data.slug = slug;
    if (description !== undefined) data.description = description;
    if (image !== undefined) data.image = image;
    if (parentId !== undefined) data.parentId = parentId;
    if (sortOrder !== undefined && sortOrder !== null) data.sortOrder = sortOrder;
    if (isActive !== undefined) data.isActive = isActive;

    return { model: 'category', data };
  }

  if (type === 'BRAND') {
    const data: Record<string, unknown> = {};
    const name = toStringOrNullOrUndefined(snapshot.name);
    const slug = toStringOrNullOrUndefined(snapshot.slug);
    const sortOrder = toIntegerOrNullOrUndefined(snapshot.sortOrder);
    const isActive = toBooleanOrUndefined(snapshot.isActive);

    if (name !== undefined && name !== null) data.name = name;
    if (slug !== undefined && slug !== null) data.slug = slug;
    if (sortOrder !== undefined && sortOrder !== null) data.sortOrder = sortOrder;
    if (isActive !== undefined) data.isActive = isActive;

    return { model: 'brand', data };
  }

  if (type === 'ATTRIBUTE') {
    const data: Record<string, unknown> = {};
    const name = toStringOrNullOrUndefined(snapshot.name);
    const slug = toStringOrNullOrUndefined(snapshot.slug);

    if (name !== undefined && name !== null) data.name = name;
    if (slug !== undefined && slug !== null) data.slug = slug;

    return { model: 'productAttribute', data };
  }

  if (type === 'ATTRIBUTE_VALUE') {
    const data: Record<string, unknown> = {};
    const attributeId = toIntegerOrNullOrUndefined(snapshot.attributeId);
    const value = toStringOrNullOrUndefined(snapshot.value);
    const colorHex = toStringOrNullOrUndefined(snapshot.colorHex);
    const sortOrder = toIntegerOrNullOrUndefined(snapshot.sortOrder);

    if (attributeId !== undefined && attributeId !== null) data.attributeId = attributeId;
    if (value !== undefined && value !== null) data.value = value;
    if (colorHex !== undefined) data.colorHex = colorHex;
    if (sortOrder !== undefined && sortOrder !== null) data.sortOrder = sortOrder;

    return { model: 'productAttributeValue', data };
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
    const zones = Array.isArray(snapshot.zones) ? snapshot.zones : undefined;

    if (name !== undefined && name !== null) data.name = name;
    if (description !== undefined) data.description = description;
    if (isActive !== undefined) data.isActive = isActive;
    if (zones !== undefined) data.zones = zones;

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
    const publishedAt = toDateOrUndefined(snapshot.publishedAt);

    if (title !== undefined && title !== null) data.title = title;
    if (slug !== undefined && slug !== null) data.slug = slug;
    if (excerpt !== undefined) data.excerpt = excerpt;
    if (content !== undefined) data.content = content;
    if (image !== undefined) data.image = image;
    if (author !== undefined && author !== null) data.author = author;
    if (category !== undefined) data.category = category;
    if (isPublished !== undefined) data.isPublished = isPublished;
    if (publishedAt !== undefined) data.publishedAt = publishedAt;

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

  if (type === 'BANNER') {
    const data: Record<string, unknown> = {};
    const title = toStringOrNullOrUndefined(snapshot.title);
    const subtitle = toStringOrNullOrUndefined(snapshot.subtitle);
    const imageUrl = toStringOrNullOrUndefined(snapshot.imageUrl);
    const videoUrl = toStringOrNullOrUndefined(snapshot.videoUrl);
    const linkUrl = toStringOrNullOrUndefined(snapshot.linkUrl);
    const buttonText = toStringOrNullOrUndefined(snapshot.buttonText);
    const position = toStringOrNullOrUndefined(snapshot.position);
    const sortOrder = toIntegerOrNullOrUndefined(snapshot.sortOrder);
    const isActive = toBooleanOrUndefined(snapshot.isActive);

    if (title !== undefined && title !== null) data.title = title;
    if (subtitle !== undefined) data.subtitle = subtitle;
    if (imageUrl !== undefined && imageUrl !== null) data.imageUrl = imageUrl;
    if (videoUrl !== undefined) data.videoUrl = videoUrl;
    if (linkUrl !== undefined) data.linkUrl = linkUrl;
    if (buttonText !== undefined) data.buttonText = buttonText;
    if (position !== undefined && position !== null) data.position = position;
    if (sortOrder !== undefined && sortOrder !== null) data.sortOrder = sortOrder;
    if (isActive !== undefined) data.isActive = isActive;

    return { model: 'banner', data };
  }

  if (type === 'CUSTOMER') {
    const isActive = toBooleanOrUndefined(snapshot.isActive);
    return {
      model: 'user',
      data: isActive === undefined ? {} : { isActive },
    };
  }

  if (type === 'REVIEW') {
    const data: Record<string, unknown> = {};
    const productId = toIntegerOrNullOrUndefined(snapshot.productId);
    const userId = toIntegerOrNullOrUndefined(snapshot.userId);
    const rating = toIntegerOrNullOrUndefined(snapshot.rating);
    const title = toStringOrNullOrUndefined(snapshot.title);
    const comment = toStringOrNullOrUndefined(snapshot.comment);
    const isApproved = toBooleanOrUndefined(snapshot.isApproved);

    if (productId !== undefined && productId !== null) data.productId = productId;
    if (userId !== undefined && userId !== null) data.userId = userId;
    if (rating !== undefined && rating !== null) data.rating = rating;
    if (title !== undefined) data.title = title;
    if (comment !== undefined) data.comment = comment;
    if (isApproved !== undefined) data.isApproved = isApproved;

    return { model: 'productReview', data };
  }

  if (type === 'CONTACT_MESSAGE') {
    const data: Record<string, unknown> = {};
    const name = toStringOrNullOrUndefined(snapshot.name);
    const email = toStringOrNullOrUndefined(snapshot.email);
    const subject = toStringOrNullOrUndefined(snapshot.subject);
    const message = toStringOrNullOrUndefined(snapshot.message);
    const isRead = toBooleanOrUndefined(snapshot.isRead);

    if (name !== undefined && name !== null) data.name = name;
    if (email !== undefined && email !== null) data.email = email;
    if (subject !== undefined && subject !== null) data.subject = subject;
    if (message !== undefined && message !== null) data.message = message;
    if (isRead !== undefined) data.isRead = isRead;

    return { model: 'contactMessage', data };
  }

  if (type === 'STAFF' || type === 'ROLE') {
    const username = toStringOrNullOrUndefined(snapshot.username);
    const email = toStringOrNullOrUndefined(snapshot.email);
    const fullName = toStringOrNullOrUndefined(snapshot.fullName);
    const role = String(snapshot.role || '').toUpperCase();
    const isActive = toBooleanOrUndefined(snapshot.isActive);

    if (!username || !email || !isStaffRole(role)) {
      return { model: 'user', data: {} };
    }

    const permissions = Array.isArray(snapshot.permissions)
      ? normalizeAdminPermissions(snapshot.permissions)
      : ROLE_PERMISSION_DEFAULTS[role];

    return {
      model: 'user',
      data: {
        username,
        email: email.toLowerCase(),
        fullName: fullName || username,
        role,
        permissions,
        isActive: isActive ?? false,
      },
    };
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

      const action = String(log.action).toUpperCase();
      if (action !== 'UPDATE' && action !== 'DELETE') {
        throw new AppError('Only UPDATE and supported DELETE activity logs can be rolled back.', 400);
      }

      if (!log.entityId) {
        throw new AppError('Rollback requires an entity ID.', 400);
      }

      const snapshot = action === 'DELETE' ? toObject(log.details) : resolveRollbackSnapshot(log.details);
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
      if (action === 'DELETE' && !isSupportedDeleteRollbackModel(rollbackTarget.model)) {
        throw new AppError(`DELETE rollback is not supported for entity type ${log.entityType}.`, 400);
      }

      if (rollbackTarget.model === 'product') {
        if (action === 'DELETE') {
          requireRollbackFields(rollbackTarget.data, ['name', 'slug', 'sku', 'price']);
          result = await prisma.product.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.ProductUncheckedCreateInput,
          });
        } else {
          result = await prisma.product.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'category') {
        if (action === 'DELETE') {
          requireRollbackFields(rollbackTarget.data, ['name', 'slug']);
          result = await prisma.category.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.CategoryUncheckedCreateInput,
          });
        } else {
          result = await prisma.category.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'brand') {
        if (action === 'DELETE') {
          requireRollbackFields(rollbackTarget.data, ['name', 'slug']);
          result = await prisma.brand.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.BrandUncheckedCreateInput,
          });
        } else {
          result = await prisma.brand.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'productAttribute') {
        if (action === 'DELETE') {
          requireRollbackFields(rollbackTarget.data, ['name', 'slug']);
          result = await prisma.productAttribute.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.ProductAttributeUncheckedCreateInput,
          });
        } else {
          result = await prisma.productAttribute.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'productAttributeValue') {
        if (action === 'DELETE') {
          requireRollbackFields(rollbackTarget.data, ['attributeId', 'value']);
          result = await prisma.productAttributeValue.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.ProductAttributeValueUncheckedCreateInput,
          });
        } else {
          result = await prisma.productAttributeValue.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'coupon') {
        if (action === 'DELETE') {
          requireRollbackFields(rollbackTarget.data, ['code', 'type', 'value', 'startDate', 'endDate']);
          result = await prisma.coupon.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.CouponUncheckedCreateInput,
          });
        } else {
          result = await prisma.coupon.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'shippingMethod') {
        const { zones, ...methodData } = rollbackTarget.data;
        if (action === 'DELETE') {
          requireRollbackFields(methodData, ['name']);
          result = await prisma.$transaction(async (tx) => {
            const method = await tx.shippingMethod.create({
              data: {
                id: log.entityId,
                ...methodData,
              } as Prisma.ShippingMethodUncheckedCreateInput,
            });

            if (Array.isArray(zones) && zones.length) {
              await tx.shippingZone.createMany({
                data: zones
                  .map((zone) => toObject(zone))
                  .filter((zone): zone is Record<string, unknown> => Boolean(zone))
                  .map((zone) => ({
                    shippingMethodId: method.id,
                    zoneName: String(zone.zoneName || ''),
                    cost: toNumberOrUndefined(zone.cost) ?? 0,
                    freeShipMinOrder: zone.freeShipMinOrder === null ? null : toNumberOrUndefined(zone.freeShipMinOrder),
                  }))
                  .filter((zone) => zone.zoneName),
              });
            }

            return method;
          });
        } else {
          result = await prisma.shippingMethod.update({ where: { id: log.entityId }, data: methodData });
        }
      } else if (rollbackTarget.model === 'blogPost') {
        if (action === 'DELETE') {
          requireRollbackFields(rollbackTarget.data, ['title', 'slug', 'author']);
          result = await prisma.blogPost.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.BlogPostUncheckedCreateInput,
          });
        } else {
          result = await prisma.blogPost.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'order') {
        result = await prisma.order.update({ where: { id: log.entityId }, data: rollbackTarget.data });
      } else if (rollbackTarget.model === 'banner') {
        if (action === 'DELETE') {
          result = await prisma.banner.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.BannerUncheckedCreateInput,
          });
        } else {
          result = await prisma.banner.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'productReview') {
        if (action === 'DELETE') {
          requireRollbackFields(rollbackTarget.data, ['productId', 'userId', 'rating']);
          result = await prisma.productReview.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.ProductReviewUncheckedCreateInput,
          });
        } else {
          result = await prisma.productReview.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'contactMessage') {
        if (action === 'DELETE') {
          requireRollbackFields(rollbackTarget.data, ['name', 'email', 'subject', 'message']);
          result = await prisma.contactMessage.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
            } as Prisma.ContactMessageUncheckedCreateInput,
          });
        } else {
          result = await prisma.contactMessage.update({ where: { id: log.entityId }, data: rollbackTarget.data });
        }
      } else if (rollbackTarget.model === 'user') {
        if (action === 'DELETE') {
          const temporaryPasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), SALT_ROUNDS);
          result = await prisma.user.create({
            data: {
              id: log.entityId,
              ...rollbackTarget.data,
              password: temporaryPasswordHash,
            } as Prisma.UserUncheckedCreateInput,
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
            },
          });
        } else {
          result = await prisma.user.update({
            where: { id: log.entityId },
            data: rollbackTarget.data as Prisma.UserUpdateInput,
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
            },
          });
        }
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
      if (err?.code === 'P2002') {
        next(new AppError('Rollback conflict: a record with the same unique value already exists.', 409));
        return;
      }
      if (err?.code === 'P2003') {
        next(new AppError('Rollback failed because a related record is missing.', 409));
        return;
      }
      next(err);
    }
  },
};
