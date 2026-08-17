/**
 * Background Service Worker - Mesa de Ayuda
 * Gestión de Side Panel API, Menús Contextuales y Comunicación de Selección
 */

import { ActionType } from '../sidepanel/types/index';
import { SelectedTextContext } from '../types/messaging.types';

export const MENU_ROOT_ID = 'mesa-ayuda-root';

export interface ContextMenuItemConfig {
  id: string;
  title: string;
  action: ActionType | null;
}

export const CONTEXT_MENU_ITEMS: ContextMenuItemConfig[] = [
  { id: 'mesa-ayuda-correct', title: 'Corregir', action: 'corregir' },
  { id: 'mesa-ayuda-paraphrase', title: 'Parafrasear', action: 'parafrasear' },
  { id: 'mesa-ayuda-professionalize', title: 'Profesionalizar', action: 'profesionalizar' },
  { id: 'mesa-ayuda-summarize', title: 'Resumir', action: 'resumir' },
  { id: 'mesa-ayuda-reply', title: 'Generar respuesta', action: 'responder' },
  { id: 'mesa-ayuda-open', title: 'Enviar al asistente', action: null },
];

/**
 * Función pura para resolver la acción a partir del menuItemId
 */
export function resolveMenuAction(menuItemId: string | number): { valid: boolean; action: ActionType | null } {
  const item = CONTEXT_MENU_ITEMS.find((m) => m.id === menuItemId);
  if (!item) {
    return { valid: false, action: null };
  }
  return { valid: true, action: item.action };
}

// 1. Configurar comportamiento del Side Panel al hacer clic en el icono
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => {
      console.error('[Mesa de Ayuda] Error configurando comportamiento de Side Panel:', error);
    });
}

// 2. Crear menús contextuales en instalación o inicio del Service Worker
function setupContextMenus(): void {
  if (typeof chrome === 'undefined' || !chrome.contextMenus) return;

  try {
    chrome.contextMenus.removeAll(() => {
      // Menú Padre
      chrome.contextMenus.create({
        id: MENU_ROOT_ID,
        title: 'Mesa de Ayuda',
        contexts: ['selection'],
      });

      // Opciones Hijas
      CONTEXT_MENU_ITEMS.forEach((item) => {
        chrome.contextMenus.create({
          id: item.id,
          parentId: MENU_ROOT_ID,
          title: item.title,
          contexts: ['selection'],
        });
      });
    });
  } catch (err) {
    console.error('[Mesa de Ayuda] Error creando menús contextuales:', err);
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    setupContextMenus();
  });
}

// 3. Manejar clicks en el menú contextual
if (typeof chrome !== 'undefined' && chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || typeof tab.id !== 'number') return;
    const tabId = tab.id;

    const { valid, action } = resolveMenuAction(info.menuItemId);
    if (!valid) return;

    const rawSelection = (info.selectionText || '').trim();
    if (!rawSelection) return;

    // 1. Intentar abrir Side Panel en la pestaña actual
    if (chrome.sidePanel && chrome.sidePanel.open) {
      try {
        await chrome.sidePanel.open({ tabId });
      } catch (err) {
        console.warn('[Mesa de Ayuda] Aviso al abrir Side Panel en pestaña protegida o restringida:', err);
      }
    }

    // 2. Intentar consultar detalles enriquecidos al Content Script (si está inyectado y es editable)
    let context: SelectedTextContext = {
      text: rawSelection,
      sourceType: 'page',
      source: 'context-menu',
      canReplace: false,
      tabId,
      suggestedAction: action,
    };

    if (chrome.tabs && chrome.tabs.sendMessage) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_SELECTED_TEXT' });
        if (response && response.success && response.data) {
          context = {
            ...response.data,
            source: 'context-menu',
            tabId,
            suggestedAction: action,
          };
        }
      } catch {
        // En páginas sin Content Script o no accesibles se conserva el rawSelection capturado por Chrome
      }
    }

    // 3. Guardar en session storage (para que el Side Panel lo lea si aún no estaba abierto o tras login)
    if (chrome.storage && chrome.storage.session) {
      await chrome.storage.session.set({ pendingSelection: context });
    }

    // 4. Notificar también por mensaje en tiempo real si el Side Panel ya está abierto
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'LOAD_SELECTION', payload: context }).catch(() => {});
    }
  });
}

// 4. Invalidar contexto de reemplazo si el usuario cambia de pestaña activa
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener(async () => {
    if (chrome.storage && chrome.storage.session) {
      const data = (await chrome.storage.session.get(['pendingSelection'])) as {
        pendingSelection?: SelectedTextContext;
      };
      if (data.pendingSelection && data.pendingSelection.canReplace) {
        await chrome.storage.session.set({
          pendingSelection: {
            ...data.pendingSelection,
            canReplace: false,
          },
        });
      }
    }
  });
}
