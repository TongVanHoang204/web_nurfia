import { Router } from 'express';
import { authenticate, requireCustomer } from '../middlewares/auth.js';
import { paymentController } from '../controllers/payment.controller.js';
import { createApiRateLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { createMomoPaymentSchema, createStripeCheckoutSessionSchema } from '../validators/commerce.validator.js';

const router = Router();
const momoCreateLimiter = createApiRateLimiter(15 * 60 * 1000, 20, 'Too many payment creation requests. Please try again later.');
const momoIpnLimiter = createApiRateLimiter(60 * 1000, 120, 'Too many payment callback requests.');
const stripeCreateLimiter = createApiRateLimiter(15 * 60 * 1000, 20, 'Too many payment creation requests. Please try again later.');
const stripeWebhookLimiter = createApiRateLimiter(60 * 1000, 120, 'Too many payment callback requests.');

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
router.post('/momo/create', momoCreateLimiter, authenticate, requireCustomer, validate(createMomoPaymentSchema), paymentController.createMomoPayment);

/**
 * @swagger
 * /api/payment/stripe/create-checkout-session:
 *   post:
 *     tags: [Payment]
 *     summary: Create Stripe Checkout Session
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
 *               returnUrl: { type: string }
 *     responses:
 *       200: { description: Stripe Checkout Session URL }
 */
router.post('/stripe/create-checkout-session', stripeCreateLimiter, authenticate, requireCustomer, validate(createStripeCheckoutSessionSchema), paymentController.createStripeCheckoutSession);

/**
 * @swagger
 * /api/payment/stripe/webhook:
 *   post:
 *     tags: [Payment]
 *     summary: Stripe webhook callback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       204: { description: Webhook received }
 */
router.post('/stripe/webhook', stripeWebhookLimiter, paymentController.handleStripeWebhook);

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
