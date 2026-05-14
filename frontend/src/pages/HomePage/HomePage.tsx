import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import api from '../../api/client';
import ProductCard from '../../components/ProductCard/ProductCard';
import { resolveSiteAssetUrl } from '../../contexts/SiteSettingsContext';
import { getImageUrl } from '../../utils/url';
import PageLoader from '../../components/PageLoader/PageLoader';
import './HomePage.css';

interface Product {
  id: number; name: string; slug: string; price: number; salePrice: number | null;
  images: { url: string; alt: string }[]; category: { name: string; slug: string } | null;
  variants?: any[];
}

interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  videoUrl: string | null;
  linkUrl: string | null;
  buttonText: string | null;
  position: string;
}

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  image: string | null;
  author: string;
  category: string | null;
  publishedAt: string;
}

interface HomePopup {
  id: number;
  popupType?: 'OFFER' | 'NOTICE';
  title: string;
  subtitle: string | null;
  message: string | null;
  imageUrl: string | null;
  offerCode: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  displayDelayMs: number;
  showOnceSession: boolean;
}

const formatBlogDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const HOME_PROMO_POPUP_KEY = 'nurfia_home_promo_popup_seen';

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [womenProducts, setWomenProducts] = useState<Product[]>([]);
  const [menProducts, setMenProducts] = useState<Product[]>([]);
  const [dressesProducts, setDressesProducts] = useState<Product[]>([]);
  const [tshirtsProducts, setTshirtsProducts] = useState<Product[]>([]);
  const [homeBlogs, setHomeBlogs] = useState<BlogPost[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [activeTab1, setActiveTab1] = useState<'women' | 'dresses' | 'men' | 'tshirts'>('women');
  const [activeTab2, setActiveTab2] = useState<'featured' | 'new' | 'bestsellers'>('new');
  const [isLoading, setIsLoading] = useState(true);
  const [homePopups, setHomePopups] = useState<HomePopup[]>([]);
  const [activePopupIndex, setActivePopupIndex] = useState(0);
  const [activePopup, setActivePopup] = useState<HomePopup | null>(null);
  const [showPromoPopup, setShowPromoPopup] = useState(false);
  const [promoImageFailed, setPromoImageFailed] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bannersRes, featuredRes, newRes, bestRes, womenRes, menRes, dressesRes, tshirtsRes] = await Promise.all([
          api.get('/banners?position=homepage'),
          api.get('/products/featured'),
          api.get('/products/new'),
          api.get('/products/bestsellers'),
          api.get('/products', { params: { category: 'women', limit: 8 } }),
          api.get('/products', { params: { category: 'men', limit: 8 } }),
          api.get('/products', { params: { category: 'dresses', limit: 8 } }),
          api.get('/products', { params: { category: 't-shirts', limit: 8 } }),
        ]);
        setBanners(bannersRes.data.data);
        setFeaturedProducts(featuredRes.data.data);
        setNewProducts(newRes.data.data);
        setBestSellers(bestRes.data.data);
        setWomenProducts(womenRes.data.data);
        setMenProducts(menRes.data.data);
        setDressesProducts(dressesRes.data.data);
        setTshirtsProducts(tshirtsRes.data.data);

        try {
          const blogRes = await api.get('/blog', { params: { page: 1, limit: 4 } });
          setHomeBlogs(Array.isArray(blogRes.data?.data) ? blogRes.data.data : []);
        } catch (blogError) {
          console.error('Failed to fetch homepage blogs:', blogError);
          setHomeBlogs([]);
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    // Load recently viewed
    (async () => {
      try {
        const stored = localStorage.getItem('nurfia_recent_views');
        const ids: number[] = stored ? JSON.parse(stored) : [];
        if (ids.length > 0) {
          const { data } = await api.post('/products/by-ids', { ids });
          setRecentlyViewed(data.data || []);
        }
      } catch (e) {
        console.error('Failed to load recently viewed:', e);
      }
    })();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timer: number | undefined;

    const fetchHomePopup = async () => {
      try {
        const { data } = await api.get('/popups/homepage');
        const payload = data.data as HomePopup[] | HomePopup | null;
        const popups = (Array.isArray(payload) ? payload : payload ? [payload] : [])
          .filter((popup) => !(popup.showOnceSession && sessionStorage.getItem(`${HOME_PROMO_POPUP_KEY}_${popup.id}`) === 'true'));
        const popup = popups[0];
        if (!isMounted || !popup) return;

        setHomePopups(popups);
        setActivePopupIndex(0);
        setActivePopup(popup);
        setPromoImageFailed(false);

        timer = window.setTimeout(() => {
          if (isMounted) setShowPromoPopup(true);
        }, Math.max(0, Number(popup.displayDelayMs) || 0));
      } catch (error) {
        console.error('Failed to fetch homepage popup:', error);
      }
    };

    fetchHomePopup();

    return () => {
      isMounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const closePromoPopup = () => {
    if (activePopup?.showOnceSession) {
      sessionStorage.setItem(`${HOME_PROMO_POPUP_KEY}_${activePopup.id}`, 'true');
    }
    const nextPopupIndex = activePopupIndex + 1;
    const nextPopup = homePopups[nextPopupIndex] || null;

    if (nextPopup) {
      setShowPromoPopup(false);
      setActivePopupIndex(nextPopupIndex);
      setActivePopup(nextPopup);
      setPromoImageFailed(false);
      window.setTimeout(() => setShowPromoPopup(true), 160);
      return;
    }

    setShowPromoPopup(false);
  };

  const getProductsForTab1 = (tab: 'women' | 'dresses' | 'men' | 'tshirts') => {
    switch (tab) {
      case 'women': return womenProducts;
      case 'dresses': return dressesProducts;
      case 'men': return menProducts;
      case 'tshirts': return tshirtsProducts;
      default: return womenProducts;
    }
  };

  const getProductsForTab2 = (tab: 'featured' | 'new' | 'bestsellers') => {
    switch (tab) {
      case 'featured': return featuredProducts;
      case 'new': return newProducts;
      case 'bestsellers': return bestSellers;
      default: return newProducts;
    }
  };

  const activePopupType = activePopup?.popupType === 'NOTICE' || (!activePopup?.offerCode && !activePopup?.imageUrl) ? 'NOTICE' : 'OFFER';
  const shouldShowPopupImage = Boolean(activePopup?.imageUrl) && !promoImageFailed;

  return (
    <div className="homepage">
      {showPromoPopup && activePopup && (
        <div className="home-promo-popup" role="dialog" aria-modal="true" aria-labelledby="home-promo-title">
          <button className="home-promo-backdrop" type="button" aria-label="Close promotion popup" onClick={closePromoPopup} />
          <div className={`home-promo-panel ${activePopupType === 'NOTICE' ? 'home-promo-panel-notice' : ''} ${shouldShowPopupImage ? '' : 'home-promo-panel-text-only'}`}>
            <button className="home-promo-close" type="button" aria-label="Close promotion popup" onClick={closePromoPopup}>
              <X size={18} strokeWidth={1.8} />
            </button>
            {shouldShowPopupImage && (
              <div className="home-promo-image">
                <img
                  src={resolveSiteAssetUrl(activePopup.imageUrl || '')}
                  alt={activePopup.title}
                  onError={() => setPromoImageFailed(true)}
                />
              </div>
            )}
            <div className="home-promo-content">
              {activePopup.subtitle && <span className="home-promo-kicker">{activePopup.subtitle}</span>}
              <h2 id="home-promo-title" className="home-promo-title">{activePopup.title}</h2>
              {activePopup.message && <p className="home-promo-text">{activePopup.message}</p>}
              {activePopupType === 'OFFER' && activePopup.offerCode && (
                <div className="home-promo-code" aria-label="Promotion code">
                  <span>Use code</span>
                  <strong>{activePopup.offerCode}</strong>
                </div>
              )}
              {activePopup.linkUrl && (
                <Link to={activePopup.linkUrl} className="btn btn-primary home-promo-cta" onClick={closePromoPopup}>
                  {activePopup.buttonText || 'Shop now'}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ═══ 1. Hero Slider ═══════════════════════════════════════════════════ */}
      <section className="hero-section">
        <Swiper
          modules={[Autoplay, Pagination, Navigation]}
          slidesPerView={1}
          spaceBetween={0}
          autoplay={{ delay: 6000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          navigation={true}
          loop={banners.length > 1}
          speed={800}
          className="hero-swiper"
        >
          {banners.length > 0 ? (
            banners.map((banner, index) => (
              <SwiperSlide key={banner.id}>
                <div className={`hero-slide hero-slide-${index + 1}`} style={{ backgroundImage: `url(${getImageUrl(banner.imageUrl)})` }}>
                  {banner.videoUrl && (
                    <video className="hero-video" autoPlay muted loop playsInline poster={getImageUrl(banner.imageUrl)}>
                      <source src={getImageUrl(banner.videoUrl)} type="video/mp4" />
                    </video>
                  )}
                  <div className="hero-overlay" />
                  <div className="hero-content">
                    <h2 className="hero-title animate-fadeIn">{banner.title}</h2>
                    <div className="hero-slider-logo animate-fadeIn">
                      <img src="/assets/images/slider-logo.png" alt="Nurfia" />
                    </div>
                    {banner.subtitle && (
                      <p className="hero-excerpt animate-fadeIn">{banner.subtitle}</p>
                    )}
                    {(banner.linkUrl || banner.buttonText) && (
                      <Link to={banner.linkUrl || "/category/all"} className="btn btn-white btn-lg animate-fadeIn">
                        {banner.buttonText || "Shop Now"}
                      </Link>
                    )}
                  </div>
                </div>
              </SwiperSlide>
            ))
          ) : (
            <SwiperSlide>
              <div className="hero-slide hero-slide-1">
                <video className="hero-video" autoPlay muted loop playsInline poster="/assets/images/slider-01.webp">
                  <source src="https://klbtheme.com/nurfia/wp-content/uploads/2025/07/slider-video-01.mp4" type="video/mp4" />
                </video>
                <div className="hero-overlay" />
                <div className="hero-content">
                  <h2 className="hero-title animate-fadeIn">The Looks You'll Love</h2>
                  <div className="hero-slider-logo animate-fadeIn">
                    <img src="/assets/images/slider-logo.png" alt="Nurfia" />
                  </div>
                  <p className="hero-excerpt animate-fadeIn">
                    Style that feels personal. Thoughtful design, refined materials, and looks made to last. Clean lines crafted for everyday sophistication.
                  </p>
                  <Link to="/category/all" className="btn btn-white btn-lg animate-fadeIn">View Collection</Link>
                </div>
              </div>
            </SwiperSlide>
          )}
        </Swiper>
      </section>

      {/* ═══ 2. Marquee ═══════════════════════════════════════════════════════ */}
      <section className="marquee-section">
        <div className="marquee-track">
          <div className="marquee-content">
            {Array(8).fill(null).map((_, i) => (
              <span key={i} className="marquee-text">CHOOSE YOUR<span className="marquee-dot">•</span>SUMMER STYLE</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. Redefine Your Wardrobe — Product Carousel ═════════════════════ */}
      <section className="products-section py-section">
        <div className="container">
          <div className="products-section-header">
            <h2 className="section-title section-title-left">Redefine Your Wardrobe</h2>
            <div className="product-tabs">
              <button className={`tab-btn ${activeTab1 === 'women' ? 'active' : ''}`} onClick={() => setActiveTab1('women')}>Women</button>
              <button className={`tab-btn ${activeTab1 === 'dresses' ? 'active' : ''}`} onClick={() => setActiveTab1('dresses')}>Dresses</button>
              <button className={`tab-btn ${activeTab1 === 'men' ? 'active' : ''}`} onClick={() => setActiveTab1('men')}>Men</button>
              <button className={`tab-btn ${activeTab1 === 'tshirts' ? 'active' : ''}`} onClick={() => setActiveTab1('tshirts')}>T-shirts</button>
            </div>
          </div>
          {isLoading ? (
            <PageLoader fullScreen={false} />
          ) : (
            <Swiper
              modules={[Navigation, Autoplay]}
              spaceBetween={20}
              slidesPerView={4}
              navigation
              breakpoints={{
                0: { slidesPerView: 1.2, spaceBetween: 10 },
                640: { slidesPerView: 2, spaceBetween: 10 },
                768: { slidesPerView: 3, spaceBetween: 16 },
                1024: { slidesPerView: 4, spaceBetween: 20 },
              }}
              className="products-swiper"
            >
              {getProductsForTab1(activeTab1).slice(0, 8).map(product => (
                <SwiperSlide key={product.id}>
                  <ProductCard product={product} />
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </div>
      </section>

      {/* ═══ 4. Category Banners (WOMEN + MEN) ════════════════════════════════ */}
      <section className="category-banners">
        <div className="banner-grid-full">
          <Link to="/category/women" className="banner-card-full banner-women">
            <div className="banner-overlay-gradient" />
            <div className="banner-card-content">
              <h2 className="banner-card-title">WOMEN</h2>
              <p className="banner-card-excerpt">Soft strength, refined details, and a confident silhouette shaped for contemporary style.</p>
            </div>
          </Link>
          <Link to="/category/men" className="banner-card-full banner-men">
            <div className="banner-overlay-gradient" />
            <div className="banner-card-content">
              <h2 className="banner-card-title">MEN</h2>
              <p className="banner-card-excerpt">Clean structure, modern attitude, and effortless pieces designed for everyday confidence.</p>
            </div>
          </Link>
        </div>
      </section>

      {/* ═══ 5. Elevate Text Section ══════════════════════════════════════════ */}
      <section className="elevate-section py-section">
        <div className="container">
          <div className="elevate-text">
            <h2 className="elevate-title">
              Elevate your {' '}
              <span className="elevate-hover-wrapper">
                <em className="elevate-italic">style</em>
                <img src="/assets/images/image-01.webp" alt="style" className="elevate-hover-img" />
              </span>
              <br />
              with {' '}
              <span className="elevate-hover-wrapper">
                <em className="elevate-italic">timeless</em>
                <img src="/assets/images/image-02.webp" alt="timeless" className="elevate-hover-img" />
              </span>
              {' '}elegance
              <br />
              in the new {' '}
              <span className="elevate-hover-wrapper">
                <em className="elevate-italic">collection</em>
                <img src="/assets/images/banner-01.webp" alt="collection" className="elevate-hover-img" />
              </span>
            </h2>
          </div>
        </div>
      </section>

      {/* ═══ 6. Full-Width Promo Banner ═══════════════════════════════════════ */}
      <section className="promo-banner">
        <div className="promo-overlay" />
        <div className="promo-content">
          <h2 className="promo-title">The Looks You'll Love</h2>
          <p className="promo-excerpt">Style that feels personal. Thoughtful design, refined materials, and looks made to last.</p>
        </div>
        <Link to="/category/all" className="promo-wrap-link" aria-label="Shop the look" />
      </section>

      {/* ═══ 7. Featured Products Carousel ════════════════════════════════════ */}
      <section className="products-section py-section">
        <div className="container">
          <div className="products-section-header">
            <h2 className="section-title section-title-left">Featured Products</h2>
            <div className="product-tabs">
              <button className={`tab-btn ${activeTab2 === 'new' ? 'active' : ''}`} onClick={() => setActiveTab2('new')}>New Arrival</button>
              <button className={`tab-btn ${activeTab2 === 'featured' ? 'active' : ''}`} onClick={() => setActiveTab2('featured')}>Featured</button>
              <button className={`tab-btn ${activeTab2 === 'bestsellers' ? 'active' : ''}`} onClick={() => setActiveTab2('bestsellers')}>Bestsellers</button>
            </div>
          </div>
          {isLoading ? (
            <PageLoader fullScreen={false} />
          ) : (
            <Swiper
              modules={[Navigation, Autoplay]}
              spaceBetween={20}
              slidesPerView={4}
              navigation
              breakpoints={{
                0: { slidesPerView: 2, spaceBetween: 10 },
                640: { slidesPerView: 2, spaceBetween: 10 },
                768: { slidesPerView: 3, spaceBetween: 16 },
                1024: { slidesPerView: 4, spaceBetween: 20 },
              }}
              className="products-swiper"
            >
              {getProductsForTab2(activeTab2).slice(0, 8).map(product => (
                <SwiperSlide key={product.id}>
                  <ProductCard product={product} />
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </div>
      </section>

      {/* ═══ 8. Testimonial ═══════════════════════════════════════════════════ */}
      <section className="testimonial-section">
        <div className="container">
          <Swiper
            modules={[Autoplay, Navigation]}
            autoplay={{ delay: 4000, disableOnInteraction: false }}
            navigation
            loop
            className="testimonial-swiper"
          >
            <SwiperSlide>
              <div className="testimonial-inner">
                <p className="testimonial-text">
                  We focus on well-designed, quality clothing that fits your lifestyle. Thoughtfully made for comfort, versatility, and everyday wear.
                </p>
              </div>
            </SwiperSlide>
            <SwiperSlide>
              <div className="testimonial-inner">
                <p className="testimonial-text">
                  Fashion is not just about clothes. It's about feeling confident, expressing yourself, and embracing the beauty of who you are.
                </p>
              </div>
            </SwiperSlide>
          </Swiper>
        </div>
      </section>

      {/* ═══ 9. Sustainability Section ════════════════════════════════════════ */}
      <section className="sustainability-section py-section">
        <div className="container">
          <div className="sustainability-grid">
            <div className="sustainability-content">
              <h2 className="sustainability-title">FASHION<br />THAT<br />LOVES THE<br />EARTH</h2>
              <p className="sustainability-text">
                Designed responsibly for everyday life. Clean silhouettes, natural materials, and style that lasts beyond seasons.
              </p>
              <Link to="/category/all" className="btn btn-primary btn-lg">DISCOVER NOW</Link>
            </div>
            <div className="sustainability-image sustainability-image-1">
              <img src="/assets/images/image-01.webp" alt="Sustainable fashion" />
            </div>
            <div className="sustainability-image sustainability-image-2">
              <img src="/assets/images/image-02.webp" alt="Sustainable materials" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 10. Second Marquee ═══════════════════════════════════════════════ */}
      <section className="marquee-section">
        <div className="marquee-track">
          <div className="marquee-content">
            {Array(8).fill(null).map((_, i) => (
              <span key={i} className="marquee-text">CHOOSE YOUR<span className="marquee-dot">•</span>SUMMER STYLE</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 11. Blog Posts ═══════════════════════════════════════════════════ */}
      <section className="blog-section py-section">
        <div className="container">
          <div className="blog-grid">
            {homeBlogs.length > 0 ? (
              homeBlogs.map((post) => {
                const imageUrl = resolveSiteAssetUrl(post.image || '') || '/assets/images/blog-01.webp';
                const author = String(post.author || '').trim() || 'Nurfia';
                const category = String(post.category || '').trim() || 'General';
                const publishedDate = formatBlogDate(post.publishedAt);

                return (
                  <article key={post.id} className="blog-card">
                    <Link to={`/blog/${post.slug}`} className="blog-card-image">
                      <img src={imageUrl} alt={post.title} />
                    </Link>
                    <div className="blog-card-content">
                      <span className="blog-card-category">{category}</span>
                      <h3 className="blog-card-title">
                        <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                      </h3>
                      <div className="blog-card-meta">
                        <span>by {author}</span>
                        {publishedDate && <span>{publishedDate}</span>}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="blog-empty-state">
                <p>No published blog posts yet.</p>
                <Link to="/blog" className="btn btn-outline btn-sm">View Blog</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ⭐️ 12. Recently Viewed ⭐️ */}
      {recentlyViewed.length > 0 && (
        <section className="products-section py-section">
          <div className="container">
            <div className="products-section-header">
              <h2 className="section-title section-title-left">Recently viewed</h2>
            </div>
            <Swiper
              modules={[Navigation, Autoplay]}
              spaceBetween={20}
              slidesPerView={4}
              navigation
              breakpoints={{
                0: { slidesPerView: 1.2, spaceBetween: 10 },
                640: { slidesPerView: 2, spaceBetween: 10 },
                768: { slidesPerView: 3, spaceBetween: 16 },
                1024: { slidesPerView: 4, spaceBetween: 20 },
              }}
              className="products-swiper"
            >
              {recentlyViewed.slice(0, 8).map(product => (
                <SwiperSlide key={product.id}>
                  <ProductCard product={product} />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </section>
      )}
    </div>
  );
}
