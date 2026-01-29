/**
 * Generation — Типы для генерации текста и эмбеддингов
 */

import { GenerationOptions } from '../providers';

// ===========================================
// TEXT GENERATION
// ===========================================

export interface GenerateTextPayload {
    prompt: string;
    provider?: string;
    options?: GenerationOptions;
}

// ===========================================
// EMBEDDING GENERATION
// ===========================================

export interface GenerateEmbeddingPayload {
    text: string;
    provider?: string; // defaults to 'openai'
}

export interface EmbeddingResult {
    embedding: number[];
    model: string;
    dimensions: number;
}
