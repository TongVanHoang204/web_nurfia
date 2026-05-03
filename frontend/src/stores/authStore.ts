import { create } from 'zustand';
import api from '../api/client';
import { useCompareStore } from './compareStore';
import { useCartStore } from './cartStore';

interface User {
  id: number;
  email: string;
  username: string;
  fullName: string;
  phone?: string;
  role: string;
  permissions?: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrating: boolean;
  isAuthenticated: boolean;
  mustLogin: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; username: string; fullName: string }) => Promise<void>;
  logout: (options?: { redirectTo?: string; forceLogin?: boolean; notice?: string }) => Promise<void>;
  loadUser: () => Promise<void>;
}

const getStoredUser = (): User | null => {
  const stored = localStorage.getItem('nurfia_user');
  if (!stored) return null;

  try {
    return JSON.parse(stored) as User;
  } catch {
    localStorage.removeItem('nurfia_user');
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrating: true,
  isAuthenticated: false,
  mustLogin: localStorage.getItem('nurfia_must_login') === '1',

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { username, password });
      const { user } = data.data;
      localStorage.setItem('nurfia_user', JSON.stringify(user));
      localStorage.removeItem('nurfia_must_login');
      localStorage.removeItem('nurfia_auth_notice');
      set({ user, token: null, isAuthenticated: true, mustLogin: false });
    } finally {
      set({ isLoading: false, isHydrating: false });
    }
  },

  register: async (formData) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/register', formData);
      const { user } = data.data;
      localStorage.setItem('nurfia_user', JSON.stringify(user));
      localStorage.removeItem('nurfia_must_login');
      localStorage.removeItem('nurfia_auth_notice');
      set({ user, token: null, isAuthenticated: true, mustLogin: false });
    } finally {
      set({ isLoading: false, isHydrating: false });
    }
  },

  logout: async (options) => {
    const shouldForceLogin = !!options?.forceLogin;
    const redirectTo = options?.redirectTo || '/login';
    const authNotice = String(options?.notice || '').trim();

    try {
      await api.post('/auth/logout');
    } catch {}

    localStorage.removeItem('nurfia_user');
    if (shouldForceLogin) {
      localStorage.setItem('nurfia_must_login', '1');
    } else {
      localStorage.removeItem('nurfia_must_login');
    }

    if (authNotice) {
      localStorage.setItem('nurfia_auth_notice', authNotice);
    } else {
      localStorage.removeItem('nurfia_auth_notice');
    }

    // Clear stores on logout
    if (typeof window !== 'undefined') {
      try { useCompareStore.getState().resetCompare(); } catch(e){}
      try { useCartStore.getState().resetCart(); } catch(e){}
    }
    set({ user: null, token: null, isAuthenticated: false, mustLogin: shouldForceLogin, isHydrating: false });
    window.location.href = redirectTo;
  },

  loadUser: async () => {
    const storedUser = getStoredUser();
    set({ isHydrating: true });

    if (storedUser) {
      set({
        user: {
          ...storedUser,
          permissions: Array.isArray(storedUser?.permissions) ? storedUser.permissions : [],
        },
        token: null,
        isAuthenticated: true,
      });
    }

    try {
      const { data } = await api.get('/auth/profile');
      const nextUser = {
        ...data.data,
        permissions: Array.isArray(data.data?.permissions)
          ? data.data.permissions
          : Array.isArray(storedUser?.permissions)
            ? storedUser.permissions
            : [],
      };
      localStorage.setItem('nurfia_user', JSON.stringify(nextUser));
      localStorage.removeItem('nurfia_must_login');
      localStorage.removeItem('nurfia_auth_notice');
      set({ user: nextUser, token: null, isAuthenticated: true, mustLogin: false, isHydrating: false });
    } catch {
      localStorage.removeItem('nurfia_user');
      set({ user: null, token: null, isAuthenticated: false, isHydrating: false });
    }
  },
}));

if (typeof window !== 'undefined') {
  let isHandlingUnauthorized = false;

  window.addEventListener('auth:unauthorized', (event) => {
    if (isHandlingUnauthorized) return;

    const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
    const forceLogin = reason === 'deactivated';
    const notice = forceLogin
      ? 'Your account has been deactivated by an administrator. Please contact support.'
      : '';

    isHandlingUnauthorized = true;
    useAuthStore.getState().logout({ redirectTo: '/login', forceLogin, notice });

    window.setTimeout(() => {
      isHandlingUnauthorized = false;
    }, 1000);
  });
}
