import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Eye, Filter, Search, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { resolveSiteAssetUrl } from '../../../contexts/SiteSettingsContext';
import './AdminOrders.css';

type OrderItem = {
  id: number;
  productName: string;
  quantity: number;
  price: number | string;
  product?: {
    images?: Array<{ url: string; alt?: string | null }>;
  } | null;
};

type OrderUser = {
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
};

type AdminOrder = {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  subtotal: number | string;
  shippingCost: number | string;
  discountAmount: number | string;
  totalAmount: number | string;
  shippingName: string;
  shippingPhone: string;
  shippingEmail: string;
  shippingStreet: string;
  shippingWard?: string | null;
  shippingDistrict: string;
  shippingProvince: string;
  note?: string | null;
  bankTransferImage?: string | null;
  user?: OrderUser | null;
  items: OrderItem[];
};

type Pagination = {
  page: number;
  total: number;
  totalPages: number;
};

const SHIPPING_OPTIONS = ['', 'PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
const PAYMENT_OPTIONS = ['', 'UNPAID', 'PAID', 'REFUNDED'];
const SHIPPING_TIMELINE = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'SHIPPING', label: 'Shipping' },
  { key: 'DELIVERED', label: 'Delivered' },
] as const;

const formatCurrency = (value: number | string | null | undefined) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (value: string) => {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeText = (value: string) => value.trim().toLowerCase();

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const { addToast } = useUIStore();

  const fetchOrders = (page = 1) => {
    setIsLoading(true);
    const params: any = { page, limit: 15 };
    if (statusFilter) params.status = statusFilter;
    if (paymentStatusFilter) params.paymentStatus = paymentStatusFilter;
    api.get('/admin/orders', { params })
      .then((r) => {
        setOrders(r.data.data || []);
        setPagination(r.data.pagination || { page: 1, total: 0, totalPages: 0 });
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchOrders(); }, [statusFilter, paymentStatusFilter]);

  const visibleOrders = useMemo(() => {
    const query = normalizeText(searchTerm);
    if (!query) return orders;

    return orders.filter((order) => {
      const haystack = [
        order.orderNumber,
        order.shippingName,
        order.shippingEmail,
        order.shippingPhone,
        order.user?.fullName || '',
        order.user?.email || '',
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [orders, searchTerm]);

  const summary = useMemo(() => {
    const revenue = visibleOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    return {
      count: visibleOrders.length,
      pending: visibleOrders.filter((order) => order.status === 'PENDING').length,
      unpaid: visibleOrders.filter((order) => (order.paymentStatus || 'UNPAID') === 'UNPAID').length,
      revenue,
    };
  }, [visibleOrders]);

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      addToast(`Order status updated to ${status}`, 'success');
      fetchOrders(pagination.page);
    } catch { addToast('Failed to update status', 'error'); }
  };

  const updatePaymentStatus = async (id: number, paymentStatus: string) => {
    try {
      await api.put(`/admin/orders/${id}/payment-status`, { paymentStatus });
      addToast(`Payment status updated to ${paymentStatus}`, 'success');
      fetchOrders(pagination.page);
    } catch { addToast('Failed to update payment status', 'error'); }
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case 'MOMO': return 'status-shipping';
      case 'BANK_TRANSFER': return 'status-confirmed';
      default: return 'status-pending'; // COD
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'MOMO': return 'Momo';
      case 'BANK_TRANSFER': return 'Bank Transfer';
      default: return 'COD';
    }
  };

  const getPaymentStatusBadgeClass = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'PAID': return 'status-delivered';
      case 'REFUNDED': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPaymentStatusFilter('');
  };

  const applyQuickAction = (action: 'all' | 'pending' | 'shipping' | 'delivered' | 'unpaid' | 'paid') => {
    switch (action) {
      case 'pending':
        setStatusFilter('PENDING');
        setPaymentStatusFilter('');
        break;
      case 'shipping':
        setStatusFilter('SHIPPING');
        setPaymentStatusFilter('');
        break;
      case 'delivered':
        setStatusFilter('DELIVERED');
        setPaymentStatusFilter('');
        break;
      case 'unpaid':
        setStatusFilter('');
        setPaymentStatusFilter('UNPAID');
        break;
      case 'paid':
        setStatusFilter('');
        setPaymentStatusFilter('PAID');
        break;
      default:
        setStatusFilter('');
        setPaymentStatusFilter('');
        break;
    }
  };

  const getTimelineStepState = (orderStatus: string, stepKey: string) => {
    if (orderStatus === 'CANCELLED') return 'cancelled';
    const currentIndex = SHIPPING_TIMELINE.findIndex((step) => step.key === orderStatus);
    const stepIndex = SHIPPING_TIMELINE.findIndex((step) => step.key === stepKey);

    if (currentIndex < 0) return stepIndex === 0 ? 'current' : 'upcoming';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const selectedTimelineIndex = selectedOrder
    ? SHIPPING_TIMELINE.findIndex((step) => step.key === selectedOrder.status)
    : -1;

  return (
    <div className="orders-admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Orders</h1>
          <p className="orders-admin-subtitle">Improved overview for tracking shipping, payment, and customer details.</p>
        </div>

        <div className="orders-admin-badges">
          <span>Total: {pagination.total}</span>
          <span>Visible: {summary.count}</span>
          <span>Pending: {summary.pending}</span>
          <span>Unpaid: {summary.unpaid}</span>
          <span>Revenue: {formatCurrency(summary.revenue)}</span>
        </div>
      </div>

      <div className="admin-card orders-toolbar-card">
        <div className="orders-toolbar-left">
          <div className="orders-search-wrap">
            <Search size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search order #, customer, email, phone"
              title="Search orders"
            />
          </div>

          <div className="orders-select-wrap">
            <Filter size={15} />
            <select title="Shipping Status Filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {SHIPPING_OPTIONS.map((status) => (
                <option key={status || 'all-shipping'} value={status}>{status || 'All Shipping Status'}</option>
              ))}
            </select>
          </div>

          <div className="orders-select-wrap">
            <Filter size={15} />
            <select title="Payment Status Filter" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)}>
              {PAYMENT_OPTIONS.map((status) => (
                <option key={status || 'all-payment'} value={status}>{status || 'All Payment Status'}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={clearFilters}>Reset</button>
      </div>

      <div className="admin-card orders-list-card">
        <div className="orders-sticky-actions" role="toolbar" aria-label="Order quick actions">
          <div className="orders-sticky-actions-left">
            <button className={`orders-quick-btn ${!statusFilter && !paymentStatusFilter ? 'is-active' : ''}`} onClick={() => applyQuickAction('all')}>All</button>
            <button className={`orders-quick-btn ${statusFilter === 'PENDING' ? 'is-active' : ''}`} onClick={() => applyQuickAction('pending')}>Pending</button>
            <button className={`orders-quick-btn ${statusFilter === 'SHIPPING' ? 'is-active' : ''}`} onClick={() => applyQuickAction('shipping')}>Shipping</button>
            <button className={`orders-quick-btn ${statusFilter === 'DELIVERED' ? 'is-active' : ''}`} onClick={() => applyQuickAction('delivered')}>Delivered</button>
            <button className={`orders-quick-btn ${paymentStatusFilter === 'UNPAID' ? 'is-active' : ''}`} onClick={() => applyQuickAction('unpaid')}>Unpaid</button>
            <button className={`orders-quick-btn ${paymentStatusFilter === 'PAID' ? 'is-active' : ''}`} onClick={() => applyQuickAction('paid')}>Paid</button>
          </div>
          <div className="orders-sticky-actions-right">
            <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => fetchOrders(pagination.page)}>Refresh</button>
            <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={clearFilters}>Clear</button>
          </div>
        </div>

        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : visibleOrders.length === 0 ? (
          <p className="admin-empty-state">No orders found</p>
        ) : (
          <div className="orders-list">
            {visibleOrders.map((order) => (
              <article key={order.id} className="orders-row-card">
                <div className="orders-row-main">
                  <div>
                    <p className="orders-row-number">#{order.orderNumber}</p>
                    <p className="orders-row-sub">{order.items?.length || 0} item(s)</p>
                  </div>

                  <div className="orders-row-customer">
                    <p>{order.user?.fullName || order.shippingName}</p>
                    <small>{order.user?.email || order.shippingEmail}</small>
                  </div>

                  <div>
                    <p className="orders-row-sub">Total</p>
                    <strong className="orders-row-total">{formatCurrency(order.totalAmount)}</strong>
                  </div>

                  <div className="orders-row-created">
                    <CalendarDays size={13} />
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                </div>

                <div className="orders-row-controls">
                  <span className={`status-badge ${getMethodBadgeClass(order.paymentMethod)}`}>{getPaymentLabel(order.paymentMethod)}</span>

                  <div className="orders-select-group">
                    <label htmlFor={`payment-${order.id}`}>Payment</label>
                    <select
                      id={`payment-${order.id}`}
                      className="admin-select-field"
                      title="Payment Status"
                      value={order.paymentStatus || 'UNPAID'}
                      onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                    >
                      <option value="UNPAID">Unpaid</option>
                      <option value="PAID">Paid</option>
                      <option value="REFUNDED">Refunded</option>
                    </select>
                  </div>

                  <div className="orders-select-group">
                    <label htmlFor={`status-${order.id}`}>Shipping</label>
                    <select
                      id={`status-${order.id}`}
                      className="admin-select-field"
                      title="Order Status"
                      value={order.status || 'PENDING'}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="SHIPPING">Shipping</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  <button
                    className="admin-btn admin-btn-outline admin-btn-sm"
                    onClick={() => setSelectedOrder(order)}
                    title="View Details"
                    aria-label="View Details"
                  >
                    <Eye size={14} /> Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="admin-pagination">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`admin-btn admin-btn-sm ${p === pagination.page ? 'admin-btn-primary' : 'admin-btn-outline'}`} onClick={() => fetchOrders(p)}>{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content orders-details-modal">
            <div className="admin-modal-header">
              <div className="orders-details-head">
                <h2 className="admin-modal-title">Order #{selectedOrder.orderNumber}</h2>
                <div className="orders-details-badges">
                  <span className={`status-badge status-${selectedOrder.status.toLowerCase()}`}>{selectedOrder.status}</span>
                  <span className={`status-badge ${getPaymentStatusBadgeClass(selectedOrder.paymentStatus || 'UNPAID')}`}>{selectedOrder.paymentStatus || 'UNPAID'}</span>
                  <span className={`status-badge ${getMethodBadgeClass(selectedOrder.paymentMethod)}`}>{getPaymentLabel(selectedOrder.paymentMethod)}</span>
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="admin-modal-close" aria-label="Close" title="Close"><X size={20} /></button>
            </div>

            <div className="orders-details-body">
              <section className="orders-details-left">
                <div className="orders-status-timeline-wrap">
                  <h3 className="orders-details-title">Shipping Timeline</h3>
                  <div className={`orders-status-timeline ${selectedOrder.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>
                    {SHIPPING_TIMELINE.map((step, index) => {
                      const stepState = getTimelineStepState(selectedOrder.status, step.key);
                      const lineCompleted = selectedOrder.status !== 'CANCELLED' && selectedTimelineIndex > index;

                      return (
                        <div key={step.key} className={`orders-status-step is-${stepState}`}>
                          <div className="orders-status-step-top">
                            <span className="orders-status-step-node" />
                            {index < SHIPPING_TIMELINE.length - 1 ? (
                              <span className={`orders-status-step-line ${lineCompleted ? 'is-completed' : ''}`} />
                            ) : null}
                          </div>
                          <span className="orders-status-step-label">{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {selectedOrder.status === 'CANCELLED' ? (
                    <p className="orders-status-cancelled-note">This order was cancelled before completion.</p>
                  ) : null}
                </div>

                <h3 className="orders-details-title">Items ({selectedOrder.items?.length || 0})</h3>
                <div className="orders-details-items">
                  {selectedOrder.items?.map((item) => {
                    const imageUrl = item.product?.images?.[0]?.url;
                    return (
                      <article key={item.id} className="orders-details-item">
                        <div className="orders-details-item-image-wrap">
                          {imageUrl ? (
                            <img src={resolveSiteAssetUrl(imageUrl)} alt={item.productName} className="orders-details-item-image" />
                          ) : (
                            <span className="orders-details-no-image">No Image</span>
                          )}
                        </div>

                        <div className="orders-details-item-info">
                          <p className="orders-details-item-name">{item.productName}</p>
                          <p className="orders-details-item-meta">{formatCurrency(item.price)} x {item.quantity}</p>
                        </div>

                        <strong className="orders-details-item-subtotal">{formatCurrency(Number(item.price) * item.quantity)}</strong>
                      </article>
                    );
                  })}
                </div>

                <div className="orders-details-summary">
                  <div className="orders-details-summary-row"><span>Subtotal</span><strong>{formatCurrency(selectedOrder.subtotal)}</strong></div>
                  <div className="orders-details-summary-row"><span>Shipping</span><strong>{formatCurrency(selectedOrder.shippingCost)}</strong></div>
                  {Number(selectedOrder.discountAmount) > 0 ? (
                    <div className="orders-details-summary-row is-discount"><span>Discount</span><strong>-{formatCurrency(selectedOrder.discountAmount)}</strong></div>
                  ) : null}
                  <div className="orders-details-summary-total"><span>Total</span><strong>{formatCurrency(selectedOrder.totalAmount)}</strong></div>
                </div>

              </section>

              <aside className="orders-details-right">
                <div className="orders-details-info-card">
                  <h3 className="orders-details-title">Customer Info</h3>
                  <p className="orders-details-value">{selectedOrder.user?.fullName || selectedOrder.user?.username || 'Guest'}</p>
                  <p className="orders-details-sub">{selectedOrder.user?.email || '-'}</p>
                  <p className="orders-details-sub">{selectedOrder.user?.phone || '-'}</p>
                </div>

                <div className="orders-details-info-card">
                  <h3 className="orders-details-title">Shipping Details</h3>
                  <p className="orders-details-value">{selectedOrder.shippingName}</p>
                  <p className="orders-details-sub">{selectedOrder.shippingPhone}</p>
                  <p className="orders-details-sub">{selectedOrder.shippingEmail}</p>
                  <p className="orders-details-address">
                    {selectedOrder.shippingStreet}
                    <br />
                    {selectedOrder.shippingWard ? `${selectedOrder.shippingWard}, ` : ''}{selectedOrder.shippingDistrict}
                    <br />
                    {selectedOrder.shippingProvince}
                  </p>
                </div>

                {selectedOrder.note ? (
                  <div className="orders-details-info-card">
                    <h3 className="orders-details-title">Order Note</h3>
                    <p className="orders-details-note">{selectedOrder.note}</p>
                  </div>
                ) : null}

                {selectedOrder.bankTransferImage ? (
                  <div className="orders-details-info-card">
                    <h3 className="orders-details-title">Payment Proof</h3>
                    <img src={resolveSiteAssetUrl(selectedOrder.bankTransferImage)} alt="Payment proof" className="orders-details-proof" />
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

