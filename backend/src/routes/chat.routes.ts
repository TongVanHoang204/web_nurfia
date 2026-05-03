import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/history', authenticate, chatController.getHistory);
router.post('/history', authenticate, chatController.saveHistory);
router.delete('/history', authenticate, chatController.deleteHistory);

export default router;
