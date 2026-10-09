// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
const session = vi.hoisted(() => ({ user: { id: 1, role: 'OWNER', fullName: 'Owner', permissions: [] as string[] } }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: session.user, isAuthenticated: true, isHydrating: false, logout: vi.fn() }) }));
vi.mock('../../../components/Notifications/NotificationBell', () => ({ default: () => null }));
import AdminLayout from './index';
import { ThemeProvider } from '../../../contexts/ThemeContext';
beforeEach(() => {
  session.user = { id: 1, role: 'OWNER', fullName: 'Owner', permissions: [] };
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const view = (path: string) => render(<ThemeProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/admin" element={<AdminLayout />}><Route index element={<p>Dashboard content</p>} /><Route path="settings" element={<p>Settings content</p>} /><Route path="products" element={<p>Products content</p>} /></Route></Routes></MemoryRouter></ThemeProvider>);

test('Owner can enter Settings even without an explicit permissions array', async () => {
  view('/admin/settings');
  expect(await screen.findByText('Settings content')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
});

test('Admin cannot navigate into a module Owner has removed', async () => {
  session.user = { id: 2, role: 'ADMIN', fullName: 'Admin', permissions: ['MANAGE_PRODUCTS'] };
  view('/admin/settings');
  expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Products' })).toBeInTheDocument();
});
