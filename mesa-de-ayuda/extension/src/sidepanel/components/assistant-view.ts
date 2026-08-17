import { ActionType, ParaphraseLevel, ToneOption } from '../types';
import { SelectedTextContext } from '../../types/messaging.types';
import { storageService } from '../storage/storage-service';
import { showToast } from './toast';
import { processAiText, fetchRemoteCategories, createRemoteLibraryItem } from '../services/api-client';
import { navigationManager } from './navigation';

const ACTION_MAP: Record<ActionType, 'correct' | 'paraphrase' | 'professionalize' | 'summarize' | 'reply'> = {
  corregir: 'correct',
  parafrasear: 'paraphrase',
  profesionalizar: 'professionalize',
  resumir: 'summarize',
  responder: 'reply',
};

const TONE_MAP: Record<ToneOption, 'professional' | 'formal' | 'friendly' | 'technical' | 'casual'> = {
  profesional: 'professional',
  formal: 'formal',
  amable: 'friendly',
  tecnico: 'technical',
  casual: 'casual',
};

const LEVEL_MAP: Record<ParaphraseLevel, 'soft' | 'medium' | 'complete'> = {
  suave: 'soft',
  medio: 'medium',
  completo: 'complete',
};

export class AssistantView {
  private inputTextarea!: HTMLTextAreaElement;
  private charCounter!: HTMLElement;
  private toneSelect!: HTMLSelectElement;
  private paraphraseLevelSelect!: HTMLSelectElement;
  private resultSection!: HTMLElement;
  private resultTextarea!: HTMLTextAreaElement;
  private loadingIndicator!: HTMLElement;
  private actionButtons!: NodeListOf<HTMLButtonElement>;
  private btnGetSelection!: HTMLButtonElement;
  private btnReplaceSelection!: HTMLButtonElement;
  private sourceIndicator!: HTMLElement;

  private lastAction: ActionType | null = null;
  private isProcessing = false;
  private maxChars = 5000;
  private currentSelectionContext: SelectedTextContext | null = null;

