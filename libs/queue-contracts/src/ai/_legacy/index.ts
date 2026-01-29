/**
 * Legacy Types — Deprecated типы для обратной совместимости
 *
 * @deprecated Все типы в этом файле устарели.
 * Используйте актуальные типы из соответствующих модулей.
 */

import { ContentType, ContentCategory } from '../constants';
import { ProviderMeta, GenerationOptions } from '../providers';
import { ContentEntities } from '../analysis/output';
import { FactCheckResult } from '@queue-contracts/ai';

// ===========================================
// LEGACY CONTENT ANALYSIS RESULT
// ===========================================

/**
 * @deprecated Используйте ContentUnitAnalysis из analysis/output
 */
export interface ContentAnalysisResult {
    // Основной анализ
    summary: string;
    sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
    keywords: string[];
    entities?: ContentEntities;
    language: string;

    // Классификация
    contentType: ContentType;
    secondaryTypes?: ContentType[];
    categories: ContentCategory[];
    tags?: string[];

    // Фактчекинг
    needsFactCheck: boolean;
    factCheckHint?: {
        reason: string;
        targets?: {
            claims?: string[];
            entities?: string[];
        };
    };
}

// ===========================================
// LEGACY FULL ANALYSIS RESULT
// ===========================================

/**
 * @deprecated Используйте FullContentAnalysisResult из analysis/output
 */
export interface FullAnalysisResult extends ContentAnalysisResult {
    factCheckResult?: FactCheckResult;

    providerMeta: {
        analysis: ProviderMeta;
        factCheck?: ProviderMeta;
    };

    analyzedAt: string;
    totalDurationMs: number;
    totalCost?: number;
}

// ===========================================
// LEGACY PAYLOADS
// ===========================================

/**
 * @deprecated Используйте AnalyzeContentPayload из payloads
 */
export interface AnalyzeTextPayload {
    text: string;
    provider?: string;
    options?: GenerationOptions;
}
