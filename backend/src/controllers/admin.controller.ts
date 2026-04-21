import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import slugify from 'slugify';
import { AuthRequest } from '../middlewares/auth.js';
import { logActivity } from '../services/activity.service.js';
import { emitCustomerStatusChanged, subscribeCustomerStatusChanged } from '../services/customer-stream.service.js';
import { sanitizeRichText } from '../utils/html.js';
import { getProtectedBankTransferProofUrl } from '../utils/bankTransferProof.js';

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'] as const;
const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'REFUNDED'] as const;
const COUPON_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
const CUSTOMER_SEGMENTS = ['ALL', 'NEW', 'NO_ORDERS', 'RETURNING', 'HAS_PHONE'] as const;
const CUSTOMER_SORT_OPTIONS = ['NEWEST', 'OLDEST', 'ORDERS_DESC', 'NAME_ASC'] as const;

const parseEntityId = (value: string, label: string) => {
  const id = parseInt(value, 10);
  if (Number.isNaN(id) || id <= 0) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
  return id;
};

const normalizeOptionalString = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const serializeAdminOrderWithProtectedProof = <T extends { id: number; bankTransferImage?: string | null }>(order: T) => ({
  ...order,
  bankTransferImage: getProtectedBankTransferProofUrl(order.id, order.bankTransferImage),
});

const ensureUniqueProductFields = async (sku: string, slug: string, excludeId?: number) => {
  const existing = await prisma.product.findFirst({
    where: {
      OR: [{ sku }, { slug }],
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, sku: true, slug: true },
  });

  if (!existing) return;
  if (existing.sku === sku) throw new AppError('SKU is already in use.', 409);
  if (existing.slug === slug) throw new AppError('Product slug is already in use.', 409);
};

const normalizeSkuToken = (value: string, fallback: string, maxLength = 8) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
};

const getAttributePriority = (attributeName: string) => {
  const normalized = String(attributeName || '').trim().toLowerCase();
  if (normalized === 'color' || normalized.includes('màu')) return 1;
  if (normalized === 'size' || normalized.includes('kích')) return 2;
  return 10;
};

const createAutoVariantSku = (
  productSku: string,
  attributeTokens: string[],
  index: number,
  usedSkus: Set<string>,
) => {
  const rawBase = attributeTokens.length
    ? `${productSku}-${attributeTokens.join('-')}`
    : `${productSku}-V${index + 1}`;

  const base = rawBase.slice(0, 60);
  let candidate = base;
  let suffix = 1;

  while (usedSkus.has(candidate)) {
    suffix += 1;
    const suffixToken = `-${suffix}`;
    candidate = `${base.slice(0, Math.max(1, 60 - suffixToken.length))}${suffixToken}`;
  }

  usedSkus.add(candidate);
  return candidate;
};

const ensureUniqueCategorySlug = async (slug: string, excludeId?: number) => {
  const existing = await prisma.category.findFirst({
    where: {
      slug,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new AppError('Category slug is already in use.', 409);
  }
};

const ensureUniqueBrandFields = async (name: string, slug: string, excludeId?: number) => {
  const existing = await prisma.brand.findFirst({
    where: {
      OR: [{ name }, { slug }],
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, name: true, slug: true },
  });

  if (!existing) return;
  if (existing.name === name) throw new AppError('Brand name is already in use.', 409);
  if (existing.slug === slug) throw new AppError('Brand slug is already in use.', 409);
};

const ensureCategoryHierarchy = async (parentId: number | null, currentCategoryId?: number) => {
  if (parentId === null || parentId === undefined) return;

  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });

  if (!parent) {
    throw new AppError('Parent category not found.', 404);
  }

  if (currentCategoryId && parent.id === currentCategoryId) {
    throw new AppError('A category cannot be its own parent.', 400);
  }

  if (!currentCategoryId) return;

  let cursor: { id: number; parentId: number | null } | null = parent;
  while (cursor?.parentId) {
    cursor = await prisma.category.findUnique({
      where: { id: cursor.parentId },
      select: { id: true, parentId: true },
    });

    if (cursor?.id === currentCategoryId) {
      throw new AppError('Cannot assign a descendant category as parent.', 400);
    }
  }
};

const normalizeCouponType = (value: unknown) => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'FIXED') return 'FIXED_AMOUNT';
  if ((COUPON_TYPES as readonly string[]).includes(raw)) return raw;
  throw new AppError('Invalid coupon type.', 400);
};

