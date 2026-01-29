import {
  GenerationOptions,
  ContentAnalysisResult,
  FactCheckResult,
  ContentInput,
  FullContentAnalysisResult,
  ContentUnitAnalysis,
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
  // ANALYSIS METHODS
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
