import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { sessionRepository } from '../src/repositories/session.repository.js';
import { auditRepository } from '../src/repositories/audit.repository.js';
import { usageService } from '../src/services/usage.service.js';
import { groqService } from '../src/services/groq.service.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/crypto.js';
import { sensitiveDataGuard } from '../src/utils/sensitive-data.guard.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('Security and Privacy Hardening (Fase 9)', () => {
  const adminToken = generateAccessToken({
    sub: 'admin-sec-1',
    email: 'admin@sec.com',
    displayName: 'Admin Sec',
    role: UserRole.ADMIN,
    mustChangePassword: false,
  });

  const userToken = generateAccessToken({
    sub: 'user-sec-1',
    email: 'user@sec.com',
    displayName: 'User Sec',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditRepository, 'create').mockResolvedValue(null);

    vi.spyOn(userRepository, 'findSafeById').mockImplementation(async (id: string) => {
      if (id === 'admin-sec-1') {
        return {
          id: 'admin-sec-1',
          email: 'admin@sec.com',
          displayName: 'Admin Sec',
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
      if (id === 'user-sec-1') {
        return {
          id: 'user-sec-1',
          email: 'user@sec.com',
          displayName: 'User Sec',
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
      if (id === 'inactive-user') {
        return {
          id: 'inactive-user',
          email: 'inactive@sec.com',
          displayName: 'Inactive User',
          role: UserRole.USER,
          status: UserStatus.INACTIVE,
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

  describe('1. Autenticación y Control de Acceso', () => {
    it('debe rechazar solicitudes a rutas protegidas sin encabezado Authorization (401)', async () => {
      const response = await request(app).get('/api/v1/auth/me');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('debe rechazar tokens JWT manipulados o con firma inválida (401)', async () => {
      const tamperedToken = userToken.slice(0, -10) + 'invalidabc';
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('debe impedir acceso de un usuario inactivo aunque posea token previo (401/403)', async () => {
      const inactiveToken = generateAccessToken({
        sub: 'inactive-user',
        email: 'inactive@sec.com',
        displayName: 'Inactive User',
        role: UserRole.USER,
        mustChangePassword: false,
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${inactiveToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('debe denegar con 403 el acceso de un USER a endpoints de ADMIN', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Detección de Reutilización de Refresh Tokens (Token Family Reuse)', () => {
    it('debe revocar la familia de sesiones y rechazar con TOKEN_REUSE_DETECTED si se reutiliza un refresh token revocado', async () => {
      vi.spyOn(sessionRepository, 'findByTokenHash').mockResolvedValueOnce({
        id: 'revoked-session-1',
        userId: 'user-sec-1',
        tokenHash: 'somehash',
        familyId: 'family-123',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: new Date(),
        createdAt: new Date(),
        lastUsedAt: new Date(),
        user: {
          id: 'user-sec-1',
          email: 'user@sec.com',
          displayName: 'User Sec',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
        },
      });

      const revokeFamilySpy = vi.spyOn(sessionRepository, 'revokeFamily').mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'reused_stolen_token' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_REUSE_DETECTED');
      expect(revokeFamilySpy).toHaveBeenCalledWith('family-123');
    });
  });

  describe('3. SensitiveDataGuard y Protección de Datos antes de Groq', () => {
    it('debe bloquear y NO llamar a Groq si el texto contiene una API key (gsk_...)', async () => {
      const groqSpy = vi.spyOn(groqService, 'generateCompletion');

      const response = await request(app)
        .post('/api/v1/ai/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          text: 'Hola, mi clave de api es gsk_1234567890abcdef1234567890abcdef por favor ayúdame.',
          action: 'professionalize',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('SENSITIVE_DATA_BLOCKED');
      expect(groqSpy).not.toHaveBeenCalled();
    });

    it('debe bloquear y NO llamar a Groq si el texto contiene una contraseña explícita', async () => {
      const groqSpy = vi.spyOn(groqService, 'generateCompletion');

      const response = await request(app)
        .post('/api/v1/ai/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          text: 'El usuario reporta password: MiPasswordSeguro123 en el ticket',
          action: 'professionalize',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('SENSITIVE_DATA_BLOCKED');
      expect(groqSpy).not.toHaveBeenCalled();
    });

    it('debe bloquear y NO llamar a Groq si el texto contiene una cadena de conexión a base de datos', async () => {
      const groqSpy = vi.spyOn(groqService, 'generateCompletion');

      const response = await request(app)
        .post('/api/v1/ai/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          text: 'Error conectando a postgres://postgres:secreto@db.server.com:5432/produccion',
          action: 'correct',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('SENSITIVE_DATA_BLOCKED');
      expect(groqSpy).not.toHaveBeenCalled();
    });

    it('debe permitir redacción previa y restauración determinista de emails y teléfonos', () => {
      const input = 'Comunícate con juan.perez@empresa.com o al teléfono 987654321 por favor.';
      const { redactedText, replacements, hasRedactions } = sensitiveDataGuard.redact(input);

      expect(hasRedactions).toBe(true);
      expect(redactedText).not.toContain('juan.perez@empresa.com');
      expect(redactedText).not.toContain('987654321');
      expect(redactedText).toContain('[EMAIL_1]');
      expect(redactedText).toContain('[TEL_2]');

      const aiResponseMock = `Respuesta procesada para [EMAIL_1] y número [TEL_2].`;
      const restored = sensitiveDataGuard.restore(aiResponseMock, replacements);

      expect(restored).toContain('juan.perez@empresa.com');
      expect(restored).toContain('987654321');
    });
  });

  describe('4. Límites de Tamaño y Payload', () => {
    it('debe rechazar solicitudes con texto mayor a 5000 caracteres (400)', async () => {
      const hugeText = 'a'.repeat(5001);

      const response = await request(app)
        .post('/api/v1/ai/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          text: hugeText,
          action: 'professionalize',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('5. Privacidad y Consentimiento (saveAiHistory: false)', () => {
    it('debe permitir actualizar la preferencia de privacidad del usuario', async () => {
      vi.spyOn(userRepository, 'updatePrivacyPreferences').mockResolvedValueOnce({
        id: 'user-sec-1',
        email: 'user@sec.com',
        displayName: 'User Sec',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        monthlyTokenLimit: 50000,
        saveAiHistory: false,
        lastLoginAt: new Date(),
        passwordChangedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .patch('/api/v1/auth/privacy')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ saveAiHistory: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.saveAiHistory).toBe(false);
    });
  });

  describe('6. Hardening de Contraseñas', () => {
    it('debe rechazar el cambio de contraseña si la nueva es idéntica a la actual', async () => {
      const realHash = await hashPassword('PasswordSeguro123');

      vi.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        id: 'user-sec-1',
        email: 'user@sec.com',
        displayName: 'User Sec',
        passwordHash: realHash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        monthlyTokenLimit: null,
        saveAiHistory: true,
        lastLoginAt: new Date(),
        passwordChangedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'PasswordSeguro123',
          newPassword: 'PasswordSeguro123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PASSWORD_MUST_BE_DIFFERENT');
    });
  });
});
