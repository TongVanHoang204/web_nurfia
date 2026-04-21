import { Link, useNavigate } from 'react-router-dom';
import { Heart, Eye, Star } from 'lucide-react';
import { useWishlistStore } from '../../stores/wishlistStore';
import { useAuthStore } from '../../stores/authStore';
import { resolveSiteAssetUrl } from '../../contexts/SiteSettingsContext';

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    slug: string;
    price: number | string;
    salePrice?: number | string | null;
    avgRating?: number | string;
    reviewCount?: number;
    images: { url: string; alt?: string }[];
    category?: { name: string; slug: string } | null;
    variants?: { attributes: { attributeValue: { value: string; colorHex?: string; attribute: { name: string } } }[] }[];
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const hasDiscount = product.salePrice && product.salePrice < product.price;
  const discountPercent = hasDiscount ? Math.round((1 - Number(product.salePrice) / Number(product.price)) * 100) : 0;

  // Extract unique colors from variants
  const colors = product.variants
    ? [...new Map(
        product.variants
          .flatMap(v => v.attributes)
          .filter(a => a.attributeValue.attribute.name === 'Color')
          .map(a => [a.attributeValue.value, a.attributeValue.colorHex || '#000'])
      ).entries()].map(([name, hex]) => ({ name, hex }))
    : [];

  const mainImage = product.images[0]?.url || '';
  const hoverImage = product.images[1]?.url || mainImage;

  const avgRating = Number(product.avgRating) || 0;
  const reviewCount = product.reviewCount || 0;

  return (
    <div className="product-card">
      <style>{`
        ${colors.map(c => '.bg-color-' + product.id + '-' + c.name.replace(/\s+/g, '-').toLowerCase() + ' { background-color: ' + c.hex + '; }').join('\n')}
      `}</style>
      <div className="product-card-image">
        <Link to={`/product/${product.slug}`}>
          <img
            src={resolveSiteAssetUrl(mainImage)}
            alt={product.images[0]?.alt || product.name}
            className="main-img"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://placehold.co/400x533/f5f5f5/999?text=${encodeURIComponent(product.name.substring(0, 16))}`;
            }}
          />
          <img
            src={resolveSiteAssetUrl(hoverImage)}
            alt={product.name}
            className="hover-img"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://placehold.co/400x533/e8e8e8/999?text=${encodeURIComponent(product.name.substring(0, 16))}`;
            }}
          />
        </Link>

        {/* Badges */}
        <div className="product-card-badges">
          {hasDiscount && <span className="badge badge-sale">{discountPercent}%</span>}
        </div>

        {/* Top Right Actions */}
        <div className="product-card-top-actions">
            <button 
              className={`product-card-icon-btn ${isInWishlist(product.id) ? 'active' : ''}`} 
              title="Add to Wishlist"
              onClick={(e) => {
                e.preventDefault();
                if (!isAuthenticated) return navigate('/login');
                toggleWishlist(product.id);
              }}
            >
              <Heart size={16} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} className={isInWishlist(product.id) ? 'text-red-500' : ''} />
          </button>
          <Link to={`/product/${product.slug}`} className="product-card-icon-btn" title="Quick View">
            <Eye size={16} />
          </Link>
        </div>

        {/* Hover Bottom Strip Action */}
        <div className="product-card-bottom-action">
          <Link to={`/product/${product.slug}`} className="select-options-btn">SELECT OPTIONS</Link>
        </div>
      </div>

      <div className="product-card-info text-left">
        <Link className="no-underline" to={`/product/${product.slug}`}>
          <h3 className="product-card-name" title={product.name}>
            {product.name}
          </h3>
        </Link>
        
        <div className="product-card-price flex-left align-end gap-2 mb-2">
          {hasDiscount ? (
            <>
              <span className="sale text-base font-bold text-black">${Number(product.salePrice).toFixed(2)}</span>
              <span className="original text-sm line-through text-gray-500">${Number(product.price).toFixed(2)}</span>
            </>
          ) : (
            <span className="text-base font-bold text-black">${Number(product.price || 0).toFixed(2)}</span>
          )}
        </div>

        <div className="product-card-rating flex-left align-center gap-2">
          <div className="stars flex gap-xs">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={12}
                fill={s <= avgRating ? '#ffc107' : '#e0e0e0'}
                color={s <= avgRating ? '#ffc107' : '#e0e0e0'}
              />
            ))}
          </div>
          <span className="review-count text-sm text-black font-medium">{avgRating.toFixed(2)} <span className="text-gray-500 font-normal">({reviewCount})</span></span>
        </div>
      </div>
    </div>
  );
}
