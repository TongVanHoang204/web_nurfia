const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../src/models/prisma').default;
const config = require('../src/config').default;
const { authenticate, requireAdminAccess, requirePermission, ADMIN_PERMISSIONS } = require('../src/middlewares/auth');
const { validate } = require('../src/middlewares/validate');
const { createStaffSchema, updateStaffSchema } = require('../src/validators/admin.validator');
const { staffController } = require('../src/controllers/staff.controller');
const { activityController } = require('../src/controllers/activity.controller');
const { errorHandler } = require('../src/middlewares/errorHandler');
let actor;
let target;
let written;
const fixture = { username: 'worker', email: 'worker@example.test', password: 'test-password', fullName: 'Test Worker', role: 'STAFF', permissions: ['MANAGE_ORDERS'], isActive: true };
function app() {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => { Object.assign(req, actor); next(); });
  server.use(requireAdminAccess, requirePermission('MANAGE_STAFF'));
  server.post('/staff', validate(createStaffSchema), staffController.createStaff);
  server.put('/staff/:id', validate(updateStaffSchema), staffController.updateStaff);
  server.delete('/staff/:id', staffController.deleteStaff);
  server.get('/staff/:id/history', (req, res, next) => staffController.getStaffHistory(req, res, next));
  server.post('/rollback/:id', activityController.rollbackLog);
  server.use(errorHandler);
  return server;
}
beforeEach(() => {
  actor = { userId: 10, userRole: 'ADMIN', userPermissions: [...ADMIN_PERMISSIONS] };
  target = { id: 20, username: 'worker', email: 'worker@example.test', fullName: 'Worker', role: 'STAFF', isOwner: false, permissions: ['MANAGE_ORDERS'], isActive: true, tokenVersion: 0 };
  written = [];
  jest.spyOn(prisma.user, 'findFirst').mockImplementation(async () => ({ ...target }));
  jest.spyOn(prisma.user, 'findUnique').mockImplementation(async () => ({ ...target }));
  jest.spyOn(prisma.user, 'create').mockImplementation(async ({ data }) => { written.push(data); return { ...target, ...data }; });
  jest.spyOn(prisma.user, 'update').mockImplementation(async ({ data }) => { written.push(data); return { ...target, ...data, tokenVersion: data.tokenVersion?.increment ? target.tokenVersion + data.tokenVersion.increment : target.tokenVersion }; });
  jest.spyOn(prisma.user, 'delete').mockImplementation(async () => { written.push('deleted'); return target; });
  jest.spyOn(prisma.activityLog, 'create').mockResolvedValue({ id: 1 });
  jest.spyOn(prisma.activityLog, 'findMany').mockResolvedValue([]);
  jest.spyOn(prisma.activityLog, 'findUnique').mockResolvedValue({ id: 5, action: 'UPDATE', entityType: 'STAFF', entityId: 20, details: { previous: { ...target, role: 'MANAGER' } } });
});

test('the persisted owner flag grants effective OWNER and full admin access', async () => {
  target.role = 'ADMIN'; target.isOwner = true;
  const server = express();
  server.get('/owner', authenticate, requireAdminAccess, requirePermission('MANAGE_SETTINGS'), (req, res) => res.json({ role: req.userRole }));
  server.use(errorHandler);
  const token = jwt.sign({ userId: 20, tokenVersion: 0 }, config.jwt.secret, { expiresIn: '1h' });
  const response = await request(server).get('/owner').set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(200);
  expect(response.body.role).toBe('OWNER');
});
test('Owner can edit an Admin account', async () => {
  actor.userRole = 'OWNER'; target.role = 'ADMIN';
  expect((await request(app()).put('/staff/20').send({ fullName: 'New Name' })).status).toBe(200);
});

test('Owner can remove every Admin permission without restoring full access', async () => {
  actor.userRole = 'OWNER'; target.role = 'ADMIN';
  const response = await request(app()).put('/staff/20').send({ permissions: [] });
  expect(response.status).toBe(200);
  expect(response.body.data.permissions).toEqual([]);
  expect(written[0].adminPermissionsRestricted).toBe(true);
  expect(written[0].tokenVersion).toEqual({ increment: 1 });
  expect(response.body.data.adminPermissionsRestricted).toBeUndefined();
});

