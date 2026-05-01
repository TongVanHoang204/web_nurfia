import { Router } from 'express';
import { aiController } from '../controllers/ai.controller.js';
import { optionalAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/chat', optionalAuth, aiController.chat as any);

export default router;
