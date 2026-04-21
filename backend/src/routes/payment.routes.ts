import { Router } from 'express';
import { authenticate, requireCustomer } from '../middlewares/auth.js';
import { paymentController } from '../controllers/payment.controller.js';
import { createApiRateLimiter } from '../middlewares/rateLimit.js';

const router = Router();
const momoCreateLimiter = createApiRateLimiter(15 * 60 * 1000, 20, 'Too many payment creation requests. Please try again later.');
const momoIpnLimiter = createApiRateLimiter(60 * 1000, 120, 'Too many payment callback requests.');

router.post('/momo/create', momoCreateLimiter, authenticate, requireCustomer, paymentController.createMomoPayment);
router.post('/momo/ipn', momoIpnLimiter, paymentController.handleIpn);

export default router;
