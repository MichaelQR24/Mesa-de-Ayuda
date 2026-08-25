import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export type ErrorSource =
  | 'frontend'
  | 'validation'
  | 'auth'
  | 'backend'
  | 'database'
  | 'groq'
  | 'rate-limit'
  | 'network'
  | 'unknown';

export function resolveErrorSource(code?: string, explicitSource?: ErrorSource): ErrorSource {
  if (explicitSource) return explicitSource;
  if (!code) return 'backend';

  if (code === 'VALIDATION_ERROR' || code === 'INVALID_JSON' || code === 'SENSITIVE_DATA_BLOCKED') {
    return 'validation';
  }
  if (
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    code === 'ACCOUNT_INACTIVE' ||
    code === 'TOKEN_REUSE_DETECTED' ||
    code === 'INVALID_REFRESH_TOKEN' ||
    code === 'INVALID_CREDENTIALS' ||
    code === 'PASSWORD_SAME_AS_CURRENT' ||
    code === 'MUST_CHANGE_PASSWORD'
  ) {
    return 'auth';
  }
  if (code.startsWith('AI_') || code === 'GROQ_ERROR') {
    return 'groq';
  }
  if (code === 'RATE_LIMIT_EXCEEDED' || code === 'MONTHLY_AI_LIMIT_REACHED') {
    return 'rate-limit';
  }
  if (code.startsWith('DATABASE_') || code.startsWith('PRISMA_') || code === 'P2002' || code === 'P2025') {
    return 'database';
  }
  if (code === 'NETWORK_ERROR' || code === 'SERVER_UNREACHABLE') {
    return 'network';
  }
  return 'backend';
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = (req as any).requestId || undefined;
  const userId = (req as any).user?.id || 'anon';

  // 1. Manejo de errores de validación de Zod
  if (err instanceof ZodError || (err && typeof err === 'object' && 'issues' in err)) {
    const zodErr = err as ZodError;
    const details = (zodErr.issues || []).map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    const source: ErrorSource = 'validation';
    const code = 'VALIDATION_ERROR';

    console.warn(`[${new Date().toISOString()}] [${requestId || 'no-id'}] [${userId}] WARN ${req.method} ${req.originalUrl} -> status=400 code=${code} source=${source}`);

    res.status(400).json({
      success: false,
      error: {
        code,
        message: 'Datos de entrada inválidos',
        source,
        details,
        requestId,
      },
    });
    return;
  }

  // 2. Manejo de JSON body malformado
  if (err instanceof SyntaxError && 'body' in err) {
    const source: ErrorSource = 'validation';
    const code = 'INVALID_JSON';

    console.warn(`[${new Date().toISOString()}] [${requestId || 'no-id'}] [${userId}] WARN ${req.method} ${req.originalUrl} -> status=400 code=${code} source=${source}`);

    res.status(400).json({
      success: false,
      error: {
        code,
        message: 'El cuerpo de la solicitud no es un JSON válido',
        source,
        requestId,
      },
    });
    return;
  }

  // 3. Manejo de errores de Prisma / Base de datos
  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    const source: ErrorSource = 'database';
    const code = 'DATABASE_ERROR';

    console.error(`[${new Date().toISOString()}] [${requestId || 'no-id'}] [${userId}] ERROR ${req.method} ${req.originalUrl} -> status=500 code=${code} source=${source}`);

    res.status(500).json({
      success: false,
      error: {
        code,
        message: 'Ocurrió un problema de persistencia en la base de datos.',
        source,
        requestId,
      },
    });
    return;
  }

  // 4. Manejo de errores controlados con código personalizado
  if (err && typeof err === 'object' && 'code' in err && typeof (err as any).code === 'string') {
    const customErr = err as { code: string; message: string; statusCode?: number; source?: ErrorSource };
    const statusCode = customErr.statusCode || 500;
    const source = resolveErrorSource(customErr.code, customErr.source);

    console.error(`[${new Date().toISOString()}] [${requestId || 'no-id'}] [${userId}] ERROR ${req.method} ${req.originalUrl} -> status=${statusCode} code=${customErr.code} source=${source}`);

    res.status(statusCode).json({
      success: false,
      error: {
        code: customErr.code,
        message: customErr.message || 'Error al procesar la solicitud',
        source,
        requestId,
      },
    });
    return;
  }

  // 5. Error genérico no controlado (sin filtrar datos internos ni stack traces)
  const source: ErrorSource = 'backend';
  const code = 'INTERNAL_SERVER_ERROR';

  console.error(`[${new Date().toISOString()}] [${requestId || 'no-id'}] [${userId}] UNCAUGHT_ERROR ${req.method} ${req.originalUrl} -> status=500 code=${code} source=${source}:`, err instanceof Error ? err.message : err);

  res.status(500).json({
    success: false,
    error: {
      code,
      message: 'Ocurrió un error inesperado en el servidor.',
      source,
      requestId,
    },
  });
};
