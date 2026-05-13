import { z } from 'zod';

const phoneRegex = /^\+?\d{9,15}$/;
const uploadedFilePathRegex = /^\/uploads\/[^/\\]+\.(?:jpe?g|png|webp)$/i;

const positiveIntSchema = z.preprocess(
  (value) => typeof value === 'string' ? Number(value) : value,
  z.number().int().positive('ID must be a positive integer')
);

const orderAddressText = (field: string, max = 100) =>
  z.string().trim().min(1, `${field} is required`).max(max, `${field} must be at most ${max} characters`);

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  email: z.string().trim().email('Invalid email format').max(255, 'Email must be at most 255 characters'),
  subject: z.string().trim().min(1, 'Subject is required').max(255, 'Subject must be at most 255 characters'),
  message: z.string().trim().max(5000, 'Message must be at most 5000 characters').optional().default(''),
});

export const newsletterSchema = z.object({
  email: z.string().trim().email('Invalid email format').max(255, 'Email must be at most 255 characters'),
});

export const adminContactReplySchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(255, 'Subject must be at most 255 characters'),
  message: z.string().trim().min(1, 'Reply message is required').max(5000, 'Reply message must be at most 5000 characters'),
});

export const addressSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(200, 'Full name must be at most 200 characters'),
  phone: z.string().trim().regex(phoneRegex, 'Phone number must contain 9 to 15 digits'),
  province: z.string().trim().min(1, 'Province is required').max(100, 'Province must be at most 100 characters'),
  district: z.string().trim().min(1, 'District is required').max(100, 'District must be at most 100 characters'),
  ward: z.string().trim().min(1, 'Ward is required').max(100, 'Ward must be at most 100 characters'),
  streetAddress: z.string().trim().min(1, 'Street address is required').max(255, 'Street address must be at most 255 characters'),
  isDefault: z.boolean().optional().default(false),
});

export const orderIdParamSchema = z.object({
  id: positiveIntSchema,
});

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1, 'Coupon code is required').max(50, 'Coupon code must be at most 50 characters'),
  subtotal: z.coerce.number().finite('Subtotal must be a valid number').min(0, 'Subtotal cannot be negative'),
});

export const shippingOptionsSchema = z.object({
  shippingProvince: orderAddressText('Shipping province'),
  shippingDistrict: orderAddressText('Shipping district'),
  shippingWard: orderAddressText('Shipping ward'),
});

export const createOrderSchema = shippingOptionsSchema.extend({
  paymentMethod: z.enum(['COD', 'BANK_TRANSFER', 'MOMO']).default('COD'),
  shippingMethodId: z.coerce.number().int().positive('Please select a valid shipping method'),
  shippingName: orderAddressText('Shipping name', 200),
  shippingPhone: z.string().trim().regex(phoneRegex, 'Shipping phone must contain 9 to 15 digits'),
  shippingEmail: z.string().trim().email('Invalid shipping email format').max(255),
  shippingStreet: orderAddressText('Shipping street', 255),
  couponCode: z.string().trim().max(50).optional().default(''),
  note: z.string().trim().max(1000, 'Note must be at most 1000 characters').optional().default(''),
});

export const bankTransferProofSchema = z.object({
  bankTransferImage: z.string()
    .trim()
    .max(255, 'Bank transfer proof path is too long')
    .regex(uploadedFilePathRegex, 'Bank transfer proof must be an uploaded image from this site'),
});

export const createMomoPaymentSchema = z.object({
  orderId: positiveIntSchema,
  redirectUrl: z.string().trim().url('Redirect URL must be a valid URL').max(2048).optional(),
});
