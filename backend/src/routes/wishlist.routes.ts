import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { wishlistController } from '../controllers/wishlist.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addItem);
router.delete('/:productId', wishlistController.removeItem);

export default router;
