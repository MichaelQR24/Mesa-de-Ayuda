import { Router } from 'express';
import { login, refreshToken, logout, getMe, changePassword, updatePrivacy } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rate-limit.js';

const router = Router();

// Rutas públicas con rate limiting estricto
router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Rutas protegidas que requieren token de acceso
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);
router.patch('/privacy', authenticate, updatePrivacy);

export default router;
