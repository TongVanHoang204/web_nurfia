import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Grid3X3, LayoutGrid, ChevronRight } from 'lucide-react';
import api from '../../api/client';
import ProductCard from "../../components/ProductCard/ProductCard";
import FilterSidebar from "../../components/FilterSidebar/FilterSidebar";
import ActiveFilters from "../../components/ActiveFilters/ActiveFilters";
import './ShopPage.css';

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState(searchParams.get('sort') || 'default');
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [gridCols, setGridCols] = useState(3); // Default to 3 columns per screenshot
  
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const params: any = { page, limit: itemsPerPage, sort };
        if (searchParams.get('minPrice')) params.minPrice = searchParams.get('minPrice');
        if (searchParams.get('maxPrice')) params.maxPrice = searchParams.get('maxPrice');
        if (searchParams.get('colors')) params.colors = searchParams.get('colors');
        if (searchParams.get('sizes')) params.sizes = searchParams.get('sizes');
        if (searchParams.get('brands')) params.brands = searchParams.get('brands');
        if (searchParams.get('category')) params.category = searchParams.get('category');
        // Fetch products, maybe without category filter right now if it's the general /shop
        const { data } = await api.get('/products', { params });
        setProducts(data?.data || []);
        setPagination(data?.pagination || { page: 1, total: 0, totalPages: 0 });
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [page, sort, itemsPerPage, searchParams.get('minPrice'), searchParams.get('maxPrice'), searchParams.get('colors'), searchParams.get('sizes'), searchParams.get('brands'), searchParams.get('category')]);

  const handleSort = (newSort: string) => {
    setSort(newSort);
    searchParams.set('sort', newSort);
    searchParams.set('page', '1');
    setSearchParams(searchParams);
  };

  const handlePage = (newPage: number) => {
    searchParams.set('page', newPage.toString());
    setSearchParams(searchParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="shop-page container">
      {/* Breadcrumb could go here if needed, but per screenshot we jump straight to layout */}
      <div className="shop-layout">
        
        {/* Sidebar Filters */}
        <FilterSidebar />
        <main className="shop-main">
          <ActiveFilters />
          {/* Toolbar */}
          <div className="shop-toolbar">
            <p className="result-count">
              Showing {Math.min((page - 1) * itemsPerPage + 1, pagination.total)}-
              {Math.min(page * itemsPerPage, pagination.total)} of {pagination.total} results
            </p>
            <div className="toolbar-controls">
              <div className="grid-toggle">
                <button aria-label="3 Columns Grid" title="3 Columns Grid" className={gridCols === 3 ? 'active' : ''} onClick={() => setGridCols(3)}><Grid3X3 size={16} /></button>
                <button aria-label="4 Columns Grid" title="4 Columns Grid" className={gridCols === 4 ? 'active' : ''} onClick={() => setGridCols(4)}><LayoutGrid size={16} /></button>
              </div>
              <div className="sort-select">
                <label className="visually-hidden" htmlFor="sort-select">Sort by</label>
                <select id="sort-select" title="Sort products" aria-label="Sort products" value={sort} onChange={(e) => handleSort(e.target.value)}>
                  <option value="default">Default sorting</option>
                  <option value="newest">Sort by latest</option>
                  <option value="price_asc">Sort by price: low to high</option>
                  <option value="price_desc">Sort by price: high to low</option>
                  <option value="rating">Sort by average rating</option>
                </select>
              </div>
              <div className="items-per-page">
                <label className="visually-hidden" htmlFor="items-per-page">Items per page</label>
                <select id="items-per-page" title="Items per page" aria-label="Items per page" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); handlePage(1); }}>
                  <option value="12">12 Items</option>
                  <option value="24">24 Items</option>
                  <option value="36">36 Items</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className={`product-grid grid-${gridCols}`}>
            {isLoading ? (
              <div className="loading-state">Loading products...</div>
            ) : products.length > 0 ? (
              products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            ) : (
              <p>No products found matching your selection.</p>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="shop-pagination">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(num => (
                <button 
                  key={num} 
                  className={num === page ? 'active' : ''} 
                  onClick={() => handlePage(num)}
                >
                  {num}
                </button>
              ))}
              <button 
                className="next-page" 
                aria-label="Next page"
                title="Next page"
                onClick={() => handlePage(page + 1)} 
                disabled={page >= pagination.totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Recently Viewed Section (Mock per screenshot) */}
      <div className="recently-viewed">
        <h3>Recently viewed</h3>
        <div className="recent-grid grid-4">
          {products.slice(0, 4).map(product => (
             <ProductCard key={`recent-${product.id}`} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
