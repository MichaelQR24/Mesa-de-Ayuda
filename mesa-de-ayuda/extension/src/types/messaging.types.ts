import { ActionType } from '../sidepanel/types/index';

export type SourceType = 'page' | 'input' | 'textarea' | 'contenteditable';

export interface SelectedTextContext {
  text: string;
  sourceType: SourceType;
  source?: 'context-menu' | 'direct-selection' | 'page';
  tabId?: number;
  frameId?: number;
  canReplace: boolean;
  suggestedAction?: ActionType | null;
  selectionStart?: number;
  selectionEnd?: number;
}

export type ExtensionMessage =
  | { type: 'GET_SELECTED_TEXT' }
  | { type: 'GET_SELECTED_TEXT_RESPONSE'; payload: { success: boolean; data?: SelectedTextContext; error?: string } }
  | { type: 'REPLACE_SELECTION'; payload: { replacementText: string; expectedText?: string } }
  | { type: 'REPLACE_SELECTION_RESPONSE'; payload: { success: boolean; error?: string } }
  | { type: 'LOAD_SELECTION'; payload: SelectedTextContext }
  | { type: 'CLEAR_SELECTION_CONTEXT' }
  | { type: 'PING' };
