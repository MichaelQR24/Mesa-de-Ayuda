import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { usageService } from '../src/services/usage.service.js';
import { auditRepository } from '../src/repositories/audit.repository.js';
import { sessionRepository } from '../src/repositories/session.repository.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('Admin Panel Endpoints (Fase 8)', () => {
  const adminToken = generateAccessToken({
    sub: 'admin-1',
    email: 'admin@soporte.com',
    displayName: 'Admin Principal',
    role: UserRole.ADMIN,
    mustChangePassword: false,
  });

  const userToken = generateAccessToken({
    sub: 'user-1',
    email: 'agente@soporte.com',
    displayName: 'Agente Regular',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditRepository, 'create').mockResolvedValue(null);

    vi.spyOn(userRepository, 'findSafeById').mockImplementation(async (id: string) => {
      if (id === 'admin-1') {
        return {
          id: 'admin-1',
          email: 'admin@soporte.com',
          displayName: 'Admin Principal',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          monthlyTokenLimit: null,
          lastLoginAt: new Date(),
          passwordChangedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      if (id === 'user-1') {
        return {
          id: 'user-1',
          email: 'agente@soporte.com',
          displayName: 'Agente Regular',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          monthlyTokenLimit: 10000,
          lastLoginAt: new Date(),
          passwordChangedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return null;
    });
  });

  describe('Control de Acceso (RBAC)', () => {
    it('debe rechazar con 403 a usuarios con rol USER al intentar acceder a rutas admin', async () => {
      const response = await request(app)
        .get('/api/v1/admin/usage/summary')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('debe permitir acceso con 200 a usuarios con rol ADMIN', async () => {
      vi.spyOn(usageService, 'getSummaryMetrics').mockResolvedValueOnce({
        users: { total: 5, active: 4, inactive: 1 },
        library: { sharedTotal: 12 },
        usage: {
          requestsToday: 15,
          requestsMonth: 120,
          inputTokensMonth: 50000,
          outputTokensMonth: 20000,
          totalTokensMonth: 70000,
          avgTokensPerRequest: 583,
          estimatedCostUsd: 0.0041,
        },
      });

      const response = await request(app)
        .get('/api/v1/admin/usage/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users.total).toBe(5);
    });
  });

  describe('Protección del Último Administrador', () => {
    it('debe impedir desactivar al único administrador activo del sistema', async () => {
      vi.spyOn(userRepository, 'countActiveAdmins').mockResolvedValueOnce(1);

      const response = await request(app)
        .patch('/api/v1/admin/users/admin-1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: UserStatus.INACTIVE });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LAST_ADMIN_PROTECTED');
    });

    it('debe impedir degradar de ADMIN a USER al único administrador activo', async () => {
      vi.spyOn(userRepository, 'countActiveAdmins').mockResolvedValueOnce(1);

      const response = await request(app)
        .patch('/api/v1/admin/users/admin-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.USER });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LAST_ADMIN_PROTECTED');
    });
  });

  describe('Límites de Consumo de IA', () => {
    it('debe permitir actualizar el monthlyTokenLimit de un usuario', async () => {
      vi.spyOn(userRepository, 'update').mockResolvedValueOnce({
        id: 'user-1',
        email: 'agente@soporte.com',
        displayName: 'Agente Regular',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        monthlyTokenLimit: 50000,
        lastLoginAt: new Date(),
        passwordChangedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .patch('/api/v1/admin/users/user-1/usage-limit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ monthlyTokenLimit: 50000 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.monthlyTokenLimit).toBe(50000);
    });

    it('debe bloquear la inferencia de IA con 429 si el usuario superó su límite mensual', async () => {
      vi.spyOn(usageService, 'getUserMonthlyTokenUsage').mockResolvedValueOnce(15000);

      const response = await request(app)
        .post('/api/v1/ai/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          text: 'Texto de prueba para verificar bloqueo de cuota',
          action: 'professionalize',
        });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MONTHLY_AI_LIMIT_REACHED');
    });
  });

  describe('Auditoría y Revocación de Sesiones', () => {
    it('debe listar eventos de auditoría paginados', async () => {
      vi.spyOn(auditRepository, 'findMany').mockResolvedValueOnce({
        items: [
          {
            id: 'audit-1',
            actorUserId: 'admin-1',
            action: 'USER_CREATED',
            targetType: 'USER',
            targetId: 'user-new',
            metadata: { email: 'nuevo@soporte.com' },
            createdAt: new Date(),
            actor: {
              id: 'admin-1',
              displayName: 'Admin Principal',
              email: 'admin@soporte.com',
              role: UserRole.ADMIN,
            },
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      });

      const response = await request(app)
        .get('/api/v1/admin/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].action).toBe('USER_CREATED');
    });

    it('debe permitir a un ADMIN revocar todas las sesiones de un usuario', async () => {
      vi.spyOn(sessionRepository, 'revokeAllUserSessions').mockResolvedValueOnce({ count: 3 });

      const response = await request(app)
        .post('/api/v1/admin/sessions/users/user-1/revoke-sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
