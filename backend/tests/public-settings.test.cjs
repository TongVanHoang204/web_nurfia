const express = require('express');
const request = require('supertest');
const prisma = require('../src/models/prisma').default;
const { settingController } = require('../src/controllers/setting.controller');
const { errorHandler } = require('../src/middlewares/errorHandler');

test('public settings retain current and legacy display keys without exposing subscribers or unknown secrets', async () => {
  // Deliberately return private rows too: serialization must remain safe even if a DB adapter does not filter.
  jest.spyOn(prisma.setting, 'findMany').mockResolvedValue([
    { key: 'siteName', value: 'Nurfia' },
    { key: 'site_name', value: 'Legacy name' },
    { key: 'contact_email', value: 'shop@example.test' },
    { key: 'bankName', value: 'Public checkout bank' },
    { key: 'newsletterSubscribers', value: '[{"email":"private-subscriber@example.test"}]' },
    { key: 'futurePrivateSecret', value: 'private-credential' },
  ]);
  const app = express();
  app.get('/settings', settingController.getSettings);
  app.use(errorHandler);
  const result = await request(app).get('/settings');
  expect(result.status).toBe(200);
  expect(result.body.data).toEqual({ siteName: 'Nurfia', site_name: 'Legacy name', contact_email: 'shop@example.test', bankName: 'Public checkout bank' });
  expect(result.text).not.toContain('private-subscriber');
  expect(result.text).not.toContain('private-credential');
});
