import { ExtensionMessage } from '../types/messaging.types';
import { getSelectionContext, performReplacement } from './selection';

export function initContentMessaging(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) {
    return;
  }

  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse: (response: any) => void) => {
      try {
        if (!message || typeof message !== 'object' || !('type' in message)) {
          return false;
        }

        switch (message.type) {
          case 'PING': {
            sendResponse({ success: true });
            return true;
          }

          case 'GET_SELECTED_TEXT': {
            const context = getSelectionContext();
            if (context) {
              sendResponse({ success: true, data: context });
            } else {
              sendResponse({
                success: false,
                error: 'No se encontró ningún texto seleccionado en la página.',
              });
            }
            return true;
          }

          case 'REPLACE_SELECTION': {
            const replacementText = message.payload?.replacementText;
            if (typeof replacementText !== 'string') {
              sendResponse({ success: false, error: 'Texto de reemplazo inválido.' });
              return true;
            }

            const result = performReplacement(replacementText);
            sendResponse(result);
            return true;
          }

          default:
            return false;
        }
      } catch (err) {
        console.error('[Mesa de Ayuda] Error al procesar mensaje en Content Script:', err);
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : 'Error interno en content script',
        });
        return true;
      }
    }
  );
}
