/**
 * Configuración centralizada de precios de modelos de IA para estimación de costos
 */

export interface ModelPricing {
  provider: string;
  model: string;
  inputPricePerMillionUsd: number;
  outputPricePerMillionUsd: number;
}

export const AI_PRICING_CONFIG: Record<string, ModelPricing> = {
  'llama-3.1-8b-instant': {
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    inputPricePerMillionUsd: 0.05,  // $0.05 por cada millón de tokens de entrada
    outputPricePerMillionUsd: 0.08, // $0.08 por cada millón de tokens de salida
  },
};

export function calculateEstimatedCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = AI_PRICING_CONFIG[model] || AI_PRICING_CONFIG['llama-3.1-8b-instant'];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillionUsd;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillionUsd;
  return Number((inputCost + outputCost).toFixed(6));
}
