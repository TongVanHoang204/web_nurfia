import { z } from 'zod';
import { ADMIN_PERMISSIONS } from '../middlewares/auth.js';

const optionalNullableString = (max: number) =>
  z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().max(max).nullable().optional()
  );

const optionalPositiveIntOrNull = z.preprocess(
  (value) => value === '' || value === null ? null : value,
  z.coerce.number().int().positive().nullable().optional()
);

const urlOrAssetPath = z.string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    if (value.startsWith('/uploads/') || value.startsWith('uploads/') || value.startsWith('/assets/')) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Must be an http/https URL or local asset path');

const nonNegativeMoney = z.coerce.number().finite().min(0);
const positiveMoney = z.coerce.number().finite().positive();
const positiveInt = z.preprocess(
  (value) => typeof value === 'string' ? Number(value) : value,
  z.number().int().positive('ID must be a positive integer')
);
const nonNegativeInt = z.preprocess(
  (value) => typeof value === 'string' ? Number(value) : value,
  z.number().int().min(0)
);
const optionalDateString = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Must be a valid date',
}).optional();

const boundedString = (max: number) => z.string().trim().max(max);

const paginationQueryBase = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const dashboardQuerySchema = z.object({
  range: z.enum(['7d', '30d', 'all']).optional(),
});

export const adminListQuerySchema = paginationQueryBase.extend({
  search: boundedString(120).optional(),
  sort: boundedString(40).optional(),
  status: boundedString(40).optional(),
  role: z.enum(['ALL', 'ADMIN', 'STAFF', 'MANAGER']).optional(),
});

export const adminOrderQuerySchema = paginationQueryBase.extend({
  status: boundedString(40).optional(),
  paymentStatus: boundedString(40).optional(),
});

export const adminCustomerQuerySchema = paginationQueryBase.extend({
  search: boundedString(120).optional(),
  segment: boundedString(40).optional(),
  sort: boundedString(40).optional(),
});

export const adminCustomerRecentOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const adminCouponQuerySchema = paginationQueryBase.extend({
  search: boundedString(120).optional(),
  status: boundedString(40).optional(),
  type: boundedString(40).optional(),
  sort: boundedString(40).optional(),
});

export const adminReviewQuerySchema = paginationQueryBase.extend({
  search: boundedString(120).optional(),
  status: z.enum(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'UNAPPROVED']).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: boundedString(40).optional(),
});

export const adminInventoryStockQuerySchema = paginationQueryBase.extend({
  search: boundedString(120).optional(),
  status: z.enum(['ALL', 'LOW', 'OUT', 'IN_STOCK']).optional(),
  lowThreshold: z.coerce.number().int().min(0).max(100000).optional(),
});

export const adminInventoryHistoryQuerySchema = paginationQueryBase.extend({
  search: boundedString(120).optional(),
  type: z.enum(['ALL', 'IN', 'OUT', 'ADJUSTMENT', 'RETURN']).optional(),
  startDate: optionalDateString,
  endDate: optionalDateString,
});

export const adminActivityQuerySchema = paginationQueryBase.extend({
  search: boundedString(120).optional(),
  sort: z.enum(['NEWEST', 'OLDEST']).optional(),
  action: boundedString(80).optional(),
  entityType: boundedString(80).optional(),
  entityId: positiveInt.optional(),
  startDate: optionalDateString,
  endDate: optionalDateString,
});

export const adminIdParamSchema = z.object({
  id: positiveInt,
});

export const adminProductIdParamSchema = z.object({
  productId: positiveInt,
});

export const booleanToggleSchema = z.object({
  isActive: z.boolean(),
});

export const reviewApprovalSchema = z.object({
  isApproved: z.boolean(),
});

export const bulkIdsSchema = z.object({
  ids: z.array(positiveInt).min(1).max(100),
});

export const bulkActiveSchema = bulkIdsSchema.extend({
  isActive: z.boolean(),
});

const productImageSchema = z.object({
  url: urlOrAssetPath,
  alt: optionalNullableString(200),
}).passthrough();

const productVariantSchema = z.object({
  sku: z.string().trim().max(100).optional(),
  price: positiveMoney.optional(),
  salePrice: z.preprocess((value) => value === '' || value === null ? null : value, positiveMoney.nullable().optional()),
  stock: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  attributes: z.array(positiveInt).max(50).optional(),
}).passthrough();

const productBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(100),
  price: positiveMoney,
  salePrice: z.preprocess((value) => value === '' || value === null ? null : value, positiveMoney.nullable().optional()),
  stock: z.coerce.number().int().min(0),
  categoryId: optionalPositiveIntOrNull,
  brandId: optionalPositiveIntOrNull,
  shortDescription: optionalNullableString(1000),
  description: optionalNullableString(50000),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  images: z.array(productImageSchema).max(20).optional(),
  variants: z.array(productVariantSchema).max(200).optional(),
  autoGenerateVariantSku: z.boolean().optional(),
}).passthrough();

