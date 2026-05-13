import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import config from '../config/index.js';
import { getCsrfCookieOptions, parseCookieHeader } from '../utils/security.js';
import { AppError } from './errorHandler.js';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'nurfia_csrf';
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

const getAuthCookieValue = (req: Request) =>
  req.cookies?.[config.jwt.cookieName]
  || parseCookieHeader(req.headers.cookie, config.jwt.cookieName)
  || '';

const getSessionBinding = (req: Request) => {
  const authCookie = getAuthCookieValue(req);
  if (!authCookie) return 'anonymous';

  return crypto.createHash('sha256').update(authCookie).digest('base64url');
};

export const createCsrfToken = (sessionBinding = 'anonymous') => {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + CSRF_TTL_MS;
  const payload = `${nonce}.${expiresAt}.${sessionBinding}`;
  return `${payload}.${signPayload(payload)}`;
};

export const verifyCsrfToken = (token: unknown, expectedSessionBinding = 'anonymous') => {
  const value = typeof token === 'string' ? token : '';
  const parts = value.split('.');
  if (parts.length !== 4) return false;

  const [nonce, expiresAtRaw, sessionBinding, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!nonce || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  if (!safeEqual(sessionBinding, expectedSessionBinding)) return false;

  const payload = `${nonce}.${expiresAtRaw}.${sessionBinding}`;
  return safeEqual(signature, signPayload(payload));
};

export const csrfProtection = (req: Request, _res: Response, next: NextFunction) => {
  if (!UNSAFE_METHODS.has(req.method) || CSRF_EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  const headerToken = typeof req.headers[CSRF_HEADER] === 'string' ? req.headers[CSRF_HEADER] : '';
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME]
    || parseCookieHeader(req.headers.cookie, CSRF_COOKIE_NAME)
    || '';

  if (
    !headerToken
    || !cookieToken
    || !safeEqual(headerToken, cookieToken)
    || !verifyCsrfToken(headerToken, getSessionBinding(req))
  ) {
    next(new AppError('Invalid or missing CSRF token.', 403));
    return;
  }

  next();
};

export const issueCsrfToken = (req: Request, res: Response) => {
  const csrfToken = createCsrfToken(getSessionBinding(req));
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions());

  res.json({
    success: true,
    data: {
      csrfToken,
      expiresInSeconds: Math.floor(CSRF_TTL_MS / 1000),
    },
  });
};
