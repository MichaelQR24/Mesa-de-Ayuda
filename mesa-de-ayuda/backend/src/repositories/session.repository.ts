import { prisma } from '../lib/prisma.js';
import { AuthSession } from '@prisma/client';
import { randomUUID } from 'crypto';

export class SessionRepository {
  async createSession(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    familyId?: string | null;
  }): Promise<AuthSession> {
    return prisma.authSession.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        familyId: data.familyId ?? randomUUID(),
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<(AuthSession & { user: { id: string; email: string; displayName: string; role: any; status: any; mustChangePassword: boolean } }) | null> {
    return prisma.authSession.findFirst({
      where: { tokenHash },
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
   * Rota el refresh token atómicamente manteniendo el mismo familyId.
   */
  async rotateSession(
    oldTokenHash: string,
    newSession: { userId: string; tokenHash: string; expiresAt: Date; familyId?: string | null }
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
          familyId: newSession.familyId ?? randomUUID(),
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

  async revokeFamily(familyId: string): Promise<void> {
    await prisma.authSession.updateMany({
      where: { familyId, revokedAt: null },
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
