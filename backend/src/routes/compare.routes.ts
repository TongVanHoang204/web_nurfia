import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { compareController } from '../controllers/compare.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', compareController.getCompareItems);
router.post('/', compareController.addItem);
router.delete('/:productId', compareController.removeItem);
router.delete('/', compareController.clearCompare);

export default router;
