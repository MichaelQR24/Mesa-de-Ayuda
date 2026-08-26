import {
  fetchRemoteGuides,
  createRemoteGuide,
  updateRemoteGuide,
  deleteRemoteGuide,
  RemoteGuide,
} from '../services/api-client';
import { authService } from '../services/auth-service';
import { showToast, showDiagnosticError } from './toast';

export class GuidesView {
  private container!: HTMLElement;
  private emptyState!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private btnNewGuide!: HTMLButtonElement;
  private btnCreateFirst!: HTMLButtonElement;

  // Modal Crear/Editar Guía
  private modal!: HTMLElement;
  private form!: HTMLFormElement;
  private modalTitle!: HTMLElement;
  private inputTitle!: HTMLInputElement;
  private inputKeywords!: HTMLInputElement;
  private inputDesc!: HTMLTextAreaElement;
  private fileInput!: HTMLInputElement;
  private dropzonePrompt!: HTMLElement;
  private previewContainer!: HTMLElement;
  private imagePreview!: HTMLImageElement;
  private btnRemoveImage!: HTMLButtonElement;
  private btnCancelModal!: HTMLButtonElement;
  private btnCloseModal!: HTMLButtonElement;
  private btnSubmitModal!: HTMLButtonElement;

  // Modal Confirmar Eliminación
  private modalDelete!: HTMLElement;
  private deleteGuideName!: HTMLElement;
  private btnCancelDelete!: HTMLButtonElement;
  private btnCloseDeleteModal!: HTMLButtonElement;
  private btnConfirmDelete!: HTMLButtonElement;

  private items: RemoteGuide[] = [];
  private editingId: string | null = null;
  private deletingId: string | null = null;
  private currentBase64Image: string | null = null;
  private isSaving = false;

  init(): void {
    this.container = document.getElementById('guides-list') as HTMLElement;
    this.emptyState = document.getElementById('guides-empty') as HTMLElement;
    this.searchInput = document.getElementById('guides-search') as HTMLInputElement;
    this.btnNewGuide = document.getElementById('btn-new-guide') as HTMLButtonElement;
    this.btnCreateFirst = document.getElementById('btn-create-first-guide') as HTMLButtonElement;

    // Modal Crear/Editar
    this.modal = document.getElementById('modal-guide') as HTMLElement;
    this.form = document.getElementById('form-guide') as HTMLFormElement;
    this.modalTitle = document.getElementById('modal-guide-title') as HTMLElement;
    this.inputTitle = document.getElementById('guide-input-title') as HTMLInputElement;
    this.inputKeywords = document.getElementById('guide-input-keywords') as HTMLInputElement;
    this.inputDesc = document.getElementById('guide-input-desc') as HTMLTextAreaElement;
    this.fileInput = document.getElementById('guide-file-input') as HTMLInputElement;
    this.dropzonePrompt = document.getElementById('guide-dropzone-prompt') as HTMLElement;
    this.previewContainer = document.getElementById('guide-preview-container') as HTMLElement;
    this.imagePreview = document.getElementById('guide-image-preview') as HTMLImageElement;
    this.btnRemoveImage = document.getElementById('btn-remove-guide-image') as HTMLButtonElement;
    this.btnCancelModal = document.getElementById('btn-cancel-guide') as HTMLButtonElement;
    this.btnCloseModal = document.getElementById('btn-close-guide-modal') as HTMLButtonElement;
    this.btnSubmitModal = document.getElementById('btn-submit-guide') as HTMLButtonElement;

    // Modal Eliminar
    this.modalDelete = document.getElementById('modal-delete-guide') as HTMLElement;
    this.deleteGuideName = document.getElementById('delete-guide-name') as HTMLElement;
    this.btnCancelDelete = document.getElementById('btn-cancel-delete-guide') as HTMLButtonElement;
    this.btnCloseDeleteModal = document.getElementById('btn-close-delete-guide-modal') as HTMLButtonElement;
    this.btnConfirmDelete = document.getElementById('btn-confirm-delete-guide') as HTMLButtonElement;

    this.setupEventListeners();
    this.updateAdminControlsVisibility();
  }