  async init(): Promise<void> {
    this.inputTextarea = document.getElementById('input-text') as HTMLTextAreaElement;
    this.charCounter = document.getElementById('char-count') as HTMLElement;
    this.toneSelect = document.getElementById('select-tone') as HTMLSelectElement;
    this.paraphraseLevelSelect = document.getElementById('select-paraphrase-level') as HTMLSelectElement;
    this.resultSection = document.getElementById('result-section') as HTMLElement;
    this.resultTextarea = document.getElementById('result-text') as HTMLTextAreaElement;
    this.loadingIndicator = document.getElementById('loading-indicator') as HTMLElement;
    this.actionButtons = document.querySelectorAll<HTMLButtonElement>('.action-btn');
    this.btnGetSelection = document.getElementById('btn-get-selection') as HTMLButtonElement;
    this.btnReplaceSelection = document.getElementById('btn-replace-selection') as HTMLButtonElement;
    this.sourceIndicator = document.getElementById('source-indicator') as HTMLElement;

    // Cargar configuración guardada
    await this.applyStoredSettings();

    // Event listeners
    this.setupEventListeners();
    this.updateCharCount();

    // Comprobar si hay una selección pendiente enviada desde Context Menu
    await this.checkPendingSelection();

    // Escuchar mensajes entrantes en tiempo real
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'LOAD_SELECTION' && msg.payload) {
          this.loadSelectionContext(msg.payload);
        }
      });
    }
  }

  async applyStoredSettings(): Promise<void> {
    const settings = await storageService.getSettings();
    if (this.toneSelect) {
      this.toneSelect.value = settings.defaultTone;
    }
    if (this.paraphraseLevelSelect) {
      this.paraphraseLevelSelect.value = settings.defaultParaphraseLevel;
    }
  }

  setText(text: string): void {
    if (this.inputTextarea) {
      this.inputTextarea.value = text;
      this.updateCharCount();
      this.inputTextarea.focus();
    }
  }

  async checkPendingSelection(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        const data = (await chrome.storage.session.get(['pendingSelection'])) as {
          pendingSelection?: SelectedTextContext;
        };
        if (data.pendingSelection) {
          this.loadSelectionContext(data.pendingSelection);
          await chrome.storage.session.remove(['pendingSelection']);
        }
      }
    } catch {
      // Ignora errores si session storage no está disponible
    }
  }

  loadSelectionContext(context: SelectedTextContext): void {
    // 1. Asegurar navegación a la pestaña Asistente
    navigationManager.switchTab('asistente');

    // 2. Cargar texto en textarea y actualizar estado
    this.currentSelectionContext = context;
    this.setText(context.text);

    if (this.sourceIndicator) {
      this.sourceIndicator.classList.remove('hidden');
    }

    // 3. Resaltar o enfocar acción sugerida si existe
    if (context.suggestedAction) {
      this.highlightAction(context.suggestedAction);
      showToast('Texto cargado desde la página', 'info');
    } else {
      showToast('Texto enviado al asistente', 'info');
    }
  }

  private highlightAction(action: ActionType): void {
    this.actionButtons.forEach((btn) => {
      const isTarget = btn.dataset.action === action;
      if (isTarget) {
        btn.focus();
      }
    });
  }

  private setupEventListeners(): void {
    // Contador de caracteres y límite
    this.inputTextarea.addEventListener('input', () => {
      this.updateCharCount();
      // Si el usuario borra el texto manualmente, ocultamos el indicador de origen
      if (this.sourceIndicator && !this.inputTextarea.value) {
        this.sourceIndicator.classList.add('hidden');
        this.currentSelectionContext = null;
        this.updateReplaceButtonVisibility();
      }
    });

    // Botón para capturar selección bajo demanda
    this.btnGetSelection?.addEventListener('click', async () => {
      await this.fetchSelectionFromActiveTab();
    });

    // Botones de acción principales
    this.actionButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action as ActionType;
        if (action) {
          await this.executeAction(action);
        }
      });
    });

    // Acciones del resultado
    const btnCopy = document.getElementById('btn-copy-result');
    btnCopy?.addEventListener('click', () => this.copyResult());

    this.btnReplaceSelection?.addEventListener('click', async () => {
      await this.replaceSelectionInPage();
    });

    const btnSave = document.getElementById('btn-save-result');
    btnSave?.addEventListener('click', () => this.saveResult());

    const btnRegenerate = document.getElementById('btn-regenerate');
    btnRegenerate?.addEventListener('click', () => this.regenerate());

    const btnClear = document.getElementById('btn-clear-all');
    btnClear?.addEventListener('click', () => this.clearAll());
  }

  private async fetchSelectionFromActiveTab(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      showToast('API de pestañas de Chrome no disponible', 'error');
      return;
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || typeof activeTab.id !== 'number') {
        showToast('No se encontró una pestaña activa', 'error');
        return;
      }

      const url = activeTab.url || '';
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('https://chrome.google.com/webstore')) {
        showToast('Chrome no permite usar Mesa de Ayuda en esta página.', 'error');
        return;
      }

      // Intentar enviar mensaje al Content Script
      let response;
      try {
        response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_SELECTED_TEXT' });
      } catch {
        // Si no está inyectado, intenta inyectar el script con chrome.scripting
        if (chrome.scripting) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ['content-script.js'],
            });
            // Reintentar tras inyección
            response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_SELECTED_TEXT' });
          } catch {
            showToast('No se pudo interactuar con la página actual.', 'error');
            return;
          }
        }
      }

      if (response && response.success && response.data) {
        const ctx: SelectedTextContext = {
          ...response.data,
          source: 'direct-selection',
          tabId: activeTab.id,
        };
        this.loadSelectionContext(ctx);
      } else {
        showToast('Selecciona un texto en la página antes de continuar.', 'info');
      }
    } catch {
      showToast('Selecciona un texto en la página antes de continuar.', 'info');
    }
  }

  private async replaceSelectionInPage(): Promise<void> {
    const replacementText = this.resultTextarea.value;
    if (!replacementText) {
      showToast('No hay resultado para reemplazar.', 'error');
      return;
    }

    if (!this.currentSelectionContext || !this.currentSelectionContext.canReplace) {
      showToast('La selección original no es editable. Usa Copiar.', 'error');
      return;
    }

    const tabId = this.currentSelectionContext.tabId;
    if (typeof tabId !== 'number') {
      showToast('La pestaña original ya no está disponible.', 'error');
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'REPLACE_SELECTION',
        payload: { replacementText },
      });

      if (response && response.success) {
        showToast('¡Texto reemplazado en la página con éxito!', 'success');
      } else {
        const errorMsg = response?.error || 'La selección original cambió. Usa Copiar o vuelve a seleccionar.';
        showToast(errorMsg, 'error');
        this.currentSelectionContext.canReplace = false;
        this.updateReplaceButtonVisibility();
      }
    } catch {
      showToast('La selección ya no está disponible. Usa Copiar o vuelve a seleccionar.', 'error');
      this.currentSelectionContext.canReplace = false;
      this.updateReplaceButtonVisibility();
    }
  }

  private updateReplaceButtonVisibility(): void {
    if (this.btnReplaceSelection) {
      const isVisible = !!(this.currentSelectionContext && this.currentSelectionContext.canReplace && this.resultTextarea.value);
      this.btnReplaceSelection.classList.toggle('hidden', !isVisible);
    }
  }

  private updateCharCount(): void {
    const count = this.inputTextarea.value.length;
    this.charCounter.textContent = `${count} / ${this.maxChars}`;

    if (count >= this.maxChars) {
      this.charCounter.classList.add('char-limit-reached');
      if (count > this.maxChars) {
        this.inputTextarea.value = this.inputTextarea.value.slice(0, this.maxChars);
        this.charCounter.textContent = `${this.maxChars} / ${this.maxChars}`;
        showToast('Límite de 5000 caracteres alcanzado', 'info');
      }
    } else {
      this.charCounter.classList.remove('char-limit-reached');
    }
  }

  private setProcessingState(processing: boolean): void {
    this.isProcessing = processing;
    if (processing) {
      this.loadingIndicator.classList.add('active');
      this.actionButtons.forEach((b) => (b.disabled = true));
    } else {
      this.loadingIndicator.classList.remove('active');
      this.actionButtons.forEach((b) => (b.disabled = false));
    }
  }

  private async executeAction(action: ActionType): Promise<void> {
    if (this.isProcessing) return;

    const originalText = this.inputTextarea.value.trim();
    if (!originalText) {
      showToast('Ingresa un texto antes de continuar.', 'error');
      this.inputTextarea.focus();
      return;
    }

    this.lastAction = action;
    const rawTone = this.toneSelect.value as ToneOption;
    const rawLevel = this.paraphraseLevelSelect.value as ParaphraseLevel;

    const backendAction = ACTION_MAP[action] || 'professionalize';
    const backendTone = TONE_MAP[rawTone] || 'professional';
    const backendLevel = LEVEL_MAP[rawLevel] || 'medium';

    this.setProcessingState(true);

    try {
      const response = await processAiText({
        text: originalText,
        action: backendAction,
        tone: backendTone,
        paraphraseLevel: backendLevel,
      });

      if (!response.success || !response.data) {
        const errMsg = response.error?.message || 'No fue posible procesar el texto con la IA en este momento.';
        showToast(errMsg, 'error');
        return;
      }

      const generatedResult = response.data.result;

      this.resultTextarea.value = generatedResult;
      this.resultSection.classList.add('visible');
      this.updateReplaceButtonVisibility();

      // Guardar en historial local
      await storageService.addHistoryItem({
        id: `hist-${Date.now()}`,
        action,
        originalText,
        resultText: generatedResult,
        timestamp: Date.now(),
        tone: rawTone,
        paraphraseLevel: rawLevel,
      });

      // Scroll suave hacia el resultado
      this.resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast('Texto procesado con IA exitosamente', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error al conectar con el servidor.';
      showToast(msg, 'error');
    } finally {
      this.setProcessingState(false);
    }
  }

  private async copyResult(): Promise<void> {
    const text = this.resultTextarea.value;
    if (!text) {
      showToast('No hay resultado para copiar.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast('¡Copiado al portapapeles!', 'success');
    } catch {
      this.resultTextarea.select();
      document.execCommand('copy');
      showToast('¡Copiado al portapapeles!', 'success');
    }
  }

  private async saveResult(): Promise<void> {
    const text = this.resultTextarea.value;
    if (!text) {
      showToast('No hay resultado para guardar.', 'error');
      return;
    }

    const title = this.lastAction
      ? `Respuesta - ${this.lastAction.charAt(0).toUpperCase() + this.lastAction.slice(1)}`
      : 'Texto Guardado';

    try {
      const catRes = await fetchRemoteCategories();
      const categoryId = catRes.data && catRes.data.length > 0 ? catRes.data[0].id : undefined;

      if (categoryId) {
        await createRemoteLibraryItem({
          title,
          content: text,
          categoryId,
          isShared: false,
          isFavorite: true,
        });
      }
    } catch {
      // Si la BD remota no responde, se guarda localmente
    }

    await storageService.saveItem({
      id: `saved-${Date.now()}`,
      title,
      content: text,
      category: 'Asistente',
      createdAt: Date.now(),
    });

    showToast('Guardado en favoritos correctamente', 'success');
  }

  private async regenerate(): Promise<void> {
    if (this.lastAction) {
      await this.executeAction(this.lastAction);
    } else {
      await this.executeAction('profesionalizar');
    }
  }

  private async clearAll(): Promise<void> {
    const settings = await storageService.getSettings();

    if (settings.confirmBeforeClear && (this.inputTextarea.value || this.resultTextarea.value)) {
      const confirmed = window.confirm('¿Deseas limpiar el texto original y el resultado?');
      if (!confirmed) return;
    }

    this.inputTextarea.value = '';
    this.resultTextarea.value = '';
    this.updateCharCount();
    this.resultSection.classList.remove('visible');
    this.lastAction = null;
    this.currentSelectionContext = null;
    if (this.sourceIndicator) {
      this.sourceIndicator.classList.add('hidden');
    }
    this.updateReplaceButtonVisibility();
    showToast('Campos limpiados', 'info');
  }
}

export const assistantView = new AssistantView();
