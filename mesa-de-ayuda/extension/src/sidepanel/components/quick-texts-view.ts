import {
  fetchRemoteQuickTexts,
  createRemoteQuickText,
  updateRemoteQuickText,
  deleteRemoteQuickText,
  RemoteQuickText,
} from '../services/api-client';
import { showToast } from './toast';

export class QuickTextsView {
  private container!: HTMLElement;
  private emptyState!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private btnNewText!: HTMLButtonElement;
  private btnCreateFirst!: HTMLButtonElement;
  private filterChipsContainer!: HTMLElement;

  // Modal Crear/Editar
  private modal!: HTMLElement;
  private form!: HTMLFormElement;
  private modalTitle!: HTMLElement;
  private inputTitle!: HTMLInputElement;
  private inputHeader!: HTMLTextAreaElement;
  private inputBody!: HTMLTextAreaElement;
  private inputSolution!: HTMLTextAreaElement;
  private inputIsShared!: HTMLInputElement;
  private btnCancelModal!: HTMLButtonElement;
  private btnCloseModal!: HTMLButtonElement;
  private btnSubmitModal!: HTMLButtonElement;

  // Modal Confirmar Eliminación
  private modalDelete!: HTMLElement;
  private deleteItemTitle!: HTMLElement;
  private btnCancelDelete!: HTMLButtonElement;
  private btnCloseDeleteModal!: HTMLButtonElement;
  private btnConfirmDelete!: HTMLButtonElement;

  private items: RemoteQuickText[] = [];
  private currentFilter: 'all' | 'mine' | 'shared' = 'all';
  private editingId: string | null = null;
  private deletingId: string | null = null;
  private isSaving = false;

