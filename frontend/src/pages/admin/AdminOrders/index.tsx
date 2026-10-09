import { translateUi, getLocale } from '../../../i18n';
import { useTranslation } from 'react-i18next';
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
  useTranslation();
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
    if (!orderIdParam) return;
    if (!/^[1-9]\d*$/.test(orderIdParam)) { addToast(translateUi('Invalid order ID'), 'error'); return; }
    const controller = new AbortController();
    api.get(`/admin/orders/${orderIdParam}`, { signal: controller.signal })
      .then(response => setSelectedOrder(response.data.data))
      .catch(() => { if (!controller.signal.aborted) addToast(translateUi('Order unavailable or access denied'), 'error'); });
    return () => controller.abort();
  }, [orderIdParam, addToast]);

  const closeModal = () => {
    setSelectedOrder(null);
    if (orderIdParam) setSearchParams(current => { const next = new URLSearchParams(current); next.delete('orderId'); return next; }, { replace: true });
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
          <h1>{translateUi("Orders")}</h1>
          <p>{translateUi("Fulfill orders, track shipping, and manage customer transactions.")}</p>
        </div>
        <div className="admin-orders-badges">
          <StatBadge label={translateUi("Total Orders")} value={pagination.total} />
          <StatBadge label={translateUi("Pending")} value={orders.filter(o => o.status === 'PENDING').length} />
          <StatBadge label={translateUi("Today's Revenue")} value={formatCurrency(orders.reduce((s, o) => s + Number(o.totalAmount), 0))} />
        </div>
      </header>

      <div className="admin-orders-toolbar">
        <div className="admin-orders-search">
          <Search size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={translateUi("Search by Order #, Customer, or Email")}
            title={translateUi("Search orders")}
          />
        </div>

        <div className="admin-orders-filters">
          <select
            className="admin-order-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            title={translateUi("Filter by status")}
          >
            <option value="">{translateUi("All Shipping")}</option>
            {SHIPPING_OPTIONS.map(opt => <option key={opt} value={opt}>{translateUi(opt)}</option>)}
          </select>

          <select
            className="admin-order-filter-select"
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            title={translateUi("Filter by payment")}
          >
            <option value="">{translateUi("All Payments")}</option>
            {PAYMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{translateUi(opt)}</option>)}
          </select>

          <button className="btn btn-outline btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter(''); setPaymentStatusFilter(''); }}>{translateUi("Reset")}</button>
        </div>
      </div>

      <div className="admin-orders-list">
        {isLoading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-empty-notifications">
             <h3>{translateUi("No orders found")}</h3>
             <p>{translateUi("Try adjusting your search or filters.")}</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <article key={order.id} className="admin-order-card">
              <div className="admin-order-card-id">
                <span>{translateUi("ORDER ID")}</span>
                <strong>#{order.orderNumber}</strong>
              </div>

              <div className="admin-order-card-customer">
                <strong>{order.shippingName}</strong>
                <span>{order.shippingEmail}</span>
                <small className="admin-order-small">{new Date(order.createdAt).toLocaleDateString(getLocale(), { month: 'short', day: 'numeric', year: 'numeric' })}</small>
              </div>

              <div className="admin-order-card-financials">
                <span>{translateUi("TOTAL AMOUNT")}</span>
                <strong>{formatCurrency(order.totalAmount)}</strong>
              </div>

              <div className="admin-order-card-controls">
                <div className="admin-order-select-group">
                  <label>{translateUi("Shipping")}</label>
                  <select
                    className="admin-order-mini-select"
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    title={translateUi("Change status")}
                  >
                    {SHIPPING_OPTIONS.map(opt => <option key={opt} value={opt}>{translateUi(opt)}</option>)}
                  </select>
                </div>

                <div className="admin-order-select-group">
                  <label>{translateUi("Payment")}</label>
                  <select
                    className="admin-order-mini-select"
                    value={order.paymentStatus}
                    onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                    title={translateUi("Change payment status")}
                  >
                    {PAYMENT_OPTIONS.map(opt => <option key={opt} value={opt}>{translateUi(opt)}</option>)}
                  </select>
                </div>

                <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setSelectedOrder(order)}>
                  <Eye size={14} />{translateUi("Details")}</button>
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
          >{translateUi("Previous")}</button>
          <span className="admin-order-pagination-text">{translateUi("Page")} {pagination.page} {translateUi("of")} {pagination.totalPages}</span>
          <button
            className="btn btn-outline"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => fetchOrders(pagination.page + 1)}
          >{translateUi("Next")}</button>
        </div>
      )}

      {/* Details Modal */}
      {selectedOrder && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal-content admin-modal-content-lg" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
            <h2 className="admin-modal-title">{translateUi("Order Details")} · {selectedOrder.orderNumber}</h2>
              <button type="button" className="admin-modal-close" title={translateUi("Close")} onClick={closeModal}><X size={20} /></button>
            </div>

            <div className="admin-modal-body admin-order-modal-body">
              <div className="admin-order-details-left">
                <h3 className="admin-order-section-title"><Package size={20} /> {translateUi("Shipping Progress")}</h3>
                <div className="admin-order-timeline">
                  {SHIPPING_TIMELINE.map((step, idx) => {
                    const isCompleted = SHIPPING_TIMELINE.findIndex(s => s.key === selectedOrder.status) >= idx;
                    const isCurrent = selectedOrder.status === step.key;
                    return (
                      <div key={step.key} className={`admin-order-step ${isCompleted ? 'is-completed' : ''} ${isCurrent ? 'is-current' : ''}`}>
                        <div className="admin-order-step-dot">
                          {isCompleted ? <Check size={14} /> : idx + 1}
                        </div>
                        <span className="admin-order-step-label">{translateUi(step.label)}</span>
                      </div>
                    );
                  })}
                </div>

                <h3 className="admin-order-section-title"><FileText size={20} /> {translateUi("Purchased Items")}</h3>
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
                        <span>{translateUi("Qty:")} {item.quantity} {translateUi("×")} {formatCurrency(item.price)}</span>
                      </div>
                      <strong className="admin-db-item-price">{formatCurrency(Number(item.price) * item.quantity)}</strong>
                    </div>
                  ))}
                </div>

                <div className="admin-order-totals">
                  <div className="admin-order-total-row">
                    <span className="admin-order-total-label">{translateUi("Subtotal")}</span>
                    <strong className="admin-order-total-value">{formatCurrency(selectedOrder.subtotal)}</strong>
                  </div>
                  <div className="admin-order-total-row">
                    <span className="admin-order-total-label">{translateUi("Shipping")}</span>
                    <strong className="admin-order-total-value">{formatCurrency(selectedOrder.shippingCost)}</strong>
                  </div>
                  {Number(selectedOrder.discountAmount) > 0 && (
                    <div className="admin-order-total-row admin-order-total-accent">
                      <span className="admin-order-total-label">{translateUi("Discount")}</span>
                      <strong className="admin-order-total-value">-{formatCurrency(selectedOrder.discountAmount)}</strong>
                    </div>
                  )}
                  <div className="admin-order-grand-row">
                    <span className="admin-order-grand-label">{translateUi("Grand Total")}</span>
                    <strong className="admin-order-grand-value">{formatCurrency(selectedOrder.totalAmount)}</strong>
                  </div>
                </div>
              </div>

              <div className="admin-order-details-right">
                <div className="admin-order-info-card">
                  <h4><User size={12} className="admin-icon-right" /> {translateUi("Customer Contact")}</h4>
                  <p><strong>{selectedOrder.shippingName}</strong></p>
                  <p>{selectedOrder.shippingEmail}</p>
                  <p>{selectedOrder.shippingPhone}</p>
                </div>

                <div className="admin-order-info-card">
                  <h4><MapPin size={12} className="admin-icon-right" /> {translateUi("Shipping Address")}</h4>
                  <p>{selectedOrder.shippingStreet}</p>
                  <p>{selectedOrder.shippingWard ? `${selectedOrder.shippingWard}, ` : ''}{selectedOrder.shippingDistrict}</p>
                  <p>{selectedOrder.shippingProvince}</p>
                </div>

                <div className="admin-order-info-card">
                  <h4><DollarSign size={12} className="admin-icon-right" /> {translateUi("Payment Method")}</h4>
                  <p><strong>{selectedOrder.paymentMethod}</strong></p>
                  <p>{translateUi("Status:")} <span className="admin-status-badge">{translateUi(selectedOrder.paymentStatus)}</span></p>
                </div>

                {selectedOrder.note && (
                  <div className="admin-order-info-card">
                    <h4><FileText size={12} className="admin-icon-right" /> {translateUi("Order Note")}</h4>
                    <p className="admin-order-note-text">"{selectedOrder.note}"</p>
                  </div>
                )}

                {selectedOrder.bankTransferImage && (
                  <div className="admin-order-info-card">
                    <h4><ImageIcon size={12} className="admin-icon-right" /> {translateUi("Payment Proof")}</h4>
                    <a href={resolveSiteAssetUrl(selectedOrder.bankTransferImage)} target="_blank" rel="noreferrer">
                      <img
                        src={resolveSiteAssetUrl(selectedOrder.bankTransferImage)}
                        alt={translateUi("Proof")}
                        className="admin-order-proof-img"
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
  useTranslation();
  return (
    <div className="admin-order-badge-stat">
      <span>{translateUi(label)}</span>
      <strong>{value}</strong>
    </div>
  );
}
