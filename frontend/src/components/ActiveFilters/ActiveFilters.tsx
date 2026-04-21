import { useSearchParams, useNavigate, useParams } from 'react-router-dom';

export default function ActiveFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  
  const removeFilter = (key: string, value?: string) => {
    if (key === 'categorySlug') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('category'); // In case it's there
      navigate(`/shop?${newParams.toString()}`);
      return;
    }
    
    if (value) {
      const current = searchParams.get(key)?.split(',') || [];
      const next = current.filter(v => v !== value);
      if (next.length > 0) searchParams.set(key, next.join(','));
      else searchParams.delete(key);
    } else {
      searchParams.delete(key);
    }
    searchParams.set('page', '1');
    setSearchParams(searchParams);
  };

  const clearAll = () => {
    const newParams = new URLSearchParams();
    if (searchParams.get('search')) newParams.set('search', searchParams.get('search')!);
    if (searchParams.get('sort')) newParams.set('sort', searchParams.get('sort')!);
    if (slug) {
      navigate(`/shop?${newParams.toString()}`);
    } else {
      setSearchParams(newParams);
    }
  };

  const filters: { key: string; value: string; display: string }[] = [];
  ['colors', 'sizes', 'brands'].forEach(key => {
    const list = searchParams.get(key)?.split(',') || [];
    list.forEach(val => {
      let display = val;
      if (key === 'colors') {
        display = val.split(/[- ]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      } else if (key === 'brands') {
        display = val.split(/[- ]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      } else {
        display = val.toUpperCase();
      }
      filters.push({ key, value: val, display: display });
    });
  });

  if (searchParams.get('category')) {
    const _cat = searchParams.get('category')!;
    filters.push({ key: 'category', value: _cat, display: _cat.charAt(0).toUpperCase() + _cat.slice(1) });
  } else if (slug && slug !== 'all') {
    filters.push({ key: 'categorySlug', value: slug, display: slug.charAt(0).toUpperCase() + slug.slice(1) });
  }

  if (searchParams.get('minPrice') || searchParams.get('maxPrice')) {
    filters.push({ key: 'price', value: '', display: `Price: $${searchParams.get('minPrice') || 0}-$${searchParams.get('maxPrice') || 500}` });
  }

  if (filters.length === 0) return null;

  return (
    <div className="active-filters">
      <button onClick={clearAll} className="active-filter-btn" title="Clear all filters">
        <strong>×</strong> Clear filters
      </button>
      {filters.map(f => (
        <button 
          key={`${f.key}-${f.value}`} 
          onClick={() => {
            if (f.key === 'price') {
              searchParams.delete('minPrice');
              searchParams.delete('maxPrice');
              searchParams.set('page', '1');
              setSearchParams(searchParams);
            } else {
              removeFilter(f.key, f.value);
            }
          }}
          className="active-filter-btn"
          title={`Remove ${f.display}`}
        >
          <strong>×</strong> {f.display}
        </button>
      ))}
    </div>
  );
}
