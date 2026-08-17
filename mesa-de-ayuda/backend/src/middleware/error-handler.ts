import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = (req as any).requestId || undefined;

  // Manejo de errores de validación de Zod
  if (err instanceof ZodError || (err && typeof err === 'object' && 'issues' in err)) {
    const zodErr = err as ZodError;
    const details = (zodErr.issues || []).map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        details,
        requestId,
      },
    });
    return;
  }

  // Manejo de JSON body malformado
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'El cuerpo de la solicitud no es un JSON válido',
        requestId,
      },
    });
    return;
  }

  // Manejo de errores controlados con código personalizado
  if (err && typeof err === 'object' && 'code' in err && typeof (err as any).code === 'string') {
    const customErr = err as { code: string; message: string; statusCode?: number };
    const statusCode = customErr.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: customErr.code,
        message: customErr.message || 'Error al procesar la solicitud',
        requestId,
      },
    });
    return;
  }

  // Error genérico seguro sin filtrar stack traces o datos internos
  console.error(`[ErrorHandler] [${requestId || 'no-id'}] Error no controlado:`, err instanceof Error ? err.message : err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error inesperado en el servidor.',
      requestId,
    },
  });
};
