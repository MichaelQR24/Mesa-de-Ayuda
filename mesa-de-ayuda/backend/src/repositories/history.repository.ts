import { prisma } from '../lib/prisma.js';
import { AiHistory, AiAction, Tone, ParaphraseLevel } from '@prisma/client';

export interface CreateHistoryDto {
  userId?: string | null;
  action: AiAction;
  originalText?: string | null;
  resultText?: string | null;
  tone?: Tone;
  paraphraseLevel?: ParaphraseLevel;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

export class HistoryRepository {
  async create(data: CreateHistoryDto): Promise<AiHistory> {
    return prisma.aiHistory.create({
      data: {
        userId: data.userId ?? null,
        action: data.action,
        originalText: data.originalText ?? null,
        resultText: data.resultText ?? null,
        tone: data.tone ?? Tone.PROFESSIONAL,
        paraphraseLevel: data.paraphraseLevel ?? ParaphraseLevel.MEDIUM,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        latencyMs: data.latencyMs,
      },
    });
  }

  async findMany(params: { userId?: string; limit: number; offset: number }): Promise<{ items: AiHistory[]; total: number }> {
    const { userId, limit, offset } = params;

    const where = userId ? { userId } : {};

    const boundedLimit = Math.min(Math.max(limit, 1), 100);

    const [items, total] = await Promise.all([
      prisma.aiHistory.findMany({
        where,
        take: boundedLimit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.aiHistory.count({ where }),
    ]);

    return { items, total };
  }
}

export const historyRepository = new HistoryRepository();
