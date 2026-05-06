import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_TTL_MS = 60 * 60 * 1000;
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_EXEMPT_PATHS = new Set(['/payment/momo/ipn']);

const signPayload = (payload: string) =>
  crypto.createHmac('sha256', config.jwt.secret).update(payload).digest('base64url');

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const createCsrfToken = () => {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + CSRF_TTL_MS;
  const payload = `${nonce}.${expiresAt}`;
  return `${payload}.${signPayload(payload)}`;
};

export const verifyCsrfToken = (token: unknown) => {
  const value = typeof token === 'string' ? token : '';
  const parts = value.split('.');
  if (parts.length !== 3) return false;

  const [nonce, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!nonce || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const payload = `${nonce}.${expiresAtRaw}`;
  return safeEqual(signature, signPayload(payload));
};

export const csrfProtection = (req: Request, _res: Response, next: NextFunction) => {
  if (!UNSAFE_METHODS.has(req.method) || CSRF_EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  if (!verifyCsrfToken(req.headers[CSRF_HEADER])) {
    next(new AppError('Invalid or missing CSRF token.', 403));
    return;
  }

  next();
};

export const issueCsrfToken = (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      csrfToken: createCsrfToken(),
      expiresInSeconds: Math.floor(CSRF_TTL_MS / 1000),
    },
  });
};
