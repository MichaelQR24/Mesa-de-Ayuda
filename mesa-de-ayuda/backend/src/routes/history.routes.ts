import { Router } from 'express';
import { getHistory } from '../controllers/history.controller.js';
import { authenticate, checkPasswordChangeRequired } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(checkPasswordChangeRequired);

router.get('/', getHistory);

export default router;
