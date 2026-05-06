import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { wishlistController } from '../controllers/wishlist.controller.js';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/wishlist:
 *   get:
 *     tags: [Wishlist]
 *     summary: Get user wishlist
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Wishlist items }
 *   post:
 *     tags: [Wishlist]
 *     summary: Add item to wishlist
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
 *     tags: [Wishlist]
 *     summary: Clear wishlist
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Wishlist cleared }
 */
router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addItem);

/**
 * @swagger
 * /api/wishlist/{productId}:
 *   delete:
 *     tags: [Wishlist]
 *     summary: Remove item from wishlist
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Item removed }
 */
router.delete('/:productId', wishlistController.removeItem);

export default router;
