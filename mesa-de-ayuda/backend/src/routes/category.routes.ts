import { Router } from 'express';
import { getCategories } from '../controllers/category.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', getCategories);

export default router;