const validateCouponPayload = async (body: any, couponId?: number) => {
  const code = String(body.code || '').trim().toUpperCase();
  if (!code) throw new AppError('Coupon code is required.', 400);

  const type = normalizeCouponType(body.type);
  const value = Number(body.value);
  const minOrderValue = body.minOrderValue === null || body.minOrderValue === undefined || body.minOrderValue === ''
    ? null
    : Number(body.minOrderValue);
  const maxDiscount = body.maxDiscount === null || body.maxDiscount === undefined || body.maxDiscount === ''
    ? null
    : Number(body.maxDiscount);
  const usageLimit = body.usageLimit === null || body.usageLimit === undefined || body.usageLimit === ''
    ? null
    : Number(body.usageLimit);
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);

  if (!Number.isFinite(value) || value <= 0) throw new AppError('Coupon value must be greater than 0.', 400);
  if (type === 'PERCENTAGE' && value > 100) throw new AppError('Percentage coupon cannot exceed 100.', 400);
  if (minOrderValue !== null && (!Number.isFinite(minOrderValue) || minOrderValue < 0)) {
    throw new AppError('Minimum order value must be a non-negative number.', 400);
  }
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) {
    throw new AppError('Max discount must be greater than 0.', 400);
  }
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
    throw new AppError('Usage limit must be a positive integer.', 400);
  }
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new AppError('Coupon start and end dates are required.', 400);
  }
  if (endDate <= startDate) {
    throw new AppError('Coupon end date must be after start date.', 400);
  }

  const existing = await prisma.coupon.findFirst({
    where: {
      code,
      ...(couponId ? { NOT: { id: couponId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new AppError('Coupon code is already in use.', 409);
  }

  return {
    code,
    type,
    value,
    minOrderValue,
    maxDiscount,
    usageLimit,
    startDate,
    endDate,
    isActive: body.isActive ?? true,
  };
};

const createProductPayload = async (body: any, excludeId?: number) => {
  const name = String(body.name || '').trim();
  const sku = String(body.sku || '').trim();
  const slug = slugify(name, { lower: true, strict: true });
  const price = Number(body.price);
  const salePrice = body.salePrice === null || body.salePrice === undefined || body.salePrice === '' ? null : Number(body.salePrice);
  const stock = Number(body.stock);
  const categoryId = body.categoryId === null || body.categoryId === undefined || body.categoryId === '' ? null : Number(body.categoryId);
  const brandId = body.brandId === null || body.brandId === undefined || body.brandId === '' ? null : Number(body.brandId);

  if (!name) throw new AppError('Product name is required.', 400);
  if (!sku) throw new AppError('SKU is required.', 400);
  if (!slug) throw new AppError('Unable to generate a valid product slug.', 400);
  if (!Number.isFinite(price) || price <= 0) throw new AppError('Product price must be greater than 0.', 400);
  if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice <= 0)) throw new AppError('Sale price must be greater than 0.', 400);
  if (salePrice !== null && salePrice > price) throw new AppError('Sale price cannot exceed regular price.', 400);
  if (!Number.isInteger(stock) || stock < 0) throw new AppError('Stock must be a non-negative integer.', 400);

  if (categoryId !== null) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw new AppError('Category not found.', 404);
  }

  if (brandId !== null) {
    if (!Number.isInteger(brandId) || brandId <= 0) {
      throw new AppError('Invalid brand.', 400);
    }

    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) throw new AppError('Brand not found.', 404);
  }

  await ensureUniqueProductFields(sku, slug, excludeId);

  const payload: Record<string, any> = {
    name,
    sku,
    slug,
    shortDescription: normalizeOptionalString(body.shortDescription),
    description: sanitizeRichText(normalizeOptionalString(body.description) ?? null),
    price,
    salePrice,
    stock,
    categoryId,
    brandId,
    isFeatured: Boolean(body.isFeatured),
    isActive: body.isActive ?? true,
  };

  if (Array.isArray(body.images)) {
    payload.images = {
      ...(excludeId ? { deleteMany: {} } : {}),
      create: body.images
        .filter((img: any) => img?.url)
        .map((img: any, index: number) => ({
          url: String(img.url).trim(),
          alt: normalizeOptionalString(img.alt) || name,
          sortOrder: index,
          isPrimary: index === 0,
        })),
    };
  }

  if (Array.isArray(body.variants)) {
    if (body.variants.length === 0) {
      if (excludeId) {
        // Explicit empty variants payload means remove all existing SKU variants on update.
        payload.variants = { deleteMany: {} };
      }
    } else {
    const autoGenerateVariantSku = body.autoGenerateVariantSku !== false;
    type NormalizedVariantInput = {
      manualSku: string;
      price: number;
      salePrice: number | null;
      stock: number;
      isActive: boolean;
      attributeIds: number[];
    };

    type AttributeToken = {
      priority: number;
      token: string;
    };

    const normalizedVariants: NormalizedVariantInput[] = body.variants.map((variant: any, index: number) => {
      const variantStock = Number(variant.stock);
      const variantPriceRaw = Number(variant.price);
      const variantPrice = Number.isFinite(variantPriceRaw) && variantPriceRaw > 0 ? variantPriceRaw : price;

      const variantSalePrice = variant.salePrice === null || variant.salePrice === undefined || variant.salePrice === ''
        ? null
        : Number(variant.salePrice);

      if (!Number.isInteger(variantStock) || variantStock < 0) {
        throw new AppError(`Variant #${index + 1} stock must be a non-negative integer.`, 400);
      }

      if (variantSalePrice !== null && (!Number.isFinite(variantSalePrice) || variantSalePrice <= 0)) {
        throw new AppError(`Variant #${index + 1} sale price must be greater than 0.`, 400);
      }

      if (variantSalePrice !== null && variantSalePrice > variantPrice) {
        throw new AppError(`Variant #${index + 1} sale price cannot exceed regular price.`, 400);
      }

      return {
        manualSku: String(variant.sku || '').trim(),
        price: variantPrice,
        salePrice: variantSalePrice,
        stock: variantStock,
        isActive: variant.isActive ?? true,
        attributeIds: Array.from(new Set(
          (Array.isArray(variant.attributes) ? variant.attributes : [])
            .map((id: unknown) => Number(id))
            .filter((id: number) => Number.isInteger(id) && id > 0)
        )),
      };
    });

    const allAttributeIds: number[] = Array.from(
      new Set(normalizedVariants.flatMap((variant: NormalizedVariantInput) => variant.attributeIds))
    );

    const attributeValueRows = allAttributeIds.length
      ? await prisma.productAttributeValue.findMany({
        where: { id: { in: allAttributeIds } },
        include: { attribute: { select: { name: true } } },
      })
      : [];

    if (allAttributeIds.length !== attributeValueRows.length) {
      throw new AppError('Some variant attributes are invalid.', 400);
    }

    const attributeValueMap = new Map<number, { value: string; attributeName: string }>(
      attributeValueRows.map((row: any) => [
        row.id,
        {
          value: row.value,
          attributeName: row.attribute?.name || '',
        },
      ])
    );

    const requestVariantSkus = new Set<string>();
    const variantCreates = normalizedVariants.map((variant: NormalizedVariantInput, index: number) => {
      let nextSku = variant.manualSku;

      if (autoGenerateVariantSku) {
        const attributeTokens = variant.attributeIds
          .map((attributeValueId: number): AttributeToken | null => {
            const attributeValue = attributeValueMap.get(attributeValueId);
            if (!attributeValue) return null;
            return {
              priority: getAttributePriority(attributeValue.attributeName),
              token: normalizeSkuToken(attributeValue.value, `A${attributeValueId}`, 6),
            };
          })
          .filter((item: AttributeToken | null): item is AttributeToken => item !== null)
          .sort((left: AttributeToken, right: AttributeToken) => {
            if (left.priority !== right.priority) return left.priority - right.priority;
            return left.token.localeCompare(right.token);
          })
          .map((item: AttributeToken) => item.token);

        nextSku = createAutoVariantSku(sku, attributeTokens, index, requestVariantSkus);
      } else {
        if (!nextSku) {
          throw new AppError(`Variant #${index + 1} SKU is required when auto-generate is disabled.`, 400);
        }

        if (requestVariantSkus.has(nextSku)) {
          throw new AppError(`Duplicate variant SKU "${nextSku}" in this request.`, 400);
        }

        requestVariantSkus.add(nextSku);
      }

      return {
        sku: nextSku,
        price: variant.price,
        salePrice: variant.salePrice,
        stock: variant.stock,
        isActive: variant.isActive,
        attributes: {
          create: variant.attributeIds.map((attributeValueId: number) => ({
            attributeValueId,
          })),
        },
      };
    });

    const duplicateSku = await prisma.productVariant.findFirst({
      where: {
        sku: { in: Array.from(requestVariantSkus) },
        ...(excludeId ? { NOT: { productId: excludeId } } : {}),
      },
      select: { sku: true },
    });

    if (duplicateSku) {
      throw new AppError(`Variant SKU "${duplicateSku.sku}" is already in use.`, 409);
    }

      payload.variants = {
        ...(excludeId ? { deleteMany: {} } : {}),
        create: variantCreates,
      };

      payload.stock = normalizedVariants.reduce((sum: number, variant: NormalizedVariantInput) => sum + variant.stock, 0);
    }
  }

  return payload;
};

