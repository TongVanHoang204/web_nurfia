import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service.js';
import { AuthRequest } from '../middlewares/auth.js';

export const notificationController = {
  async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await notificationService.getNotifications(req.userId!, page, limit);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = String(req.params.id);
      const id = parseInt(idStr, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
      }
      await notificationService.markAsRead(req.userId!, id);
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
      next(err);
    }
  },

  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await notificationService.markAllAsRead(req.userId!);
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
      next(err);
    }
  },
};
