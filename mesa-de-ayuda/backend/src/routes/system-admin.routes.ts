import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';
import { getSystemHealth } from '../controllers/system-admin.controller.js';

const router = Router();

// Todas las rutas requieren ADMIN autenticado
router.use(authenticate, requireRole(UserRole.ADMIN));

router.get('/health', getSystemHealth);

export default router;
