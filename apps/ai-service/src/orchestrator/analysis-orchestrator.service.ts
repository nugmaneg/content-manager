import { Injectable, Logger } from '@nestjs/common';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import {
  GenerationOptions,
  ContentInput,
  FullContentAnalysisResult,
  BaseContentInput,
  ContentSegmentationResult,
  ContentUnitBasic,
  ContentUnitAnalysis,
  FactCheckContentResult,
} from '@queue-contracts/ai';
import {
  AnalysisService,
  PipelineOptions,
} from '../pipelines/analysis/analysis.service';

/**
 * Orchestrator — координатор анализа контента.
 *
 * Отвечает за:
 * - Выбор провайдера
 * - Передачу задачи в Pipeline
 * - Обработку ошибок (retry, fallback)
 * - Логирование и мониторинг
 *
 * НЕ отвечает за:
 * - Детали анализа (это делает Pipeline)
 * - Факт-чекинг (это делает Pipeline)
 */
@Injectable()
export class AnalysisOrchestratorService {
  private readonly logger = new Logger(AnalysisOrchestratorService.name);

  constructor(
    private readonly providerFactory: AiProviderFactory,
    private readonly analysisService: AnalysisService,
  ) { }

  // ===========================================
  // THREE-STAGE ARCHITECTURE METHODS
  // ===========================================

  /**
   * STAGE 1: Сегментация контента на ContentUnits.
   * Вызывает provider.segmentContent() и возвращает результат.
   *
   * @param input - Входной контент
   * @param providerName - Имя провайдера (по умолчанию 'xai')
   * @param generationOptions - Опции генерации
   * @returns ContentSegmentationResult
   */
  async segmentContent(
    input: ContentInput,
    providerName: string = 'xai',
    generationOptions?: GenerationOptions,
  ): Promise<ContentSegmentationResult> {
    const provider = this.providerFactory.getProvider(providerName);

    this.logger.log(
      `🚀 Orchestrator: starting segmentation with provider=${providerName}`,
    );

    const { result, meta } = await provider.segmentContent(
      input,
      generationOptions,
    );

    this.logger.log(
      `✅ Orchestrator: segmentation complete, units=${result.units.length}`,
    );

    return result;
  }

  /**
   * STAGE 2: Глубокий анализ ContentUnit.
   * Вызывает provider.analyzeContentUnit() и возвращает результат.
   *
   * @param unit - ContentUnitBasic для анализа
   * @param providerName - Имя провайдера (по умолчанию 'xai')
   * @param generationOptions - Опции генерации
   * @returns ContentUnitAnalysis
   */
  async analyzeContentUnit(
    unit: ContentUnitBasic,
    providerName: string = 'xai',
    generationOptions?: GenerationOptions,
  ): Promise<ContentUnitAnalysis> {
    const provider = this.providerFactory.getProvider(providerName);

    this.logger.log(
      `🚀 Orchestrator: analyzing unit ${unit.unitIndex} with provider=${providerName}`,
    );

    const { result, meta } = await provider.analyzeContentUnit(
      unit,
      generationOptions,
    );

    this.logger.log(
      `✅ Orchestrator: unit ${unit.unitIndex} analyzed, needsFactCheck=${result.needsFactCheck}`,
    );

    return result;
  }

  /**
   * STAGE 3: Факт-чекинг контента (batch).
   * Вызывает provider.factCheckContent() и возвращает результат.
   *
   * @param units - Массив ContentUnitAnalysis для факт-чекинга
   * @param providerName - Имя провайдера (по умолчанию 'xai')
   * @param generationOptions - Опции генерации
   * @returns FactCheckContentResult
   */
  async factCheckContent(
    units: ContentUnitAnalysis[],
    providerName: string = 'xai',
    generationOptions?: GenerationOptions,
  ): Promise<FactCheckContentResult> {
    const provider = this.providerFactory.getProvider(providerName);

    this.logger.log(
      `🚀 Orchestrator: starting fact-check for ${units.length} units with provider=${providerName}`,
    );

    const { result, meta } = await provider.factCheckContent(
      units,
      generationOptions,
    );

    this.logger.log(
      `✅ Orchestrator: fact-check complete, cost=$${result.totalCost?.toFixed(4) || '0'}`,
    );

    return result;
  }

  /**
   * Основной метод анализа контента.
   * Выбирает провайдера и передаёт работу в Pipeline.
   */
  async analyzeContent(
    input: ContentInput,
    providerName: string = 'xai',
    generationOptions?: GenerationOptions,
    forceFactCheck?: boolean,
    skipFactCheck?: boolean,
  ): Promise<FullContentAnalysisResult> {
    const provider = this.providerFactory.getProvider(providerName);

    this.logger.log(
      `🚀 Orchestrator: starting analysis with provider=${providerName}`,
    );

    const pipelineOptions: PipelineOptions = {
      skipFactCheck,
      forceFactCheck,
      generationOptions,
    };

    try {
      const result = await this.analysisService.execute(input, provider, pipelineOptions);

      this.logger.log(
        `✅ Orchestrator: analysis complete, ` +
        `units=${result.structure.unitsCount}, ` +
        `cost=$${result.totalCost?.toFixed(4) || '0'}, ` +
        `duration=${result.totalDurationMs}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(`❌ Orchestrator: analysis failed: ${error instanceof Error ? error.message : String(error)}`);

      // TODO: Реализовать retry с fallback провайдером
      throw error;
    }
  }

  /**
   * Быстрый анализ только текста (без полного ContentInput)
   */
  async quickAnalyzeContent(
    text: string,
    providerName: string = 'xai',
  ): Promise<FullContentAnalysisResult> {
    const input: BaseContentInput = {
      text,
      source: { platform: 'other' },
    };

    return this.analyzeContent(input, providerName, undefined, false, true);
  }

  /**
   * Статистика использования (для мониторинга)
   */
  async getStats() {
    return {
      message: 'Stats not implemented yet',
      // TODO: Добавить метрики использования провайдеров
    };
  }
}
