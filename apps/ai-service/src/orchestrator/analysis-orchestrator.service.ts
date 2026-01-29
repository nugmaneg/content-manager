import { Injectable, Logger } from '@nestjs/common';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import {
  GenerationOptions,
  ContentInput,
  FullContentAnalysisResult,
  BaseContentInput,
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
