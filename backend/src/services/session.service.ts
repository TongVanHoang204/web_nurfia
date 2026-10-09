import { EventEmitter } from 'node:events';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../models/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

type AccessTokenClaims = jwt.JwtPayload & { userId: number; tokenVersion: number; exp: number };
const sessionEvents = new EventEmitter();
sessionEvents.setMaxListeners(0);
const REVOKED = 'sessions-revoked';

export const decodeAccessToken = (token: string): AccessTokenClaims => {
  try {
    const claims = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    if (typeof claims === 'string'
      || !Number.isSafeInteger(claims.userId) || claims.userId <= 0
      || !Number.isSafeInteger(claims.tokenVersion) || claims.tokenVersion < 0
      || !Number.isSafeInteger(claims.exp)) {
      throw new Error('Invalid token claims');
    }
    return claims as AccessTokenClaims;
  } catch {
    throw new AppError('Invalid or expired authentication token.', 401);
  }
};

export const getAuthenticatedUser = async (token: string) => {
  const claims = decodeAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, role: true, permissions: true, isActive: true, tokenVersion: true },
  });
  if (!user || !user.isActive) throw new AppError('User account not found or deactivated.', 401);
  if (claims.tokenVersion !== user.tokenVersion) throw new AppError('Invalid or expired authentication token.', 401);
  return { ...user, tokenExpiresAt: claims.exp };
};

export const notifySessionsRevoked = (userId: number) => sessionEvents.emit(REVOKED, userId);

export const revokePresentedTokens = async (tokens: string[]) => {
  for (const token of new Set(tokens.filter(Boolean))) {
    let claims: AccessTokenClaims;
    try { claims = decodeAccessToken(token); } catch (error) {
      if (error instanceof AppError) continue;
      throw error;
    }
    // An expired/revoked copy must not invalidate a subsequent fresh login.
    const result = await prisma.user.updateMany({
      where: { id: claims.userId, tokenVersion: claims.tokenVersion },
      data: { tokenVersion: { increment: 1 } },
    });
    if (result.count > 0) notifySessionsRevoked(claims.userId);
  }
};

// Close live streams immediately on this process and recheck shared DB state on other instances.
export const watchAuthenticatedSession = (
  userId: number, tokenVersion: number, expiresAt: number, onInvalid: () => void,
) => {
  let stopped = false;
  let checking = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    clearTimeout(expiryTimer);
    sessionEvents.off(REVOKED, revoked);
  };
  const invalidate = () => { if (!stopped) { stop(); onInvalid(); } };
  const revoked = (revokedUserId: number) => { if (revokedUserId === userId) invalidate(); };
  const check = async () => {
    if (stopped || checking) return;
    if (Date.now() >= expiresAt * 1000) { invalidate(); return; }
    checking = true;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, tokenVersion: true } });
      if (!user || !user.isActive || user.tokenVersion !== tokenVersion) invalidate();
    } catch { invalidate(); } finally { checking = false; }
  };
  const interval = setInterval(check, 15000);
  const expiryTimer = setTimeout(check, Math.max(0, Math.min(expiresAt * 1000 - Date.now(), 2147483647)));
  interval.unref();
  expiryTimer.unref();
  sessionEvents.on(REVOKED, revoked);
  return stop;
};
