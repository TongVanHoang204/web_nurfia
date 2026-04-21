import { create } from 'zustand';
import api from '../api/client';
import { useUIStore } from './uiStore';

export interface CartItem {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  product: {
    id: number;
    name: string;
    slug: string;
    price: number;
    salePrice: number | null;
    images: { url: string; alt: string }[];
  };
  variant?: {
    id: number;
    price: number;
    salePrice: number | null;
    attributes: {
      attributeValue: {
        value: string;
        attribute: { name: string };
      };
    }[];
  };
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  isLoading: boolean;
  openCart: () => void;
  closeCart: () => void;
  fetchCart: () => Promise<void>;
  addToCart: (productId: number, variantId?: number, quantity?: number, silent?: boolean) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  getSubtotal: () => number;
  getItemCount: () => number;  resetCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,
  isLoading: false,

  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),

  fetchCart: async () => {
    try {
      set({ isLoading: true });
      const { data } = await api.get('/cart');
      set({ items: data.data, isLoading: false });
    } catch {
      set({ items: [], isLoading: false });
    }
  },

  addToCart: async (productId, variantId, quantity = 1, silent = false) => {
    set({ isLoading: true });
    await api.post('/cart/items', { productId, variantId, quantity });
    await get().fetchCart();
    set({ isOpen: silent ? false : true, isLoading: false });
  },

  updateQuantity: async (itemId, quantity) => {
    try {
      await api.put(`/cart/items/${itemId}`, { quantity });
      await get().fetchCart();
    } catch (err: any) {
      useUIStore.getState().addToast(err.response?.data?.message || 'Failed to update quantity', 'error');
    }
  },

  removeItem: async (itemId) => {
    try {
      await api.delete(`/cart/items/${itemId}`);
      await get().fetchCart();
    } catch (err: any) {
      useUIStore.getState().addToast('Failed to remove item', 'error');
    }
  },

  resetCart: () => set({ items: [] }),  clearCart: async () => {
    await api.delete('/cart');
    set({ items: [] });
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => {
      const price = item.variant?.salePrice ?? item.variant?.price ?? item.product.salePrice ?? item.product.price;
      return sum + Number(price) * item.quantity;
    }, 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
