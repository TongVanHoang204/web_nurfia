import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { cartController } from '../controllers/cart.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.put('/items/:id', cartController.updateItem);
router.delete('/items/:id', cartController.removeItem);
router.delete('/', cartController.clearCart);

export default router;
