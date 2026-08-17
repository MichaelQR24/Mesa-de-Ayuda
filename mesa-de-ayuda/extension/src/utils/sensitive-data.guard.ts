/**
 * SensitiveDataGuard (Frontend)
 * Capa de advertencia y anonimización previa en el Side Panel.
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

const BLOCKED_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  {
    type: 'Contraseña o credencial explícita',
    regex: /(?:password|contrase[ñn]a|passwd|clave)\s*[:=]\s*["']?([^\s"'\n\r]{4,})/i,
  },
  {
    type: 'API Key (Groq / OpenAI / GitHub)',
    regex: /(?:gsk_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})/,
  },
  {
    type: 'Token JWT',
    regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
  },
  {
    type: 'Bearer Token',
    regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/i,
  },
  {
    type: 'Cadena de conexión a Base de Datos',
    regex: /(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis):\/\/[^\s]+/i,
  },
  {
    type: 'Clave privada RSA / SSH',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    type: 'Número de tarjeta de crédito',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
  },
];

const WARNING_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  {
    type: 'DNI peruano (8 dígitos)',
    regex: /(?:\bDNI\s*[:=]?\s*|\b)\d{8}\b/gi,
  },
  {
    type: 'Número de teléfono',
    regex: /(?:\+51\s*)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g,
  },
  {
    type: 'Correo electrónico',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  },
];

export class SensitiveDataGuard {
  analyze(text: string): AnalysisResult {
    if (!text || typeof text !== 'string') {
      return { status: 'SAFE', findings: [], detectionTypes: [] };
    }

    const findings: Finding[] = [];
    let isBlocked = false;

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

  redact(text: string): RedactionResult {
    if (!text) return { redactedText: text, replacements: {}, hasRedactions: false };

    let redacted = text;
    const replacements: Record<string, string> = {};
    let counter = 1;

    redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
      const placeholder = `[EMAIL_${counter++}]`;
      replacements[placeholder] = match;
      return placeholder;
    });

    redacted = redacted.replace(/(?:\+51\s*)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g, (match) => {
      const placeholder = `[TEL_${counter++}]`;
      replacements[placeholder] = match;
      return placeholder;
    });

    redacted = redacted.replace(/\b\d{8}\b/g, (match) => {
      const placeholder = `[DNI_${counter++}]`;
      replacements[placeholder] = match;
      return placeholder;
    });

    return {
      redactedText: redacted,
      replacements,
      hasRedactions: Object.keys(replacements).length > 0,
    };
  }

  restore(redactedText: string, replacements: Record<string, string>): string {
    if (!redactedText || Object.keys(replacements).length === 0) {
      return redactedText;
    }

    let restored = redactedText;
    for (const [placeholder, originalValue] of Object.entries(replacements)) {
      restored = restored.split(placeholder).join(originalValue);
    }
    return restored;
  }
}

export const sensitiveDataGuard = new SensitiveDataGuard();
