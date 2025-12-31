/**
 * Database Queue Contracts
 * Контракты для асинхронной записи данных в БД
 */

// Имя очереди для записи в БД
export const QUEUE_DATABASE_STORAGE = 'database-storage';

// Типы заданий
export const JOBS_DATABASE = {
    saveContent: 'save-content',
    updateVector: 'update-vector',
    updateAiAnalysis: 'update-ai-analysis',
} as const;

// ===========================================
// PAYLOADS
// ===========================================

/**
 * Сохранение нового контента
 */
export interface SaveContentPayload {
    sourceType: string;        // 'telegram', 'twitter', etc.
    sourceExternalId: string;  // channel username
    sourceName?: string;       // Human-readable name

    externalId?: string;       // Message ID from source
    text?: string;             // Text content
    rawData?: Record<string, unknown>; // Full raw data
    sourceDate?: string;       // ISO date string
}

/**
 * Обновление вектора для контента
 */
export interface UpdateVectorPayload {
    contentId: string;         // UUID контента в нашей БД
    vector: number[];          // Embedding вектор
}

/**
 * Обновление результата AI анализа
 */
export interface UpdateAiAnalysisPayload {
    contentId: string;
    analysis: Record<string, unknown>;
}

// ===========================================
// RESPONSES (для синхронных операций)
// ===========================================

export interface ContentCreatedResponse {
    id: string;
    sourceId: string;
    qdrantId: string | null;
}
