import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

/**
 * @swagger
 * /api/chat/history:
 *   get:
 *     tags: [Chat]
 *     summary: Get chat history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Chat history }
 *   post:
 *     tags: [Chat]
 *     summary: Save chat history
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages: { type: array, items: { type: object } }
 *     responses:
 *       200: { description: History saved }
 *   delete:
 *     tags: [Chat]
 *     summary: Delete chat history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: History deleted }
 */
router.get('/history', authenticate, chatController.getHistory);
router.post('/history', authenticate, chatController.saveHistory);
router.delete('/history', authenticate, chatController.deleteHistory);

export default router;
