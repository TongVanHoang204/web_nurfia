import { Router } from 'express';
import { contactController } from '../controllers/contact.controller.js';
import { validate } from '../middlewares/validate.js';
import { createApiRateLimiter } from '../middlewares/rateLimit.js';
import { contactSchema, newsletterSchema } from '../validators/commerce.validator.js';

const router = Router();
const contactSubmitLimiter = createApiRateLimiter(15 * 60 * 1000, 10, 'Too many contact requests. Please try again later.');
const newsletterLimiter = createApiRateLimiter(15 * 60 * 1000, 20, 'Too many newsletter subscriptions. Please try again later.');

/**
 * @swagger
 * /api/contact:
 *   post:
 *     tags: [Contact]
 *     summary: Submit a contact form
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, message]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               message: { type: string }
 *               subject: { type: string }
 *     responses:
 *       200: { description: Message sent }
 */
router.post('/', contactSubmitLimiter, validate(contactSchema), contactController.submitContact);

/**
 * @swagger
 * /api/contact/newsletter:
 *   post:
 *     tags: [Contact]
 *     summary: Subscribe to newsletter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: Subscribed }
 */
router.post('/newsletter', newsletterLimiter, validate(newsletterSchema), contactController.subscribeNewsletter);

export default router;
