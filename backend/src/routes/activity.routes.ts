import { Router } from 'express';
import { activityController } from '../controllers/activity.controller.js';
import { authenticate, requireAdminAccess, requirePermission } from '../middlewares/auth.js';

const router = Router();

router.get('/activities', authenticate, requireAdminAccess, requirePermission('VIEW_ACTIVITY_LOGS'), activityController.getLogs);

export default router;
