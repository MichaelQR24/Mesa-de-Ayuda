import { Router } from 'express';
import { getSessionsSummary, revokeUserSessions } from '../controllers/session-admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate, requireRole(UserRole.ADMIN));

router.get('/summary', getSessionsSummary);
router.post('/users/:id/revoke-sessions', revokeUserSessions);

export default router;
