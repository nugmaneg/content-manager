import {
  GenerationOptions,
  ContentAnalysisResult,
  FactCheckResult,
  ContentInput,
  FullContentAnalysisResult,
  ContentUnitAnalysis,
  ContentSegmentationResult,
  ContentUnitBasic,
  FactCheckContentResult,
} from '@queue-contracts/ai';

export { GenerationOptions, ContentAnalysisResult, FactCheckResult };

// Метаданные ответа провайдера
export interface ProviderResponseMeta {
  model: string;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  requestId?: string;
}

// Обёртка для ответа провайдера с метаданными
export interface ProviderResponse<T> {
  result: T;
  meta: ProviderResponseMeta;
}

export interface AiProvider {
  // ===========================================
  // BASIC METHODS
  // ===========================================

  generateText(prompt: string, options?: GenerationOptions): Promise<string>;
  generateEmbedding(text: string): Promise<number[]>;

  // ===========================================
  // THREE-STAGE ARCHITECTURE METHODS
  // ===========================================

  /**
   * STAGE 1: Сегментация контента на смысловые единицы (ContentUnits).
   * Быстрый этап: ~4-6 сек, ~$0.003
   */
  segmentContent(
    input: ContentInput,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<ContentSegmentationResult>>;

  /**
   * STAGE 2: Глубокий анализ ContentUnit.
   * Средний этап: ~2-3 сек на unit, ~$0.002
   */
  analyzeContentUnit(
    unit: ContentUnitBasic,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<ContentUnitAnalysis>>;

  /**
   * STAGE 3: Факт-чекинг контента (batch).
   * Медленный этап: ~6-8 сек на unit, ~$0.010
   */
  factCheckContent(
    units: ContentUnitAnalysis[],
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FactCheckContentResult>>;

  // ===========================================
  // ANALYSIS METHODS (full flow)
  // ===========================================

  /**
   * Основной метод анализа контента с сегментацией на юниты.
   * Принимает полный ContentInput (текст + медиа + источник).
   */
  analyzeContent(
    input: ContentInput,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FullContentAnalysisResult>>;

  // ===========================================
  // FACT-CHECKING METHODS
  // ===========================================

  /**
   * Фактчекинг конкретного юнита контента с веб-поиском.
   * Вызывается для каждого юнита, где unit.needsFactCheck === true.
   * Возвращает FactCheckResult, который нужно присвоить unit.factCheckResult.
   */
  factCheckUnit(
    unit: ContentUnitAnalysis,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FactCheckResult>>;

  // ===========================================
  // LEGACY (deprecated, will be removed)
  // ===========================================

  /**
   * @deprecated Используйте analyzeContent(input: ContentInput).
   * Будет удалено после миграции всех вызовов.
   */
  _analyzeContent(
    text: string,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<ContentAnalysisResult>>;

  /**
   * @deprecated Используйте factCheckUnit(unit: ContentUnitAnalysis).
   * Будет удалено после миграции всех вызовов.
   */
  _factCheckContent(
    text: string,
    analysis: ContentAnalysisResult,
    options?: GenerationOptions,
  ): Promise<ProviderResponse<FactCheckResult>>;
}
