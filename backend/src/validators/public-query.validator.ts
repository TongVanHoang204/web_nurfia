import { z } from 'zod';

const positiveIntegerQuery = (maximum: number) => z.string()
  .regex(/^\d+$/, 'Must be a positive integer')
  .transform(Number)
  .pipe(z.number().int().safe().min(1).max(maximum));

export const publicPaginationSchema = (defaultLimit: number) => z.object({
  page: positiveIntegerQuery(10000).default('1'),
  limit: positiveIntegerQuery(100).default(String(defaultLimit)),
}).strict();

const priceQuery = z.string().regex(/^\d+(?:\.\d+)?$/, 'Must be a non-negative price')
  .transform(Number).pipe(z.number().finite().min(0).max(1e12));

export const publicProductQuerySchema = publicPaginationSchema(12).extend({
  category: z.string().trim().max(200).optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(['default', 'newest', 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'popular', 'rating']).optional(),
  minPrice: priceQuery.optional(),
  maxPrice: priceQuery.optional(),
  featured: z.enum(['true', 'false']).optional(),
  onSale: z.enum(['true', 'false']).optional(),
  colors: z.string().max(1000).optional(),
  sizes: z.string().max(1000).optional(),
  brands: z.string().max(1000).optional(),
}).refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, {
  message: 'minPrice cannot exceed maxPrice', path: ['minPrice'],
});

export const publicLimitQuerySchema = (defaultLimit: number) => z.object({
  limit: positiveIntegerQuery(100).default(String(defaultLimit)),
}).strict();
