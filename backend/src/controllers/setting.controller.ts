import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuthRequest } from '../middlewares/auth.js';
import { logActivity } from '../services/activity.service.js';

const SETTING_RULES: Record<string, { maxLength: number; type?: 'email' | 'http-url' | 'asset-url' | 'text' }> = {
  siteName: { maxLength: 120 },
  tagline: { maxLength: 180 },
  siteTitle: { maxLength: 160 },
  siteDescription: { maxLength: 320 },
  currency: { maxLength: 20 },
  logoUrl: { maxLength: 500, type: 'asset-url' },
  logoLightUrl: { maxLength: 500, type: 'asset-url' },
  faviconUrl: { maxLength: 500, type: 'asset-url' },
  bankName: { maxLength: 120 },
  accountNumber: { maxLength: 50 },
  accountOwner: { maxLength: 120 },
  qrCodeUrl: { maxLength: 500, type: 'asset-url' },
  email: { maxLength: 255, type: 'email' },
  phone: { maxLength: 30 },
  address: { maxLength: 255 },
  facebook: { maxLength: 500, type: 'http-url' },
  instagram: { maxLength: 500, type: 'http-url' },
  twitter: { maxLength: 500, type: 'http-url' },
};

const isSafeHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isSafeAssetUrl = (value: string) => {
  if (!value) return true;
  if (value.startsWith('/')) return true;
  return isSafeHttpUrl(value);
};

const normalizeSettingValue = (key: string, value: unknown) => {
  if (!(key in SETTING_RULES)) {
    throw new AppError(`Unsupported setting key "${key}".`, 400);
  }

  if (typeof value !== 'string') {
    throw new AppError(`Setting "${key}" must be a string.`, 400);
  }

  const normalized = value.trim();
  const rule = SETTING_RULES[key];
  if (normalized.length > rule.maxLength) {
    throw new AppError(`Setting "${key}" exceeds the maximum length of ${rule.maxLength}.`, 400);
  }

  if (rule.type === 'email' && normalized) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      throw new AppError(`Setting "${key}" must be a valid email address.`, 400);
    }
  }

  if (rule.type === 'http-url' && normalized && !isSafeHttpUrl(normalized)) {
    throw new AppError(`Setting "${key}" must be a valid http/https URL.`, 400);
  }

  if (rule.type === 'asset-url' && normalized && !isSafeAssetUrl(normalized)) {
    throw new AppError(`Setting "${key}" must be an absolute http/https URL or a local asset path starting with "/".`, 400);
  }

  return normalized;
};

export const settingController = {
  getSettings: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.setting.findMany();
      const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
      res.json({ success: true, data: settingsMap });
    } catch (err) { next(err); }
  },

  updateSettings: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const settingsToUpdate = req.body;
      const updates = [];
      const changedSettings: Record<string, string> = {};

      if (!settingsToUpdate || typeof settingsToUpdate !== 'object' || Array.isArray(settingsToUpdate)) {
        throw new AppError('Settings payload must be an object.', 400);
      }

      for (const [key, value] of Object.entries(settingsToUpdate)) {
        const normalizedValue = normalizeSettingValue(key, value);
        changedSettings[key] = normalizedValue;
        updates.push(
          prisma.setting.upsert({
            where: { key },
            update: { value: normalizedValue },
            create: { key, value: normalizedValue }
          })
        );
      }

      if (updates.length === 0) {
        throw new AppError('At least one supported setting is required.', 400);
      }

      await prisma.$transaction(updates);

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'SETTING', null, changedSettings, req.ip);
      }

      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (err) { next(err); }
  }
};
