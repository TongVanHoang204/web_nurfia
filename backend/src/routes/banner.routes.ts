import { Router } from 'express';
import { bannerController } from '../controllers/banner.controller.js';

const router = Router();

router.get('/', bannerController.getBanners);

export default router;
