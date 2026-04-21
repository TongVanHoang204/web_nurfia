import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSiteSettings } from '../../contexts/SiteSettingsContext';
import './PolicyPage.css';

const POLICY_CONTENT: Record<string, { title: string; intro: string; sections: Array<{ heading: string; body: string }> }> = {
  shipping: {
    title: 'Shipping Policy',
    intro: 'We process orders as quickly as possible and confirm availability before dispatch.',
    sections: [
      {
        heading: 'Processing Time',
        body: 'Orders are typically reviewed and prepared within 1 to 2 business days. Peak periods and payment verification may extend this timeline slightly.',
      },
      {
        heading: 'Delivery Zones',
        body: 'Shipping fees and available delivery methods depend on the province, district, and ward entered during checkout. The checkout page always uses the latest shipping rules configured by the store.',
      },
      {
        heading: 'Order Updates',
        body: 'Once an order is confirmed, you can track status changes from your account and order confirmation page. If a route is unavailable for your address, checkout will prevent order placement until a valid method is selected.',
      },
    ],
  },
  returns: {
    title: 'Returns & Exchanges',
    intro: 'If there is a problem with your order, contact support promptly so the team can review the case.',
    sections: [
      {
        heading: 'Eligibility',
        body: 'Products should be unused and returned in the condition received. Orders that have already been paid and fulfilled may require manual review before refund approval.',
      },
      {
        heading: 'Damaged or Incorrect Items',
        body: 'Please contact support with your order number and issue details if you receive the wrong product or a damaged item.',
      },
      {
        heading: 'Refund Handling',
        body: 'Refund status is handled by the admin team after review. Paid orders cannot be self-cancelled from the customer account once payment is confirmed.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'Your account and order information is used to operate the store, fulfill purchases, and support customer service.',
    sections: [
      {
        heading: 'Information We Use',
        body: 'We store the details required for authentication, checkout, delivery, and order history. Contact submissions and newsletter subscriptions are also recorded when you choose to submit them.',
      },
      {
        heading: 'Operational Use',
        body: 'Your information is used to manage orders, deliver support, and maintain account access. Admin access is permission-based and activity is logged for audit purposes.',
      },
      {
        heading: 'Support Requests',
        body: 'If you need help with account, shipping, or privacy concerns, use the support channels listed below so the store team can assist you directly.',
      },
    ],
  },
};

export default function PolicyPage() {
  const { policyType = '' } = useParams<{ policyType: string }>();
  const { settings } = useSiteSettings();

  const policy = useMemo(() => POLICY_CONTENT[policyType] || POLICY_CONTENT.shipping, [policyType]);
  const supportEmail = settings.email || 'contact@nurfia.com';
  const supportPhone = settings.phone || '+1 234 567 890';
  const supportAddress = settings.address || '123 Fashion Avenue, New York';

  return (
    <div className="policy-page">
      <div className="container policy-container">
        <div className="policy-hero">
          <p className="policy-kicker">Customer Care</p>
          <h1>{policy.title}</h1>
          <p>{policy.intro}</p>
        </div>

        <div className="policy-grid">
          <section className="policy-card">
            {policy.sections.map((section) => (
              <article key={section.heading} className="policy-section">
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
              </article>
            ))}
          </section>

          <aside className="policy-card policy-support">
            <h2>Support</h2>
            <p>For order-specific assistance, use the current store support details below.</p>
            <ul>
              <li><strong>Email:</strong> {supportEmail}</li>
              <li><strong>Phone:</strong> {supportPhone}</li>
              <li><strong>Address:</strong> {supportAddress}</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
