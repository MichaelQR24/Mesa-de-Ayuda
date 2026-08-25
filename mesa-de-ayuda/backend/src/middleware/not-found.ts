import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = (req as any).requestId || undefined;
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Ruta no encontrada',
      source: 'backend',
      requestId,
    },
  });
};
