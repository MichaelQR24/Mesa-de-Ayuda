import { Router } from 'express';
import {
  listSharedLibrary,
  createSharedLibraryItem,
  updateSharedLibraryItem,
  deleteSharedLibraryItem,
} from '../controllers/library-admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate, requireRole(UserRole.ADMIN));

router.get('/', listSharedLibrary);
router.post('/', createSharedLibraryItem);
router.patch('/:id', updateSharedLibraryItem);
router.delete('/:id', deleteSharedLibraryItem);

export default router;
