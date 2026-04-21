import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';

export const categoryController = {
  getCategories: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          _count: { select: { products: true } },
        },
      });
      // Return only root categories (parentId is null) with children nested
      const roots = categories.filter(c => c.parentId === null);
      res.json({ success: true, data: roots });
    } catch (err) { next(err); }
  },

  getCategoryBySlug: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await prisma.category.findUnique({
        where: { slug: req.params.slug as string },
        include: {
          children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
          parent: { select: { id: true, name: true, slug: true } },
        },
      });
      if (!category) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }
      res.json({ success: true, data: category });
    } catch (err) { next(err); }
  }
};
