import { translateUi, getLocale } from '../../i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle, Package, Truck, Clock, CheckCircle2, Box, Info, CreditCard } from 'lucide-react';
import api from '../../api/client';
import { useUIStore } from '../../stores/uiStore';
import { useCartStore } from '../../stores/cartStore';
import { resolveSiteAssetUrl } from '../../contexts/SiteSettingsContext';
import { connectSocket } from '../../services/socket';
import './OrderConfirmationPage.css';

const STATUS_STEPS = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];

const getPaymentLabel = (method: string) => {
  if (method === 'BANK_TRANSFER') return 'Bank Transfer';
  if (method === 'MOMO') return 'Momo Wallet';
  if (method === 'STRIPE') return 'Stripe Checkout';
  return 'Cash on Delivery';
};

const canCancelOrder = (order: any) => ['PENDING', 'CONFIRMED'].includes(order.status) && order.paymentStatus !== 'PAID';

export default function OrderConfirmationPage() {
  useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const { fetchCart } = useCartStore();
  const [order, setOrder] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.data as Record<string, any>);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load order details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const handleOrderStatusChanged = (payload: any) => {
      if (payload.orderId === Number(id)) {
        addToast(`Order status updated to ${payload.status}`, 'info');
        fetchOrder();
      }
    };

    socket.on('order-status-changed', handleOrderStatusChanged);
    return () => {
      socket.off('order-status-changed', handleOrderStatusChanged);
    };
  }, [id]);

  const getProgressRatio = () => {
    if (!order) return 0;

    const currentStatus = String(order.status).toLowerCase();
    let currentStepIndex = STATUS_STEPS.indexOf(currentStatus);
    if (currentStepIndex === -1) currentStepIndex = 0;
    const isCancelled = currentStatus === 'cancelled';

    if (isCancelled) return 1;
    if (currentStepIndex === 0) return 0;
    if (currentStepIndex === 1) return 1 / 3;
    if (currentStepIndex === 2) return 2 / 3;
    return 1;
  };

  const mapStatusToTitle = (step: string) => {
    switch (step) {
      case 'pending': return 'Order Placed';
      case 'confirmed': return 'Confirmed';
      case 'shipping': return 'Shipping';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return step;
    }
  };

  const renderIcon = (step: string) => {
    switch (step) {
      case 'pending': return <Clock size={20} />;
      case 'confirmed': return <Box size={20} />;
      case 'shipping': return <Truck size={20} />;
      case 'delivered': return <CheckCircle2 size={20} />;
      default: return <Clock size={20} />;
    }
  };

  const handleUploadProof = async () => {
    if (!order) return;

    if (!proofFile) {
      addToast('Please choose an image first.', 'error');
      return;
    }

    setIsUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('image', proofFile);
      const uploadRes = await api.post('/upload/payment-proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await api.post(`/orders/${order.id}/bank-transfer-proof`, {
        bankTransferImage: uploadRes.data.data.url,
      });

      setProofFile(null);
      addToast('Payment proof uploaded successfully.', 'success');
      await fetchOrder();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to upload payment proof.', 'error');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;

    if (!window.confirm('Cancel this order? This cannot be undone.')) {
      return;
    }

    setIsCancelling(true);
    try {
      await api.post(`/orders/${order.id}/cancel`);
      addToast('Order cancelled successfully.', 'success');
      await fetchOrder();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Unable to cancel this order.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReorder = async () => {
    if (!order) return;

    setIsReordering(true);
    try {
      const response = await api.post(`/orders/${order.id}/reorder`);
      await fetchCart();
      const skippedCount = response.data.data?.skippedItems?.length || 0;
      addToast(skippedCount ? `Items added to cart. ${skippedCount} item(s) were limited by current stock.` : 'Items added back to your cart.', 'success');
      navigate('/cart');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Unable to reorder these items.', 'error');
    } finally {
      setIsReordering(false);
    }
  };

  const handleRetryMomoPayment = async () => {
    if (!order) return;

    setIsRetryingPayment(true);
    try {
      const response = await api.post('/payment/momo/create', {
        orderId: order.id,
        redirectUrl: `${window.location.origin}/order-confirmation/${order.id}`,
      });
      const payUrl = response.data.data?.payUrl || response.data.data?.deeplink;
      if (!payUrl) {
        throw new Error('Missing Momo payment URL.');
      }
      window.location.href = payUrl;
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Unable to open Momo payment.', 'error');
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const handleRetryStripePayment = async () => {
    if (!order) return;

    setIsRetryingPayment(true);
    try {
      const response = await api.post('/payment/stripe/create-checkout-session', {
        orderId: order.id,
        returnUrl: `${window.location.origin}/order-confirmation/${order.id}`,
      });
      const checkoutUrl = response.data.data?.url;
      if (!checkoutUrl) {
        throw new Error('Missing Stripe Checkout URL.');
      }
      window.location.href = checkoutUrl;
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Unable to open Stripe Checkout.', 'error');
    } finally {
      setIsRetryingPayment(false);
    }
  };

  useEffect(() => {
    if (!order || !timelineRef.current) {
      return;
    }

    timelineRef.current.style.setProperty('--pw-progress', String(getProgressRatio()));
  }, [order]);

  if (isLoading) return <div className="loading-page"><div className="spinner" /></div>;
  if (error || !order) return <div className="loading-page"><p>{error || translateUi("Order not found")}</p></div>;

  const currentStatus = String(order.status).toLowerCase();
  let currentStepIndex = STATUS_STEPS.indexOf(currentStatus);
  if (currentStepIndex === -1) currentStepIndex = 0;

  const isCancelled = currentStatus === 'cancelled';

  const shippingCost = Number(order.shippingCost || 0);
  const paymentLabel = getPaymentLabel(String(order.paymentMethod));
  const paymentStatusText = order.paymentStatus === 'PAID' ? 'Payment completed' : 'Awaiting payment';
  const bankTransferProofUrl = typeof order.bankTransferImage === 'string'
    ? resolveSiteAssetUrl(order.bankTransferImage)
    : '';

  return (
    <div className="order-confirmation-page">
      <div className="container">
        <div className="oc-header">
          {isCancelled ? (
            <div className="oc-icon-cancelled">✕</div>
          ) : (
            <CheckCircle className="oc-icon" size={64} />
          )}
          <h1 className="oc-title">{isCancelled ? translateUi("Order Cancelled") : translateUi("Order Received")}</h1>
          <p className="oc-subtitle">
            {isCancelled
              ? translateUi("This order has been cancelled and will not be processed.")
              : translateUi("Thank you. Your order has been received.")}
          </p>
        </div>

        <ul className="oc-summary">
          <li>
            <span>{translateUi("Order number:")}</span>
            <strong>#{String(order.orderNumber)}</strong>
          </li>
          <li>
            <span>{translateUi("Tracking Status:")}</span>
            <strong className="oc-capitalize">{String(order.status) || translateUi("Pending")}</strong>
          </li>
          <li>
            <span>{translateUi("Date:")}</span>
            <strong>{new Date(String(order.createdAt)).toLocaleDateString(getLocale())}</strong>
          </li>
          <li>
            <span>{translateUi("Total:")}</span>
            <strong>${Number(order.totalAmount).toFixed(2)}</strong>
          </li>
          <li>
            <span>{translateUi("Payment method:")}</span>
            <strong>{paymentLabel}</strong>
          </li>
        </ul>

        <div className="order-tracking-panel">
          <h3 className="tracking-header">{translateUi("Order Status")}</h3>

          <div className="tracking-timeline" ref={timelineRef}>
            {!isCancelled ? (
              <>
                {['pending', 'confirmed', 'shipping', 'delivered'].map((step, index) => {
                  const isActive = index === currentStepIndex;
                  const isCompleted = index < currentStepIndex;
                  let wrapperClass = 'step-icon-wrapper';
                  let titleClass = 'step-title';

                  if (isActive) {
                    wrapperClass += ' active';
                    titleClass += ' active';
                  } else if (isCompleted) {
                    wrapperClass += ' completed';
                    titleClass += ' completed';
                  }

                  return (
                    <div key={step} className="tracking-step">
                      <div className={wrapperClass}>
                        {renderIcon(step)}
                      </div>
                      <div className={titleClass}>{mapStatusToTitle(step)}</div>
                      <div className="step-time">
                        {isCompleted && index === 0 ? new Date(String(order.createdAt)).toLocaleDateString(getLocale()) : ''}
                        {isCompleted && index === currentStepIndex - 1 ? translateUi("Completed") : ''}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="order-cancelled-banner">{translateUi("Order Cancelled")}</div>
            )}
          </div>

          <div className="tracking-cards">
            <div className="tracking-card">
              <div className="card-heading">
                <Truck size={16} />{translateUi("Delivery Info")}</div>
              <div className="card-content">
                <strong>{String(order.shippingMethod?.name || translateUi("Configured shipping"))}</strong>
                <p>{shippingCost === 0 ? translateUi("Free shipping applied") : translateUi("Shipping fee: ${{value1}}", { value1: shippingCost.toFixed(2) })}</p>
                <div className="card-divider"></div>
                <p className="tracking-caption">{translateUi("Destination matching and shipping fee are calculated from the admin shipping rules used at checkout.")}</p>
              </div>
            </div>

            <div className="tracking-card">
              <div className="card-heading">
                <Box size={16} />{translateUi("Shipping Address")}</div>
              <div className="card-content">
                <strong>{String(order.shippingName || translateUi("N/A"))}</strong>
                <p>{String(order.shippingPhone || translateUi("N/A"))}</p>
                <p>
                  {[
                    order.shippingStreet,
                    order.shippingWard,
                    order.shippingDistrict,
                    order.shippingProvince,
                  ].filter(Boolean).join(', ') || translateUi("N/A")}
                </p>
              </div>
            </div>

            <div className="tracking-card">
              <div className="card-heading">
                <Info size={16} />{translateUi("Payment Info")}</div>
              <div className="card-content">
                <strong>{paymentLabel}</strong>
                <p>{paymentStatusText}</p>
                <p className="cod-text">
                  {order.paymentMethod === 'BANK_TRANSFER'
                    ? order.bankTransferImage ? translateUi("Transfer proof received.") : translateUi("Upload your transfer proof below.")
                    : order.paymentMethod === 'MOMO'
                      ? (order.paymentStatus === 'PAID' ? translateUi("Momo payment completed.") : translateUi("Payment pending in Momo."))
                      : order.paymentMethod === 'STRIPE'
                        ? (order.paymentStatus === 'PAID' ? translateUi("Stripe payment completed.") : translateUi("Payment pending in Stripe Checkout."))
                      : translateUi("Payment will be collected on delivery.")}
                </p>
              </div>
            </div>
          </div>

          {order.paymentMethod === 'BANK_TRANSFER' && order.status !== 'CANCELLED' && (
            <div className="order-action-panel">
              <div className="order-action-copy">
                <h3>{translateUi("Bank Transfer Proof")}</h3>
                <p>{translateUi("Upload your transfer receipt to help the admin team verify payment faster.")}</p>
              </div>
              {order.bankTransferImage ? (
                <div className="payment-proof-preview">
                  <img src={bankTransferProofUrl} alt={translateUi("Bank transfer proof")} />
                </div>
              ) : null}
              <div className="order-proof-upload-row">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  title={translateUi("Upload bank transfer proof")}
                  aria-label={translateUi("Upload bank transfer proof")}
                />
                <button type="button" className="btn btn-outline" onClick={handleUploadProof} disabled={isUploadingProof}>
                  {isUploadingProof ? translateUi("Uploading...") : order.bankTransferImage ? translateUi("Replace Proof") : translateUi("Upload Proof")}
                </button>
              </div>
            </div>
          )}

          {order.paymentMethod === 'MOMO' && order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED' && (
            <div className="order-action-panel">
              <div className="order-action-copy">
                <h3>{translateUi("Complete Momo Payment")}</h3>
                <p>{translateUi("Your order is created but still unpaid. Retry the Momo redirect to complete payment for this order.")}</p>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleRetryMomoPayment} disabled={isRetryingPayment}>
                <CreditCard size={16} /> {isRetryingPayment ? translateUi("Opening Momo...") : translateUi("Retry Momo Payment")}
              </button>
            </div>
          )}

          {order.paymentMethod === 'STRIPE' && order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED' && (
            <div className="order-action-panel">
              <div className="order-action-copy">
                <h3>{translateUi("Complete Stripe Payment")}</h3>
                <p>{translateUi("Your order is created but still unpaid. Open Stripe Checkout again to complete card payment.")}</p>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleRetryStripePayment} disabled={isRetryingPayment}>
                <CreditCard size={16} /> {isRetryingPayment ? translateUi("Opening Stripe...") : translateUi("Retry Stripe Payment")}
              </button>
            </div>
          )}
        </div>

        {order.statusHistory && order.statusHistory.length > 0 && (
          <div className="status-history-section" style={{ marginTop: '40px', marginBottom: '40px' }}>
            <h3 className="tracking-header" style={{ marginBottom: '24px' }}>{translateUi("Detailed Order Journey")}</h3>
            <div className="premium-timeline">
              {order.statusHistory.map((item: any, index: number) => {
                const isLast = index === order.statusHistory.length - 1;
                const itemStatus = String(item.status).toLowerCase();

                let statusClass = 'completed';
                if (itemStatus === 'cancelled') statusClass = 'cancelled';
                else if (isLast && order.status !== 'DELIVERED') statusClass = 'active';

                return (
                  <div
                    key={item.id}
                    className={`premium-timeline-item ${statusClass}`}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    <div className="premium-timeline-badge">
                      {itemStatus === 'pending' && <Clock size={12} />}
                      {itemStatus === 'confirmed' && <Box size={12} />}
                      {itemStatus === 'shipping' && <Truck size={12} />}
                      {itemStatus === 'delivered' && <CheckCircle2 size={12} />}
                      {itemStatus === 'cancelled' && <span style={{ fontSize: '10px', fontWeight: 'bold' }}>✕</span>}
                    </div>
                    <div className="premium-timeline-content">
                      <div className="premium-timeline-header">
                        <span className="premium-timeline-title">
                          {itemStatus === 'pending' ? translateUi("Order Placed") : itemStatus}
                        </span>
                        <span className="premium-timeline-time">
                          {new Date(item.createdAt).toLocaleString(getLocale())}
                        </span>
                      </div>
                      {item.note && (
                        <div className="premium-timeline-note">
                          {item.note}
                        </div>
                      )}
                      {item.user && (
                        <div className="premium-timeline-actor">{translateUi("Updated by")}{item.user.fullName}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="oc-details">
          <h2>{translateUi("Order details")}</h2>
          <table className="oc-table">
            <thead>
              <tr>
                <th>{translateUi("Product")}</th>
                <th>{translateUi("Total")}</th>
              </tr>
            </thead>
            <tbody>
              {(order.items as Record<string, unknown>[]).map((item) => (
                <tr key={String(item.id)}>
                  <td>
                    {String(item.productName)} <strong>{translateUi("×")} {String(item.quantity)}</strong>
                  </td>
                  <td>${Number(item.totalPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>{translateUi("Subtotal:")}</th>
                <td>${Number(order.subtotal).toFixed(2)}</td>
              </tr>
              {shippingCost > 0 && (
                <tr>
                  <th>{translateUi("Shipping:")}</th>
                  <td>${shippingCost.toFixed(2)}</td>
                </tr>
              )}
              {Number(order.discountAmount) > 0 && (
                <tr>
                  <th>{translateUi("Discount:")}</th>
                  <td>-${Number(order.discountAmount).toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <th>{translateUi("Total:")}</th>
                <td><strong>${Number(order.totalAmount).toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="oc-actions">
          <Link to="/account/orders" className="btn btn-outline oc-action-link">
            <Package size={20} />{translateUi("View All Orders")}</Link>
          {canCancelOrder(order) && (
            <button type="button" className="btn btn-outline" onClick={handleCancelOrder} disabled={isCancelling}>
              {isCancelling ? translateUi("Cancelling...") : translateUi("Cancel Order")}
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={handleReorder} disabled={isReordering}>
            {isReordering ? translateUi("Adding...") : translateUi("Buy Again")}
          </button>
          <Link to="/" className="btn btn-primary">{translateUi("Continue Shopping")}</Link>
        </div>
      </div>
    </div>
  );
}
