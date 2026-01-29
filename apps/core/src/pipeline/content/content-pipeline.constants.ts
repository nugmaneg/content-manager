/**
 * Content Pipeline Constants
 *
 * Определяет имена очередей и типы job-ов для обработки контента.
 */

// Имя очереди для обработки контента
export const QUEUE_CONTENT_PIPELINE = 'content-pipeline';

// Типы job-ов
export const JOBS_CONTENT_PIPELINE = {
    processRawContent: 'process-raw-content',
    processUnitsForTopic: 'process-units-for-topic',
} as const;

// Типы для payload-ов
export interface ProcessRawContentPayload {
    rawContentId: string;
    options?: {
        skipTopicMatching?: boolean;
        minQualityScore?: number;
    };
}

export interface ProcessUnitsForTopicPayload {
    unitIds: string[];
}

// Типы для результатов
export interface ProcessRawContentResult {
    rawContentId: string;
    status: 'completed' | 'failed' | 'partial';
    unitsCreated: number;
    topicsMatched: number;
    errorMessage?: string;
    durationMs: number;
}

// Конфигурация по умолчанию
export const CONTENT_PIPELINE_CONFIG = {
    // Порог качества для сохранения юнитов
    minQualityScore: 0,

    // Порог similarity для объединения в Topic
    topicSimilarityThreshold: 0.85,

    // Модель для эмбеддингов
    embeddingModel: 'text-embedding-3-small',

    // Лимит для similarity search
    similaritySearchLimit: 5,
} as const;
