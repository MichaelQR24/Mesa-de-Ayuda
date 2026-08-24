/**
 * Side Panel Entry Point - Mesa de Ayuda
 * Inicializa autenticación, navegación, vistas y almacenamiento seguro
 */

import { authService } from './services/auth-service';
import { navigationManager } from './components/navigation';
import { loginView } from './components/login-view';
import { changePasswordView } from './components/change-password-view';
import { assistantView } from './components/assistant-view';
import { quickTextsView } from './components/quick-texts-view';
import { historyView } from './components/history-view';
import { savedView } from './components/saved-view';
import { settingsView } from './components/settings-view';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Inicializar servicio de autenticación
    await authService.init();

    // 2. Inicializar gestores de navegación y formularios de auth
    navigationManager.init();
    loginView.init();
    changePasswordView.init();

    // 3. Inicializar componentes de vistas
    await settingsView.init();
    await assistantView.init();
    quickTextsView.init();
    await historyView.init();
    await savedView.init();

    // 4. Suscribirse a cambios de pestaña para refrescar datos dinámicamente
    navigationManager.onTabChange((tab) => {
      switch (tab) {
        case 'asistente':
          assistantView.applyStoredSettings().catch(console.error);
          break;
        case 'textos-rapidos':
          quickTextsView.refresh().catch(console.error);
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

    // 5. Determinar vista inicial según el estado de sesión
    const user = authService.getUser();
    if (!authService.isAuthenticated() || !user) {
      navigationManager.showLogin();
    } else if (user.mustChangePassword) {
      navigationManager.showChangePassword();
    } else {
      navigationManager.showAuthenticatedApp();
    }

    console.log('[Mesa de Ayuda] Frontend del Side Panel inicializado correctamente.');
  } catch (error) {
    console.error('[Mesa de Ayuda] Error inicializando el Side Panel:', error);
  }
});
