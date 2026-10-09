const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const testUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nurfia-upload-regression-'));
process.env.UPLOAD_DIR = path.relative(process.cwd(), testUploadDir);

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const sharp = require('sharp');
const prisma = require('../src/models/prisma').default;
const { authService } = require('../src/services/auth.service');
const uploadRoutes = require('../src/routes/upload.routes').default;
const { errorHandler } = require('../src/middlewares/errorHandler');

let token;
let image;
function app() {
  const server = express();
  server.use(cookieParser());
  server.use('/upload', uploadRoutes);
  server.use(errorHandler);
  return server;
}

beforeAll(async () => {
  token = authService.generateToken(7, 'CUSTOMER', 1);
  image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
});
beforeEach(() => {
  jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 7, role: 'CUSTOMER', permissions: [], isActive: true, tokenVersion: 1 });
});
afterEach(() => { for (const file of fs.readdirSync(testUploadDir)) fs.unlinkSync(path.join(testUploadDir, file)); });
afterAll(() => { fs.rmdirSync(testUploadDir); });

test('updated image libraries still accept an authenticated PNG payment proof', async () => {
  const response = await request(app()).post('/upload/payment-proof').set('Authorization', `Bearer ${token}`)
    .attach('image', image, { filename: 'proof.png', contentType: 'image/png' });
  expect(response.status).toBe(200);
  expect(response.body.data.url).toMatch(/^\/uploads\/proof-.*\.png$/);
  const storedImage = fs.readFileSync(path.join(testUploadDir, response.body.data.filename));
  const metadata = await sharp(storedImage).metadata();
  expect(metadata.format).toBe('png');
});

test('disguised executable content is rejected and removed after multipart parsing', async () => {
  const response = await request(app()).post('/upload/payment-proof').set('Authorization', `Bearer ${token}`)
    .attach('image', Buffer.from('<script>alert(1)</script>'), { filename: 'proof.png', contentType: 'image/png' });
  expect(response.status).toBe(400);
  expect(fs.readdirSync(testUploadDir)).toEqual([]);
});

test('an anonymous multipart upload is rejected before storing files', async () => {
  const response = await request(app()).post('/upload/payment-proof')
    .attach('image', image, { filename: 'proof.png', contentType: 'image/png' });
  expect(response.status).toBe(401);
  expect(fs.readdirSync(testUploadDir)).toEqual([]);
});
