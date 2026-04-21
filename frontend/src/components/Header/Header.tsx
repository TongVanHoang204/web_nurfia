import './Header.css';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Heart, User, ShoppingBag, Menu, X, ChevronDown, ArrowRightLeft } from 'lucide-react';
import { useCartStore } from '../../stores/cartStore';
import { useCompareStore } from '../../stores/compareStore';
import { useWishlistStore } from '../../stores/wishlistStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { resolveSiteAssetUrl, useSiteSettings } from '../../contexts/SiteSettingsContext';
import { useState, useEffect, useRef } from 'react';

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  {
    label: 'Women', href: '/category/women', mega: true,
    children: [
      { group: 'Clothing', items: [
        { label: 'Dresses', href: '/category/dresses' },
        { label: 'Blazers', href: '/category/blazers' },
        { label: 'Blouses', href: '/category/blouses' },
        { label: 'Tops', href: '/category/tops' },
        { label: 'T-Shirts', href: '/category/women-tshirts' },
        { label: 'Jackets', href: '/category/women-jackets' },
      ]},
      { group: 'Bottom Wear', items: [
        { label: 'Pants', href: '/category/women-pants' },
        { label: 'Skirts', href: '/category/skirts' },
        { label: 'Jeans', href: '/category/women-jeans' },
      ]},
      { group: 'Knitwear & Suits', items: [
        { label: 'Knit', href: '/category/knit' },
        { label: 'Suits', href: '/category/suits' },
      ]},
    ],
  },
  {
    label: 'Men', href: '/category/men', mega: true,
    children: [
      { group: 'Clothing', items: [
        { label: 'Jackets', href: '/category/men-jackets' },
        { label: 'T-Shirts', href: '/category/men-tshirts' },
        { label: 'Hoodies', href: '/category/hoodies' },
      ]},
      { group: 'Bottom Wear', items: [
        { label: 'Jeans', href: '/category/men-jeans' },
        { label: 'Pants', href: '/category/men-pants' },
      ]},
    ],
  },
  {
    label: 'Accessories', href: '/category/accessories', mega: true,
    children: [
      { group: 'Bags', items: [
        { label: 'Bags', href: '/category/bags' },
      ]},
      { group: 'Jewelry', items: [
        { label: 'Jewelry', href: '/category/jewelry' },
      ]},
      { group: 'Hats', items: [
        { label: 'Hats', href: '/category/hats' },
      ]},
    ],
  },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { openCart } = useCartStore();
  const cartItems = useCartStore((state) => state.items);
  const compareItems = useCompareStore((state) => state.items);
  const wishlistItems = useWishlistStore((state) => state.items);
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu, isSearchOpen, toggleSearch, closeSearch } = useUIStore();
  const { isAuthenticated } = useAuthStore();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);

  const isHome = location.pathname === '/';
  const siteName = settings.siteName || 'Nurfia';
  const logoDark = resolveSiteAssetUrl(settings.logoUrl || '') || '/assets/images/logo-dark.png';
  const logoLight = resolveSiteAssetUrl(settings.logoLightUrl || settings.logoUrl || '') || '/assets/images/logo-light.png';
  const contactEmail = settings.email || 'contact@nurfia.com';
  const contactPhone = settings.phone || '+1 234 567 890';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchRef.current) searchRef.current.focus();
  }, [isSearchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/category/all?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      closeSearch();
    }
  };

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div className="container topbar-inner">
          <div className="topbar-left">
            <span>Free shipping on orders over $500</span>
          </div>
          <div className="topbar-right">
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            <span className="topbar-divider">|</span>
            <a href={`tel:${contactPhone.replace(/\s+/g, '')}`}>{contactPhone}</a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className={`site-header ${isScrolled ? 'scrolled' : ''} ${isHome ? 'is-transparent' : ''}`}>
        <div className="container header-inner">
          {/* Mobile menu toggle */}
          <button className="mobile-menu-toggle" onClick={toggleMobileMenu} aria-label="Toggle menu">
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Logo */}
          <Link to="/" className="header-logo" onClick={closeMobileMenu}>
            <img src={logoDark} alt={siteName} className="logo-img dark-logo" />
            <img src={logoLight} alt={siteName} className="logo-img light-logo" />
          </Link>

          {/* Desktop Nav */}
          <nav className="header-nav">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                className={`nav-item ${item.mega ? 'has-mega' : ''}`}
                onMouseEnter={() => item.mega && setActiveMenu(item.label)}
                onMouseLeave={() => setActiveMenu(null)}
              >
                <Link to={item.href} className="nav-link">
                  {item.label}
                  {item.mega && <ChevronDown size={12} className="nav-arrow" />}
                </Link>
                {item.mega && item.children && activeMenu === item.label && (
                  <div className="mega-menu">
                    <div className="mega-menu-inner">
                      {item.children.map((group) => (
                        <div key={group.group} className="mega-menu-col">
                          <h4 className="mega-menu-title">{group.group}</h4>
                          <ul>
                            {group.items.map((sub) => (
                              <li key={sub.href}>
                                <Link to={sub.href} onClick={() => setActiveMenu(null)}>{sub.label}</Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <div className="mega-menu-banner">
                        <img
                          src={item.label === 'Women' ? '/assets/images/mega-menu-banner-01.webp' : '/assets/images/mega-menu-banner-02.webp'}
                          alt={`${item.label} collection`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Actions */}
          <div className="header-actions">
            <button className="action-btn" onClick={toggleSearch} aria-label="Search">
              <Search size={18} />
            </button>
            <Link to={isAuthenticated ? '/account' : '/login'} className="action-btn" aria-label="Account">
              <User size={18} />
            </Link>
            <Link to={isAuthenticated ? '/account/wishlist' : '/login'} className="action-btn wishlist-btn" aria-label="Wishlist">
              <Heart size={18} />
              {wishlistItems.length > 0 && <span className="cart-count">{wishlistItems.length}</span>}
            </Link>
            <Link to="/compare" className="action-btn compare-btn" aria-label="Compare">
              <ArrowRightLeft size={18} />
              {compareItems.length > 0 && <span className="cart-count">{compareItems.length}</span>}
            </Link>
            <button className="action-btn cart-btn" onClick={openCart} aria-label="Cart">
              <ShoppingBag size={18} />
              <span className="cart-count">{cartItems.length}</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className={`search-bar ${isSearchOpen ? 'active' : ''}`}>
          <div className="container">
            <form onSubmit={handleSearch} className="search-form">
              <Search size={18} className="search-icon" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search for products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="button" className="search-close" onClick={closeSearch} title="Close search" aria-label="Close search"><X size={18} /></button>
            </form>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${isMobileMenuOpen ? 'active' : ''}`}>
        <nav className="mobile-nav">
          {NAV_ITEMS.map((item) => (
            <div key={item.label} className="mobile-nav-item">
              <Link to={item.href} className="mobile-nav-link" onClick={closeMobileMenu}>
                {item.label}
              </Link>
              {item.children && (
                <div className="mobile-submenu">
                  {item.children.map((group) =>
                    group.items.map((sub) => (
                      <Link key={sub.href} to={sub.href} className="mobile-sub-link" onClick={closeMobileMenu}>
                        {sub.label}
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Overlay */}
      {isMobileMenuOpen && <div className="overlay mobile-overlay active" onClick={closeMobileMenu} />}
    </>
  );
}
