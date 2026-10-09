// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

vi.hoisted(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size; },
  });
  const events = new EventTarget();
  vi.stubGlobal('window', {
    location: { href: '/', origin: 'https://app.example.test' },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  });
});

vi.mock('../api/client', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
import api from '../api/client';
import { useAuthStore } from './authStore';
import { useUIStore } from './uiStore';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useUIStore.setState({ toasts: [] });
  const user = { id: 7, username: 'test-admin', fullName: 'Test Admin', email: 'admin@example.test', role: 'ADMIN' };
  useAuthStore.setState({ user, isAuthenticated: true });
  localStorage.setItem('nurfia_user', JSON.stringify(user));
});

test('a failed server logout keeps the session visible and reports failure', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('Network unavailable'));
  await useAuthStore.getState().logout();
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(localStorage.getItem('nurfia_user')).toContain('test-admin');
  expect(useUIStore.getState().toasts.some((toast) => toast.type === 'error')).toBe(true);
});

test('successful server logout clears local session and opens login', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  await useAuthStore.getState().logout();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(localStorage.getItem('nurfia_user')).toBeNull();
  expect(window.location.href).toBe('/login');
});
