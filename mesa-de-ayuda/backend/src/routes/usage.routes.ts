import { Router } from 'express';
import { getUsageSummary, getUserUsage } from '../controllers/usage.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate, requireRole(UserRole.ADMIN));

router.get('/summary', getUsageSummary);
router.get('/users', getUserUsage);

export default router;
