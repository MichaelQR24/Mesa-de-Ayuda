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
import { guidesView } from './components/guides-view';
import { historyView } from './components/history-view';
import { savedView } from './components/saved-view';
import { settingsView } from './components/settings-view';
import { API_CONFIG } from './config/api';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. FAST PATH: Restaurar sesión local de inmediato sin esperar al backend
    await authService.init();

    // 2. Inicializar gestores de navegación y formularios de auth
    navigationManager.init();
    loginView.init();
    changePasswordView.init();

    // 3. Suscribir estado de conexión al indicador visual
    authService.onConnectionStateChange((state) => {
      navigationManager.setConnectionStatus(state);
    });

    // 4. Inicializar componentes de vistas
    await settingsView.init();
    await assistantView.init();
    quickTextsView.init();
    guidesView.init();
    await historyView.init();
    await savedView.init();

    // 5. Suscribirse a cambios de pestaña para refrescar datos dinámicamente
    navigationManager.onTabChange((tab) => {
      switch (tab) {
        case 'asistente':
          assistantView.applyStoredSettings().catch(console.error);
          break;
        case 'textos-rapidos':
          quickTextsView.refresh().catch(console.error);
          break;
        case 'guias':
          guidesView.refresh().catch(console.error);
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

    // 6. Determinar vista inicial según el estado de sesión local
    const user = authService.getUser();
    if (!authService.isAuthenticated() || !user) {
      navigationManager.showLogin();
    } else if (user.mustChangePassword) {
      navigationManager.showChangePassword();
    } else {
      navigationManager.showAuthenticatedApp();
    }

    // 7. WARM-UP INTELIGENTE NO BLOQUEANTE: Despertar Render en segundo plano
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`)
      .then((res) => {
        if (res.ok) {
          navigationManager.setConnectionStatus('connected');
        }
      })
      .catch(() => {
        // En caso de cold start transitorio, el refresh/retry automático se encargará
      });

    console.log('[Mesa de Ayuda] Frontend del Side Panel inicializado instantáneamente (Fast Path).');
  } catch (error) {
    console.error('[Mesa de Ayuda] Error inicializando el Side Panel:', error);
  }
});
