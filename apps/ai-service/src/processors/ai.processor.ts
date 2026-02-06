import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import {
  QUEUE_AI_PROCESSING,
  JOBS_AI,
  AiJobName,
} from '../queues/queues.constants';
import {
  GenerateTextPayload,
  GenerateEmbeddingPayload,
  EmbeddingResult,
  SegmentContentPayload,
  AnalyzeContentUnitPayload,
  FactCheckContentPayload,
} from '@queue-contracts/ai';
import { AnalysisOrchestratorService } from '../orchestrator/analysis-orchestrator.service';

type AiJobPayload =
  | GenerateTextPayload
  | GenerateEmbeddingPayload
  | SegmentContentPayload
  | AnalyzeContentUnitPayload
  | FactCheckContentPayload;

@Processor(QUEUE_AI_PROCESSING)
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly providerFactory: AiProviderFactory,
    private readonly orchestrator: AnalysisOrchestratorService,
  ) {
    super();
  }

  async process(job: Job<AiJobPayload, any, AiJobName>): Promise<any> {
    this.logger.log(`Processing job ${job.name} (ID: ${job.id})`);

    try {
      switch (job.name) {
        case JOBS_AI.generateText:
          return this.handleGenerateText(job.data as GenerateTextPayload);
        case JOBS_AI.generateEmbedding:
          return this.handleGenerateEmbedding(
            job.data as GenerateEmbeddingPayload,
          );
        case JOBS_AI.segmentContent:
          return this.handleSegmentContent(job.data as SegmentContentPayload);
        case JOBS_AI.analyzeContentUnit:
          return this.handleAnalyzeContentUnit(job.data as AnalyzeContentUnitPayload);
        case JOBS_AI.factCheckContent:
          return this.handleFactCheckContent(job.data as FactCheckContentPayload);
        default:
          return this.logger.warn(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to process job ${job.name}: ${message}`, stack);
      throw error;
    }
  }

  private async handleGenerateText(data: GenerateTextPayload) {
    const providerName = data.provider || 'xai';
    const provider = this.providerFactory.getProvider(providerName);
    return await provider.generateText(data.prompt, data.options);
  }

  private async handleGenerateEmbedding(
    data: GenerateEmbeddingPayload,
  ): Promise<EmbeddingResult> {
    // Use OpenAI as default embedding provider
    const provider = data.provider
      ? this.providerFactory.getProvider(data.provider)
      : this.providerFactory.getEmbeddingProvider();

    const embedding = await provider.generateEmbedding(data.text);

    return {
      embedding,
      model: 'text-embedding-3-small',
      dimensions: embedding.length,
    };
  }

  // ===========================================
  // THREE-STAGE ARCHITECTURE HANDLERS
  // ===========================================

  /**
   * STAGE 1: Обработчик сегментации контента.
   */
  private async handleSegmentContent(data: SegmentContentPayload) {
    const { input, provider = 'xai', options } = data;
    return await this.orchestrator.segmentContent(input, provider, options);
  }

  /**
   * STAGE 2: Обработчик анализа ContentUnit.
   */
  private async handleAnalyzeContentUnit(data: AnalyzeContentUnitPayload) {
    const { unit, provider = 'xai', options } = data;
    return await this.orchestrator.analyzeContentUnit(unit, provider, options);
  }

  /**
   * STAGE 3: Обработчик факт-чекинга.
   */
  private async handleFactCheckContent(data: FactCheckContentPayload) {
    const { units, provider = 'xai', options } = data;
    return await this.orchestrator.factCheckContent(units, provider, options);
  }
}
