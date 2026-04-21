import { useCompareStore } from '../../stores/compareStore';
import { Link } from 'react-router-dom';
import { X, Star, StarHalf } from 'lucide-react';
import { resolveSiteAssetUrl } from '../../contexts/SiteSettingsContext';
import './ComparePage.css';

export default function ComparePage() {
  const { items, removeFromCompare } = useCompareStore();

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

  if (items.length === 0) {
    return (
      <div className="compare-page container">
        <h1 className="page-title">Compare</h1>
        <div className="empty-compare">
          <p>No products added in the compare list. You must add some products to compare them.</p>
          <Link to="/" className="btn-continue">GO TO SHOP</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="compare-page container">
      <h1 className="page-title">Compare</h1>
      
      <div className="compare-table-wrapper">
        <table className="compare-table">
          <tbody>
            {/* Remove Row */}
            <tr className="compare-row remove-row">
              <th className="compare-header"></th>
              {items.map(item => (
                <td key={`remove-${item.id}`} className="compare-item">
                  <button className="remove-btn" onClick={() => removeFromCompare(item.id)}>
                    <X size={14} /> Remove
                  </button>
                </td>
              ))}
            </tr>

            {/* Image Row */}
            <tr className="compare-row image-row">
              <th className="compare-header">Image</th>
              {items.map(item => (
                <td key={`image-${item.id}`} className="compare-item">
                  <Link to={`/product/${item.slug}`} className="compare-image-link">
                    <img src={resolveSiteAssetUrl(item.image)} alt={item.name} className="compare-image" />
                  </Link>
                </td>
              ))}
            </tr>

            {/* Name Row */}
            <tr className="compare-row title-row">
              <th className="compare-header">Name</th>
              {items.map(item => (
                <td key={`name-${item.id}`} className="compare-item">
                  <Link to={`/product/${item.slug}`} className="compare-product-name">
                    {item.name}
                  </Link>
                </td>
              ))}
            </tr>

            {/* SKU Row */}
            <tr className="compare-row sku-row">
              <th className="compare-header">SKU</th>
              {items.map(item => (
                <td key={`sku-${item.id}`} className="compare-item">
                  <span className="compare-sku">{item.sku || 'N/A'}</span>
                </td>
              ))}
            </tr>

            {/* Rating Row */}
            <tr className="compare-row rating-row">
              <th className="compare-header">Rating</th>
              {items.map(item => (
                <td key={`rating-${item.id}`} className="compare-item">
                  <div className="compare-rating">
                    {renderRating(item.rating || 0)}
                  </div>
                </td>
              ))}
            </tr>

            {/* Price Row */}
            <tr className="compare-row price-row">
              <th className="compare-header">Price</th>
              {items.map(item => (
                <td key={`price-${item.id}`} className="compare-item">
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
                </td>
              ))}
            </tr>

            {/* Stock Row */}
            <tr className="compare-row stock-row">
              <th className="compare-header">Stock</th>
              {items.map(item => (
                <td key={`stock-${item.id}`} className="compare-item">
                  {item.stock > 0 ? (
                    <span className="stock-in">{item.stock} in stock</span>
                  ) : (
                    <span className="stock-out">Out of stock</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Action Row */}
            <tr className="compare-row action-row">
              <th className="compare-header"></th>
              {items.map(item => (
                <td key={`action-${item.id}`} className="compare-item">
                  <Link
                    className="add-to-cart-btn"
                    to={`/product/${item.slug}`}
                    aria-disabled={item.stock <= 0}
                    onClick={(event) => {
                      if (item.stock <= 0) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Select Options
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
