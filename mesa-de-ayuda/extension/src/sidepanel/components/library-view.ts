import { INITIAL_LIBRARY_ITEMS, LIBRARY_CATEGORIES } from '../services/library-data';
import { storageService } from '../storage/storage-service';
import { navigationManager } from './navigation';
import { assistantView } from './assistant-view';
import { showToast } from './toast';
import { LibraryItem } from '../types';
import { fetchRemoteCategories, fetchRemoteLibrary, updateRemoteLibraryItem } from '../services/api-client';

export class LibraryView {
  private searchInput!: HTMLInputElement;
  private categoryFiltersContainer!: HTMLElement;
  private itemsListContainer!: HTMLElement;

  private activeCategory = 'Todos';
  private searchQuery = '';
  private favoriteIds: string[] = [];
  private currentItems: LibraryItem[] = [];
  private categoriesList: string[] = [...LIBRARY_CATEGORIES];

  async init(): Promise<void> {
    this.searchInput = document.getElementById('library-search') as HTMLInputElement;
    this.categoryFiltersContainer = document.getElementById('library-categories') as HTMLElement;
    this.itemsListContainer = document.getElementById('library-items-list') as HTMLElement;

    this.setupEventListeners();
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.favoriteIds = await storageService.getFavoriteLibraryIds();

    try {
      const [catRes, libRes] = await Promise.all([
        fetchRemoteCategories(),
        fetchRemoteLibrary(),
      ]);

      if (catRes.success && catRes.data && catRes.data.length > 0) {
        this.categoriesList = ['Todos', ...catRes.data.map((c) => c.name)];
      }

      if (libRes.success && libRes.data && libRes.data.length > 0) {
        this.currentItems = libRes.data.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category?.name || 'General',
          content: item.content,
        }));
        this.favoriteIds = libRes.data.filter((i) => i.isFavorite).map((i) => i.id);
        this.renderCategoryChips();
        this.renderItems();
        return;
      }
    } catch {
      // Fallback
    }

    this.currentItems = [...INITIAL_LIBRARY_ITEMS];
    this.renderCategoryChips();
    this.renderItems();
  }

  private setupEventListeners(): void {
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value.toLowerCase().trim();
      this.renderItems();
    });
  }

  private renderCategoryChips(): void {
    this.categoryFiltersContainer.textContent = '';
    this.categoriesList.forEach((cat) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip-btn ${cat === this.activeCategory ? 'chip-active' : ''}`;
      chip.textContent = cat;
      chip.addEventListener('click', () => {
        this.activeCategory = cat;
        this.categoryFiltersContainer.querySelectorAll('.chip-btn').forEach((c) => {
          c.classList.toggle('chip-active', c.textContent === cat);
        });
        this.renderItems();
      });
      this.categoryFiltersContainer.appendChild(chip);
    });
  }

  private getFilteredItems(): LibraryItem[] {
    return this.currentItems.filter((item) => {
      const matchesCategory = this.activeCategory === 'Todos' || item.category === this.activeCategory;
      const matchesSearch =
        !this.searchQuery ||
        item.title.toLowerCase().includes(this.searchQuery) ||
        item.content.toLowerCase().includes(this.searchQuery) ||
        item.category.toLowerCase().includes(this.searchQuery);
      return matchesCategory && matchesSearch;
    });
  }

  private renderItems(): void {
    this.itemsListContainer.textContent = '';
    const filtered = this.getFilteredItems();

    if (filtered.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-state-message';
      emptyMsg.textContent = 'No se encontraron plantillas que coincidan con la búsqueda.';
      this.itemsListContainer.appendChild(emptyMsg);
      return;
    }

    filtered.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card-item template-card';

      // Header de la tarjeta
      const header = document.createElement('div');
      header.className = 'card-item-header';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'card-title-group';

      const categoryBadge = document.createElement('span');
      categoryBadge.className = 'badge-category';
      categoryBadge.textContent = item.category;

      const title = document.createElement('h4');
      title.className = 'card-title';
      title.textContent = item.title;

      titleGroup.appendChild(categoryBadge);
      titleGroup.appendChild(title);

      // Botón Favorito
      const isFav = this.favoriteIds.includes(item.id);
      const favBtn = document.createElement('button');
      favBtn.type = 'button';
      favBtn.className = `icon-btn fav-btn ${isFav ? 'fav-active' : ''}`;
      favBtn.title = isFav ? 'Quitar de favoritos' : 'Guardar en favoritos';
      favBtn.textContent = isFav ? '★' : '☆';
      favBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nextState = !isFav;

        try {
          await updateRemoteLibraryItem(item.id, { isFavorite: nextState });
        } catch {
          // Ignora error de red y usa local
        }

        const nowFav = await storageService.toggleFavoriteLibraryId(item.id);
        if (nextState || nowFav) {
          await storageService.saveItem({
            id: item.id,
            title: item.title,
            content: item.content,
            category: item.category,
            createdAt: Date.now(),
            isTemplate: true,
          });
          showToast('Plantilla marcada como favorita', 'success');
        } else {
          await storageService.removeSavedItem(item.id);
          showToast('Plantilla removida de favoritos', 'info');
        }
        await this.refresh();
      });

      header.appendChild(titleGroup);
      header.appendChild(favBtn);

      // Contenido
      const body = document.createElement('p');
      body.className = 'card-body-text';
      body.textContent = item.content;

      // Footer con botones de acción
      const footer = document.createElement('div');
      footer.className = 'card-actions-footer';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-secondary btn-sm';
      copyBtn.textContent = 'Copiar';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.content);
          showToast('Plantilla copiada al portapapeles', 'success');
        } catch {
          showToast('No se pudo copiar el texto', 'error');
        }
      });

      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'btn-primary-action btn-sm';
      useBtn.textContent = 'Usar en Asistente';
      useBtn.addEventListener('click', () => {
        assistantView.setText(item.content);
        navigationManager.switchTab('asistente');
        showToast('Plantilla cargada en el Asistente', 'info');
      });

      footer.appendChild(copyBtn);
      footer.appendChild(useBtn);

      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(footer);

      this.itemsListContainer.appendChild(card);
    });
  }
}

export const libraryView = new LibraryView();
