import { GeminiModel } from '../types';

export const BATCH_SIZE = 200;

export const MODELS: GeminiModel[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    info: 'Recommended — best quality + speed (10 req/min · 250/day)',
    rpm: 10,
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    info: 'Preview: good quality but slow (thinking model, ~35s/batch)',
    rpm: 10,
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite Preview',
    info: 'Preview: fast but unreliable (frequent count mismatches)',
    rpm: 15,
  },
  {
    id: 'gemini-3-pro-preview',
    label: 'Gemini 3 Pro Preview',
    info: 'Preview: highest quality but very slow (5 req/min)',
    rpm: 5,
  },
];
