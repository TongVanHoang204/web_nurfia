import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import CartDrawer from './components/CartDrawer/CartDrawer';
import ToastContainer from './components/Toast/ToastContainer';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import { useAuthStore } from './stores/authStore';
import { useCartStore } from './stores/cartStore';
import { useCompareStore } from './stores/compareStore';
import { useWishlistStore } from './stores/wishlistStore';
import { connectSocket, disconnectSocket } from './services/socket';
import AIChatbot from './components/AIChatbot';

// Lazy load pages
const HomePage = lazy(() => import('./pages/HomePage/HomePage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage/CategoryPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage/ProductDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage/LoginPage'));
const CartPage = lazy(() => import('./pages/CartPage/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage/CheckoutPage'));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage/OrderConfirmationPage'));
const BlogPage = lazy(() => import('./pages/BlogPage/BlogPage'));
const BlogDetailPage = lazy(() => import('./pages/BlogDetailPage/BlogDetailPage'));
const ContactPage = lazy(() => import('./pages/ContactPage/ContactPage'));
const ComparePage = lazy(() => import('./pages/ComparePage/ComparePage'));
const ShopPage = lazy(() => import('./pages/ShopPage/ShopPage'));
const PolicyPage = lazy(() => import('./pages/PolicyPage/PolicyPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage/NotificationsPage'));

// Admin pages
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminBrands = lazy(() => import('./pages/admin/AdminBrands'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminStaff = lazy(() => import('./pages/admin/AdminStaff'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminBlog = lazy(() => import('./pages/admin/AdminBlog'));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'));
const AdminShipping = lazy(() => import('./pages/admin/AdminShipping'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminActivityLogs = lazy(() => import('./pages/admin/AdminActivityLogs'));
const AdminBanners = lazy(() => import('./pages/admin/AdminBanners'));
const AdminContacts = lazy(() => import('./pages/admin/AdminContacts'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'));
const AdminAttributes = lazy(() => import('./pages/admin/AdminAttributes'));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'));

// Account sub-pages
import AccountPage, { ProfileSection, OrdersSection, WishlistSection, AddressesSection } from './pages/AccountPage/AccountPage';

function PageLoader() {
  return <div className="loading-page"><div className="spinner" /></div>;
}

function StoreLayout() {
  const location = useLocation();
  const { isAuthenticated, mustLogin } = useAuthStore();

  if (mustLogin && !isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Header />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-confirmation/:id" element={<OrderConfirmationPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/policy/:policyType" element={<PolicyPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/account" element={<AccountPage />}>
              <Route index element={<ProfileSection />} />
              <Route path="orders" element={<OrdersSection />} />
              <Route path="wishlist" element={<WishlistSection />} />
              <Route path="addresses" element={<AddressesSection />} />
            </Route>
            <Route path="*" element={
              <div className="loading-page not-found">
                <h2>404</h2>
                <p>Page not found</p>
              </div>
            } />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <AIChatbot />
    </>
  );
}

export default function App() {
  const { loadUser, isAuthenticated, user } = useAuthStore();
  const { fetchCart } = useCartStore();
  const { fetchCompare, resetCompare } = useCompareStore();
  const { fetchWishlist, clearWishlistLocally } = useWishlistStore();

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { 
    if (isAuthenticated) {
      fetchCart(); 
      fetchWishlist();
      fetchCompare();
    } else {
      clearWishlistLocally();
      resetCompare();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();
    if (!socket) return;

    const handleAccountStatusChanged = (payload: { customerId?: number; isActive?: boolean }) => {
      if (!user?.id || payload.customerId !== user.id) return;
      if (payload.isActive !== false) return;

      window.dispatchEvent(new CustomEvent('auth:unauthorized', {
        detail: { reason: 'deactivated' },
      }));
    };

    socket.on('account-status-changed', handleAccountStatusChanged);

    return () => {
      socket.off('account-status-changed', handleAccountStatusChanged);
    };
  }, [isAuthenticated, user?.id]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Admin routes — separate layout, no header/footer */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
              <Route path="banners" element={<AdminBanners />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="brands" element={<AdminBrands />} />
              <Route path="attributes" element={<AdminAttributes />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="staffs" element={<AdminStaff />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="contacts" element={<AdminContacts />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="shipping" element={<AdminShipping />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="activity-logs" element={<AdminActivityLogs />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          {/* Store routes — with header/footer */}
          <Route path="/*" element={<StoreLayout />} />
        </Routes>
      </Suspense>
      <ToastContainer />
      <ConfirmModal />
    </BrowserRouter>
  );
}
