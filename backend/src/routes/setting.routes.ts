import { Router } from 'express';
import { settingController } from '../controllers/setting.controller.js';
import { authenticate, requireAdminAccess, requirePermission } from '../middlewares/auth.js';

const router = Router();

router.get('/', settingController.getSettings);
router.put('/', authenticate, requireAdminAccess, requirePermission('MANAGE_SETTINGS'), settingController.updateSettings);

export default router;
