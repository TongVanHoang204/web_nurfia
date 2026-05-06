import { Router } from 'express';
import { aiController } from '../controllers/ai.controller.js';
import { optionalAuth } from '../middlewares/auth.js';
import { createApiRateLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { aiChatSchema } from '../validators/ai.validator.js';

const router = Router();
const aiChatLimiter = createApiRateLimiter(60 * 1000, 10, 'Too many AI chat requests. Please try again later.');

router.post('/chat', aiChatLimiter, validate(aiChatSchema), optionalAuth, aiController.chat as any);

export default router;
