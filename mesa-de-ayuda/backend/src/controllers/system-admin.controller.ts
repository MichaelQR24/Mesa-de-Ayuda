import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { usageService } from '../services/usage.service.js';

export const getSystemHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  let dbStatus: 'connected' | 'slow' | 'disconnected' = 'disconnected';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;

    if (dbLatencyMs > 1500) {
      dbStatus = 'slow';
    } else {
      dbStatus = 'connected';
    }
  } catch (error) {
    dbStatus = 'disconnected';
    dbLatencyMs = Date.now() - startTime;
  }

  try {
    // Obtener métricas resumidas sin llamadas artificiales a Groq
    let summary: any = null;
    try {
      summary = await usageService.getSummaryMetrics();
    } catch {
      // Si la DB tiene problemas, permitimos continuar con datos por defecto
    }

    const memoryUsage = process.memoryUsage();
    const heapUsedMb = Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100;
    const heapTotalMb = Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100;
    const rssMb = Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100;

    const isSystemHealthy = dbStatus === 'connected';

    res.status(200).json({
      success: true,
      status: isSystemHealthy ? 'healthy' : dbStatus === 'slow' ? 'degraded' : 'unhealthy',
      version: {
        backend: '1.0.0',
      },
      environment: env.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        heapUsedMb,
        heapTotalMb,
        rssMb,
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      ai: {
        status: 'operational',
        model: env.GROQ_MODEL || 'llama-3.1-8b-instant',
        requestsToday: summary?.usage?.requestsToday ?? 0,
        requestsMonth: summary?.usage?.requestsMonth ?? 0,
        totalTokensMonth: summary?.usage?.totalTokensMonth ?? 0,
        estimatedCostUsd: summary?.usage?.estimatedCostUsd ?? '$0.00',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
