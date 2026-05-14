import { Router } from 'express';
import { aiController } from '../controllers/ai.controller.js';
import { authenticate, optionalAuth, requireAdminAccess } from '../middlewares/auth.js';
import { createApiRateLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { aiAdminGenerateSchema, aiChatSchema } from '../validators/ai.validator.js';

const router = Router();
const aiChatLimiter = createApiRateLimiter(60 * 1000, 10, 'Too many AI chat requests. Please try again later.');
const aiAdminGenerateLimiter = createApiRateLimiter(60 * 1000, 20, 'Too many AI generator requests. Please try again later.');

router.post('/chat', aiChatLimiter, validate(aiChatSchema), optionalAuth, aiController.chat as any);
router.post('/admin/generate', aiAdminGenerateLimiter, validate(aiAdminGenerateSchema), authenticate, requireAdminAccess, aiController.generateAdminContent as any);

export default router;
