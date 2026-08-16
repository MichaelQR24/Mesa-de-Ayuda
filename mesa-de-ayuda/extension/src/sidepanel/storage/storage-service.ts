import { AppSettings, HistoryItem, SavedItem } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'mda_settings',
  HISTORY: 'mda_history',
  SAVED: 'mda_saved',
  FAVORITE_LIBRARY_IDS: 'mda_favorite_lib_ids',
};

const DEFAULT_SETTINGS: AppSettings = {
  defaultTone: 'profesional',
  defaultParaphraseLevel: 'medio',
  confirmBeforeClear: true,
  theme: 'system',
};

class StorageService {
  private isChromeStorageAvailable(): boolean {
    return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
  }

  async getSettings(): Promise<AppSettings> {
    try {
      if (this.isChromeStorageAvailable()) {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
      }
      const item = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return item ? { ...DEFAULT_SETTINGS, ...JSON.parse(item) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      if (this.isChromeStorageAvailable()) {
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      } else {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      }
    } catch (err) {
      console.error('Error guardando configuración:', err);
    }
  }

  async getHistory(): Promise<HistoryItem[]> {
    try {
      if (this.isChromeStorageAvailable()) {
        const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
        const data = result[STORAGE_KEYS.HISTORY];
        return Array.isArray(data) ? (data as HistoryItem[]) : [];
      }
      const item = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return item ? (JSON.parse(item) as HistoryItem[]) : [];
    } catch {
      return [];
    }
  }

  async addHistoryItem(item: HistoryItem): Promise<void> {
    try {
      const history = await this.getHistory();
      const updated = [item, ...history].slice(0, 50); // Máximo 50 elementos
      if (this.isChromeStorageAvailable()) {
        await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated });
      } else {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Error guardando historial:', err);
    }
  }

  async clearHistory(): Promise<void> {
    try {
      if (this.isChromeStorageAvailable()) {
        await chrome.storage.local.remove(STORAGE_KEYS.HISTORY);
      } else {
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
      }
    } catch (err) {
      console.error('Error limpiando historial:', err);
    }
  }

  async getSavedItems(): Promise<SavedItem[]> {
    try {
      if (this.isChromeStorageAvailable()) {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SAVED);
        const data = result[STORAGE_KEYS.SAVED];
        return Array.isArray(data) ? (data as SavedItem[]) : [];
      }
      const item = localStorage.getItem(STORAGE_KEYS.SAVED);
      return item ? (JSON.parse(item) as SavedItem[]) : [];
    } catch {
      return [];
    }
  }

  async saveItem(item: SavedItem): Promise<void> {
    try {
      const items = await this.getSavedItems();
      const existingIndex = items.findIndex((i) => i.id === item.id);
      let updated: SavedItem[];
      if (existingIndex >= 0) {
        updated = [...items];
        updated[existingIndex] = item;
      } else {
        updated = [item, ...items];
      }
      if (this.isChromeStorageAvailable()) {
        await chrome.storage.local.set({ [STORAGE_KEYS.SAVED]: updated });
      } else {
        localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Error guardando elemento:', err);
    }
  }

  async removeSavedItem(id: string): Promise<void> {
    try {
      const items = await this.getSavedItems();
      const updated = items.filter((i) => i.id !== id);
      if (this.isChromeStorageAvailable()) {
        await chrome.storage.local.set({ [STORAGE_KEYS.SAVED]: updated });
      } else {
        localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Error eliminando elemento guardado:', err);
    }
  }

  async getFavoriteLibraryIds(): Promise<string[]> {
    try {
      if (this.isChromeStorageAvailable()) {
        const result = await chrome.storage.local.get(STORAGE_KEYS.FAVORITE_LIBRARY_IDS);
        const data = result[STORAGE_KEYS.FAVORITE_LIBRARY_IDS];
        return Array.isArray(data) ? (data as string[]) : [];
      }
      const item = localStorage.getItem(STORAGE_KEYS.FAVORITE_LIBRARY_IDS);
      return item ? (JSON.parse(item) as string[]) : [];
    } catch {
      return [];
    }
  }

  async toggleFavoriteLibraryId(id: string): Promise<boolean> {
    try {
      const ids = await this.getFavoriteLibraryIds();
      const exists = ids.includes(id);
      const updated = exists ? ids.filter((i) => i !== id) : [...ids, id];
      if (this.isChromeStorageAvailable()) {
        await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITE_LIBRARY_IDS]: updated });
      } else {
        localStorage.setItem(STORAGE_KEYS.FAVORITE_LIBRARY_IDS, JSON.stringify(updated));
      }
      return !exists;
    } catch {
      return false;
    }
  }
}

export const storageService = new StorageService();
