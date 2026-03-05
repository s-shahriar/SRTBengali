export interface SubBlock {
  index: string;
  timing: string;
  text: string;
  // ASS only
  rawPrefix?: string;
  origText?: string;
}

export interface GeminiModel {
  id: string;
  label: string;
  info: string;
  rpm: number;
}

export type SubFormat = 'srt' | 'ass' | 'vtt';

export interface SelectedFile {
  name: string;
  uri: string;
}

export class RateLimitError extends Error {
  retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
    this.name = 'RateLimitError';
  }
}