const validateShippingMethodPayload = (body: any) => {
  const name = String(body.name || '').trim();
  const description = normalizeOptionalString(body.description);
  const isActive = body.isActive ?? true;
  const zonesInput = Array.isArray(body.zones) ? body.zones : [];

  if (!name) {
    throw new AppError('Shipping method name is required.', 400);
  }
  if (zonesInput.length === 0) {
    throw new AppError('At least one shipping zone is required.', 400);
  }

  const zones = zonesInput.map((zone: any, index: number) => {
    const zoneName = String(zone?.zoneName || '').trim();
    const cost = Number(zone?.cost);
    const freeShipMinOrder = zone?.freeShipMinOrder === null || zone?.freeShipMinOrder === undefined || zone?.freeShipMinOrder === ''
      ? null
      : Number(zone.freeShipMinOrder);

    if (!zoneName) {
      throw new AppError(`Zone #${index + 1} name is required.`, 400);
    }
    if (!Number.isFinite(cost) || cost < 0) {
      throw new AppError(`Zone #${index + 1} cost must be a non-negative number.`, 400);
    }
    if (freeShipMinOrder !== null && (!Number.isFinite(freeShipMinOrder) || freeShipMinOrder < 0)) {
      throw new AppError(`Zone #${index + 1} free shipping threshold must be a non-negative number.`, 400);
    }

    return {
      zoneName,
      cost,
      freeShipMinOrder,
    };
  });

  const normalizedZoneNames = new Set<string>();
  for (const zone of zones) {
    const key = zone.zoneName.toLowerCase();
    if (normalizedZoneNames.has(key)) {
      throw new AppError(`Duplicate shipping zone "${zone.zoneName}" is not allowed.`, 400);
    }
    normalizedZoneNames.add(key);
  }

  return { name, description, isActive, zones };
};

