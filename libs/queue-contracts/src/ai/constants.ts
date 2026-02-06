/**
 * AI Service — Константы и базовые типы
 */

// ===========================================
// CONTENT TYPES (тип контента)
// ===========================================

/**
 * Тип контента (взаимоисключающие категории по основному интенту)
 */
export const CONTENT_TYPES = [
    'news', // новость/сводка: «что произошло» (сухая констатация фактов)
    'analysis', // аналитика: «почему произошло и что будет дальше» (глубокий разбор и прогнозы)
    'opinion', // мнение: «как я это оцениваю» (субъективный взгляд автора)
    'guide', // инструкция/советы: «как сделать X» (обучающий или практический контент)
    'announcement', // объявление: «мы запускаем / приглашаем» (уведомление о будущих событиях)
    'review', // обзор/рецензия: «стоит ли оно того» (оценка конкретного продукта или услуги)
    'rumor', // слух/инсайд: «по словам источников» (неподтвержденная информация)
    'humor', // юмор/мемы: развлекательный контент и сатира
    'ad', // реклама/спам: коммерческие предложения, реферальные ссылки
    'other', // прочее: если контент не попадает ни в одну из категорий выше
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const PRIMARY_TYPES = [...CONTENT_TYPES, 'mixed'] as const;

export type PrimaryType = (typeof PRIMARY_TYPES)[number];

// ===========================================
// CONTENT CATEGORIES (тематика)
// ===========================================

/**
 * Тематическая категория контента (можно несколько)
 */
export const CONTENT_CATEGORIES = [
    // Финансы и бизнес
    'crypto', // криптовалюты
    'nft', // NFT / цифровое искусство
    'web3', // Web3 / dApps / DeFi
    'finance', // традиционные финансы
    'markets', // рынки (акции/облигации/FX/товары)
    'investing', // инвестиции (персональные)
    'economy', // макроэкономика
    'business', // бизнес / компании
    'startups', // стартапы / венчур
    'retail', // ритейл / e-commerce

    // Технологии
    'tech', // технологии (общее)
    'ai', // ИИ / ML
    'cybersecurity', // кибербезопасность / утечки
    'social_media', // соцсети / SMM / мессенджеры

    // Политика и право
    'politics', // политика
    'geopolitics', // международные отношения / геополитика
    'law', // право / суды / регулирование
    'military', // военное дело / оборона
    'security', // безопасность (общая)

    // Развлечения и культура
    'entertainment', // развлечения (общее)
    'gaming', // игры / киберспорт
    'music', // музыка
    'movies_tv', // кино / сериалы
    'books', // книги / литература
    'culture', // культура / искусство
    'celebrity', // селебрити / инфоповоды
    'humor', // юмор / мемы

    // Спорт
    'sports', // спорт (общее)
    'fitness', // фитнес / тренировки

    // Наука и образование
    'science', // наука
    'space', // космос
    'education', // образование

    // Здоровье
    'health', // здоровье (общее)
    'medicine', // медицина / исследования / фарма
    'mental_health', // ментальное здоровье

    // Экология и инфраструктура
    'environment', // экология / климат
    'energy', // энергетика
    'transport', // транспорт / авто / авиа / жд
    'agriculture', // сельское хозяйство
    'real_estate', // недвижимость

    // Лайфстайл
    'lifestyle', // лайфстайл (общее)
    'travel', // путешествия
    'food', // еда / напитки
    'fashion', // мода
    'relationships', // отношения / семья
    'parenting', // дети / воспитание

    // Карьера и саморазвитие
    'career', // карьера / работа / HR
    'productivity', // продуктивность / самоорганизация
    'design', // дизайн

    // Гуманитарные науки
    'history', // история
    'philosophy', // философия
    'religion', // религия

    'other', // другое
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

// ===========================================
// QUEUE CONSTANTS
// ===========================================

export const QUEUE_AI_PROCESSING = 'ai_processing' as const;
export const QUEUE_CONTENT_ANALYSIS = 'content_analysis' as const;

export const JOBS_AI = {
    generateText: 'generate_text',
    generateEmbedding: 'generate_embedding',
    segmentContent: 'segment_content', // STAGE 1: сегментация RawContent
    analyzeContentUnit: 'analyze_content_unit', // STAGE 2: анализ каждого ContentUnit
    factCheckContent: 'fact_check_content', // STAGE 3: факт-чекинг
} as const;

export type AiJobName = (typeof JOBS_AI)[keyof typeof JOBS_AI];

export const JOBS_CONTENT_ANALYSIS = {
    analyzeContent: 'analyze_content',
    analyzeMedia: 'analyze_media',
} as const;

export type ContentAnalysisJobName =
    (typeof JOBS_CONTENT_ANALYSIS)[keyof typeof JOBS_CONTENT_ANALYSIS];

// ===========================================
// QUALITY THRESHOLDS
// ===========================================

export const DEFAULT_QUALITY_THRESHOLDS = {
    TRASH: 20, // 0-20: шлак
    MARGINAL: 40, // 21-40: даём шанс
    ENRICHABLE: 70, // 41-70: обогащаем
    // 71-100: отлично
} as const;

export type QualityThresholds = typeof DEFAULT_QUALITY_THRESHOLDS;

export type QualityLevel = 'trash' | 'marginal' | 'enrichable' | 'complete';

export function getQualityLevel(
    score: number,
    thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS,
): QualityLevel {
    if (score <= thresholds.TRASH) return 'trash';
    if (score <= thresholds.MARGINAL) return 'marginal';
    if (score <= thresholds.ENRICHABLE) return 'enrichable';
    return 'complete';
}
