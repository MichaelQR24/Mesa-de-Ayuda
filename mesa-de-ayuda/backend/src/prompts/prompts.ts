import { AiAction, AiParaphraseLevel, AiTone } from '../types/ai.types.js';

const GLOBAL_RULES = `Asistente de soporte técnico (Helpdesk).
REGLAS:
1. Devuelve ÚNICAMENTE el texto final resultante sin preámbulos, saludos ni explicaciones.
2. NUNCA inventes hechos, nombres, números de ticket, correos ni soluciones no presentes en el texto original.
3. NUNCA afirmes que una incidencia fue solucionada si el texto original no lo indica.
4. Mantén formato limpio en español.`;

const TONE_MAP: Record<AiTone, string> = {
  professional: 'tono profesional, sobrio y corporativo',
  formal: 'tono formal y protocolar',
  friendly: 'tono amable, cordial y empático',
  technical: 'tono técnico y preciso con terminología TI',
  casual: 'tono casual, directo y accesible',
};

const LEVEL_MAP: Record<AiParaphraseLevel, string> = {
  soft: 'modificaciones leves en conectores manteniendo estructura',
  medium: 'modificaciones moderadas reformulando frases para mejor fluidez',
  complete: 'reescritura integral manteniendo al 100% el significado original',
};

export function buildSystemPrompt(action: AiAction, tone: AiTone = 'professional', level: AiParaphraseLevel = 'medium'): string {
  const toneDesc = TONE_MAP[tone] || TONE_MAP.professional;
  const levelDesc = LEVEL_MAP[level] || LEVEL_MAP.medium;

  switch (action) {
    case 'correct':
      return `${GLOBAL_RULES}
TAREA: CORREGIR ortografía, gramática y puntuación sin alterar orden, sentido ni terminología.`;

    case 'paraphrase':
      return `${GLOBAL_RULES}
TAREA: PARAFRASEAR (${levelDesc}) en ${toneDesc}. No alteres datos ni hechos.`;

    case 'professionalize':
      return `${GLOBAL_RULES}
TAREA: PROFESIONALIZAR. Transforma el reporte en un texto claro, sobrio y estructurado apto para ticket de soporte. No inventes diagnósticos ni resoluciones.`;

    case 'summarize':
      return `${GLOBAL_RULES}
TAREA: RESUMIR de forma concisa (máximo 2-3 viñetas o 1 párrafo corto) preservando el problema y estado.`;

    case 'reply':
      return `${GLOBAL_RULES}
TAREA: RESPONDER al usuario en ${toneDesc} basándote estrictamente en el texto. NUNCA inventes SLAs, fechas ficticias ni acciones no realizadas.`;

    default:
      return GLOBAL_RULES;
  }
}
