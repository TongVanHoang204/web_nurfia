import { Router } from 'express';
import { authenticate, requireCustomer } from '../middlewares/auth.js';
import { paymentController } from '../controllers/payment.controller.js';
import { createApiRateLimiter } from '../middlewares/rateLimit.js';

const router = Router();
const momoCreateLimiter = createApiRateLimiter(15 * 60 * 1000, 20, 'Too many payment creation requests. Please try again later.');
const momoIpnLimiter = createApiRateLimiter(60 * 1000, 120, 'Too many payment callback requests.');

/**
 * @swagger
 * /api/payment/momo/create:
 *   post:
 *     tags: [Payment]
 *     summary: Create MoMo payment request
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: integer }
 *               redirectUrl: { type: string }
 *     responses:
 *       200: { description: MoMo payment URL }
 */
router.post('/momo/create', momoCreateLimiter, authenticate, requireCustomer, paymentController.createMomoPayment);

/**
 * @swagger
 * /api/payment/momo/ipn:
 *   post:
 *     tags: [Payment]
 *     summary: MoMo payment IPN callback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: IPN received }
 */
router.post('/momo/ipn', momoIpnLimiter, paymentController.handleIpn);

export default router;
