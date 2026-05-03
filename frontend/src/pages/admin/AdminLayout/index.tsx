import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, FolderTree, ShoppingCart, Users, Ticket, Truck, Settings, LogOut, Menu, X, FileText, Activity, ShieldQuestion, BarChart, Layers, Image as ImageIcon, Mail, Star, Tag, Sliders, Bell, Globe } from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import NotificationBell from '../../../components/Notifications/NotificationBell';
import PageLoader from '../../../components/PageLoader/PageLoader';
import './AdminLayout.css';
import '../admin.css';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/admin', permissions: [] as string[] },
  { label: 'Banners', icon: ImageIcon, path: '/admin/banners', permissions: ['MANAGE_BANNERS'] },
  { label: 'Products', icon: Package, path: '/admin/products', permissions: ['MANAGE_PRODUCTS'] },
  { label: 'Inventory', icon: Layers, path: '/admin/inventory', permissions: ['MANAGE_INVENTORY'] },
  { label: 'Categories', icon: FolderTree, path: '/admin/categories', permissions: ['MANAGE_CATEGORIES'] },
  { label: 'Brands', icon: Tag, path: '/admin/brands', permissions: ['MANAGE_PRODUCTS'] },
  { label: 'Attributes', icon: Sliders, path: '/admin/attributes', permissions: ['MANAGE_PRODUCTS'] },
  { label: 'Orders', icon: ShoppingCart, path: '/admin/orders', permissions: ['MANAGE_ORDERS'] },
  { label: 'Customers', icon: Users, path: '/admin/customers', permissions: ['MANAGE_CUSTOMERS'] },
  { label: 'Reviews', icon: Star, path: '/admin/reviews', permissions: ['MANAGE_REVIEWS'] },
  { label: 'Staff Management', icon: ShieldQuestion, path: '/admin/staffs', permissions: ['MANAGE_STAFF'] },
  { label: 'Reports & Charts', icon: BarChart, path: '/admin/reports', permissions: ['VIEW_REPORTS'] },
  { label: 'Coupons', icon: Ticket, path: '/admin/coupons', permissions: ['MANAGE_COUPONS'] },
  { label: 'Shipping', icon: Truck, path: '/admin/shipping', permissions: ['MANAGE_SHIPPING'] },
  { label: 'Blog Posts', icon: FileText, path: '/admin/blog', permissions: ['MANAGE_BLOG'] },
  { label: 'Contacts', icon: Mail, path: '/admin/contacts', permissions: ['MANAGE_CONTACTS'] },
  { label: 'Notifications', icon: Bell, path: '/admin/notifications', permissions: [] as string[] },
  { label: 'Activity Logs', icon: Activity, path: '/admin/activity-logs', permissions: ['VIEW_ACTIVITY_LOGS'] },
  { label: 'Settings', icon: Settings, path: '/admin/settings', permissions: ['MANAGE_SETTINGS'] },
];

const canAccessItem = (user: { role?: string; permissions?: string[] } | null, permissions: string[]) => {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'STAFF' && user.role !== 'MANAGER') return false;
  if (permissions.length === 0) return true;

  const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.some((permission) => userPermissions.includes(permission));
};

export default function AdminLayout() {
  const { user, isAuthenticated, isHydrating, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const accessibleItems = NAV_ITEMS.filter((item) => canAccessItem(user, item.permissions));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const syncSidebarState = () => {
      setSidebarOpen(!mediaQuery.matches);
    };

    syncSidebarState();
    mediaQuery.addEventListener('change', syncSidebarState);
    return () => mediaQuery.removeEventListener('change', syncSidebarState);
  }, []);

  useEffect(() => {
    if (isHydrating) return;

    if (!isAuthenticated || (user?.role !== 'ADMIN' && user?.role !== 'STAFF' && user?.role !== 'MANAGER')) {
      navigate('/login');
      return;
    }

    const currentItem = accessibleItems.find((item) => (
      location.pathname === item.path ||
      (item.path !== '/admin' && location.pathname.startsWith(item.path))
    ));

    if (!currentItem && accessibleItems[0]) {
      navigate(accessibleItems[0].path, { replace: true });
    }
  }, [accessibleItems, isAuthenticated, isHydrating, location.pathname, navigate, user]);

  if (isHydrating) {
    return <PageLoader />;
  }

  if (!isAuthenticated || (user?.role !== 'ADMIN' && user?.role !== 'STAFF' && user?.role !== 'MANAGER')) return null;

  const handleLogout = () => logout();
  const handleNavClick = () => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(max-width: 1024px)').matches) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="admin-sidebar-header">
          <Link to="/admin" className="admin-logo">
            <span className="admin-logo-text">Nurfia</span>
            <span className="admin-logo-sub">Admin</span>
          </Link>
        </div>

        <nav className="admin-nav">
          {accessibleItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} className={`admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-nav-item" target="_blank">
            <Globe size={18} />
            <span>View Store</span>
          </Link>
          <button className="admin-nav-item logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <button
        type="button"
        className={`admin-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        title="Close sidebar"
        aria-label="Close sidebar"
      />

      {/* Main Content */}
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="admin-topbar-right">
            <NotificationBell />
            <div className="admin-user-profile">
              <span className="admin-user-name">{user?.fullName}</span>
              <span className="admin-user-role">
                {user?.role === 'ADMIN' ? 'Administrator' : user?.role === 'MANAGER' ? 'Manager' : 'Staff'}
              </span>
            </div>
            <div className="admin-user-avatar">{user?.fullName?.[0]}</div>
          </div>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
