/**
 * SensitiveDataGuard
 * Módulo de detección, bloqueo y anonimización de datos sensibles
 * antes de interactuar con proveedores externos de IA.
 * 
 * AVISO: Ningún detector heurístico garantiza 100% de cobertura.
 * Este guard actúa como una capa de defensa en profundidad.
 */

export interface Finding {
  type: string;
  severity: 'BLOCKED' | 'WARNING';
  count: number;
}

export interface AnalysisResult {
  status: 'SAFE' | 'WARNING' | 'BLOCKED';
  findings: Finding[];
  detectionTypes: string[];
}

export interface RedactionResult {
  redactedText: string;
  replacements: Record<string, string>;
  hasRedactions: boolean;
}

// Patrones que causan BLOQUEO inmediato (BLOCKED)
const BLOCKED_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  {
    type: 'EXPLICIT_PASSWORD',
    regex: /(?:password|contrase[ñn]a|passwd|clave)\s*[:=]\s*["']?([^\s"'\n\r]{4,})/i,
  },
  {
    type: 'API_KEY_GROQ_OPENAI_GITHUB',
    regex: /(?:gsk_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})/,
  },
  {
    type: 'JWT_TOKEN',
    regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
  },
  {
    type: 'BEARER_AUTH_HEADER',
    regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/i,
  },
  {
    type: 'DATABASE_CONNECTION_STRING',
    regex: /(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis):\/\/[^\s]+/i,
  },
  {
    type: 'PRIVATE_KEY_PEM',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    type: 'CREDIT_CARD_LIKELY',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
  },
];

// Patrones que generan ADVERTENCIA y son REDACTABLES (WARNING)
const WARNING_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  {
    type: 'PERUVIAN_DNI',
    regex: /(?:\bDNI\s*[:=]?\s*|\b)\d{8}\b/gi,
  },
  {
    type: 'PERUVIAN_PHONE',
    regex: /(?:\+51\s*)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g,
  },
  {
    type: 'EMAIL_ADDRESS',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  },
];

export class SensitiveDataGuard {
  /**
   * Analiza el texto en busca de patrones sensibles
   */
  analyze(text: string): AnalysisResult {
    if (!text || typeof text !== 'string') {
      return { status: 'SAFE', findings: [], detectionTypes: [] };
    }

    const findings: Finding[] = [];
    let isBlocked = false;

    // 1. Revisar patrones bloqueantes
    for (const item of BLOCKED_PATTERNS) {
      const matches = text.match(new RegExp(item.regex.source, 'gi'));
      if (matches && matches.length > 0) {
        isBlocked = true;
        findings.push({
          type: item.type,
          severity: 'BLOCKED',
          count: matches.length,
        });
      }
    }

    // 2. Revisar patrones de advertencia
    for (const item of WARNING_PATTERNS) {
      const matches = text.match(new RegExp(item.regex.source, 'gi'));
      if (matches && matches.length > 0) {
        findings.push({
          type: item.type,
          severity: 'WARNING',
          count: matches.length,
        });
      }
    }

    let status: 'SAFE' | 'WARNING' | 'BLOCKED' = 'SAFE';
    if (isBlocked) {
      status = 'BLOCKED';
    } else if (findings.length > 0) {
      status = 'WARNING';
    }

    return {
      status,
      findings,
      detectionTypes: findings.map((f) => f.type),
    };
  }

  /**
   * Redacta datos personales comunes (email, teléfono, DNI) reemplazándolos con marcadores seguros
   */
  redact(text: string): RedactionResult {
    if (!text) return { redactedText: text, replacements: {}, hasRedactions: false };

    let redacted = text;
    const replacements: Record<string, string> = {};
    let counter = 1;

    // Redactar Emails
    redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
      const placeholder = `[EMAIL_${counter++}]`;
      replacements[placeholder] = match;
      return placeholder;
    });

    // Redactar Teléfonos peruanos
    redacted = redacted.replace(/(?:\+51\s*)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g, (match) => {
      const placeholder = `[TEL_${counter++}]`;
      replacements[placeholder] = match;
      return placeholder;
    });

    // Redactar DNIs (8 dígitos)
    redacted = redacted.replace(/\b\d{8}\b/g, (match) => {
      const placeholder = `[DNI_${counter++}]`;
      replacements[placeholder] = match;
      return placeholder;
    });

    const hasRedactions = Object.keys(replacements).length > 0;

    return {
      redactedText: redacted,
      replacements,
      hasRedactions,
    };
  }

  /**
   * Restaura los marcadores por sus valores originales en el texto de respuesta
   */
  restore(redactedText: string, replacements: Record<string, string>): string {
    if (!redactedText || Object.keys(replacements).length === 0) {
      return redactedText;
    }

    let restored = redactedText;
    for (const [placeholder, originalValue] of Object.entries(replacements)) {
      // Reemplazo global del marcador
      restored = restored.split(placeholder).join(originalValue);
    }

    return restored;
  }
}

export const sensitiveDataGuard = new SensitiveDataGuard();
