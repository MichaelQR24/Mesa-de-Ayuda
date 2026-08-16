import { storageService } from '../storage/storage-service';
import { navigationManager } from './navigation';
import { assistantView } from './assistant-view';
import { showToast } from './toast';
import { SavedItem } from '../types';

export class SavedView {
  private itemsListContainer!: HTMLElement;

  async init(): Promise<void> {
    this.itemsListContainer = document.getElementById('saved-items-list') as HTMLElement;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const items = await storageService.getSavedItems();
    this.renderItems(items);
  }

  private renderItems(items: SavedItem[]): void {
    this.itemsListContainer.textContent = '';

    if (items.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-state-message';
      emptyMsg.textContent = 'No tienes textos guardados aún. Guarda respuestas del Asistente o marca plantillas como favoritas desde la Biblioteca.';
      this.itemsListContainer.appendChild(emptyMsg);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card-item saved-card';

      // Header
      const header = document.createElement('div');
      header.className = 'card-item-header';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'card-title-group';

      const categoryBadge = document.createElement('span');
      categoryBadge.className = 'badge-category';
      categoryBadge.textContent = item.category || 'Guardado';

      const title = document.createElement('h4');
      title.className = 'card-title';
      title.textContent = item.title;

      titleGroup.appendChild(categoryBadge);
      titleGroup.appendChild(title);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'icon-btn remove-btn';
      removeBtn.title = 'Quitar de guardados';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', async () => {
        await storageService.removeSavedItem(item.id);
        // Si proviene de la biblioteca, también desmarcamos el ID
        if (item.id.startsWith('lib-fav-')) {
          const rawId = item.id.replace('lib-fav-', '');
          await storageService.toggleFavoriteLibraryId(rawId);
        }
        await this.refresh();
        showToast('Elemento eliminado de guardados', 'info');
      });

      header.appendChild(titleGroup);
      header.appendChild(removeBtn);

      // Contenido
      const body = document.createElement('p');
      body.className = 'card-body-text';
      body.textContent = item.content;

      // Footer
      const footer = document.createElement('div');
      footer.className = 'card-actions-footer';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-secondary btn-sm';
      copyBtn.textContent = 'Copiar';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.content);
          showToast('Texto copiado al portapapeles', 'success');
        } catch {
          showToast('No se pudo copiar el texto', 'error');
        }
      });

      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.className = 'btn-primary-action btn-sm';
      useBtn.textContent = 'Usar como plantilla';
      useBtn.addEventListener('click', () => {
        assistantView.setText(item.content);
        navigationManager.switchTab('asistente');
        showToast('Texto cargado en el Asistente', 'info');
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

export const savedView = new SavedView();
