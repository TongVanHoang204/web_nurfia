import type { Response } from 'express';
import config from '../config/index.js';

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/i;

const normalizeOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
};

export const getAllowedOrigins = () => {
  const candidates = Array.isArray(config.cors.origins) && config.cors.origins.length
    ? config.cors.origins
    : [config.app.publicUrl];

  return Array.from(new Set(
    candidates
      .map((candidate) => normalizeOrigin(candidate))
      .filter((candidate): candidate is string => Boolean(candidate))
  ));
};

export const resolveTrustedAppOrigin = (candidate?: string | null) => {
  const allowedOrigins = getAllowedOrigins();
  const normalizedCandidate = candidate ? normalizeOrigin(candidate) : null;

  if (normalizedCandidate && allowedOrigins.includes(normalizedCandidate)) {
    return normalizedCandidate;
  }

  return allowedOrigins[0] || 'http://localhost:5173';
};

const parseDurationToMs = (value: string) => {
  const match = String(value || '').trim().match(DURATION_PATTERN);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] || multipliers.d);
};

export const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: true, // Always true for SameSite=None
  sameSite: 'none' as const,
  path: '/',
  maxAge: parseDurationToMs(config.jwt.expiresIn),
});

export const setAuthCookie = (res: Response, token: string) => {
  res.cookie(config.jwt.cookieName, token, getAuthCookieOptions());
};

export const clearAuthCookie = (res: Response) => {
  res.clearCookie(config.jwt.cookieName, {
    ...getAuthCookieOptions(),
    expires: new Date(0),
  });
};

export const parseCookieHeader = (value: string | undefined, key: string) => {
  if (!value) return null;

  const cookies = value.split(';');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name?.trim() !== key) continue;
    return decodeURIComponent(rest.join('=').trim());
  }

  return null;
};
