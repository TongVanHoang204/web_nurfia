import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { compareController } from '../controllers/compare.controller.js';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/compare:
 *   get:
 *     tags: [Compare]
 *     summary: Get compare list
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Compare list }
 *   post:
 *     tags: [Compare]
 *     summary: Add product to compare
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: integer }
 *     responses:
 *       200: { description: Item added }
 *   delete:
 *     tags: [Compare]
 *     summary: Clear compare list
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Compare cleared }
 */
router.get('/', compareController.getCompareItems);
router.post('/', compareController.addItem);

/**
 * @swagger
 * /api/compare/{productId}:
 *   delete:
 *     tags: [Compare]
 *     summary: Remove product from compare
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Item removed }
 */
router.delete('/:productId', compareController.removeItem);
router.delete('/', compareController.clearCompare);

export default router;
