import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { auditRepository } from '../src/repositories/audit.repository.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('Endpoints de Textos Rápidos (/api/v1/quick-texts) - Privados y Compartidos', () => {
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

  const adminToken = generateAccessToken({
    sub: 'admin-user',
    email: 'admin@empresa.com',
    displayName: 'Administrador',
    role: UserRole.ADMIN,
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
      if (id === 'admin-user') {
        return {
          id: 'admin-user',
          email: 'admin@empresa.com',
          displayName: 'Administrador',
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
      return null;
    });
  });

  describe('GET /api/v1/quick-texts', () => {
    it('debe rechazar con HTTP 401 si no se envía token', async () => {
      const res = await request(app).get('/api/v1/quick-texts');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('debe devolver los textos propios y compartidos con flag isOwner y ownerDisplayName', async () => {
      const mockItems = [
        {
          id: 'qt-1',
          userId: 'user-a',
          title: 'Desbloqueo de usuario de red',
          header: '[Usuario de red] Usuario solicita desbloqueo',
          body: 'El usuario reporta cuenta bloqueada.',
          solution: 'Se atendió lo solicitado.',
          isShared: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-a', displayName: 'Usuario A' },
        },
        {
          id: 'qt-2',
          userId: 'user-b',
          title: 'Configuración de VPN',
          header: '[VPN] Configuración remota',
          body: 'Instalación de certificados.',
          solution: 'Túnel VPN configurado.',
          isShared: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-b', displayName: 'Usuario B' },
        },
      ];

      vi.spyOn(prisma.quickText, 'findMany').mockResolvedValueOnce(mockItems as any);

      const res = await request(app)
        .get('/api/v1/quick-texts')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].isOwner).toBe(true);
      expect(res.body.data[0].isShared).toBe(false);
      expect(res.body.data[1].isOwner).toBe(false);
      expect(res.body.data[1].isShared).toBe(true);
      expect(res.body.data[1].ownerDisplayName).toBe('Usuario B');
    });

    it('debe tolerar registros antiguos donde solution sea null sin fallar', async () => {
      const mockLegacyItems = [
        {
          id: 'qt-legacy',
          userId: 'user-a',
          title: 'Texto Antiguo',
          header: 'Cabecera antigua',
          body: 'Cuerpo antiguo',
          solution: null,
          isShared: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-a', displayName: 'Usuario A' },
        },
      ];

      vi.spyOn(prisma.quickText, 'findMany').mockResolvedValueOnce(mockLegacyItems as any);

      const res = await request(app)
        .get('/api/v1/quick-texts')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].solution).toBe('');
    });
  });

  describe('POST /api/v1/quick-texts', () => {
    it('debe crear exitosamente un texto rápido compartido con el equipo', async () => {
      const payload = {
        title: 'Resetear contraseña',
        header: '[Restablecimiento de Red]',
        body: 'Usuario solicita restablecimiento de red',
        solution: 'Se atendió lo solicitado.',
        isShared: true,
      };

      vi.spyOn(prisma.quickText, 'create').mockResolvedValueOnce({
        id: 'qt-shared',
        userId: 'user-a',
        ...payload,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 'user-a', displayName: 'Usuario A' },
      } as any);

      const res = await request(app)
        .post('/api/v1/quick-texts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('qt-shared');
      expect(res.body.data.isShared).toBe(true);
      expect(res.body.data.isOwner).toBe(true);
    });

    it('debe rechazar con HTTP 400 si faltan campos obligatorios (título, cabecera o cuerpo)', async () => {
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
    it('debe permitir al propietario cambiar el estado de isShared de true a false', async () => {
      vi.spyOn(prisma.quickText, 'findUnique').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Texto compartido',
        header: 'Cabecera',
        body: 'Cuerpo',
        solution: 'Solución',
        isShared: true,
      } as any);

      vi.spyOn(prisma.quickText, 'update').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Texto compartido',
        header: 'Cabecera',
        body: 'Cuerpo',
        solution: 'Solución',
        isShared: false,
        user: { id: 'user-a', displayName: 'Usuario A' },
      } as any);

      const res = await request(app)
        .patch('/api/v1/quick-texts/qt-1')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ isShared: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isShared).toBe(false);
    });

    it('debe permitir al propietario actualizar título, cabecera, cuerpo y solución', async () => {
      vi.spyOn(prisma.quickText, 'findUnique').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Título anterior',
        header: 'Cabecera anterior',
        body: 'Cuerpo anterior',
        solution: 'Solución anterior',
        isShared: false,
      } as any);

      vi.spyOn(prisma.quickText, 'update').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Título nuevo',
        header: 'Cabecera nueva',
        body: 'Cuerpo nuevo',
        solution: 'Solución nueva',
        isShared: false,
        user: { id: 'user-a', displayName: 'Usuario A' },
      } as any);

      const res = await request(app)
        .patch('/api/v1/quick-texts/qt-1')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Título nuevo',
          header: 'Cabecera nueva',
          body: 'Cuerpo nuevo',
          solution: 'Solución nueva',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Título nuevo');
      expect(res.body.data.solution).toBe('Solución nueva');
    });

    it('debe rechazar con HTTP 403 si USER B intenta editar un texto compartido creado por USER A', async () => {
      vi.spyOn(prisma.quickText, 'findUnique').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Texto de A compartido',
        header: 'Cabecera',
        body: 'Cuerpo',
        solution: 'Solución',
        isShared: true,
      } as any);

      const res = await request(app)
        .patch('/api/v1/quick-texts/qt-1')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ title: 'Intento de modificar texto de otro usuario' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /api/v1/quick-texts/:id', () => {
    it('debe permitir al propietario eliminar su propio texto exitosamente', async () => {
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
      expect(res.body.data.message).toBe('Texto rápido eliminado correctamente.');
    });

    it('debe permitir a un ADMIN eliminar un texto de otro usuario si fuera necesario moderar', async () => {
      vi.spyOn(prisma.quickText, 'findUnique').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Texto moderable',
      } as any);

      vi.spyOn(prisma.quickText, 'delete').mockResolvedValueOnce({
        id: 'qt-1',
      } as any);

      const res = await request(app)
        .delete('/api/v1/quick-texts/qt-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('debe rechazar con HTTP 403 si USER B intenta eliminar un texto compartido de USER A', async () => {
      vi.spyOn(prisma.quickText, 'findUnique').mockResolvedValueOnce({
        id: 'qt-1',
        userId: 'user-a',
        title: 'Texto de A',
        isShared: true,
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
