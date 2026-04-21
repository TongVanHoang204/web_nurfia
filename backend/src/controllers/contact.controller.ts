import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma.js';
import { AuthRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { logActivity } from '../services/activity.service.js';
import { mailService } from '../services/mail.service.js';

const NEWSLETTER_SETTING_KEY = 'newsletterSubscribers';

type NewsletterSubscriber = {
  email: string;
  subscribedAt: string;
};

const parseNewsletterSubscribers = (value: string | null | undefined): NewsletterSubscriber[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is NewsletterSubscriber => (
        typeof item === 'object'
        && item !== null
        && typeof (item as NewsletterSubscriber).email === 'string'
        && typeof (item as NewsletterSubscriber).subscribedAt === 'string'
      ));
  } catch {
    return [];
  }
};

export const contactController = {
  submitContact: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, subject, message } = req.body;

      await prisma.contactMessage.create({
        data: { name, email, subject, message }
      });

      res.json({ success: true, message: 'Message sent successfully!' });
    } catch (err) { next(err); }
  },

  subscribeNewsletter: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
      const existingSetting = await prisma.setting.findUnique({
        where: { key: NEWSLETTER_SETTING_KEY },
      });

      const subscribers = parseNewsletterSubscribers(existingSetting?.value);
      const alreadySubscribed = subscribers.some((subscriber) => subscriber.email === normalizedEmail);
      if (alreadySubscribed) {
        res.json({ success: true, message: 'Email is already subscribed.' });
        return;
      }

      const nextSubscribers = [
        ...subscribers,
        {
          email: normalizedEmail,
          subscribedAt: new Date().toISOString(),
        },
      ];

      await prisma.setting.upsert({
        where: { key: NEWSLETTER_SETTING_KEY },
        update: {
          value: JSON.stringify(nextSubscribers),
          group: 'marketing',
        },
        create: {
          key: NEWSLETTER_SETTING_KEY,
          value: JSON.stringify(nextSubscribers),
          group: 'marketing',
        },
      });

      res.json({ success: true, message: 'Subscribed successfully!' });
    } catch (err) { next(err); }
  },

  getMessages: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number.parseInt(String(_req.query.page || '1'), 10) || 1;
      const limit = Math.min(100, Number.parseInt(String(_req.query.limit || '20'), 10) || 20);
      const search = String(_req.query.search || '').trim();
      const status = String(_req.query.status || 'ALL').trim().toUpperCase();
      const skip = (page - 1) * limit;

      const where: any = {};
      if (status === 'READ') where.isRead = true;
      if (status === 'UNREAD') where.isRead = false;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [messages, total, totalUnread, totalRead] = await Promise.all([
        prisma.contactMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.contactMessage.count({ where }),
        prisma.contactMessage.count({ where: { isRead: false } }),
        prisma.contactMessage.count({ where: { isRead: true } }),
      ]);

      res.json({
        success: true,
        data: messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
        stats: {
          totalUnread,
          totalRead,
          filteredTotal: total,
        },
      });
    } catch (err) { next(err); }
  },

  markRead: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('Invalid message ID.', 400);
      }

      const message = await prisma.contactMessage.update({
        where: { id },
        data: { isRead: true }
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'CONTACT_MESSAGE', message.id, { isRead: true }, req.ip);
      }

      res.json({ success: true, message: 'Message marked as read' });
    } catch (err) { next(err); }
  },

  deleteMessage: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('Invalid message ID.', 400);
      }

      const message = await prisma.contactMessage.delete({
        where: { id }
      });

      if (req.userId) {
        await logActivity(req.userId, 'DELETE', 'CONTACT_MESSAGE', message.id, {
          email: message.email,
          subject: message.subject,
        }, req.ip);
      }

      res.json({ success: true, message: 'Message deleted' });
    } catch (err) { next(err); }
  },

  replyMessage: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('Invalid message ID.', 400);
      }

      const subject = String(req.body.subject || '').trim();
      const messageBody = String(req.body.message || '').trim();

      const message = await prisma.contactMessage.findUnique({
        where: { id },
      });
      if (!message) {
        throw new AppError('Message not found.', 404);
      }

      const mailResult = await mailService.sendContactReply(
        message.email,
        message.name,
        subject,
        messageBody,
      );

      await prisma.contactMessage.update({
        where: { id: message.id },
        data: { isRead: true },
      });

      if (req.userId) {
        await logActivity(req.userId, 'UPDATE', 'CONTACT_MESSAGE', message.id, {
          action: 'reply',
          email: message.email,
          subject,
          delivered: mailResult.delivered,
        }, req.ip);
      }

      res.json({
        success: true,
        message: mailResult.delivered
          ? 'Reply sent successfully.'
          : 'SMTP is not configured. Reply was not delivered, but the action was logged.',
        data: {
          delivered: mailResult.delivered,
        },
      });
    } catch (err) { next(err); }
  }
};
