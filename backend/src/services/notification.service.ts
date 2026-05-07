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

  async checkAndNotifyLowStock() {
    try {
      const threshold = 20;
      const lowStockProducts = await prisma.product.findMany({
        where: { isActive: true, stock: { lte: threshold } },
        select: { id: true, name: true, sku: true, stock: true },
        orderBy: { stock: 'asc' },
      });
      const lowStockVariants = await prisma.productVariant.findMany({
        where: { isActive: true, stock: { lte: threshold } },
        select: { id: true, sku: true, stock: true, product: { select: { name: true } } },
        orderBy: { stock: 'asc' },
      });

      if (lowStockProducts.length === 0 && lowStockVariants.length === 0) return;

      // Get all admin/staff users
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'MANAGER', 'STAFF'] }, isActive: true },
        select: { id: true },
      });
      if (admins.length === 0) return;

      // Check which products already have a recent low-stock notification (last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingNotifs = await prisma.notification.findMany({
        where: {
          type: 'LOW_STOCK',
          createdAt: { gte: oneDayAgo },
          userId: { in: admins.map((a) => a.id) },
        },
        select: { message: true },
      });
      const notifiedProductSku = new Set(
        existingNotifs.map((n) => n.message?.split(' ')[0] || ''),
      );

      for (const product of lowStockProducts) {
        if (notifiedProductSku.has(product.sku)) continue;
        for (const admin of admins) {
          await notificationService.createNotification(
            admin.id,
            'LOW_STOCK',
            'Low Stock Alert',
            `${product.sku} - ${product.name} only ${product.stock} left.`,
            '/admin/inventory',
          ).catch(() => {});
        }
      }
      for (const variant of lowStockVariants) {
        if (notifiedProductSku.has(variant.sku)) continue;
        for (const admin of admins) {
          await notificationService.createNotification(
            admin.id,
            'LOW_STOCK',
            'Low Stock Alert',
            `${variant.sku} - ${variant.product.name} variant only ${variant.stock} left.`,
            '/admin/inventory',
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[Notification] Failed to check low stock:', err);
    }
  },
};
