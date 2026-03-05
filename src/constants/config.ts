import { GeminiModel } from '../types';

export const BATCH_SIZE = 200;

export const MODELS: GeminiModel[] = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    info: 'Preview: best balance of quality and vocabulary coverage',
    rpm: 10,
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    info: 'Free: 10 req/min · 250/day  — Great quality + speed',
    rpm: 10,
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite Preview',
    info: 'Preview: most cost-efficient, high-volume processing',
    rpm: 15,
  },
  {
    id: 'gemini-3-pro-preview',
    label: 'Gemini 3 Pro Preview',
    info: 'Preview: advanced reasoning + multimodal — highest quality',
    rpm: 5,
  },
];
