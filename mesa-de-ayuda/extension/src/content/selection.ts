import { SelectedTextContext, SourceType } from '../types/messaging.types';
import {
  isEditableInputOrTextarea,
  isPasswordInput,
  isContentEditableElement,
  replaceInputSelection,
  replaceContentEditableSelection,
} from './editable-target';

interface ActiveSelectionState {
  context: SelectedTextContext | null;
  targetElement: HTMLElement | null;
  savedRange: Range | null;
  selectionStart?: number;
  selectionEnd?: number;
}

let currentState: ActiveSelectionState = {
  context: null,
  targetElement: null,
  savedRange: null,
};

/**
 * Captura la selección de texto activa en la página respetando los tipos de elementos
 */
export function captureSelection(): SelectedTextContext | null {
  const activeEl = document.activeElement as HTMLElement | null;

  // 1. Prohibir lectura de campos de contraseñas por seguridad estricta
  if (isPasswordInput(activeEl)) {
    currentState = { context: null, targetElement: null, savedRange: null };
    return null;
  }

  // 2. Input o Textarea
  if (isEditableInputOrTextarea(activeEl)) {
    const start = activeEl.selectionStart ?? 0;
    const end = activeEl.selectionEnd ?? 0;

    if (start !== end) {
      const selectedText = activeEl.value.substring(start, end).trim();
      if (selectedText.length > 0) {
        const sourceType: SourceType = activeEl instanceof HTMLTextAreaElement ? 'textarea' : 'input';
        const context: SelectedTextContext = {
          text: selectedText,
          sourceType,
          canReplace: true,
          selectionStart: start,
          selectionEnd: end,
        };

        currentState = {
          context,
          targetElement: activeEl,
          savedRange: null,
          selectionStart: start,
          selectionEnd: end,
        };

        return context;
      }
    }
  }

  // 3. ContentEditable
  if (isContentEditableElement(activeEl) || (activeEl && activeEl.closest('[contenteditable="true"]'))) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text.length > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        const context: SelectedTextContext = {
          text,
          sourceType: 'contenteditable',
          canReplace: true,
        };

        currentState = {
          context,
          targetElement: activeEl,
          savedRange: range,
        };

        return context;
      }
    }
  }

  // 4. Texto general de la página (no editable)
  const windowSelection = window.getSelection();
  if (windowSelection && windowSelection.rangeCount > 0 && !windowSelection.isCollapsed) {
    const text = windowSelection.toString().trim();
    if (text.length > 0) {
      const context: SelectedTextContext = {
        text,
        sourceType: 'page',
        canReplace: false,
      };

      currentState = {
        context,
        targetElement: null,
        savedRange: null,
      };

      return context;
    }
  }

  currentState = { context: null, targetElement: null, savedRange: null };
  return null;
}

/**
 * Devuelve el estado actual o ejecuta una captura bajo demanda
 */
export function getSelectionContext(): SelectedTextContext | null {
  return captureSelection();
}

/**
 * Reemplaza el texto en el target original guardado si sigue siendo válido
 */
export function performReplacement(replacementText: string): { success: boolean; error?: string } {
  if (!currentState.context || !currentState.context.canReplace) {
    return {
      success: false,
      error: 'La selección original no es editable o no permite reemplazo directo.',
    };
  }

  const { targetElement, savedRange, selectionStart, selectionEnd } = currentState;

  // Reemplazo en Input / Textarea
  if (targetElement && isEditableInputOrTextarea(targetElement)) {
    if (!document.contains(targetElement)) {
      return { success: false, error: 'El campo de texto original ya no existe en la página.' };
    }

    if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
      const ok = replaceInputSelection(targetElement, selectionStart, selectionEnd, replacementText);
      if (ok) {
        // Actualizar rango post-reemplazo
        currentState.selectionEnd = selectionStart + replacementText.length;
        return { success: true };
      }
    }
  }

  // Reemplazo en ContentEditable
  if (savedRange) {
    const ok = replaceContentEditableSelection(savedRange, replacementText);
    if (ok) {
      return { success: true };
    }
  }

  return {
    success: false,
    error: 'La selección original cambió o el elemento ya no está disponible.',
  };
}
