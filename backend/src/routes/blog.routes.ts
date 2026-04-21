import { Router } from 'express';
import { blogController } from '../controllers/blog.controller.js';

const router = Router();

router.get('/', blogController.getPosts);
router.get('/:slug', blogController.getPostBySlug);

export default router;
