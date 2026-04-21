import { create } from 'zustand';
import api from '../api/client';

interface WishlistItem {
  productId: number;
  createdAt: string;
  product: {
    id: number;
    name: string;
    slug: string;
    price: string | number;
    salePrice: string | number | null;
    inStock: boolean;
    stock: number;
    images: { url: string }[];
    category?: { name: string; slug: string };
  };
}

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  error: string | null;
  fetchWishlist: () => Promise<void>;
  toggleWishlist: (productId: number) => Promise<void>;
  isInWishlist: (productId: number) => boolean;
  clearWishlistLocally: () => void;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchWishlist: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/wishlist');
      set({ items: data.data || [], isLoading: false });
    } catch (err: any) {
      set({
        items: [],
        error: err.response?.status === 401 ? null : err.response?.data?.error || 'Failed to fetch wishlist',
        isLoading: false,
      });
    }
  },

  toggleWishlist: async (productId: number) => {
    const { isInWishlist, fetchWishlist } = get();
    try {
      if (isInWishlist(productId)) {
        await api.delete(`/wishlist/${productId}`);
      } else {
        await api.post('/wishlist', { productId });
      }
      await fetchWishlist(); // Refresh to ensure sync
    } catch (err: any) {
      console.error('Wishlist toggle error:', err);
      // We could add a toast here or throw error to let component handle it
      throw err;
    }
  },

  isInWishlist: (productId: number) => {
    return get().items.some(item => item.productId === productId);
  },

  clearWishlistLocally: () => {
    set({ items: [] });
  }
}));
