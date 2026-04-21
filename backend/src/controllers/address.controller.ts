import { Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AuthRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export const addressController = {
  getAddresses: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const addresses = await prisma.address.findMany({
        where: { userId: req.userId! },
        orderBy: { isDefault: 'desc' },
      });
      res.json({ success: true, data: addresses });
    } catch (err) { next(err); }
  },

  createAddress: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { fullName, phone, province, district, ward, streetAddress, isDefault } = req.body;

      const existingAddressCount = await prisma.address.count({
        where: { userId: req.userId! },
      });
      const shouldBeDefault = existingAddressCount === 0 ? true : Boolean(isDefault);

      if (shouldBeDefault) {
        // Unset previous default
        await prisma.address.updateMany({
          where: { userId: req.userId! },
          data: { isDefault: false }
        });
      }

      const addr = await prisma.address.create({
        data: {
          userId: req.userId!,
          fullName, phone, province, district, ward, streetAddress,
          isDefault: shouldBeDefault
        }
      });

      res.status(201).json({ success: true, data: addr });
    } catch (err) { next(err); }
  },

  updateAddress: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      const { fullName, phone, province, district, ward, streetAddress, isDefault } = req.body;
      
      // verify ownership
      const existing = await prisma.address.findFirst({ where: { id, userId: req.userId! } });
      if (!existing) throw new AppError('Address not found.', 404);
      if (existing.isDefault && isDefault === false) {
        throw new AppError('Default address cannot be unset directly. Please set another address as default first.', 400);
      }

      if (isDefault && !existing.isDefault) {
        await prisma.address.updateMany({
          where: { userId: req.userId! },
          data: { isDefault: false }
        });
      }

      const updated = await prisma.address.update({
        where: { id },
        data: { fullName, phone, province, district, ward, streetAddress, isDefault }
      });

      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  deleteAddress: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id as string);
      const existing = await prisma.address.findFirst({
        where: { id, userId: req.userId! },
      });
      if (!existing) {
        throw new AppError('Address not found.', 404);
      }
      if (existing.isDefault) {
        throw new AppError('Cannot delete default address. Please set another address as default first.', 400);
      }

      await prisma.address.delete({
        where: { id },
      });
      res.json({ success: true, message: 'Address deleted' });
    } catch (err) { next(err); }
  }
};
