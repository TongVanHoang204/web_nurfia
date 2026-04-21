import { Link } from 'react-router-dom';
import { Minus, Plus, X, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import './CartPage.css';

const API_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000';

export default function CartPage() {
  const { items, updateQuantity, removeItem, getSubtotal, isLoading } = useCartStore();
  const { isAuthenticated, user } = useAuthStore();
  const canCheckout = user?.role === 'CUSTOMER';

  if (!isAuthenticated) {
    return (
      <div className="cart-page">
        <div className="container">
          <div className="cart-empty-page">
            <ShoppingBag size={64} strokeWidth={1} />
            <h2>Please login to view your cart</h2>
            <Link to="/login" className="btn btn-primary">Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <div className="container">
          <div className="cart-empty-page">
            <ShoppingBag size={64} strokeWidth={1} />
            <h2>Your Cart is Empty</h2>
            <p>Looks like you haven't added anything yet.</p>
            <Link to="/category/women" className="btn btn-primary">Start Shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const shipping = subtotal >= 500 ? 0 : 15;
  const total = subtotal + shipping;

  return (
    <div className="cart-page">
      <div className="container">
        <h1 className="cart-page-title">Shopping Cart</h1>
        <div className="cart-layout">
          <div className="cart-items-list">
            <div className="cart-table-header">
              <span className="col-product">Product</span>
              <span className="col-price">Price</span>
              <span className="col-qty">Quantity</span>
              <span className="col-total">Total</span>
              <span className="col-remove"></span>
            </div>
            {items.map((item) => {
              const price = item.variant?.salePrice ?? item.variant?.price ?? item.product.salePrice ?? item.product.price;
              const variantInfo = item.variant?.attributes?.map(a => `${a.attributeValue.attribute.name}: ${a.attributeValue.value}`).join(' / ');
              const imgUrl = item.product.images[0]?.url || '';
              return (
                <div key={item.id} className="cart-table-row">
                  <div className="col-product">
                    <div className="cart-product-img">
                      <img
                        src={imgUrl.startsWith('http') ? imgUrl : `${API_URL}${imgUrl}`}
                        alt={item.product.name}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x130/f5f5f5/999?text=img'; }}
                      />
                    </div>
                    <div className="cart-product-info">
                      <Link to={`/product/${item.product.slug}`} className="cart-product-name">{item.product.name}</Link>
                      <p className="cart-product-mobile-price">${Number(price).toFixed(2)}</p>
                      {variantInfo && <p className="cart-product-variant">{variantInfo}</p>}
                    </div>
                  </div>
                  <div className="col-price">${Number(price).toFixed(2)}</div>
                  <div className="col-qty">
                    <div className="cart-qty">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={isLoading}
                        title="Decrease quantity"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={isLoading}
                        title="Increase quantity"
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="col-total">${(Number(price) * item.quantity).toFixed(2)}</div>
                  <div className="col-remove">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="remove-btn"
                      title="Remove item"
                      aria-label="Remove item"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cart-summary">
            <h3>Order Summary</h3>
            <div className="summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="summary-row">
              <span>Shipping</span>
              <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
            </div>
            {shipping > 0 && <p className="free-ship-note">Free shipping on orders over $500</p>}
            <div className="summary-divider" />
            <div className="summary-row summary-total"><span>Total</span><span>${total.toFixed(2)}</span></div>
            {canCheckout ? (
              <Link to="/checkout" className="btn btn-primary cart-checkout-btn">Proceed to Checkout</Link>
            ) : (
              <>
                <button type="button" className="btn btn-primary cart-checkout-disabled-btn" disabled>Proceed to Checkout</button>
                <p className="cart-role-note">Only customer accounts can place orders.</p>
              </>
            )}
            <Link to="/category/all" className="btn btn-outline cart-continue-btn">Continue Shopping</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
