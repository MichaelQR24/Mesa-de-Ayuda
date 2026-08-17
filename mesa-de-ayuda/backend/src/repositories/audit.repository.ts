import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export interface CreateAuditLogInput {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, any> | null;
}

export interface FindAuditLogsOptions {
  limit?: number;
  offset?: number;
  action?: string;
  actorUserId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export class AuditRepository {
  async create(data: CreateAuditLogInput) {
    try {
      return await prisma.auditLog.create({
        data: {
          actorUserId: data.actorUserId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId || null,
          metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
    } catch (error) {
      console.error('[AuditRepository] Error al registrar evento de auditoría:', error);
      // No frenar la operación principal si la auditoría falla
      return null;
    }
  }

  async findMany(options: FindAuditLogsOptions = {}) {
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = options.offset ?? 0;

    const where: Prisma.AuditLogWhereInput = {};

    if (options.action) {
      where.action = options.action;
    }
    if (options.actorUserId) {
      where.actorUserId = options.actorUserId;
    }
    if (options.fromDate || options.toDate) {
      where.createdAt = {};
      if (options.fromDate) where.createdAt.gte = options.fromDate;
      if (options.toDate) where.createdAt.lte = options.toDate;
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total, limit, offset };
  }
}

export const auditRepository = new AuditRepository();
