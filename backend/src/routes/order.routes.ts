import { Router } from 'express';
import { authenticate, requireCustomer } from '../middlewares/auth.js';
import { orderController } from '../controllers/order.controller.js';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/orders/validate-coupon:
 *   post:
 *     tags: [Orders]
 *     summary: Validate a coupon code
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, subtotal]
 *             properties:
 *               code: { type: string }
 *               subtotal: { type: number }
 *     responses:
 *       200: { description: Coupon validated }
 */
router.post('/validate-coupon', requireCustomer, orderController.validateCoupon);

/**
 * @swagger
 * /api/orders/shipping-options:
 *   post:
 *     tags: [Orders]
 *     summary: Get available shipping options for address
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shippingProvince, shippingDistrict, shippingWard]
 *             properties:
 *               shippingProvince: { type: string }
 *               shippingDistrict: { type: string }
 *               shippingWard: { type: string }
 *     responses:
 *       200: { description: Shipping options list }
 */
router.post('/shipping-options', requireCustomer, orderController.getShippingOptions);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     tags: [Orders]
 *     summary: Place a new order
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentMethod, shippingMethodId, shippingName, shippingPhone, shippingEmail, shippingProvince, shippingDistrict, shippingWard, shippingStreet]
 *             properties:
 *               paymentMethod: { type: string, enum: [COD, BANK_TRANSFER, MOMO] }
 *               shippingMethodId: { type: integer }
 *               shippingName: { type: string }
 *               shippingPhone: { type: string }
 *               shippingEmail: { type: string }
 *               shippingProvince: { type: string }
 *               shippingDistrict: { type: string }
 *               shippingWard: { type: string }
 *               shippingStreet: { type: string }
 *               couponCode: { type: string }
 *               note: { type: string }
 *     responses:
 *       201: { description: Order created successfully }
 */
router.post('/', requireCustomer, orderController.createOrder);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     tags: [Orders]
 *     summary: Get user's orders
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Orders list }
 */
router.get('/', orderController.getOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get order by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Order detail }
 */
router.get('/:id', orderController.getOrderById);

/**
 * @swagger
 * /api/orders/{id}/bank-transfer-proof:
 *   get:
 *     tags: [Orders]
 *     summary: Get bank transfer proof image
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Proof image }
 *   post:
 *     tags: [Orders]
 *     summary: Upload bank transfer proof image
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Proof uploaded }
 */
router.get('/:id/bank-transfer-proof', orderController.getBankTransferProof);
router.post('/:id/bank-transfer-proof', orderController.uploadBankTransferProof);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel an order
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Order cancelled }
 */
router.post('/:id/cancel', orderController.cancelOrder);

/**
 * @swagger
 * /api/orders/{id}/reorder:
 *   post:
 *     tags: [Orders]
 *     summary: Reorder from previous order
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Items added to cart }
 */
router.post('/:id/reorder', orderController.reorder);

export default router;
