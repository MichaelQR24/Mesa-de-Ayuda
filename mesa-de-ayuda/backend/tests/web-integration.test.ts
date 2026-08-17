import { describe, it, expect } from 'vitest';

// 1. Mapeo de Context Menus a acciones del Asistente
const CONTEXT_MENU_MAPPINGS: Record<string, string | null> = {
  'mesa-ayuda-correct': 'corregir',
  'mesa-ayuda-paraphrase': 'parafrasear',
  'mesa-ayuda-professionalize': 'profesionalizar',
  'mesa-ayuda-summarize': 'resumir',
  'mesa-ayuda-reply': 'responder',
  'mesa-ayuda-open': null,
};

function resolveMenuActionTest(menuItemId: string): { valid: boolean; action: string | null } {
  if (Object.prototype.hasOwnProperty.call(CONTEXT_MENU_MAPPINGS, menuItemId)) {
    return { valid: true, action: CONTEXT_MENU_MAPPINGS[menuItemId] };
  }
  return { valid: false, action: null };
}

// 2. Detección de Password Fields
function isPasswordElementMock(attributes: { type?: string; autocomplete?: string }): boolean {
  const type = (attributes.type || '').toLowerCase();
  if (type === 'password') return true;

  const autocomplete = (attributes.autocomplete || '').toLowerCase();
  if (
    autocomplete.includes('password') ||
    autocomplete.includes('current-password') ||
    autocomplete.includes('new-password')
  ) {
    return true;
  }

  return false;
}

// 3. Reemplazo de texto en input
function calculateInputReplacement(
  originalValue: string,
  start: number,
  end: number,
  replacementText: string
): { updatedValue: string; newCursorPos: number } {
  const safeStart = Math.max(0, Math.min(start, originalValue.length));
  const safeEnd = Math.max(safeStart, Math.min(end, originalValue.length));

  const before = originalValue.substring(0, safeStart);
  const after = originalValue.substring(safeEnd);
  const updatedValue = before + replacementText + after;
  const newCursorPos = safeStart + replacementText.length;

  return { updatedValue, newCursorPos };
}

describe('Web Integration & Context Menu Logic (Fase 7)', () => {
  describe('Mapeo de Menú Contextual (contextMenus)', () => {
    it('debe mapear mesa-ayuda-correct a la acción corregir', () => {
      const res = resolveMenuActionTest('mesa-ayuda-correct');
      expect(res.valid).toBe(true);
      expect(res.action).toBe('corregir');
    });

    it('debe mapear mesa-ayuda-paraphrase a la acción parafrasear', () => {
      const res = resolveMenuActionTest('mesa-ayuda-paraphrase');
      expect(res.valid).toBe(true);
      expect(res.action).toBe('parafrasear');
    });

    it('debe mapear mesa-ayuda-professionalize a la acción profesionalizar', () => {
      const res = resolveMenuActionTest('mesa-ayuda-professionalize');
      expect(res.valid).toBe(true);
      expect(res.action).toBe('profesionalizar');
    });

    it('debe mapear mesa-ayuda-summarize a la acción resumir', () => {
      const res = resolveMenuActionTest('mesa-ayuda-summarize');
      expect(res.valid).toBe(true);
      expect(res.action).toBe('resumir');
    });

    it('debe mapear mesa-ayuda-reply a la acción responder', () => {
      const res = resolveMenuActionTest('mesa-ayuda-reply');
      expect(res.valid).toBe(true);
      expect(res.action).toBe('responder');
    });

    it('debe mapear mesa-ayuda-open a null (solo enviar al asistente sin preseleccionar acción)', () => {
      const res = resolveMenuActionTest('mesa-ayuda-open');
      expect(res.valid).toBe(true);
      expect(res.action).toBeNull();
    });

    it('debe rechazar IDs de menú desconocidos', () => {
      const res = resolveMenuActionTest('mesa-ayuda-unknown');
      expect(res.valid).toBe(false);
      expect(res.action).toBeNull();
    });
  });

  describe('Seguridad y Detección de Password Fields', () => {
    it('debe rechazar estrictamente inputs con type="password"', () => {
      expect(isPasswordElementMock({ type: 'password' })).toBe(true);
    });

    it('debe rechazar inputs con autocomplete relacionado a contraseñas', () => {
      expect(isPasswordElementMock({ type: 'text', autocomplete: 'current-password' })).toBe(true);
      expect(isPasswordElementMock({ type: 'text', autocomplete: 'new-password' })).toBe(true);
    });

    it('debe permitir inputs normales de texto', () => {
      expect(isPasswordElementMock({ type: 'text' })).toBe(false);
      expect(isPasswordElementMock({ type: 'search' })).toBe(false);
    });
  });

  describe('Cálculo de Reemplazo Preservando Texto Circundante', () => {
    it('debe reemplazar únicamente el fragmento seleccionado en un textarea/input', () => {
      const original = 'Hola equipo, el usuario no puede entrar al sistema. Gracias.';
      const start = 13;
      const end = 50; // "el usuario no puede entrar al sistema"
      const replacement = 'el colaborador presenta dificultades para acceder al aplicativo institucional';

      const result = calculateInputReplacement(original, start, end, replacement);

      expect(result.updatedValue).toBe(
        'Hola equipo, el colaborador presenta dificultades para acceder al aplicativo institucional. Gracias.'
      );
      expect(result.newCursorPos).toBe(13 + replacement.length);
    });

    it('debe manejar selecciones al inicio del texto', () => {
      const original = 'Texto inicial y resto del mensaje';
      const result = calculateInputReplacement(original, 0, 13, 'Comienzo');
      expect(result.updatedValue).toBe('Comienzo y resto del mensaje');
    });

    it('debe manejar selecciones al final del texto', () => {
      const original = 'Mensaje con final incorrecto';
      const result = calculateInputReplacement(original, 12, 28, 'cierre formal.');
      expect(result.updatedValue).toBe('Mensaje con cierre formal.');
    });

    it('debe proteger contra índices fuera de rango', () => {
      const original = 'Prueba';
      const result = calculateInputReplacement(original, -5, 100, 'Reemplazo');
      expect(result.updatedValue).toBe('Reemplazo');
    });
  });
});
