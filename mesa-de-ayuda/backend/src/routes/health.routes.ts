import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    service: 'mesa-de-ayuda-api',
    timestamp: new Date().toISOString(),
  });
});

export default router;
