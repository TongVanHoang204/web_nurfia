import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

type SiteSettingsMap = Record<string, string>;

type SiteSettingsContextValue = {
  settings: SiteSettingsMap;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
};

const DEFAULT_SETTINGS: SiteSettingsMap = {
  siteName: 'Nurfia',
  tagline: 'Premium Fashion for Women & Men',
  siteTitle: 'Nurfia - Fashion eCommerce',
  siteDescription: 'Nurfia - Premium Fashion eCommerce. Discover the latest trends in women\'s and men\'s clothing, accessories, and more.',
};

const resolveSafeAbsoluteUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return '';
  }

  return '';
};

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  refreshSettings: async () => {},
});

export const resolveSiteAssetUrl = (value: string) => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return resolveSafeAbsoluteUrl(value);

  if (value === '/favicon.svg' || value.startsWith('/assets/')) return value;
  if (!value.startsWith('/')) return '';

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
  const apiOrigin = new URL(apiBase, window.location.origin).origin;
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${apiOrigin}${normalizedPath}`;
};

export const resolveExternalUrl = (value: string, fallback: string) => {
  if (!value) return fallback;
  return resolveSafeAbsoluteUrl(value) || fallback;
};

const applyHeadSettings = (settings: SiteSettingsMap) => {
  const resolvedTitle = settings.siteTitle || settings.siteName || DEFAULT_SETTINGS.siteTitle;
  const resolvedDescription = settings.siteDescription || settings.tagline || DEFAULT_SETTINGS.siteDescription;
  const resolvedFavicon = resolveSiteAssetUrl(settings.faviconUrl || settings.logoUrl || '/favicon.svg') || '/favicon.svg';

  document.title = resolvedTitle;

  const descriptionTag = document.querySelector('meta[name="description"]');
  if (descriptionTag) {
    descriptionTag.setAttribute('content', resolvedDescription);
  }

  document.querySelectorAll("link[rel*='icon']").forEach(el => el.remove());
  
  const link = document.createElement('link');
  if (resolvedFavicon.endsWith('.svg')) {
    link.type = 'image/svg+xml';
  } else if (resolvedFavicon.endsWith('.png')) {
    link.type = 'image/png';
  } else if (resolvedFavicon.endsWith('.gif')) {
    link.type = 'image/gif';
  } else if (resolvedFavicon.endsWith('.ico')) {
    link.type = 'image/x-icon';
  } else {
    link.removeAttribute('type'); // Let the browser infer
  }
  
  link.rel = 'shortcut icon';
  link.href = resolvedFavicon;
  document.head.appendChild(link);
};

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettingsMap>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      const nextSettings = {
        ...DEFAULT_SETTINGS,
        ...(data.data || {}),
      };
      setSettings(nextSettings);
      applyHeadSettings(nextSettings);
    } catch {
      setSettings(DEFAULT_SETTINGS);
      applyHeadSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const value = useMemo(() => ({
    settings,
    isLoading,
    refreshSettings,
  }), [settings, isLoading]);

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
