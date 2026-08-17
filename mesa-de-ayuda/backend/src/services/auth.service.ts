import { userRepository, SafeUser } from '../repositories/user.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { verifyPassword, hashPassword, generateRandomToken, hashToken } from '../utils/crypto.js';
import { generateAccessToken } from '../utils/jwt.js';
import { LoginInput } from '../schemas/auth.schema.js';
import { UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface LoginSuccessResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshSuccessResult {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private calculateRefreshExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días de duración
    return expiresAt;
  }

  async login(input: LoginInput): Promise<LoginSuccessResult> {
    const user = await userRepository.findByEmail(input.email);

    if (!user) {
      const err = new Error('Credenciales incorrectas');
      (err as any).code = 'INVALID_CREDENTIALS';
      (err as any).statusCode = 401;
      throw err;
    }

    if (user.status !== UserStatus.ACTIVE) {
      const err = new Error('La cuenta de usuario se encuentra inactiva. Contacte al administrador.');
      (err as any).code = 'ACCOUNT_INACTIVE';
      (err as any).statusCode = 403;
      throw err;
    }

    const isValidPassword = await verifyPassword(input.password, user.passwordHash);

    if (!isValidPassword) {
      const err = new Error('Credenciales incorrectas');
      (err as any).code = 'INVALID_CREDENTIALS';
      (err as any).statusCode = 401;
      throw err;
    }

    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });

    const rawRefreshToken = generateRandomToken(48);
    const tokenHash = hashToken(rawRefreshToken);
    const familyId = randomUUID();
    const expiresAt = this.calculateRefreshExpiry();

    await sessionRepository.createSession({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
    });

    await userRepository.updateLastLogin(user.id);

    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      monthlyTokenLimit: user.monthlyTokenLimit,
      saveAiHistory: user.saveAiHistory,
      lastLoginAt: new Date(),
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      user: safeUser,
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  async refresh(rawRefreshToken: string): Promise<RefreshSuccessResult> {
    const tokenHash = hashToken(rawRefreshToken);
    const session = await sessionRepository.findByTokenHash(tokenHash);

    if (!session || !session.user) {
      const err = new Error('Sesión inválida o expirada. Inicie sesión nuevamente.');
      (err as any).code = 'UNAUTHORIZED';
      (err as any).statusCode = 401;
      throw err;
    }

    // Detección de Reuse de Refresh Token (Token Family Reuse Detection)
    if (session.revokedAt !== null) {
      if (session.familyId) {
        await sessionRepository.revokeFamily(session.familyId);
      }

      await auditRepository.create({
        actorUserId: session.user.id,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        targetType: 'SESSION',
        metadata: {
          familyId: session.familyId,
          email: session.user.email,
        },
      });

      const err = new Error('Se ha detectado una reutilización de credenciales. Por seguridad se han invalidado sus sesiones. Inicie sesión nuevamente.');
      (err as any).code = 'TOKEN_REUSE_DETECTED';
      (err as any).statusCode = 401;
      throw err;
    }

    if (session.expiresAt < new Date()) {
      const err = new Error('La sesión ha expirado. Inicie sesión nuevamente.');
      (err as any).code = 'UNAUTHORIZED';
      (err as any).statusCode = 401;
      throw err;
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      const err = new Error('La cuenta de usuario se encuentra inactiva.');
      (err as any).code = 'ACCOUNT_INACTIVE';
      (err as any).statusCode = 403;
      throw err;
    }

    // Rotación de token conservando familyId
    const newRawRefreshToken = generateRandomToken(48);
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = this.calculateRefreshExpiry();

    await sessionRepository.rotateSession(tokenHash, {
      userId: session.user.id,
      tokenHash: newTokenHash,
      familyId: session.familyId,
      expiresAt: newExpiresAt,
    });

    const newAccessToken = generateAccessToken({
      sub: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    await sessionRepository.revokeSession(tokenHash);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<SafeUser> {
    const user = await userRepository.findById(userId);

    if (!user) {
      const err = new Error('Usuario no encontrado');
      (err as any).code = 'USER_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    const isValidCurrent = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValidCurrent) {
      const err = new Error('La contraseña actual es incorrecta');
      (err as any).code = 'INVALID_CREDENTIALS';
      (err as any).statusCode = 400;
      throw err;
    }

    if (currentPassword === newPassword) {
      const err = new Error('La nueva contraseña debe ser diferente a la actual.');
      (err as any).code = 'PASSWORD_MUST_BE_DIFFERENT';
      (err as any).statusCode = 400;
      throw err;
    }

    const newPasswordHash = await hashPassword(newPassword);
    const updatedUser = await userRepository.updatePassword(userId, newPasswordHash, false);

    // Revocar todas las sesiones del usuario tras cambiar de clave
    await sessionRepository.revokeAllUserSessions(userId);

    return updatedUser;
  }
}

export const authService = new AuthService();
