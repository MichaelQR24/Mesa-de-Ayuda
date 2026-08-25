import { ActionType, ParaphraseLevel, ParaphraseStyle, ToneOption } from '../types';
import { SelectedTextContext } from '../../types/messaging.types';
import { storageService } from '../storage/storage-service';
import { showToast, showDiagnosticError } from './toast';
import { processAiText, fetchRemoteCategories, createRemoteLibraryItem } from '../services/api-client';
import { navigationManager } from './navigation';
import { sensitiveDataGuard } from '../../utils/sensitive-data.guard';

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

const ACTION_INFO_TEXTS: Record<ActionType, string> = {
  corregir: 'Corrige ortografía, gramática y puntuación sin cambiar el significado.',
  parafrasear: 'Reescribe el texto con estilo y nivel de cambio adaptables a tu comunicación.',
  profesionalizar: 'Transforma el reporte en un texto formal y técnico adecuado para soporte.',
  resumir: 'Reduce el texto conservando la información más importante.',
  responder: 'Genera una respuesta adecuada al mensaje recibido.',
};

const TONE_HINT_TEXTS: Record<ToneOption, string> = {
  profesional: 'Tono sobrio y corporativo estándar para soporte técnico.',
  formal: 'Lenguaje altamente respetuoso y protocolar.',
  amable: 'Cálido y empático, ideal para calmar usuarios o atención personalizada.',
  tecnico: 'Usa lenguaje preciso y apropiado para soporte TI.',
  casual: 'Cercano y directo para comunicación interna.',
};

const PARAPHRASE_HINT_TEXTS: Record<ParaphraseLevel, string> = {
  suave: 'Conserva gran parte de la redacción original con ajustes leves.',
  medio: 'Reescribe el texto manteniendo claramente su significado.',
  completo: 'Cambia ampliamente la forma de expresarlo sin alterar la idea.',
};

const PARAPHRASE_STYLE_HINT_TEXTS: Record<ParaphraseStyle, string> = {
  helpdesk: 'Breve y operativo para comunicaciones de soporte.',
  formal: 'Redacción más protocolar y cuidada.',
  institutional: 'Adecuado para comunicaciones internas de una organización.',
  direct: 'Reduce rodeos y prioriza la acción.',
};

export class AssistantView {
  private inputTextarea!: HTMLTextAreaElement;
  private charCounter!: HTMLElement;
  private toneSelect!: HTMLSelectElement;
  private labelTone!: HTMLElement;
  private groupTone!: HTMLElement;
  private toneHintText!: HTMLElement;
  private paraphraseLevelSelect!: HTMLSelectElement;
  private groupParaphraseLevel!: HTMLElement;
  private paraphraseHintText!: HTMLElement;
  private paraphraseStyleSelect!: HTMLSelectElement;
  private groupParaphraseStyle!: HTMLElement;
  private paraphraseStyleHintText!: HTMLElement;
  private actionInfoText!: HTMLElement;
  private btnProcessAi!: HTMLButtonElement;
  private resultSection!: HTMLElement;
  private resultTextarea!: HTMLTextAreaElement;
  private loadingIndicator!: HTMLElement;
  private actionButtons!: NodeListOf<HTMLButtonElement>;
  private btnGetSelection!: HTMLButtonElement;
  private btnReplaceSelection!: HTMLButtonElement;
  private sourceIndicator!: HTMLElement;

  private selectedAction: ActionType = 'corregir';
  private lastExecutedAction: ActionType | null = null;
  private isProcessing = false;
  private maxChars = 5000;
  private currentSelectionContext: SelectedTextContext | null = null;

