import bcrypt from 'bcryptjs';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { effectiveRole } from '../utils/teamAccess.js';
import { notifySessionsRevoked } from './session.service.js';

// Administrative provisioning only. Never expose this operation as a public HTTP endpoint.
export const provisionOwner = async (username: string, password: string) => {
  if (!username.trim() || username.length > 50 || password.length < 6 || password.length > 128 || /\s/.test(password)) {
    throw new AppError('Valid username and password are required for owner provisioning.', 400);
  }
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_owner" BOOLEAN NOT NULL DEFAULT false');
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { username: username.trim() }, select: { id: true, username: true, role: true, isOwner: true } });
    if (!user) throw new AppError('Existing account not found. Owner provisioning does not create accounts.', 404);
    const owner = await tx.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN', isOwner: true, password: passwordHash, isActive: true, tokenVersion: { increment: 1 }, resetToken: null, resetExpires: null },
      select: { id: true, username: true, role: true, isOwner: true },
    });
    await tx.activityLog.create({ data: {
      userId: user.id, action: 'UPDATE', entityType: 'STAFF', entityId: user.id,
      details: { previous: { role: effectiveRole(user) }, current: { role: 'OWNER', isActive: true }, passwordChanged: true, source: 'owner-provisioning' },
    } });
    return { id: owner.id, username: owner.username, role: effectiveRole(owner) };
  });
  notifySessionsRevoked(result.id);
  return result;
};
