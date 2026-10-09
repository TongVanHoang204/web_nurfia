// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import StaffEditor from './StaffEditor';
import { PERMISSIONS } from './staffModel';
import type { StaffForm } from './staffModel';
vi.mock('../../../api/client', () => ({ default: { get: vi.fn() } }));
afterEach(cleanup);
const admin = { id: 2, role: 'ADMIN', username: 'team-admin', fullName: 'Team Admin', email: 'admin@example.test', permissions: PERMISSIONS.map(p => p.value), isActive: true, createdAt: '2026-10-01', updatedAt: '2026-10-09' };

test('Owner can remove Admin settings access and save the chosen permissions', async () => {
  const user = userEvent.setup();
  let saved: StaffForm | undefined;
  render(<StaffEditor member={admin} actor={{ id: 1, role: 'OWNER', permissions: [] }} editable onSave={async form => { saved = form; }} onClose={() => {}} confirmDiscard={async () => false} />);
  await user.click(screen.getByRole('tab', { name: 'Permissions' }));
  await user.click(screen.getByRole('checkbox', { name: /Settings/ }));
  expect(screen.getByRole('checkbox', { name: /Settings/ })).not.toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(saved?.role).toBe('ADMIN');
  expect(saved?.permissions).not.toContain('MANAGE_SETTINGS');
  expect(saved?.permissions).toContain('MANAGE_ORDERS');
});

test('a restricted Admin cannot add a permission withheld by Owner to Staff', async () => {
  const user = userEvent.setup();
  render(<StaffEditor member={{ ...admin, role: 'STAFF', permissions: ['MANAGE_ORDERS'] }} actor={{ id: 4, role: 'ADMIN', permissions: ['MANAGE_STAFF', 'MANAGE_ORDERS'] }} editable onSave={async () => {}} onClose={() => {}} confirmDiscard={async () => false} />);
  await user.click(screen.getByRole('tab', { name: 'Permissions' }));
  expect(screen.getByRole('checkbox', { name: /Settings/ })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: /Orders/ })).toBeEnabled();
});
