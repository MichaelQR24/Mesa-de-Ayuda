import { Router } from 'express';
import { authenticate, checkPasswordChangeRequired, requireRole } from '../middleware/auth.middleware.js';
import { guideController } from '../controllers/guide.controller.js';
import { UserRole } from '@prisma/client';

const router = Router();

// Todas las rutas de guías requieren autenticación y contraseña actualizada
router.use(authenticate);
router.use(checkPasswordChangeRequired);

// Consultas públicas para cualquier usuario autenticado (USER y ADMIN)
router.get('/', (req, res) => guideController.getGuides(req, res));
router.get('/:id', (req, res) => guideController.getGuideById(req, res));

// Operaciones de administración (Solo ADMIN)
router.post('/', requireRole(UserRole.ADMIN), (req, res) => guideController.createGuide(req, res));
router.patch('/:id', requireRole(UserRole.ADMIN), (req, res) => guideController.updateGuide(req, res));
router.delete('/:id', requireRole(UserRole.ADMIN), (req, res) => guideController.deleteGuide(req, res));

export const guideRoutes = router;
