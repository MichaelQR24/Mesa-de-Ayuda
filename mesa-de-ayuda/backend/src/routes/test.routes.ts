import { Router } from 'express';
import { handleTestPost } from '../controllers/test.controller.js';

const router = Router();

router.post('/', handleTestPost);

export default router;
