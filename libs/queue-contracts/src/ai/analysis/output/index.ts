/**
 * Content Output — Результаты анализа контента
 */

import { ContentType, ContentCategory, PrimaryType } from '../../constants';
import { ProviderMeta } from '../../providers';
import { MediaAnalysisResult } from '../media';
import { FactCheckHint, FactCheckResult } from '../fact-check';

// ===========================================
// ENTITIES
// ===========================================

export interface ContentEntities {
    organizations?: string[];
    people?: string[];
    tickers?: string[];
    locations?: string[];
}

// ===========================================
// CONTENT STRUCTURE
// ===========================================

export interface ContentStructure {
    isComplex: boolean; // true если > 1 юнита
    unitsCount: number;
}

// ===========================================
// CONTENT UNIT ANALYSIS
// ===========================================

export interface ContentUnitAnalysis {
    // === Идентификация ===
    unitIndex: number; // порядковый номер юнита

    // === Качество юнита (0-100) ===
    /**
     * Оценка информационной ценности юнита.
     *
     * КРИТЕРИИ РАСЧЁТА:
     *
     * ПОВЫШАЮТ SCORE:
     * + Конкретные факты (даты, числа, имена, места)     +15-25
     * + Указан первоисточник/эксклюзив                   +10-15
     * + Уникальная информация (не общеизвестная)         +15-20
     * + Полный контекст (кто, что, где, когда, почему)   +10-15
     * + Проверяемые утверждения с источниками            +5-10
     *
     * ПОНИЖАЮТ SCORE:
     * - Нет конкретики (общие фразы, вода)               -20-30
     * - Тизер без содержания ("читайте по ссылке")       -40-50
     * - Реклама/промо/спам                               -50-70
     * - Слухи без указания источника                     -15-25
     * - Повтор общеизвестной информации                  -10-20
     *
     * ИТОГОВЫЕ ДИАПАЗОНЫ:
     * 0-20:   Шлак — реклама, тизеры, мусор
     * 21-40:  Маргинально — есть зерно, но мало информации
     * 41-70:  Перспективно — хорошая база, нужен контекст/проверка
     * 71-100: Отлично — самодостаточный контент
     */
    qualityScore: number;
    qualityReasoning: string;

    // === Текст юнита ===
    originalText: string; // исходный текст этого юнита

    // === Классификация ===
    contentType: ContentType;
    secondaryTypes?: ContentType[];
    categories: ContentCategory[];
    tags?: string[];

    // === Анализ ===
    summary: string;
    sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
    keywords: string[];
    language: string;

    // === Сущности ===
    entities?: ContentEntities;

    // === Связи с медиа ===
    linkedMediaIndexes?: number[];

    // === Фактчекинг ===
    needsFactCheck: boolean;
    factCheckHint?: FactCheckHint;
    /** Результат фактчекинга (заполняется после вызова factCheckUnit) */
    factCheckResult?: FactCheckResult;
}

// ===========================================
// AGGREGATED ANALYSIS (для обратной совместимости)
// ===========================================

export interface AggregatedAnalysis {
    primaryType: PrimaryType;
    allTypes: ContentType[];
    allCategories: ContentCategory[];
    allKeywords: string[];
    combinedSummary: string;
    allEntities: ContentEntities;
    language: string;
}

// ===========================================
// FULL CONTENT ANALYSIS RESULT
// ===========================================

export interface FullContentAnalysisResult {
    // === Структура ===
    structure: ContentStructure;

    // === Медиа анализ ===
    mediaAnalysis?: MediaAnalysisResult[];

    // === Юниты ===
    units: ContentUnitAnalysis[];

    // === Агрегированные данные (для обратной совместимости) ===
    aggregated: AggregatedAnalysis;

    // === Мета ===
    analyzedAt: string;
    providerMeta: {
        mediaAnalysis?: ProviderMeta;
        contentAnalysis: ProviderMeta;
    };
    totalCost?: number;
    totalDurationMs: number;
}
