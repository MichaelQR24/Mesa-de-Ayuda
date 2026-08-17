export type AiAction = 'correct' | 'paraphrase' | 'professionalize' | 'summarize' | 'reply';

export type AiTone = 'professional' | 'formal' | 'friendly' | 'technical' | 'casual';

export type AiParaphraseLevel = 'soft' | 'medium' | 'complete';

export interface AiProcessInput {
  text: string;
  action: AiAction;
  tone?: AiTone;
  paraphraseLevel?: AiParaphraseLevel;
  userId?: string | null;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiProcessResult {
  result: string;
  model: string;
  usage?: TokenUsage;
  latencyMs?: number;
}
