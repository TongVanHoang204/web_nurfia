import './Footer.css';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';
import { useState } from 'react';
import api from '../../api/client';
import { useUIStore } from '../../stores/uiStore';
import { resolveExternalUrl, resolveSiteAssetUrl, useSiteSettings } from '../../contexts/SiteSettingsContext';

const FacebookIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>;
const InstagramIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>;
const TwitterIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;

export default function Footer() {
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { addToast } = useUIStore();
  const { settings } = useSiteSettings();

  const siteName = settings.siteName || 'Nurfia';
  const siteDescription = settings.siteDescription || settings.tagline || 'Discover the latest in fashion trends. Premium quality clothing for women and men, curated with elegance and style.';
  const footerEmail = settings.email || 'contact@nurfia.com';
  const footerPhone = settings.phone || '+1 234 567 890';
  const footerAddress = settings.address || '123 Fashion Street, New York, NY 10001';
  const logoUrl = resolveSiteAssetUrl(settings.logoUrl || '') || '/assets/images/logo-dark.png';
  const facebookUrl = resolveExternalUrl(settings.facebook || '', 'https://facebook.com');
  const instagramUrl = resolveExternalUrl(settings.instagram || '', 'https://instagram.com');
  const twitterUrl = resolveExternalUrl(settings.twitter || '', 'https://twitter.com');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubscribing(true);
    try {
      const { data } = await api.post('/contact/newsletter', { email });
      const message = String(data?.message || 'Subscribed successfully!');
      addToast(message, /already subscribed/i.test(message) ? 'info' : 'success');
      setEmail('');
    } catch (error: any) {
      addToast(error.response?.data?.error || 'Failed to subscribe', 'error');
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <footer className="site-footer">
      <div className="footer-newsletter">
        <div className="container">
          <div className="newsletter-inner">
            <div className="newsletter-text">
              <h3>Subscribe To Our Newsletter</h3>
              <p>Get the latest updates on new products and upcoming sales</p>
            </div>
            <form className="newsletter-form" onSubmit={handleSubscribe}>
              <input type="email" placeholder="Your email address" className="newsletter-input" required value={email} onChange={e => setEmail(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={isSubscribing}>{isSubscribing ? 'Subscribing...' : 'Subscribe'}</button>
            </form>
          </div>
        </div>
      </div>

      <div className="footer-widgets">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <img src={logoUrl} alt={siteName} className="footer-logo-img" />
              <p className="footer-about">{siteDescription}</p>
              <div className="footer-social">
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FacebookIcon /></a>
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><InstagramIcon /></a>
                <a href={twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="Twitter"><TwitterIcon /></a>
              </div>
            </div>
            <div className="footer-col">
              <h4 className="footer-title">Quick Links</h4>
              <ul className="footer-links">
                <li><Link to="/category/women">Women</Link></li>
                <li><Link to="/category/men">Men</Link></li>
                <li><Link to="/category/accessories">Accessories</Link></li>
                <li><Link to="/blog">Blog</Link></li>
                <li><Link to="/contact">Contact Us</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4 className="footer-title">Customer Service</h4>
              <ul className="footer-links">
                <li><Link to="/account">My Account</Link></li>
                <li><Link to="/account/orders">Order Tracking</Link></li>
                <li><Link to="/policy/shipping">Shipping Policy</Link></li>
                <li><Link to="/policy/returns">Returns & Exchanges</Link></li>
                <li><Link to="/policy/privacy">Privacy Policy</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4 className="footer-title">Contact Us</h4>
              <ul className="footer-contact">
                <li><MapPin size={16} /><span>{footerAddress}</span></li>
                <li><Phone size={16} /><span>{footerPhone}</span></li>
                <li><Mail size={16} /><span>{footerEmail}</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
          <div className="payment-methods">
            <img src="/assets/svg/payment.svg" alt="Visa" className="payment-icon-img" />
            <img src="/assets/svg/payment2.svg" alt="Mastercard" className="payment-icon-img" />
            <img src="/assets/svg/payment3.svg" alt="PayPal" className="payment-icon-img" />
            <img src="/assets/svg/payment4.svg" alt="Apple Pay" className="payment-icon-img" />
          </div>
        </div>
      </div>
    </footer>
  );
}
