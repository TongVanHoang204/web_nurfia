import { Link } from 'react-router-dom';
import { X, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import './CartDrawer.css';

const API_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000';

export default function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, getSubtotal, isLoading } = useCartStore();
  const { user } = useAuthStore();
  const canCheckout = user?.role === 'CUSTOMER';

  return (
    <>
      <div className={`overlay ${isOpen ? 'active' : ''}`} onClick={closeCart} />
      <div className={`drawer cart-drawer ${isOpen ? 'active' : ''}`}>
        <div className="drawer-header">
          <h3><ShoppingBag size={20} /> Shopping Cart ({items.length})</h3>
          <button className="drawer-close" onClick={closeCart} title="Close cart" aria-label="Close cart"><X size={20} /></button>
        </div>

        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <ShoppingBag size={48} strokeWidth={1} />
              <p>Your cart is empty</p>
              <Link to="/category/women" className="btn btn-primary" onClick={closeCart}>Start Shopping</Link>
            </div>
          ) : (
            <div className="cart-items">
              {items.map((item) => {
                const price = item.variant?.salePrice ?? item.variant?.price ?? item.product.salePrice ?? item.product.price;
                const variantInfo = item.variant?.attributes?.map(a => `${a.attributeValue.attribute.name}: ${a.attributeValue.value}`).join(', ');
                const imgUrl = item.product.images[0]?.url || '';
                return (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-image">
                      <img
                        src={imgUrl.startsWith('http') ? imgUrl : `${API_URL}${imgUrl}`}
                        alt={item.product.name}
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/80x100/f5f5f5/999?text=img`; }}
                      />
                    </div>
                    <div className="cart-item-info">
                      <Link to={`/product/${item.product.slug}`} className="cart-item-name" onClick={closeCart}>
                        {item.product.name}
                      </Link>
                      {variantInfo && <p className="cart-item-variant">{variantInfo}</p>}
                      <div className="cart-item-bottom">
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
                        <span className="cart-item-price">${(Number(price) * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                    <button className="cart-item-remove" onClick={() => removeItem(item.id)} title="Remove item" aria-label="Remove item">
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="drawer-footer">
            <div className="cart-subtotal">
              <span>Subtotal</span>
              <strong>${getSubtotal().toFixed(2)}</strong>
            </div>
            <Link to="/cart" className="btn btn-outline" style={{ width: '100%', marginBottom: 8 }} onClick={closeCart}>
              View Cart
            </Link>
            {canCheckout ? (
              <Link to="/checkout" className="btn btn-primary" style={{ width: '100%' }} onClick={closeCart}>
                Checkout
              </Link>
            ) : (
              <>
                <button type="button" className="btn btn-primary cart-drawer-checkout-disabled-btn" disabled>
                  Checkout
                </button>
                <p className="cart-drawer-role-note">Only customer accounts can place orders.</p>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
