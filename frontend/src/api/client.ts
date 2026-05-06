import axios from 'axios';

const getBaseURL = (): string => {
  // Env override always wins if set
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // In browser: detect current origin
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;

    // Local development → use local backend
    if (origin.includes('localhost')) {
      return 'http://localhost:4000/api';
    }

    // Deployed on same server as backend → relative path
    if (origin.includes('onrender.com')) {
      return '/api';
    }

    // Deployed on custom domain → point to Render API
    return 'https://web-nurfia.onrender.com/api';
  }

  return 'http://localhost:4000/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const csrfClient = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

const unsafeMethods = new Set(['post', 'put', 'patch', 'delete']);

const getCsrfToken = async () => {
  if (csrfToken) return csrfToken;

  csrfTokenPromise ??= csrfClient.get('/auth/csrf').then(({ data }) => {
    const token = String(data?.data?.csrfToken || '');
    if (!token) {
      throw new Error('CSRF token not returned by server.');
    }
    csrfToken = token;
    return token;
  }).finally(() => {
    csrfTokenPromise = null;
  });

  return csrfTokenPromise;
};

api.interceptors.request.use(async (config) => {
  const method = String(config.method || 'get').toLowerCase();
  if (!unsafeMethods.has(method)) {
    return config;
  }

  const token = await getCsrfToken();
  config.headers.set?.('X-CSRF-Token', token);
  if (!config.headers.get?.('X-CSRF-Token')) {
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hasStoredUser = Boolean(localStorage.getItem('nurfia_user'));
      if (!hasStoredUser) {
        return Promise.reject(error);
      }

      const message = String(error.response?.data?.message || '').toLowerCase();
      const reason = message.includes('deactivated') ? 'deactivated' : 'unauthorized';
      localStorage.removeItem('nurfia_user');
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { reason } }));
    }
    if (error.response?.status === 403 && String(error.response?.data?.message || '').toLowerCase().includes('csrf')) {
      csrfToken = null;
    }
    return Promise.reject(error);
  }
);

export default api;