  init(): void {
    this.container = document.getElementById('quick-texts-list') as HTMLElement;
    this.emptyState = document.getElementById('quick-texts-empty') as HTMLElement;
    this.searchInput = document.getElementById('quick-texts-search') as HTMLInputElement;
    this.btnNewText = document.getElementById('btn-new-quick-text') as HTMLButtonElement;
    this.btnCreateFirst = document.getElementById('btn-create-first-quick-text') as HTMLButtonElement;
    this.filterChipsContainer = document.getElementById('quick-texts-filters') as HTMLElement;

    // Modal Crear/Editar
    this.modal = document.getElementById('modal-quick-text') as HTMLElement;
    this.form = document.getElementById('form-quick-text') as HTMLFormElement;
    this.modalTitle = document.getElementById('modal-quick-text-title') as HTMLElement;
    this.inputTitle = document.getElementById('quick-text-title') as HTMLInputElement;
    this.inputHeader = document.getElementById('quick-text-header') as HTMLTextAreaElement;
    this.inputBody = document.getElementById('quick-text-body') as HTMLTextAreaElement;
    this.inputSolution = document.getElementById('quick-text-solution') as HTMLTextAreaElement;
    this.inputIsShared = document.getElementById('quick-text-is-shared') as HTMLInputElement;
    this.btnCancelModal = document.getElementById('btn-cancel-quick-text') as HTMLButtonElement;
    this.btnCloseModal = document.getElementById('btn-close-quick-text-modal') as HTMLButtonElement;
    this.btnSubmitModal = document.getElementById('btn-submit-quick-text') as HTMLButtonElement;

    // Modal Confirmar Eliminación
    this.modalDelete = document.getElementById('modal-delete-quick-text') as HTMLElement;
    this.deleteItemTitle = document.getElementById('delete-quick-text-name') as HTMLElement;
    this.btnCancelDelete = document.getElementById('btn-cancel-delete-quick-text') as HTMLButtonElement;
    this.btnCloseDeleteModal = document.getElementById('btn-close-delete-quick-text-modal') as HTMLButtonElement;
    this.btnConfirmDelete = document.getElementById('btn-confirm-delete-quick-text') as HTMLButtonElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Buscador reactivo
    this.searchInput?.addEventListener('input', () => {
      this.renderFilteredList();
    });

    // Chips de filtro: Todos / Mis textos / Compartidos
    const filterButtons = this.filterChipsContainer?.querySelectorAll<HTMLButtonElement>('.chip-btn');
    filterButtons?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter as 'all' | 'mine' | 'shared';
        if (filter) {
          this.currentFilter = filter;
          filterButtons.forEach((b) => b.classList.toggle('chip-active', b === btn));
          this.renderFilteredList();
        }
      });
    });

    // Abrir modal de nuevo texto
    this.btnNewText?.addEventListener('click', () => this.openCreateModal());
    this.btnCreateFirst?.addEventListener('click', () => this.openCreateModal());

    // Cancelar/cerrar modal de formulario
    this.btnCancelModal?.addEventListener('click', () => this.closeModal());
    this.btnCloseModal?.addEventListener('click', () => this.closeModal());

    // Submit del formulario
    this.form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    });

    // Cancelar/cerrar modal de eliminación
    this.btnCancelDelete?.addEventListener('click', () => this.closeDeleteModal());
    this.btnCloseDeleteModal?.addEventListener('click', () => this.closeDeleteModal());

    // Confirmar eliminación
    this.btnConfirmDelete?.addEventListener('click', async () => {
      await this.handleDeleteConfirm();
    });
  }

  async refresh(): Promise<void> {
    try {
      const response = await fetchRemoteQuickTexts();
      if (response && response.success && Array.isArray(response.data)) {
        this.items = response.data;
      } else {
        this.items = [];
      }
    } catch {
      this.items = [];
    }

    this.renderFilteredList();
  }

  private renderFilteredList(): void {
    if (!this.container) return;

    const query = (this.searchInput?.value || '').trim().toLowerCase();

    const filtered = this.items.filter((item) => {
      // 1. Filtro por pertenencia / estado compartido
      if (this.currentFilter === 'mine' && !item.isOwner) return false;
      if (this.currentFilter === 'shared' && !item.isShared) return false;

      // 2. Filtro por buscador de texto
      if (!query) return true;
      const solutionStr = (item.solution || '').toLowerCase();
      const ownerStr = (item.ownerDisplayName || '').toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.header.toLowerCase().includes(query) ||
        item.body.toLowerCase().includes(query) ||
        solutionStr.includes(query) ||
        ownerStr.includes(query)
      );
    });

    this.container.innerHTML = '';

    if (filtered.length === 0) {
      if (this.items.length === 0) {
        this.emptyState?.classList.remove('hidden');
      } else {
        this.emptyState?.classList.add('hidden');
        const noResults = document.createElement('div');
        noResults.className = 'no-results-message';
        noResults.textContent = 'No se encontraron textos rápidos con los filtros seleccionados.';
        this.container.appendChild(noResults);
      }
      return;
    }

    this.emptyState?.classList.add('hidden');

    filtered.forEach((item) => {
      const card = this.createCardElement(item);
      this.container.appendChild(card);
    });
  }

  private createCardElement(item: RemoteQuickText): HTMLElement {
    const card = document.createElement('div');
    card.className = `quick-text-card ${item.isShared ? 'card-shared' : 'card-private'}`;
    card.dataset.id = item.id;

    // Header de la tarjeta (Título, Badge y Acciones)
    const cardHeader = document.createElement('div');
    cardHeader.className = 'quick-text-card-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'quick-text-header-left';

    const titleEl = document.createElement('h3');
    titleEl.className = 'quick-text-card-title';
    titleEl.textContent = item.title;

    // Badge de Visibilidad (Privado / Compartido)
    const visibilityBadge = document.createElement('span');
    if (item.isShared) {
      visibilityBadge.className = 'badge-shared-status badge-shared';
      if (!item.isOwner && item.ownerDisplayName) {
        visibilityBadge.textContent = `👥 Compartido por ${item.ownerDisplayName}`;
      } else {
        visibilityBadge.textContent = '👥 Compartido';
      }
    } else {
      visibilityBadge.className = 'badge-shared-status badge-private';
      visibilityBadge.textContent = '🔒 Privado';
    }

    headerLeft.appendChild(titleEl);
    headerLeft.appendChild(visibilityBadge);

    const actionsHeader = document.createElement('div');
    actionsHeader.className = 'quick-text-header-actions';

    // Solo el propietario (o ADMIN) puede editar, eliminar y cambiar el estado compartido
    if (item.isOwner) {
      // Botón rápido toggle compartir
      const btnToggleShare = document.createElement('button');
      btnToggleShare.type = 'button';
      btnToggleShare.className = 'btn-icon-action';
      btnToggleShare.title = item.isShared ? 'Dejar de compartir con el equipo' : 'Compartir con el equipo';
      btnToggleShare.textContent = item.isShared ? '👥' : '🔒';
      btnToggleShare.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.toggleShareStatus(item);
      });
      actionsHeader.appendChild(btnToggleShare);

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn-icon-action';
      btnEdit.title = 'Editar texto rápido';
      btnEdit.textContent = '✏️';
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditModal(item);
      });
      actionsHeader.appendChild(btnEdit);

      const btnDelete = document.createElement('button');
      btnDelete.type = 'button';
      btnDelete.className = 'btn-icon-action btn-icon-danger';
      btnDelete.title = 'Eliminar texto rápido';
      btnDelete.textContent = '🗑️';
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDeleteModal(item);
      });
      actionsHeader.appendChild(btnDelete);
    }

    cardHeader.appendChild(headerLeft);
    cardHeader.appendChild(actionsHeader);

    // Bloque 1: Cabecera
    const headerBlock = document.createElement('div');
    headerBlock.className = 'quick-text-block';

    const headerLabelRow = document.createElement('div');
    headerLabelRow.className = 'quick-text-label-row';

    const headerLabel = document.createElement('span');
    headerLabel.className = 'quick-text-block-label';
    headerLabel.textContent = 'Cabecera:';

    const btnCopyHeader = document.createElement('button');
    btnCopyHeader.type = 'button';
    btnCopyHeader.className = 'btn-copy-chip';
    btnCopyHeader.title = 'Copiar solo la cabecera';
    btnCopyHeader.textContent = '📋 Copiar Cabecera';
    btnCopyHeader.addEventListener('click', async () => {
      await this.copyText(item.header, 'Cabecera copiada');
    });

    headerLabelRow.appendChild(headerLabel);
    headerLabelRow.appendChild(btnCopyHeader);

    const headerContent = document.createElement('div');
    headerContent.className = 'quick-text-content-box';
    headerContent.textContent = item.header;

    headerBlock.appendChild(headerLabelRow);
    headerBlock.appendChild(headerContent);

    // Bloque 2: Cuerpo
    const bodyBlock = document.createElement('div');
    bodyBlock.className = 'quick-text-block';

    const bodyLabelRow = document.createElement('div');
    bodyLabelRow.className = 'quick-text-label-row';

    const bodyLabel = document.createElement('span');
    bodyLabel.className = 'quick-text-block-label';
    bodyLabel.textContent = 'Cuerpo:';

    const btnCopyBody = document.createElement('button');
    btnCopyBody.type = 'button';
    btnCopyBody.className = 'btn-copy-chip';
    btnCopyBody.title = 'Copiar solo el cuerpo';
    btnCopyBody.textContent = '📋 Copiar Cuerpo';
    btnCopyBody.addEventListener('click', async () => {
      await this.copyText(item.body, 'Cuerpo copiado');
    });

    bodyLabelRow.appendChild(bodyLabel);
    bodyLabelRow.appendChild(btnCopyBody);

    const bodyContent = document.createElement('div');
    bodyContent.className = 'quick-text-content-box';
    bodyContent.textContent = item.body;

    bodyBlock.appendChild(bodyLabelRow);
    bodyBlock.appendChild(bodyContent);

    // Bloque 3: Solución
    const solutionBlock = document.createElement('div');
    solutionBlock.className = 'quick-text-block';

    const solutionLabelRow = document.createElement('div');
    solutionLabelRow.className = 'quick-text-label-row';

    const solutionLabel = document.createElement('span');
    solutionLabel.className = 'quick-text-block-label';
    solutionLabel.textContent = 'Solución:';

    const hasSolution = Boolean(item.solution && item.solution.trim().length > 0);
    const btnCopySolution = document.createElement('button');
    btnCopySolution.type = 'button';
    btnCopySolution.className = 'btn-copy-chip';
    btnCopySolution.title = 'Copiar solo la solución';
    btnCopySolution.textContent = '📋 Copiar Solución';
    btnCopySolution.addEventListener('click', async () => {
      if (hasSolution) {
        await this.copyText(item.solution!.trim(), 'Solución copiada');
      } else {
        showToast('Este texto no tiene solución registrada.', 'info');
      }
    });

    solutionLabelRow.appendChild(solutionLabel);
    solutionLabelRow.appendChild(btnCopySolution);

    const solutionContent = document.createElement('div');
    solutionContent.className = 'quick-text-content-box';
    if (hasSolution) {
      solutionContent.textContent = item.solution!.trim();
    } else {
      solutionContent.textContent = 'Sin solución registrada';
      solutionContent.classList.add('quick-text-empty-val');
    }

    solutionBlock.appendChild(solutionLabelRow);
    solutionBlock.appendChild(solutionContent);

    // Footer de la tarjeta: Botón Copiar Todo (Cabecera + Cuerpo + Solución)
    const cardFooter = document.createElement('div');
    cardFooter.className = 'quick-text-card-footer';

    const btnCopyAll = document.createElement('button');
    btnCopyAll.type = 'button';
    btnCopyAll.className = 'btn-primary-action btn-sm btn-full';
    btnCopyAll.textContent = '📋 Copiar Todo (Cabecera + Cuerpo + Solución)';
    btnCopyAll.addEventListener('click', async () => {
      let fullText = `${item.header}\n\n${item.body}`;
      if (hasSolution) {
        fullText += `\n\nSolución:\n${item.solution!.trim()}`;
      }
      await this.copyText(fullText, 'Texto completo copiado');
    });

    cardFooter.appendChild(btnCopyAll);

    // Ensamblar tarjeta con sus 3 bloques
    card.appendChild(cardHeader);
    card.appendChild(headerBlock);
    card.appendChild(bodyBlock);
    card.appendChild(solutionBlock);
    card.appendChild(cardFooter);

    return card;
  }

  private async toggleShareStatus(item: RemoteQuickText): Promise<void> {
    const newStatus = !item.isShared;
    try {
      const res = await updateRemoteQuickText(item.id, { isShared: newStatus });
      if (res.success) {
        showToast(
          newStatus ? 'Texto compartido con el equipo.' : 'El texto ahora es privado.',
          'success'
        );
        await this.refresh();
      } else {
        showToast(res.error?.message || 'Error al cambiar visibilidad.', 'error');
      }
    } catch {
      showToast('Error de conexión al actualizar visibilidad.', 'error');
    }
  }

  private async copyText(text: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, 'success');
    } catch {
      const tempArea = document.createElement('textarea');
      tempArea.value = text;
      document.body.appendChild(tempArea);
      tempArea.select();
      document.execCommand('copy');
      document.body.removeChild(tempArea);
      showToast(successMessage, 'success');
    }
  }

  private openCreateModal(): void {
    this.editingId = null;
    this.modalTitle.textContent = 'Nuevo Texto Rápido';
    this.btnSubmitModal.textContent = 'Guardar texto';
    this.inputTitle.value = '';
    this.inputHeader.value = '';
    this.inputBody.value = '';
    if (this.inputSolution) {
      this.inputSolution.value = '';
    }
    if (this.inputIsShared) {
      this.inputIsShared.checked = false;
    }
    this.modal.classList.remove('hidden');
    this.inputTitle.focus();
  }

  private openEditModal(item: RemoteQuickText): void {
    this.editingId = item.id;
    this.modalTitle.textContent = 'Editar Texto Rápido';
    this.btnSubmitModal.textContent = 'Actualizar cambios';
    this.inputTitle.value = item.title;
    this.inputHeader.value = item.header;
    this.inputBody.value = item.body;
    if (this.inputSolution) {
      this.inputSolution.value = item.solution || '';
    }
    if (this.inputIsShared) {
      this.inputIsShared.checked = Boolean(item.isShared);
    }
    this.modal.classList.remove('hidden');
    this.inputTitle.focus();
  }

  private closeModal(): void {
    this.modal.classList.add('hidden');
    this.editingId = null;
  }

  private async handleFormSubmit(): Promise<void> {
    if (this.isSaving) return;

    const title = this.inputTitle.value.trim();
    const header = this.inputHeader.value.trim();
    const body = this.inputBody.value.trim();
    const solution = this.inputSolution ? this.inputSolution.value.trim() : '';
    const isShared = this.inputIsShared ? this.inputIsShared.checked : false;

    if (!title || !header || !body) {
      showToast('Por favor completa los campos requeridos (Título, Cabecera y Cuerpo).', 'error');
      return;
    }

    this.isSaving = true;
    this.btnSubmitModal.disabled = true;
    this.btnSubmitModal.textContent = 'Guardando...';

    try {
      if (this.editingId) {
        // Actualizar
        const res = await updateRemoteQuickText(this.editingId, { title, header, body, solution, isShared });
        if (res.success && res.data) {
          showToast('Texto actualizado correctamente.', 'success');
          this.closeModal();
          await this.refresh();
        } else {
          showToast(res.error?.message || 'Error al actualizar el texto rápido.', 'error');
        }
      } else {
        // Crear
        const res = await createRemoteQuickText({ title, header, body, solution, isShared });
        if (res.success && res.data) {
          showToast(
            isShared ? 'Texto creado y compartido con el equipo.' : 'Texto rápido privado creado con éxito.',
            'success'
          );
          this.closeModal();
          await this.refresh();
        } else {
          showToast(res.error?.message || 'Error al crear el texto rápido.', 'error');
        }
      }
    } catch {
      showToast('Ocurrió un error al guardar. Verifica tu conexión.', 'error');
    } finally {
      this.isSaving = false;
      this.btnSubmitModal.disabled = false;
      this.btnSubmitModal.textContent = this.editingId ? 'Actualizar cambios' : 'Guardar texto';
    }
  }

  private openDeleteModal(item: RemoteQuickText): void {
    this.deletingId = item.id;
    this.deleteItemTitle.textContent = `"${item.title}"`;
    this.modalDelete.classList.remove('hidden');
  }

  private closeDeleteModal(): void {
    this.modalDelete.classList.add('hidden');
    this.deletingId = null;
  }

  private async handleDeleteConfirm(): Promise<void> {
    if (!this.deletingId) return;

    this.btnConfirmDelete.disabled = true;
    this.btnConfirmDelete.textContent = 'Eliminando...';

    try {
      const res = await deleteRemoteQuickText(this.deletingId);
      if (res.success) {
        showToast('Texto rápido eliminado correctamente.', 'success');
        this.closeDeleteModal();
        await this.refresh();
      } else {
        showToast(res.error?.message || 'Error al eliminar el texto rápido.', 'error');
      }
    } catch {
      showToast('Error de conexión al eliminar.', 'error');
    } finally {
      this.btnConfirmDelete.disabled = false;
      this.btnConfirmDelete.textContent = 'Eliminar';
    }
  }
}

export const quickTextsView = new QuickTextsView();
