import { NavTab } from '../types';
import { authService } from '../services/auth-service';
import { showToast } from './toast';

export class NavigationManager {
  private currentTab: NavTab = 'asistente';
  private tabChangeListeners: Array<(tab: NavTab) => void> = [];

  init(): void {
    const navButtons = document.querySelectorAll<HTMLButtonElement>('.nav-tab-btn');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as NavTab;
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    const logoutBtn = document.getElementById('btn-logout');
    logoutBtn?.addEventListener('click', async () => {
      await authService.logout();
      showToast('Sesión cerrada correctamente', 'info');
      this.showLogin();
    });
  }

  onTabChange(listener: (tab: NavTab) => void): void {
    this.tabChangeListeners.push(listener);
  }

  getCurrentTab(): NavTab {
    return this.currentTab;
  }

  showLogin(): void {
    const navBar = document.getElementById('main-nav-bar');
    const userBadge = document.getElementById('user-profile-badge');

    navBar?.classList.add('hidden');
    userBadge?.classList.add('hidden');

    const views = document.querySelectorAll<HTMLElement>('.view-panel');
    views.forEach((view) => {
      view.classList.toggle('view-active', view.id === 'view-login');
    });
  }

  showChangePassword(): void {
    const navBar = document.getElementById('main-nav-bar');
    const userBadge = document.getElementById('user-profile-badge');

    navBar?.classList.add('hidden');
    this.updateUserHeader();
    userBadge?.classList.remove('hidden');

    const views = document.querySelectorAll<HTMLElement>('.view-panel');
    views.forEach((view) => {
      view.classList.toggle('view-active', view.id === 'view-change-password');
    });
  }

  showAuthenticatedApp(): void {
    const navBar = document.getElementById('main-nav-bar');
    const userBadge = document.getElementById('user-profile-badge');

    navBar?.classList.remove('hidden');
    this.updateUserHeader();
    userBadge?.classList.remove('hidden');

    this.switchTab('asistente');
  }

  updateUserHeader(): void {
    const user = authService.getUser();
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-role-badge');

    if (user && nameEl && roleEl) {
      nameEl.textContent = user.displayName;
      nameEl.title = `${user.displayName} (${user.email})`;
      roleEl.textContent = user.role;
    }
  }

  switchTab(tab: NavTab): void {
    this.currentTab = tab;

    // Actualizar botones de navegación
    const navButtons = document.querySelectorAll<HTMLButtonElement>('.nav-tab-btn');
    navButtons.forEach((btn) => {
      const isCurrent = btn.dataset.tab === tab;
      btn.classList.toggle('active', isCurrent);
      btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });

    // Actualizar vistas en el DOM
    const views = document.querySelectorAll<HTMLElement>('.view-panel');
    views.forEach((view) => {
      const isCurrent = view.id === `view-${tab}`;
      view.classList.toggle('view-active', isCurrent);
    });

    // Notificar a listeners
    this.tabChangeListeners.forEach((listener) => listener(tab));
  }
}

export const navigationManager = new NavigationManager();
