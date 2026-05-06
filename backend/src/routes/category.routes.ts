import { Router } from 'express';
import { categoryController } from '../controllers/category.controller.js';

const router = Router();

/**
 * @swagger
 * /api/categories:
 *   get:
 *     tags: [Categories]
 *     summary: Get all categories
 *     responses:
 *       200: { description: Categories list }
 */
router.get('/', categoryController.getCategories);

/**
 * @swagger
 * /api/categories/{slug}:
 *   get:
 *     tags: [Categories]
 *     summary: Get category by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Category detail }
 */
router.get('/:slug', categoryController.getCategoryBySlug);

export default router;
