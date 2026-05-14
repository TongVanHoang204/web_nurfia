import { useCompareStore } from '../../stores/compareStore';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Scale, ShoppingBag, Star, StarHalf, Trash2, X } from 'lucide-react';
import { resolveSiteAssetUrl } from '../../contexts/SiteSettingsContext';
import './ComparePage.css';

export default function ComparePage() {
  const { items, removeFromCompare, clearCompare } = useCompareStore();

  const renderRating = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= rating) {
        stars.push(<Star key={i} size={14} fill="currentColor" className="star-filled" />);
      } else if (i - 0.5 <= rating) {
        stars.push(< StarHalf key={i} size={14} fill="currentColor" className="star-filled" />);
      } else {
        stars.push(<Star key={i} size={14} className="star-empty" />);
      }
    }
    return stars;
  };

  const compareRows = [
    {
      label: 'SKU',
      render: (item: typeof items[number]) => <span className="compare-muted">{item.sku || 'N/A'}</span>,
    },
    {
      label: 'Rating',
      render: (item: typeof items[number]) => (
        <div className="compare-rating" aria-label={`${Number(item.rating || 0).toFixed(1)} out of 5 stars`}>
          {renderRating(item.rating || 0)}
          <span>{Number(item.rating || 0).toFixed(1)}</span>
        </div>
      ),
    },
    {
      label: 'Price',
      render: (item: typeof items[number]) => (
        <div className="compare-price">
          {item.salePrice ? (
            <>
              <span className="old-price">${Number(item.price).toFixed(2)}</span>
              <span className="new-price">${Number(item.salePrice).toFixed(2)}</span>
            </>
          ) : (
            <span className="new-price">${Number(item.price).toFixed(2)}</span>
          )}
        </div>
      ),
    },
    {
      label: 'Stock',
      render: (item: typeof items[number]) => (
        item.stock > 0 ? (
          <span className="compare-stock is-in">{item.stock} in stock</span>
        ) : (
          <span className="compare-stock is-out">Out of stock</span>
        )
      ),
    },
    {
      label: 'Action',
      render: (item: typeof items[number]) => (
        <Link
          className={`compare-select-btn${item.stock <= 0 ? ' is-disabled' : ''}`}
          to={`/product/${item.slug}`}
          aria-disabled={item.stock <= 0}
          onClick={(event) => {
            if (item.stock <= 0) {
              event.preventDefault();
            }
          }}
        >
          Select Options
          <ArrowRight size={14} />
        </Link>
      ),
    },
  ];

  if (items.length === 0) {
    return (
      <div className="compare-page container">
        <div className="compare-empty">
          <div className="compare-empty-icon">
            <Scale size={28} strokeWidth={1.6} />
          </div>
          <h1>Compare Products</h1>
          <p>Add products to compare price, rating, stock, and key details side by side.</p>
          <Link to="/category/all" className="compare-primary-link">
            Start Shopping
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="compare-page container">
      <header className="compare-hero">
        <div>
          <h1>Compare Products</h1>
          <p>{items.length} product{items.length > 1 ? 's' : ''} selected for side-by-side review.</p>
        </div>
        <div className="compare-hero-actions">
          <Link to="/category/all" className="compare-secondary-link">
            <ShoppingBag size={15} />
            Add More
          </Link>
          <button className="compare-clear-btn" type="button" onClick={clearCompare}>
            <Trash2 size={15} />
            Clear All
          </button>
        </div>
      </header>

      <div className="compare-board" style={{ '--compare-columns': items.length } as CSSProperties}>
        <div className="compare-board-scroll">
          <div className="compare-products-row">
            <div className="compare-feature-label">Products</div>
            {items.map(item => (
              <article key={item.id} className="compare-product-card">
                <button className="compare-remove-icon" type="button" aria-label={`Remove ${item.name}`} onClick={() => removeFromCompare(item.id)}>
                  <X size={15} />
                </button>
                <Link to={`/product/${item.slug}`} className="compare-image-link">
                  <img src={resolveSiteAssetUrl(item.image)} alt={item.name} className="compare-image" />
                </Link>
                <Link to={`/product/${item.slug}`} className="compare-product-name">
                  {item.name}
                </Link>
              </article>
            ))}
          </div>

          <div className="compare-spec-list">
            {compareRows.map((row) => (
              <div key={row.label} className="compare-spec-row">
                <div className="compare-feature-label">{row.label}</div>
                {items.map(item => (
                  <div key={`${row.label}-${item.id}`} className="compare-spec-cell">
                    {row.render(item)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
