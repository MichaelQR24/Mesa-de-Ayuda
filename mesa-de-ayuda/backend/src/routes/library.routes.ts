import { Router } from 'express';
import {
  getLibraryItems,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
} from '../controllers/library.controller.js';
import { authenticate, checkPasswordChangeRequired } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(checkPasswordChangeRequired);

router.get('/', getLibraryItems);
router.post('/', createLibraryItem);
router.patch('/:id', updateLibraryItem);
router.delete('/:id', deleteLibraryItem);

export default router;
