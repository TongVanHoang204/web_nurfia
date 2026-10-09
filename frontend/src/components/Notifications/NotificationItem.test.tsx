// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotificationItem } from './NotificationItem';
const auth = vi.hoisted(() => ({ user: {} as Record<string, unknown> }));
vi.mock('../../stores/authStore', () => ({ useAuthStore: () => ({ user: auth.user }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
afterEach(cleanup);
const notification = { id: 1, userId: 1, type: 'ORDER', title: 'Order update', message: 'Ready', isRead: false, createdAt: new Date().toISOString() };
const view = (link: string, onSelect = vi.fn()) => {
  render(<MemoryRouter><NotificationItem notification={{ ...notification, link }} onRead={vi.fn()} onSelect={onSelect} /></MemoryRouter>);
};
test.each([
  ['/admin/orders/24', '/admin/orders?orderId=24'],
  ['/admin/products/42', '/admin/products?productId=42'],
  ['/admin/contacts/91', '/admin/contacts?contactId=91'],
  ['/orders/11', '/order-confirmation/11'],
])('opens the referenced detail for %s', (link, expected) => {
  auth.user = { id: 1, role: 'OWNER' };
  view(link);
  expect(screen.getByRole('link', { name: 'Order update' })).toHaveAttribute('href', expected);
});
test.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/admin/settings'])('does not follow unsafe or unauthorized destination %s', (link) => {
  auth.user = { id: 1, role: 'STAFF', permissions: [] };
  view(link);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
test('selection closes the containing dropdown', () => {
  auth.user = { id: 1, role: 'OWNER' };
  const onSelect = vi.fn();
  view('/admin/orders/24', onSelect);
  fireEvent.click(screen.getByRole('link'));
  expect(onSelect).toHaveBeenCalledOnce();
});
