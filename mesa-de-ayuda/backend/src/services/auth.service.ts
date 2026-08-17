import { userRepository, SafeUser } from '../repositories/user.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { hashPassword, verifyPassword, hashToken, generateRandomToken } from '../utils/crypto.js';
import { generateAccessToken } from '../utils/jwt.js';
import { UserStatus } from '@prisma/client';

export interface AuthSuccessResult {
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
    // 7 días por defecto
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
  }

  async login(email: string, password: string): Promise<AuthSuccessResult> {
    const user = await userRepository.findByEmail(email);

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

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      const err = new Error('Credenciales incorrectas');
      (err as any).code = 'INVALID_CREDENTIALS';
      (err as any).statusCode = 401;
      throw err;
    }

    // Generar tokens
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });

    const rawRefreshToken = generateRandomToken(48);
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = this.calculateRefreshExpiry();

    await sessionRepository.createSession({
      userId: user.id,
      tokenHash,
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
    const session = await sessionRepository.findActiveByTokenHash(tokenHash);

    if (!session || !session.user) {
      const err = new Error('Sesión inválida o expirada. Inicie sesión nuevamente.');
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

    // Rotación de token
    const newRawRefreshToken = generateRandomToken(48);
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = this.calculateRefreshExpiry();

    await sessionRepository.rotateSession(tokenHash, {
      userId: session.user.id,
      tokenHash: newTokenHash,
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

    const newPasswordHash = await hashPassword(newPassword);
    const updatedUser = await userRepository.updatePassword(userId, newPasswordHash, false);

    // Revocar sesiones previas por seguridad tras cambio de contraseña
    await sessionRepository.revokeAllUserSessions(userId);

    return updatedUser;
  }
}

export const authService = new AuthService();
