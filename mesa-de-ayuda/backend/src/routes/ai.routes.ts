import { Router } from 'express';
import { processAiText } from '../controllers/ai.controller.js';
import { authenticate, checkPasswordChangeRequired } from '../middleware/auth.middleware.js';
import { aiLimiter } from '../middleware/rate-limit.js';

const router = Router();

router.use(authenticate);
router.use(checkPasswordChangeRequired);

router.post('/process', aiLimiter, processAiText);

export default router;
