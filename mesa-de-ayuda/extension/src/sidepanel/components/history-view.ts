import { storageService } from '../storage/storage-service';
import { navigationManager } from './navigation';
import { assistantView } from './assistant-view';
import { showToast } from './toast';
import { HistoryItem } from '../types';

export class HistoryView {
  private itemsListContainer!: HTMLElement;
  private clearHistoryBtn!: HTMLButtonElement;

  async init(): Promise<void> {
    this.itemsListContainer = document.getElementById('history-items-list') as HTMLElement;
    this.clearHistoryBtn = document.getElementById('btn-clear-history') as HTMLButtonElement;

    this.clearHistoryBtn.addEventListener('click', async () => {
      const items = await storageService.getHistory();
      if (items.length === 0) {
        showToast('El historial ya está vacío', 'info');
        return;
      }

      if (window.confirm('¿Deseas vaciar todo el historial de consultas?')) {
        await storageService.clearHistory();
        await this.refresh();
        showToast('Historial vaciado correctamente', 'info');
      }
    });

    await this.refresh();
  }

  async refresh(): Promise<void> {
    const items = await storageService.getHistory();
    this.renderItems(items);
  }

  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} d`;
  }

  private renderItems(items: HistoryItem[]): void {
    this.itemsListContainer.textContent = '';

    if (items.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-state-message';
      emptyMsg.textContent = 'Aún no hay acciones registradas en el historial. Las consultas realizadas en el Asistente aparecerán aquí.';
      this.itemsListContainer.appendChild(emptyMsg);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card-item history-card';

      // Header
      const header = document.createElement('div');
      header.className = 'card-item-header';

      const actionBadge = document.createElement('span');
      actionBadge.className = 'badge-action';
      actionBadge.textContent = item.action.toUpperCase();

      const timeLabel = document.createElement('span');
      timeLabel.className = 'card-time-label';
      timeLabel.textContent = this.formatTimeAgo(item.timestamp);

      header.appendChild(actionBadge);
      header.appendChild(timeLabel);

      // Bloque Original
      const origBlock = document.createElement('div');
      origBlock.className = 'history-text-block';
      const origTitle = document.createElement('span');
      origTitle.className = 'history-sub-label';
      origTitle.textContent = 'Original:';
      const origText = document.createElement('p');
      origText.className = 'history-text-preview';
      origText.textContent = item.originalText.length > 120 ? `${item.originalText.slice(0, 120)}...` : item.originalText;
      origBlock.appendChild(origTitle);
      origBlock.appendChild(origText);

      // Bloque Resultado
      const resBlock = document.createElement('div');
      resBlock.className = 'history-text-block';
      const resTitle = document.createElement('span');
      resTitle.className = 'history-sub-label';
      resTitle.textContent = 'Resultado:';
      const resText = document.createElement('p');
      resText.className = 'history-text-preview result-highlight';
      resText.textContent = item.resultText.length > 150 ? `${item.resultText.slice(0, 150)}...` : item.resultText;
      resBlock.appendChild(resTitle);
      resBlock.appendChild(resText);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'card-actions-footer';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-secondary btn-sm';
      copyBtn.textContent = 'Copiar resultado';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.resultText);
          showToast('Resultado copiado al portapapeles', 'success');
        } catch {
          showToast('No se pudo copiar', 'error');
        }
      });

      const reUseBtn = document.createElement('button');
      reUseBtn.type = 'button';
      reUseBtn.className = 'btn-primary-action btn-sm';
      reUseBtn.textContent = 'Cargar en Asistente';
      reUseBtn.addEventListener('click', () => {
        assistantView.setText(item.originalText);
        navigationManager.switchTab('asistente');
        showToast('Texto cargado en el Asistente', 'info');
      });

      footer.appendChild(copyBtn);
      footer.appendChild(reUseBtn);

      card.appendChild(header);
      card.appendChild(origBlock);
      card.appendChild(resBlock);
      card.appendChild(footer);

      this.itemsListContainer.appendChild(card);
    });
  }
}

export const historyView = new HistoryView();
