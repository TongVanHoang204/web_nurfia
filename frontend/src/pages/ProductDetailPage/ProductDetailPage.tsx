import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Heart, Star, Maximize2, X, ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import api from '../../api/client';
import ProductCard from '../../components/ProductCard/ProductCard';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { useWishlistStore } from '../../stores/wishlistStore';
import { useCompareStore } from '../../stores/compareStore';
import { useUIStore } from '../../stores/uiStore';
import { resolveSiteAssetUrl } from '../../contexts/SiteSettingsContext';
import { sanitizeRichHtml } from '../../utils/sanitizeHtml';
import PageLoader from '../../components/PageLoader/PageLoader';
import './ProductDetailPage.css';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const { addToCompare } = useCompareStore();
  const { addToast } = useUIStore();
  const { addToCart } = useCartStore();
  const [product, setProduct] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  const [canReview, setCanReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product?.images?.length) return;
    setActiveImageIndex((prev) => (prev <= 0 ? product.images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product?.images?.length) return;
    setActiveImageIndex((prev) => (prev >= product.images.length - 1 ? 0 : prev + 1));
  };


  useEffect(() => {
    const fetchProduct = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get(`/products/${slug}`);
        setProduct(data.data);
        
        // Manage Recently Viewed
        try {
          const viewedStr = localStorage.getItem('nurfia_recent_views');
          let viewed = viewedStr ? JSON.parse(viewedStr) : [];
          const existingIdx = viewed.findIndex((p: any) => p.id === data.data.id);
          if (existingIdx !== -1) {
            viewed.splice(existingIdx, 1);
          }
          viewed.unshift(data.data);
          if (viewed.length > 5) viewed = viewed.slice(0, 5);
          localStorage.setItem('nurfia_recent_views', JSON.stringify(viewed));
          setRecentlyViewed(viewed.filter((p: any) => p.id !== data.data.id));
        } catch (e) {
          console.error('Failed to parse recently viewed', e);
        }

        // Fetch related products
        if (data.data.categoryId) {
          const relRes = await api.get(`/products/by-category/${data.data.categoryId}?limit=4`);
          setRelatedProducts(relRes.data.data.filter((p: any) => p.id !== data.data.id));
        }

      } catch (err) {
        console.error('Failed to fetch product:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProduct();
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (!product || !isAuthenticated) return;
    const fetchReviewStatus = async () => {
      try {
        const reviewCheck = await api.get(`/products/${product.id}/reviews/can-review`);
        setCanReview(reviewCheck.data.canReview);
      } catch (e) {
        console.error('Cannot check review status', e);
      }
    };
    fetchReviewStatus();
  }, [product?.id, isAuthenticated]);

  useEffect(() => {
    if (!product) {
      setQuantity(1);
      return;
    }

    const matchAttr = (attribute: any, target: 'color' | 'size') => {
      const name = attribute?.attributeValue?.attribute?.name?.toLowerCase() || '';
      if (target === 'color') return name === 'color' || name.includes('màu');
      if (target === 'size') return name === 'size' || name.includes('kích');
      return false;
    };

    const variants = product.variants || [];
    const allColors = [...new Set<string>(
      variants
        .flatMap((variant: any) => variant.attributes || [])
        .filter((attribute: any) => matchAttr(attribute, 'color'))
        .map((attribute: any) => attribute.attributeValue.value) || []
    )];

    const allSizes = [...new Set<string>(
      variants
        .flatMap((variant: any) => variant.attributes || [])
        .filter((attribute: any) => matchAttr(attribute, 'size'))
        .map((attribute: any) => attribute.attributeValue.value) || []
    )];

    const isSelectionComplete = (!allColors.length || selectedColor) && (!allSizes.length || selectedSize);

    let selectedVariant = null;
    if (isSelectionComplete) {
      selectedVariant = variants.find((variant: any) => {
        const variantColor = variant.attributes.find((attribute: any) => matchAttr(attribute, 'color'))?.attributeValue.value;
        const variantSize = variant.attributes.find((attribute: any) => matchAttr(attribute, 'size'))?.attributeValue.value;
        const colorMatched = !allColors.length || selectedColor === variantColor;
        const sizeMatched = !allSizes.length || selectedSize === variantSize;
        return colorMatched && sizeMatched;
      });
    }

    const inStock = selectedVariant ? selectedVariant.stock > 0 : product.stock > 0;
    const stockCount = selectedVariant ? selectedVariant.stock : product.stock;
    const maxSelectableQuantity = Math.max(1, Number(stockCount) || 0);

    if (!inStock) {
      setQuantity(1);
      return;
    }

    setQuantity((previous) => Math.min(Math.max(1, previous), maxSelectableQuantity));
  }, [product, selectedColor, selectedSize]);

  if (isLoading) return <PageLoader />;
  if (!product) return <PageLoader />; // Or maybe a 404 page

  // Helper function to safely match attributes
  const matchAttr = (a: any, target: 'color' | 'size') => {
    const name = a?.attributeValue?.attribute?.name?.toLowerCase() || '';
    if (target === 'color') return name === 'color' || name.includes('màu');
    if (target === 'size') return name === 'size' || name.includes('kích');
    return false;
  };

  // Extract unique colors and sizes from variants
  const colors = [...new Map<string, string>(
    product.variants?.flatMap((v: any) => v.attributes)
      .filter((a: any) => matchAttr(a, 'color'))
      .map((a: any): [string, string] => [a.attributeValue.value, a.attributeValue.colorHex || '#000']) || []
  ).entries()].map(([name, hex]) => ({ name, hex }));

  const sizes: string[] = [...new Set<string>(
    product.variants?.flatMap((v: any) => v.attributes)
      .filter((a: any) => matchAttr(a, 'size'))
      .map((a: any): string => a.attributeValue.value) || []
  )];

  // 1. Ràng buộc Variants
  const availableVariants = product.variants?.filter((v: any) => v.stock > 0) || [];

  const isColorAvailable = (colorName: string) => {
    if (selectedSize) {
      return availableVariants.some((v: any) => {
        const vColor = v.attributes.find((a: any) => matchAttr(a, 'color'))?.attributeValue.value;
        const vSize = v.attributes.find((a: any) => matchAttr(a, 'size'))?.attributeValue.value;
        return vColor === colorName && vSize === selectedSize;
      });
    }
    return availableVariants.some((v: any) => v.attributes.find((a: any) => matchAttr(a, 'color'))?.attributeValue.value === colorName);
  };

  const isSizeAvailable = (sizeName: string) => {
    if (selectedColor) {
      return availableVariants.some((v: any) => {
        const vColor = v.attributes.find((a: any) => matchAttr(a, 'color'))?.attributeValue.value;
        const vSize = v.attributes.find((a: any) => matchAttr(a, 'size'))?.attributeValue.value;
        return vColor === selectedColor && vSize === sizeName;
      });
    }
    return availableVariants.some((v: any) => v.attributes.find((a: any) => matchAttr(a, 'size'))?.attributeValue.value === sizeName);
  };

  // 2. Exact selected variant for pricing & SKU display
  const isSelectionComplete = (!colors.length || selectedColor) && (!sizes.length || selectedSize);
  
  let selectedVariant = null;
  if (isSelectionComplete) {
    selectedVariant = product.variants?.find((v: any) => {
      const vColor = v.attributes.find((a: any) => matchAttr(a, 'color'))?.attributeValue.value;
      const vSize = v.attributes.find((a: any) => matchAttr(a, 'size'))?.attributeValue.value;
      const matchC = !colors.length || selectedColor === vColor;
      const matchS = !sizes.length || selectedSize === vSize;
      return matchC && matchS;
    });
  }

  const originalPrice = (selectedVariant && Number(selectedVariant.price) > 0) 
    ? Number(selectedVariant.price) 
    : Number(product.price);

  const currentPrice = (selectedVariant && Number(selectedVariant.salePrice) > 0)
    ? Number(selectedVariant.salePrice)
    : (selectedVariant && Number(selectedVariant.price) > 0)
      ? Number(selectedVariant.price)
      : (Number(product.salePrice) > 0 ? Number(product.salePrice) : Number(product.price));

  const hasDiscount = currentPrice < originalPrice;
  const inStock = selectedVariant ? selectedVariant.stock > 0 : product.stock > 0;
  const stockCount = selectedVariant ? selectedVariant.stock : product.stock;
  const normalizedStockCount = Math.max(0, Number(stockCount) || 0);
  const maxSelectableQuantity = normalizedStockCount > 0 ? normalizedStockCount : 1;
  const displaySku = selectedVariant ? selectedVariant.sku : product.sku;
  const sanitizedShortDescription = sanitizeRichHtml(product.shortDescription || '');
  const sanitizedDescription = sanitizeRichHtml(product.description || '<p>No description available.</p>');

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return addToast('Please login to leave a review', 'error');
    if (!reviewForm.comment.trim()) return addToast('Please enter a review comment', 'error');
    
    setIsSubmittingReview(true);
    try {
      await api.post(`/products/${product.id}/reviews`, reviewForm);
      addToast('Review submitted successfully!', 'success');
      
      setCanReview(false);
      setReviewForm({ rating: 5, comment: '' });
      
      // re-fetch the product so the new review is shown
      const { data } = await api.get(`/products/${slug}`);
      setProduct(data.data);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to submit review', 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      addToast('Please login to add items to cart', 'error');
      return;
    }
    if (colors.length > 0 && !selectedColor) {
      addToast('Please select a color', 'error');
      return;
    }
    if (sizes.length > 0 && !selectedSize) {
      addToast('Please select a size', 'error');
      return;
    }

    if (quantity > maxSelectableQuantity) {
      setQuantity(maxSelectableQuantity);
      addToast(`Only ${normalizedStockCount} items available.`, 'error');
      return;
    }

    try {
      await addToCart(product.id, selectedVariant?.id, quantity);
      addToast('Added to cart successfully!', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.message || err.response?.data?.error || 'Failed to add to cart', 'error');
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      addToast('Please login to continue', 'error');
      return;
    }
    if (colors.length > 0 && !selectedColor) {
      addToast('Please select a color', 'error');
      return;
    }
    if (sizes.length > 0 && !selectedSize) {
      addToast('Please select a size', 'error');
      return;
    }
    if (quantity > maxSelectableQuantity) {
      setQuantity(maxSelectableQuantity);
      addToast(`Only ${normalizedStockCount} items available.`, 'error');
      return;
    }
    try {
      await addToCart(product.id, selectedVariant?.id, quantity, true);
      navigate('/checkout');
    } catch (err: any) {
      addToast(err.response?.data?.message || err.response?.data?.error || 'Failed to process', 'error');
    }
  };

  return (
    <div className="product-detail-page">
      <style>{`
        ${colors.map(c => '.bg-color-' + c.name.replace(/\s+/g, '-').toLowerCase() + ' { background-color: ' + c.hex + '; }').join('\n')}
      `}</style>
      <div className="container">
        {/* Breadcrumb */}
        <div className="pd-breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          {product.category && <><Link to={`/category/${product.category.slug}`}>{product.category.name}</Link><span>/</span></>}
          <span>{product.name}</span>
        </div>

        <div className="pd-main">
          {/* Gallery - Shopee format */}
          <div className="pd-gallery">
            <div className="pd-gallery-main">
              <img
                src={resolveSiteAssetUrl(product.images[activeImageIndex]?.url)}
                alt={product.images[activeImageIndex]?.alt || product.name}
                onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/600x600/f5f5f5/999?text=${encodeURIComponent(product.name.substring(0,16))}`; }}
                onClick={() => setIsLightboxOpen(true)}
                style={{ cursor: 'zoom-in' }}
              />
              <button className="pd-gallery-zoom-btn" onClick={() => setIsLightboxOpen(true)} aria-label="Zoom Image">
                <Maximize2 size={20} color="#333" />
              </button>
            </div>
            {/* Mobile Image Scroller (hidden on desktop) */}
            <div className="pd-gallery-mobile">
              <div 
                className="pd-mobile-scroller"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const index = Math.round(target.scrollLeft / target.offsetWidth);
                  if (index !== activeImageIndex) setActiveImageIndex(index);
                }}
              >
                {product.images.map((img: any, i: number) => (
                  <div key={i} className="pd-mobile-slide" id={`mobile-slide-${i}`}>
                    <img
                      src={resolveSiteAssetUrl(img.url)}
                      alt={img.alt || product.name}
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/600x800/f5f5f5/999?text=${encodeURIComponent(product.name.substring(0,16))}`; }}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Thumbnails below for both Desktop and Mobile (styled differently in CSS) */}
            {product.images.length > 1 && (
              <div className="pd-gallery-thumbnails">
                {product.images.map((img: any, i: number) => (
                  <div 
                    key={i} 
                    className={`pd-gallery-thumb ${i === activeImageIndex ? 'active' : ''}`}
                    onMouseEnter={() => setActiveImageIndex(i)}
                    onClick={() => {
                      setActiveImageIndex(i);
                      const scroller = document.querySelector('.pd-mobile-scroller');
                      if (scroller) {
                        scroller.scrollTo({
                          left: i * (scroller as HTMLElement).offsetWidth,
                          behavior: 'smooth'
                        });
                      }
                    }}
                  >
                    <img
                      src={resolveSiteAssetUrl(img.url)}
                      alt={img.alt || product.name}
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/100x100/f5f5f5/999?text=img`; }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="pd-info">
            {product.category && (
              <Link to={`/category/${product.category.slug}`} className="pd-category">{product.category.name}</Link>
            )}
            <h1 className="pd-name">{product.name}</h1>

            {/* Rating and SKU */}
            <div className="pd-rating-sku">
              <div className="pd-rating">
                <div className="stars">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={12} fill={s <= Math.round(Number(product.avgRating)) ? '#ffc107' : '#ddd'} color={s <= Math.round(Number(product.avgRating)) ? '#ffc107' : '#ddd'} />
                  ))}
                </div>
                <span className="review-count">{Number(product.avgRating).toFixed(2)} ({product.reviewCount})</span>
              </div>
              <div className="pd-sku">
                <span>SKU:</span> {displaySku}
              </div>
            </div>

            {/* Price */}
            <div className="pd-price">
              <span className={hasDiscount ? 'sale' : ''}>${Number(currentPrice).toFixed(2)}</span>
              {hasDiscount && <span className="original">${Number(originalPrice).toFixed(2)}</span>}
            </div>

            {/* Description */}
            <div className="pd-short-desc" dangerouslySetInnerHTML={{ __html: sanitizedShortDescription }} />

            {/* Color Selector */}
            {colors.length > 0 && (
              <div className="pd-option">
                <label>Color: <strong>{selectedColor || 'Select'}</strong></label>
                <div className="pd-colors">
                  {colors.map(c => {
                    const cName = c.name.replace(/\s+/g, '-').toLowerCase();
                    const available = isColorAvailable(c.name);
                    return (
                      <button
                        key={c.name}
                        className={`color-swatch ${selectedColor === c.name ? 'active' : ''} ${!available ? 'disabled out-of-stock-style' : ''}`}
                        onClick={() => available && setSelectedColor(selectedColor === c.name ? '' : c.name)}
                        title={`Select color ${c.name}${!available ? ' (Out of Stock)' : ''}`}
                        aria-label={`Select color ${c.name}`}
                        disabled={!available}
                        style={{ opacity: available ? 1 : 0.4, cursor: available ? 'pointer' : 'not-allowed' }}
                      >
                        <div className={`color-swatch-inner bg-color-${cName}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {sizes.length > 0 && (
              <div className="pd-option">
                <label>Size: <strong>{selectedSize || 'Select'}</strong></label>
                <div className="pd-sizes">
                  {sizes.map((s: string) => {
                    const available = isSizeAvailable(s);
                    return (
                      <button
                        key={s}
                        className={`size-btn ${selectedSize === s ? 'active' : ''} ${!available ? 'disabled out-of-stock-style' : ''}`}
                        onClick={() => available && setSelectedSize(selectedSize === s ? '' : s)}
                        disabled={!available}
                        title={`Select size ${s}${!available ? ' (Out of Stock)' : ''}`}
                        style={{ opacity: available ? 1 : 0.4, cursor: available ? 'pointer' : 'not-allowed' }}
                      >{s}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock */}
            <div className="pd-stock">
              {inStock ? <span className="in-stock">✓ {stockCount} in stock</span> : <span className="out-stock">✗ Out of Stock</span>}
            </div>

            {/* Add to Cart */}
            <div className="pd-actions">
              <div className="pd-qty">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                  title="Decrease quantity"
                  disabled={quantity <= 1}
                ><Minus size={16} /></button>
                <span>{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(maxSelectableQuantity, quantity + 1))}
                  aria-label="Increase quantity"
                  title={quantity >= maxSelectableQuantity ? `Maximum available: ${normalizedStockCount}` : 'Increase quantity'}
                  disabled={!inStock || quantity >= maxSelectableQuantity}
                ><Plus size={16} /></button>
              </div>
              <button className="btn btn-primary btn-lg pd-atc" onClick={handleAddToCart} disabled={!inStock || quantity > maxSelectableQuantity}>
                ADD TO CART
              </button>
              <button className="btn btn-outline btn-lg pd-buy-now" onClick={handleBuyNow} disabled={!inStock || quantity > maxSelectableQuantity}>
                BUY NOW
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="pd-secondary-actions">
                <button 
                  className={`pd-text-btn ${product && isInWishlist(product.id) ? 'text-red-500' : ''}`}
                  onClick={() => {
                    if (!isAuthenticated) return addToast('Please login to add to wishlist', 'error');
                    if (product) toggleWishlist(product.id);
                  }}
                >
                  <Heart size={16} fill={product && isInWishlist(product.id) ? 'currentColor' : 'none'} /> 
                  {product && isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                </button>
                <button 
                  className="pd-text-btn"
                  onClick={() => {
                    if (product) {
                      addToCompare({
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        sku: product.sku || '',
                        price: Number(product.price),
                        salePrice: product.salePrice ? Number(product.salePrice) : null,
                        rating: product.avgRating ? Number(product.avgRating) : 0,
                        stock: product.stock,
                        image: product.images?.[0]?.url || ''
                      });
                      addToast('Added to compare', 'success');
                    }
                  }}
                ><Repeat size={16} /> Compare</button>
              </div>

            {/* Shipping Box */}
            <div className="pd-shipping-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shipping-icon"><path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>
              <strong>Shipping within 3 days</strong>
              <span className="shipping-divider">|</span>
              <span className="shipping-note">Speedy and reliable parcel delivery!</span>
            </div>

            {/* Guarantee Box */}
            <div className="pd-guarantee-box">
              <div className="guarantee-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="guarantee-icon"><path d="M1 4h5v4H1zM8 4h5v4H8zM15 4h5v4h-5zM1 10h5v4H1zM8 10h5v4H8zM15 10h5v4h-5z"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M20 16h2a1 1 0 0 0 1-1v-4l-3-4h-4v9M3 16h4M11 16h6"/><circle cx="9" cy="17" r="2" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="18" cy="17" r="2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
                <div className="guarantee-text">Dispatch within <strong>24 Hours</strong>: Your product will be shipped quickly.</div>
              </div>
              <div className="guarantee-row">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="guarantee-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <div className="guarantee-text"><strong>3-Year</strong> Warranty: Nurfia is safe with warranty conditions.</div>
              </div>
            </div>

            {/* Share & Meta */}
            <div className="pd-share-meta">
              <div className="pd-share">
                <span>Share:</span>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" className="share-icon facebook" title="Share on Facebook" aria-label="Share on Facebook"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>
                <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(product?.name || '')}`} target="_blank" rel="noopener noreferrer" className="share-icon twitter" title="Share on Twitter" aria-label="Share on Twitter"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg></a>
                <a href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(window.location.href)}&description=${encodeURIComponent(product?.name || '')}`} target="_blank" rel="noopener noreferrer" className="share-icon pinterest" title="Share on Pinterest" aria-label="Share on Pinterest"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="20" x2="12" y2="11"></line><path d="M10.7 14c.4.9 1.4 1.5 2.5 1.5 3 0 5-2.5 5-5.5S15.6 4 12 4 7 6.5 7 9.5c0 1.2.6 2.6 1.8 3.3"></path></svg></a>
                <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent((product?.name || '') + ' ' + window.location.href)}`} target="_blank" rel="noopener noreferrer" className="share-icon whatsapp" title="Share on WhatsApp" aria-label="Share on WhatsApp"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></a>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - Desktop / Stacked - Mobile */}
        <div className="pd-tabs-container">
          {/* Desktop Tabs Header */}
          <div className="pd-tab-header desktop-only">
            <button className={activeTab === 'description' ? 'active' : ''} onClick={() => setActiveTab('description')}>Description</button>
            <button className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>Additional information</button>
            <button className={activeTab === 'reviews' ? 'active' : ''} onClick={() => setActiveTab('reviews')}>Reviews ({product.reviews?.length || 0})</button>
          </div>

          {/* Tab Content - Desktop */}
          <div className="pd-tab-content desktop-only">
            {activeTab === 'description' && (
              <div className="pd-description" dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />
            )}
            {activeTab === 'info' && (
              <table className="pd-info-table">
                <tbody>
                  {colors.length > 0 && <tr><td>color</td><td>{colors.map(c => c.name).join(', ')}</td></tr>}
                  {sizes.length > 0 && <tr><td>size</td><td>{(sizes as string[]).join(', ')}</td></tr>}
                </tbody>
              </table>
            )}
            {activeTab === 'reviews' && (
              <div className="pd-reviews-wrapper">
                <ReviewSection product={product} canReview={canReview} isSubmittingReview={isSubmittingReview} reviewForm={reviewForm} setReviewForm={setReviewForm} handleReviewSubmit={handleReviewSubmit} />
              </div>
            )}
          </div>

          {/* Mobile Stacked Sections */}
          <div className="pd-mobile-sections mobile-only">
            <div className="pd-mobile-section">
              <h3 className="section-title">Description</h3>
              <div className="pd-description" dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />
            </div>
            <div className="pd-mobile-section">
              <h3 className="section-title">Additional information</h3>
              <table className="pd-info-table">
                <tbody>
                  {colors.length > 0 && <tr><td>color</td><td>{colors.map(c => c.name).join(', ')}</td></tr>}
                  {sizes.length > 0 && <tr><td>size</td><td>{(sizes as string[]).join(', ')}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="pd-mobile-section">
              <h3 className="section-title">Reviews ({product.reviews?.length || 0})</h3>
              <ReviewSection product={product} canReview={canReview} isSubmittingReview={isSubmittingReview} reviewForm={reviewForm} setReviewForm={setReviewForm} handleReviewSubmit={handleReviewSubmit} />
            </div>
          </div>
        </div>
        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="pd-related">
            <h2 className="pd-related-title">Related products</h2>
            <div className="grid grid-4">
              {relatedProducts.slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <div className="pd-recently-viewed" style={{marginTop: '40px'}}>
            <h2 className="pd-related-title">Recently viewed</h2>
            <div className="grid grid-4">
              {recentlyViewed.slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>

      {isLightboxOpen && (
        <div className="pd-lightbox-overlay" onClick={() => setIsLightboxOpen(false)}>
          <button className="pd-lightbox-close" onClick={() => setIsLightboxOpen(false)} aria-label="Close" title="Close">
            <X size={32} />
          </button>
          
          {product.images.length > 1 && (
            <>
              <button className="pd-lightbox-nav-btn prev" onClick={handlePrevImage} aria-label="Previous Image">
                <ChevronLeft size={48} />
              </button>
              <button className="pd-lightbox-nav-btn next" onClick={handleNextImage} aria-label="Next Image">
                <ChevronRight size={48} />
              </button>
            </>
          )}

          <div className="pd-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img 
              src={resolveSiteAssetUrl(product.images[activeImageIndex]?.url)}
              alt={product.images[activeImageIndex]?.alt || product.name} 
              className="pd-lightbox-img"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewSection({ product, canReview, isSubmittingReview, reviewForm, setReviewForm, handleReviewSubmit }: any) {
  return (
    <div className="pd-reviews-wrapper">
      <h3 className="pd-reviews-count-title">{product.reviews?.length || 0} reviews for {product.name}</h3>
      <div className="pd-reviews-summary">
        <div className="pd-reviews-avg">
          <div className="avg-score">{Number(product.avgRating).toFixed(2)}</div>
          <div className="avg-stars">
            <div className="stars">
              {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} fill={s <= Number(product.avgRating) ? '#ffc107' : '#ddd'} color={s <= Number(product.avgRating) ? '#ffc107' : '#ddd'} />)}
            </div>
            <span>Average of {product.reviews?.length || 0} reviews</span>
          </div>
        </div>
        <div className="pd-reviews-bars">
          {[5, 4, 3, 2, 1].map(stars => {
            const count = product.reviews?.filter((r: any) => r.rating === stars).length || 0;
            const total = product.reviews?.length || 1;
            const pct = (count / total) * 100;
            return (
              <div key={stars} className="review-bar-row">
                <span className="star-label"><Star size={12} fill="#ffc107" color="#ffc107" /> {stars}</span>
                <div className="bar-bg"><div className="bar-fill" style={{ width: `${pct}%` }}></div></div>
                <span className="count-label">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pd-reviews-list">
        {product.reviews?.length === 0 && <p className="no-reviews">No reviews yet.</p>}
        {product.reviews?.map((r: any) => (
          <div key={r.id} className="review-item">
            <div className="reviewer-avatar">
              <img src={`https://ui-avatars.com/api/?name=${r.user.fullName || r.user.username}&background=random`} alt="avatar" />
            </div>
            <div className="review-content">
              <div className="stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={12} fill={s <= r.rating ? '#ffc107' : 'none'} color={s <= r.rating ? '#ffc107' : '#ddd'} />
                ))}
              </div>
              <div className="review-meta">
                <strong>{r.user.fullName || r.user.username}</strong> – {new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <p className="review-text">{r.comment}</p>
            </div>
          </div>
        ))}

        {canReview && (
          <div className="review-form-container">
            <h4 className="review-form-title">Add a review</h4>
            <form onSubmit={handleReviewSubmit} className="review-form">
              <div className="review-form-rating">
                <span className="review-form-label">Your rating *</span>
                <div className="review-star-container">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      className="review-star-button"
                      title={`Rate ${star} stars`}
                      key={star}
                      onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                    >
                      <Star size={18} fill={star <= reviewForm.rating ? '#ffc107' : 'none'} color={star <= reviewForm.rating ? '#ffc107' : '#ddd'} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="review-input-group">
                <label htmlFor="comment" className="review-form-label">Your review *</label>
                <textarea
                  id="comment"
                  className="review-textarea"
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  required
                  rows={5}
                  placeholder="What do you think about this product?"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSubmittingReview}
                className={`btn btn-primary review-submit-btn ${isSubmittingReview ? 'disabled' : ''}`}
              >
                {isSubmittingReview ? 'SUBMITTING...' : 'SUBMIT'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
