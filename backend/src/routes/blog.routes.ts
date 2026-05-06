import { Router } from 'express';
import { blogController } from '../controllers/blog.controller.js';

const router = Router();

/**
 * @swagger
 * /api/blog:
 *   get:
 *     tags: [Blog]
 *     summary: Get blog posts list
 *     responses:
 *       200: { description: Blog posts list }
 */
router.get('/', blogController.getPosts);

/**
 * @swagger
 * /api/blog/{slug}:
 *   get:
 *     tags: [Blog]
 *     summary: Get blog post by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Blog post detail }
 */
router.get('/:slug', blogController.getPostBySlug);

export default router;
