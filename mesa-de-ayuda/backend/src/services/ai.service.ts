import { buildSystemPrompt } from '../prompts/prompts.js';
import { groqService } from './groq.service.js';
import { historyRepository } from '../repositories/history.repository.js';
import { AiProcessInput, AiProcessResult } from '../types/ai.types.js';
import { AiAction as PrismaAiAction, Tone as PrismaTone, ParaphraseLevel as PrismaParaphraseLevel } from '@prisma/client';

const ACTION_PRISMA_MAP: Record<string, PrismaAiAction> = {
  correct: PrismaAiAction.CORRECT,
  paraphrase: PrismaAiAction.PARAPHRASE,
  professionalize: PrismaAiAction.PROFESSIONALIZE,
  summarize: PrismaAiAction.SUMMARIZE,
  reply: PrismaAiAction.REPLY,
};

const TONE_PRISMA_MAP: Record<string, PrismaTone> = {
  professional: PrismaTone.PROFESSIONAL,
  formal: PrismaTone.FORMAL,
  friendly: PrismaTone.FRIENDLY,
  technical: PrismaTone.TECHNICAL,
  casual: PrismaTone.CASUAL,
};

const LEVEL_PRISMA_MAP: Record<string, PrismaParaphraseLevel> = {
  soft: PrismaParaphraseLevel.SOFT,
  medium: PrismaParaphraseLevel.MEDIUM,
  complete: PrismaParaphraseLevel.COMPLETE,
};

export class AiService {
  async processText(input: AiProcessInput): Promise<AiProcessResult> {
    const { text, action, tone = 'professional', paraphraseLevel = 'medium', userId = null } = input;

    const systemPrompt = buildSystemPrompt(action, tone, paraphraseLevel);

    try {
      const result = await groqService.generateCompletion(systemPrompt, text);

      // Persistencia en base de datos sin bloquear respuesta si la BD falla
      try {
        await historyRepository.create({
          userId,
          action: ACTION_PRISMA_MAP[action] || PrismaAiAction.PROFESSIONALIZE,
          originalText: text,
          resultText: result.result,
          tone: TONE_PRISMA_MAP[tone] || PrismaTone.PROFESSIONAL,
          paraphraseLevel: LEVEL_PRISMA_MAP[paraphraseLevel] || PrismaParaphraseLevel.MEDIUM,
          model: result.model,
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
          totalTokens: result.usage?.totalTokens,
          latencyMs: result.latencyMs,
        });
      } catch (dbError) {
        // Registro técnico seguro sin exponer el texto laboral
        console.warn('[History] Advertencia: No se pudo registrar la consulta en PostgreSQL:', dbError instanceof Error ? dbError.message : dbError);
      }

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('GROQ_API_KEY no está configurada')) {
        const err = new Error('La clave de API de Groq (GROQ_API_KEY) no está configurada en el servidor.');
        (err as any).code = 'API_KEY_MISSING';
        (err as any).statusCode = 500;
        throw err;
      }

      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('aborted')) {
        const err = new Error('Tiempo de espera agotado al conectar con el proveedor de IA.');
        (err as any).code = 'AI_TIMEOUT';
        (err as any).statusCode = 504;
        throw err;
      }

      const err = new Error('No fue posible procesar el texto con el servicio de IA en este momento.');
      (err as any).code = 'AI_PROVIDER_ERROR';
      (err as any).statusCode = 502;
      throw err;
    }
  }
}

export const aiService = new AiService();
