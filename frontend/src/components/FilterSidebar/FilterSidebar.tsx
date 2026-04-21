import { useSearchParams, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../../api/client';
import '../../pages/ShopPage/ShopPage.css';

type ColorFilterOption = {
  value: string;
  colorHex?: string | null;
};

type BrandFilterOption = {
  name: string;
  slug: string;
};

const FALLBACK_COLORS: ColorFilterOption[] = [
  { value: 'Black', colorHex: '#000000' },
  { value: 'White', colorHex: '#FFFFFF' },
  { value: 'Navy', colorHex: '#1B2A4A' },
  { value: 'Beige', colorHex: '#D4C5A9' },
  { value: 'Brown', colorHex: '#8B4513' },
  { value: 'Gray', colorHex: '#808080' },
  { value: 'Pink', colorHex: '#FFC0CB' },
  { value: 'Red', colorHex: '#C41E3A' },
  { value: 'Blue', colorHex: '#4169E1' },
  { value: 'Green', colorHex: '#2E8B57' },
  { value: 'Cream', colorHex: '#FFFDD0' },
  { value: 'Olive', colorHex: '#6B8E23' },
];

const FALLBACK_BRANDS: BrandFilterOption[] = [
  { name: 'Calvin Klein', slug: 'calvin-klein' },
  { name: 'lacoste', slug: 'lacoste' },
  { name: 'Louis Vuitton', slug: 'louis-vuitton' },
  { name: 'Sportempt', slug: 'sportempt' },
  { name: 'Tomy Hilfiger', slug: 'tomy-hilfiger' },
  { name: 'UCLA', slug: 'ucla' },
];

const toColorClassName = (value: string) => `color-circle color-${String(value || '').trim().toLowerCase().replace(/\s+/g, '-')} mx-2`;

export default function FilterSidebar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();

  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [colorOptions, setColorOptions] = useState<ColorFilterOption[]>(FALLBACK_COLORS);
  const [brandOptions, setBrandOptions] = useState<BrandFilterOption[]>(FALLBACK_BRANDS);

  useEffect(() => {
    setMinPrice(searchParams.get('minPrice') || '');
    setMaxPrice(searchParams.get('maxPrice') || '');
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const fetchFilterOptions = async () => {
      try {
        const { data } = await api.get('/products/filters');
        const colors = Array.isArray(data?.data?.colors) ? data.data.colors : [];
        const brands = Array.isArray(data?.data?.brands) ? data.data.brands : [];
        if (!isMounted) return;

        const normalizedColors = colors
          .map((item: any) => ({
            value: String(item.value || '').trim(),
            colorHex: item.colorHex || null,
          }))
          .filter((item: ColorFilterOption) => item.value.length > 0);

        if (normalizedColors.length > 0) {
          setColorOptions(normalizedColors);
        }

        const normalizedBrands = brands
          .map((item: any) => ({
            name: String(item.name || '').trim(),
            slug: String(item.slug || '').trim(),
          }))
          .filter((item: BrandFilterOption) => item.name.length > 0 && item.slug.length > 0);

        if (normalizedBrands.length > 0) {
          setBrandOptions(normalizedBrands);
        }
      } catch {
        // Keep fallback colors if API request fails.
      }
    };

    fetchFilterOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCheckboxChange = (key: string, value: string) => {
    const current = searchParams.get(key) ? searchParams.get(key)!.split(',') : [];
    if (current.includes(value)) {
      const next = current.filter(v => v !== value);
      if (next.length > 0) searchParams.set(key, next.join(','));
      else searchParams.delete(key);
    } else {
      current.push(value);
      searchParams.set(key, current.join(','));
    }
    searchParams.set('page', '1');
    setSearchParams(searchParams);
  };

  const isChecked = (key: string, value: string) => {
    return searchParams.get(key)?.split(',').includes(value) || false;
  };

  const applyPriceFilter = () => {
    if (minPrice) searchParams.set('minPrice', minPrice);
    else searchParams.delete('minPrice');
    if (maxPrice) searchParams.set('maxPrice', maxPrice);
    else searchParams.delete('maxPrice');
    searchParams.set('page', '1');
    setSearchParams(searchParams);
  };

  const handleCategoryChange = (cat: string) => {
    const isCatPage = location.pathname.startsWith('/category');
    if (isCatPage) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('category');
      newParams.delete('page');
      if (slug === cat) {
        navigate(`/shop?${newParams.toString()}`);
      } else {
        navigate(`/category/${cat}?${newParams.toString()}`);
      }
    } else {
      if (searchParams.get('category') === cat) {
        searchParams.delete('category');
      } else {
        searchParams.set('category', cat);
      }
      searchParams.set('page', '1');
      setSearchParams(searchParams);
    }
  };

  const currentMin = parseInt(minPrice) || 0;
  const currentMax = parseInt(maxPrice) || 500;
  const leftPercent = (currentMin / 500) * 100;
  const rightPercent = 100 - (currentMax / 500) * 100;

  return (
    <aside className="shop-sidebar">
      <style>{`
        .dual-slider-input {
          position: absolute;
          width: 100%;
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          pointer-events: none;
          top: -6px;
          margin: 0;
        }
        .dual-slider-input:focus { outline: none; }
        .dual-slider-input::-webkit-slider-thumb {
          pointer-events: auto;
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: #000;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          cursor: pointer;
        }
        .dual-slider-input::-moz-range-thumb {
          pointer-events: auto;
          width: 16px;
          height: 16px;
          background: #000;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          cursor: pointer;
        }
      `}</style>
      <div className="filter-widget">
        <h4 className="widget-title">Product Categories</h4>
        <ul className="category-list">
          {['Dresses', 'Jackets', 'Men', 'T-shirts', 'Tops', 'Women'].map(cat => (
            <li key={cat}>
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  aria-label={`Category ${cat}`} 
                  title={`Category ${cat}`} 
                  checked={slug ? slug === cat.toLowerCase() : searchParams.get('category') === cat.toLowerCase()}
                  onChange={() => handleCategoryChange(cat.toLowerCase())}
                /> <span className="checkmark" style={(slug ? slug === cat.toLowerCase() : searchParams.get('category') === cat.toLowerCase()) ? { borderRadius: '50%' } : {}}></span> {cat}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="filter-widget">
        <h4 className="widget-title">Filter by price</h4>
        <div className="price-slider-mock relative">
          <div className="slider-track absolute top-0 bottom-0 m-auto w-full h-[4px] bg-gray-200 rounded-[2px]" style={{ '--bg': '#eee', '--h': '4px', '--br': '2px', '--w': '100%', '--pos': 'absolute', '--t': '0', '--b': '0', '--m': 'auto' } as React.CSSProperties}>
            <div className="slider-fill h-full bg-black absolute" style={{ '--left': `${leftPercent}%`, '--right': `${rightPercent}%` } as React.CSSProperties}></div>
          </div>
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            className="dual-slider-input"
            title="Min price range"
            value={currentMin}
            onChange={(e) => {
              const val = Math.min(Number(e.target.value), currentMax - 10);
              setMinPrice(val.toString());
            }}
          />
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            className="dual-slider-input"
            title="Max price range"
            value={currentMax}
            onChange={(e) => {
              const val = Math.max(Number(e.target.value), currentMin + 10);
              setMaxPrice(val.toString());
            }}
          />
        </div>
        <div className="price-inputs">
          <label className="visually-hidden" htmlFor="min-price">Min price</label>
          <input 
            type="number" 
            id="min-price" 
            title="Minimum price" 
            placeholder="Min" 
            aria-label="Minimum price" 
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <span>-</span>
          <label className="visually-hidden" htmlFor="max-price">Max price</label>
          <input 
            type="number" 
            id="max-price" 
            title="Maximum price" 
            placeholder="Max" 
            aria-label="Maximum price" 
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        <div className="price-action">
          <span className="price-label">Price: ${minPrice || 0} — ${maxPrice || '∞'}</span>
          <button className="filter-btn" onClick={applyPriceFilter}>FILTER</button>
        </div>
      </div>

      <div className="filter-widget">
        <h4 className="widget-title">Filter by Color</h4>
        <ul className="color-list">
          {colorOptions.map((color) => {
            return (
            <li key={color.value} className="flex align-center gap-2 mb-2">
              <label className="checkbox-label flex align-center">
                <input 
                  type="checkbox" 
                  title={`Color ${color.value}`} 
                  checked={isChecked('colors', color.value)}
                  onChange={() => handleCheckboxChange('colors', color.value)}
                /> 
                <span className="checkmark"></span> 
                <span className={toColorClassName(color.value)}></span>
                <span className="color-name">{color.value}</span>
              </label>
            </li>
            );
          })}
        </ul>
      </div>

      <div className="filter-widget">
        <h4 className="widget-title">Filter by Size</h4>
        <ul className="size-list">
          {['XS', 'S', 'M', 'L', 'XL'].map(size => (
            <li key={size}>
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  aria-label={`Size ${size}`} 
                  title={`Size ${size}`} 
                  checked={isChecked('sizes', size)}
                  onChange={() => handleCheckboxChange('sizes', size)}
                /> <span className="checkmark"></span> {size}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="filter-widget">
        <h4 className="widget-title">Filter by Brand</h4>
        <ul className="brand-list">
          {brandOptions.map((brand) => (
            <li key={brand.slug}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  aria-label={`Brand ${brand.name}`}
                  title={`Brand ${brand.name}`}
                  checked={isChecked('brands', brand.slug)}
                  onChange={() => handleCheckboxChange('brands', brand.slug)}
                /> <span className="checkmark"></span> {brand.name}
              </label>
            </li>
          ))}
        </ul>
      </div>

    </aside>
  );
}
