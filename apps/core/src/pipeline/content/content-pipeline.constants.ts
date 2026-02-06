/**
 * Content Pipeline Constants
 *
 * Определяет имена очередей и типы job-ов для обработки контента.
 */

// ===========================================
// STATE MACHINE ENUMS
// ===========================================

/**
 * Статус обработки RawContent (общий статус pipeline)
 */
export enum RawContentStatus {
    PENDING = 'PENDING',        // Ждёт обработки
    SEGMENTED = 'SEGMENTED',    // Stage 1 завершен → ContentUnits созданы
    PROCESSING = 'PROCESSING',  // Обрабатываем ContentUnits (stages 2-5)
    COMPLETED = 'COMPLETED',    // Всё готово
    FAILED = 'FAILED',          // Критическая ошибка
}

/**
 * Статус обработки ContentUnit (детальный статус каждого юнита)
 */
export enum ContentUnitStatus {
    PENDING = 'PENDING',            // Создан, ждёт анализа
    ANALYZED = 'ANALYZED',          // Stage 2: summary, entities, keywords готовы
    VECTORIZED = 'VECTORIZED',      // Stage 3: embedding создан, сохранен в Qdrant
    MATCHED = 'MATCHED',            // Stage 4: привязан к Topic
    FACT_CHECKED = 'FACT_CHECKED', // Stage 5: fact-check пройден
    READY = 'READY',                // Полностью готов
    ERROR = 'ERROR',                // Ошибка обработки
}

// ===========================================
// QUEUE CONFIGURATION
// ===========================================

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
