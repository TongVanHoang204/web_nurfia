import { useState, useEffect } from 'react';
import {
  Box,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  UserRound,
  Wallet,
  AlertTriangle,
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
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatNumber = (value: number | string | null | undefined) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US').format(amount);
};

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setStats(r.data.data)).catch(console.error).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!stats) return <p>Failed to load dashboard</p>;

  const maxRevenue = Math.max(...(stats.revenueLast7Days?.map((point) => Number(point.revenue)) || [0]), 1);
  const totalTrackedStatus = ORDER_STATUSES.reduce((sum, status) => sum + (stats.ordersByStatus?.[status] || 0), 0);

  return (
    <div className="dashboard-v2-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard Overview</h1>
          <p className="dashboard-v2-subtitle">A quick snapshot of sales, operations, and inventory health.</p>
        </div>
        <div className="dashboard-v2-refresh-note">Updated now</div>
      </div>

      <div className="dashboard-v2-kpi-grid">
        <article className="dashboard-v2-kpi-card">
          <div className="dashboard-v2-kpi-icon bg-indigo"><ShoppingCart size={18} /></div>
          <div>
            <p className="dashboard-v2-kpi-label">Total Orders</p>
            <h3 className="dashboard-v2-kpi-value">{formatNumber(stats.totalOrders)}</h3>
          </div>
        </article>

        <article className="dashboard-v2-kpi-card">
          <div className="dashboard-v2-kpi-icon bg-green"><DollarSign size={18} /></div>
          <div>
            <p className="dashboard-v2-kpi-label">Total Revenue</p>
            <h3 className="dashboard-v2-kpi-value">{formatCurrency(stats.totalRevenue)}</h3>
          </div>
        </article>

        <article className="dashboard-v2-kpi-card">
          <div className="dashboard-v2-kpi-icon bg-blue"><UserRound size={18} /></div>
          <div>
            <p className="dashboard-v2-kpi-label">Customers</p>
            <h3 className="dashboard-v2-kpi-value">{formatNumber(stats.totalCustomers)}</h3>
          </div>
        </article>

        <article className="dashboard-v2-kpi-card">
          <div className="dashboard-v2-kpi-icon bg-amber"><Package size={18} /></div>
          <div>
            <p className="dashboard-v2-kpi-label">Active Products</p>
            <h3 className="dashboard-v2-kpi-value">{formatNumber(stats.totalProducts)}</h3>
          </div>
        </article>

        <article className="dashboard-v2-kpi-card">
          <div className="dashboard-v2-kpi-icon bg-sky"><Clock3Fallback /></div>
          <div>
            <p className="dashboard-v2-kpi-label">Orders Today</p>
            <h3 className="dashboard-v2-kpi-value">{formatNumber(stats.ordersToday)}</h3>
          </div>
        </article>

        <article className="dashboard-v2-kpi-card">
          <div className="dashboard-v2-kpi-icon bg-emerald"><Wallet size={18} /></div>
          <div>
            <p className="dashboard-v2-kpi-label">Revenue Today</p>
            <h3 className="dashboard-v2-kpi-value">{formatCurrency(stats.revenueToday)}</h3>
          </div>
        </article>

        <article className="dashboard-v2-kpi-card">
          <div className="dashboard-v2-kpi-icon bg-violet"><TrendingUp size={18} /></div>
          <div>
            <p className="dashboard-v2-kpi-label">Average Order Value</p>
            <h3 className="dashboard-v2-kpi-value">{formatCurrency(stats.averageOrderValue)}</h3>
          </div>
        </article>

        <article className="dashboard-v2-kpi-card">
          <div className="dashboard-v2-kpi-icon bg-rose"><Box size={18} /></div>
          <div>
            <p className="dashboard-v2-kpi-label">Revenue This Month</p>
            <h3 className="dashboard-v2-kpi-value">{formatCurrency(stats.monthRevenue)}</h3>
          </div>
        </article>
      </div>

      <div className="dashboard-v2-grid">
        <section className="admin-card dashboard-v2-card">
          <h3 className="dashboard-v2-card-title">Revenue (Last 7 Days)</h3>
          {stats.revenueLast7Days?.length ? (
            <div className="dashboard-v2-bars-wrap">
              {stats.revenueLast7Days.map((point) => (
                <div key={point.date} className="dashboard-v2-bars-row">
                  <div className="dashboard-v2-bars-labels">
                    <span>{point.label}</span>
                    <span>{formatCurrency(point.revenue)}</span>
                  </div>
                  <meter className="dashboard-v2-meter dashboard-v2-revenue-meter" min={0} max={maxRevenue} value={Number(point.revenue)} />
                  <span className="dashboard-v2-bars-meta">{point.orders} order(s)</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-dashboard-empty">No revenue data in the last 7 days.</p>
          )}
        </section>

        <section className="admin-card dashboard-v2-card">
          <h3 className="dashboard-v2-card-title">Order Status Distribution</h3>
          <div className="dashboard-v2-status-list">
            {ORDER_STATUSES.map((status) => {
              const count = stats.ordersByStatus?.[status] || 0;
              const percentage = totalTrackedStatus ? Math.round((count / totalTrackedStatus) * 100) : 0;
              return (
                <div key={status} className="dashboard-v2-status-row">
                  <div className="dashboard-v2-status-main">
                    <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>
                    <strong>{count}</strong>
                  </div>
                  <meter className="dashboard-v2-meter dashboard-v2-status-meter" min={0} max={100} value={percentage} />
                  <span className="dashboard-v2-status-percent">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="admin-card dashboard-v2-card dashboard-v2-span-2">
          <div className="dashboard-v2-card-head">
            <h3 className="dashboard-v2-card-title">Recent Orders</h3>
            <span className="dashboard-v2-mini-note">Latest {Math.min(stats.recentOrders?.length || 0, 8)} orders</span>
          </div>

          {stats.recentOrders?.length === 0 ? (
            <p className="admin-dashboard-empty">No orders yet</p>
          ) : (
            <div className="dashboard-v2-list">
              {stats.recentOrders.map((order) => (
                <div key={order.id} className="dashboard-v2-order-row">
                  <div>
                    <p className="dashboard-v2-order-no">#{order.orderNumber}</p>
                    <p className="dashboard-v2-order-date">{formatDateTime(order.createdAt)}</p>
                  </div>

                  <div className="dashboard-v2-order-customer">
                    <span>{order.user?.fullName || order.user?.username || 'Guest'}</span>
                    <small>{order.user?.email}</small>
                  </div>

                  <span className={`status-badge status-${order.status.toLowerCase()}`}>{order.status}</span>
                  <strong className="dashboard-v2-order-amount">{formatCurrency(order.totalAmount)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card dashboard-v2-card">
          <div className="dashboard-v2-card-head">
            <h3 className="dashboard-v2-card-title">Top Selling Products</h3>
          </div>

          {stats.topProducts?.length ? (
            <div className="dashboard-v2-simple-table">
              {stats.topProducts.map((product) => (
                <div key={product.id} className="dashboard-v2-simple-row">
                  <div>
                    <p className="dashboard-v2-product-name">{product.name}</p>
                    <p className="dashboard-v2-product-meta">SKU: {product.sku}</p>
                  </div>
                  <div className="dashboard-v2-right-values">
                    <strong>{product.salesCount} sold</strong>
                    <small>{formatCurrency(product.price)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-dashboard-empty">No product sales data yet.</p>
          )}
        </section>

        <section className="admin-card dashboard-v2-card">
          <div className="dashboard-v2-card-head">
            <h3 className="dashboard-v2-card-title">Low Stock Alerts</h3>
            <AlertTriangle size={16} className="dashboard-v2-alert-icon" />
          </div>

          {stats.lowStockProducts?.length ? (
            <div className="dashboard-v2-simple-table">
              {stats.lowStockProducts.map((product) => (
                <div key={product.id} className="dashboard-v2-simple-row">
                  <div>
                    <p className="dashboard-v2-product-name">{product.name}</p>
                    <p className="dashboard-v2-product-meta">SKU: {product.sku}</p>
                  </div>
                  <div className="dashboard-v2-right-values">
                    <strong>{product.stock} left</strong>
                    <small>Threshold: {product.lowStockThreshold}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-dashboard-empty">No low-stock products right now.</p>
          )}
        </section>

        <section className="admin-card dashboard-v2-card dashboard-v2-span-2">
          <div className="dashboard-v2-card-head">
            <h3 className="dashboard-v2-card-title">Newest Customers</h3>
          </div>

          {stats.recentCustomers?.length ? (
            <div className="dashboard-v2-customer-grid">
              {stats.recentCustomers.map((customer) => (
                <article key={customer.id} className="dashboard-v2-customer-item">
                  <div className="dashboard-v2-customer-avatar">
                    {customer.fullName?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                  <div>
                    <p className="dashboard-v2-customer-name">{customer.fullName || 'Customer'}</p>
                    <p className="dashboard-v2-customer-email">{customer.email}</p>
                    <p className="dashboard-v2-customer-date">Joined {formatDateTime(customer.createdAt)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="admin-dashboard-empty">No customer records found.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Clock3Fallback() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

