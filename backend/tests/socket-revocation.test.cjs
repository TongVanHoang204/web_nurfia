const { createServer } = require('node:http');
const { io: client } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const prisma = require('../src/models/prisma').default;
const config = require('../src/config').default;
const { initSocketServer } = require('../src/services/socket.service');
const { notifySessionsRevoked } = require('../src/services/session.service');
let server;
let io;
let address;
let user;
const clients = [];

function open(version) {
  const token = jwt.sign({ userId: 7, role: 'ADMIN', tokenVersion: version }, config.jwt.secret, { expiresIn: '1h' });
  const socket = client(address, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
  clients.push(socket);
  return socket;
}
beforeAll(async () => {
  server = createServer();
  io = initSocketServer(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  user = { id: 7, role: 'ADMIN', permissions: [], isActive: true, tokenVersion: 1 };
  jest.spyOn(prisma.user, 'findUnique').mockImplementation(async () => ({ ...user }));
});
afterEach(() => { for (const socket of clients.splice(0)) socket.disconnect(); });
afterAll(async () => { await new Promise(resolve => io.close(resolve)); });

test('Socket.IO refuses a copied token with an old version', async () => {
  const socket = open(0);
  const result = await new Promise(resolve => {
    socket.once('connect', () => resolve('accepted'));
    socket.once('connect_error', error => resolve(error.message));
  });
  expect(result).toBe('Invalid or expired authentication token.');
});

test('Socket.IO closes an active connection when its account sessions are revoked', async () => {
  const socket = open(1);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  const disconnected = new Promise(resolve => socket.once('disconnect', resolve));
  notifySessionsRevoked(7);
  const result = await Promise.race([disconnected, new Promise(resolve => { const timer = setTimeout(() => resolve('still connected'), 500); timer.unref(); })]);
  expect(result).toBe('io server disconnect');
});

test('a persisted Owner joins the admin notification room', async () => {
  user.isOwner = true;
  const socket = open(1);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  expect(io.sockets.sockets.get(socket.id).rooms.has('admin-room')).toBe(true);
});
