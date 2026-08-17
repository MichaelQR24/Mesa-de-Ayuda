import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { userRepository } from '../repositories/user.repository.js';

export const getSessionsSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const now = new Date();
    const [activeSessions, revokedSessions] = await Promise.all([
      prisma.authSession.count({
        where: {
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
      prisma.authSession.count({
        where: {
          revokedAt: { not: null },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        activeSessions,
        revokedSessions,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const revokeUserSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actor = req.user;

    const targetUser = await userRepository.findSafeById(id);
    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'El usuario especificado no existe.',
        },
      });
      return;
    }

    await sessionRepository.revokeAllUserSessions(id);

    if (actor) {
      await auditRepository.create({
        actorUserId: actor.id,
        action: 'SESSIONS_REVOKED',
        targetType: 'USER',
        targetId: targetUser.id,
        metadata: {
          targetEmail: targetUser.email,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Todas las sesiones activas del usuario fueron revocadas correctamente.',
      },
    });
  } catch (error) {
    next(error);
  }
};
