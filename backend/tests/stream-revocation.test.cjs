const { EventEmitter } = require('node:events');
const { adminController } = require('../src/controllers/admin.controller');
const { notifySessionsRevoked } = require('../src/services/session.service');
const { emitCustomerStatusChanged } = require('../src/services/customer-stream.service');

test('revoking an admin session closes its status stream and removes its subscription', async () => {
  const response = new EventEmitter();
  response.setHeader = jest.fn();
  response.flushHeaders = jest.fn();
  response.write = jest.fn();
  response.end = jest.fn(() => response.emit('close'));
  const next = jest.fn();
  const request = { userId: 7, tokenVersion: 1, tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600 };
  try {
    await adminController.customerStatusStream(request, response, next);
    expect(next).not.toHaveBeenCalled();
    const event = { customerId: 10, isActive: false, updatedBy: 7, updatedAt: '2026-10-09T00:00:00Z' };
    emitCustomerStatusChanged(event);
    expect(response.write).toHaveBeenCalledWith('event: customer-status-changed\n');
    notifySessionsRevoked(7);
    expect(response.end).toHaveBeenCalledTimes(1);
    response.write.mockClear();
    emitCustomerStatusChanged(event);
    expect(response.write).not.toHaveBeenCalled();
  } finally { response.emit('close'); }
});
