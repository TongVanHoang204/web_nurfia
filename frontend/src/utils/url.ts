import { getApiAssetOrigin, resolveSiteAssetUrl } from '../contexts/SiteSettingsContext';

export function getImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;

  const resolvedAssetUrl = resolveSiteAssetUrl(url);
  if (resolvedAssetUrl) return resolvedAssetUrl;

  // Clean up Double Slash just in case
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${getApiAssetOrigin()}${cleanUrl}`;
}
