import path from 'path';
import config from '../config/index.js';

type CacheEntry = {
  isProtected: boolean;
  expiresAt: number;
};

const protectedUploadCache = new Map<string, CacheEntry>();
const PROTECTED_CACHE_TTL_MS = 60 * 60 * 1000;
const UNPROTECTED_CACHE_TTL_MS = 30 * 1000;

export const isStoredBankTransferUploadPath = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/uploads/');

export const getProtectedBankTransferProofUrl = (orderId: number, bankTransferImage?: string | null) =>
  bankTransferImage ? `/api/orders/${orderId}/bank-transfer-proof` : null;

export const getStoredUploadAbsolutePath = (storedPath: string) => {
  const uploadRoot = path.resolve(process.cwd(), config.upload.dir);
  const filename = path.basename(storedPath);
  const absolutePath = path.resolve(uploadRoot, filename);

  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`) && absolutePath !== uploadRoot) {
    throw new Error('Invalid upload path.');
  }

  return absolutePath;
};

export const getCachedProtectedUploadStatus = (storedPath: string) => {
  const entry = protectedUploadCache.get(storedPath);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    protectedUploadCache.delete(storedPath);
    return null;
  }

  return entry.isProtected;
};

export const cacheProtectedUploadStatus = (storedPath: string, isProtected: boolean) => {
  protectedUploadCache.set(storedPath, {
    isProtected,
    expiresAt: Date.now() + (isProtected ? PROTECTED_CACHE_TTL_MS : UNPROTECTED_CACHE_TTL_MS),
  });
};

export const markProtectedUploadPath = (storedPath: string | null | undefined) => {
  if (!isStoredBankTransferUploadPath(storedPath)) return;
  cacheProtectedUploadStatus(storedPath, true);
};
