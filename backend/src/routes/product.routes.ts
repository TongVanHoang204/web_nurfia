import express from 'express';
import { productController } from '../controllers/product.controller.js';
import { reviewController } from '../controllers/review.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', productController.getProducts);
router.get('/filters', productController.getFilterOptions);
router.get('/featured', productController.getFeatured);
router.get('/bestsellers', productController.getBestsellers);
router.get('/new', productController.getNew);
router.get('/by-category/:categoryId', productController.getByCategory);
router.get('/:slug', productController.getBySlug);

// Reviews
router.get('/:productId/reviews/can-review', authenticate, reviewController.checkCanReview);
router.post('/:productId/reviews', authenticate, reviewController.createReview);

export default router;
