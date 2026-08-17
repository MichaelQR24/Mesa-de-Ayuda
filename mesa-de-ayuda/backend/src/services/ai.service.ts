import { buildSystemPrompt } from '../prompts/prompts.js';
import { groqService } from './groq.service.js';
import { historyRepository } from '../repositories/history.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { usageService } from './usage.service.js';
import { sensitiveDataGuard } from '../utils/sensitive-data.guard.js';
import { auditRepository } from '../repositories/audit.repository.js';
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

export interface EnhancedAiProcessInput extends AiProcessInput {
  redactSensitiveData?: boolean;
}

export class AiService {
  async processText(input: EnhancedAiProcessInput): Promise<AiProcessResult> {
    const { text, action, tone = 'professional', paraphraseLevel = 'medium', userId = null, redactSensitiveData = false } = input;

    // 1. Detección y bloqueo de datos sensibles (SensitiveDataGuard)
    const analysis = sensitiveDataGuard.analyze(text);
    if (analysis.status === 'BLOCKED') {
      if (userId) {
        await auditRepository.create({
          actorUserId: userId,
          action: 'SENSITIVE_DATA_BLOCKED',
          targetType: 'AI_REQUEST',
          metadata: {
            detectionTypes: analysis.detectionTypes,
          },
        });
      }

      const blockedErr = new Error(
        `La solicitud contiene datos críticos bloqueados por seguridad (${analysis.detectionTypes.join(', ')}). No se enviará a la IA.`
      );
      (blockedErr as any).code = 'SENSITIVE_DATA_BLOCKED';
      (blockedErr as any).statusCode = 400;
      throw blockedErr;
    }

    // 2. Redacción opcional de datos personales antes de llamar a Groq
    let textToProcess = text;
    let redactionInfo: ReturnType<typeof sensitiveDataGuard.redact> | null = null;

    if (redactSensitiveData) {
      redactionInfo = sensitiveDataGuard.redact(text);
      textToProcess = redactionInfo.redactedText;
    }

    // 3. Validar límite mensual de tokens si el usuario tiene una cuota configurada
    let userRecord: any = null;
    if (userId) {
      try {
        userRecord = await userRepository.findSafeById(userId);
        if (userRecord && typeof userRecord.monthlyTokenLimit === 'number' && userRecord.monthlyTokenLimit > 0) {
          const usedTokens = await usageService.getUserMonthlyTokenUsage(userId);
          if (usedTokens >= userRecord.monthlyTokenLimit) {
            const limitError = new Error(
              `Has alcanzado tu límite mensual de tokens de IA (${usedTokens.toLocaleString()} / ${userRecord.monthlyTokenLimit.toLocaleString()}). Comunícate con el administrador.`
            );
            (limitError as any).code = 'MONTHLY_AI_LIMIT_REACHED';
            (limitError as any).statusCode = 429;
            throw limitError;
          }
        }
      } catch (err: any) {
        if (err.code === 'MONTHLY_AI_LIMIT_REACHED') {
          throw err;
        }
      }
    }

    const systemPrompt = buildSystemPrompt(action, tone, paraphraseLevel);

    const completionOptions = {
      correct: { maxTokens: 1024, temperature: 0.1 },
      professionalize: { maxTokens: 1024, temperature: 0.1 },
      paraphrase: { maxTokens: 1024, temperature: 0.3 },
      summarize: { maxTokens: 512, temperature: 0.1 },
      reply: { maxTokens: 512, temperature: 0.2 },
    }[action] || { maxTokens: 1024, temperature: 0.1 };

    try {
      const result = await groqService.generateCompletion(systemPrompt, textToProcess, completionOptions);

      // Restaurar datos si se aplicó redacción
      let finalResultText = result.result;
      if (redactionInfo && redactionInfo.hasRedactions) {
        finalResultText = sensitiveDataGuard.restore(finalResultText, redactionInfo.replacements);
        result.result = finalResultText;
      }

      // 4. Persistencia respetando el consentimiento de privacidad (saveAiHistory)
      try {
        const shouldSaveContent = userRecord ? userRecord.saveAiHistory !== false : true;

        await historyRepository.create({
          userId,
          action: ACTION_PRISMA_MAP[action] || PrismaAiAction.PROFESSIONALIZE,
          originalText: shouldSaveContent ? text : null,
          resultText: shouldSaveContent ? result.result : null,
          tone: TONE_PRISMA_MAP[tone] || PrismaTone.PROFESSIONAL,
          paraphraseLevel: LEVEL_PRISMA_MAP[paraphraseLevel] || PrismaParaphraseLevel.MEDIUM,
          model: result.model,
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
          totalTokens: result.usage?.totalTokens,
          latencyMs: result.latencyMs,
        });
      } catch (dbError) {
        console.warn('[History] Advertencia: No se pudo registrar la consulta en PostgreSQL:', dbError instanceof Error ? dbError.message : dbError);
      }

      return result;
    } catch (error: unknown) {
      if ((error as any).code === 'MONTHLY_AI_LIMIT_REACHED' || (error as any).code === 'SENSITIVE_DATA_BLOCKED') {
        throw error;
      }

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
