import express from 'express';
import { productController } from '../controllers/product.controller.js';
import { reviewController } from '../controllers/review.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: Get paginated products list
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Products list }
 */
router.get('/', productController.getProducts);

/**
 * @swagger
 * /api/products/filters:
 *   get:
 *     tags: [Products]
 *     summary: Get product filter options (categories, brands, attributes)
 *     responses:
 *       200: { description: Filter options }
 */
router.get('/filters', productController.getFilterOptions);

/**
 * @swagger
 * /api/products/featured:
 *   get:
 *     tags: [Products]
 *     summary: Get featured products
 *     responses:
 *       200: { description: Featured products list }
 */
router.get('/featured', productController.getFeatured);

/**
 * @swagger
 * /api/products/bestsellers:
 *   get:
 *     tags: [Products]
 *     summary: Get best-selling products
 *     responses:
 *       200: { description: Bestsellers list }
 */
router.get('/bestsellers', productController.getBestsellers);

/**
 * @swagger
 * /api/products/new:
 *   get:
 *     tags: [Products]
 *     summary: Get newest products
 *     responses:
 *       200: { description: New products list }
 */
router.get('/new', productController.getNew);

/**
 * @swagger
 * /api/products/by-category/{categoryId}:
 *   get:
 *     tags: [Products]
 *     summary: Get products by category
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Products by category }
 */
router.get('/by-category/:categoryId', productController.getByCategory);

/**
 * @swagger
 * /api/products/{slug}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Product detail }
 */
router.get('/:slug', productController.getBySlug);

/**
 * @swagger
 * /api/products/{productId}/reviews/can-review:
 *   get:
 *     tags: [Products]
 *     summary: Check if user can review a product
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Can review status }
 */
router.get('/:productId/reviews/can-review', authenticate, reviewController.checkCanReview);

/**
 * @swagger
 * /api/products/{productId}/reviews:
 *   post:
 *     tags: [Products]
 *     summary: Create a product review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string }
 *     responses:
 *       201: { description: Review created }
 */
router.post('/:productId/reviews', authenticate, reviewController.createReview);

export default router;
