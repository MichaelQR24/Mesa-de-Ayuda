import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { auditRepository } from '../src/repositories/audit.repository.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('Endpoints de Textos Rápidos (/api/v1/quick-texts)', () => {
  const userAToken = generateAccessToken({
    sub: 'user-a',
    email: 'usera@empresa.com',
    displayName: 'Usuario A',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  const userBToken = generateAccessToken({
    sub: 'user-b',
    email: 'userb@empresa.com',
    displayName: 'Usuario B',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditRepository, 'create').mockResolvedValue({} as any);
    vi.spyOn(userRepository, 'findSafeById').mockImplementation(async (id: string) => {
      if (id === 'user-a') {
        return {
          id: 'user-a',
          email: 'usera@empresa.com',
          displayName: 'Usuario A',
          role: UserRole.USER,
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
      if (id === 'user-b') {
        return {
          id: 'user-b',
          email: 'userb@empresa.com',
          displayName: 'Usuario B',
          role: UserRole.USER,
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
      return null;
    });
  });

  describe('GET /api/v1/quick-texts', () => {
    it('debe rechazar con HTTP 401 si no se envía token', async () => {
      const res = await request(app).get('/api/v1/quick-texts');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('debe devolver la lista de textos rápidos del usuario autenticado', async () => {
      const mockItems = [
        {
          id: 'qt-1',
          userId: 'user-a',
          title: 'Desbloqueo de usuario de red',
          header: '[Usuario de red] Usuario solicita desbloqueo de Red',
          body: 'Se atendió lo solicitado.',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(prisma.quickText, 'findMany').mockResolvedValueOnce(mockItems as any);

      const res = await request(app)
        .get('/api/v1/quick-texts')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Desbloqueo de usuario de red');
    });
  });

  describe('POST /api/v1/quick-texts', () => {
    it('debe crear exitosamente un texto rápido válido', async () => {
      const payload = {
        title: 'Desbloqueo de usuario de red',
        header: '[Usuario de red] Usuario solicita desbloqueo de Red',
        body: 'Se atendió lo solicitado.',
      };

      vi.spyOn(prisma.quickText, 'create').mockResolvedValueOnce({
        id: 'qt-new',
        userId: 'user-a',
        ...payload,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/quick-texts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('qt-new');
      expect(res.body.data.header).toBe(payload.header);
    });

    it('debe rechazar con HTTP 400 si faltan campos obligatorios', async () => {
      const res = await request(app)
        .post('/api/v1/quick-texts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Solo título',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/v1/quick-texts/:id', () => {
    it('debe actualizar un texto rápido propio', async () => {
      vi.spyOn(prisma.quickText, 'findUnique').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Título anterior',
        header: 'Cabecera anterior',
        body: 'Cuerpo anterior',
      } as any);

      vi.spyOn(prisma.quickText, 'update').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Título nuevo',
        header: 'Cabecera anterior',
        body: 'Cuerpo anterior',
      } as any);

      const res = await request(app)
        .patch('/api/v1/quick-texts/qt-1')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: 'Título nuevo' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Título nuevo');
    });

    it('debe rechazar con HTTP 403 si USER B intenta editar un texto de USER A (Ownership)', async () => {
      vi.spyOn(prisma.quickText, 'findUnique').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Texto de A',
        header: 'Cabecera',
        body: 'Cuerpo',
      } as any);

      const res = await request(app)
        .patch('/api/v1/quick-texts/qt-1')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ title: 'Intento de hack' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /api/v1/quick-texts/:id', () => {
    it('debe eliminar un texto propio exitosamente', async () => {
      vi.spyOn(prisma.quickText, 'findUnique').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Texto a borrar',
      } as any);

      vi.spyOn(prisma.quickText, 'delete').mockResolvedValueOnce({
        id: 'qt-1',
      } as any);

      const res = await request(app)
        .delete('/api/v1/quick-texts/qt-1')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('debe rechazar con HTTP 403 si USER B intenta eliminar un texto de USER A', async () => {
      vi.spyOn(prisma.quickText, 'findUnique').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Texto protegido de A',
      } as any);

      const res = await request(app)
        .delete('/api/v1/quick-texts/qt-1')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
