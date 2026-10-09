import type { Notification } from '@prisma/client';
import prisma from '../models/prisma.js';

/** Recover legacy contact destinations only when timestamp and original message identify one record. */
export async function resolveLegacyNotificationLinks(notifications: Notification[]): Promise<Notification[]> {
  return Promise.all(notifications.map(async notification => {
    if (notification.type !== 'CONTACT' || notification.link !== '/admin/contacts') return notification;
    const match = notification.message.match(/^Message from (.+) \(([^()\s]+@[^()\s]+)\): (.*)$/s);
    if (!match) return notification;
    const candidates = await prisma.contactMessage.findMany({
      where: { name: match[1], email: match[2], subject: match[3], createdAt: { gte: new Date(notification.createdAt.getTime() - 60000), lte: notification.createdAt } },
      select: { id: true }, take: 2,
    });
    return candidates.length === 1 ? { ...notification, link: `/admin/contacts?contactId=${candidates[0].id}` } : notification;
  }));
}
