import { create } from 'zustand';

interface ConfirmConfig {
  title?: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface UIState {
  isMobileMenuOpen: boolean;
  isSearchOpen: boolean;
  isLoginDrawerOpen: boolean;
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  confirmModal: ConfirmConfig | null;

  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleSearch: () => void;
  closeSearch: () => void;
  openLoginDrawer: () => void;
  closeLoginDrawer: () => void;
  
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  
  openConfirm: (config: ConfirmConfig) => void;
  closeConfirm: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  isMobileMenuOpen: false,
  isSearchOpen: false,
  isLoginDrawerOpen: false,
  toasts: [],
  confirmModal: null,

  toggleMobileMenu: () => set(s => ({ isMobileMenuOpen: !s.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  toggleSearch: () => set(s => ({ isSearchOpen: !s.isSearchOpen })),
  closeSearch: () => set({ isSearchOpen: false }),
  openLoginDrawer: () => set({ isLoginDrawerOpen: true }),
  closeLoginDrawer: () => set({ isLoginDrawerOpen: false }),

  addToast: (message, type = 'info') => {
    const id = Date.now().toString();
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 3500);
  },

  removeToast: (id) => {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },

  openConfirm: (config) => set({ confirmModal: config }),
  closeConfirm: () => set({ confirmModal: null }),
}));
