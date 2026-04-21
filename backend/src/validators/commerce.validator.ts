import { z } from 'zod';

const phoneRegex = /^\+?\d{9,15}$/;

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