export const productSchema = productBaseSchema.refine((value) => value.salePrice === null || value.salePrice === undefined || value.salePrice <= value.price, {
  message: 'Sale price cannot exceed regular price',
  path: ['salePrice'],
});

export const updateProductSchema = productBaseSchema.partial().passthrough().refine(
  (value: Record<string, unknown>) => Object.keys(value).length > 0,
  { message: 'At least one field is required' }
);

const categoryBaseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: optionalNullableString(1000),
  image: optionalNullableString(2048),
  parentId: optionalPositiveIntOrNull,
  sortOrder: nonNegativeInt.optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const categorySchema = categoryBaseSchema;
export const updateCategorySchema = categoryBaseSchema.partial().refine(
  (value: Record<string, unknown>) => Object.keys(value).length > 0,
  { message: 'At least one field is required' }
);

const brandBaseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().max(180).optional(),
  sortOrder: nonNegativeInt.optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const brandSchema = brandBaseSchema;
export const updateBrandSchema = brandBaseSchema.partial().refine(
  (value: Record<string, unknown>) => Object.keys(value).length > 0,
  { message: 'At least one field is required' }
);

const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/^\S+$/, 'Password cannot contain spaces');

const permissionSchema = z.enum(ADMIN_PERMISSIONS);

export const createStaffSchema = z.object({
  username: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(255),
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(100),
  role: z.enum(['STAFF', 'MANAGER']).optional().default('STAFF'),
  permissions: z.array(permissionSchema).max(ADMIN_PERMISSIONS.length).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateStaffSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['STAFF', 'MANAGER']).optional(),
  permissions: z.array(permissionSchema).max(ADMIN_PERMISSIONS.length).optional(),
  isActive: z.boolean().optional(),
  password: z.union([passwordSchema, z.literal('')]).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED']),
});

export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.enum(['UNPAID', 'PAID', 'REFUNDED']),
});

export const inventoryUpdateSchema = z.object({
  productId: positiveInt,
  variantId: optionalPositiveIntOrNull,
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'RETURN']),
  change: z.coerce.number().finite().min(0),
  note: z.string().trim().max(500).optional().default(''),
});

const bannerBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: optionalNullableString(500),
  imageUrl: urlOrAssetPath.optional().default(''),
  videoUrl: z.preprocess((value) => value === '' ? null : value, urlOrAssetPath.nullable().optional()),
  linkUrl: optionalNullableString(2048),
  buttonText: optionalNullableString(80),
  position: z.string().trim().min(1).max(80).optional().default('homepage'),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const bannerSchema = bannerBaseSchema.refine((value) => Boolean(value.imageUrl || value.videoUrl), {
  message: 'Banner requires at least an image or a video',
  path: ['imageUrl'],
});

export const updateBannerSchema = bannerBaseSchema.partial().refine(
  (value: Record<string, unknown>) => Object.keys(value).length > 0,
  { message: 'At least one field is required' }
);

export const couponSchema = z.object({
  code: z.string().trim().min(1).max(50),
  type: z.enum(['PERCENTAGE', 'FIXED', 'FIXED_AMOUNT']),
  value: positiveMoney,
  minOrderValue: z.preprocess((value) => value === '' || value === null ? null : value, nonNegativeMoney.nullable().optional()),
  maxDiscount: z.preprocess((value) => value === '' || value === null ? null : value, positiveMoney.nullable().optional()),
  usageLimit: z.preprocess((value) => value === '' || value === null ? null : value, z.coerce.number().int().positive().nullable().optional()),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().optional().default(true),
}).refine((value) => value.type !== 'PERCENTAGE' || value.value <= 100, {
  message: 'Percentage coupon cannot exceed 100',
  path: ['value'],
}).refine((value) => value.endDate > value.startDate, {
  message: 'Coupon end date must be after start date',
  path: ['endDate'],
});

const shippingZoneSchema = z.object({
  zoneName: z.string().trim().min(1).max(100),
  cost: nonNegativeMoney,
  freeShipMinOrder: z.preprocess((value) => value === '' || value === null ? null : value, nonNegativeMoney.nullable().optional()),
});

export const shippingMethodSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalNullableString(500),
  isActive: z.boolean().optional().default(true),
  zones: z.array(shippingZoneSchema).min(1).max(100),
});

export const blogPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(220).optional(),
  excerpt: optionalNullableString(1000),
  content: z.string().trim().min(1).max(50000),
  image: z.preprocess((value) => value === '' ? null : value, urlOrAssetPath.nullable().optional()),
  author: z.string().trim().min(1).max(100),
  category: optionalNullableString(100),
  isPublished: z.boolean().optional().default(true),
});
