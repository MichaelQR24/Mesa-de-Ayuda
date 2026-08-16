import { NavTab } from '../types';

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
  }

  onTabChange(listener: (tab: NavTab) => void): void {
    this.tabChangeListeners.push(listener);
  }

  getCurrentTab(): NavTab {
    return this.currentTab;
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
