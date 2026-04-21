import { create } from 'zustand';
import api from '../api/client';
import { useUIStore } from './uiStore';

export interface CompareItem {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: number;
  salePrice: number | null;
  rating: number;
  stock: number;
  image: string;
}

interface CompareState {
  items: CompareItem[];
  isLoading: boolean;
  fetchCompare: () => Promise<void>;
  addToCompare: (item: CompareItem) => Promise<void>;
  removeFromCompare: (id: number) => Promise<void>;
  clearCompare: () => Promise<void>;
  resetCompare: () => void;
}

export const useCompareStore = create<CompareState>((set, get) => ({
  items: [],
  isLoading: false,

  fetchCompare: async () => {
    try {
      set({ isLoading: true });
      const { data } = await api.get('/compare');
      const mappedItems = data.data.map((ci: any) => ({
        id: ci.productId,
        name: ci.product.name,
        slug: ci.product.slug,
        sku: ci.product.sku,
        price: ci.product.price,
        salePrice: ci.product.salePrice,
        rating: ci.product.avgRating,
        stock: ci.product.stock,
        image: ci.product.images.find((img: any) => img.isPrimary)?.url || ci.product.images[0]?.url || ''
      }));
      set({ items: mappedItems, isLoading: false });
    } catch {
      set({ items: [], isLoading: false });
    }
  },

  addToCompare: async (item) => {
    const { items } = get();
    if (!items.find((i) => i.id === item.id)) {
      // Optimistic update
      set({ items: [...items, item] });

      try {
        await api.post('/compare', { productId: item.id });
      } catch (err: any) {
        if (err.response?.status !== 401) {
          useUIStore.getState().addToast('Failed to save compare to cloud', 'error');
        }
      }
    }
  },

  removeFromCompare: async (id) => {
    // Optimistic update
    set({ items: get().items.filter((i) => i.id !== id) });

    try {
      await api.delete(`/compare/${id}`);
    } catch (err: any) {
      // Rollback could be handled here if needed
      if (err.response?.status !== 401) {
        useUIStore.getState().addToast('Failed to update compare list', 'error');
      }
    }
  },

  clearCompare: async () => {
    set({ items: [] });
    try {
      await api.delete('/compare');
    } catch (err: any) {
      if (err.response?.status !== 401) {
        useUIStore.getState().addToast('Failed to clear compare list', 'error');
      }
    }
  },

  resetCompare: () => set({ items: [] }),
}));
