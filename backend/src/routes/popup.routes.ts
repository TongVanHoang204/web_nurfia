import { Router } from 'express';
import { popupController } from '../controllers/popup.controller.js';

const router = Router();

router.get('/homepage', popupController.getActiveHomePopup);

export default router;
