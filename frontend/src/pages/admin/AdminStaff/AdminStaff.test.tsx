// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), toast: vi.fn(), confirm: vi.fn(),
  user: { id: 1, role: 'OWNER', permissions: [] as string[] },
}));
vi.mock('../../../api/client', () => ({ default: { get: mocks.get, post: mocks.post, put: mocks.put, delete: mocks.delete } }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: mocks.user }) }));
vi.mock('../../../stores/uiStore', () => ({ useUIStore: () => ({ addToast: mocks.toast }) }));
vi.mock('../../../components/AdminConfirmDialog/AdminConfirmDialog', () => ({ useAdminConfirm: () => ({ confirm: mocks.confirm, dialog: null }) }));
import AdminStaff from './index';

const members = [
  { id: 1, username: 'owner', fullName: 'Store Owner', email: 'owner@example.test', role: 'OWNER', permissions: [], isActive: true, createdAt: '2026-10-01', updatedAt: '2026-10-09' },
  { id: 2, username: 'admin', fullName: 'Team Admin', email: 'admin@example.test', role: 'ADMIN', permissions: [], isActive: true, createdAt: '2026-10-01', updatedAt: '2026-10-09' },
  { id: 3, username: 'staff', fullName: 'Sales Staff', email: 'staff@example.test', role: 'STAFF', permissions: ['MANAGE_ORDERS'], isActive: true, createdAt: '2026-10-01', updatedAt: '2026-10-09' },
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 1, role: 'OWNER', permissions: [] };
  mocks.confirm.mockResolvedValue(false);
  mocks.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/history')
    ? { data: [{ id: 1, action: 'UPDATE', createdAt: '2026-10-09', user: { fullName: 'Store Owner' }, details: { previous: { role: 'STAFF' }, current: { role: 'MANAGER' }, passwordChanged: true } }] }
    : { data: members, stats: { totalStaff: 3, activeStaff: 3, inactiveStaff: 0 }, pagination: { page: 1, limit: 20, total: 3, totalPages: 1 } } }));
});
afterEach(cleanup);

test('the Owner can inspect all team members and edit Admin accounts', async () => {
  const user = userEvent.setup();
  render(<AdminStaff />);
  await screen.findByText('Team Admin');
  await user.click(screen.getByRole('button', { name: 'Edit Team Admin' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByLabelText('Role')).toHaveValue('ADMIN');
});

test('a delegated Manager sees unassignable permissions disabled', async () => {
  mocks.user = { id: 9, role: 'MANAGER', permissions: ['MANAGE_STAFF', 'MANAGE_ORDERS'] };
  const user = userEvent.setup();
  render(<AdminStaff />);
  await screen.findByText('Sales Staff');
  expect(screen.queryByRole('button', { name: 'Edit Team Admin' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Edit Sales Staff' }));
  await user.click(screen.getByRole('tab', { name: 'Permissions' }));
  expect(screen.getByRole('checkbox', { name: /Settings/ })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: /Orders/ })).toBeEnabled();
});

test('closing a dirty drawer asks for confirmation and preserves edits on cancellation', async () => {
  const user = userEvent.setup();
  render(<AdminStaff />);
  await screen.findByText('Sales Staff');
  await user.click(screen.getByRole('button', { name: 'Edit Sales Staff' }));
  await user.type(screen.getByLabelText('Full Name'), ' edited');
  await user.click(screen.getByRole('button', { name: 'Close staff panel' }));
  expect(mocks.confirm).toHaveBeenCalled();
  expect(screen.getByLabelText('Full Name')).toHaveValue('Sales Staff edited');
});

test('saving a drawer blocks duplicate submits until the request finishes', async () => {
  mocks.put.mockReturnValue(new Promise(() => {}));
  const user = userEvent.setup();
  render(<AdminStaff />);
  await screen.findByText('Sales Staff');
  await user.click(screen.getByRole('button', { name: 'Edit Sales Staff' }));
  await user.type(screen.getByLabelText('Full Name'), ' edited');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
  expect(mocks.put).toHaveBeenCalledTimes(1);
});

test('editing a name sends only changed fields and preserves existing delegated access', async () => {
  mocks.user = { id: 9, role: 'MANAGER', permissions: ['MANAGE_STAFF'] };
  mocks.put.mockResolvedValue({ data: { success: true } });
  const user = userEvent.setup();
  render(<AdminStaff />);
  await user.click(await screen.findByRole('button', { name: 'Edit Sales Staff' }));
  await user.clear(screen.getByLabelText('Full Name'));
  await user.type(screen.getByLabelText('Full Name'), 'Sales Staff Renamed');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(mocks.put).toHaveBeenCalledWith('/admin/staffs/3', { fullName: 'Sales Staff Renamed' });
});

test('history loads only for the chosen member and identifies the actor', async () => {
  const user = userEvent.setup();
  render(<AdminStaff />);
  await screen.findByText('Sales Staff');
  await user.click(screen.getByRole('button', { name: 'Edit Sales Staff' }));
  await user.click(screen.getByRole('tab', { name: 'History' }));
  await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/admin/staffs/3/history'));
  expect(await screen.findByText('Password changed')).toBeInTheDocument();
});

test('the actions menu supports keyboard dismissal and confirms the target before disabling', async () => {
  const user = userEvent.setup();
  render(<AdminStaff />);
  const trigger = await screen.findByRole('button', { name: 'More actions for Sales Staff' });
  await user.click(trigger);
  expect(screen.getByRole('menu')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Disable account' }));
  expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Disable Sales Staff?' }));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(mocks.put).not.toHaveBeenCalled();
});
