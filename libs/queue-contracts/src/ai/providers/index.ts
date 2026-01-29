/**
 * AI Providers — Типы для работы с AI-провайдерами
 */

// ===========================================
// PROVIDER META
// ===========================================

export interface ProviderMeta {
    provider: string; // 'xai', 'openai', etc.
    model: string; // 'grok-4-1-fast-reasoning', 'gpt-4o-mini'
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    durationMs: number;
    cost?: number; // в долларах
    requestId?: string; // ID запроса от провайдера
}

// ===========================================
// GENERATION OPTIONS
// ===========================================

export interface GenerationOptions {
    maxTokens?: number;
    temperature?: number;
    model?: string;
    debug?: boolean;
}
