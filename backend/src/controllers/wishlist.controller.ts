import { Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AuthRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export const wishlistController = {
  getWishlist: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const items = await prisma.wishlistItem.findMany({
        where: { userId: req.userId! },
        include: {
          product: {
            include: {
              images: { where: { isPrimary: true }, take: 1 },
              category: { select: { name: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: items });
    } catch (err) { next(err); }
  },

  addItem: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { productId } = req.body;
      const existing = await prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId: req.userId!, productId } },
      });
      if (existing) throw new AppError('Product already in wishlist.', 409);

      const item = await prisma.wishlistItem.create({
        data: { userId: req.userId!, productId },
      });
      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  removeItem: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const productId = parseInt(req.params.productId as string);
      await prisma.wishlistItem.deleteMany({
        where: { userId: req.userId!, productId },
      });
      res.json({ success: true, message: 'Removed from wishlist' });
    } catch (err) { next(err); }
  }
};
