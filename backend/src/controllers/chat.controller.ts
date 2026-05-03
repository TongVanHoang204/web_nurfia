import { Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import prisma from '../models/prisma.js';
import { AuthRequest } from '../middlewares/auth.js';

export const chatController = {
  async getHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.json({ success: true, data: null });
      }

      const history = await prisma.chatHistory.findUnique({
        where: { userId: req.userId },
      });

      res.json({ success: true, data: history?.data || null });
    } catch (err) {
      next(err);
    }
  },

  async saveHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.json({ success: true, data: null });
      }

      const { data } = req.body;

      if (!data) {
        throw new AppError('Data is required', 400);
      }

      const history = await prisma.chatHistory.upsert({
        where: { userId: req.userId },
        update: { data },
        create: { userId: req.userId, data },
      });

      res.json({ success: true, data: history.data });
    } catch (err) {
      next(err);
    }
  },

  async deleteHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.json({ success: true });
      }

      await prisma.chatHistory.deleteMany({
        where: { userId: req.userId },
      });

      res.json({ success: true, message: 'Chat history cleared.' });
    } catch (err) {
      next(err);
    }
  },
};
