import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../src/prompts/prompts.js';

describe('Auditoría de Prompts de IA - Cero Controles Falsos', () => {
  it('la acción CORRECT debe mantener enfoque estricto en ortografía y gramática', () => {
    const prompt = buildSystemPrompt('correct', 'professional', 'medium');
    expect(prompt).toContain('CORREGIR');
    expect(prompt).toContain('ortografía, gramática y puntuación');
  });

  it('la acción PARAPHRASE debe incorporar el nivel de cambio y el tono de forma real', () => {
    const promptSoft = buildSystemPrompt('paraphrase', 'technical', 'soft');
    expect(promptSoft).toContain('PARAFRASEAR');
    expect(promptSoft).toContain('modificaciones leves');
    expect(promptSoft).toContain('tono técnico y preciso');

    const promptComplete = buildSystemPrompt('paraphrase', 'friendly', 'complete');
    expect(promptComplete).toContain('reescritura integral');
    expect(promptComplete).toContain('tono amable, cordial y empático');
  });

  it('la acción PROFESSIONALIZE debe inyectar el tono seleccionado sin ser un control falso', () => {
    const promptTechnical = buildSystemPrompt('professionalize', 'technical', 'medium');
    expect(promptTechnical).toContain('PROFESIONALIZAR en tono técnico y preciso');

    const promptFriendly = buildSystemPrompt('professionalize', 'friendly', 'medium');
    expect(promptFriendly).toContain('PROFESIONALIZAR en tono amable, cordial y empático');

    const promptFormal = buildSystemPrompt('professionalize', 'formal', 'medium');
    expect(promptFormal).toContain('PROFESIONALIZAR en tono formal y protocolar');
  });

  it('la acción SUMMARIZE debe enfocarse en concisión', () => {
    const prompt = buildSystemPrompt('summarize', 'professional', 'medium');
    expect(prompt).toContain('RESUMIR');
    expect(prompt).toContain('máximo 2-3 viñetas');
  });

  it('la acción REPLY debe inyectar el tono de respuesta seleccionado', () => {
    const promptCasual = buildSystemPrompt('reply', 'casual', 'medium');
    expect(promptCasual).toContain('RESPONDER al usuario en tono casual, directo y accesible');

    const promptFormal = buildSystemPrompt('reply', 'formal', 'medium');
    expect(promptFormal).toContain('RESPONDER al usuario en tono formal y protocolar');
  });
});
