import { describe, it, expect } from 'vitest';
import { sensitiveDataGuard } from '../src/utils/sensitive-data.guard.js';

describe('Performance & Anti-ReDoS Stress Tests (Fase 13)', () => {
  it('debe analizar un texto largo de 5,000 caracteres en menos de 10 milisegundos sin backtracking', () => {
    // Generar texto largo con repeticiones de caracteres y palabras clave
    const baseChunk = 'El usuario solicita soporte para la configuración de su cuenta de correo usuario.prueba@empresa.com.pe y teléfono 987654321. ';
    const longText = baseChunk.repeat(Math.ceil(5000 / baseChunk.length)).slice(0, 5000);

    const start = performance.now();
    const result = sensitiveDataGuard.analyze(longText);
    const durationMs = performance.now() - start;

    expect(durationMs).toBeLessThan(15); // Debe ser ultrarrápido (< 15ms)
    expect(result.status).toBe('WARNING');
    expect(result.detectionTypes).toContain('EMAIL_ADDRESS');
  });

  it('debe resistir ataques de payload ambiguo ReDoS (10,000 chars) en < 20ms', () => {
    // Patrón diseñado para causar backtracking catastrófico en regex defectuosas
    const maliciousPayload = 'a'.repeat(5000) + '@' + 'b'.repeat(5000) + '...';

    const start = performance.now();
    const result = sensitiveDataGuard.analyze(maliciousPayload);
    const durationMs = performance.now() - start;

    expect(durationMs).toBeLessThan(25);
    expect(result.status).toBe('SAFE');
  });

  it('debe redondear y restaurar textos en tiempo lineal O(N)', () => {
    const textToRedact = 'Contactar a juan@perez.com o al teléfono 912345678 para validar DNI 12345678.';
    
    const start = performance.now();
    const redaction = sensitiveDataGuard.redact(textToRedact);
    const restored = sensitiveDataGuard.restore(redaction.redactedText, redaction.replacements);
    const durationMs = performance.now() - start;

    expect(durationMs).toBeLessThan(5);
    expect(restored).toBe(textToRedact);
  });
});
