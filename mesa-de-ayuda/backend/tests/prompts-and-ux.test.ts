import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../src/prompts/prompts.js';
import { aiProcessSchema } from '../src/schemas/ai.schema.js';

describe('Auditoría de Prompts de IA - Estilo Mesa de Ayuda Automático', () => {
  describe('Acción PARAPHRASE con Estilo Mesa de Ayuda Automático', () => {
    it('1. Estilo helpdesk activa automáticamente las directrices de Mesa de Ayuda e infinitivos', () => {
      const prompt = buildSystemPrompt('paraphrase', 'helpdesk', 'medium');
      expect(prompt).toContain('ESTILO MESA DE AYUDA');
      expect(prompt).toContain('DIRECTRICES OBLIGATORIAS DE MESA DE AYUDA:');
      expect(prompt).toContain('VERBOS OPERATIVOS EN INFINITIVO:');
      expect(prompt).toContain('Por favor, apoyar con...');
      expect(prompt).toContain('Por favor, validar...');
      expect(prompt).toContain('Por favor, verificar...');
      expect(prompt).toContain('NO uses "Agradeceré su valioso apoyo..."');
      expect(prompt).toContain('NUNCA transformes una solicitud de ayuda en una acción ya efectuada');
    });

    it('2. helpdesk prohíbe inventar información y mantiene brevedad operativa', () => {
      const prompt = buildSystemPrompt('paraphrase', 'helpdesk', 'medium');
      expect(prompt).toContain('NUNCA inventes información no presente en el texto original');
      expect(prompt).toContain('Mantén intactos todos los datos clave');
    });

    it('3. Nivel Ligero (soft) respeta estructura y vocabulario', () => {
      const prompt = buildSystemPrompt('paraphrase', 'helpdesk', 'soft');
      expect(prompt).toContain('Nivel Ligero');
      expect(prompt).toContain('conservando casi intacta la estructura y vocabulario original');
    });

    it('4. Nivel Moderado (medium) mejora orden y fluidez', () => {
      const prompt = buildSystemPrompt('paraphrase', 'helpdesk', 'medium');
      expect(prompt).toContain('Nivel Moderado');
      expect(prompt).toContain('mejora fluidez, claridad y redacción ordenada');
    });

    it('5. Nivel Alto (complete) reformula pero exige SIEMPRE brevedad (sin correos extensos)', () => {
      const prompt = buildSystemPrompt('paraphrase', 'helpdesk', 'complete');
      expect(prompt).toContain('Nivel Alto');
      expect(prompt).toContain('SIEMPRE conservando la brevedad y el carácter operativo (sin crear correos extensos)');
    });

    it('6. Estilo Formal', () => {
      const prompt = buildSystemPrompt('paraphrase', 'formal', 'medium');
      expect(prompt).toContain('estilo formal y protocolar');
    });

    it('7. Estilo Institucional', () => {
      const prompt = buildSystemPrompt('paraphrase', 'institutional', 'medium');
      expect(prompt).toContain('estilo institucional');
    });

    it('8. Estilo Directo', () => {
      const prompt = buildSystemPrompt('paraphrase', 'direct', 'medium');
      expect(prompt).toContain('estilo directo');
      expect(prompt).toContain('sin rodeos');
    });
  });

  describe('Validación de Esquema Zod (aiProcessSchema)', () => {
    it('9. Acepta estilos válidos y el payload sin checkbox', () => {
      const validPayload = {
        text: 'estimado emerson por favor apoyar con la configuracion de una laptop',
        action: 'paraphrase',
        tone: 'helpdesk',
        paraphraseLevel: 'medium',
      };
      const result = aiProcessSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('10. Rechaza valores no permitidos en el esquema', () => {
      const invalidPayload = {
        text: 'texto de prueba',
        action: 'accion_inexistente',
        tone: 'estilo_falso',
      };
      const result = aiProcessSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('Otras Acciones del Asistente (Regresión)', () => {
    it('11. CORRECT, PROFESSIONALIZE, SUMMARIZE y REPLY se mantienen operativas', () => {
      const promptCorrect = buildSystemPrompt('correct', 'professional', 'medium');
      expect(promptCorrect).toContain('CORREGIR ortografía, gramática, tildes y puntuación');

      const promptProf = buildSystemPrompt('professionalize', 'technical', 'medium');
      expect(promptProf).toContain('PROFESIONALIZAR en tono técnico y preciso');

      const promptSum = buildSystemPrompt('summarize', 'professional', 'medium');
      expect(promptSum).toContain('RESUMIR');

      const promptReply = buildSystemPrompt('reply', 'formal', 'medium');
      expect(promptReply).toContain('RESPONDER al usuario');
    });
  });
});
