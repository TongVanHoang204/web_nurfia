import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AuthRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { TransactionType } from '@prisma/client';

const STOCK_STATUS_VALUES = ['ALL', 'LOW_STOCK', 'OUT_OF_STOCK', 'IN_STOCK'] as const;
type StockStatus = typeof STOCK_STATUS_VALUES[number];

const HISTORY_TYPES = ['ALL', 'IN', 'OUT', 'ADJUSTMENT', 'RETURN'] as const;
type HistoryType = typeof HISTORY_TYPES[number];

const toSafeInt = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const toDateAtBoundary = (input: string | undefined, type: 'start' | 'end') => {
  if (!input) return undefined;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return undefined;
  if (type === 'start') date.setHours(0, 0, 0, 0);
  else date.setHours(23, 59, 59, 999);
  return date;
};

export const inventoryController = {
  
  
  getStocks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = toSafeInt(req.query.page, 1);
      const limit = toSafeInt(req.query.limit, 100);
      const search = (req.query.search as string) || '';
      const status = ((req.query.status as string) || 'ALL').toUpperCase() as StockStatus;
      const lowThreshold = toSafeInt(req.query.lowThreshold, 10);

      const validStatus = STOCK_STATUS_VALUES.includes(status) ? status : 'ALL';

      const whereAnd: any[] = [];

      if (search) {
        whereAnd.push({
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            { variants: { some: { sku: { contains: search } } } },
          ],
        });
      }

      if (validStatus === 'LOW_STOCK') {
        whereAnd.push({
          OR: [
            { stock: { gt: 0, lte: lowThreshold } },
            { variants: { some: { stock: { gt: 0, lte: lowThreshold } } } },
          ],
        });
      }

      if (validStatus === 'OUT_OF_STOCK') {
        whereAnd.push({
          OR: [
            { stock: 0 },
            { variants: { some: { stock: 0 } } },
          ],
        });
      }

      if (validStatus === 'IN_STOCK') {
        whereAnd.push({
          OR: [
            { stock: { gt: lowThreshold } },
            { variants: { some: { stock: { gt: lowThreshold } } } },
          ],
        });
      }

      const where = whereAnd.length > 0 ? { AND: whereAnd } : undefined;

      const stockOnlyWhereAnd: any[] = [];
      if (search) {
        stockOnlyWhereAnd.push({
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            { variants: { some: { sku: { contains: search } } } },
          ],
        });
      }

      const stockOnlyWhere = stockOnlyWhereAnd.length > 0 ? { AND: stockOnlyWhereAnd } : undefined;

      const standaloneProductSearchFilter = search
        ? {
            OR: [
              { name: { contains: search } },
              { sku: { contains: search } },
            ],
          }
        : {};

      const variantSearchFilter = search
        ? {
            OR: [
              { sku: { contains: search } },
              { product: { name: { contains: search } } },
              { product: { sku: { contains: search } } },
            ],
          }
        : {};

      const [
        products,
        total,
        standaloneStockAggregate,
        variantStockAggregate,
        lowStockStandaloneProducts,
        outOfStockStandaloneProducts,
        lowStockVariants,
        outOfStockVariants,
      ] = await Promise.all([
        prisma.product.findMany({
          skip: (page - 1) * limit,
          take: limit,
          where,
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
            images: { take: 1, select: { url: true } },
            variants: {
              select: {
                id: true,
                sku: true,
                stock: true,
                attributes: {
                  select: {
                    attributeValue: {
                      select: { value: true, colorHex: true, attribute: { select: { name: true } } }
                    }
                  }
                }
              }
            }
          },
          orderBy: { name: 'asc' }
        }),
        prisma.product.count({
          where
        }),
        prisma.product.aggregate({
          where: {
            ...(stockOnlyWhere || {}),
            variants: { none: {} },
          },
          _sum: { stock: true }
        }),
        prisma.productVariant.aggregate({
          where: variantSearchFilter,
          _sum: { stock: true }
        }),
        prisma.product.count({
          where: {
            ...standaloneProductSearchFilter,
            variants: { none: {} },
            stock: { gt: 0, lte: lowThreshold },
          },
        }),
        prisma.product.count({
          where: {
            ...standaloneProductSearchFilter,
            variants: { none: {} },
            stock: 0,
          },
        }),
        prisma.productVariant.count({
          where: {
            ...variantSearchFilter,
            stock: { gt: 0, lte: lowThreshold },
          },
        }),
        prisma.productVariant.count({
          where: {
            ...variantSearchFilter,
            stock: 0,
          },
        }),
      ]);

      const normalizedProducts = products.map((product: any) => {
        const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
        const variantStockTotal = hasVariants
          ? product.variants.reduce((sum: number, variant: any) => sum + (Number(variant.stock) || 0), 0)
          : Number(product.stock) || 0;

        return {
          ...product,
          stock: variantStockTotal,
        };
      });

      const lowStockProducts = lowStockStandaloneProducts + lowStockVariants;
      const outOfStockProducts = outOfStockStandaloneProducts + outOfStockVariants;

      res.json({
        success: true,
        data: normalizedProducts,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          totalProducts: total,
          totalUnits: (standaloneStockAggregate._sum.stock || 0) + (variantStockAggregate._sum.stock || 0),
          lowStockProducts,
          outOfStockProducts,
          lowThreshold,
        },
      });
    } catch (err) { next(err); }
  },


getInventoryHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = toSafeInt(req.query.page, 1);
      const limit = toSafeInt(req.query.limit, 20);
      const search = ((req.query.search as string) || '').trim();
      const type = ((req.query.type as string) || 'ALL').toUpperCase() as HistoryType;
      const startDate = toDateAtBoundary(req.query.startDate as string | undefined, 'start');
      const endDate = toDateAtBoundary(req.query.endDate as string | undefined, 'end');

      const validType = HISTORY_TYPES.includes(type) ? type : 'ALL';
      const whereAnd: any[] = [];

      if (validType !== 'ALL') {
        whereAnd.push({ type: validType as TransactionType });
      }

      if (search) {
        whereAnd.push({
          OR: [
            { note: { contains: search } },
            { product: { name: { contains: search } } },
            { product: { sku: { contains: search } } },
            { variant: { sku: { contains: search } } },
            { user: { fullName: { contains: search } } },
          ],
        });
      }

      if (startDate || endDate) {
        whereAnd.push({
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        });
      }

      const where = whereAnd.length > 0 ? { AND: whereAnd } : undefined;

      const [transactions, total, groupedByType] = await Promise.all([
        prisma.inventoryTransaction.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          where,
          include: { 
            product: { select: { sku: true, name: true } },
            variant: { select: { sku: true } },
            user: { select: { fullName: true } }
          }
        }),
        prisma.inventoryTransaction.count({ where }),
        prisma.inventoryTransaction.groupBy({
          by: ['type'],
          where,
          _count: { _all: true },
        }),
      ]);

      const stats = {
        total,
        inCount: 0,
        outCount: 0,
        adjustmentCount: 0,
        returnCount: 0,
      };

      groupedByType.forEach((item) => {
        if (item.type === 'IN') stats.inCount = item._count._all;
        if (item.type === 'OUT') stats.outCount = item._count._all;
        if (item.type === 'ADJUSTMENT') stats.adjustmentCount = item._count._all;
        if (item.type === 'RETURN') stats.returnCount = item._count._all;
      });

      res.json({
        success: true,
        data: transactions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats,
      });
    } catch (err) { next(err); }
  },

      updateStock: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { change, type, note, variantId } = req.body;
      const productId = parseInt(req.body.productId as string, 10);
      const parsedVariantId = variantId ? parseInt(variantId as string, 10) : null;
      const adminId = req.userId;
      const validTypes = ['IN', 'OUT', 'ADJUSTMENT', 'RETURN'];

      if (!adminId) throw new AppError('Authentication required.', 401);
      if (Number.isNaN(productId)) throw new AppError('Invalid product ID.', 400);
      if (!validTypes.includes(type)) throw new AppError('Invalid inventory transaction type.', 400);

      const rawChange = Number(change);
      if (!Number.isFinite(rawChange) || rawChange < 0) throw new AppError('Inventory quantity must be a non-negative number.', 400);
      if (type !== 'ADJUSTMENT' && rawChange === 0) throw new AppError('Inventory quantity must be greater than 0.', 400);

      let newStock = 0;

      await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) throw new AppError('Product not found.', 404);

        if (!parsedVariantId) {
          const variantCount = await tx.productVariant.count({ where: { productId } });
          if (variantCount > 0) {
            throw new AppError('This product is managed by SKU variants. Please update a specific variant stock.', 400);
          }
        }

        let delta = 0;
        let txChange = 0;
        let previousQuantity = 0;

        if (parsedVariantId) {
          const variant = await tx.productVariant.findUnique({ where: { id: parsedVariantId } });
          if (!variant) throw new AppError('Variant not found.', 404);
          if (variant.productId !== productId) throw new AppError('Variant does not belong to selected product.', 400);

          previousQuantity = variant.stock;
          newStock = variant.stock;
          const quantity = Math.abs(rawChange);

          if (type === 'IN' || type === 'RETURN') newStock += quantity;
          else if (type === 'OUT') newStock -= quantity;
          else if (type === 'ADJUSTMENT') newStock = quantity;

          if (newStock < 0) throw new AppError('Stock cannot be negative.', 400);

          delta = newStock - variant.stock;
          txChange = type === 'ADJUSTMENT' ? Math.abs(delta) : quantity;

          await tx.productVariant.update({ where: { id: parsedVariantId }, data: { stock: newStock } });

          const variantStockAggregate = await tx.productVariant.aggregate({
            where: { productId },
            _sum: { stock: true },
          });

          await tx.product.update({
            where: { id: productId },
            data: { stock: variantStockAggregate._sum.stock || 0 }
          });
        } else {
          previousQuantity = product.stock;
          newStock = product.stock;
          const quantity = Math.abs(rawChange);

          if (type === 'IN' || type === 'RETURN') newStock += quantity;
          else if (type === 'OUT') newStock -= quantity;
          else if (type === 'ADJUSTMENT') newStock = quantity;

          if (newStock < 0) throw new AppError('Stock cannot be negative.', 400);

          delta = newStock - product.stock;
          txChange = type === 'ADJUSTMENT' ? Math.abs(delta) : quantity;

          await tx.product.update({ where: { id: productId }, data: { stock: newStock } });
        }

        if (delta !== 0) {
          await tx.inventoryTransaction.create({
            data: {
              productId,
              variantId: parsedVariantId,
              type,
              quantity: txChange,
              previousQuantity,
              newQuantity: newStock,
              note: note || '',
              userId: adminId
            }
          });
        }
      });

      res.json({ success: true, message: 'Stock updated successfully', data: { newStock } });
    } catch (err) { next(err); }
  }
};
