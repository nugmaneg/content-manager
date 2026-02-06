import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import {
  JOBS_AI,
  QUEUE_AI_PROCESSING,
  GenerateTextPayload,
  GenerateEmbeddingPayload,
  EmbeddingResult,
  SegmentContentPayload,
  ContentSegmentationResult,
  AnalyzeContentUnitPayload,
  ContentUnitAnalysis,
  FactCheckContentPayload,
  FactCheckContentResult,
} from '@queue-contracts/ai';

/**
 * AiProducer — producer для очереди AI-обработки.
 *
 * Методы:
 * - analyzeContent: полный анализ контента (новый формат)
 * - analyzeText: простой анализ текста (для обратной совместимости)
 * - generateText: генерация текста
 * - generateEmbedding: генерация эмбеддингов
 */
@Injectable()
export class AiProducer {
  private readonly events: QueueEvents;

  constructor(
    @InjectQueue(QUEUE_AI_PROCESSING)
    private readonly queue: Queue,
  ) {
    const { connection, prefix } = this.queue.opts;
    this.events = new QueueEvents(QUEUE_AI_PROCESSING, {
      connection,
      prefix,
    });
  }

  /**
   * @deprecated Используйте segmentContent + analyzeContentUnit
   * Анализ контента с полной структурой (новый формат).
   * Использует rawContentId для трекинга и ContentInput для данных.
   */
  // async analyzeContent(
  //   payload: AnalyzeContentPayload,
  // ): Promise<FullContentAnalysisResult> {
  //   const job = await this.queue.add(JOBS_AI.analyzeContent, payload, {
  //     removeOnComplete: true,
  //   });
  //   return await job.waitUntilFinished(this.events);
  // }

  /**
   * @deprecated Используйте segmentContent + analyzeContentUnit
   * Простой анализ текста (для обратной совместимости).
   * Конвертирует в новый формат под капотом.
   */
  // async analyzeText(params: {
  //   text: string;
  //   provider?: string;
  //   rawContentId?: string;
  // }): Promise<FullContentAnalysisResult> {
  //   // Конвертируем в новый формат
  //   const input: ContentInput = {
  //     text: params.text,
  //     source: {
  //       platform: 'other' as const,
  //     },
  //   };

  //   const payload: AnalyzeContentPayload = {
  //     rawContentId: params.rawContentId || `inline-${Date.now()}`,
  //     input,
  //     options: {
  //       skipMediaAnalysis: true,
  //     },
  //   };

  //   const job = await this.queue.add(JOBS_AI.analyzeContent, payload, {
  //     removeOnComplete: true,
  //   });
  //   return await job.waitUntilFinished(this.events);
  // }

  /**
   * Генерация текста через AI.
   */
  async generateText(payload: GenerateTextPayload): Promise<string> {
    const job = await this.queue.add(JOBS_AI.generateText, payload, {
      removeOnComplete: true,
    });
    return await job.waitUntilFinished(this.events);
  }

  /**
   * Генерация эмбеддинга для текста.
   */
  async generateEmbedding(
    payload: GenerateEmbeddingPayload,
  ): Promise<EmbeddingResult> {
    const job = await this.queue.add(JOBS_AI.generateEmbedding, payload, {
      removeOnComplete: true,
    });
    return await job.waitUntilFinished(this.events);
  }

  // ===========================================
  // THREE-STAGE ARCHITECTURE METHODS
  // ===========================================

  /**
   * STAGE 1: Сегментация контента на ContentUnits.
   * Быстрый этап: ~4-6 сек, ~$0.003
   */
  async segmentContent(
    payload: SegmentContentPayload,
  ): Promise<ContentSegmentationResult> {
    const job = await this.queue.add(JOBS_AI.segmentContent, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });
    return await job.waitUntilFinished(this.events);
  }

  /**
   * STAGE 2: Глубокий анализ ContentUnit.
   * Средний этап: ~2-3 сек на unit, ~$0.002
   */
  async analyzeContentUnit(
    payload: AnalyzeContentUnitPayload,
  ): Promise<ContentUnitAnalysis> {
    const job = await this.queue.add(JOBS_AI.analyzeContentUnit, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });
    return await job.waitUntilFinished(this.events);
  }

  /**
   * STAGE 3: Факт-чекинг контента (batch).
   * Медленный этап: ~6-8 сек на unit, ~$0.010
   */
  async factCheckContent(
    payload: FactCheckContentPayload,
  ): Promise<FactCheckContentResult> {
    const job = await this.queue.add(JOBS_AI.factCheckContent, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });
    return await job.waitUntilFinished(this.events);
  }
}
