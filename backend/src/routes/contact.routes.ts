import { Router } from 'express';
import { contactController } from '../controllers/contact.controller.js';
import { validate } from '../middlewares/validate.js';
import { createApiRateLimiter } from '../middlewares/rateLimit.js';
import { contactSchema, newsletterSchema } from '../validators/commerce.validator.js';

const router = Router();
const contactSubmitLimiter = createApiRateLimiter(15 * 60 * 1000, 10, 'Too many contact requests. Please try again later.');
const newsletterLimiter = createApiRateLimiter(15 * 60 * 1000, 20, 'Too many newsletter subscriptions. Please try again later.');

router.post('/', contactSubmitLimiter, validate(contactSchema), contactController.submitContact);
router.post('/newsletter', newsletterLimiter, validate(newsletterSchema), contactController.subscribeNewsletter);

export default router;
