import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  let dbStatus: 'healthy' | 'unhealthy' = 'unhealthy';
  let isHealthy = false;

  try {
    // Timeout de 2.5 segundos para la verificación de base de datos
    const dbCheckPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB_TIMEOUT')), 2500)
    );

    await Promise.race([dbCheckPromise, timeoutPromise]);
    dbStatus = 'healthy';
    isHealthy = true;
  } catch (error) {
    dbStatus = 'unhealthy';
    isHealthy = false;
  }

  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'mesa-de-ayuda-api',
    version: '1.0.0',
    checks: {
      database: dbStatus,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
