import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { User, Package, Heart, MapPin, LogOut, ShieldCheck } from 'lucide-react';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useWishlistStore } from '../../stores/wishlistStore';
import { useCartStore } from '../../stores/cartStore';
import { useUIStore } from '../../stores/uiStore';
import ProductCard from '../../components/ProductCard/ProductCard';
import './AccountPage.css';

const getPaymentLabel = (method: string) => {
  if (method === 'BANK_TRANSFER') return 'Bank Transfer';
  if (method === 'MOMO') return 'Momo';
  return 'Cash on Delivery';
};

const canCancelOrder = (order: any) => ['PENDING', 'CONFIRMED'].includes(order.status) && order.paymentStatus !== 'PAID';

export default function AccountPage() {
  const { user, logout, isAuthenticated, isHydrating } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isHydrating && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, isHydrating, navigate]);

  const handleLogout = () => logout();

  if (isHydrating) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  return (
    <div className="account-page">
      <div className="container">
        <h1 className="account-title">My Account</h1>
        <div className="account-layout">
          <div className="account-user-card">
            <div className="account-user-info">
              <div className="account-avatar">{user?.fullName?.[0]}</div>
              <div className="account-details">
                <strong>{user?.fullName}</strong>
                <p>{user?.email}</p>
              </div>
            </div>
            <nav className="account-nav">
              <Link to="/account" className="account-nav-link"><User size={16} /> Profile</Link>
              <Link to="/account/orders" className="account-nav-link"><Package size={16} /> Orders</Link>
              <Link to="/account/wishlist" className="account-nav-link"><Heart size={16} /> Wishlist</Link>
              <Link to="/account/addresses" className="account-nav-link"><MapPin size={16} /> Addresses</Link>
              <button className="account-nav-link logout-btn" onClick={handleLogout}><LogOut size={16} /> Sign Out</button>
            </nav>
          </div>
          <div className="account-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileSection() {
  const { user, loadUser } = useAuthStore();
  const { addToast } = useUIStore();
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpNotice, setOtpNotice] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSendingPasswordOtp, setIsSendingPasswordOtp] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const stripWhitespace = (value: string) => value.replace(/\s+/g, '');

  const resetOtpState = () => {
    setOtpRequested(false);
    setOtpCode('');
    setOtpNotice('');
  };

  const validatePasswordPayload = () => {
    if (!passwordForm.currentPassword) {
      addToast('Current password is required.', 'error');
      return false;
    }
    if (passwordForm.newPassword.length < 6) {
      addToast('New password must be at least 6 characters.', 'error');
      return false;
    }
    if (/\s/.test(passwordForm.newPassword)) {
      addToast('New password cannot contain spaces.', 'error');
      return false;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast('Password confirmation does not match.', 'error');
      return false;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      addToast('New password must be different from current password.', 'error');
      return false;
    }
    return true;
  };

  useEffect(() => {
    setProfileForm({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
    });
  }, [user?.fullName, user?.phone]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await api.put('/auth/profile', profileForm);
      await loadUser();
      addToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRequestPasswordOtp = async () => {
    if (!validatePasswordPayload()) {
      return;
    }

    setIsSendingPasswordOtp(true);
    try {
      const { data } = await api.post('/auth/change-password/request-otp', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      const responseData = data?.data || {};
      setOtpRequested(true);
      setOtpNotice(responseData.message || 'OTP has been sent to your email.');
      addToast(responseData.message || 'OTP sent to your email.', 'success');
    } catch (err: any) {
      setOtpRequested(false);
      setOtpCode('');
      setOtpNotice('');
      addToast(err.response?.data?.error || 'Failed to send OTP.', 'error');
    } finally {
      setIsSendingPasswordOtp(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordPayload()) {
      return;
    }
    if (!otpRequested) {
      addToast('Please request OTP before updating password.', 'error');
      return;
    }
    if (!/^\d{6}$/.test(otpCode)) {
      addToast('OTP must be a 6-digit code.', 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.post('/auth/change-password/confirm-otp', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        otp: otpCode,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      resetOtpState();
      addToast('Password changed successfully!', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to change password', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div>
      <h2 className="account-section-title">Profile Information</h2>
      <div className="form-row">
        <div className="form-group"><label className="form-label" htmlFor="profile-username">Username</label><input id="profile-username" className="form-input" value={user?.username || ''} disabled /></div>
        <div className="form-group"><label className="form-label" htmlFor="profile-fullname">Full Name</label><input id="profile-fullname" className="form-input" value={profileForm.fullName} onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))} /></div>
      </div>
      <div className="form-group"><label className="form-label" htmlFor="profile-phone">Phone Number</label><input id="profile-phone" className="form-input" value={profileForm.phone} onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label" htmlFor="profile-email">Email</label><input id="profile-email" className="form-input" value={user?.email || ''} disabled /></div>
      <button className="btn btn-primary mt-2" onClick={handleSaveProfile} disabled={isSavingProfile}>{isSavingProfile ? 'Saving...' : 'Save Changes'}</button>

      <div className="account-password-panel">
        <div className="account-password-header">
          <ShieldCheck size={18} />
          <h3>Change Password</h3>
        </div>
        <form onSubmit={handleChangePassword} className="account-password-form">
          <div className="form-group"><label className="form-label" htmlFor="current-password">Current Password</label><input id="current-password" className="form-input" type="password" value={passwordForm.currentPassword} onChange={(e) => { resetOtpState(); setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value })); }} required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label" htmlFor="new-password">New Password</label><input id="new-password" className="form-input" type="password" value={passwordForm.newPassword} onChange={(e) => { resetOtpState(); setPasswordForm((prev) => ({ ...prev, newPassword: stripWhitespace(e.target.value) })); }} required minLength={6} /></div>
            <div className="form-group"><label className="form-label" htmlFor="confirm-password">Confirm New Password</label><input id="confirm-password" className="form-input" type="password" value={passwordForm.confirmPassword} onChange={(e) => { resetOtpState(); setPasswordForm((prev) => ({ ...prev, confirmPassword: stripWhitespace(e.target.value) })); }} required minLength={6} /></div>
          </div>

          {otpNotice && <p className="account-otp-notice">{otpNotice}</p>}

          <div className="form-group">
            <label className="form-label" htmlFor="password-otp">Email OTP</label>
            <input
              id="password-otp"
              className="form-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
              required
            />
          </div>

          <div className="account-password-actions">
            <button className="btn btn-outline" type="button" onClick={handleRequestPasswordOtp} disabled={isSendingPasswordOtp || isChangingPassword}>
              {isSendingPasswordOtp ? 'Sending OTP...' : (otpRequested ? 'Resend OTP' : 'Send OTP')}
            </button>
            <button className="btn btn-primary" type="submit" disabled={isChangingPassword || !otpRequested}>
              {isChangingPassword ? 'Updating...' : 'Verify OTP & Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function OrdersSection() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const { addToast } = useUIStore();
  const { fetchCart } = useCartStore();

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/orders');
      setOrders(response.data.data || []);
    } catch {
      addToast('Failed to load orders.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm('Cancel this order? Stock will be restored and the order cannot be resumed.')) {
      return;
    }

    setActiveOrderId(orderId);
    try {
      await api.post(`/orders/${orderId}/cancel`);
      addToast('Order cancelled successfully.', 'success');
      await fetchOrders();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Unable to cancel order.', 'error');
    } finally {
      setActiveOrderId(null);
    }
  };

  const handleReorder = async (orderId: number) => {
    setActiveOrderId(orderId);
    try {
      const response = await api.post(`/orders/${orderId}/reorder`);
      await fetchCart();
      const skippedCount = response.data.data?.skippedItems?.length || 0;
      addToast(skippedCount ? `Cart updated. ${skippedCount} item(s) could not be fully restored.` : 'Items added back to your cart.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Unable to reorder these items.', 'error');
    } finally {
      setActiveOrderId(null);
    }
  };

  if (isLoading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <h2 className="account-section-title">Order History</h2>
      {orders.length === 0 ? <p className="no-data">No orders yet.</p> : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-card-header">
                <div>
                  <strong>#{order.orderNumber}</strong>
                  <span className={`order-status status-${String(order.status).toLowerCase()}`}>{order.status}</span>
                </div>
                <div className="order-card-actions">
                  <span className="order-date">{new Date(order.createdAt).toLocaleDateString()}</span>
                  <Link to={`/order-confirmation/${order.id}`} className="btn btn-outline btn-view-order">View Order</Link>
                </div>
              </div>
              <div className="order-card-items">
                {order.items.map((item: any) => (
                  <div key={item.id} className="order-item-row">
                    <span>{item.productName} × {item.quantity}</span>
                    <span>${Number(item.totalPrice).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="order-card-footer">
                <span>Total: <strong>${Number(order.totalAmount).toFixed(2)}</strong></span>
                <span>Payment: {getPaymentLabel(order.paymentMethod)}</span>
              </div>
              <div className="order-card-cta-row">
                {canCancelOrder(order) && (
                  <button
                    type="button"
                    className="btn btn-outline btn-small-danger"
                    disabled={activeOrderId === order.id}
                    onClick={() => handleCancelOrder(order.id)}
                  >
                    {activeOrderId === order.id ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={activeOrderId === order.id}
                  onClick={() => handleReorder(order.id)}
                >
                  {activeOrderId === order.id ? 'Working...' : 'Buy Again'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WishlistSection() {
  const { items, isLoading } = useWishlistStore();

  return (
    <div>
      <h2 className="account-section-title">My Wishlist</h2>
      {isLoading ? (
        <p>Loading wishlist...</p>
      ) : items.length === 0 ? (
        <p className="no-data">Your wishlist is empty.</p>
      ) : (
        <div className="wishlist-grid">
          {items.map((item) => (
            <ProductCard key={item.productId} product={item.product as any} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AddressesSection() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useUIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    id: null as number | null,
    fullName: '',
    phone: '',
    province: '',
    district: '',
    ward: '',
    streetAddress: '',
    isDefault: false,
  });

  const fetchAddresses = async () => {
    try {
      const { data } = await api.get('/addresses');
      setAddresses(data.data);
    } catch {
      addToast('Failed to fetch addresses', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleEdit = (address: any) => {
    setForm({ ...address });
    setIsEditing(true);
  };

  const handleDelete = async (addressId: number, isDefault: boolean) => {
    if (isDefault) {
      addToast('Cannot delete default address. Please set another address as default first.', 'error');
      return;
    }
    if (!window.confirm('Delete this address?')) return;
    try {
      await api.delete(`/addresses/${addressId}`);
      addToast('Address deleted', 'success');
      fetchAddresses();
    } catch {
      addToast('Failed to delete', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const isDuplicate = addresses.some((address) =>
      address.id !== form.id
      && address.fullName.trim() === form.fullName.trim()
      && address.phone.trim() === form.phone.trim()
      && address.province.trim() === form.province.trim()
      && address.district.trim() === form.district.trim()
      && address.ward.trim() === form.ward.trim()
      && address.streetAddress.trim() === form.streetAddress.trim()
    );

    if (isDuplicate) {
      addToast('This address already exists in your account', 'error');
      return;
    }

    try {
      if (form.id) await api.put(`/addresses/${form.id}`, form);
      else await api.post('/addresses', form);
      addToast('Address saved', 'success');
      setIsEditing(false);
      setForm({ id: null, fullName: '', phone: '', province: '', district: '', ward: '', streetAddress: '', isDefault: false });
      fetchAddresses();
    } catch {
      addToast('Failed to save address', 'error');
    }
  };

  if (isLoading) return <div>Loading...</div>;

  if (isEditing) {
    return (
      <div>
        <h2 className="account-section-title">{form.id ? 'Edit Address' : 'Add New Address'}</h2>
        <form onSubmit={handleSave}>
          <div className="form-group"><label className="form-label" htmlFor="addr-fullName">Full Name</label><input id="addr-fullName" className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div className="form-group"><label className="form-label" htmlFor="addr-phone">Phone</label><input id="addr-phone" className="form-input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label" htmlFor="addr-province">Province</label><input id="addr-province" className="form-input" required value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></div>
            <div className="form-group"><label className="form-label" htmlFor="addr-district">District</label><input id="addr-district" className="form-input" required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label" htmlFor="addr-ward">Ward</label><input id="addr-ward" className="form-input" required value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} /></div>
            <div className="form-group"><label className="form-label" htmlFor="addr-streetAddress">Street</label><input id="addr-streetAddress" className="form-input" required value={form.streetAddress} onChange={(e) => setForm({ ...form, streetAddress: e.target.value })} /></div>
          </div>
          <label className="account-checkbox-row" htmlFor="addr-default">
            <input type="checkbox" id="addr-default" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            <span>Set as Default Address</span>
          </label>
          <div className="account-inline-actions">
            <button type="submit" className="btn btn-primary">Save Address</button>
            <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h2 className="account-section-title">Saved Addresses</h2>
      {addresses.length === 0 ? <p className="no-data">No saved addresses.</p> : (
        <div className="account-address-grid">
          {addresses.map((address) => (
            <div key={address.id} className="account-address-card">
              {address.isDefault && <span className="account-address-badge">Default</span>}
              <h4>{address.fullName} <span>{address.phone}</span></h4>
              <p>{address.streetAddress}</p>
              <p>{address.ward}, {address.district}, {address.province}</p>
              <div className="account-inline-actions">
                <button type="button" className="btn btn-outline" onClick={() => handleEdit(address)}>Edit</button>
                <button type="button" className="btn btn-outline btn-small-danger" onClick={() => handleDelete(address.id, address.isDefault)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-outline mt-2" onClick={() => {
        setForm({ id: null, fullName: '', phone: '', province: '', district: '', ward: '', streetAddress: '', isDefault: false });
        setIsEditing(true);
      }}>Add New Address</button>
    </div>
  );
}
