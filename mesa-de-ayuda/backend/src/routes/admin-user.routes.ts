import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  updateUsageLimit,
} from '../controllers/admin-user.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';

const router = Router();

// Todas las rutas de administración requieren autenticación y rol ADMIN
router.use(authenticate, requireRole(UserRole.ADMIN));

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.patch('/:id/status', updateUserStatus);
router.post('/:id/reset-password', resetUserPassword);
router.patch('/:id/usage-limit', updateUsageLimit);

export default router;
