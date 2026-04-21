import prisma from '../models/prisma.js';

export const logActivity = async (userId: number, action: string, entityType: string, entityId?: number | null, details?: any, ipAddress?: string | null) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: details || null,
        ipAddress: ipAddress || null
      }
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};