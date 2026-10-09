const express = require('express');
const request = require('supertest');
const prisma = require('../src/models/prisma').default;
const { adminController } = require('../src/controllers/admin.controller');
const { contactController } = require('../src/controllers/contact.controller');
const { requirePermission } = require('../src/middlewares/auth');
const { errorHandler } = require('../src/middlewares/errorHandler');
afterEach(() => jest.restoreAllMocks());
function app(role = 'OWNER') {
  const server = express();
  server.use((req, _res, next) => { req.userRole = role; req.userPermissions = []; next(); });
  server.get('/orders/:id', requirePermission('MANAGE_ORDERS'), (req, res, next) => adminController.getOrderById(req, res, next));
  server.get('/contacts/:id', requirePermission('MANAGE_CONTACTS'), (req, res, next) => contactController.getMessageById(req, res, next));
  server.use(errorHandler);
  return server;
}
test('Owner notification can read an order outside the current list page', async () => {
  jest.spyOn(prisma.order, 'findUnique').mockResolvedValue({ id: 42, orderNumber: 'ORDER-42', bankTransferProofUrl: null, items: [] });
  const response = await request(app()).get('/orders/42');
  expect(response.status).toBe(200);
  expect(response.body.data.id).toBe(42);
  expect(prisma.order.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42 } }));
});
test('Contact detail resolves exactly the selected message', async () => {
  jest.spyOn(prisma.contactMessage, 'findUnique').mockResolvedValue({ id: 91, subject: 'Question' });
  const response = await request(app()).get('/contacts/91');
  expect(response.status).toBe(200);
  expect(response.body.data.id).toBe(91);
});
test('detail routes still enforce the module permission', async () => {
  expect((await request(app('STAFF')).get('/orders/42')).status).toBe(403);
  expect((await request(app('ADMIN')).get('/contacts/91')).status).toBe(403);
});
test('removed and invalid referenced entities return clear errors', async () => {
  jest.spyOn(prisma.order, 'findUnique').mockResolvedValue(null);
  expect((await request(app()).get('/orders/42')).status).toBe(404);
  expect((await request(app()).get('/orders/no')).status).toBe(400);
});
