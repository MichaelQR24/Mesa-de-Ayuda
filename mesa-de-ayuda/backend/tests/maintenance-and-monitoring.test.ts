import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';
import { userRepository } from '../src/repositories/user.repository.js';
import { usageService } from '../src/services/usage.service.js';

describe('Mantenimiento, Monitoreo y Health Checks (Fase 15)', () => {
  const adminToken = generateAccessToken({
    sub: 'admin-monitor-uuid',
    email: 'admin@monitor.com',
    displayName: 'Admin Monitor',
    role: UserRole.ADMIN,
    mustChangePassword: false,
  });

  const userToken = generateAccessToken({
    sub: 'user-regular-uuid',
    email: 'user@regular.com',
    displayName: 'User Regular',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(userRepository, 'findSafeById').mockImplementation(async (id: string) => {
      if (id === 'admin-monitor-uuid') {
        return {
          id: 'admin-monitor-uuid',
          email: 'admin@monitor.com',
          displayName: 'Admin Monitor',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          monthlyTokenLimit: null,
          saveAiHistory: true,
          lastLoginAt: new Date(),
          passwordChangedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      if (id === 'user-regular-uuid') {
        return {
          id: 'user-regular-uuid',
          email: 'user@regular.com',
          displayName: 'User Regular',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          monthlyTokenLimit: 50000,
          saveAiHistory: true,
          lastLoginAt: new Date(),
          passwordChangedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return null;
    });
  });

  describe('1. Health Check Público (/health)', () => {
    it('debe responder HTTP 200 con status healthy cuando la base de datos está conectada', async () => {
      vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }] as any);

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('healthy');
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.checks.database).toBe('healthy');
      expect(res.body.service).toBe('mesa-de-ayuda-api');

      // Garantizar que no expone secretos ni stack traces
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('DATABASE_URL');
      expect(bodyStr).not.toContain('postgresql://');
      expect(bodyStr).not.toContain('GROQ_API_KEY');
      expect(bodyStr).not.toContain('JWT_');
    });

    it('debe responder HTTP 503 con status degraded cuando la base de datos falla', async () => {
      vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('DB connection refused'));

      const res = await request(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe('degraded');
      expect(res.body.checks.database).toBe('unhealthy');
      expect(res.body).not.toHaveProperty('stack');
    });
  });

  describe('2. Health Check Administrativo (/api/v1/admin/system/health)', () => {
    it('debe rechazar solicitudes no autenticadas con HTTP 401', async () => {
      const res = await request(app).get('/api/v1/admin/system/health');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('debe rechazar con HTTP 403 a usuarios con rol USER', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('debe responder con métricas de salud detalladas al usuario ADMIN', async () => {
      vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }] as any);
      vi.spyOn(usageService, 'getSummaryMetrics').mockResolvedValueOnce({
        users: { total: 5, active: 4, inactive: 1 },
        library: { sharedTotal: 10 },
        usage: {
          requestsToday: 15,
          requestsMonth: 340,
          inputTokensMonth: 25000,
          outputTokensMonth: 8000,
          totalTokensMonth: 33000,
          avgTokensPerRequest: 97,
          estimatedCostUsd: '$0.0031',
        },
      } as any);

      const res = await request(app)
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('healthy');
      expect(res.body.version.backend).toBe('1.0.0');
      expect(res.body.database.status).toBe('connected');
      expect(typeof res.body.database.latencyMs).toBe('number');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.body.memory).toHaveProperty('heapUsedMb');
      expect(res.body.ai.model).toContain('llama-3.1-8b-instant');
      expect(res.body.ai.requestsToday).toBe(15);
      expect(res.body.ai.requestsMonth).toBe(340);

      // Verificación estricta de ausencia de secretos
      const bodyText = JSON.stringify(res.body);
      expect(bodyText).not.toContain('postgresql://');
      expect(bodyText).not.toContain('gsk_');
      expect(bodyText).not.toContain('JWT_');
    });
  });
});
