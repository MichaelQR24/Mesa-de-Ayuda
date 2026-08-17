import { prisma } from '../lib/prisma.js';
import { calculateEstimatedCostUsd } from '../config/pricing.config.js';
import { env } from '../config/env.js';

export class UsageService {
  /**
   * Obtiene la suma total de tokens consumidos por un usuario en el mes actual
   */
  async getUserMonthlyTokenUsage(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const aggregation = await prisma.aiHistory.aggregate({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
      _sum: {
        totalTokens: true,
      },
    });

    return aggregation._sum.totalTokens ?? 0;
  }

  /**
   * Métricas generales agregadas para el dashboard de administración
   */
  async getSummaryMetrics() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalSharedTemplates,
      todayRequests,
      monthRequests,
      monthAggregation,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'INACTIVE' } }),
      prisma.libraryItem.count({ where: { isShared: true } }),
      prisma.aiHistory.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.aiHistory.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.aiHistory.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
      }),
    ]);

    const inputTokensMonth = monthAggregation._sum.inputTokens ?? 0;
    const outputTokensMonth = monthAggregation._sum.outputTokens ?? 0;
    const totalTokensMonth = monthAggregation._sum.totalTokens ?? 0;

    const estimatedCostUsd = calculateEstimatedCostUsd(
      env.GROQ_MODEL,
      inputTokensMonth,
      outputTokensMonth
    );

    const avgTokensPerRequest =
      monthRequests > 0 ? Math.round(totalTokensMonth / monthRequests) : 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
      },
      library: {
        sharedTotal: totalSharedTemplates,
      },
      usage: {
        requestsToday: todayRequests,
        requestsMonth: monthRequests,
        inputTokensMonth,
        outputTokensMonth,
        totalTokensMonth,
        avgTokensPerRequest,
        estimatedCostUsd,
      },
    };
  }

  /**
   * Métricas de consumo detalladas por usuario
   */
  async getUserUsageList() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        status: true,
        monthlyTokenLimit: true,
      },
      orderBy: { displayName: 'asc' },
    });

    const userMetrics = await Promise.all(
      users.map(async (u) => {
        const [todayRequests, monthRequests, monthAgg] = await Promise.all([
          prisma.aiHistory.count({
            where: { userId: u.id, createdAt: { gte: startOfDay } },
          }),
          prisma.aiHistory.count({
            where: { userId: u.id, createdAt: { gte: startOfMonth } },
          }),
          prisma.aiHistory.aggregate({
            where: { userId: u.id, createdAt: { gte: startOfMonth } },
            _sum: {
              inputTokens: true,
              outputTokens: true,
              totalTokens: true,
            },
          }),
        ]);

        const inputTokensMonth = monthAgg._sum.inputTokens ?? 0;
        const outputTokensMonth = monthAgg._sum.outputTokens ?? 0;
        const totalTokensMonth = monthAgg._sum.totalTokens ?? 0;

        const limit = u.monthlyTokenLimit;
        const percentageUsed =
          limit && limit > 0
            ? Math.min(100, Math.round((totalTokensMonth / limit) * 100))
            : null;

        const estimatedCostUsd = calculateEstimatedCostUsd(
          env.GROQ_MODEL,
          inputTokensMonth,
          outputTokensMonth
        );

        return {
          userId: u.id,
          displayName: u.displayName,
          email: u.email,
          role: u.role,
          status: u.status,
          monthlyTokenLimit: limit,
          requestsToday: todayRequests,
          requestsMonth: monthRequests,
          inputTokensMonth,
          outputTokensMonth,
          totalTokensMonth,
          percentageUsed,
          estimatedCostUsd,
        };
      })
    );

    return userMetrics;
  }
}

export const usageService = new UsageService();
