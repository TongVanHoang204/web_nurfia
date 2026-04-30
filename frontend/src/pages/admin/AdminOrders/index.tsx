import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Search, X, Check, Package, MapPin, User, FileText, ImageIcon, DollarSign } from 'lucide-react';
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

const SHIPPING_OPTIONS = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
const PAYMENT_OPTIONS = ['UNPAID', 'PAID', 'REFUNDED'];

const SHIPPING_TIMELINE = [
  { key: 'PENDING', label: 'Processing' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'SHIPPING', label: 'In Transit' },
  { key: 'DELIVERED', label: 'Completed' },
] as const;

const formatCurrency = (value: number | string | null | undefined) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};



export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const { addToast } = useUIStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdParam = searchParams.get('orderId');

  const fetchOrders = (page = 1) => {
    setIsLoading(true);
    const params: any = { page, limit: 10 };
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

  useEffect(() => {
    if (orderIdParam && orders.length > 0) {
      const targetOrder = orders.find(o => String(o.id) === orderIdParam);
      if (targetOrder) {
        setSelectedOrder(targetOrder);
        setSearchParams(new URLSearchParams());
      }
    }
  }, [orderIdParam, orders, setSearchParams]);

  const closeModal = () => {
    setSelectedOrder(null);
  };

  const filteredOrders = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return orders;
    return orders.filter(o => 
      o.orderNumber.toLowerCase().includes(q) || 
      o.shippingName.toLowerCase().includes(q) ||
      o.shippingEmail.toLowerCase().includes(q)
    );
  }, [orders, searchTerm]);

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      addToast(`Status updated to ${status}`, 'success');
      fetchOrders(pagination.page);
    } catch { addToast('Failed to update status', 'error'); }
  };

  const updatePaymentStatus = async (id: number, paymentStatus: string) => {
    try {
      await api.put(`/admin/orders/${id}/payment-status`, { paymentStatus });
      addToast(`Payment updated to ${paymentStatus}`, 'success');
      fetchOrders(pagination.page);
    } catch { addToast('Failed to update payment', 'error'); }
  };

  return (
    <div className="admin-orders-page">
      <header className="admin-orders-header">
        <div>
          <h1>Orders</h1>
          <p>Fulfill orders, track shipping, and manage customer transactions.</p>
        </div>
        <div className="admin-orders-badges">
          <StatBadge label="Total Orders" value={pagination.total} />
          <StatBadge label="Pending" value={orders.filter(o => o.status === 'PENDING').length} />
          <StatBadge label="Today's Revenue" value={formatCurrency(orders.reduce((s, o) => s + Number(o.totalAmount), 0))} />
        </div>
      </header>

      <div className="admin-orders-toolbar">
        <div className="admin-orders-search">
          <Search size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order #, Customer, or Email"
            title="Search orders"
          />
        </div>

        <div className="admin-orders-filters">
          <select 
            className="admin-order-filter-select"
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            title="Filter by status"
          >
            <option value="">All Shipping</option>
            {SHIPPING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <select 
            className="admin-order-filter-select"
            value={paymentStatusFilter} 
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            title="Filter by payment"
          >
            <option value="">All Payments</option>
            {PAYMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <button className="btn btn-outline btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter(''); setPaymentStatusFilter(''); }}>
            Reset
          </button>
        </div>
      </div>

      <div className="admin-orders-list">
        {isLoading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-empty-notifications" style={{ border: '1px solid var(--color-border)' }}>
             <h3>No orders found</h3>
             <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <article key={order.id} className="admin-order-card">
              <div className="admin-order-card-id">
                <span>ORDER ID</span>
                <strong>#{order.orderNumber}</strong>
              </div>

              <div className="admin-order-card-customer">
                <strong>{order.shippingName}</strong>
                <span>{order.shippingEmail}</span>
                <small style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small>
              </div>

              <div className="admin-order-card-financials">
                <span>TOTAL AMOUNT</span>
                <strong>{formatCurrency(order.totalAmount)}</strong>
              </div>

              <div className="admin-order-card-controls">
                <div className="admin-order-select-group">
                  <label>Shipping</label>
                  <select 
                    className="admin-order-mini-select"
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    title="Change status"
                  >
                    {SHIPPING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div className="admin-order-select-group">
                  <label>Payment</label>
                  <select 
                    className="admin-order-mini-select"
                    value={order.paymentStatus}
                    onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                    title="Change payment status"
                  >
                    {PAYMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setSelectedOrder(order)}>
                  <Eye size={14} /> Details
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="admin-notifications-footer">
          <button 
            className="btn btn-outline" 
            disabled={pagination.page === 1}
            onClick={() => fetchOrders(pagination.page - 1)}
          >
            Previous
          </button>
          <span style={{ margin: '0 20px', fontSize: 13, fontWeight: 600 }}>Page {pagination.page} of {pagination.totalPages}</span>
          <button 
            className="btn btn-outline"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => fetchOrders(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Details Modal */}
      {selectedOrder && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Order Details</h2>
              <button type="button" className="admin-modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            
            <div className="admin-modal-body admin-order-modal-body">
              <div className="admin-order-details-left">
                <h3 className="admin-order-section-title"><Package size={20} /> Shipping Progress</h3>
                <div className="admin-order-timeline">
                  {SHIPPING_TIMELINE.map((step, idx) => {
                    const isCompleted = SHIPPING_TIMELINE.findIndex(s => s.key === selectedOrder.status) >= idx;
                    const isCurrent = selectedOrder.status === step.key;
                    return (
                      <div key={step.key} className={`admin-order-step ${isCompleted ? 'is-completed' : ''} ${isCurrent ? 'is-current' : ''}`}>
                        <div className="admin-order-step-dot">
                          {isCompleted ? <Check size={14} /> : idx + 1}
                        </div>
                        <span className="admin-order-step-label">{step.label}</span>
                      </div>
                    );
                  })}
                </div>

                <h3 className="admin-order-section-title"><FileText size={20} /> Purchased Items</h3>
                <div className="admin-order-items-list">
                  {selectedOrder.items?.map(item => (
                    <div key={item.id} className="admin-order-item-row">
                      <img 
                        src={resolveSiteAssetUrl(item.product?.images?.[0]?.url || '')} 
                        alt={item.productName} 
                        className="admin-order-item-img" 
                      />
                      <div className="admin-order-item-info">
                        <strong>{item.productName}</strong>
                        <span>Qty: {item.quantity} × {formatCurrency(item.price)}</span>
                      </div>
                      <strong className="admin-db-item-price">{formatCurrency(Number(item.price) * item.quantity)}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 32, padding: 24, borderTop: '2px solid var(--color-black)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14 }}>Subtotal</span>
                    <strong style={{ fontSize: 16 }}>{formatCurrency(selectedOrder.subtotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14 }}>Shipping</span>
                    <strong style={{ fontSize: 16 }}>{formatCurrency(selectedOrder.shippingCost)}</strong>
                  </div>
                  {Number(selectedOrder.discountAmount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: 'var(--color-accent)' }}>
                      <span style={{ fontSize: 14 }}>Discount</span>
                      <strong style={{ fontSize: 16 }}>-{formatCurrency(selectedOrder.discountAmount)}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: 18, fontFamily: 'var(--font-heading)' }}>Grand Total</span>
                    <strong style={{ fontSize: 24, fontFamily: 'var(--font-heading)', color: 'var(--color-black)' }}>{formatCurrency(selectedOrder.totalAmount)}</strong>
                  </div>
                </div>
              </div>

              <div className="admin-order-details-right">
                <div className="admin-order-info-card">
                  <h4><User size={12} style={{ marginRight: 6 }} /> Customer Contact</h4>
                  <p><strong>{selectedOrder.shippingName}</strong></p>
                  <p>{selectedOrder.shippingEmail}</p>
                  <p>{selectedOrder.shippingPhone}</p>
                </div>

                <div className="admin-order-info-card">
                  <h4><MapPin size={12} style={{ marginRight: 6 }} /> Shipping Address</h4>
                  <p>{selectedOrder.shippingStreet}</p>
                  <p>{selectedOrder.shippingWard ? `${selectedOrder.shippingWard}, ` : ''}{selectedOrder.shippingDistrict}</p>
                  <p>{selectedOrder.shippingProvince}</p>
                </div>

                <div className="admin-order-info-card">
                  <h4><DollarSign size={12} style={{ marginRight: 6 }} /> Payment Method</h4>
                  <p><strong>{selectedOrder.paymentMethod}</strong></p>
                  <p>Status: <span className="admin-status-badge">{selectedOrder.paymentStatus}</span></p>
                </div>

                {selectedOrder.note && (
                  <div className="admin-order-info-card">
                    <h4><FileText size={12} style={{ marginRight: 6 }} /> Order Note</h4>
                    <p style={{ fontStyle: 'italic' }}>"{selectedOrder.note}"</p>
                  </div>
                )}

                {selectedOrder.bankTransferImage && (
                  <div className="admin-order-info-card">
                    <h4><ImageIcon size={12} style={{ marginRight: 6 }} /> Payment Proof</h4>
                    <a href={resolveSiteAssetUrl(selectedOrder.bankTransferImage)} target="_blank" rel="noreferrer">
                      <img 
                        src={resolveSiteAssetUrl(selectedOrder.bankTransferImage)} 
                        alt="Proof" 
                        style={{ width: '100%', border: '1px solid var(--color-border)', cursor: 'pointer' }} 
                      />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-order-badge-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
