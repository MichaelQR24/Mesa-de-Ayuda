import { prisma } from '../lib/prisma.js';
import { AuthSession } from '@prisma/client';

export class SessionRepository {
  async createSession(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<AuthSession> {
    return prisma.authSession.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findActiveByTokenHash(tokenHash: string): Promise<(AuthSession & { user: { id: string; email: string; displayName: string; role: any; status: any; mustChangePassword: boolean } }) | null> {
    return prisma.authSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            status: true,
            mustChangePassword: true,
          },
        },
      },
    });
  }

  /**
   * Rota el refresh token atómicamente: revoca el token anterior y crea la nueva sesión.
   */
  async rotateSession(
    oldTokenHash: string,
    newSession: { userId: string; tokenHash: string; expiresAt: Date }
  ): Promise<AuthSession> {
    return prisma.$transaction(async (tx) => {
      await tx.authSession.updateMany({
        where: { tokenHash: oldTokenHash },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });

      return tx.authSession.create({
        data: {
          userId: newSession.userId,
          tokenHash: newSession.tokenHash,
          expiresAt: newSession.expiresAt,
        },
      });
    });
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await prisma.authSession.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export const sessionRepository = new SessionRepository();
