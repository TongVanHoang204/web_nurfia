import { Router } from 'express';
import { settingController } from '../controllers/setting.controller.js';
import { authenticate, requireAdminAccess, requirePermission } from '../middlewares/auth.js';

const router = Router();

/**
 * @swagger
 * /api/settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get public site settings
 *     responses:
 *       200: { description: Site settings }
 */
router.get('/', settingController.getSettings);

/**
 * @swagger
 * /api/settings:
 *   put:
 *     tags: [Settings]
 *     summary: Update site settings (admin only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Settings updated }
 */
router.put('/', authenticate, requireAdminAccess, requirePermission('MANAGE_SETTINGS'), settingController.updateSettings);

export default router;
