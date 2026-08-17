import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUserStatus,
  resetUserPassword,
} from '../controllers/admin-user.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';

const router = Router();

// Todas las rutas administrativas requieren autenticación y rol ADMIN
router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id/status', updateUserStatus);
router.post('/:id/reset-password', resetUserPassword);

export default router;
