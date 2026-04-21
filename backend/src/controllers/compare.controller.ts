import { Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AuthRequest } from '../middlewares/auth.js';

export const compareController = {
  getCompareItems: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const items = await prisma.compareItem.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              images: true,
              category: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ success: true, data: items });
    } catch (err) { next(err); }
  },

  addItem: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { productId } = req.body;
      
      const existing = await prisma.compareItem.findUnique({
        where: { userId_productId: { userId, productId } }
      });
      
      if (existing) {
        return res.json({ success: true, data: existing, message: 'Item already in compare list' });
      }

      const item = await prisma.compareItem.create({
        data: { userId, productId }
      });
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  removeItem: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const productId = Number(req.params.productId);
      await prisma.compareItem.deleteMany({
        where: { userId, productId }
      });
      res.json({ success: true, message: 'Item removed from compare' });
    } catch (err) { next(err); }
  },

  clearCompare: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      await prisma.compareItem.deleteMany({
        where: { userId }
      });
      res.json({ success: true, message: 'Compare list cleared' });
    } catch (err) { next(err); }
  }
};
