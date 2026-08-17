import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { sessionRepository } from '../src/repositories/session.repository.js';
import { hashPassword } from '../src/utils/crypto.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('Auth Endpoints (/api/v1/auth)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('debe iniciar sesión exitosamente con credenciales válidas', async () => {
      const validPass = 'SecurePass123';
      const pHash = await hashPassword(validPass);

      const mockUser = {
        id: 'user-1',
        email: 'agente@soporte.com',
        displayName: 'Agente Soporte',
        passwordHash: pHash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        lastLoginAt: null,
        passwordChangedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(mockUser);
      vi.spyOn(sessionRepository, 'createSession').mockResolvedValueOnce({} as any);
      vi.spyOn(userRepository, 'updateLastLogin').mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'agente@soporte.com',
          password: validPass,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('agente@soporte.com');
      expect(response.body.data.user.passwordHash).toBeUndefined(); // Nunca devolver hash
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('debe fallar con 401 si la contraseña es incorrecta', async () => {
      const pHash = await hashPassword('CorrectPassword123');

      const mockUser = {
        id: 'user-1',
        email: 'agente@soporte.com',
        displayName: 'Agente Soporte',
        passwordHash: pHash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        lastLoginAt: null,
        passwordChangedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'agente@soporte.com',
          password: 'WrongPassword999',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('debe fallar con 401 si el usuario no existe', async () => {
      vi.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'noexiste@soporte.com',
          password: 'SomePassword123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('debe fallar con 403 si el usuario está INACTIVE', async () => {
      const pHash = await hashPassword('SomePass123');

      const mockUser = {
        id: 'user-inactive',
        email: 'inactivo@soporte.com',
        displayName: 'Usuario Inactivo',
        passwordHash: pHash,
        role: UserRole.USER,
        status: UserStatus.INACTIVE,
        mustChangePassword: false,
        lastLoginAt: null,
        passwordChangedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inactivo@soporte.com',
          password: 'SomePass123',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('debe devolver los datos del usuario autenticado', async () => {
      const token = generateAccessToken({
        sub: 'user-1',
        email: 'agente@soporte.com',
        displayName: 'Agente Soporte',
        role: UserRole.USER,
        mustChangePassword: false,
      });

      vi.spyOn(userRepository, 'findSafeById').mockResolvedValueOnce({
        id: 'user-1',
        email: 'agente@soporte.com',
        displayName: 'Agente Soporte',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        lastLoginAt: new Date(),
        passwordChangedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-1');
      expect(response.body.data.email).toBe('agente@soporte.com');
    });

    it('debe devolver 401 si no se envía token de autorización', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
