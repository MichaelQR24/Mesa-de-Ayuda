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
    regex: /(?:password|contrase[ñn]a|passwd|clave)\s*[:=]\s*["']?([^\s"'\n\r]{4,100})/i,
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
    regex: /(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis):\/\/[^\s]{6,200}/i,
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
const WARNING_PATTERNS: Array<{ type: string; prefix: string; regex: RegExp }> = [
  {
    type: 'EMAIL_ADDRESS',
    prefix: 'EMAIL',
    regex: /\b[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9-]{1,63}(?:\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,10}\b/g,
  },
  {
    type: 'PERUVIAN_PHONE',
    prefix: 'TEL',
    regex: /(?:\+51\s*)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g,
  },
  {
    type: 'PERUVIAN_DNI',
    prefix: 'DNI',
    regex: /(?:\bDNI\s*[:=]?\s*|\b)\d{8}\b/gi,
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

    // 2. Revisar patrones de advertencia (redactables)
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

    const detectionTypes = findings.map((f) => f.type);

    let status: AnalysisResult['status'] = 'SAFE';
    if (isBlocked) {
      status = 'BLOCKED';
    } else if (findings.length > 0) {
      status = 'WARNING';
    }

    return {
      status,
      findings,
      detectionTypes,
    };
  }

  /**
   * Anonimiza los datos personales reemplazándolos por marcadores determinísticos
   */
  redact(text: string): RedactionResult {
    if (!text || typeof text !== 'string') {
      return { redactedText: text, replacements: {}, hasRedactions: false };
    }

    let redacted = text;
    const replacements: Record<string, string> = {};
    let counter = 1;

    for (const item of WARNING_PATTERNS) {
      const regex = new RegExp(item.regex.source, 'gi');
      redacted = redacted.replace(regex, (match) => {
        const placeholder = `[${item.prefix}_${counter++}]`;
        replacements[placeholder] = match;
        return placeholder;
      });
    }

    return {
      redactedText: redacted,
      replacements,
      hasRedactions: Object.keys(replacements).length > 0,
    };
  }

  /**
   * Restaura los marcadores por sus valores originales tras el procesamiento de la IA
   */
  restore(text: string, replacements: Record<string, string>): string {
    if (!text || !replacements || Object.keys(replacements).length === 0) {
      return text;
    }

    let restored = text;
    for (const [placeholder, originalValue] of Object.entries(replacements)) {
      restored = restored.split(placeholder).join(originalValue);
    }

    return restored;
  }
}

export const sensitiveDataGuard = new SensitiveDataGuard();
