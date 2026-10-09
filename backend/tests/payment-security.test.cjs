const crypto = require('node:crypto');
const express = require('express');
const request = require('supertest');
const prisma = require('../src/models/prisma').default;
const config = require('../src/config').default;
const { paymentController } = require('../src/controllers/payment.controller');
const { errorHandler } = require('../src/middlewares/errorHandler');

const originalMomo = { ...config.momo };
const originalStripe = { ...config.stripe };
const originalEnv = config.env;
let order;
let databaseReads;

function app() {
  const server = express();
  server.use(express.json());
  server.post('/ipn', paymentController.handleIpn);
  server.post('/stripe', (req, _res, next) => { req.userId = 7; next(); }, paymentController.createStripeCheckoutSession);
  server.use(errorHandler);
  return server;
}

function callback(overrides = {}, accessKey = config.momo.accessKey, secretKey = config.momo.secretKey) {
  const value = { partnerCode: 'merchant', orderId: 'ORDER-TEST', requestId: 'REQUEST-TEST', amount: 100, orderInfo: 'test', orderType: 'momo_wallet', transId: 123, resultCode: 0, message: 'success', payType: 'qr', responseTime: 123, extraData: '', ...overrides };
  const raw = `accessKey=${accessKey}&amount=${value.amount}&extraData=${value.extraData}&message=${value.message}&orderId=${value.orderId}&orderInfo=${value.orderInfo}&orderType=${value.orderType}&partnerCode=${value.partnerCode}&payType=${value.payType}&requestId=${value.requestId}&responseTime=${value.responseTime}&resultCode=${value.resultCode}&transId=${value.transId}`;
  return { ...value, signature: crypto.createHmac('sha256', secretKey).update(raw).digest('hex') };
}

beforeEach(() => {
  Object.assign(config.momo, { partnerCode: 'merchant', accessKey: 'test-access', secretKey: 'test-secret' });
  order = { id: 11, userId: 7, orderNumber: 'ORDER-TEST', totalAmount: 100, paymentMethod: 'MOMO', status: 'PENDING', paymentStatus: 'UNPAID' };
  databaseReads = 0;
  jest.spyOn(prisma.order, 'findUnique').mockImplementation(async () => { databaseReads++; return { ...order }; });
  jest.spyOn(prisma.order, 'update').mockImplementation(async ({ data }) => { Object.assign(order, data); return { ...order }; });
});

afterEach(() => {
  Object.assign(config.momo, originalMomo);
  Object.assign(config.stripe, originalStripe);
  config.env = originalEnv;
});

test.each(['partnerCode', 'accessKey', 'secretKey'])('missing MoMo %s rejects a forged payment before reading orders', async (key) => {
  config.momo[key] = '';
  const response = await request(app()).post('/ipn').send(callback());
  expect(response.status).toBe(503);
  expect(order.paymentStatus).toBe('UNPAID');
  expect(databaseReads).toBe(0);
});

test('wrong signature cannot change payment status', async () => {
  const response = await request(app()).post('/ipn').send({ ...callback(), signature: '0'.repeat(64) });
  expect(response.status).toBe(400);
  expect(order.paymentStatus).toBe('UNPAID');
});

test('a valid signature for a different merchant cannot change payment status', async () => {
  const response = await request(app()).post('/ipn').send(callback({ partnerCode: 'another-merchant' }));
  expect(response.status).toBe(400);
  expect(order.paymentStatus).toBe('UNPAID');
});

test('malformed callback is rejected without reading orders', async () => {
  const response = await request(app()).post('/ipn').send(callback({ amount: -1 }));
  expect(response.status).toBe(400);
  expect(databaseReads).toBe(0);
});

test('valid matching MoMo payment confirms an unpaid order', async () => {
  const response = await request(app()).post('/ipn').send(callback());
  expect(response.status).toBe(204);
  expect(order.paymentStatus).toBe('PAID');
  expect(order.status).toBe('CONFIRMED');
});

test.each([{ amount: 1 }, { resultCode: 1 }])('mismatched amount or failed payment leaves order unpaid: %j', async (fields) => {
  const response = await request(app()).post('/ipn').send(callback(fields));
  expect(response.status).toBe(204);
  expect(order.paymentStatus).toBe('UNPAID');
});

test('production cannot mark an order paid using Stripe demo mode', async () => {
  config.env = 'production';
  config.stripe.demoMode = true;
  config.stripe.secretKey = '';
  order.paymentMethod = 'STRIPE';
  const response = await request(app()).post('/stripe').send({ orderId: order.id });
  expect(response.status).toBe(503);
  expect(order.paymentStatus).toBe('UNPAID');
});
