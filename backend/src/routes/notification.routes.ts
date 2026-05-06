import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notifications list }
 */
router.get('/', notificationController.getNotifications);

/**
 * @swagger
 * /api/notifications/read-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Marked as read }
 */
router.put('/read-all', notificationController.markAllAsRead);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Notification marked as read }
 */
router.put('/:id/read', notificationController.markAsRead);

export default router;
