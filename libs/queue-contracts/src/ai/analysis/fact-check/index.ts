/**
 * Fact Check — Типы для фактчекинга
 */

// ===========================================
// VERDICTS
// ===========================================

export const FACT_CHECK_VERDICTS = [
    'verified', // подтверждено достоверными источниками
    'partially_true', // частично верно (есть неточности или контекст искажён)
    'false', // опровергнуто
    'unverified', // не удалось подтвердить или опровергнуть
    'opinion', // это мнение, а не факт (не подлежит проверке)
] as const;

export type FactCheckVerdict = (typeof FACT_CHECK_VERDICTS)[number];

// ===========================================
// SOURCE RELIABILITY
// ===========================================

export const SOURCE_RELIABILITY = ['high', 'medium', 'low'] as const;
export type SourceReliability = (typeof SOURCE_RELIABILITY)[number];

// ===========================================
// CLAIM STATUS
// ===========================================

export const CLAIM_STATUSES = ['checked', 'skipped', 'error'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// ===========================================
// FACT CHECK SOURCE
// ===========================================

export interface FactCheckSource {
    url: string;
    title?: string;
    publisher?: string; // "Reuters", "Bloomberg", etc.
    publishedAt?: string; // ISO date
    quote?: string; // до 25 слов — ключевая цитата
    reliability?: SourceReliability;
}

// ===========================================
// CLAIM VERIFICATION
// ===========================================

export interface ClaimVerification {
    claim: string; // оригинальное утверждение
    status: ClaimStatus;
    verdict?: FactCheckVerdict; // только если status === 'checked'
    score?: number; // 0-1, только если status === 'checked'
    explanation: string;
    sources: FactCheckSource[];
}

// ===========================================
// FACT CHECK TARGET
// ===========================================

export interface FactCheckTarget {
    claim: string; // утверждение для проверки
    queries: string[]; // поисковые запросы (2-5 штук)
    importance?: 'high' | 'medium' | 'low';
}

// ===========================================
// FACT CHECK HINT
// ===========================================

export interface FactCheckHint {
    reason: string;
    targets: FactCheckTarget[]; // структурированные targets с queries
}

// ===========================================
// FACT CHECK RESULT
// ===========================================

export interface FactCheckResult {
    // Общий вердикт (агрегация по всем claims)
    verdict: FactCheckVerdict;
    score: number; // 0-1, средневзвешенный
    explanation: string; // краткое резюме проверки

    // Детализация по утверждениям
    claims: ClaimVerification[];

    // Дебаг / аудит
    searchPerformed: boolean;
    searchQueries?: string[]; // какие запросы модель делала в веб
    searchResultsCount?: number;
}
