/**
 * Side Panel Entry Point - Mesa de Ayuda
 * Inicializa navegación, vistas y almacenamiento local
 */

import { navigationManager } from './components/navigation';
import { assistantView } from './components/assistant-view';
import { libraryView } from './components/library-view';
import { historyView } from './components/history-view';
import { savedView } from './components/saved-view';
import { settingsView } from './components/settings-view';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Inicializar navegación entre pestañas
    navigationManager.init();

    // 2. Inicializar componentes de vistas
    await settingsView.init();
    await assistantView.init();
    await libraryView.init();
    await historyView.init();
    await savedView.init();

    // 3. Suscribirse a cambios de pestaña para refrescar datos dinámicamente
    navigationManager.onTabChange((tab) => {
      switch (tab) {
        case 'asistente':
          assistantView.applyStoredSettings().catch(console.error);
          break;
        case 'biblioteca':
          libraryView.refresh().catch(console.error);
          break;
        case 'historial':
          historyView.refresh().catch(console.error);
          break;
        case 'guardados':
          savedView.refresh().catch(console.error);
          break;
        case 'configuracion':
          settingsView.loadSettings().catch(console.error);
          break;
      }
    });

    console.log('[Mesa de Ayuda] Frontend del Side Panel inicializado correctamente (Fase 2).');
  } catch (error) {
    console.error('[Mesa de Ayuda] Error inicializando el Side Panel:', error);
  }
});
