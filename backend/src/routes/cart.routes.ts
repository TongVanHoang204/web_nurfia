import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { cartController } from '../controllers/cart.controller.js';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get current user cart
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Cart items list }
 */
router.get('/', cartController.getCart);

/**
 * @swagger
 * /api/cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add item to cart
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity]
 *             properties:
 *               productId: { type: integer }
 *               variantId: { type: integer }
 *               quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Item added }
 */
router.post('/items', cartController.addItem);

/**
 * @swagger
 * /api/cart/items/{id}:
 *   put:
 *     tags: [Cart]
 *     summary: Update cart item quantity
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer }
 *     responses:
 *       200: { description: Item updated }
 *   delete:
 *     tags: [Cart]
 *     summary: Remove item from cart
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Item removed }
 */
router.put('/items/:id', cartController.updateItem);
router.delete('/items/:id', cartController.removeItem);

/**
 * @swagger
 * /api/cart:
 *   delete:
 *     tags: [Cart]
 *     summary: Clear the entire cart
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Cart cleared }
 */
router.delete('/', cartController.clearCart);

export default router;
