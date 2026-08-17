import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { sessionRepository } from '../src/repositories/session.repository.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('Admin User Endpoints (/api/v1/admin/users)', () => {
  const adminToken = generateAccessToken({
    sub: 'admin-1',
    email: 'admin@soporte.com',
    displayName: 'Admin Master',
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
  });

  it('ADMIN debe poder crear un nuevo usuario con mustChangePassword = true', async () => {
    vi.spyOn(userRepository, 'findSafeById').mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@soporte.com',
      displayName: 'Admin Master',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      lastLoginAt: new Date(),
      passwordChangedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(null);

    const mockCreated = {
      id: 'new-user-1',
      email: 'nuevo@soporte.com',
      displayName: 'Nuevo Agente',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      lastLoginAt: null,
      passwordChangedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(userRepository, 'create').mockResolvedValueOnce(mockCreated);

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'nuevo@soporte.com',
        displayName: 'Nuevo Agente',
        role: 'USER',
        temporaryPassword: 'TempPassword123',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('nuevo@soporte.com');
    expect(response.body.data.mustChangePassword).toBe(true);
    expect(response.body.data.passwordHash).toBeUndefined(); // Sin passwordHash
  });

  it('un usuario con rol USER debe recibir 403 al intentar crear usuarios', async () => {
    vi.spyOn(userRepository, 'findSafeById').mockResolvedValueOnce({
      id: 'user-1',
      email: 'agente@soporte.com',
      displayName: 'Agente Regular',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      lastLoginAt: new Date(),
      passwordChangedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        email: 'intento@soporte.com',
        displayName: 'Intento',
        role: 'USER',
        temporaryPassword: 'TempPassword123',
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('ADMIN debe poder cambiar el estado de un usuario a INACTIVE y revocar sus sesiones', async () => {
    vi.spyOn(userRepository, 'findSafeById').mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@soporte.com',
      displayName: 'Admin Master',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      lastLoginAt: new Date(),
      passwordChangedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({
      id: 'user-to-disable',
      email: 'disable@soporte.com',
      displayName: 'Disable Me',
      passwordHash: 'hash',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      lastLoginAt: null,
      passwordChangedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(userRepository, 'updateStatus').mockResolvedValueOnce({
      id: 'user-to-disable',
      email: 'disable@soporte.com',
      displayName: 'Disable Me',
      role: UserRole.USER,
      status: UserStatus.INACTIVE,
      mustChangePassword: false,
      lastLoginAt: null,
      passwordChangedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const revokeSpy = vi.spyOn(sessionRepository, 'revokeAllUserSessions').mockResolvedValueOnce(undefined);

    const response = await request(app)
      .patch('/api/v1/admin/users/user-to-disable/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'INACTIVE' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('INACTIVE');
    expect(revokeSpy).toHaveBeenCalledWith('user-to-disable');
  });
});
