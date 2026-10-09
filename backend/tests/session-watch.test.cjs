const prisma = require('../src/models/prisma').default;
const { watchAuthenticatedSession } = require('../src/services/session.service');

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-09T00:00:00Z'));
});
afterEach(() => { jest.useRealTimers(); });

test.each([
  { isActive: true, tokenVersion: 2 },
  { isActive: false, tokenVersion: 1 },
  null,
])('a live session closes when another instance revokes it or disables/removes its user: %p', async (user) => {
  jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(user);
  const closed = jest.fn();
  const stop = watchAuthenticatedSession(7, 1, Date.now() / 1000 + 3600, closed);
  try {
    await jest.advanceTimersByTimeAsync(15000);
    expect(closed).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(15000);
    expect(closed).toHaveBeenCalledTimes(1);
  } finally { stop(); }
});

test('a live session ends at JWT expiry without waiting for the next DB poll', async () => {
  const db = jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ isActive: true, tokenVersion: 1 });
  const closed = jest.fn();
  const stop = watchAuthenticatedSession(7, 1, Date.now() / 1000 + 2, closed);
  try {
    await jest.advanceTimersByTimeAsync(1999);
    expect(closed).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(db).not.toHaveBeenCalled();
  } finally { stop(); }
});

test('database failure closes a live session instead of retaining access indefinitely', async () => {
  jest.spyOn(prisma.user, 'findUnique').mockRejectedValue(new Error('offline test database'));
  const closed = jest.fn();
  const stop = watchAuthenticatedSession(7, 1, Date.now() / 1000 + 3600, closed);
  try {
    await jest.advanceTimersByTimeAsync(15000);
    expect(closed).toHaveBeenCalledTimes(1);
  } finally { stop(); }
});
