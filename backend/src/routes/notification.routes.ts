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
 * /api/notifications:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete multiple notifications
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       200: { description: Notifications deleted }
 */
router.delete('/', notificationController.deleteNotifications);

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

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Notification deleted }
 */
router.delete('/:id', notificationController.deleteNotification);

export default router;
