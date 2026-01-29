import { Injectable, Logger } from '@nestjs/common';
import {
  ContentInput,
  FullContentAnalysisResult,
  ContentUnitAnalysis,
  getQualityLevel,
  QualityLevel,
  ProviderMeta,
  GenerationOptions,
} from '@queue-contracts/ai';
import { AiProvider, ProviderResponse } from '../../interfaces/ai-provider.interface';

export interface PipelineOptions {
  skipFactCheck?: boolean;
  forceFactCheck?: boolean;
  generationOptions?: GenerationOptions;
}

/**
 * AnalysisService — основной сервис анализа контента.
 * Получает провайдера извне (от Orchestrator) и выполняет все шаги анализа:
 * - Сегментацию на юниты
 * - Факт-чекинг (где необходим)
 * - Агрегацию результатов
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  /**
   * Полный анализ контента:
   * 1. Сегментация на юниты + базовый анализ
   * 2. Факт-чекинг юнитов (где needsFactCheck === true)
   * 3. Агрегация результатов
   */
  async execute(
    input: ContentInput,
    provider: AiProvider,
    options: PipelineOptions = {},
  ): Promise<FullContentAnalysisResult> {
    const startTime = Date.now();
    let totalCost = 0;

    this.logger.log(
      `📋 Starting pipeline, text length: ${input.text.length}`,
    );

    // ===========================================
    // STEP 1: Сегментация + анализ (один AI запрос)
    // ===========================================
    const analysisStart = Date.now();
    const { result: analysisResult, meta: analysisMeta } =
      await provider.analyzeContent(input, options.generationOptions);
    const analysisDuration = Date.now() - analysisStart;

    const analysisCost = this.estimateCost(analysisMeta.totalTokens);
    totalCost += analysisCost;

    this.logger.log(
      `✅ Step 1 (Analysis): ${analysisResult.structure.unitsCount} units, ` +
      `primaryType=${analysisResult.aggregated.primaryType}, ` +
      `duration=${analysisDuration}ms`,
    );

    // Логируем качество
    for (const unit of analysisResult.units) {
      const level = getQualityLevel(unit.qualityScore);
      this.logger.debug(
        `   Unit ${unit.unitIndex}: score=${unit.qualityScore} (${level}), ` +
        `type=${unit.contentType}, needsFactCheck=${unit.needsFactCheck}`,
      );
    }

    // ===========================================
    // STEP 2: Факт-чекинг (для юнитов, которым нужен)
    // ===========================================
    const unitsNeedingFactCheck = analysisResult.units.filter(
      (u) => u.needsFactCheck,
    );
    const shouldFactCheck =
      !options.skipFactCheck &&
      (options.forceFactCheck || unitsNeedingFactCheck.length > 0);

    let factCheckProviderMeta: ProviderMeta | undefined;

    if (shouldFactCheck && unitsNeedingFactCheck.length > 0) {
      this.logger.log(
        `🔍 Step 2 (Fact-check): ${unitsNeedingFactCheck.length} units need checking`,
      );

      for (const unit of unitsNeedingFactCheck) {
        const factCheckStart = Date.now();

        try {
          const { result: factCheckResult, meta: factCheckMeta } =
            await provider.factCheckUnit(unit, options.generationOptions);

          const factCheckDuration = Date.now() - factCheckStart;
          const factCheckCost = this.estimateCost(factCheckMeta.totalTokens, true);
          totalCost += factCheckCost;

          // Записываем результат прямо в юнит
          unit.factCheckResult = factCheckResult;

          this.logger.log(
            `   ✅ Unit ${unit.unitIndex}: verdict=${factCheckResult.verdict}, ` +
            `claims=${factCheckResult.claims.length}, ` +
            `duration=${factCheckDuration}ms`,
          );

          // Сохраняем мета последнего факт-чека (или можно агрегировать)
          factCheckProviderMeta = {
            provider: 'xai', // TODO: получать из провайдера
            model: factCheckMeta.model,
            totalTokens: factCheckMeta.totalTokens,
            promptTokens: factCheckMeta.promptTokens,
            completionTokens: factCheckMeta.completionTokens,
            durationMs: factCheckDuration,
            cost: factCheckCost,
            requestId: factCheckMeta.requestId,
          };
        } catch (error) {
          this.logger.error(
            `   ❌ Fact-check failed for unit ${unit.unitIndex}: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Продолжаем с остальными юнитами
        }
      }
    } else {
      this.logger.log('⏭️ Step 2 (Fact-check): SKIPPED');
    }

    // ===========================================
    // STEP 3: Собираем финальный результат
    // ===========================================
    const totalDurationMs = Date.now() - startTime;

    const stats = this.getUnitsStats(analysisResult.units);
    this.logger.log(
      `📊 Quality: trash=${stats.trash}, marginal=${stats.marginal}, ` +
      `enrichable=${stats.enrichable}, complete=${stats.complete}`,
    );

    const result: FullContentAnalysisResult = {
      ...analysisResult,
      providerMeta: {
        contentAnalysis: {
          provider: 'xai', // TODO: получать из провайдера
          model: analysisMeta.model,
          totalTokens: analysisMeta.totalTokens,
          promptTokens: analysisMeta.promptTokens,
          completionTokens: analysisMeta.completionTokens,
          durationMs: analysisDuration,
          cost: analysisCost,
          requestId: analysisMeta.requestId,
        },
        mediaAnalysis: factCheckProviderMeta, // TODO: переименовать в factCheck
      },
      analyzedAt: new Date().toISOString(),
      totalDurationMs,
      totalCost,
    };

    this.logger.log(
      `🎉 Pipeline complete: total=${totalDurationMs}ms, cost=$${totalCost.toFixed(4)}`,
    );

    return result;
  }

  /**
   * Статистика по качеству юнитов
   */
  private getUnitsStats(
    units: ContentUnitAnalysis[],
  ): Record<QualityLevel, number> {
    const stats: Record<QualityLevel, number> = {
      trash: 0,
      marginal: 0,
      enrichable: 0,
      complete: 0,
    };

    for (const unit of units) {
      const level = getQualityLevel(unit.qualityScore);
      stats[level]++;
    }

    return stats;
  }

  /**
   * Оценка стоимости (примерная)
   */
  private estimateCost(totalTokens?: number, isFactCheck = false): number {
    const costPerKTokens = isFactCheck ? 0.0015 : 0.00015;
    if (totalTokens) {
      return (totalTokens / 1000) * costPerKTokens;
    }
    return 0;
  }

  /**
   * Фильтрация юнитов по минимальному качеству
   */
  filterUnitsByQuality(
    units: ContentUnitAnalysis[],
    minLevel: QualityLevel,
  ): ContentUnitAnalysis[] {
    const levelOrder: QualityLevel[] = [
      'trash',
      'marginal',
      'enrichable',
      'complete',
    ];
    const minIndex = levelOrder.indexOf(minLevel);

    return units.filter((unit) => {
      const level = getQualityLevel(unit.qualityScore);
      return levelOrder.indexOf(level) >= minIndex;
    });
  }
}
