import { Router } from 'express';
import { authenticate, checkPasswordChangeRequired } from '../middleware/auth.middleware.js';
import { quickTextController } from '../controllers/quick-text.controller.js';

const router = Router();

// Todas las rutas de textos rápidos requieren autenticación y contraseña actualizada
router.use(authenticate);
router.use(checkPasswordChangeRequired);

router.get('/', (req, res) => quickTextController.getQuickTexts(req, res));
router.post('/', (req, res) => quickTextController.createQuickText(req, res));
router.patch('/:id', (req, res) => quickTextController.updateQuickText(req, res));
router.delete('/:id', (req, res) => quickTextController.deleteQuickText(req, res));

export const quickTextRoutes = router;
