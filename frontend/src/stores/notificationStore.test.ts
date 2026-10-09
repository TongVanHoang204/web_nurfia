// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { useNotificationStore } from './notificationStore';
import api from '../api/client';
vi.mock('../api/client', () => ({ default: { get: vi.fn() } }));
beforeEach(() => { useNotificationStore.setState({ notifications: [], page: 1, totalPages: 3 }); });
const first = { id: 1, userId: 1, type: 'ORDER', title: 'First', message: '', isRead: false, createdAt: '' };
const second = { ...first, id: 2, title: 'Second' };
test('loading more keeps existing notifications and deduplicates overlapping records', async () => {
  useNotificationStore.setState({ notifications: [first, { ...first, id: 3 }] });
  vi.mocked(api.get).mockResolvedValue({ data: { data: { notifications: [first, second], page: 2, totalPages: 3, unreadCount: 2 } } });
  await useNotificationStore.getState().fetchNotifications(2, true);
  expect(useNotificationStore.getState().notifications.map(n => n.id)).toEqual([1, 3, 2]);
});
test('explicit pagination replaces the visible page', async () => {
  useNotificationStore.setState({ notifications: [first] });
  vi.mocked(api.get).mockResolvedValue({ data: { data: { notifications: [second], page: 2, totalPages: 3, unreadCount: 2 } } });
  await useNotificationStore.getState().fetchNotifications(2);
  expect(useNotificationStore.getState().notifications.map(n => n.id)).toEqual([2]);
});
