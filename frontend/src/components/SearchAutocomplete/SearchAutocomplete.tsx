import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, ArrowRight, Grid3X3 } from 'lucide-react';
import api from '../../api/client';
import { getImageUrl } from '../../utils/url';
import './SearchAutocomplete.css';

interface SuggestProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  images: { url: string; alt: string }[];
  category: { name: string; slug: string } | null;
}

interface SuggestCategory {
  id: number;
  name: string;
  slug: string;
  image: string | null;
}

interface SuggestResult {
  products: SuggestProduct[];
  categories: SuggestCategory[];
}

const RECENT_SEARCHES_KEY = 'nurfia_recent_searches';
const MAX_RECENT = 5;

const getRecentSearches = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentSearch = (query: string) => {
  const recent = getRecentSearches().filter((s) => s.toLowerCase() !== query.toLowerCase());
  recent.unshift(query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
};

const clearRecentSearches = () => {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
};

interface Props {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSearch: (q: string) => void;
}

export default function SearchAutocomplete({ query, isOpen, onClose, onSearch }: Props) {
  const [results, setResults] = useState<SuggestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length >= 2;

  const totalItems = (results?.products.length || 0) + (results?.categories.length || 0);

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/products/search-suggest', { params: { q } });
        setResults(data.data);
        setActiveIndex(-1);
      } catch (err) {
        console.error('Search suggest failed:', err);
        setResults(null);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    fetchSuggestions(trimmedQuery);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery, fetchSuggestions]);

  useEffect(() => {
    if (isOpen) setRecentSearches(getRecentSearches());
  }, [isOpen]);

  const handleNavigate = (path: string, searchTerm?: string) => {
    if (searchTerm) saveRecentSearch(searchTerm);
    setRecentSearches(getRecentSearches());
    navigate(path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const products = results?.products || [];
      const categories = results?.categories || [];
      if (activeIndex < products.length) {
        const product = products[activeIndex];
        handleNavigate(`/product/${product.slug}`, trimmedQuery);
      } else {
        const catIndex = activeIndex - products.length;
        if (catIndex < categories.length) {
          handleNavigate(`/category/${categories[catIndex].slug}`, trimmedQuery);
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  if (!isOpen) return null;

  const showRecent = !hasQuery && recentSearches.length > 0;
  const showResults = hasQuery && results && (results.products.length > 0 || results.categories.length > 0);
  const showEmpty = hasQuery && !isLoading && results && results.products.length === 0 && results.categories.length === 0;
  const showLoading = hasQuery && isLoading;

  if (!showRecent && !showResults && !showEmpty && !showLoading) return null;

  return (
    <div className="search-autocomplete" ref={containerRef} onKeyDown={handleKeyDown}>
      {showRecent && (
        <div className="search-ac-section">
          <div className="search-ac-section-header">
            <span className="search-ac-section-title">Recent Searches</span>
            <button type="button" className="search-ac-clear-btn" onClick={handleClearRecent}>Clear</button>
          </div>
          <div className="search-ac-recent-list">
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                className="search-ac-recent-item"
                onClick={() => onSearch(term)}
              >
                <Clock size={12} />
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {showLoading && (
        <div className="search-ac-skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="search-ac-skeleton-item">
              <div className="search-ac-skeleton-img" />
              <div className="search-ac-skeleton-lines">
                <div className="search-ac-skeleton-line" />
                <div className="search-ac-skeleton-line" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && (
        <>
          {results.products.length > 0 && (
            <div className="search-ac-products">
              {results.products.map((product, index) => {
                const imgUrl = product.images[0]?.url ? getImageUrl(product.images[0].url) : '/assets/images/placeholder.webp';
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`search-ac-product${activeIndex === index ? ' is-active' : ''}`}
                    onClick={() => handleNavigate(`/product/${product.slug}`, trimmedQuery)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <img className="search-ac-product-img" src={imgUrl} alt={product.name} />
                    <div className="search-ac-product-info">
                      <div className="search-ac-product-name">{product.name}</div>
                      <div className="search-ac-product-meta">
                        {product.category && (
                          <span className="search-ac-product-category">{product.category.name}</span>
                        )}
                        <span className="search-ac-product-price">
                          ${Number(product.salePrice ?? product.price).toFixed(2)}
                          {product.salePrice && (
                            <span className="sale-original">${Number(product.price).toFixed(2)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {results.categories.length > 0 && (
            <div className="search-ac-categories">
              <div className="search-ac-section" style={{ padding: '8px 12px 4px' }}>
                <span className="search-ac-section-title">Categories</span>
              </div>
              {results.categories.map((cat, index) => {
                const catIndex = (results.products?.length || 0) + index;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`search-ac-category${activeIndex === catIndex ? ' is-active' : ''}`}
                    onClick={() => handleNavigate(`/category/${cat.slug}`, trimmedQuery)}
                    onMouseEnter={() => setActiveIndex(catIndex)}
                  >
                    <div className="search-ac-category-icon">
                      <Grid3X3 size={14} />
                    </div>
                    <span className="search-ac-category-name">{cat.name}</span>
                    <span className="search-ac-category-label">Category</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="search-ac-footer">
            <button
              type="button"
              className="search-ac-view-all"
              onClick={() => handleNavigate(`/category/all?search=${encodeURIComponent(trimmedQuery)}`, trimmedQuery)}
            >
              <Search size={14} />
              View all results for "{trimmedQuery}"
              <ArrowRight size={14} />
            </button>
          </div>
        </>
      )}

      {showEmpty && (
        <div className="search-ac-empty">
          No results found for "{trimmedQuery}"
        </div>
      )}
    </div>
  );
}
