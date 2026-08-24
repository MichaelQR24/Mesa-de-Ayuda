import { NavTab } from '../types';
import { authService } from '../services/auth-service';
import { showToast } from './toast';

export class NavigationManager {
  private currentTab: NavTab = 'asistente';
  private tabChangeListeners: Array<(tab: NavTab) => void> = [];
  private navBar: HTMLElement | null = null;
  private btnPrev: HTMLButtonElement | null = null;
  private btnNext: HTMLButtonElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  init(): void {
    this.navBar = document.getElementById('main-nav-bar');
    this.btnPrev = document.getElementById('btn-nav-prev') as HTMLButtonElement | null;
    this.btnNext = document.getElementById('btn-nav-next') as HTMLButtonElement | null;

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

    const adminBtn = document.getElementById('btn-open-admin');
    adminBtn?.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/admin/index.html') });
      } else {
        window.open('src/admin/index.html', '_blank');
      }
    });

    this.setupHorizontalScrolling();
  }

  private setupHorizontalScrolling(): void {
    if (!this.navBar) return;

    // 1. Flechas de desplazamiento
    this.btnPrev?.addEventListener('click', () => {
      this.navBar?.scrollBy({ left: -140, behavior: 'smooth' });
    });

    this.btnNext?.addEventListener('click', () => {
      this.navBar?.scrollBy({ left: 140, behavior: 'smooth' });
    });

    // 2. Rueda del mouse sobre la barra (wheel vertical a desplazamiento horizontal)
    this.navBar.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        // Solo interceptar si el desplazamiento es predominantemente vertical y hay contenido desplazable
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          const maxScroll = this.navBar!.scrollWidth - this.navBar!.clientWidth;
          if (maxScroll > 0) {
            e.preventDefault();
            this.navBar!.scrollLeft += e.deltaY;
            this.updateArrowsState();
          }
        }
      },
      { passive: false }
    );

    // 3. Listener de scroll nativo para actualizar flechas
    this.navBar.addEventListener('scroll', () => {
      this.updateArrowsState();
    });

    // 4. ResizeObserver para responder a cambios de ancho del Side Panel
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateArrowsState();
      });
      this.resizeObserver.observe(this.navBar);
    }

    this.updateArrowsState();
  }

  private updateArrowsState(): void {
    if (!this.navBar) return;

    const scrollLeft = this.navBar.scrollLeft;
    const scrollWidth = this.navBar.scrollWidth;
    const clientWidth = this.navBar.clientWidth;
    const maxScroll = scrollWidth - clientWidth;

    if (maxScroll <= 2) {
      // Todo el contenido cabe, ocultar ambas flechas
      this.btnPrev?.classList.add('hidden');
      this.btnNext?.classList.add('hidden');
      return;
    }

    // Mostrar u ocultar flecha izquierda
    if (scrollLeft <= 2) {
      this.btnPrev?.classList.add('hidden');
    } else {
      this.btnPrev?.classList.remove('hidden');
    }

    // Mostrar u ocultar flecha derecha
    if (scrollLeft >= maxScroll - 2) {
      this.btnNext?.classList.add('hidden');
    } else {
      this.btnNext?.classList.remove('hidden');
    }
  }

  onTabChange(listener: (tab: NavTab) => void): void {
    this.tabChangeListeners.push(listener);
  }

  getCurrentTab(): NavTab {
    return this.currentTab;
  }

  showLogin(): void {
    const navContainer = document.getElementById('nav-container-wrapper');
    const userBadge = document.getElementById('user-profile-badge');

    navContainer?.classList.add('hidden');
    userBadge?.classList.add('hidden');

    const views = document.querySelectorAll<HTMLElement>('.view-panel');
    views.forEach((view) => {
      view.classList.toggle('view-active', view.id === 'view-login');
    });
  }

  showChangePassword(): void {
    const navContainer = document.getElementById('nav-container-wrapper');
    const userBadge = document.getElementById('user-profile-badge');

    navContainer?.classList.add('hidden');
    this.updateUserHeader();
    userBadge?.classList.remove('hidden');

    const views = document.querySelectorAll<HTMLElement>('.view-panel');
    views.forEach((view) => {
      view.classList.toggle('view-active', view.id === 'view-change-password');
    });
  }

  showAuthenticatedApp(): void {
    const navContainer = document.getElementById('nav-container-wrapper');
    const userBadge = document.getElementById('user-profile-badge');

    navContainer?.classList.remove('hidden');
    this.updateUserHeader();
    userBadge?.classList.remove('hidden');

    this.switchTab('asistente');
    this.updateArrowsState();
  }

  updateUserHeader(): void {
    const user = authService.getUser();
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-role-badge');
    const adminBtn = document.getElementById('btn-open-admin');

    if (user && nameEl && roleEl) {
      nameEl.textContent = user.displayName;
      nameEl.title = `${user.displayName} (${user.email})`;
      roleEl.textContent = user.role;

      if (adminBtn) {
        adminBtn.classList.toggle('hidden', user.role !== 'ADMIN');
      }
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
      if (isCurrent) {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });

    // Actualizar vistas en el DOM
    const views = document.querySelectorAll<HTMLElement>('.view-panel');
    views.forEach((view) => {
      const isCurrent = view.id === `view-${tab}`;
      view.classList.toggle('view-active', isCurrent);
    });

    this.updateArrowsState();

    // Notificar a listeners
    this.tabChangeListeners.forEach((listener) => listener(tab));
  }
}

export const navigationManager = new NavigationManager();
