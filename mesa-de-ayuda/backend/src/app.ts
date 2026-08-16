import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import healthRoutes from './routes/health.routes.js';
import testRoutes from './routes/test.routes.js';

export const createApp = (): Express => {
  const app = express();

  // 1. Seguridad de cabeceras HTTP
  app.use(helmet());

  // 2. Configuración CORS centralizada
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Permitir solicitudes sin origin (como herramientas locales o curl) o si coincide con la configuración
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
          callback(null, true);
        } else {
          callback(new Error('Bloqueado por política CORS'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // 3. Body Parser con límite seguro de 50kb
  app.use(express.json({ limit: '50kb' }));

  // 4. Logger minimalista y seguro (método, ruta, status, tiempo; sin volcar contenido de body)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (env.NODE_ENV !== 'test') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // 5. Endpoint Health Check
  app.use('/health', healthRoutes);

  // 6. Rutas de la API v1 con Rate Limiting
  app.use('/api', apiLimiter);
  app.use('/api/v1/test', testRoutes);

  // 7. Manejo de 404 para rutas inexistentes
  app.use(notFoundHandler);

  // 8. Manejador de errores centralizado
  app.use(errorHandler);

  return app;
};

export const app = createApp();
