import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { AiProcessResult, TokenUsage } from '../types/ai.types.js';

export class GroqService {
  private client: Groq | null = null;
  private readonly defaultTimeoutMs = 15000; // 15 segundos de timeout

  private getClient(): Groq {
    const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('GROQ_API_KEY no está configurada en las variables de entorno del servidor.');
    }
    if (!this.client || this.client.apiKey !== apiKey) {
      this.client = new Groq({
        apiKey,
        timeout: this.defaultTimeoutMs,
      });
    }
    return this.client;
  }

  async generateCompletion(systemPrompt: string, userText: string): Promise<AiProcessResult> {
    const groq = this.getClient();
    const model = env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const startTime = Date.now();

    try {
      const response = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
        temperature: 0.2, // Temperatura baja para alta fidelidad y consistencia
        max_tokens: 1024,
      });

      const latencyMs = Date.now() - startTime;
      const rawContent = response.choices[0]?.message?.content;

      if (!rawContent || rawContent.trim() === '') {
        throw new Error('El proveedor de IA devolvió una respuesta vacía.');
      }

      const result = rawContent.trim();

      let usage: TokenUsage | undefined;
      if (response.usage) {
        usage = {
          inputTokens: response.usage.prompt_tokens || 0,
          outputTokens: response.usage.completion_tokens || 0,
          totalTokens: response.usage.total_tokens || 0,
        };
      }

      if (env.NODE_ENV !== 'test') {
        console.log(`[AI] Solicitud completada exitosamente en ${latencyMs}ms | Modelo: ${model} | Tokens: ${usage?.totalTokens ?? 'N/A'}`);
      }

      return {
        result,
        model,
        usage,
        latencyMs,
      };
    } catch (error: unknown) {
      const latencyMs = Date.now() - startTime;
      if (env.NODE_ENV !== 'test') {
        console.error(`[AI] Error en llamada a Groq tras ${latencyMs}ms:`, error instanceof Error ? error.message : error);
      }
      throw error;
    }
  }
}

export const groqService = new GroqService();