test('a restricted Admin can use assigned modules but cannot bypass removed permissions', async () => {
  target.role = 'ADMIN'; target.adminPermissionsRestricted = true;
  const server = express();
  server.get('/orders', authenticate, requirePermission('MANAGE_ORDERS'), (_req, res) => res.sendStatus(200));
  server.get('/settings', authenticate, requirePermission('MANAGE_SETTINGS'), (_req, res) => res.sendStatus(200));
  server.use(errorHandler);
  const token = jwt.sign({ userId: 20, tokenVersion: 0 }, config.jwt.secret, { expiresIn: '1h' });
  expect((await request(server).get('/orders').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  expect((await request(server).get('/settings').set('Authorization', `Bearer ${token}`)).status).toBe(403);
});

test('legacy Admins retain all module access until Owner changes their permissions', async () => {
  target.role = 'ADMIN'; target.permissions = [];
  const server = express();
  server.get('/settings', authenticate, requirePermission('MANAGE_SETTINGS'), (req, res) => res.json({ permissions: req.userPermissions }));
  server.use(errorHandler);
  const token = jwt.sign({ userId: 20, tokenVersion: 0 }, config.jwt.secret, { expiresIn: '1h' });
  const response = await request(server).get('/settings').set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(200);
  expect(response.body.permissions).toContain('MANAGE_SETTINGS');
});

test('an Admin cannot delegate permissions Owner has withheld', async () => {
  actor.userPermissions = ['MANAGE_STAFF', 'MANAGE_ORDERS'];
  expect((await request(app()).put('/staff/20').send({ permissions: ['MANAGE_SETTINGS'] })).status).toBe(403);
  expect(written).toEqual([]);
});
test.each(['ADMIN', 'MANAGER', 'STAFF'])('%s cannot edit an Owner account', async role => {
  actor.userRole = role; target.role = 'ADMIN'; target.isOwner = true;
  expect((await request(app()).put('/staff/20').send({ fullName: 'Changed' })).status).toBe(403);
  expect(written).toEqual([]);
});
test('Owner cannot disable or delete the Owner through staff routes', async () => {
  actor.userRole = 'OWNER'; target.role = 'ADMIN'; target.isOwner = true;
  expect((await request(app()).put('/staff/20').send({ isActive: false })).status).toBe(403);
  expect((await request(app()).delete('/staff/20')).status).toBe(403);
});
test('self modification cannot grant new permissions', async () => {
  target.id = actor.userId; target.role = 'MANAGER'; actor.userRole = 'MANAGER'; actor.userPermissions = ['MANAGE_STAFF', 'MANAGE_ORDERS'];
  expect((await request(app()).put('/staff/10').send({ permissions: ['MANAGE_SETTINGS'] })).status).toBe(403);
  expect(written).toEqual([]);
});
test('a delegated Manager cannot edit a peer Manager', async () => {
  actor.userRole = 'MANAGER'; actor.userPermissions = ['MANAGE_STAFF', 'MANAGE_ORDERS']; target.role = 'MANAGER';
  expect((await request(app()).put('/staff/20').send({ fullName: 'Changed' })).status).toBe(403);
});
test('a delegated Manager cannot grant permissions they do not hold', async () => {
  actor.userRole = 'MANAGER'; actor.userPermissions = ['MANAGE_STAFF', 'MANAGE_ORDERS'];
  expect((await request(app()).put('/staff/20').send({ permissions: ['MANAGE_SETTINGS'] })).status).toBe(403);
  expect(written).toEqual([]);
});
test('a delegated Manager can assign a subset of their permissions to Staff', async () => {
  actor.userRole = 'MANAGER'; actor.userPermissions = ['MANAGE_STAFF', 'MANAGE_ORDERS'];
  expect((await request(app()).put('/staff/20').send({ permissions: ['MANAGE_ORDERS'] })).status).toBe(200);
});
test('only Owner can create an Admin', async () => {
  target = null;
  expect((await request(app()).post('/staff').send({ ...fixture, role: 'ADMIN' })).status).toBe(403);
  actor.userRole = 'OWNER';
  expect((await request(app()).post('/staff').send({ ...fixture, role: 'ADMIN' })).status).toBe(201);
});
test('creating OWNER or supplying isOwner through the API is rejected', async () => {
  actor.userRole = 'OWNER';
  expect((await request(app()).post('/staff').send({ ...fixture, role: 'OWNER' })).status).toBe(400);
  expect((await request(app()).put('/staff/20').send({ isOwner: true })).status).toBe(400);
});
test.each([{ password: 'replacement-password' }, { permissions: ['MANAGE_CONTACTS'] }, { role: 'MANAGER' }, { isActive: false }])('security changes invalidate tokens: %j', async change => {
  const response = await request(app()).put('/staff/20').send(change);
  expect(response.status).toBe(200);
  expect(written[0].tokenVersion).toEqual({ increment: 1 });
  if (change.password) {
    expect(await bcrypt.compare(change.password, written[0].password)).toBe(true);
    const audit = prisma.activityLog.create.mock.calls[0][0].data.details;
    expect(JSON.stringify(audit)).not.toContain(change.password);
    expect(JSON.stringify(audit)).not.toContain(written[0].password);
    expect(audit.passwordChanged).toBe(true);
  }
});
test('ordinary profile changes preserve sessions', async () => {
  expect((await request(app()).put('/staff/20').send({ fullName: 'New Name' })).status).toBe(200);
  expect(written[0].tokenVersion).toBeUndefined();
});
test('staff history is scoped to the target and excludes credential material', async () => {
  prisma.activityLog.findMany.mockResolvedValue([{ id: 1, action: 'UPDATE', createdAt: '2026-10-09', user: { fullName: 'Admin' }, details: { previous: { role: 'STAFF', password: 'oldhash' }, current: { role: 'MANAGER', password: 'newhash' }, passwordChanged: true } }]);
  const response = await request(app()).get('/staff/20/history');
  expect(response.status).toBe(200);
  expect(JSON.stringify(response.body)).not.toMatch(/oldhash|newhash/);
  expect(prisma.activityLog.findMany.mock.calls[0][0].where).toMatchObject({ entityId: 20, entityType: { in: ['STAFF', 'ROLE'] } });
});
test('activity rollback cannot bypass the delegation hierarchy', async () => {
  actor.userRole = 'MANAGER'; actor.userPermissions = ['MANAGE_STAFF', 'MANAGE_ORDERS'];
  const response = await request(app()).post('/rollback/5').send({});
  expect(response.status).toBe(403);
  expect(written).toEqual([]);
});
