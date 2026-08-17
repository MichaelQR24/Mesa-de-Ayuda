/**
 * Utilidades para verificación y manipulación segura de elementos editables en el DOM
 */

export function isSensitiveInput(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLInputElement)) return false;

  const type = (el.getAttribute('type') || el.type || '').toLowerCase();
  if (type === 'password' || type === 'hidden' || type === 'file') return true;

  const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (
    autocomplete.includes('password') ||
    autocomplete.includes('current-password') ||
    autocomplete.includes('new-password') ||
    autocomplete.includes('cc-number') ||
    autocomplete.includes('cc-csc') ||
    autocomplete.includes('cc-exp') ||
    autocomplete.includes('credit-card')
  ) {
    return true;
  }

  const nameOrId = ((el.name || '') + ' ' + (el.id || '')).toLowerCase();
  if (
    nameOrId.includes('password') ||
    nameOrId.includes('passwd') ||
    nameOrId.includes('cardnumber') ||
    nameOrId.includes('cvv') ||
    nameOrId.includes('cvc')
  ) {
    return true;
  }

  return false;
}

export function isPasswordInput(el: Element | null): boolean {
  return isSensitiveInput(el);
}

export function isEditableInputOrTextarea(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;

  if (isSensitiveInput(el)) return false;

  if (el instanceof HTMLTextAreaElement) {
    return !el.disabled && !el.readOnly;
  }

  if (el instanceof HTMLInputElement) {
    if (el.disabled || el.readOnly) return false;
    const type = (el.getAttribute('type') || el.type || 'text').toLowerCase();
    const supportedTypes = ['text', 'search', 'url', 'tel', 'email'];
    return supportedTypes.includes(type);
  }

  return false;
}

export function isContentEditableElement(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.isContentEditable && el.contentEditable !== 'false';
}

/**
 * Reemplaza de forma segura la selección de texto en un input o textarea preservando el texto circundante.
 */
export function replaceInputSelection(
  el: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end: number,
  replacementText: string
): boolean {
  try {
    if (el.disabled || el.readOnly) return false;
    if (isSensitiveInput(el)) return false;

    const fullValue = el.value;
    const safeStart = Math.max(0, Math.min(start, fullValue.length));
    const safeEnd = Math.max(safeStart, Math.min(end, fullValue.length));

    const before = fullValue.substring(0, safeStart);
    const after = fullValue.substring(safeEnd);
    const updatedValue = before + replacementText + after;

    el.value = updatedValue;

    // Colocar el cursor al final del texto insertado
    const newCursorPos = safeStart + replacementText.length;
    el.setSelectionRange(newCursorPos, newCursorPos);
    el.focus();

    // Disparar eventos nativos para que frameworks y validadores sincronicen
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    return true;
  } catch (err) {
    console.error('[Mesa de Ayuda] Error al reemplazar texto en input:', err);
    return false;
  }
}

/**
 * Reemplaza de forma segura la selección en un elemento con contenteditable="true"
 */
export function replaceContentEditableSelection(range: Range, replacementText: string): boolean {
  try {
    const selection = window.getSelection();
    if (!selection) return false;

    selection.removeAllRanges();
    selection.addRange(range);

    range.deleteContents();
    const textNode = document.createTextNode(replacementText);
    range.insertNode(textNode);

    // Mover cursor al final del nodo insertado
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    const container = textNode.parentElement;
    if (container) {
      container.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }

    return true;
  } catch (err) {
    console.error('[Mesa de Ayuda] Error al reemplazar texto en contenteditable:', err);
    return false;
  }
}
