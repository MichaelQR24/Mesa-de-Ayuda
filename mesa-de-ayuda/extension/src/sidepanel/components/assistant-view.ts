import { ActionType, ParaphraseLevel, ToneOption } from '../types';
import { mockAiService } from '../services/mock-ai-service';
import { storageService } from '../storage/storage-service';
import { showToast } from './toast';

export class AssistantView {
  private inputTextarea!: HTMLTextAreaElement;
  private charCounter!: HTMLElement;
  private toneSelect!: HTMLSelectElement;
  private paraphraseLevelSelect!: HTMLSelectElement;
  private resultSection!: HTMLElement;
  private resultTextarea!: HTMLTextAreaElement;
  private loadingIndicator!: HTMLElement;
  private actionButtons!: NodeListOf<HTMLButtonElement>;

  private lastAction: ActionType | null = null;
  private isProcessing = false;
  private maxChars = 5000;

  async init(): Promise<void> {
    this.inputTextarea = document.getElementById('input-text') as HTMLTextAreaElement;
    this.charCounter = document.getElementById('char-count') as HTMLElement;
    this.toneSelect = document.getElementById('select-tone') as HTMLSelectElement;
    this.paraphraseLevelSelect = document.getElementById('select-paraphrase-level') as HTMLSelectElement;
    this.resultSection = document.getElementById('result-section') as HTMLElement;
    this.resultTextarea = document.getElementById('result-text') as HTMLTextAreaElement;
    this.loadingIndicator = document.getElementById('loading-indicator') as HTMLElement;
    this.actionButtons = document.querySelectorAll<HTMLButtonElement>('.action-btn');

    // Cargar configuración guardada
    await this.applyStoredSettings();

    // Event listeners
    this.setupEventListeners();
    this.updateCharCount();
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

  private setupEventListeners(): void {
    // Contador de caracteres y límite
    this.inputTextarea.addEventListener('input', () => {
      this.updateCharCount();
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

    const btnSave = document.getElementById('btn-save-result');
    btnSave?.addEventListener('click', () => this.saveResult());

    const btnRegenerate = document.getElementById('btn-regenerate');
    btnRegenerate?.addEventListener('click', () => this.regenerate());

    const btnClear = document.getElementById('btn-clear-all');
    btnClear?.addEventListener('click', () => this.clearAll());
  }

  private updateCharCount(): void {
    const count = this.inputTextarea.value.length;
    this.charCounter.textContent = `${count} / ${this.maxChars} caracteres`;

    if (count >= this.maxChars) {
      this.charCounter.classList.add('char-limit-reached');
      if (count > this.maxChars) {
        this.inputTextarea.value = this.inputTextarea.value.slice(0, this.maxChars);
        this.charCounter.textContent = `${this.maxChars} / ${this.maxChars} caracteres`;
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
    const tone = this.toneSelect.value as ToneOption;
    const paraphraseLevel = this.paraphraseLevelSelect.value as ParaphraseLevel;

    this.setProcessingState(true);

    try {
      const result = await mockAiService.processText({
        action,
        text: originalText,
        tone,
        paraphraseLevel,
      });

      this.resultTextarea.value = result;
      this.resultSection.classList.add('visible');

      // Guardar en historial
      await storageService.addHistoryItem({
        id: `hist-${Date.now()}`,
        action,
        originalText,
        resultText: result,
        timestamp: Date.now(),
        tone,
        paraphraseLevel,
      });

      // Scroll suave hacia el resultado
      this.resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast('Texto procesado con éxito', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error al procesar el texto.';
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
      // Fallback
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
    showToast('Campos limpiados', 'info');
  }
}

export const assistantView = new AssistantView();
