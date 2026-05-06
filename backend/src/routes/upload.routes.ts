import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import config from '../config/index.js';
import { authenticate } from '../middlewares/auth.js';
import { uploadController } from '../controllers/upload.controller.js';
import { createApiRateLimiter } from '../middlewares/rateLimit.js';

const uploadDir = path.join(process.cwd(), config.upload.dir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const { name, ext } = path.parse(file.originalname);
    const safeName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 50) || 'file';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${safeName}-${uniqueSuffix}${ext.toLowerCase()}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const imageExt = ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.ico'];
  const videoExt = ['.mp4', '.webm', '.mov', '.m4v'];
  const imageMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];
  const videoMime = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();
  const isAllowed = (imageExt.includes(ext) && imageMime.includes(mime))
    || (videoExt.includes(ext) && videoMime.includes(mime));

  if (isAllowed) {
    cb(null, true);
    return;
  }

  cb(new Error('Only image or video files (jpg, png, webp, gif, ico, mp4, webm, mov, m4v) are allowed.'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: config.upload.maxFileSize } });
const singleUploadLimiter = createApiRateLimiter(15 * 60 * 1000, 60, 'Too many upload requests. Please try again later.');
const multipleUploadLimiter = createApiRateLimiter(15 * 60 * 1000, 20, 'Too many bulk upload requests. Please try again later.');

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/upload:
 *   post:
 *     tags: [Upload]
 *     summary: Upload a single image file
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image: { type: string, format: binary }
 *     responses:
 *       200: { description: File uploaded }
 */
router.post('/', singleUploadLimiter, upload.single('image'), uploadController.uploadSingle);

/**
 * @swagger
 * /api/upload/multiple:
 *   post:
 *     tags: [Upload]
 *     summary: Upload multiple images
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images: { type: array, items: { type: string, format: binary } }
 *     responses:
 *       200: { description: Files uploaded }
 */
router.post('/multiple', multipleUploadLimiter, upload.array('images', 10), uploadController.uploadMultiple);

export default router;
