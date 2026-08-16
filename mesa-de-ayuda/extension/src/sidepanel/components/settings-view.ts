import { storageService } from '../storage/storage-service';
import { AppSettings, ParaphraseLevel, ThemeOption, ToneOption } from '../types';
import { assistantView } from './assistant-view';
import { showToast } from './toast';

export class SettingsView {
  private toneSelect!: HTMLSelectElement;
  private paraphraseSelect!: HTMLSelectElement;
  private confirmClearCheckbox!: HTMLInputElement;
  private themeSelect!: HTMLSelectElement;
  private saveSettingsBtn!: HTMLButtonElement;

  async init(): Promise<void> {
    this.toneSelect = document.getElementById('settings-default-tone') as HTMLSelectElement;
    this.paraphraseSelect = document.getElementById('settings-default-paraphrase') as HTMLSelectElement;
    this.confirmClearCheckbox = document.getElementById('settings-confirm-clear') as HTMLInputElement;
    this.themeSelect = document.getElementById('settings-theme') as HTMLSelectElement;
    this.saveSettingsBtn = document.getElementById('btn-save-settings') as HTMLButtonElement;

    await this.loadSettings();

    this.saveSettingsBtn.addEventListener('click', async () => {
      await this.saveSettings();
    });

    this.themeSelect.addEventListener('change', () => {
      this.applyTheme(this.themeSelect.value as ThemeOption);
    });
  }

  async loadSettings(): Promise<void> {
    const settings = await storageService.getSettings();
    if (this.toneSelect) this.toneSelect.value = settings.defaultTone;
    if (this.paraphraseSelect) this.paraphraseSelect.value = settings.defaultParaphraseLevel;
    if (this.confirmClearCheckbox) this.confirmClearCheckbox.checked = settings.confirmBeforeClear;
    if (this.themeSelect) this.themeSelect.value = settings.theme;

    this.applyTheme(settings.theme);
  }

  private applyTheme(theme: ThemeOption): void {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');

    if (theme === 'dark') {
      root.classList.add('theme-dark');
    } else if (theme === 'light') {
      root.classList.add('theme-light');
    }
  }

  private async saveSettings(): Promise<void> {
    const updated: AppSettings = {
      defaultTone: this.toneSelect.value as ToneOption,
      defaultParaphraseLevel: this.paraphraseSelect.value as ParaphraseLevel,
      confirmBeforeClear: this.confirmClearCheckbox.checked,
      theme: this.themeSelect.value as ThemeOption,
    };

    await storageService.saveSettings(updated);
    this.applyTheme(updated.theme);
    await assistantView.applyStoredSettings();

    showToast('Configuración guardada exitosamente', 'success');
  }
}

export const settingsView = new SettingsView();
