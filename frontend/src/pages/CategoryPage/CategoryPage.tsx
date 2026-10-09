import Select from '../../components/Select/Select';
import { translateUi } from '../../i18n';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Grid3X3, LayoutGrid, List } from 'lucide-react';
import api from '../../api/client';
import ProductCard from "../../components/ProductCard/ProductCard";
import FilterSidebar from "../../components/FilterSidebar/FilterSidebar";
import ActiveFilters from "../../components/ActiveFilters/ActiveFilters";
import { sanitizeRichHtml } from '../../utils/sanitizeHtml';
import './CategoryPage.css';

export default function CategoryPage() {
  useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [category, setCategory] = useState<any>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [gridCols, setGridCols] = useState(4);
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const params: any = { page, limit: 12, sort };
        if (searchParams.get('minPrice')) params.minPrice = searchParams.get('minPrice');
        if (searchParams.get('maxPrice')) params.maxPrice = searchParams.get('maxPrice');
        if (searchParams.get('colors')) params.colors = searchParams.get('colors');
        if (searchParams.get('sizes')) params.sizes = searchParams.get('sizes');
        if (searchParams.get('brands')) params.brands = searchParams.get('brands');
        if (slug && slug !== 'all') params.category = slug;
        if (search) params.search = search;

        const { data } = await api.get('/products', { params });
        setProducts(data.data);
        setPagination(data.pagination);

        // Fetch category info
        if (slug && slug !== 'all') {
          try {
            const catRes = await api.get(`/categories/${slug}`);
            let catData = catRes.data.data;
            if (catData.parent) {
              const parentRes = await api.get(`/categories/${catData.parent.slug}`);
              catData.siblingCategories = parentRes.data.data.children;
            }
            setCategory(catData);
          } catch { setCategory(null); }
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [slug, page, sort, search, searchParams.get('minPrice'), searchParams.get('maxPrice'), searchParams.get('colors'), searchParams.get('sizes'), searchParams.get('brands')]);

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

  const displayTitle = search ? `Search: "${search}"` : category?.parent ? category.parent.name : category?.name || (slug === 'all' ? 'All Products' : slug || 'Products');
  const sanitizedCategoryDescription = sanitizeRichHtml(category?.description || '');

  return (
    <>

      {/* Breadcrumb */}
      <div className="category-breadcrumb">
        <div className="container">
          <Link to="/">{translateUi("Home")}</Link>
          <span>/</span>
          <span>{displayTitle}</span>
          {category?.parent && (
            <>
              <span>/</span>
              <span>{category.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="category-header">
        <div className="container">
          <h1 className="category-title">{displayTitle}</h1>
          {category?.description && <div className="category-desc" dangerouslySetInnerHTML={{ __html: sanitizedCategoryDescription }} />}

          {(category?.children?.length > 0 || category?.siblingCategories?.length > 0) && (
            <div className="subcategory-links">
              {(category.children || category.siblingCategories).map((sub: any) => (
                <Link key={sub.id} to={`/category/${sub.slug}`} className={`subcategory-link ${sub.slug === slug ? 'active' : ''}`}>{sub.name}</Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="shop-page container">
        <div className="shop-layout">
          <FilterSidebar />
          <main className="shop-main">
            <ActiveFilters />
            <div className="category-toolbar">
          <p className="result-count">{translateUi("Showing")} {products.length} {translateUi("of")} {pagination.total} {translateUi("results")}</p>
          <div className="toolbar-right">
            <div className="grid-toggle">
              <button title={translateUi("3 Columns")} aria-label={translateUi("3 Columns")} className={gridCols === 3 ? 'active' : ''} onClick={() => setGridCols(3)}><Grid3X3 size={16} /></button>
              <button title={translateUi("4 Columns")} aria-label={translateUi("4 Columns")} className={gridCols === 4 ? 'active' : ''} onClick={() => setGridCols(4)}><LayoutGrid size={16} /></button>
              <button title={translateUi("5 Columns")} aria-label={translateUi("5 Columns")} className={gridCols === 5 ? 'active' : ''} onClick={() => setGridCols(5)}><List size={16} /></button>
            </div>
            <div className="sort-select">
              <Select title={translateUi("Sort by")} aria-label={translateUi("Sort by")} value={sort} onChange={(e) => handleSort(e.target.value)}>
                <option value="newest">{translateUi("Newest")}</option>
                <option value="price_asc">{translateUi("Price: Low to High")}</option>
                <option value="price_desc">{translateUi("Price: High to Low")}</option>
                <option value="name_asc">{translateUi("Name: A-Z")}</option>
                <option value="name_desc">{translateUi("Name: Z-A")}</option>
                <option value="popular">{translateUi("Popularity")}</option>
                <option value="rating">{translateUi("Rating")}</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="no-products">
            <h3>{translateUi("No products found")}</h3>
            <p>{translateUi("Try adjusting your search or filter criteria")}</p>
            <Link to="/category/all" className="btn btn-primary mt-2">{translateUi("View All Products")}</Link>
          </div>
        ) : (
          <div className={`grid grid-${gridCols}`}>{products.map(p => <ProductCard key={p.id} product={p} />)}</div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => handlePage(page - 1)} className="page-btn">{translateUi("Prev")}</button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => handlePage(p)}>{p}</button>
            ))}
            <button disabled={page >= pagination.totalPages} onClick={() => handlePage(page + 1)} className="page-btn">{translateUi("Next")}</button>
          </div>
        )}

          </main>
        </div>
      </div>
    </>
  );
}
