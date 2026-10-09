const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../src/models/prisma').default;
const config = require('../src/config').default;
const { authenticate, optionalAuth } = require('../src/middlewares/auth');
const { authController } = require('../src/controllers/auth.controller');
const { authService } = require('../src/services/auth.service');
const { errorHandler } = require('../src/middlewares/errorHandler');
let user;

function token(version = user.tokenVersion) {
  return jwt.sign({ userId: user.id, role: 'ADMIN', ...(version !== null ? { tokenVersion: version } : {}) }, config.jwt.secret, { expiresIn: '1h' });
}
function app() {
  const server = express();
  server.use(express.json(), cookieParser());
  server.get('/private', authenticate, (req, res) => res.json({ userId: req.userId, role: req.userRole }));
  server.get('/optional', optionalAuth, (req, res) => res.json({ userId: req.userId || null }));
  server.post('/logout', authController.logout);
  server.use(errorHandler);
  return server;
}

beforeEach(async () => {
  user = { id: 7, username: 'test-admin', email: 'admin@example.test', fullName: 'Test Admin', password: await bcrypt.hash('old-password', 4), role: 'ADMIN', permissions: [], isActive: true, tokenVersion: 0, resetToken: 'fixture', resetExpires: new Date(Date.now() + 60000) };
  jest.spyOn(prisma.user, 'findUnique').mockImplementation(async () => ({ ...user }));
  jest.spyOn(prisma.user, 'findFirst').mockImplementation(async () => ({ ...user }));
  jest.spyOn(prisma.user, 'update').mockImplementation(async ({ data }) => {
    const { tokenVersion, ...rest } = data;
    Object.assign(user, rest);
    if (tokenVersion?.increment) user.tokenVersion += tokenVersion.increment;
    return { ...user };
  });
  jest.spyOn(prisma.user, 'updateMany').mockImplementation(async ({ where, data }) => {
    if (where.id !== user.id || (where.tokenVersion !== undefined && where.tokenVersion !== user.tokenVersion)) return { count: 0 };
    if (data.tokenVersion?.increment) user.tokenVersion += data.tokenVersion.increment;
    return { count: 1 };
  });
});

test('logout rejects a copied bearer token while a fresh login token remains usable', async () => {
  const copied = token();
  const server = app();
  expect((await request(server).get('/private').set('Authorization', 'Bearer ' + copied)).status).toBe(200);
  const logout = await request(server).post('/logout').set('Cookie', `${config.jwt.cookieName}=${copied}`);
  expect(logout.status).toBe(200);
  expect(logout.headers['set-cookie'].join(';')).toContain(config.jwt.cookieName + '=;');
  expect((await request(server).get('/private').set('Authorization', 'Bearer ' + copied)).status).toBe(401);
  const login = await authService.login('test-admin', 'old-password');
  expect((await request(server).get('/private').set('Authorization', 'Bearer ' + login.token)).status).toBe(200);
});

test('legacy tokens without a version require a new login', async () => {
  expect((await request(app()).get('/private').set('Authorization', 'Bearer ' + token(null))).status).toBe(401);
});

test('restricted Admin login and profile expose only the permissions set by Owner', async () => {
  user.adminPermissionsRestricted = true;
  user.permissions = ['MANAGE_ORDERS'];
  const login = await authService.login('test-admin', 'old-password');
  const profile = await authService.getProfile(user.id);
  expect(login.user.permissions).toEqual(['MANAGE_ORDERS']);
  expect(profile.permissions).toEqual(['MANAGE_ORDERS']);
  expect(profile.adminPermissionsRestricted).toBeUndefined();
});

test('legacy Admin login and profile preserve all modules until Owner configures them', async () => {
  const login = await authService.login('test-admin', 'old-password');
  const profile = await authService.getProfile(user.id);
  expect(login.user.permissions).toContain('MANAGE_SETTINGS');
  expect(profile.permissions).toContain('MANAGE_STAFF');
});

test('owner login, profile and authenticated requests expose OWNER without leaking the storage flag', async () => {
  user.isOwner = true;
  const login = await authService.login('test-admin', 'old-password');
  expect(login.user.role).toBe('OWNER');
  expect(jwt.verify(login.token, config.jwt.secret).role).toBe('OWNER');
  const profile = await authService.getProfile(user.id);
  expect(profile.role).toBe('OWNER');
  expect(profile.isOwner).toBeUndefined();
  const response = await request(app()).get('/private').set('Authorization', 'Bearer ' + login.token);
  expect(response.body.role).toBe('OWNER');
});

test('optional authentication must not accept revoked tokens', async () => {
  const copied = token();
  user.tokenVersion = 1;
  const response = await request(app()).get('/optional').set('Authorization', 'Bearer ' + copied);
  expect(response.status).toBe(200);
  expect(response.body.userId).toBeNull();
});

test('changing the password rejects existing tokens', async () => {
  const copied = token();
  await authService.changePassword(user.id, 'old-password', 'new-password');
  expect((await request(app()).get('/private').set('Authorization', 'Bearer ' + copied)).status).toBe(401);
  expect(await bcrypt.compare('new-password', user.password)).toBe(true);
});

test('password reset rejects existing tokens', async () => {
  const copied = token();
  await authService.resetPassword('fixture-reset-token', 'new-password');
  expect((await request(app()).get('/private').set('Authorization', 'Bearer ' + copied)).status).toBe(401);
  expect(user.resetToken).toBeNull();
});

test('logout with an old bearer and a valid cookie revokes the valid cookie session too', async () => {
  const old = token();
  user.tokenVersion++;
  const current = token();
  const server = app();
  await request(server).post('/logout').set('Authorization', 'Bearer ' + old).set('Cookie', `${config.jwt.cookieName}=${current}`);
  expect((await request(server).get('/private').set('Authorization', 'Bearer ' + current)).status).toBe(401);
});