  private setupEventListeners(): void {
    // Buscador reactivo
    this.searchInput?.addEventListener('input', () => {
      this.renderFilteredList();
    });

    // Botones de Nueva Guía
    this.btnNewGuide?.addEventListener('click', () => this.openCreateModal());
    this.btnCreateFirst?.addEventListener('click', () => this.openCreateModal());

    // Cierre de modal
    this.btnCancelModal?.addEventListener('click', () => this.closeModal());
    this.btnCloseModal?.addEventListener('click', () => this.closeModal());

    // Manejo de Dropzone y Carga de Archivo de Imagen
    const dropzone = document.getElementById('guide-dropzone');
    dropzone?.addEventListener('click', (e) => {
      if (e.target !== this.btnRemoveImage && !this.btnRemoveImage.contains(e.target as Node)) {
        this.fileInput.click();
      }
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dropzone-active');
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('dropzone-active');
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dropzone-active');
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        this.processSelectedImageFile(e.dataTransfer.files[0]);
      }
    });

    this.fileInput?.addEventListener('change', () => {
      if (this.fileInput.files && this.fileInput.files[0]) {
        this.processSelectedImageFile(this.fileInput.files[0]);
      }
    });

    this.btnRemoveImage?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearSelectedImage();
    });

    // Form Submit
    this.form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    });

    // Modal Eliminar
    this.btnCancelDelete?.addEventListener('click', () => this.closeDeleteModal());
    this.btnCloseDeleteModal?.addEventListener('click', () => this.closeDeleteModal());
    this.btnConfirmDelete?.addEventListener('click', async () => {
      await this.handleDeleteConfirm();
    });
  }

  updateAdminControlsVisibility(): void {
    const user = authService.getUser();
    const isAdmin = user?.role === 'ADMIN';

    this.btnNewGuide?.classList.toggle('hidden', !isAdmin);
    this.btnCreateFirst?.classList.toggle('hidden', !isAdmin);
  }

  async refresh(): Promise<void> {
    this.updateAdminControlsVisibility();
    try {
      const res = await fetchRemoteGuides();
      if (res.success && Array.isArray(res.data)) {
        this.items = res.data;
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

    const filtered = this.items.filter((guide) => {
      if (!query) return true;
      const titleMatch = guide.title.toLowerCase().includes(query);
      const descMatch = (guide.description || '').toLowerCase().includes(query);
      const keywordMatch = guide.keywords.some((k) => k.toLowerCase().includes(query));
      return titleMatch || descMatch || keywordMatch;
    });

    this.container.innerHTML = '';

    if (filtered.length === 0) {
      if (this.items.length === 0) {
        this.emptyState?.classList.remove('hidden');
      } else {
        this.emptyState?.classList.add('hidden');
        const noResults = document.createElement('div');
        noResults.className = 'no-results-message';
        noResults.textContent = 'No se encontraron procedimientos visuales que coincidan con la búsqueda.';
        this.container.appendChild(noResults);
      }
      return;
    }

    this.emptyState?.classList.add('hidden');

    const isAdmin = authService.getUser()?.role === 'ADMIN';

    filtered.forEach((guide) => {
      const card = this.createGuideCard(guide, isAdmin);
      this.container.appendChild(card);
    });
  }

  private createGuideCard(guide: RemoteGuide, isAdmin: boolean): HTMLElement {
    const card = document.createElement('div');
    card.className = 'guide-card';
    card.dataset.id = guide.id;

    // Miniatura
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'guide-thumb-wrapper';

    const thumbImg = document.createElement('img');
    thumbImg.className = 'guide-thumbnail';
    thumbImg.src = guide.imageUrl;
    thumbImg.alt = guide.title;
    thumbImg.loading = 'lazy';
    thumbWrapper.appendChild(thumbImg);

    // Botón superpuesto para ver grande al hacer clic en la miniatura
    const thumbOverlay = document.createElement('div');
    thumbOverlay.className = 'guide-thumb-overlay';
    thumbOverlay.innerHTML = '<span>🔍 Ver en pantalla grande</span>';
    thumbOverlay.addEventListener('click', () => {
      this.openGuideViewer(guide.id);
    });
    thumbWrapper.appendChild(thumbOverlay);

    // Cuerpo de la tarjeta
    const cardBody = document.createElement('div');
    cardBody.className = 'guide-card-body';

    const titleEl = document.createElement('h3');
    titleEl.className = 'guide-card-title';
    titleEl.textContent = guide.title;
    cardBody.appendChild(titleEl);

    // Tags / Keywords
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'guide-tags-row';
    guide.keywords.forEach((kw) => {
      const tagChip = document.createElement('span');
      tagChip.className = 'guide-tag-chip';
      tagChip.textContent = `#${kw}`;
      tagsContainer.appendChild(tagChip);
    });
    cardBody.appendChild(tagsContainer);

    if (guide.description && guide.description.trim()) {
      const descEl = document.createElement('p');
      descEl.className = 'guide-card-desc';
      descEl.textContent = guide.description.trim();
      cardBody.appendChild(descEl);
    }

    // Footer de la tarjeta con acciones
    const cardFooter = document.createElement('div');
    cardFooter.className = 'guide-card-footer';

    const btnViewBig = document.createElement('button');
    btnViewBig.type = 'button';
    btnViewBig.className = 'btn-primary-action btn-sm';
    btnViewBig.innerHTML = '<span>🔍 Ver grande</span>';
    btnViewBig.title = 'Abrir guía en ventana independiente para segunda pantalla';
    btnViewBig.addEventListener('click', () => {
      this.openGuideViewer(guide.id);
    });
    cardFooter.appendChild(btnViewBig);

    if (isAdmin) {
      const adminActions = document.createElement('div');
      adminActions.className = 'guide-admin-actions';

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn-icon-action';
      btnEdit.title = 'Editar guía o reemplazar imagen';
      btnEdit.textContent = '✏️';
      btnEdit.addEventListener('click', () => {
        this.openEditModal(guide);
      });
      adminActions.appendChild(btnEdit);

      const btnDelete = document.createElement('button');
      btnDelete.type = 'button';
      btnDelete.className = 'btn-icon-action btn-icon-danger';
      btnDelete.title = 'Eliminar guía visual';
      btnDelete.textContent = '🗑️';
      btnDelete.addEventListener('click', () => {
        this.openDeleteModal(guide);
      });
      adminActions.appendChild(btnDelete);

      cardFooter.appendChild(adminActions);
    }

    card.appendChild(thumbWrapper);
    card.appendChild(cardBody);
    card.appendChild(cardFooter);

    return card;
  }

  private openGuideViewer(guideId: string): void {
    const viewerUrl = chrome.runtime.getURL(`src/guide-viewer/index.html?id=${guideId}`);

    // Abrir en ventana popup independiente optimizada para segundo monitor
    if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.create) {
      chrome.windows.create({
        url: viewerUrl,
        type: 'popup',
        width: 1040,
        height: 780,
      });
    } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: viewerUrl });
    } else {
      window.open(viewerUrl, '_blank');
    }
  }

  private processSelectedImageFile(file: File): void {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      showToast('Formato no permitido. Solo se aceptan imágenes PNG, JPG o WEBP.', 'error');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      showToast(`El archivo supera los 5 MB (${(file.size / (1024 * 1024)).toFixed(2)} MB).`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.currentBase64Image = reader.result as string;
      this.imagePreview.src = this.currentBase64Image;
      this.dropzonePrompt.classList.add('hidden');
      this.previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  private clearSelectedImage(): void {
    this.currentBase64Image = null;
    this.fileInput.value = '';
    this.imagePreview.src = '';
    this.previewContainer.classList.add('hidden');
    this.dropzonePrompt.classList.remove('hidden');
  }

  private openCreateModal(): void {
    this.editingId = null;
    this.modalTitle.textContent = 'Nueva Guía Visual';
    this.btnSubmitModal.textContent = 'Guardar guía';
    this.inputTitle.value = '';
    this.inputKeywords.value = '';
    this.inputDesc.value = '';
    this.clearSelectedImage();
    this.modal.classList.remove('hidden');
    this.inputTitle.focus();
  }

  private openEditModal(guide: RemoteGuide): void {
    this.editingId = guide.id;
    this.modalTitle.textContent = 'Editar Guía Visual';
    this.btnSubmitModal.textContent = 'Actualizar cambios';
    this.inputTitle.value = guide.title;
    this.inputKeywords.value = guide.keywords.join(', ');
    this.inputDesc.value = guide.description || '';

    // Cargar imagen actual como preview
    this.currentBase64Image = null; // No cambia salvo que seleccione una nueva
    this.fileInput.value = '';
    this.imagePreview.src = guide.imageUrl;
    this.dropzonePrompt.classList.add('hidden');
    this.previewContainer.classList.remove('hidden');

    this.modal.classList.remove('hidden');
    this.inputTitle.focus();
  }

  private closeModal(): void {
    this.modal.classList.add('hidden');
    this.editingId = null;
    this.clearSelectedImage();
  }

  private async handleFormSubmit(): Promise<void> {
    if (this.isSaving) return;

    const title = this.inputTitle.value.trim();
    const keywordsRaw = this.inputKeywords.value.trim();
    const description = this.inputDesc.value.trim();

    if (!title) {
      showToast('Ingresa un título descriptivo para la guía.', 'error');
      return;
    }

    if (!keywordsRaw) {
      showToast('Ingresa al menos una palabra clave separada por coma.', 'error');
      return;
    }

    const keywords = keywordsRaw
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    // En creación, la imagen es estrictamente requerida
    if (!this.editingId && !this.currentBase64Image) {
      showToast('Debes seleccionar o arrastrar una imagen para la guía.', 'error');
      return;
    }

    this.isSaving = true;
    this.btnSubmitModal.disabled = true;
    this.btnSubmitModal.textContent = 'Guardando en la nube...';

    try {
      if (this.editingId) {
        // Actualizar
        const payload: { title: string; keywords: string[]; description?: string; imageBase64?: string } = {
          title,
          keywords,
          description,
        };
        if (this.currentBase64Image) {
          payload.imageBase64 = this.currentBase64Image;
        }

        const res = await updateRemoteGuide(this.editingId, payload);
        if (res.success) {
          showToast('Guía visual actualizada correctamente.', 'success');
          this.closeModal();
          await this.refresh();
        } else {
          showDiagnosticError(res.error || 'Error al actualizar la guía.');
        }
      } else {
        // Crear
        const res = await createRemoteGuide({
          title,
          keywords,
          description,
          imageBase64: this.currentBase64Image!,
        });

        if (res.success) {
          showToast('Guía visual creada y disponible para el equipo.', 'success');
          this.closeModal();
          await this.refresh();
        } else {
          showDiagnosticError(res.error || 'Error al crear la guía visual.');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error de conexión al procesar la guía.', 'error');
    } finally {
      this.isSaving = false;
      this.btnSubmitModal.disabled = false;
      this.btnSubmitModal.textContent = this.editingId ? 'Actualizar cambios' : 'Guardar guía';
    }
  }

  private openDeleteModal(guide: RemoteGuide): void {
    this.deletingId = guide.id;
    this.deleteGuideName.textContent = `"${guide.title}"`;
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
      const res = await deleteRemoteGuide(this.deletingId);
      if (res.success) {
        showToast('Guía visual eliminada correctamente.', 'success');
        this.closeDeleteModal();
        await this.refresh();
      } else {
        showToast(res.error?.message || 'Error al eliminar la guía.', 'error');
      }
    } catch {
      showToast('Error de conexión al eliminar la guía.', 'error');
    } finally {
      this.btnConfirmDelete.disabled = false;
      this.btnConfirmDelete.textContent = 'Eliminar';
    }
  }
}

export const guidesView = new GuidesView();
