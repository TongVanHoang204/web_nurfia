import { Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AuthRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export const cartController = {
  getCart: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const items = await prisma.cartItem.findMany({
        where: { userId: req.userId! },
        include: {
          product: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
          variant: {
            include: { attributes: { include: { attributeValue: { include: { attribute: true } } } } },
          },
        },
      });
      res.json({ success: true, data: items });
    } catch (err) { next(err); }
  },

  addItem: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { productId, variantId, quantity = 1 } = req.body;
      const normalizedQuantity = Number(quantity);

      if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
        throw new AppError('Quantity must be a positive integer.', 400);
      }

      // Validate product exists
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product || !product.isActive) throw new AppError('Product not found.', 404);

      // Check stock
      let availableStock = product.stock;
      if (variantId) {
        const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
        if (!variant || !variant.isActive) throw new AppError('Variant not found.', 404);
        availableStock = variant.stock;
      }
      if (normalizedQuantity > availableStock) throw new AppError(`Only ${availableStock} items available.`, 400);

      // Upsert cart item
      const existing = await prisma.cartItem.findFirst({
        where: { userId: req.userId!, productId, variantId: variantId || null },
      });

      let item;
      if (existing) {
        const newQty = existing.quantity + normalizedQuantity;
        if (newQty > availableStock) throw new AppError(`Only ${availableStock} items available.`, 400);
        item = await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: newQty },
        });
      } else {
        item = await prisma.cartItem.create({
          data: { userId: req.userId!, productId, variantId: variantId || null, quantity: normalizedQuantity },
        });
      }

      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  updateItem: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      const { quantity } = req.body;
      const normalizedQuantity = Number(quantity);

      if (!Number.isFinite(normalizedQuantity) || !Number.isInteger(normalizedQuantity)) {
        throw new AppError('Quantity must be an integer.', 400);
      }

      const cartItem = await prisma.cartItem.findFirst({ where: { id, userId: req.userId! } });
      if (!cartItem) throw new AppError('Cart item not found.', 404);

      if (normalizedQuantity <= 0) {
        await prisma.cartItem.delete({ where: { id } });
        res.json({ success: true, data: null, message: 'Item removed from cart' });
        return;
      }

      const product = await prisma.product.findUnique({ where: { id: cartItem.productId } });
      if (!product || !product.isActive) throw new AppError('Product not found.', 404);

      let availableStock = product.stock;
      if (cartItem.variantId) {
        const variant = await prisma.productVariant.findFirst({
          where: {
            id: cartItem.variantId,
            productId: cartItem.productId,
          },
        });

        if (!variant || !variant.isActive) {
          throw new AppError('Variant not found.', 404);
        }
        availableStock = variant.stock;
      }

      if (normalizedQuantity > availableStock) {
        throw new AppError(`Only ${availableStock} items available.`, 400);
      }

      const updated = await prisma.cartItem.update({ where: { id }, data: { quantity: normalizedQuantity } });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  removeItem: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      await prisma.cartItem.deleteMany({ where: { id, userId: req.userId! } });
      res.json({ success: true, message: 'Item removed from cart' });
    } catch (err) { next(err); }
  },

  clearCart: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await prisma.cartItem.deleteMany({ where: { userId: req.userId! } });
      res.json({ success: true, message: 'Cart cleared' });
    } catch (err) { next(err); }
  }
};
