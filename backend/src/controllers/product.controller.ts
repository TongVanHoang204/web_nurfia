import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';

const normalizeText = (value: string) => String(value || '').trim().toLowerCase();

const isColorAttribute = (name: string) => {
  const normalized = normalizeText(name);
  return normalized === 'color' || normalized.includes('mau') || normalized.includes('màu');
};

const isSizeAttribute = (name: string) => {
  const normalized = normalizeText(name);
  return normalized === 'size' || normalized.includes('kich') || normalized.includes('kích');
};

const getFilterAttributeIds = async () => {
  const attributes = await prisma.productAttribute.findMany({
    select: { id: true, name: true },
  });

  const colorAttributeIds = attributes
    .filter((attribute: { name: string }) => isColorAttribute(attribute.name))
    .map((attribute: { id: number }) => attribute.id);

  const sizeAttributeIds = attributes
    .filter((attribute: { name: string }) => isSizeAttribute(attribute.name))
    .map((attribute: { id: number }) => attribute.id);

  return { colorAttributeIds, sizeAttributeIds };
};

export const productController = {
  getProducts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 12;
      const skip = (page - 1) * limit;
      const categorySlug = req.query.category as string;
      const search = req.query.search as string;
      const sort = req.query.sort as string || 'newest';
      const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
      const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
      const featured = req.query.featured === 'true';
      const onSale = req.query.onSale === 'true';
        
      // Add parsed arrays from comma separated strings
      const colors = req.query.colors
        ? (req.query.colors as string).split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const sizes = req.query.sizes
        ? (req.query.sizes as string).split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const brands = req.query.brands
        ? (req.query.brands as string).split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const where: any = { isActive: true };

      if (categorySlug) {
        const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
        if (category) {
          const childCats = await prisma.category.findMany({ where: { parentId: category.id } });
          const catIds = [category.id, ...childCats.map(c => c.id)];
          where.categoryId = { in: catIds };
        }
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { shortDescription: { contains: search } },
        ];
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {};
        if (minPrice !== undefined) where.price.gte = minPrice;
        if (maxPrice !== undefined) where.price.lte = maxPrice;
      }

      if (featured) where.isFeatured = true;
      if (onSale) where.salePrice = { not: null };

      if (brands.length > 0) {
        const brandRows = await prisma.brand.findMany({
          where: { isActive: true },
          select: { slug: true, name: true },
        });

        const brandLookup = new Map<string, string>();
        for (const brand of brandRows) {
          brandLookup.set(normalizeText(brand.slug), brand.slug);
          brandLookup.set(normalizeText(brand.name), brand.slug);
        }

        const normalizedBrandSlugs = Array.from(new Set(
          brands
            .map((item) => brandLookup.get(normalizeText(item)) || normalizeText(item))
            .filter(Boolean)
        ));

        where.brand = {
          slug: {
            in: normalizedBrandSlugs.length > 0 ? normalizedBrandSlugs : ['__no_brand_match__'],
          },
        };
      }

      if (colors.length > 0 || sizes.length > 0) {
        const { colorAttributeIds, sizeAttributeIds } = await getFilterAttributeIds();

        let normalizedColors = colors;
        let normalizedSizes = sizes;

        if (colors.length > 0 && colorAttributeIds.length > 0) {
          const colorValues = await prisma.productAttributeValue.findMany({
            where: { attributeId: { in: colorAttributeIds } },
            select: { value: true },
          });

          const colorValueMap = new Map<string, string>(
            colorValues.map((item: { value: string }) => [normalizeText(item.value), item.value])
          );

          normalizedColors = Array.from(new Set(
            colors.map((item) => colorValueMap.get(normalizeText(item)) || item)
          ));
        }

        if (sizes.length > 0 && sizeAttributeIds.length > 0) {
          const sizeValues = await prisma.productAttributeValue.findMany({
            where: { attributeId: { in: sizeAttributeIds } },
            select: { value: true },
          });

          const sizeValueMap = new Map<string, string>(
            sizeValues.map((item: { value: string }) => [normalizeText(item.value), item.value])
          );

          normalizedSizes = Array.from(new Set(
            sizes.map((item) => sizeValueMap.get(normalizeText(item)) || item)
          ));
        }

        where.variants = { some: { AND: [] } };

        if (colors.length > 0) {
          where.variants.some.AND.push({
            attributes: {
              some: {
                attributeValue: {
                  attributeId: { in: colorAttributeIds.length > 0 ? colorAttributeIds : [-1] },
                  value: { in: normalizedColors },
                },
              },
            },
          });
        }

        if (sizes.length > 0) {
          where.variants.some.AND.push({
            attributes: {
              some: {
                attributeValue: {
                  attributeId: { in: sizeAttributeIds.length > 0 ? sizeAttributeIds : [-1] },
                  value: { in: normalizedSizes },
                },
              },
            },
          });
        }
      }

      let orderBy: any = { createdAt: 'desc' };
      switch (sort) {
        case 'price_asc': orderBy = { price: 'asc' }; break;
        case 'price_desc': orderBy = { price: 'desc' }; break;
        case 'name_asc': orderBy = { name: 'asc' }; break;
        case 'name_desc': orderBy = { name: 'desc' }; break;
        case 'popular': orderBy = { salesCount: 'desc' }; break;
        case 'rating': orderBy = { avgRating: 'desc' }; break;
        default: orderBy = { createdAt: 'desc' };
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where, skip, take: limit, orderBy,
          include: {
            images: { orderBy: { sortOrder: 'asc' }, take: 2 },
            category: { select: { id: true, name: true, slug: true } },
            brand: { select: { id: true, name: true, slug: true } },
            variants: { include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } } },
          },
        }),
        prisma.product.count({ where }),
      ]);

      res.json({
        success: true,
        data: products,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) { next(err); }
  },

  getFeatured: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true, isFeatured: true }, take: 8, orderBy: { createdAt: 'desc' },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 2 }, category: { select: { id: true, name: true, slug: true } } },
      });
      res.json({ success: true, data: products });
    } catch (err) { next(err); }
  },

  getBestsellers: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true }, take: 8, orderBy: { salesCount: 'desc' },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 2 }, category: { select: { id: true, name: true, slug: true } } },
      });
      res.json({ success: true, data: products });
    } catch (err) { next(err); }
  },

  getNew: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true }, take: 8, orderBy: { createdAt: 'desc' },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 2 }, category: { select: { id: true, name: true, slug: true } } },
      });
      res.json({ success: true, data: products });
    } catch (err) { next(err); }
  },

  getByCategory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categoryId = parseInt(req.params.categoryId as string);
      const limit = parseInt(req.query.limit as string) || 8;
      const products = await prisma.product.findMany({
        where: { isActive: true, categoryId }, take: limit, orderBy: { createdAt: 'desc' },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 2 } },
      });
      res.json({ success: true, data: products });
    } catch (err) { next(err); }
  },

  getBySlug: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await prisma.product.findUnique({
        where: { slug: req.params.slug as string },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          category: true,
          variants: { where: { isActive: true }, include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } } },
          reviews: { where: { isApproved: true }, include: { user: { select: { fullName: true, username: true } } }, orderBy: { createdAt: 'desc' } },
        },
      });

      if (!product || !product.isActive) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      await prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } });
      res.json({ success: true, data: product });
    } catch (err) { next(err); }
  },

  getFilterOptions: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { colorAttributeIds, sizeAttributeIds } = await getFilterAttributeIds();

      const [colors, sizes, brands] = await Promise.all([
        colorAttributeIds.length > 0
          ? prisma.productAttributeValue.findMany({
            where: { attributeId: { in: colorAttributeIds } },
            orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
            select: { id: true, value: true, colorHex: true },
          })
          : Promise.resolve([]),
        sizeAttributeIds.length > 0
          ? prisma.productAttributeValue.findMany({
            where: { attributeId: { in: sizeAttributeIds } },
            orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
            select: { id: true, value: true },
          })
          : Promise.resolve([]),
        prisma.brand.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, slug: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          colors,
          sizes,
          brands,
        },
      });
    } catch (err) {
      next(err);
    }
  }
};
