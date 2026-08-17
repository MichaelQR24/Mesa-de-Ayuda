import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import healthRoutes from './routes/health.routes.js';
import testRoutes from './routes/test.routes.js';
import aiRoutes from './routes/ai.routes.js';
import historyRoutes from './routes/history.routes.js';
import libraryRoutes from './routes/library.routes.js';
import categoryRoutes from './routes/category.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminUserRoutes from './routes/admin-user.routes.js';
import usageRoutes from './routes/usage.routes.js';
import auditRoutes from './routes/audit.routes.js';
import sessionAdminRoutes from './routes/session-admin.routes.js';
import libraryAdminRoutes from './routes/library-admin.routes.js';

export const createApp = (): Express => {
  const app = express();

  // 0. Configurar confianza en el proxy de Render para headers X-Forwarded-* (IP real y HTTPS)
  app.set('trust proxy', 1);

  // 1. Inyección de Request ID seguro
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incomingId = req.headers['x-request-id'];
    const requestId = typeof incomingId === 'string' && incomingId.length <= 64 ? incomingId : randomUUID();
    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // 2. Cabeceras de seguridad HTTP con Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // APIs REST no renderizan HTML
      crossOriginEmbedderPolicy: false,
    })
  );

  // 3. CORS con Allowlist Estricta
  const allowedOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const allowedExtensionIds = env.ALLOWED_EXTENSION_IDS
    ? env.ALLOWED_EXTENSION_IDS.split(',').map((id) => id.trim()).filter(Boolean)
    : [];

  app.use(
    cors({
      origin: (origin, callback) => {
        // En tests o llamadas sin origen (herramientas locales/curl)
        if (!origin) {
          return callback(null, true);
        }

        // Entorno de desarrollo / pruebas: permitir localhost y cualquier extensión local si no hay IDs restringidos
        if (env.NODE_ENV !== 'production') {
          if (
            origin.startsWith('chrome-extension://') ||
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            allowedOrigins.includes(origin)
          ) {
            return callback(null, true);
          }
        }

        // Producción: verificar contra orígenes configurados o IDs de extensión explícitos
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        if (origin.startsWith('chrome-extension://')) {
          const extensionId = origin.replace('chrome-extension://', '');
          if (allowedExtensionIds.length === 0 || allowedExtensionIds.includes(extensionId)) {
            return callback(null, true);
          }
        }

        callback(new Error('Bloqueado por política CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      credentials: true,
    })
  );

  // 4. Body Parser con límite seguro de 50kb
  app.use(express.json({ limit: '50kb' }));

  // 5. Logger estructurado, minimalista y seguro (sin volcar passwords, tokens ni payloads)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = (req as any).requestId;
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (env.NODE_ENV !== 'test') {
        const userId = (req as any).user?.id || 'anon';
        console.log(`[${new Date().toISOString()}] [${requestId}] [${userId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // 6. Endpoint Health Check
  app.use('/health', healthRoutes);

  // 7. Rutas de la API v1 con Rate Limiting
  app.use('/api', apiLimiter);
  app.use('/api/v1/auth', authRoutes);

  // Rutas administrativas (Solo ADMIN)
  app.use('/api/v1/admin/users', adminUserRoutes);
  app.use('/api/v1/admin/usage', usageRoutes);
  app.use('/api/v1/admin/audit', auditRoutes);
  app.use('/api/v1/admin/sessions', sessionAdminRoutes);
  app.use('/api/v1/admin/library', libraryAdminRoutes);

  // Rutas operativas
  app.use('/api/v1/test', testRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/history', historyRoutes);
  app.use('/api/v1/library', libraryRoutes);
  app.use('/api/v1/categories', categoryRoutes);

  // 8. Manejo de 404 para rutas inexistentes
  app.use(notFoundHandler);

  // 9. Manejador de errores centralizado
  app.use(errorHandler);

  return app;
};

export const app = createApp();
