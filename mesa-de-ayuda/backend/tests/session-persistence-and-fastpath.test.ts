import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { sessionRepository } from '../src/repositories/session.repository.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { generateRandomToken, hashToken } from '../src/utils/crypto.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('Resiliencia de Sesión, Fast Path y Manejo de Errores Transitorios', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockActiveUser = {
    id: 'user-persist-1',
    email: 'persistente@empresa.com',
    displayName: 'Usuario Persistente',
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

  describe('1. Fast Path y Verificación sin llamadas innecesarias', () => {
    it('un accessToken vigente permite acceso directo sin tocar /auth/refresh', async () => {
      const validToken = generateAccessToken({
        sub: mockActiveUser.id,
        email: mockActiveUser.email,
        displayName: mockActiveUser.displayName,
        role: mockActiveUser.role,
        mustChangePassword: mockActiveUser.mustChangePassword,
      });

      vi.spyOn(userRepository, 'findSafeById').mockResolvedValueOnce(mockActiveUser);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockActiveUser.id);
    });

    it('el endpoint /health responde de forma instantánea para warm-up no bloqueante', async () => {
      vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }] as any);

      const start = Date.now();
      const response = await request(app).get('/health');
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(duration).toBeLessThan(500);
    });
  });

  describe('2. Protocolo de Refresco y Rotación de Tokens', () => {
    it('permite renovar tokens con un refreshToken válido en base de datos', async () => {
      const rawRefreshToken = generateRandomToken(48);
      const tokenHash = hashToken(rawRefreshToken);
      const familyId = 'family-100';

      vi.spyOn(sessionRepository, 'findByTokenHash').mockResolvedValueOnce({
        id: 'session-1',
        userId: mockActiveUser.id,
        tokenHash,
        familyId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
        user: mockActiveUser,
      } as any);

      vi.spyOn(sessionRepository, 'rotateSession').mockResolvedValueOnce({
        id: 'session-2',
        userId: mockActiveUser.id,
        tokenHash: 'new-hash',
        familyId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
      } as any);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('rechaza con 401 si el refreshToken no existe en base de datos', async () => {
      const rawRefreshToken = generateRandomToken(48);

      vi.spyOn(sessionRepository, 'findByTokenHash').mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rechaza con 403 si el usuario dueño del token fue desactivado (USER_INACTIVE)', async () => {
      const rawRefreshToken = generateRandomToken(48);
      const tokenHash = hashToken(rawRefreshToken);

      vi.spyOn(sessionRepository, 'findByTokenHash').mockResolvedValueOnce({
        id: 'session-2',
        userId: 'inactive-user-id',
        tokenHash,
        familyId: 'family-inactive',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
        user: {
          ...mockActiveUser,
          id: 'inactive-user-id',
          status: UserStatus.INACTIVE,
        },
      } as any);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('3. Cierre voluntario de sesión', () => {
    it('logout voluntario revoca la sesión en base de datos', async () => {
      const rawRefreshToken = generateRandomToken(48);

      vi.spyOn(sessionRepository, 'revokeSession').mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: rawRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Sesión cerrada correctamente');
    });
  });
});