  async init(): Promise<void> {
    this.inputTextarea = document.getElementById('input-text') as HTMLTextAreaElement;
    this.charCounter = document.getElementById('char-count') as HTMLElement;
    this.toneSelect = document.getElementById('select-tone') as HTMLSelectElement;
    this.labelTone = document.getElementById('label-tone') as HTMLElement;
    this.groupTone = document.getElementById('group-tone') as HTMLElement;
    this.toneHintText = document.getElementById('tone-hint-text') as HTMLElement;
    this.paraphraseLevelSelect = document.getElementById('select-paraphrase-level') as HTMLSelectElement;
    this.groupParaphraseLevel = document.getElementById('group-paraphrase-level') as HTMLElement;
    this.paraphraseHintText = document.getElementById('paraphrase-hint-text') as HTMLElement;
    this.paraphraseStyleSelect = document.getElementById('select-paraphrase-style') as HTMLSelectElement;
    this.groupParaphraseStyle = document.getElementById('group-paraphrase-style') as HTMLElement;
    this.paraphraseStyleHintText = document.getElementById('paraphrase-style-hint-text') as HTMLElement;
    this.actionInfoText = document.getElementById('action-info-text') as HTMLElement;
    this.btnProcessAi = document.getElementById('btn-process-ai') as HTMLButtonElement;
    this.resultSection = document.getElementById('result-section') as HTMLElement;
    this.resultTextarea = document.getElementById('result-text') as HTMLTextAreaElement;
    this.loadingIndicator = document.getElementById('loading-indicator') as HTMLElement;
    this.actionButtons = document.querySelectorAll<HTMLButtonElement>('.action-btn');
    this.btnGetSelection = document.getElementById('btn-get-selection') as HTMLButtonElement;
    this.btnReplaceSelection = document.getElementById('btn-replace-selection') as HTMLButtonElement;
    this.sourceIndicator = document.getElementById('source-indicator') as HTMLElement;

    // Cargar configuración guardada y preferencias locales de parafraseo
    await this.applyStoredSettings();

    // Event listeners
    this.setupEventListeners();
    this.updateCharCount();
    this.updateProgressiveDisclosureUI();

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

    // Cargar preferencias locales específicas de parafraseo por PC
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const stored = (await chrome.storage.local.get([
          'lastParaphraseStyle',
          'lastParaphraseLevel',
        ])) as {
          lastParaphraseStyle?: string;
          lastParaphraseLevel?: string;
        };

        if (stored.lastParaphraseStyle && this.paraphraseStyleSelect) {
          this.paraphraseStyleSelect.value = String(stored.lastParaphraseStyle);
        }
        if (stored.lastParaphraseLevel && this.paraphraseLevelSelect) {
          this.paraphraseLevelSelect.value = String(stored.lastParaphraseLevel);
        }
      } catch {}
    }

    this.updateOptionHints();
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
    navigationManager.switchTab('asistente');
    this.currentSelectionContext = context;
    this.setText(context.text);

    if (this.sourceIndicator) {
      this.sourceIndicator.classList.remove('hidden');
    }

    if (context.suggestedAction) {
      this.selectAction(context.suggestedAction);
      showToast('Texto cargado desde la página', 'info');
    } else {
      showToast('Texto enviado al asistente', 'info');
    }
  }

  selectAction(action: ActionType): void {
    this.selectedAction = action;

    this.actionButtons.forEach((btn) => {
      const isTarget = btn.dataset.action === action;
      btn.classList.toggle('active', isTarget);
    });

    this.updateProgressiveDisclosureUI();
  }

  private updateProgressiveDisclosureUI(): void {
    const action = this.selectedAction;

    // 1. Texto descriptivo didáctico
    if (this.actionInfoText) {
      this.actionInfoText.textContent = ACTION_INFO_TEXTS[action] || '';
    }

    // 2. Divulgación Progresiva de controles
    switch (action) {
      case 'corregir':
      case 'resumir':
        this.groupParaphraseLevel?.classList.add('hidden');
        this.groupParaphraseStyle?.classList.add('hidden');
        this.groupTone?.classList.add('hidden');
        break;

      case 'parafrasear':
        this.groupParaphraseLevel?.classList.remove('hidden');
        this.groupParaphraseStyle?.classList.remove('hidden');
        this.groupTone?.classList.add('hidden');
        break;

      case 'profesionalizar':
        this.groupParaphraseLevel?.classList.add('hidden');
        this.groupParaphraseStyle?.classList.add('hidden');
        this.groupTone?.classList.remove('hidden');
        if (this.labelTone) {
          this.labelTone.textContent = 'Estilo de redacción:';
        }
        break;

      case 'responder':
        this.groupParaphraseLevel?.classList.add('hidden');
        this.groupParaphraseStyle?.classList.add('hidden');
        this.groupTone?.classList.remove('hidden');
        if (this.labelTone) {
          this.labelTone.textContent = 'Tono de respuesta:';
        }
        break;
    }

    this.updateOptionHints();
  }

  private updateOptionHints(): void {
    if (this.toneSelect && this.toneHintText) {
      const toneVal = this.toneSelect.value as ToneOption;
      this.toneHintText.textContent = TONE_HINT_TEXTS[toneVal] || '';
    }
    if (this.paraphraseLevelSelect && this.paraphraseHintText) {
      const levelVal = this.paraphraseLevelSelect.value as ParaphraseLevel;
      this.paraphraseHintText.textContent = PARAPHRASE_HINT_TEXTS[levelVal] || '';
    }
    if (this.paraphraseStyleSelect && this.paraphraseStyleHintText) {
      const styleVal = (this.paraphraseStyleSelect.value as ParaphraseStyle) || 'helpdesk';
      this.paraphraseStyleHintText.textContent = PARAPHRASE_STYLE_HINT_TEXTS[styleVal] || '';
    }
  }

  private setupEventListeners(): void {
    // Contador de caracteres y límite
    this.inputTextarea?.addEventListener('input', () => {
      this.updateCharCount();
      if (!this.inputTextarea.value.trim() && this.sourceIndicator) {
        this.sourceIndicator.classList.add('hidden');
      }
    });

    // Botones de acción del Asistente
    this.actionButtons?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action as ActionType;
        if (action) {
          this.selectAction(action);
        }
      });
    });

    // Selectores con persistencia reactiva por PC
    this.toneSelect?.addEventListener('change', () => {
      this.updateOptionHints();
    });

    this.paraphraseLevelSelect?.addEventListener('change', () => {
      this.updateOptionHints();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ lastParaphraseLevel: this.paraphraseLevelSelect.value }).catch(() => {});
      }
    });

    this.paraphraseStyleSelect?.addEventListener('change', () => {
      const style = (this.paraphraseStyleSelect.value as ParaphraseStyle) || 'helpdesk';
      this.updateOptionHints();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ lastParaphraseStyle: style }).catch(() => {});
      }
    });

    // Botón principal "Procesar con IA"
    this.btnProcessAi?.addEventListener('click', () => {
      this.executeAction(this.selectedAction);
    });

    // Atajos de teclado en el textarea (Ctrl+Enter o Cmd+Enter para procesar)
    this.inputTextarea?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.executeAction(this.selectedAction);
      }
    });

    // Botones de herramientas del resultado
    document.getElementById('btn-copy-result')?.addEventListener('click', () => this.copyResult());
    document.getElementById('btn-save-result')?.addEventListener('click', () => this.openSaveModal());
    document.getElementById('btn-clear-input')?.addEventListener('click', () => this.clearAll());
    document.getElementById('btn-retry')?.addEventListener('click', () => {
      if (this.lastExecutedAction) {
        this.executeAction(this.lastExecutedAction);
      } else {
        this.executeAction(this.selectedAction);
      }
    });

    // Interacción bidireccional con la página activa
    this.btnGetSelection?.addEventListener('click', () => this.fetchSelectionFromPage());
    this.btnReplaceSelection?.addEventListener('click', () => this.replaceSelectionInPage());

    // Modal de Guardar
    this.setupSaveModal();
  }

  private async fetchSelectionFromPage(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      showToast('API de Chrome Tabs no disponible.', 'error');
      return;
    }

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || typeof activeTab.id !== 'number') {
        showToast('No se encontró una pestaña activa para capturar selección.', 'error');
        return;
      }

      const url = activeTab.url || '';
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('https://chrome.google.com/webstore')) {
        showToast('Chrome no permite usar Mesa de Ayuda en esta página.', 'error');
        return;
      }

      let response;
      try {
        response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_SELECTED_TEXT' });
      } catch {
        if (chrome.scripting) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ['content-script.js'],
            });
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
    const replacementText = this.resultTextarea?.value;
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
      this.loadingIndicator?.classList.add('active');
      this.actionButtons?.forEach((b) => (b.disabled = true));
      if (this.btnProcessAi) {
        this.btnProcessAi.disabled = true;
        this.btnProcessAi.textContent = 'Procesando...';
      }
    } else {
      this.loadingIndicator?.classList.remove('active');
      this.actionButtons?.forEach((b) => (b.disabled = false));
      if (this.btnProcessAi) {
        this.btnProcessAi.disabled = false;
        this.btnProcessAi.textContent = '⚡ Procesar con IA';
      }
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

    this.lastExecutedAction = action;
    const backendAction = ACTION_MAP[action] || 'professionalize';

    let backendTone = 'helpdesk';
    let backendLevel: 'soft' | 'medium' | 'complete' = 'medium';

    if (action === 'parafrasear') {
      const selectedStyle = (this.paraphraseStyleSelect?.value as ParaphraseStyle) || 'helpdesk';
      backendTone = selectedStyle;
      const rawLevel = this.paraphraseLevelSelect?.value as ParaphraseLevel;
      backendLevel = LEVEL_MAP[rawLevel] || 'medium';
    } else {
      const rawTone = this.toneSelect?.value as ToneOption;
      backendTone = TONE_MAP[rawTone] || 'professional';
    }

    // 1. Análisis de datos sensibles antes de enviar
    const analysis = sensitiveDataGuard.analyze(originalText);
    if (analysis.status === 'BLOCKED') {
      const types = analysis.detectionTypes.join(', ');
      showToast(`Datos sensibles bloqueados: ${types}. Elimínalos antes de enviar.`, 'error');
      return;
    }

    let redactSensitiveData = false;
    if (analysis.status === 'WARNING') {
      const types = analysis.detectionTypes.join(', ');
      const wantsRedaction = window.confirm(
        `Se detectaron posibles datos personales (${types}).\n\n¿Deseas anonimizarlos automáticamente antes de procesar con la IA?`
      );
      redactSensitiveData = wantsRedaction;
    }

    this.setProcessingState(true);

    const coldStartTimer = setTimeout(() => {
      if (this.isProcessing) {
        showToast('Conectando con la nube... (iniciando servidor en reposo)', 'info');
      }
    }, 3500);

    try {
      const response = await processAiText({
        text: originalText,
        action: backendAction,
        tone: backendTone,
        paraphraseLevel: backendLevel,
        redactSensitiveData,
      });

      if (!response.success || !response.data) {
        showDiagnosticError(response.error || 'No fue posible procesar el texto con la IA en este momento.');
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
        tone: backendTone,
        paraphraseLevel: action === 'parafrasear' ? (this.paraphraseLevelSelect?.value as ParaphraseLevel) : undefined,
      });

      // Scroll suave hacia el resultado
      this.resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast('Texto procesado con IA exitosamente', 'success');
    } catch (err: unknown) {
      showDiagnosticError(err instanceof Error ? err : 'Ocurrió un error al conectar con el servidor.');
    } finally {
      clearTimeout(coldStartTimer);
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
      showToast('Texto copiado al portapapeles', 'success');
    } catch {
      const tempArea = document.createElement('textarea');
      tempArea.value = text;
      document.body.appendChild(tempArea);
      tempArea.select();
      document.execCommand('copy');
      document.body.removeChild(tempArea);
      showToast('Texto copiado al portapapeles', 'success');
    }
  }

  private openSaveModal(): void {
    const text = this.resultTextarea.value.trim();
    if (!text) {
      showToast('No hay texto para guardar.', 'error');
      return;
    }

    const modal = document.getElementById('modal-save-item');
    const inputContent = document.getElementById('save-item-content') as HTMLTextAreaElement;
    const inputTitle = document.getElementById('save-item-title') as HTMLInputElement;

    if (inputContent) inputContent.value = text;
    if (inputTitle) inputTitle.value = '';

    modal?.classList.remove('hidden');
    inputTitle?.focus();
    this.populateSaveCategories();
  }

  private setupSaveModal(): void {
    const modal = document.getElementById('modal-save-item');
    const form = document.getElementById('form-save-item') as HTMLFormElement;
    const btnCancel = document.getElementById('btn-cancel-save');
    const btnClose = document.getElementById('btn-close-save-modal');

    const closeModal = () => modal?.classList.add('hidden');

    btnCancel?.addEventListener('click', closeModal);
    btnClose?.addEventListener('click', closeModal);

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('save-item-title') as HTMLInputElement;
      const contentInput = document.getElementById('save-item-content') as HTMLTextAreaElement;
      const categorySelect = document.getElementById('save-item-category') as HTMLSelectElement;

      const title = titleInput.value.trim();
      const content = contentInput.value.trim();
      const category = categorySelect.value.trim() || 'General';

      if (!title || !content) {
        showToast('El título y contenido son obligatorios', 'error');
        return;
      }

      await storageService.saveItem({
        id: `saved-${Date.now()}`,
        title,
        content,
        category,
        createdAt: Date.now(),
      });

      // Si hay conexión con el servidor y categoryId válido, sincronizar
      try {
        const remote = await fetchRemoteCategories();
        if (remote.success && remote.data) {
          const matched = remote.data.find((c) => c.name.toLowerCase() === category.toLowerCase());
          if (matched) {
            await createRemoteLibraryItem({ title, content, categoryId: matched.id });
          }
        }
      } catch {}

      showToast('Texto guardado correctamente', 'success');
      closeModal();
    });
  }

  private async populateSaveCategories(): Promise<void> {
    const select = document.getElementById('save-item-category') as HTMLSelectElement;
    if (!select) return;

    try {
      const remote = await fetchRemoteCategories();
      if (remote.success && remote.data && remote.data.length > 0) {
        select.innerHTML = '';
        remote.data.forEach((cat) => {
          const opt = document.createElement('option');
          opt.value = cat.name;
          opt.textContent = `${(cat as any).icon || '📁'} ${cat.name}`;
          select.appendChild(opt);
        });
        return;
      }
    } catch {}

    const defaultCategories = ['General', 'Redes', 'Hardware', 'Software', 'Accesos'];
    select.innerHTML = '';
    defaultCategories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  private async clearAll(): Promise<void> {
    const settings = await storageService.getSettings();
    if (settings.confirmBeforeClear && (this.inputTextarea.value || this.resultTextarea.value)) {
      const confirmed = window.confirm('¿Estás seguro de que deseas limpiar el texto actual y el resultado?');
      if (!confirmed) return;
    }

    if (this.inputTextarea) this.inputTextarea.value = '';
    if (this.resultTextarea) this.resultTextarea.value = '';
    this.resultSection?.classList.remove('visible');
    this.sourceIndicator?.classList.add('hidden');
    this.currentSelectionContext = null;
    this.updateCharCount();
    this.updateReplaceButtonVisibility();
    showToast('Campos limpiados', 'info');
  }
}

export const assistantView = new AssistantView();
