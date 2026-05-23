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

  async deleteNotification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
      }

      const result = await notificationService.deleteNotification(req.userId!, id);
      if (result.count === 0) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }

      res.json({ success: true, message: 'Notification deleted' });
    } catch (err) {
      next(err);
    }
  },

  async deleteNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ids: number[] = Array.isArray(req.body?.ids)
        ? req.body.ids
          .map((value: unknown) => Number(value))
          .filter((value: number): value is number => Number.isInteger(value) && value > 0)
        : [];

      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Notification IDs are required' });
      }

      const result = await notificationService.deleteNotifications(req.userId!, uniqueIds);
      res.json({
        success: true,
        message: 'Notifications deleted',
        data: { deletedCount: result.count },
      });
    } catch (err) {
      next(err);
    }
  },
};