const validateBlogPostPayload = async (body: any, postId?: number) => {
  const title = String(body.title || '').trim();
  const slugInput = String(body.slug || title).trim();
  const slug = slugify(slugInput, { lower: true, strict: true });
  const author = String(body.author || '').trim();
  const excerpt = normalizeOptionalString(body.excerpt);
  const content = sanitizeRichText(normalizeOptionalString(body.content) ?? null);
  const image = normalizeOptionalString(body.image);
  const category = normalizeOptionalString(body.category);
  const isPublished = body.isPublished ?? true;

  if (!title) throw new AppError('Blog title is required.', 400);
  if (!slug) throw new AppError('Blog slug is required.', 400);
  if (!author) throw new AppError('Blog author is required.', 400);
  if (!content) throw new AppError('Blog content is required.', 400);

  const existing = await prisma.blogPost.findFirst({
    where: {
      slug,
      ...(postId ? { NOT: { id: postId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new AppError('Blog slug is already in use.', 409);
  }

  return {
    title,
    slug,
    excerpt,
    content,
    image,
    author,
    category,
    isPublished,
  };
};

export const adminController = {
  getDashboard: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfSevenDayWindow = new Date(startOfToday);
      startOfSevenDayWindow.setDate(startOfSevenDayWindow.getDate() - 6);

      const toDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const sevenDayBuckets = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(startOfSevenDayWindow);
        date.setDate(startOfSevenDayWindow.getDate() + index);
        return {
          key: toDateKey(date),
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        };
      });

      const [
        totalOrders,
        totalRevenue,
        totalCustomers,
        totalProducts,
        recentOrders,
        ordersByStatus,
        ordersToday,
        revenueToday,
        averageOrderValue,
        monthRevenue,
        sevenDayOrders,
        topProducts,
        stockWatchProducts,
        recentCustomers,
      ] = await Promise.all([
        prisma.order.count(),
        prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: { not: 'CANCELLED' } } }),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.product.count({ where: { isActive: true } }),
        prisma.order.findMany({
          take: 8,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { fullName: true, username: true, email: true } },
          },
        }),
        prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
        prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            status: { not: 'CANCELLED' },
            createdAt: { gte: startOfToday },
          },
        }),
        prisma.order.aggregate({
          _avg: { totalAmount: true },
          where: { status: { not: 'CANCELLED' } },
        }),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            status: { not: 'CANCELLED' },
            createdAt: { gte: startOfMonth },
          },
        }),
        prisma.order.findMany({
          where: {
            status: { not: 'CANCELLED' },
            createdAt: { gte: startOfSevenDayWindow },
          },
          select: {
            createdAt: true,
            totalAmount: true,
          },
        }),
        prisma.product.findMany({
          take: 6,
          orderBy: [{ salesCount: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            name: true,
            sku: true,
            salesCount: true,
            stock: true,
            price: true,
            isActive: true,
          },
        }),
        prisma.product.findMany({
          take: 25,
          where: { isActive: true },
          orderBy: [{ stock: 'asc' }, { updatedAt: 'asc' }],
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
            lowStockThreshold: true,
          },
        }),
        prisma.user.findMany({
          take: 6,
          where: { role: 'CUSTOMER' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true,
          },
        }),
      ]);

      const ordersByStatusMap = ordersByStatus.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {});

      const revenueByDate = sevenDayBuckets.reduce<Record<string, { revenue: number; orders: number }>>((acc, bucket) => {
        acc[bucket.key] = { revenue: 0, orders: 0 };
        return acc;
      }, {});

      for (const order of sevenDayOrders) {
        const key = toDateKey(order.createdAt);
        if (!revenueByDate[key]) continue;
        revenueByDate[key].revenue += Number(order.totalAmount || 0);
        revenueByDate[key].orders += 1;
      }

      const revenueLast7Days = sevenDayBuckets.map((bucket) => ({
        date: bucket.key,
        label: bucket.label,
        revenue: revenueByDate[bucket.key]?.revenue || 0,
        orders: revenueByDate[bucket.key]?.orders || 0,
      }));

      const lowStockProducts = stockWatchProducts
        .filter((product) => product.stock <= product.lowStockThreshold)
        .slice(0, 6);

      res.json({
        success: true,
        data: {
          totalOrders,
          totalRevenue: totalRevenue._sum.totalAmount || 0,
          totalCustomers,
          totalProducts,
          ordersToday,
          revenueToday: revenueToday._sum.totalAmount || 0,
          averageOrderValue: averageOrderValue._avg.totalAmount || 0,
          monthRevenue: monthRevenue._sum.totalAmount || 0,
          recentOrders,
          recentCustomers,
          topProducts,
          lowStockProducts,
          revenueLast7Days,
          ordersByStatus: ordersByStatusMap,
        },
      });
    } catch (err) { next(err); }
  },

  getProducts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            category: { select: { name: true } },
            brand: { select: { id: true, name: true, slug: true } },
            variants: { include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } } },
            _count: { select: { variants: true, reviews: true } },
          },
        }),
        prisma.product.count(),
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

      res.json({ success: true, data: normalizedProducts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (err) { next(err); }
  },

  getProductById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'product ID');
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          variants: { include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } } },
          _count: { select: { variants: true, reviews: true } },
        },
      });

      if (!product) {
        throw new AppError('Product not found.', 404);
      }

      res.json({ success: true, data: product });
    } catch (err) { next(err); }
  },

  createProduct: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const createData: any = await createProductPayload(req.body);
      const product = await prisma.product.create({
        data: createData,
        include: { images: true, category: true, brand: true },
      });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'PRODUCT', product.id, {
          name: product.name,
          sku: product.sku,
          price: product.price,
          stock: product.stock,
        }, req.ip);
      }

      res.status(201).json({ success: true, data: product });
    } catch (err) { next(err); }
  },

  updateProduct: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'product ID');
      const existingProduct = await prisma.product.findUnique({
        where: { id },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          variants: {
            include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } },
          },
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
      });

      if (!existingProduct) {
        throw new AppError('Product not found.', 404);
      }

      const updateData: any = await createProductPayload({ ...existingProduct, ...req.body }, id);
      const product = await prisma.product.update({
        where: { id },
        data: updateData,
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          variants: {
            include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } },
          },
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
        },
      });

      if (req.userId) {
        const serializeImages = (imgs: any[]) =>
          (imgs || []).map((img: any) => img.url).join(', ') || '-';

        const serializeVariants = (variants: any[]) =>
          (variants || []).map((v: any) => {
            const attrs = (v.attributes || [])
              .map((a: any) => `${a.attributeValue?.attribute?.name}=${a.attributeValue?.value}`)
              .join(', ');
            return `[SKU:${v.sku} Price:${v.price} SalePrice:${v.salePrice ?? '-'} Stock:${v.stock}${attrs ? ` | ${attrs}` : ''}]`;
          }).join('; ') || '-';

        await logActivity(req.userId, 'UPDATE', 'PRODUCT', product.id, {
          previous: {
            name: existingProduct.name,
            sku: existingProduct.sku,
            price: existingProduct.price,
            salePrice: existingProduct.salePrice,
            stock: existingProduct.stock,
            isActive: existingProduct.isActive,
            isFeatured: existingProduct.isFeatured,
            brand: existingProduct.brand?.name ?? '-',
            category: existingProduct.category?.name ?? '-',
            images: serializeImages(existingProduct.images),
            variants: serializeVariants(existingProduct.variants),
          },
          current: {
            name: product.name,
            sku: product.sku,
            price: product.price,
            salePrice: product.salePrice,
            stock: product.stock,
            isActive: product.isActive,
            isFeatured: product.isFeatured,
            brand: (product.brand as any)?.name ?? '-',
            category: (product.category as any)?.name ?? '-',
            images: serializeImages((product as any).images),
            variants: serializeVariants((product as any).variants),
          },
        }, req.ip);
      }

      res.json({ success: true, data: product });
    } catch (err) { next(err); }
  },


  deleteProduct: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'product ID');
      const existingProduct = await prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          sku: true,
          _count: { select: { orderItems: true } },
        }
      });

      if (!existingProduct) {
        throw new AppError('Product not found.', 404);
      }
      if (existingProduct._count.orderItems > 0) {
        throw new AppError('Cannot delete a product with order history. Deactivate it instead.', 400);
      }

      await prisma.product.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'PRODUCT', id, existingProduct, req.ip);
      }

      res.json({ success: true, message: 'Product deleted' });
    } catch (err) { next(err); }
  },

  // ── Attributes ──────────────────────────────────────────────────────────────
  getAttributes: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const attributes = await prisma.productAttribute.findMany({
        orderBy: { name: 'asc' },
        include: {
          values: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { values: true } },
        },
      });
      res.json({ success: true, data: attributes });
    } catch (err) { next(err); }
  },

  createAttribute: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const name = String(req.body.name || '').trim();
      if (!name) throw new AppError('Attribute name is required.', 400);

      const slug = slugify(name, { lower: true, strict: true });
      if (!slug) throw new AppError('Could not generate a valid slug from the attribute name.', 400);

      const existing = await prisma.productAttribute.findFirst({ where: { OR: [{ name }, { slug }] } });
      if (existing) throw new AppError(`Attribute "${name}" already exists.`, 409);

      const attribute = await prisma.productAttribute.create({
        data: { name, slug },
        include: { values: true, _count: { select: { values: true } } },
      });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'ATTRIBUTE', attribute.id, { name, slug }, req.ip);
      }

      res.status(201).json({ success: true, data: attribute });
    } catch (err) { next(err); }
  },

  updateAttribute: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) throw new AppError('Invalid attribute ID.', 400);

      const name = String(req.body.name || '').trim();
      if (!name) throw new AppError('Attribute name is required.', 400);

      const slug = slugify(req.body.slug || name, { lower: true, strict: true });
      if (!slug) throw new AppError('Could not generate a valid slug.', 400);

      const existing = await prisma.productAttribute.findUnique({ where: { id } });
      if (!existing) throw new AppError('Attribute not found.', 404);

      const conflict = await prisma.productAttribute.findFirst({
        where: { OR: [{ name }, { slug }], NOT: { id } },
      });
      if (conflict) throw new AppError(`Another attribute with name or slug "${name}" already exists.`, 409);

      const updated = await prisma.productAttribute.update({
        where: { id },
        data: { name, slug },
        include: { values: { orderBy: { sortOrder: 'asc' } }, _count: { select: { values: true } } },
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'ATTRIBUTE', id, {
          previous: { name: existing.name, slug: existing.slug },
          current: { name: updated.name, slug: updated.slug },
        }, req.ip);
      }

      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  deleteAttribute: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) throw new AppError('Invalid attribute ID.', 400);

      const attribute = await prisma.productAttribute.findUnique({
        where: { id },
        include: {
          values: {
            select: { id: true, _count: { select: { variantAttributes: true } } },
          },
        },
      });
      if (!attribute) throw new AppError('Attribute not found.', 404);

      const usedByVariants = attribute.values.some((v: any) => v._count.variantAttributes > 0);
      if (usedByVariants) {
        throw new AppError(
          'Cannot delete this attribute because one or more of its values are used by product variants. Remove those variant assignments first.',
          400,
        );
      }

      await prisma.productAttribute.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'ATTRIBUTE', id, { name: attribute.name }, req.ip);
      }

      res.json({ success: true, message: 'Attribute deleted.' });
    } catch (err) { next(err); }
  },

  // ── Attribute Values ─────────────────────────────────────────────────────────
  createAttributeValue: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const attributeId = Number(req.body.attributeId);
      const value = String(req.body.value || '').trim();
      const colorHex = req.body.colorHex ? String(req.body.colorHex).trim() || null : null;
      const sortOrder = Number(req.body.sortOrder ?? 0);

      if (!attributeId || isNaN(attributeId)) throw new AppError('Invalid attributeId.', 400);
      if (!value) throw new AppError('Value is required.', 400);
      if (colorHex && !/^#[0-9a-fA-F]{6}$/.test(colorHex)) throw new AppError('colorHex must be a valid hex color (e.g. #FF0000).', 400);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new AppError('sortOrder must be a non-negative integer.', 400);

      const attribute = await prisma.productAttribute.findUnique({ where: { id: attributeId } });
      if (!attribute) throw new AppError('Parent attribute not found.', 404);

      const duplicate = await prisma.productAttributeValue.findFirst({ where: { attributeId, value } });
      if (duplicate) throw new AppError(`Value "${value}" already exists for this attribute.`, 409);

      const attrValue = await prisma.productAttributeValue.create({
        data: { attributeId, value, colorHex, sortOrder },
      });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'ATTRIBUTE_VALUE', attrValue.id, {
          attribute: attribute.name, value, colorHex, sortOrder,
        }, req.ip);
      }

      res.status(201).json({ success: true, data: attrValue });
    } catch (err) { next(err); }
  },

  updateAttributeValue: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) throw new AppError('Invalid attribute value ID.', 400);

      const value = String(req.body.value || '').trim();
      const colorHex = req.body.colorHex !== undefined ? (req.body.colorHex ? String(req.body.colorHex).trim() || null : null) : undefined;
      const sortOrder = req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : undefined;

      if (!value) throw new AppError('Value is required.', 400);
      if (colorHex !== undefined && colorHex !== null && !/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
        throw new AppError('colorHex must be a valid hex color (e.g. #FF0000).', 400);
      }
      if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
        throw new AppError('sortOrder must be a non-negative integer.', 400);
      }

      const existing = await prisma.productAttributeValue.findUnique({ where: { id } });
      if (!existing) throw new AppError('Attribute value not found.', 404);

      const conflict = await prisma.productAttributeValue.findFirst({
        where: { attributeId: existing.attributeId, value, NOT: { id } },
      });
      if (conflict) throw new AppError(`Value "${value}" already exists for this attribute.`, 409);

      const updateData: any = { value };
      if (colorHex !== undefined) updateData.colorHex = colorHex;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      const updated = await prisma.productAttributeValue.update({ where: { id }, data: updateData });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'ATTRIBUTE_VALUE', id, {
          previous: { value: existing.value, colorHex: existing.colorHex, sortOrder: existing.sortOrder },
          current: { value: updated.value, colorHex: updated.colorHex, sortOrder: updated.sortOrder },
        }, req.ip);
      }

      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  deleteAttributeValue: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) throw new AppError('Invalid attribute value ID.', 400);

      const attrValue = await prisma.productAttributeValue.findUnique({
        where: { id },
        include: { _count: { select: { variantAttributes: true } } },
      });
      if (!attrValue) throw new AppError('Attribute value not found.', 404);

      if ((attrValue as any)._count.variantAttributes > 0) {
        throw new AppError(
          `Cannot delete value "${attrValue.value}" because it is used by ${(attrValue as any)._count.variantAttributes} product variant(s). Remove those variant assignments first.`,
          400,
        );
      }

      await prisma.productAttributeValue.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'ATTRIBUTE_VALUE', id, { value: attrValue.value }, req.ip);
      }

      res.json({ success: true, message: 'Attribute value deleted.' });
    } catch (err) { next(err); }
  },

  getCategories: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { parent: { select: { name: true } }, _count: { select: { products: true, children: true } } },
      });
      res.json({ success: true, data: categories });
    } catch (err) { next(err); }
  },

  getBrands: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const brands = await prisma.brand.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { products: true } } },
      });

      res.json({ success: true, data: brands });
    } catch (err) {
      next(err);
    }
  },

  createBrand: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const name = String(req.body.name || '').trim();
      const slugInput = String(req.body.slug ?? name).trim();
      const slug = slugify(slugInput, { lower: true, strict: true });
      const sortOrder = Number(req.body.sortOrder ?? 0);
      const isActive = req.body.isActive ?? true;

      if (!name) throw new AppError('Brand name is required.', 400);
      if (!slug) throw new AppError('Unable to generate a valid brand slug.', 400);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new AppError('Sort order must be a non-negative integer.', 400);

      await ensureUniqueBrandFields(name, slug);

      const brand = await prisma.brand.create({
        data: { name, slug, sortOrder, isActive },
        include: { _count: { select: { products: true } } },
      });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'BRAND', brand.id, {
          name: brand.name,
          slug: brand.slug,
          sortOrder: brand.sortOrder,
          isActive: brand.isActive,
        }, req.ip);
      }

      res.status(201).json({ success: true, data: brand });
    } catch (err) {
      next(err);
    }
  },

  updateBrand: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'brand ID');
      const currentBrand = await prisma.brand.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } },
      });

      if (!currentBrand) throw new AppError('Brand not found.', 404);

      const name = String(req.body.name ?? currentBrand.name).trim();
      const slugInput = String(req.body.slug ?? name).trim();
      const slug = slugify(slugInput, { lower: true, strict: true });
      const sortOrder = req.body.sortOrder === undefined ? currentBrand.sortOrder : Number(req.body.sortOrder);
      const isActive = req.body.isActive ?? currentBrand.isActive;

      if (!name) throw new AppError('Brand name is required.', 400);
      if (!slug) throw new AppError('Unable to generate a valid brand slug.', 400);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new AppError('Sort order must be a non-negative integer.', 400);

      await ensureUniqueBrandFields(name, slug, id);

      const brand = await prisma.brand.update({
        where: { id },
        data: { name, slug, sortOrder, isActive },
        include: { _count: { select: { products: true } } },
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'BRAND', brand.id, {
          previous: {
            name: currentBrand.name,
            slug: currentBrand.slug,
            sortOrder: currentBrand.sortOrder,
            isActive: currentBrand.isActive,
          },
          current: {
            name: brand.name,
            slug: brand.slug,
            sortOrder: brand.sortOrder,
            isActive: brand.isActive,
          },
        }, req.ip);
      }

      res.json({ success: true, data: brand });
    } catch (err) {
      next(err);
    }
  },

  deleteBrand: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'brand ID');
      const brand = await prisma.brand.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } },
      });

      if (!brand) throw new AppError('Brand not found.', 404);

      if ((brand._count?.products || 0) > 0) {
        throw new AppError('Cannot delete a brand that still has products. Reassign those products first.', 400);
      }

      await prisma.brand.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'BRAND', id, {
          name: brand.name,
          slug: brand.slug,
        }, req.ip);
      }

      res.json({ success: true, message: 'Brand deleted' });
    } catch (err) {
      next(err);
    }
  },

  createCategory: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const name = String(req.body.name || '').trim();
      const slug = slugify(name, { lower: true, strict: true });
      const description = normalizeOptionalString(req.body.description);
      const image = normalizeOptionalString(req.body.image);
      const sortOrder = Number(req.body.sortOrder ?? 0);
      const parentId = req.body.parentId === null || req.body.parentId === undefined || req.body.parentId === ''
        ? null
        : Number(req.body.parentId);

      if (!name) throw new AppError('Category name is required.', 400);
      if (!slug) throw new AppError('Unable to generate a valid category slug.', 400);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new AppError('Sort order must be a non-negative integer.', 400);
      if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) throw new AppError('Invalid parent category.', 400);

      await ensureUniqueCategorySlug(slug);
      await ensureCategoryHierarchy(parentId);

      const category = await prisma.category.create({
        data: {
          name,
          slug,
          description,
          parentId,
          image,
          sortOrder,
          isActive: req.body.isActive ?? true,
        },
        include: { parent: { select: { name: true } }, _count: { select: { products: true, children: true } } },
      });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'CATEGORY', category.id, {
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
        }, req.ip);
      }

      res.status(201).json({ success: true, data: category });
    } catch (err) { next(err); }
  },

  updateCategory: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'category ID');
      const currentCategory = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { products: true, children: true } } },
      });

      if (!currentCategory) {
        throw new AppError('Category not found.', 404);
      }

      const name = String(req.body.name ?? currentCategory.name).trim();
      const slug = slugify(name, { lower: true, strict: true });
      const description = req.body.description === undefined ? currentCategory.description : normalizeOptionalString(req.body.description);
      const image = req.body.image === undefined ? currentCategory.image : normalizeOptionalString(req.body.image);
      const sortOrder = req.body.sortOrder === undefined ? currentCategory.sortOrder : Number(req.body.sortOrder);
      const parentId = req.body.parentId === undefined
        ? currentCategory.parentId
        : (req.body.parentId === null || req.body.parentId === '' ? null : Number(req.body.parentId));

      if (!name) throw new AppError('Category name is required.', 400);
      if (!slug) throw new AppError('Unable to generate a valid category slug.', 400);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new AppError('Sort order must be a non-negative integer.', 400);
      if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) throw new AppError('Invalid parent category.', 400);

      await ensureUniqueCategorySlug(slug, id);
      await ensureCategoryHierarchy(parentId, id);

      const category = await prisma.category.update({
        where: { id },
        data: {
          name,
          slug,
          description,
          image,
          parentId,
          sortOrder,
          isActive: req.body.isActive ?? currentCategory.isActive,
        },
        include: { parent: { select: { name: true } }, _count: { select: { products: true, children: true } } },
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'CATEGORY', category.id, {
          previous: {
            name: currentCategory.name,
            slug: currentCategory.slug,
            parentId: currentCategory.parentId,
            sortOrder: currentCategory.sortOrder,
            isActive: currentCategory.isActive,
          },
          current: {
            name: category.name,
            slug: category.slug,
            parentId: category.parentId,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
          },
        }, req.ip);
      }

      res.json({ success: true, data: category });
    } catch (err) { next(err); }
  },

  deleteCategory: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'category ID');
      const category = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { products: true, children: true } } },
      });

      if (!category) {
        throw new AppError('Category not found.', 404);
      }
      if (category._count.children > 0) {
        throw new AppError('Cannot delete a category with child categories.', 400);
      }
      if (category._count.products > 0) {
        throw new AppError('Cannot delete a category that still has products.', 400);
      }

      await prisma.category.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'CATEGORY', id, {
          name: category.name,
          slug: category.slug,
        }, req.ip);
      }

      res.json({ success: true, message: 'Category deleted' });
    } catch (err) { next(err); }
  },

  getOrders: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const paymentStatus = req.query.paymentStatus as string;
      const where: any = {};
      if (status && ORDER_STATUSES.includes(status as typeof ORDER_STATUSES[number])) where.status = status;
      if (paymentStatus && PAYMENT_STATUSES.includes(paymentStatus as typeof PAYMENT_STATUSES[number])) where.paymentStatus = paymentStatus;

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { fullName: true, username: true, email: true, phone: true } },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    images: {
                      take: 1,
                      orderBy: [
                        { isPrimary: 'desc' },
                        { sortOrder: 'asc' },
                      ],
                      select: { url: true, alt: true },
                    },
                  },
                },
              },
            },
            address: true
          },
        }),
        prisma.order.count({ where }),
      ]);
      res.json({
        success: true,
        data: orders.map((order) => serializeAdminOrderWithProtectedProof(order)),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) { next(err); }
  },

  updateOrderStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'order ID');
      const status = String(req.body.status || '').trim().toUpperCase();
      if (!ORDER_STATUSES.includes(status as typeof ORDER_STATUSES[number])) throw new AppError('Invalid status.', 400);

      const currentOrder = await prisma.order.findUnique({ where: { id } });
      if (!currentOrder) throw new AppError('Order not found', 404);
      if (currentOrder.status === status) {
        return res.json({ success: true, data: currentOrder });
      }

      if (currentOrder.status === 'DELIVERED') {
        throw new AppError('Cannot update status of a delivered order.', 400);
      }

      const allowedTransitions: Record<string, string[]> = {
        PENDING: ['CONFIRMED', 'CANCELLED'],
        CONFIRMED: ['SHIPPING', 'CANCELLED'],
        SHIPPING: ['DELIVERED', 'CANCELLED'],
        CANCELLED: [],
        DELIVERED: [],
      };

      if (!allowedTransitions[currentOrder.status]?.includes(status)) {
        throw new AppError(`Cannot move order from ${currentOrder.status} to ${status}.`, 400);
      }

      const order = await prisma.order.update({
        where: { id },
        data: {
          status: status as any,
          ...(status === 'DELIVERED' && currentOrder.paymentMethod === 'COD' && currentOrder.paymentStatus === 'UNPAID'
            ? { paymentStatus: 'PAID' as any }
            : {}),
        },
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'ORDER', order.id, {
          previousStatus: currentOrder.status,
          currentStatus: order.status,
          paymentStatus: order.paymentStatus,
        }, req.ip);
      }

      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  },

  updatePaymentStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'order ID');
      const paymentStatus = String(req.body.paymentStatus || '').trim().toUpperCase();

      if (!PAYMENT_STATUSES.includes(paymentStatus as typeof PAYMENT_STATUSES[number])) {
        throw new AppError('Invalid payment status.', 400);
      }

      const currentOrder = await prisma.order.findUnique({ where: { id } });
      if (!currentOrder) {
        throw new AppError('Order not found.', 404);
      }
      if (currentOrder.paymentStatus === paymentStatus) {
        return res.json({ success: true, data: currentOrder });
      }

      const allowedTransitions: Record<string, string[]> = {
        UNPAID: ['PAID'],
        PAID: ['UNPAID', 'REFUNDED'],
        REFUNDED: [],
      };

      if (!allowedTransitions[currentOrder.paymentStatus]?.includes(paymentStatus)) {
        throw new AppError(`Cannot move payment status from ${currentOrder.paymentStatus} to ${paymentStatus}.`, 400);
      }

      const order = await prisma.order.update({
        where: { id },
        data: { paymentStatus: paymentStatus as any },
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'ORDER', order.id, {
          previousPaymentStatus: currentOrder.paymentStatus,
          currentPaymentStatus: order.paymentStatus,
          orderStatus: order.status,
        }, req.ip);
      }

      res.json({ success: true, data: order });
    } catch (err) { next(err); }
  },

  getCustomers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = String(req.query.search || '').trim();
      const segmentRaw = String(req.query.segment || 'ALL').trim().toUpperCase();
      const sortRaw = String(req.query.sort || 'NEWEST').trim().toUpperCase();
      const segment = (CUSTOMER_SEGMENTS as readonly string[]).includes(segmentRaw) ? segmentRaw : 'ALL';
      const sort = (CUSTOMER_SORT_OPTIONS as readonly string[]).includes(sortRaw) ? sortRaw : 'NEWEST';

      const customerWhere: any = {
        role: 'CUSTOMER' as const,
        ...(search ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      };

      if (segment === 'NEW') {
        const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        customerWhere.createdAt = { gte: threshold };
      }

      if (segment === 'HAS_PHONE') {
        customerWhere.phone = { not: null };
      }

      if (segment === 'NO_ORDERS') {
        customerWhere.orders = { none: {} };
      }

      if (segment === 'RETURNING') {
        const groupedOrders = await prisma.order.groupBy({
          by: ['userId'],
          _count: { _all: true },
          having: {
            userId: {
              _count: {
                gte: 2,
              },
            },
          },
        });

        const returningUserIds = groupedOrders.map((order) => order.userId);
        customerWhere.id = returningUserIds.length ? { in: returningUserIds } : { in: [-1] };
      }

      let orderBy: any = { createdAt: 'desc' };
      if (sort === 'OLDEST') orderBy = { createdAt: 'asc' };
      if (sort === 'NAME_ASC') orderBy = { fullName: 'asc' };
      if (sort === 'ORDERS_DESC') {
        orderBy = [
          { orders: { _count: 'desc' } },
          { createdAt: 'desc' },
        ];
      }

      const [customers, total] = await Promise.all([
        prisma.user.findMany({
          where: customerWhere,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          select: { id: true, email: true, fullName: true, username: true, phone: true, createdAt: true, isActive: true, _count: { select: { orders: true } } },
        }),
        prisma.user.count({ where: customerWhere }),
      ]);
      res.json({ success: true, data: customers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (err) { next(err); }
  },

  getCustomerRecentOrders: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = parseEntityId(req.params.id as string, 'customer ID');
      const rawLimit = parseInt(req.query.limit as string, 10) || 5;
      const limit = Math.min(Math.max(rawLimit, 1), 20);

      const customer = await prisma.user.findFirst({
        where: {
          id: customerId,
          role: 'CUSTOMER',
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          username: true,
          phone: true,
          createdAt: true,
          isActive: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
      });

      if (!customer) {
        throw new AppError('Customer not found.', 404);
      }

      const recentOrders = await prisma.order.findMany({
        where: { userId: customerId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          totalAmount: true,
          createdAt: true,
          _count: { select: { items: true } },
          items: {
            take: 3,
            select: {
              id: true,
              productName: true,
              quantity: true,
              price: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: {
          customer,
          orders: recentOrders,
        },
      });
    } catch (err) { next(err); }
  },

  customerStatusStream: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }

      const sendEvent = (eventName: string, payload: unknown) => {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      sendEvent('connected', {
        ok: true,
        timestamp: new Date().toISOString(),
      });

      const unsubscribe = subscribeCustomerStatusChanged((payload) => {
        sendEvent('customer-status-changed', payload);
      });

      const heartbeat = setInterval(() => {
        res.write(': keep-alive\n\n');
      }, 25000);

      req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
      });
    } catch (err) {
      next(err);
    }
  },

  updateCustomerActive: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = parseEntityId(req.params.id as string, 'customer ID');
      const isActive = req.body?.isActive;

      if (typeof isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean.', 400);
      }

      const currentCustomer = await prisma.user.findFirst({
        where: {
          id: customerId,
          role: 'CUSTOMER',
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          username: true,
          phone: true,
          createdAt: true,
          isActive: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
      });

      if (!currentCustomer) {
        throw new AppError('Customer not found.', 404);
      }

      if (currentCustomer.isActive === isActive) {
        return res.json({ success: true, data: currentCustomer });
      }

      const updatedCustomer = await prisma.user.update({
        where: { id: customerId },
        data: { isActive },
        select: {
          id: true,
          email: true,
          fullName: true,
          username: true,
          phone: true,
          createdAt: true,
          isActive: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'CUSTOMER', customerId, {
          previousIsActive: currentCustomer.isActive,
          currentIsActive: updatedCustomer.isActive,
          customerEmail: updatedCustomer.email,
        }, req.ip);
      }

      emitCustomerStatusChanged({
        customerId,
        isActive: updatedCustomer.isActive,
        updatedBy: req.userId || null,
        updatedAt: new Date().toISOString(),
      });

      res.json({ success: true, data: updatedCustomer });
    } catch (err) { next(err); }
  },

  getCoupons: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const req = _req;
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim().toUpperCase();
      const type = String(req.query.type || '').trim().toUpperCase();
      const sort = String(req.query.sort || 'NEWEST').trim().toUpperCase();
      const now = new Date();

      const andClauses: any[] = [];

      if (search) {
        andClauses.push({ code: { contains: search, mode: 'insensitive' } });
      }

      if (type === 'PERCENTAGE' || type === 'FIXED_AMOUNT') {
        andClauses.push({ type });
      }

      if (status === 'ACTIVE') {
        andClauses.push({ isActive: true }, { startDate: { lte: now } }, { endDate: { gte: now } });
      }
      if (status === 'INACTIVE') {
        andClauses.push({ isActive: false });
      }
      if (status === 'EXPIRED') {
        andClauses.push({ endDate: { lt: now } });
      }
      if (status === 'SCHEDULED') {
        andClauses.push({ startDate: { gt: now } });
      }

      const where = andClauses.length ? { AND: andClauses } : undefined;

      const orderBy =
        sort === 'OLDEST' ? { createdAt: 'asc' as const }
          : sort === 'CODE_ASC' ? { code: 'asc' as const }
            : sort === 'CODE_DESC' ? { code: 'desc' as const }
              : sort === 'VALUE_ASC' ? { value: 'asc' as const }
                : sort === 'VALUE_DESC' ? { value: 'desc' as const }
                  : sort === 'USAGE_DESC' ? [{ usedCount: 'desc' as const }, { createdAt: 'desc' as const }]
                    : sort === 'ENDING_SOON' ? [{ endDate: 'asc' as const }, { createdAt: 'desc' as const }]
                      : { createdAt: 'desc' as const };

      const [coupons, totalCoupons, activeCoupons, inactiveCoupons, expiredCoupons, scheduledCoupons] = await Promise.all([
        prisma.coupon.findMany({ where, orderBy }),
        prisma.coupon.count(),
        prisma.coupon.count({ where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } } }),
        prisma.coupon.count({ where: { isActive: false } }),
        prisma.coupon.count({ where: { endDate: { lt: now } } }),
        prisma.coupon.count({ where: { startDate: { gt: now } } }),
      ]);

      res.json({
        success: true,
        data: coupons,
        stats: {
          totalCoupons,
          activeCoupons,
          inactiveCoupons,
          expiredCoupons,
          scheduledCoupons,
        },
      });
    } catch (err) { next(err); }
  },

  updateCouponActive: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'coupon ID');
      const isActive = req.body?.isActive;

      if (typeof isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean.', 400);
      }

      const currentCoupon = await prisma.coupon.findUnique({ where: { id } });
      if (!currentCoupon) {
        throw new AppError('Coupon not found.', 404);
      }

      if (currentCoupon.isActive === isActive) {
        return res.json({ success: true, data: currentCoupon });
      }

      const coupon = await prisma.coupon.update({
        where: { id },
        data: { isActive },
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'COUPON', coupon.id, {
          previousIsActive: currentCoupon.isActive,
          currentIsActive: coupon.isActive,
          code: coupon.code,
        }, req.ip);
      }

      res.json({ success: true, data: coupon });
    } catch (err) { next(err); }
  },

  bulkUpdateCouponActive: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const isActive = req.body?.isActive;
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0)
        : [];

      if (typeof isActive !== 'boolean') {
        throw new AppError('isActive must be a boolean.', 400);
      }

      if (!ids.length) {
        throw new AppError('No valid coupon IDs provided.', 400);
      }

      const coupons = await prisma.coupon.findMany({
        where: { id: { in: ids } },
        select: { id: true, code: true, isActive: true },
      });

      if (!coupons.length) {
        throw new AppError('Coupons not found.', 404);
      }

      await prisma.coupon.updateMany({
        where: { id: { in: coupons.map((coupon) => coupon.id) } },
        data: { isActive },
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'COUPON', null, {
          action: isActive ? 'BULK_ACTIVATE' : 'BULK_DEACTIVATE',
          couponIds: coupons.map((coupon) => coupon.id),
          affectedCount: coupons.length,
        }, req.ip);
      }

      res.json({ success: true, message: `Updated ${coupons.length} coupon(s).` });
    } catch (err) { next(err); }
  },

  createCoupon: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const payload: any = await validateCouponPayload(req.body);
      const coupon = await prisma.coupon.create({ data: payload });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'COUPON', coupon.id, {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
        }, req.ip);
      }

      res.status(201).json({ success: true, data: coupon });
    } catch (err) { next(err); }
  },

  updateCoupon: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'coupon ID');
      const currentCoupon = await prisma.coupon.findUnique({ where: { id } });
      if (!currentCoupon) {
        throw new AppError('Coupon not found.', 404);
      }

      const payload: any = await validateCouponPayload(req.body, id);
      const coupon = await prisma.coupon.update({ where: { id }, data: payload });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'COUPON', coupon.id, {
          previous: {
            code: currentCoupon.code,
            type: currentCoupon.type,
            value: currentCoupon.value,
            isActive: currentCoupon.isActive,
          },
          current: {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            isActive: coupon.isActive,
          },
        }, req.ip);
      }

      res.json({ success: true, data: coupon });
    } catch (err) { next(err); }
  },

  deleteCoupon: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'coupon ID');
      const coupon = await prisma.coupon.findUnique({
        where: { id },
        include: { _count: { select: { orders: true } } },
      });

      if (!coupon) {
        throw new AppError('Coupon not found.', 404);
      }
      if (coupon._count.orders > 0) {
        throw new AppError('Cannot delete a coupon that has been used in orders.', 400);
      }

      await prisma.coupon.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'COUPON', id, {
          code: coupon.code,
          type: coupon.type,
        }, req.ip);
      }

      res.json({ success: true, message: 'Coupon deleted' });
    } catch (err) { next(err); }
  },

  getShippingMethods: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const methods = await prisma.shippingMethod.findMany({
        orderBy: { createdAt: 'desc' },
        include: { zones: { orderBy: { id: 'asc' } } }
      });
      res.json({ success: true, data: methods });
    } catch (err) { next(err); }
  },

  createShippingMethod: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const payload = validateShippingMethodPayload(req.body);
      const method = await prisma.shippingMethod.create({
        data: {
          name: payload.name,
          description: payload.description,
          isActive: payload.isActive,
          zones: { create: payload.zones },
        },
        include: { zones: { orderBy: { id: 'asc' } } }
      });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'SHIPPING_METHOD', method.id, {
          name: method.name,
          description: method.description,
          zoneCount: method.zones.length,
          isActive: method.isActive,
        }, req.ip);
      }

      res.status(201).json({ success: true, data: method });
    } catch (err) { next(err); }
  },

  updateShippingMethod: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'shipping method ID');
      const currentMethod = await prisma.shippingMethod.findUnique({
        where: { id },
        include: { zones: true },
      });

      if (!currentMethod) {
        throw new AppError('Shipping method not found.', 404);
      }

      const payload = validateShippingMethodPayload(req.body);
      const method = await prisma.shippingMethod.update({
        where: { id },
        data: {
          name: payload.name,
          description: payload.description,
          isActive: payload.isActive,
          zones: {
            deleteMany: {},
            create: payload.zones,
          },
        },
        include: { zones: { orderBy: { id: 'asc' } } }
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'SHIPPING_METHOD', method.id, {
          previous: {
            name: currentMethod.name,
            description: currentMethod.description,
            isActive: currentMethod.isActive,
            zoneCount: currentMethod.zones.length,
          },
          current: {
            name: method.name,
            description: method.description,
            isActive: method.isActive,
            zoneCount: method.zones.length,
          },
        }, req.ip);
      }

      res.json({ success: true, data: method });
    } catch (err) { next(err); }
  },

  deleteShippingMethod: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'shipping method ID');
      const method = await prisma.shippingMethod.findUnique({
        where: { id },
        include: { zones: true },
      });

      if (!method) {
        throw new AppError('Shipping method not found.', 404);
      }

      await prisma.shippingMethod.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'SHIPPING_METHOD', id, {
          name: method.name,
          description: method.description,
          zoneCount: method.zones.length,
        }, req.ip);
      }

      res.json({ success: true, message: 'Shipping method deleted' });
    } catch (err) { next(err); }
  },

  getBlogPosts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = String(req.query.search || '').trim();

      const where: any = {};
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      const [posts, total] = await Promise.all([
        prisma.blogPost.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.blogPost.count({ where })
      ]);

      res.json({
        success: true,
        data: posts,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch(e) { next(e); }
  },

  createBlogPost: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const payload = await validateBlogPostPayload(req.body);
      const post = await prisma.blogPost.create({
        data: {
          ...payload,
          publishedAt: new Date(),
        }
      });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'BLOG_POST', post.id, {
          title: post.title,
          slug: post.slug,
          isPublished: post.isPublished,
        }, req.ip);
      }

      res.status(201).json({ success: true, data: post });
    } catch(e) { next(e); }
  },

  updateBlogPost: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'blog post ID');
      const currentPost = await prisma.blogPost.findUnique({ where: { id } });
      if (!currentPost) {
        throw new AppError('Blog post not found.', 404);
      }

      const payload = await validateBlogPostPayload(req.body, id);
      const post = await prisma.blogPost.update({
        where: { id },
        data: {
          ...payload,
          publishedAt: payload.isPublished
            ? (currentPost.isPublished ? currentPost.publishedAt : new Date())
            : currentPost.publishedAt,
        }
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'BLOG_POST', post.id, {
          previous: {
            title: currentPost.title,
            slug: currentPost.slug,
            isPublished: currentPost.isPublished,
          },
          current: {
            title: post.title,
            slug: post.slug,
            isPublished: post.isPublished,
          },
        }, req.ip);
      }

      res.json({ success: true, data: post });
    } catch(e) { next(e); }
  },

  deleteBlogPost: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseEntityId(req.params.id as string, 'blog post ID');
      const post = await prisma.blogPost.findUnique({ where: { id } });
      if (!post) {
        throw new AppError('Blog post not found.', 404);
      }

      await prisma.blogPost.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'BLOG_POST', id, {
          title: post.title,
          slug: post.slug,
        }, req.ip);
      }

      res.json({ success: true, message: 'Blog post deleted' });
    } catch(e) { next(e); }
  }
};
