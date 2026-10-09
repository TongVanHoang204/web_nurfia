const prisma = require('../src/models/prisma').default;
const { resolveLegacyNotificationLinks } = require('../src/utils/notificationLinks');
const legacy = { id: 1, userId: 1, type: 'CONTACT', title: 'New Contact Message', message: 'Message from Test Person (test@example.test): Question', link: '/admin/contacts', createdAt: new Date('2026-10-09T00:00:00Z'), isRead: false };
afterEach(() => jest.restoreAllMocks());
test('legacy message opens the exact contact when its original data uniquely matches', async () => {
  jest.spyOn(prisma.contactMessage, 'findMany').mockResolvedValue([{ id: 91 }]);
  const [result] = await resolveLegacyNotificationLinks([legacy]);
  expect(result.link).toBe('/admin/contacts?contactId=91');
  expect(prisma.contactMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ name: 'Test Person', email: 'test@example.test', subject: 'Question' }), take: 2 }));
});
test.each([{ records: [] }, { records: [{ id: 1 }, { id: 2 }] }])('does not guess a missing or ambiguous contact', async ({ records }) => {
  jest.spyOn(prisma.contactMessage, 'findMany').mockResolvedValue(records);
  expect((await resolveLegacyNotificationLinks([legacy]))[0].link).toBe('/admin/contacts');
});
test('preserves explicit links without another database lookup', async () => {
  const query = jest.spyOn(prisma.contactMessage, 'findMany');
  const current = { ...legacy, link: '/admin/contacts?contactId=91' };
  expect(await resolveLegacyNotificationLinks([current])).toEqual([current]);
  expect(query).not.toHaveBeenCalled();
});
