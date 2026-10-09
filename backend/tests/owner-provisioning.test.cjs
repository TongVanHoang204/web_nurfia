const bcrypt = require('bcryptjs');
const prisma = require('../src/models/prisma').default;
let provisionOwner;
let target;
let write;
beforeAll(() => { provisionOwner = require('../src/services/owner.service').provisionOwner; });
beforeEach(() => {
  target = { id: 1, username: 'admin', role: 'MANAGER', isOwner: false };
  write = null;
  jest.spyOn(prisma, '$executeRawUnsafe').mockResolvedValue(0);
  jest.spyOn(prisma, '$transaction').mockImplementation(async fn => fn(prisma));
  jest.spyOn(prisma.user, 'findUnique').mockImplementation(async () => target);
  jest.spyOn(prisma.user, 'update').mockImplementation(async ({ data }) => { write = data; return { ...target, ...data }; });
  jest.spyOn(prisma.activityLog, 'create').mockResolvedValue({ id: 1 });
});
test('provisioning upgrades the existing account without exposing or storing plaintext credentials', async () => {
  const result = await provisionOwner('admin', 'test-owner-password');
  expect(result).toEqual({ id: 1, username: 'admin', role: 'OWNER' });
  expect(write).toMatchObject({ role: 'ADMIN', isOwner: true, isActive: true, tokenVersion: { increment: 1 }, resetToken: null, resetExpires: null });
  expect(await bcrypt.compare('test-owner-password', write.password)).toBe(true);
  expect(JSON.stringify(prisma.activityLog.create.mock.calls)).not.toContain('test-owner-password');
  expect(JSON.stringify(prisma.activityLog.create.mock.calls)).not.toContain(write.password);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
});
test('missing accounts are not silently created using invented email addresses', async () => {
  target = null;
  await expect(provisionOwner('missing', 'test-owner-password')).rejects.toMatchObject({ statusCode: 404 });
  expect(write).toBeNull();
});
test('invalid input is rejected before any database access', async () => {
  await expect(provisionOwner('admin', 'has spaces')).rejects.toMatchObject({ statusCode: 400 });
  expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
});
