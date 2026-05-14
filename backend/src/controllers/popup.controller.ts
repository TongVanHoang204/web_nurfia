import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuthRequest } from '../middlewares/auth.js';
import { logActivity } from '../services/activity.service.js';

const normalizeAssetUrl = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (raw.startsWith('/uploads/')) return raw;
  if (raw.startsWith('uploads/')) return `/${raw}`;
  if (raw.startsWith('/assets/')) return raw;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    if (url.pathname.startsWith('/uploads/')) {
      return `${url.pathname}${url.search}`;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const nullableString = (value: unknown) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const nullableDate = (value: unknown) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const buildPopupData = (body: Record<string, unknown>, partial = false) => {
  const data: Record<string, unknown> = {};

  if (!partial || body.popupType !== undefined) data.popupType = String(body.popupType || 'OFFER').trim().toUpperCase();
  if (!partial || body.title !== undefined) data.title = String(body.title || '').trim();
  if (!partial || body.subtitle !== undefined) data.subtitle = nullableString(body.subtitle);
  if (!partial || body.message !== undefined) data.message = nullableString(body.message);
  if (!partial || body.imageUrl !== undefined) data.imageUrl = normalizeAssetUrl(body.imageUrl);
  if (!partial || body.offerCode !== undefined) data.offerCode = nullableString(body.offerCode);
  if (!partial || body.buttonText !== undefined) data.buttonText = nullableString(body.buttonText);
  if (!partial || body.linkUrl !== undefined) data.linkUrl = nullableString(body.linkUrl);
  if (!partial || body.displayDelayMs !== undefined) data.displayDelayMs = Number(body.displayDelayMs ?? 900);
  if (!partial || body.showOnceSession !== undefined) data.showOnceSession = Boolean(body.showOnceSession ?? true);
  if (!partial || body.isActive !== undefined) data.isActive = Boolean(body.isActive ?? true);
  if (!partial || body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder ?? 0);
  if (!partial || body.startAt !== undefined) data.startAt = nullableDate(body.startAt);
  if (!partial || body.endAt !== undefined) data.endAt = nullableDate(body.endAt);

  if (data.title === '') {
    throw new AppError('Popup title is required.', 400);
  }
  if (data.popupType !== undefined && data.popupType !== 'OFFER' && data.popupType !== 'NOTICE') {
    throw new AppError('Popup type must be OFFER or NOTICE.', 400);
  }
  if (data.imageUrl === null && body.imageUrl) {
    throw new AppError('Popup image URL must be an absolute http/https URL or an upload/asset path.', 400);
  }
  if (data.displayDelayMs !== undefined && (!Number.isFinite(data.displayDelayMs as number) || (data.displayDelayMs as number) < 0)) {
    throw new AppError('Display delay must be a non-negative number.', 400);
  }
  if (data.sortOrder !== undefined && (!Number.isFinite(data.sortOrder as number) || (data.sortOrder as number) < 0)) {
    throw new AppError('Sort order must be a non-negative number.', 400);
  }
  if (data.startAt && data.endAt && (data.endAt as Date) <= (data.startAt as Date)) {
    throw new AppError('End date must be after start date.', 400);
  }

  return data;
};

const activeDateWhere = () => {
  const now = new Date();
  return {
    isActive: true,
    AND: [
      { OR: [{ startAt: null }, { startAt: { lte: now } }] },
      { OR: [{ endAt: null }, { endAt: { gte: now } }] },
    ],
  };
};

export const popupController = {
  getActiveHomePopup: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const popups = await prisma.homePopup.findMany({
        where: activeDateWhere(),
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
      res.json({ success: true, data: popups });
    } catch (err) { next(err); }
  },

  getAdminPopups: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const popups = await prisma.homePopup.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
      res.json({ success: true, data: popups });
    } catch (err) { next(err); }
  },

  createPopup: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = buildPopupData(req.body);
      const popup = await prisma.homePopup.create({ data: data as any });

      if (req.userId) {
        await logActivity(req.userId, 'CREATE', 'HOME_POPUP', popup.id, {
          title: popup.title,
          isActive: popup.isActive,
        }, req.ip);
      }

      res.json({ success: true, data: popup });
    } catch (err) { next(err); }
  },

  updatePopup: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) throw new AppError('Invalid popup ID.', 400);

      const existingPopup = await prisma.homePopup.findUnique({ where: { id } });
      if (!existingPopup) throw new AppError('Popup not found.', 404);

      const data = buildPopupData(req.body, true);
      const popup = await prisma.homePopup.update({ where: { id }, data: data as any });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'HOME_POPUP', popup.id, {
          previous: existingPopup,
          current: popup,
        }, req.ip);
      }

      res.json({ success: true, data: popup });
    } catch (err) { next(err); }
  },

  deletePopup: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) throw new AppError('Invalid popup ID.', 400);

      const existingPopup = await prisma.homePopup.findUnique({ where: { id } });
      if (!existingPopup) throw new AppError('Popup not found.', 404);

      await prisma.homePopup.delete({ where: { id } });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'HOME_POPUP', id, existingPopup, req.ip);
      }

      res.json({ success: true, message: 'Popup deleted' });
    } catch (err) { next(err); }
  },
};
