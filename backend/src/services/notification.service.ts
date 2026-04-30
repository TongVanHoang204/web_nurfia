import prisma from '../models/prisma.js';

export const notificationService = {
  async getNotifications(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  },

  async markAsRead(userId: number, notificationId: number) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  },

  async markAllAsRead(userId: number) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },

  async createNotification(userId: number, type: string, title: string, message: string, link?: string) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
      },
    });

    try {
      const { getSocketServer } = await import('./socket.service.js');
      const io = getSocketServer();
      if (io) {
        io.to(`user:${userId}`).emit('new_notification', notification);
      }
    } catch (err) {
      console.error('Failed to emit notification socket event:', err);
    }

    return notification;
  },
};
