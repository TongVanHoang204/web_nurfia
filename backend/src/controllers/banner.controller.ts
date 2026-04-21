import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuthRequest } from '../middlewares/auth.js';
import { logActivity } from '../services/activity.service.js';

export const bannerController = {
  getBanners: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const position = (req.query.position as string) || 'homepage';
      const banners = await prisma.banner.findMany({
        where: { isActive: true, position },
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: banners });
    } catch (err) { next(err); }
  },

  getAdminBanners: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const banners = await prisma.banner.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      res.json({ success: true, data: banners });
    } catch (err) { next(err); }
  },

  createBanner: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = {
        title: String(req.body.title || '').trim(),
        subtitle: req.body.subtitle ? String(req.body.subtitle).trim() : null,
        imageUrl: String(req.body.imageUrl || '').trim(),
        videoUrl: req.body.videoUrl ? String(req.body.videoUrl).trim() : null,
        linkUrl: req.body.linkUrl ? String(req.body.linkUrl).trim() : null,
        buttonText: req.body.buttonText ? String(req.body.buttonText).trim() : null,
        position: String(req.body.position || 'homepage').trim() || 'homepage',
        sortOrder: Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0,
        isActive: req.body.isActive ?? true,
      };

      if (!data.title) {
        throw new AppError('Banner title is required.', 400);
      }
      if (!data.imageUrl) {
        throw new AppError('Banner image is required.', 400);
      }
      if (data.sortOrder < 0) {
        throw new AppError('Sort order must be a non-negative number.', 400);
      }

      const banner = await prisma.banner.create({ data });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'BANNER', banner.id, {
          title: banner.title,
          position: banner.position,
          isActive: banner.isActive,
        }, req.ip);
      }

      res.json({ success: true, data: banner });
    } catch (err) { next(err); }
  },

  updateBanner: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        throw new AppError('Invalid banner ID.', 400);
      }

      const existingBanner = await prisma.banner.findUnique({ where: { id } });
      if (!existingBanner) {
        throw new AppError('Banner not found.', 404);
      }

      const data = {
        ...(req.body.title !== undefined && { title: String(req.body.title).trim() }),
        ...(req.body.subtitle !== undefined && { subtitle: req.body.subtitle ? String(req.body.subtitle).trim() : null }),
        ...(req.body.imageUrl !== undefined && { imageUrl: String(req.body.imageUrl).trim() }),
        ...(req.body.videoUrl !== undefined && { videoUrl: req.body.videoUrl ? String(req.body.videoUrl).trim() : null }),
        ...(req.body.linkUrl !== undefined && { linkUrl: req.body.linkUrl ? String(req.body.linkUrl).trim() : null }),
        ...(req.body.buttonText !== undefined && { buttonText: req.body.buttonText ? String(req.body.buttonText).trim() : null }),
        ...(req.body.position !== undefined && { position: String(req.body.position).trim() || 'homepage' }),
        ...(req.body.sortOrder !== undefined && { sortOrder: Number(req.body.sortOrder) }),
        ...(req.body.isActive !== undefined && { isActive: Boolean(req.body.isActive) }),
      };

      if (data.title === '') {
        throw new AppError('Banner title cannot be empty.', 400);
      }
      if (data.imageUrl === '') {
        throw new AppError('Banner image is required.', 400);
      }
      if (data.sortOrder !== undefined && (!Number.isFinite(data.sortOrder) || data.sortOrder < 0)) {
        throw new AppError('Sort order must be a non-negative number.', 400);
      }

      const banner = await prisma.banner.update({
        where: { id },
        data,
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'BANNER', banner.id, {
          previous: existingBanner,
          current: banner,
        }, req.ip);
      }

      res.json({ success: true, data: banner });
    } catch (err) { next(err); }
  },

  deleteBanner: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        throw new AppError('Invalid banner ID.', 400);
      }

      const existingBanner = await prisma.banner.findUnique({ where: { id } });
      if (!existingBanner) {
        throw new AppError('Banner not found.', 404);
      }

      await prisma.banner.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'BANNER', id, existingBanner, req.ip);
      }

      res.json({ success: true, message: 'Banner deleted' });
    } catch (err) { next(err); }
  }
};
