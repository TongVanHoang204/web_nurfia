import React, { useState } from 'react';
import { Package, Headphones, ShieldCheck, Award } from 'lucide-react';
import api from '../../api/client';
import { useUIStore } from '../../stores/uiStore';
import { useSiteSettings } from '../../contexts/SiteSettingsContext';
import './ContactPage.css';

export default function ContactPage() {
  const { addToast } = useUIStore();
  const { settings } = useSiteSettings();
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const siteName = settings.siteName || 'Nurfia';
  const siteDescription = settings.siteDescription || settings.tagline || 'Premium fashion support and store assistance.';
  const supportEmail = settings.email || 'contact@nurfia.com';
  const supportPhone = settings.phone || '+1 234 567 890';
  const supportAddress = settings.address || '123 Fashion Avenue, New York';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.subject.trim() || !form.email.trim()) {
      addToast('Name, Email, and Subject are required and cannot be empty', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/contact', form);
      addToast(data.message || 'Message sent successfully!', 'success');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to send message', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-page">
      <div className="container">
        <div className="contact-features">
          <div className="feature-item">
            <Package size={32} strokeWidth={1} />
            <div>
              <h3>World wide Delivery</h3>
              <p>Receive your order anywhere in the world</p>
            </div>
          </div>
          <div className="feature-item">
            <Headphones size={32} strokeWidth={1.5} />
            <div>
              <h3>Customer Service</h3>
              <p>Talk to our experts by chat or e-mail</p>
            </div>
          </div>
          <div className="feature-item">
            <ShieldCheck size={32} strokeWidth={1} />
            <div>
              <h3>Secure Payment</h3>
              <p>Don&apos;t worry, all orders are processed securely</p>
            </div>
          </div>
          <div className="feature-item">
            <Award size={32} strokeWidth={1} />
            <div>
              <h3>Loyalty Program</h3>
              <p>Collect points and enjoy a host of benefits!</p>
            </div>
          </div>
        </div>

        <div className="contact-divider" />

        <div className="contact-content">
          <div className="contact-left">
            <h2>Visit or Contact Us</h2>
            <p className="contact-desc">
              {siteDescription}
            </p>

            <div className="stores-info">
              <div className="store-block">
                <h4>{siteName.toUpperCase()}</h4>
                <h5>Head Office</h5>
                <p>{supportAddress}</p>
                <div className="store-contact">
                  <strong>{supportPhone}</strong>
                  <br />
                  <strong>{supportEmail}</strong>
                </div>
              </div>
              <div className="store-block">
                <h4>CUSTOMER SUPPORT</h4>
                <h5>Online Assistance</h5>
                <p>Use the contact form for order issues, returns, shipping questions, or account support.</p>
                <div className="store-contact">
                  <strong>{supportPhone}</strong>
                  <br />
                  <strong>{supportEmail}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="contact-right">
            <h2>Write us...</h2>
            <p className="contact-desc">
              Share your order number, product details, or the issue you need help with. The support team will review your request as soon as possible.
            </p>

            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Your name *</label>
                  <input id="name" name="name" type="text" required value={form.name} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Your email *</label>
                  <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="subject">Subject *</label>
                <input id="subject" name="subject" type="text" required value={form.subject} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="message">Your message</label>
                <textarea id="message" name="message" rows={6} value={form.message} onChange={handleChange} />
              </div>
              <button type="submit" className="btn btn-primary submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'SENDING...' : 'SEND MESSAGE'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
