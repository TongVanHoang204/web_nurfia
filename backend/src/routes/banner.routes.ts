import { Router } from 'express';
import { bannerController } from '../controllers/banner.controller.js';

const router = Router();

/**
 * @swagger
 * /api/banners:
 *   get:
 *     tags: [Banners]
 *     summary: Get all active banners
 *     responses:
 *       200: { description: Banners list }
 */
router.get('/', bannerController.getBanners);

export default router;
