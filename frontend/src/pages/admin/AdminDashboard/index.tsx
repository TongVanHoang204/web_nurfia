import { useState, useEffect } from 'react';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  UserRound,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  Plus
} from 'lucide-react';
import api from '../../../api/client';
import './AdminDashboard.css';

type RevenuePoint = {
  date: string;
  label: string;
  revenue: number;
  orders: number;
};

type DashboardOrder = {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: number | string;
  createdAt: string;
  user: {
    fullName: string;
    username?: string;
    email: string;
  };
};

type DashboardProduct = {
  id: number;
  name: string;
  sku: string;
  salesCount: number;
  stock: number;
  price: number | string;
  isActive: boolean;
};

type DashboardLowStockProduct = {
  id: number;
  name: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
};

type DashboardCustomer = {
  id: number;
  fullName: string;
  email: string;
  createdAt: string;
};

type DashboardData = {
  totalOrders: number;
  totalRevenue: number | string;
  totalCustomers: number;
  totalProducts: number;
  ordersToday: number;
  revenueToday: number | string;
  averageOrderValue: number | string;
  monthRevenue: number | string;
  recentOrders: DashboardOrder[];
  recentCustomers: DashboardCustomer[];
  topProducts: DashboardProduct[];
  lowStockProducts: DashboardLowStockProduct[];
  revenueLast7Days: RevenuePoint[];
  ordersByStatus: Record<string, number>;
};

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'] as const;

const formatCurrency = (value: number | string | null | undefined) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatNumber = (value: number | string | null | undefined) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US').format(amount);
};

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(r => setStats(r.data.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!stats) return <div className="admin-empty-state"><p>Data unavailable</p></div>;

  const maxRevenue = Math.max(...(stats.revenueLast7Days?.map((point) => Number(point.revenue)) || [0]), 1);
  const totalTrackedStatus = ORDER_STATUSES.reduce((sum, status) => sum + (stats.ordersByStatus?.[status] || 0), 0);

  return (
    <div className="admin-dashboard-page">
      <header className="admin-dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back. Here's what's happening with your store today.</p>
        </div>
        <div className="admin-dashboard-refresh">
          Live Updates Active
        </div>
      </header>

      <div className="admin-kpi-grid">
        <KPIItem label="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={<DollarSign size={18} />} />
        <KPIItem label="Month Revenue" value={formatCurrency(stats.monthRevenue)} icon={<Wallet size={18} />} />
        <KPIItem label="Total Orders" value={formatNumber(stats.totalOrders)} icon={<ShoppingCart size={18} />} />
        <KPIItem label="Active Customers" value={formatNumber(stats.totalCustomers)} icon={<UserRound size={18} />} />
      </div>

      <div className="admin-dashboard-grid">
        {/* Revenue Chart */}
        <section className="admin-dashboard-span-8">
          <div className="admin-db-card">
            <div className="admin-db-card-header">
              <h3>Revenue Trends</h3>
              <small>Last 7 Days</small>
            </div>
            <div className="admin-revenue-list">
              {stats.revenueLast7Days?.map((point) => (
                <div key={point.date} className="admin-revenue-item">
                  <div className="admin-revenue-meta">
                    <span>{point.label}</span>
                    <span>{formatCurrency(point.revenue)} ({point.orders} orders)</span>
                  </div>
                  <div className="admin-revenue-bar-bg">
                    <div className="admin-revenue-bar-fill" style={{ width: `${(point.revenue / maxRevenue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Order Status */}
        <section className="admin-dashboard-span-4">
          <div className="admin-db-card">
            <div className="admin-db-card-header">
              <h3>Order Status</h3>
              <small>Distribution</small>
            </div>
            <div className="admin-status-list">
              {ORDER_STATUSES.map((status) => {
                const count = stats.ordersByStatus?.[status] || 0;
                return (
                  <div key={status} className="admin-status-item">
                    <div className="admin-status-info">
                      <strong>{status}</strong>
                      <span>{count} orders</span>
                    </div>
                    <div className="admin-status-badge">{totalTrackedStatus ? Math.round((count / totalTrackedStatus) * 100) : 0}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Recent Orders */}
        <section className="admin-dashboard-span-12">
          <div className="admin-db-card">
            <div className="admin-db-card-header">
              <h3>Recent Transactions</h3>
              <button className="btn btn-outline btn-sm">View All Orders</button>
            </div>
            <div className="admin-db-list">
              {stats.recentOrders?.slice(0, 5).map((order) => (
                <div key={order.id} className="admin-db-item">
                  <div className="admin-db-item-main">
                    <span className="admin-db-item-title">Order #{order.orderNumber}</span>
                    <span className="admin-db-item-sub">
                      {order.user?.fullName} • {formatDateTime(order.createdAt)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div className="admin-status-badge">{order.status}</div>
                    <strong className="admin-db-item-price">{formatCurrency(order.totalAmount)}</strong>
                    <ArrowUpRight size={16} color="var(--color-text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Top Products */}
        <section className="admin-dashboard-span-6">
          <div className="admin-db-card">
            <div className="admin-db-card-header">
              <h3>Best Sellers</h3>
              <TrendingUp size={18} color="var(--color-accent)" />
            </div>
            <div className="admin-db-list">
              {stats.topProducts?.slice(0, 5).map((product) => (
                <div key={product.id} className="admin-db-item">
                  <div className="admin-db-item-main">
                    <span className="admin-db-item-title">{product.name}</span>
                    <span className="admin-db-item-sub">SKU: {product.sku}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ display: 'block', fontSize: 14 }}>{product.salesCount} Sold</strong>
                    <small style={{ color: 'var(--color-text-muted)' }}>{formatCurrency(product.price)}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Low Stock */}
        <section className="admin-dashboard-span-6">
          <div className="admin-db-card">
            <div className="admin-db-card-header">
              <h3>Inventory Alerts</h3>
              <AlertTriangle size={18} color="var(--color-error)" />
            </div>
            <div className="admin-db-list">
              {stats.lowStockProducts?.slice(0, 5).map((product) => (
                <div key={product.id} className="admin-db-item">
                  <div className="admin-db-item-main">
                    <span className="admin-db-item-title">{product.name}</span>
                    <span className="admin-db-item-sub">SKU: {product.sku}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ display: 'block', fontSize: 14, color: 'var(--color-error)' }}>{product.stock} Units Left</strong>
                    <small style={{ color: 'var(--color-text-muted)' }}>Threshold: {product.lowStockThreshold}</small>
                  </div>
                </div>
              ))}
              {stats.lowStockProducts?.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  All stock levels are healthy.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* New Customers */}
        <section className="admin-dashboard-span-12">
          <div className="admin-db-card">
            <div className="admin-db-card-header">
              <h3>Newest Customers</h3>
              <Plus size={18} color="var(--color-accent)" />
            </div>
            <div className="admin-db-customers">
              {stats.recentCustomers?.slice(0, 4).map((customer) => (
                <div key={customer.id} className="admin-customer-mini">
                  <div className="admin-customer-avatar">
                    {customer.fullName?.charAt(0) || 'C'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <strong>{customer.fullName}</strong>
                    <span>{customer.email}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function KPIItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <article className="admin-kpi-card">
      <div className="admin-kpi-icon-wrap">{icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="admin-kpi-label">{label}</span>
        <strong className="admin-kpi-value">{value}</strong>
      </div>
    </article>
  );
}
