import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useCartStore } from '../../stores/cartStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { resolveSiteAssetUrl } from '../../contexts/SiteSettingsContext';
import './CheckoutPage.css';

type ShippingOption = {
  id: number;
  name: string;
  description?: string | null;
  cost: number;
  matchedZone?: string | null;
  freeShipMinOrder?: number | null;
};

type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'MOMO';

const paymentDescriptions: Record<PaymentMethod, { title: string; description: string }> = {
  COD: {
    title: 'Cash on Delivery (COD)',
    description: 'Pay when you receive your order.',
  },
  BANK_TRANSFER: {
    title: 'Bank Transfer',
    description: 'Upload your transfer proof after placing the order.',
  },
  MOMO: {
    title: 'Momo Wallet',
    description: 'You will be redirected to Momo to complete payment immediately.',
  },
};

export default function CheckoutPage() {
  const { items, getSubtotal, resetCart } = useCartStore();
  const { addToast } = useUIStore();
  const { isAuthenticated, isHydrating, user } = useAuthStore();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [couponCodeApplied, setCouponCodeApplied] = useState('');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<number | null>(null);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [form, setForm] = useState({
    shippingName: '',
    shippingPhone: '',
    shippingEmail: '',
    shippingProvince: '',
    shippingDistrict: '',
    shippingWard: '',
    shippingStreet: '',
    paymentMethod: 'COD' as PaymentMethod,
    couponCode: '',
    note: '',
  });

  const subtotal = getSubtotal();
  const selectedShippingOption = shippingOptions.find((option) => option.id === selectedShippingMethodId) || null;
  const shipping = selectedShippingOption?.cost ?? 0;
  const total = subtotal - discount + shipping;

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const isCustomerRole = user?.role === 'CUSTOMER';
  const hasSubmittedOrderRef = useRef(false);

  useEffect(() => {
    if (isHydrating) {
      return;
    }

    if (!isAuthenticated) {
      addToast('Please login to continue checkout.', 'info');
      navigate('/login?redirect=/checkout');
      return;
    }

    if (user && !isCustomerRole) {
      addToast('Only customer accounts can place orders.', 'error');
      navigate('/');
      return;
    }

    if (items.length === 0 && !hasSubmittedOrderRef.current) {
      addToast('Your cart is empty.', 'info');
      navigate('/cart');
      return;
    }

    api.get('/settings').then((res) => {
      if (res.data.success || res.status === 200) {
        setSettings(res.data.data || {});
      }
    }).catch((err) => console.error('Failed to load settings', err));

    api.get('/addresses').then((res) => {
      if (res.data.success || res.status === 200) {
        setSavedAddresses(res.data.data || []);
      }
    }).catch((err) => console.error('Failed to load addresses', err));
  }, [isAuthenticated, isCustomerRole, isHydrating, user, items.length, navigate, addToast]);

  // Auto-fill shipping name, phone, email from user profile if available
  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      shippingName: prev.shippingName || user.fullName || '',
      shippingPhone: prev.shippingPhone || user.phone || '',
      shippingEmail: prev.shippingEmail || user.email || '',
    }));
  }, [user]);

  useEffect(() => {
    fetchShippingOptions();
  }, [subtotal, form.shippingProvince, form.shippingDistrict, form.shippingWard]);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const fetchShippingOptions = async () => {
    if (!form.shippingProvince.trim() || !form.shippingDistrict.trim() || !form.shippingWard.trim() || items.length === 0) {
      setShippingOptions([]);
      setSelectedShippingMethodId(null);
      setShippingError('');
      return;
    }

    setIsLoadingShipping(true);
    setShippingError('');
    try {
      const { data } = await api.post('/orders/shipping-options', {
        shippingProvince: form.shippingProvince,
        shippingDistrict: form.shippingDistrict,
        shippingWard: form.shippingWard,
      });

      const options = data.data?.options || [];
      setShippingOptions(options);
      setSelectedShippingMethodId((current) => {
        if (current && options.some((option: ShippingOption) => option.id === current)) {
          return current;
        }
        return data.data?.recommendedMethodId ?? options[0]?.id ?? null;
      });
      if (options.length === 0) {
        setShippingError('No shipping method is available for this address yet.');
      }
    } catch (err: any) {
      setShippingOptions([]);
      setSelectedShippingMethodId(null);
      setShippingError(err.response?.data?.message || 'Failed to load shipping methods.');
    } finally {
      setIsLoadingShipping(false);
    }
  };

  const handleSelectAddress = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const addressId = parseInt(e.target.value, 10);
    if (!addressId) return;
    const address = savedAddresses.find((item) => item.id === addressId);
    if (!address) return;

    setForm((prev) => ({
      ...prev,
      shippingName: address.fullName,
      shippingPhone: address.phone,
      shippingProvince: address.province,
      shippingDistrict: address.district,
      shippingWard: address.ward,
      shippingStreet: address.streetAddress,
    }));
  };

  const handleApplyCoupon = async () => {
    if (!form.couponCode.trim()) {
      addToast('Please enter a coupon code.', 'error');
      return;
    }
    try {
      const { data } = await api.post('/orders/validate-coupon', {
        code: form.couponCode,
        subtotal,
      });
      setDiscount(data.data.discount);
      setCouponCodeApplied(form.couponCode.trim());
      addToast('Coupon applied successfully!', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.message || err.response?.data?.error || 'Invalid coupon.', 'error');
      setDiscount(0);
      setCouponCodeApplied('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCustomerRole) {
      addToast('Only customer accounts can place orders.', 'error');
      return;
    }

    if (items.length === 0) {
      addToast('Your cart is empty', 'error');
      return;
    }

    if (!form.shippingPhone.trim().match(/^\+?\d{9,15}$/)) {
      addToast('Please enter a valid phone number', 'error');
      return;
    }
    if (!form.shippingName.trim() || !form.shippingProvince.trim() || !form.shippingDistrict.trim() || !form.shippingWard.trim() || !form.shippingStreet.trim()) {
      addToast('Please fill in all required shipping fields', 'error');
      return;
    }
    if (!selectedShippingMethodId) {
      addToast('Please select a shipping method', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        couponCode: couponCodeApplied,
        shippingMethodId: selectedShippingMethodId,
      };
      const { data } = await api.post('/orders', payload);
      const createdOrder = data.data;
      hasSubmittedOrderRef.current = true;
      resetCart();

      if (payload.paymentMethod === 'MOMO') {
        try {
          const paymentRes = await api.post('/payment/momo/create', {
            orderId: createdOrder.id,
            redirectUrl: `${window.location.origin}/order-confirmation/${createdOrder.id}`,
          });
          const payUrl = paymentRes.data.data?.payUrl || paymentRes.data.data?.deeplink;
          if (!payUrl) {
            throw new Error('Missing Momo payment URL.');
          }
          window.location.href = payUrl;
          return;
        } catch (paymentError: any) {
          addToast(paymentError.response?.data?.error || 'Order created, but Momo redirect failed. Please retry payment from the order page.', 'error');
          navigate(`/order-confirmation/${createdOrder.id}`);
          return;
        }
      }

      addToast('Order placed successfully!', 'success');
      navigate(`/order-confirmation/${createdOrder.id}`);
    } catch (err: any) {
      addToast(err.response?.data?.message || err.response?.data?.error || 'Failed to place order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isHydrating) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  return (
    <div className="checkout-page">
      <div className="container">
        <h1 className="checkout-title">Checkout</h1>
        <form onSubmit={handleSubmit} className="checkout-layout">
          <div className="checkout-form">
            <h3 className="checkout-section-title">Shipping Information</h3>

            {savedAddresses.length > 0 && (
              <div className="form-group saved-addresses-selector">
                <label className="form-label" htmlFor="savedAddress">Select a Saved Address</label>
                <select
                  id="savedAddress"
                  className="form-input"
                  onChange={handleSelectAddress}
                  defaultValue=""
                >
                  <option value="" disabled>-- Choose an address --</option>
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.fullName} - {address.phone} ({address.streetAddress}, {address.ward}, {address.district}, {address.province})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-row">
              <div className="form-group"><label className="form-label" htmlFor="shippingName">Full Name *</label><input id="shippingName" title="Full Name" placeholder="Jon Doe" className="form-input" required value={form.shippingName} onChange={(e) => update('shippingName', e.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="shippingPhone">Phone Number *</label><input id="shippingPhone" title="Phone Number" placeholder="+1234567890" className="form-input" required value={form.shippingPhone} onChange={(e) => update('shippingPhone', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label" htmlFor="shippingEmail">Email Address *</label><input id="shippingEmail" title="Email Address" placeholder="doe@example.com" className="form-input" type="email" required value={form.shippingEmail} onChange={(e) => update('shippingEmail', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label" htmlFor="shippingProvince">Province/City *</label><input id="shippingProvince" title="Province/City" placeholder="Ho Chi Minh City" className="form-input" required value={form.shippingProvince} onChange={(e) => update('shippingProvince', e.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="shippingDistrict">District *</label><input id="shippingDistrict" title="District" placeholder="District 1" className="form-input" required value={form.shippingDistrict} onChange={(e) => update('shippingDistrict', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label" htmlFor="shippingWard">Ward *</label><input id="shippingWard" title="Ward" placeholder="Ben Nghe" className="form-input" required value={form.shippingWard} onChange={(e) => update('shippingWard', e.target.value)} /></div>
              <div className="form-group"><label className="form-label" htmlFor="shippingStreet">Street Address *</label><input id="shippingStreet" title="Street Address" placeholder="123 Main St" className="form-input" required value={form.shippingStreet} onChange={(e) => update('shippingStreet', e.target.value)} /></div>
            </div>

            <div className="form-group">
              <label className="form-label">Shipping Method *</label>
              {!form.shippingProvince.trim() || !form.shippingDistrict.trim() || !form.shippingWard.trim() ? (
                <div className="shipping-hint-box">Enter province, district, and ward to load shipping methods.</div>
              ) : isLoadingShipping ? (
                <div className="shipping-hint-box">Loading shipping methods...</div>
              ) : shippingError ? (
                <div className="shipping-hint-box shipping-hint-box-error">{shippingError}</div>
              ) : (
                <div className="payment-methods-list shipping-methods-list">
                  {shippingOptions.map((option) => (
                    <label key={option.id} className={`payment-option ${selectedShippingMethodId === option.id ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="shippingMethod"
                        value={option.id}
                        checked={selectedShippingMethodId === option.id}
                        onChange={() => setSelectedShippingMethodId(option.id)}
                      />
                      <div className="payment-option-content">
                        <div className="shipping-option-header">
                          <strong>{option.name}</strong>
                          <span>{option.cost === 0 ? 'Free' : `$${option.cost.toFixed(2)}`}</span>
                        </div>
                        {option.description && <p>{option.description}</p>}
                        <p className="shipping-option-meta">
                          {option.matchedZone ? `Applies to: ${option.matchedZone}` : 'Default shipping rule'}
                          {option.freeShipMinOrder ? ` | Free from $${option.freeShipMinOrder.toFixed(2)}` : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group"><label className="form-label" htmlFor="note">Order Notes (Optional)</label><textarea id="note" title="Order Notes" className="form-input" rows={3} value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Special instructions for delivery..." /></div>

            <h3 className="checkout-section-title mt-4">Payment Method</h3>
            <div className="payment-methods-list">
              {(Object.keys(paymentDescriptions) as PaymentMethod[]).map((method) => (
                <label key={method} className={`payment-option ${form.paymentMethod === method ? 'active' : ''}`}>
                  <input type="radio" name="payment" value={method} checked={form.paymentMethod === method} onChange={() => update('paymentMethod', method)} />
                  <div className="payment-option-content">
                    <strong>{paymentDescriptions[method].title}</strong>
                    <p>{paymentDescriptions[method].description}</p>
                  </div>
                </label>
              ))}
            </div>

            {form.paymentMethod === 'BANK_TRANSFER' && (
              <div className="bank-info">
                <div className="bank-info-copy">
                  <h4>Bank Account Details</h4>
                  <p>Bank: {settings.bankName || 'Vietcombank'}</p>
                  <p>Account: {settings.accountNumber || '1234567890'}</p>
                  <p>Name: {settings.accountOwner || 'NURFIA FASHION CO., LTD'}</p>
                  <p>Transfer content: the order number shown after checkout</p>
                  <p className="payment-help-text">You can upload payment proof right after the order is created.</p>
                </div>
                {settings.qrCodeUrl && (
                  <div className="bank-qr-box">
                    <img src={resolveSiteAssetUrl(settings.qrCodeUrl || '')} alt="Bank QR" className="bank-qr-image" />
                  </div>
                )}
              </div>
            )}

            {form.paymentMethod === 'MOMO' && (
              <div className="payment-help-panel">
                Your order will be created first, then you will be redirected to Momo to finish payment. If the redirect fails, the order remains pending and you can retry from the order page.
              </div>
            )}
          </div>

          <div className="checkout-summary">
            <h3>Order Summary</h3>
            <div className="checkout-items">
              {items.map((item) => {
                const price = item.variant?.salePrice ?? item.variant?.price ?? item.product.salePrice ?? item.product.price;
                return (
                  <div key={item.id} className="checkout-item">
                    <span className="checkout-item-name">{item.product.name} × {item.quantity}</span>
                    <span>${(Number(price) * item.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div className="summary-divider" />
            <div className="form-group"><label className="form-label" htmlFor="couponCode">Coupon Code</label>
              <div className="coupon-input-group">
                <input id="couponCode" title="Coupon Code" className="form-input coupon-input" placeholder="Enter code" value={form.couponCode} onChange={(e) => update('couponCode', e.target.value)} />
                <button type="button" className="btn btn-outline apply-coupon-btn" onClick={handleApplyCoupon}>Apply</button>
              </div>
            </div>
            <div className="summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {discount > 0 && <div className="summary-row discount-row"><span>Discount ({couponCodeApplied})</span><span>-${discount.toFixed(2)}</span></div>}
            <div className="summary-row">
              <span>Shipping{selectedShippingOption ? ` (${selectedShippingOption.name})` : ''}</span>
              <span>{selectedShippingOption ? (shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`) : 'Select method'}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-row summary-total"><span>Total</span><span>${total.toFixed(2)}</span></div>
            <button type="submit" className="btn btn-primary submit-order-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : form.paymentMethod === 'MOMO' ? 'Continue to Momo' : 'Place Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
