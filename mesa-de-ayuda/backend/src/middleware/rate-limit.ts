import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { Request, Response } from 'express';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 200,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const requestId = (req as any).requestId || undefined;
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas solicitudes desde esta IP, por favor intenta nuevamente más tarde.',
        source: 'rate-limit',
        requestId,
      },
    });
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const requestId = (req as any).requestId || undefined;
    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Demasiados intentos de inicio de sesión. Por favor, intente nuevamente en 15 minutos.',
        source: 'rate-limit',
        requestId,
      },
    });
  },
});

export const aiLimiter = rateLimit({
  windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  limit: env.AI_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request, _res: Response): string => {
    return req.user?.id || req.ip || 'anonymous';
  },
  handler: (req: Request, res: Response) => {
    const requestId = (req as any).requestId || undefined;
    res.status(429).json({
      success: false,
      error: {
        code: 'AI_RATE_LIMIT_EXCEEDED',
        message: 'Has superado el límite de velocidad de consultas de IA por minuto. Por favor, espera unos instantes.',
        source: 'rate-limit',
        requestId,
      },
    });
  },
});
