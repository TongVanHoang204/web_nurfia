const API_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

export function getImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  
  // Clean up Double Slash just in case
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${API_URL}${cleanUrl}`;
}
