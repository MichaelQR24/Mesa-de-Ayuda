export type ToneOption = 'profesional' | 'formal' | 'amable' | 'tecnico' | 'casual';

export type ParaphraseLevel = 'suave' | 'medio' | 'completo';

export type ActionType = 'corregir' | 'parafrasear' | 'profesionalizar' | 'resumir' | 'responder';

export type NavTab = 'asistente' | 'textos-rapidos' | 'historial' | 'guardados' | 'configuracion';

export interface QuickTextItem {
  id: string;
  userId?: string;
  title: string;
  header: string;
  body: string;
  solution?: string | null;
  isShared: boolean;
  isOwner?: boolean;
  ownerDisplayName?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export type ThemeOption = 'system' | 'light' | 'dark';

export interface HistoryItem {
  id: string;
  action: ActionType;
  originalText: string;
  resultText: string;
  timestamp: number;
  tone?: ToneOption;
  paraphraseLevel?: ParaphraseLevel;
}

export interface SavedItem {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: number;
  isTemplate?: boolean;
}

export interface LibraryItem {
  id: string;
  title: string;
  category: string;
  content: string;
}

export interface AppSettings {
  defaultTone: ToneOption;
  defaultParaphraseLevel: ParaphraseLevel;
  confirmBeforeClear: boolean;
  theme: ThemeOption;
}
